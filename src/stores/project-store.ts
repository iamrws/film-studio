import { create } from 'zustand';
import type { FilmProject, GlobalStyle, ProjectSettings } from '../types/project';
import type { Shot } from '../types/scene';
import type { Character } from '../types/character';
import { createEmptyProject } from '../types/project';
import { parseScreenplay, extractScenes } from '../services/screenplay-parser';
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
      if (scenes[sceneIndex]) {
        scenes[sceneIndex] = { ...scenes[sceneIndex], shots };
      }
      return {
        isDirty: true,
        project: {
          ...state.project,
          scenes,
          metadata: { ...state.project.metadata, modified: new Date().toISOString() },
        },
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

  loadProject: (project) => set({ project, isDirty: false }),

  resetProject: () => set({
    project: createEmptyProject(),
    filePath: null,
    isDirty: false,
    lastSaved: null,
  }),

  // ─── Persistence ──────────────────────────────────────

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
      set({ project, isDirty: false, lastSaved: new Date().toISOString() });
    }
  },

  loadFromDisk: async (path) => {
    const project = await loadProject(path);
    if (project) {
      if (path) {
        set({ filePath: path });
        setCurrentFilePath(path);
      }
      set({ project, isDirty: false, lastSaved: new Date().toISOString() });
    }
  },

  initAutoSave: () => {
    startAutoSave(() => get().project);
  },

  stopAutoSave: () => {
    stopAutoSave();
  },


  // ─── API Keys (separate from project) ─────────────────

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
