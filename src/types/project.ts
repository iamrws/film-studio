import type { ScreenplayDocument } from './screenplay';
import type { CharacterBible } from './character';
import type { Scene, PlatformId } from './scene';

export interface GlobalStyle {
  aspectRatio: '16:9' | '21:9' | '4:3' | '9:16';
  resolution: '720p' | '1080p' | '4K';
  filmStyle: string;
  colorPalette: string;
  era: string;
  defaultLens: string;
  defaultLighting: string;
  globalNegativePrompt: string;
}

export type StoryShape =
  | 'rags_to_riches'
  | 'tragedy'
  | 'man_in_a_hole'
  | 'icarus'
  | 'cinderella'
  | 'oedipus';

export interface EmotionalArc {
  storyShape: StoryShape | null;
  sceneValences: { sceneId: string; valence: number; arousal: number }[];
}

export interface BRollClip {
  id: string;
  description: string;
  category: string;
  generatedPrompt: string;
  negativePrompt?: string;
  suggestedDurationSeconds?: number;
  platform: PlatformId;
  status: 'draft' | 'ready' | 'generating' | 'completed' | 'failed';
  generationJobId?: string;
  createdAt: string;
}

export interface QueuePlatformSettings {
  timeoutMs: number;
  maxRetries: number;
  baseBackoffMs: number;
}

export interface QueueSettings {
  maxConcurrent: number;
  pollIntervalMs: number;
  submissionDelayMs: number;
  platform: Record<PlatformId, QueuePlatformSettings>;
}

export interface ProjectSettings {
  defaultPlatform: PlatformId;
  llmProvider: 'claude' | 'gemini';
  apiKeys: Record<string, string>;
  queue: QueueSettings;
}

export interface ConceptContext {
  concept: string;
  genre: string;
  tone: string;
  targetLength: 'short' | 'medium' | 'feature';
  additionalNotes: string;
}

export interface FilmProject {
  metadata: {
    title: string;
    author: string;
    created: string;
    modified: string;
    version: string;
  };
  screenplay: ScreenplayDocument;
  characterBible: CharacterBible;
  globalStyle: GlobalStyle;
  emotionalArc: EmotionalArc;
  scenes: Scene[];
  bRollClips: BRollClip[];
  settings: ProjectSettings;
  conceptContext: ConceptContext | null;
}

export function createDefaultQueueSettings(): QueueSettings {
  return {
    maxConcurrent: 2,
    pollIntervalMs: 10_000,
    submissionDelayMs: 3_000,
    platform: {
      veo3: { timeoutMs: 60_000, maxRetries: 3, baseBackoffMs: 5_000 },
      sora2: { timeoutMs: 60_000, maxRetries: 3, baseBackoffMs: 5_000 },
      kling3: { timeoutMs: 60_000, maxRetries: 3, baseBackoffMs: 5_000 },
      seedance2: { timeoutMs: 60_000, maxRetries: 3, baseBackoffMs: 5_000 },
      runwayGen4: { timeoutMs: 60_000, maxRetries: 3, baseBackoffMs: 5_000 },
      wan22: { timeoutMs: 60_000, maxRetries: 3, baseBackoffMs: 5_000 },
    },
  };
}

export function createEmptyProject(title = 'Untitled'): FilmProject {
  return {
    metadata: {
      title,
      author: '',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      version: '1.0.0',
    },
    screenplay: {
      rawText: '',
      format: 'plain',
      parsed: null,
    },
    characterBible: { characters: [] },
    globalStyle: {
      aspectRatio: '16:9',
      resolution: '1080p',
      filmStyle: '',
      colorPalette: '',
      era: '',
      defaultLens: '35mm',
      defaultLighting: 'natural',
      globalNegativePrompt: 'blurry, low quality, distorted faces, text overlays, watermark, subtitles',
    },
    emotionalArc: {
      storyShape: null,
      sceneValences: [],
    },
    scenes: [],
    bRollClips: [],
    conceptContext: null,
    settings: {
      defaultPlatform: 'veo3',
      llmProvider: 'claude',
      apiKeys: {},
      queue: createDefaultQueueSettings(),
    },
  };
}
