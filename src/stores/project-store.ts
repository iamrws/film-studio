import { create } from 'zustand';
import type { FilmProject, GlobalStyle, ProjectSettings, BRollClip } from '../types/project';
import type { Character } from '../types/character';
import type { Generation, PlatformId, Shot, ShotBoardStatus } from '../types/scene';
import { createEmptyProject } from '../types/project';
import { parseScreenplay, extractScenes } from '../services/screenplay-parser';
import { renderAllPrompts } from '../services/prompt-renderer';
import {
  saveProject,
  loadProject,
  saveProjectAs,
  openProjectDialog,
  startAutoSave,
  stopAutoSave,
  setCurrentFilePath,
  loadApiKeys,
  saveApiKeys,
} from '../services/persistence';

const BOARD_STATUSES: ShotBoardStatus[] = ['backlog', 'ready', 'generating', 'review', 'done'];

interface ProjectState {
  project: FilmProject;
  activeScreen: string;
  selectedSceneIndex: number | null;
  filePath: string | null;
  isDirty: boolean;
  isSaving: boolean;
  lastSaved: string | null;

  // Actions
  setActiveScreen: (screen: string) => void;
  setSelectedScene: (index: number | null) => void;
  updateScreenplayText: (text: string) => void;
  parseCurrentScreenplay: () => void;
  updateProjectTitle: (title: string) => void;
  updateSettings: (settings: Partial<ProjectSettings>) => void;
  updateGlobalStyle: (style: Partial<GlobalStyle>) => void;
  setShotsForScene: (sceneIndex: number, shots: Shot[]) => void;
  updateCharacters: (characters: Character[]) => void;
  updateShotBoardStatus: (shotId: string, status: ShotBoardStatus) => void;
  reorderShots: (status: ShotBoardStatus, orderedShotIds: string[]) => void;
  batchMoveShots: (shotIds: string[], status: ShotBoardStatus) => void;
  updateShotTargetPlatform: (shotId: string, platform: PlatformId) => void;
  updateShotAction: (shotId: string, action: string) => void;
  upsertShotGeneration: (shotId: string, generation: Generation) => void;
  updateShotGenerationRating: (shotId: string, generationId: string, rating: number | null) => void;
  addBRollClip: (clip: BRollClip) => void;
  updateBRollClip: (clipId: string, updates: Partial<BRollClip>) => void;
  removeBRollClip: (clipId: string) => void;
  loadProject: (project: FilmProject) => void;
  resetProject: () => void;

  // Persistence actions
  save: () => Promise<void>;
  saveAs: () => Promise<void>;
  openProject: () => Promise<void>;
  loadFromDisk: (filePath?: string) => Promise<void>;
  initAutoSave: () => void;
  stopAutoSave: () => void;

  // API key actions (stored separately from project)
  loadPersistedApiKeys: () => void;
  persistApiKeys: (keys: Record<string, string>) => void;
}

function touchProject(project: FilmProject): FilmProject {
  return {
    ...project,
    metadata: {
      ...project.metadata,
      modified: new Date().toISOString(),
    },
  };
}

function sortShotsForBoard(a: Shot, b: Shot): number {
  return a.boardOrder - b.boardOrder || a.sequenceOrder - b.sequenceOrder;
}

function inferBoardStatus(shot: Shot): ShotBoardStatus {
  if (shot.generations.some((g) => g.status === 'completed')) return 'review';
  if (shot.generations.some((g) => g.status === 'queued' || g.status === 'submitted' || g.status === 'processing')) {
    return 'generating';
  }
  if (shot.generations.some((g) => g.status === 'failed')) return 'ready';
  return 'backlog';
}

function normalizeShot(
  shot: Shot,
  fallbackPlatform: PlatformId,
  fallbackOrder: number
): Shot {
  const normalizedTargetPlatform =
    shot.targetPlatform && shot.targetPlatform !== 'wan22'
      ? shot.targetPlatform
      : shot.generations.at(-1)?.platform ?? fallbackPlatform;

  return {
    ...shot,
    boardStatus: shot.boardStatus ?? inferBoardStatus(shot),
    boardOrder: Number.isFinite(shot.boardOrder) ? shot.boardOrder : fallbackOrder,
    targetPlatform: normalizedTargetPlatform,
  };
}

