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

export interface ProjectSettings {
  defaultPlatform: PlatformId;
  llmProvider: 'claude' | 'gemini';
  apiKeys: Record<string, string>;
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
  settings: ProjectSettings;
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
    settings: {
      defaultPlatform: 'veo3',
      llmProvider: 'claude',
      apiKeys: {},
    },
  };
}
