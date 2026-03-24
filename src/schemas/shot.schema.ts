import { z } from 'zod';

export const CameraPromptSchema = z.object({
  shotType: z.string().default('MEDIUM SHOT'),
  movement: z.string().default('STATIC'),
  lens: z.string().default('35mm'),
  angle: z.string().default('EYE LEVEL'),
});

export const SubjectPromptSchema = z.object({
  description: z.string(),
  characters: z.array(z.string()),
  action: z.string(),
});

export const SettingPromptSchema = z.object({
  location: z.string(),
  timeOfDay: z.string(),
  weather: z.string().default(''),
  productionDesign: z.string().default(''),
});

export const LightingPromptSchema = z.object({
  style: z.string().default('natural'),
  colorTemperature: z.string().default('daylight 5600K'),
  sources: z.string().default(''),
});

export const StylePromptSchema = z.object({
  filmStock: z.string().default(''),
  colorGrade: z.string().default(''),
  era: z.string().default(''),
  reference: z.string().default(''),
});

export const AudioPromptSchema = z.object({
  dialogue: z.array(z.object({
    characterId: z.string(),
    characterName: z.string(),
    text: z.string(),
    parenthetical: z.string().optional(),
  })),
  sfx: z.array(z.string()),
  ambient: z.string().default(''),
  music: z.string().default(''),
});

export const SuspenseCalibrationSchema = z.object({
  informationAsymmetry: z.string().default(''),
  outcomeProbability: z.number().min(0).max(1).default(0.5),
});

export const ShotPsychologySchema = z.object({
  targetEmotion: z.string().default('neutral'),
  arousalLevel: z.number().min(1).max(10).default(5),
  valence: z.number().min(-5).max(5).default(0),
  transportationCues: z.array(z.string()).default([]),
  identificationMode: z.enum(['empathy', 'perspective-taking', 'motivational', 'absorption']).default('empathy'),
  schemaRelationship: z.enum(['conforming', 'violating', 'subverting']).default('conforming'),
  storyArcPosition: z.enum(['inciting', 'rising', 'crisis', 'climax', 'resolution', 'falling']).default('rising'),
  suspenseCalibration: SuspenseCalibrationSchema.default({ informationAsymmetry: '', outcomeProbability: 0.5 }),
});

export const CanonicalPromptSchema = z.object({
  camera: CameraPromptSchema,
  subject: SubjectPromptSchema,
  setting: SettingPromptSchema,
  lighting: LightingPromptSchema,
  style: StylePromptSchema,
  audio: AudioPromptSchema,
  negativePrompt: z.string().default(''),
});

export const ShotSchema = z.object({
  id: z.string().uuid(),
  sceneId: z.string().uuid(),
  sequenceOrder: z.number().int().min(0),
  durationSeconds: z.number().min(3).max(8).default(5),
  prompt: CanonicalPromptSchema,
  psychology: ShotPsychologySchema,
  renderedPrompts: z.object({
    veo3: z.string().optional(),
    sora2: z.string().optional(),
    kling3: z.string().optional(),
    seedance2: z.string().optional(),
    runwayGen4: z.string().optional(),
    hailuo: z.string().optional(),
    wan: z.string().optional(),
    ltx: z.string().optional(),
    grok: z.string().optional(),
    generic: z.string(),
  }),
  generations: z.array(z.object({
    id: z.string(),
    shotId: z.string(),
    platform: z.enum(['veo3', 'sora2', 'kling3', 'seedance2', 'runwayGen4', 'wan22']),
    status: z.enum(['queued', 'submitted', 'processing', 'completed', 'failed']),
    promptUsed: z.string(),
    apiRequestId: z.string(),
    submittedAt: z.string(),
    completedAt: z.string().nullable(),
    outputPath: z.string().nullable(),
    costEstimate: z.number(),
    seed: z.number().nullable(),
    rating: z.number().nullable(),
    notes: z.string(),
  })),
  boardStatus: z.enum(['backlog', 'ready', 'generating', 'review', 'done']).default('backlog'),
  boardOrder: z.number().int().min(0).default(0),
  targetPlatform: z.enum(['veo3', 'sora2', 'kling3', 'seedance2', 'runwayGen4', 'wan22']).default('veo3'),
});

export type ValidatedShot = z.infer<typeof ShotSchema>;