function reindexBoardOrders(project: FilmProject): FilmProject {
  const orderById = new Map<string, number>();
  const allShots = project.scenes.flatMap((scene) => scene.shots);

  for (const status of BOARD_STATUSES) {
    const shots = allShots.filter((shot) => shot.boardStatus === status).sort(sortShotsForBoard);
    shots.forEach((shot, index) => orderById.set(shot.id, index));
  }

  let changed = false;
  const scenes = project.scenes.map((scene) => {
    let sceneChanged = false;
    const shots = scene.shots.map((shot) => {
      const nextOrder = orderById.get(shot.id);
      if (nextOrder === undefined || nextOrder === shot.boardOrder) {
        return shot;
      }
      changed = true;
      sceneChanged = true;
      return { ...shot, boardOrder: nextOrder };
    });
    return sceneChanged ? { ...scene, shots } : scene;
  });

  return changed ? { ...project, scenes } : project;
}

function normalizeProject(project: FilmProject): FilmProject {
  const fallbackPlatform = project.settings.defaultPlatform ?? 'veo3';

  const scenes = project.scenes.map((scene) => ({
    ...scene,
    shots: scene.shots.map((shot, index) => normalizeShot(shot, fallbackPlatform, index)),
  }));

  return reindexBoardOrders({ ...project, scenes });
}

function updateShotById(
  project: FilmProject,
  shotId: string,
  updater: (shot: Shot, project: FilmProject) => Shot
): { project: FilmProject; changed: boolean } {
  let changed = false;

  const scenes = project.scenes.map((scene) => {
    let sceneChanged = false;
    const shots = scene.shots.map((shot) => {
      if (shot.id !== shotId) return shot;
      const nextShot = updater(shot, project);
      if (nextShot === shot) return shot;
      changed = true;
      sceneChanged = true;
      return nextShot;
    });

    return sceneChanged ? { ...scene, shots } : scene;
  });

  return {
    changed,
    project: changed ? { ...project, scenes } : project,
  };
}

