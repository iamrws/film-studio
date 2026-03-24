import type { PlatformId, Shot, ShotBoardStatus } from '../../types/scene';

export interface BoardShotItem {
  shot: Shot;
  sceneId: string;
  sceneLabel: string;
}

export const BOARD_COLUMNS: Array<{
  id: ShotBoardStatus;
  title: string;
  description: string;
}> = [
  { id: 'backlog', title: 'Backlog', description: 'Prompted but not planned' },
  { id: 'ready', title: 'Ready', description: 'Reviewed and queued for submit' },
  { id: 'generating', title: 'Generating', description: 'Submitted to platform' },
  { id: 'review', title: 'Review', description: 'Generation complete, needs approval' },
  { id: 'done', title: 'Done', description: 'Approved and finalized' },
];

export const SUPPORTED_GENERATION_PLATFORMS: PlatformId[] = [
  'veo3',
  'sora2',
  'kling3',
  'seedance2',
  'runwayGen4',
];

export const PLATFORM_OPTIONS: Array<{ id: PlatformId; label: string }> = [
  { id: 'veo3', label: 'Veo 3' },
  { id: 'sora2', label: 'Sora 2' },
  { id: 'kling3', label: 'Kling 3' },
  { id: 'seedance2', label: 'Seedance 2' },
  { id: 'runwayGen4', label: 'Runway Gen-4' },
];

export const PLATFORM_API_KEY_FIELD: Record<PlatformId, string> = {
  veo3: 'gemini',
  sora2: 'openai',
  kling3: 'kling',
  seedance2: 'seedance',
  runwayGen4: 'runway',
  wan22: 'wan',
};
