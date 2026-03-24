import type { SceneHeading } from './screenplay';

export interface DialogueLine {
  characterId: string;
  characterName: string;
  text: string;
  parenthetical?: string;
}

export interface CameraPrompt {
  shotType: string;
  movement: string;
  lens: string;
  angle: string;
}

export interface SubjectPrompt {
  description: string;
  characters: string[];
  action: string;
}

export interface SettingPrompt {
  location: string;
  timeOfDay: string;
  weather: string;
  productionDesign: string;
}

export interface LightingPrompt {
  style: string;
  colorTemperature: string;
  sources: string;
}

export interface StylePrompt {
  filmStock: string;
  colorGrade: string;
  era: string;
  reference: string;
}

export interface AudioPrompt {
  dialogue: DialogueLine[];
  sfx: string[];
  ambient: string;
  music: string;
}

export interface SuspenseCalibration {
  informationAsymmetry: string;
  outcomeProbability: number;
}

export interface ShotPsychology {
  targetEmotion: string;
  arousalLevel: number;
  valence: number;
  transportationCues: string[];
  identificationMode: 'empathy' | 'perspective-taking' | 'motivational' | 'absorption';
  schemaRelationship: 'conforming' | 'violating' | 'subverting';
  storyArcPosition: 'inciting' | 'rising' | 'crisis' | 'climax' | 'resolution' | 'falling';
  suspenseCalibration: SuspenseCalibration;
}

export interface CanonicalPrompt {
  camera: CameraPrompt;
  subject: SubjectPrompt;
  setting: SettingPrompt;
  lighting: LightingPrompt;
  style: StylePrompt;
  audio: AudioPrompt;
  negativePrompt: string;
}

export interface RenderedPrompts {
  veo3?: string;
  sora2?: string;
  kling3?: string;
  seedance2?: string;
  runwayGen4?: string;
  hailuo?: string;
  wan?: string;
  ltx?: string;
  grok?: string;
  generic: string;
}

export type PromptPlatformId =
  | 'veo3' | 'sora2' | 'kling3' | 'seedance2'
  | 'runwayGen4' | 'hailuo' | 'wan' | 'ltx' | 'grok';

export const SHOT_BOARD_STATUSES = ['backlog', 'ready', 'generating', 'review', 'done'] as const;
export type ShotBoardStatus = typeof SHOT_BOARD_STATUSES[number];

export interface Generation {
  id: string;
  shotId: string;
  platform: PlatformId;
  status: 'queued' | 'submitted' | 'processing' | 'completed' | 'failed';
  promptUsed: string;
  apiRequestId: string;
  submittedAt: string;
  completedAt: string | null;
  outputPath: string | null;
  costEstimate: number;
  seed: number | null;
  rating: number | null;
  notes: string;
}

export type PlatformId = 'veo3' | 'sora2' | 'kling3' | 'seedance2' | 'runwayGen4' | 'wan22';

export interface Shot {
  id: string;
  sceneId: string;
  sequenceOrder: number;
  durationSeconds: number;
  prompt: CanonicalPrompt;
  psychology: ShotPsychology;
  renderedPrompts: RenderedPrompts;
  generations: Generation[];
  boardStatus: ShotBoardStatus;
  boardOrder: number;
  targetPlatform: PlatformId;
}

export interface Scene {
  id: string;
  screenplayRef: { startLine: number; endLine: number };
  heading: SceneHeading;
  actionSummary: string;
  charactersPresent: string[];
  dialogue: DialogueLine[];
  shots: Shot[];
  notes: string;
}