function setBoardOrdersForStatus(
  project: FilmProject,
  status: ShotBoardStatus,
  orderedShotIds: string[]
): { project: FilmProject; changed: boolean } {
  const explicitOrder = new Map(orderedShotIds.map((id, index) => [id, index]));
  let fallbackIndex = orderedShotIds.length;
  let changed = false;

  const scenes = project.scenes.map((scene) => {
    let sceneChanged = false;
    const shots = scene.shots.map((shot) => {
      if (shot.boardStatus !== status) return shot;
      const nextOrder = explicitOrder.get(shot.id) ?? fallbackIndex++;
      if (nextOrder === shot.boardOrder) return shot;
      changed = true;
      sceneChanged = true;
      return { ...shot, boardOrder: nextOrder };
    });
    return sceneChanged ? { ...scene, shots } : scene;
  });

  return {
    changed,
    project: changed ? { ...project, scenes } : project,
  };
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: createEmptyProject(),
  activeScreen: 'dashboard',
  selectedSceneIndex: null,
  filePath: null,
  isDirty: false,
  isSaving: false,
  lastSaved: null,

  setActiveScreen: (screen) => set({ activeScreen: screen }),

  setSelectedScene: (index) => set({ selectedSceneIndex: index }),

  updateScreenplayText: (text) =>
    set((state) => ({
      isDirty: true,
      project: {
        ...state.project,
        screenplay: {
          ...state.project.screenplay,
          rawText: text,
        },
        metadata: {
          ...state.project.metadata,
          modified: new Date().toISOString(),
        },
      },
    })),

  parseCurrentScreenplay: () => {
    const { project } = get();
    const rawText = project.screenplay.rawText;

    // Strip markdown fences if LLM wrapped the output
    let cleaned = rawText
      .replace(/^```(?:fountain|screenplay|markdown|text)?\n?/gm, '')
      .replace(/^```\s*$/gm, '')
      .trim();

    // If the LLM returned JSON wrapping the screenplay, extract it
    if (cleaned.startsWith('{')) {
      try {
        const obj = JSON.parse(cleaned);
        const text = obj.screenplay || obj.script || obj.text || obj.content;
        if (typeof text === 'string' && text.length > 100) {
          cleaned = text;
        }
      } catch {
        // Not valid JSON, continue with raw text
      }
    }

    if (cleaned !== rawText) {
      // Update the raw text in the store with cleaned version
      get().updateScreenplayText(cleaned);
    }

    const parsed = parseScreenplay(cleaned);

    console.log('[Film Studio] Parse result:', {
      rawLength: cleaned.length,
      elements: parsed.elements.length,
      sceneCount: parsed.sceneCount,
      characters: parsed.characters,
      locations: parsed.locations,
      first500: cleaned.slice(0, 500),
    });

    const extractedScenes = extractScenes(parsed);
    const scenes = extractedScenes.map((es) => ({
      id: crypto.randomUUID(),
      screenplayRef: { startLine: es.startLine, endLine: es.endLine },
      heading: es.heading,
      actionSummary: '',
      charactersPresent: es.characters,
      dialogue: [],
      shots: [],
      notes: '',
    }));

    set((state) => ({
      isDirty: true,
      project: {
        ...state.project,
        screenplay: {
          ...state.project.screenplay,
          parsed,
        },
        scenes,
        metadata: {
          ...state.project.metadata,
          modified: new Date().toISOString(),
        },
      },
    }));
  },

  updateProjectTitle: (title) =>
    set((state) => ({
      isDirty: true,
      project: {
        ...state.project,
        metadata: { ...state.project.metadata, title },
      },
    })),

  updateSettings: (settings) =>
    set((state) => ({
      isDirty: true,
      project: {
        ...state.project,
        settings: { ...state.project.settings, ...settings },
        metadata: { ...state.project.metadata, modified: new Date().toISOString() },
      },
    })),

  updateGlobalStyle: (style) =>
    set((state) => ({
      isDirty: true,
      project: {
        ...state.project,
        globalStyle: { ...state.project.globalStyle, ...style } as GlobalStyle,
        metadata: { ...state.project.metadata, modified: new Date().toISOString() },
      },
    })),

  setShotsForScene: (sceneIndex, shots) =>
    set((state) => {
      const scenes = [...state.project.scenes];
      if (!scenes[sceneIndex]) return state;

      const fallbackPlatform = state.project.settings.defaultPlatform;
      const normalizedShots = shots.map((shot, index) => normalizeShot(shot, fallbackPlatform, index));
      scenes[sceneIndex] = { ...scenes[sceneIndex], shots: normalizedShots };

      const nextProject = reindexBoardOrders({
        ...state.project,
        scenes,
      });

      return {
        isDirty: true,
        project: touchProject(nextProject),
      };
    }),

  updateCharacters: (characters) =>
    set((state) => ({
      isDirty: true,
      project: {
        ...state.project,
        characterBible: { characters },
        metadata: { ...state.project.metadata, modified: new Date().toISOString() },
      },
    })),

  updateShotBoardStatus: (shotId, status) =>
    set((state) => {
      const nextOrder = state.project.scenes
        .flatMap((scene) => scene.shots)
        .filter((shot) => shot.boardStatus === status && shot.id !== shotId)
        .length;

      const updated = updateShotById(state.project, shotId, (shot) => {
        if (shot.boardStatus === status) return shot;
        return { ...shot, boardStatus: status, boardOrder: nextOrder };
      });

      if (!updated.changed) return state;

      return {
        isDirty: true,
        project: touchProject(reindexBoardOrders(updated.project)),
      };
    }),

  reorderShots: (status, orderedShotIds) =>
    set((state) => {
      const reordered = setBoardOrdersForStatus(state.project, status, orderedShotIds);
      if (!reordered.changed) return state;

      return {
        isDirty: true,
        project: touchProject(reindexBoardOrders(reordered.project)),
      };
    }),

  batchMoveShots: (shotIds, status) =>
    set((state) => {
      if (shotIds.length === 0) return state;

      const existingShotIds = new Set(
        state.project.scenes.flatMap((scene) => scene.shots.map((shot) => shot.id))
      );

      const dedupedMovedIds: string[] = [];
      const movedSet = new Set<string>();
      for (const id of shotIds) {
        if (!existingShotIds.has(id) || movedSet.has(id)) continue;
        movedSet.add(id);
        dedupedMovedIds.push(id);
      }
      if (dedupedMovedIds.length === 0) return state;

      let statusChanged = false;
      const withUpdatedStatuses: FilmProject = {
        ...state.project,
        scenes: state.project.scenes.map((scene) => {
          let sceneChanged = false;
          const shots = scene.shots.map((shot) => {
            if (!movedSet.has(shot.id) || shot.boardStatus === status) return shot;
            statusChanged = true;
            sceneChanged = true;
            return { ...shot, boardStatus: status };
          });
          return sceneChanged ? { ...scene, shots } : scene;
        }),
      };

      if (!statusChanged) return state;

      const nonMovedTargetIds = withUpdatedStatuses.scenes
        .flatMap((scene) => scene.shots)
        .filter((shot) => shot.boardStatus === status && !movedSet.has(shot.id))
        .sort(sortShotsForBoard)
        .map((shot) => shot.id);

      const finalTargetOrder = [...nonMovedTargetIds, ...dedupedMovedIds];
      const reorderedTarget = setBoardOrdersForStatus(withUpdatedStatuses, status, finalTargetOrder);

      return {
        isDirty: true,
        project: touchProject(reindexBoardOrders(reorderedTarget.project)),
      };
    }),

  updateShotTargetPlatform: (shotId, platform) =>
    set((state) => {
      const updated = updateShotById(state.project, shotId, (shot) => {
        if (shot.targetPlatform === platform) return shot;
        return { ...shot, targetPlatform: platform };
      });
      if (!updated.changed) return state;

      return {
        isDirty: true,
        project: touchProject(updated.project),
      };
    }),

  updateShotAction: (shotId, action) =>
    set((state) => {
      const cleanedAction = action.trim();

      const updated = updateShotById(state.project, shotId, (shot, project) => {
        if (shot.prompt.subject.action === cleanedAction) return shot;

        const updatedShot: Shot = {
          ...shot,
          prompt: {
            ...shot.prompt,
            subject: {
              ...shot.prompt.subject,
              action: cleanedAction,
            },
          },
        };

        return {
          ...updatedShot,
          renderedPrompts: renderAllPrompts(
            updatedShot,
            project.globalStyle,
            project.characterBible.characters
          ),
        };
      });

      if (!updated.changed) return state;

      return {
        isDirty: true,
        project: touchProject(updated.project),
      };
    }),

  upsertShotGeneration: (shotId, generation) =>
    set((state) => {
      const updated = updateShotById(state.project, shotId, (shot) => {
        const existingIndex = shot.generations.findIndex(
          (g) => g.id === generation.id || g.apiRequestId === generation.apiRequestId
        );

        if (existingIndex === -1) {
          return { ...shot, generations: [...shot.generations, generation] };
        }

        const nextGenerations = [...shot.generations];
        const prevGeneration = nextGenerations[existingIndex];
        if (
          prevGeneration.status === generation.status &&
          prevGeneration.outputPath === generation.outputPath &&
          prevGeneration.completedAt === generation.completedAt &&
          prevGeneration.rating === generation.rating &&
          prevGeneration.notes === generation.notes
        ) {
          return shot;
        }

        nextGenerations[existingIndex] = generation;
        return { ...shot, generations: nextGenerations };
      });

      if (!updated.changed) return state;

      return {
        isDirty: true,
        project: touchProject(updated.project),
      };
    }),

  updateShotGenerationRating: (shotId, generationId, rating) =>
    set((state) => {
      const updated = updateShotById(state.project, shotId, (shot) => {
        const idx = shot.generations.findIndex((g) => g.id === generationId);
        if (idx === -1) return shot;
        if (shot.generations[idx].rating === rating) return shot;

        const nextGenerations = [...shot.generations];
        nextGenerations[idx] = {
          ...nextGenerations[idx],
          rating,
        };
        return { ...shot, generations: nextGenerations };
      });

      if (!updated.changed) return state;

      return {
        isDirty: true,
        project: touchProject(updated.project),
      };
    }),

  addBRollClip: (clip) =>
    set((state) => ({
      isDirty: true,
      project: touchProject({
        ...state.project,
        bRollClips: [...(state.project.bRollClips || []), clip],
      }),
    })),

  updateBRollClip: (clipId, updates) =>
    set((state) => {
      const clips = (state.project.bRollClips || []).map((c) =>
        c.id === clipId ? { ...c, ...updates } : c
      );
      return {
        isDirty: true,
        project: touchProject({ ...state.project, bRollClips: clips }),
      };
    }),

  removeBRollClip: (clipId) =>
    set((state) => ({
      isDirty: true,
      project: touchProject({
        ...state.project,
        bRollClips: (state.project.bRollClips || []).filter((c) => c.id !== clipId),
      }),
    })),

  loadProject: (project) => set({ project: normalizeProject({ ...project, bRollClips: project.bRollClips || [] }), isDirty: false }),

  resetProject: () => set({
    project: createEmptyProject(),
    filePath: null,
    isDirty: false,
    lastSaved: null,
  }),

  // Persistence

  save: async () => {
    const { project, filePath } = get();
    set({ isSaving: true });
    try {
      if (filePath) {
        await saveProject(project, filePath);
      } else {
        const newPath = await saveProjectAs(project);
        if (newPath && newPath !== 'download') {
          set({ filePath: newPath });
          setCurrentFilePath(newPath);
        }
      }
      set({ isDirty: false, isSaving: false, lastSaved: new Date().toISOString() });
    } catch (err) {
      console.error('Save failed:', err);
      set({ isSaving: false });
    }
  },

  saveAs: async () => {
    const { project } = get();
    set({ isSaving: true });
    try {
      const newPath = await saveProjectAs(project);
      if (newPath && newPath !== 'download') {
        set({ filePath: newPath });
        setCurrentFilePath(newPath);
      }
      set({ isDirty: false, isSaving: false, lastSaved: new Date().toISOString() });
    } catch (err) {
      console.error('Save As failed:', err);
      set({ isSaving: false });
    }
  },

  openProject: async () => {
    const project = await openProjectDialog();
    if (project) {
      set({ project: normalizeProject(project), isDirty: false, lastSaved: new Date().toISOString() });
    }
  },

  loadFromDisk: async (path) => {
    const project = await loadProject(path);
    if (project) {
      if (path) {
        set({ filePath: path });
        setCurrentFilePath(path);
      }
      set({ project: normalizeProject(project), isDirty: false, lastSaved: new Date().toISOString() });
    }
  },

  initAutoSave: () => {
    startAutoSave(() => get().project);
  },

  stopAutoSave: () => {
    stopAutoSave();
  },

  // API Keys (separate from project)

  loadPersistedApiKeys: () => {
    const keys = loadApiKeys();
    if (Object.keys(keys).length > 0) {
      set((state) => ({
        project: {
          ...state.project,
          settings: {
            ...state.project.settings,
            apiKeys: { ...keys, ...state.project.settings.apiKeys },
          },
        },
      }));
    }
  },

  persistApiKeys: (keys) => {
    saveApiKeys(keys);
  },
}));
