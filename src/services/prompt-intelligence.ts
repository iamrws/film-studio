import type { GlobalStyle } from '../types/project';
import type { Shot } from '../types/scene';

export interface PromptIssue {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export interface PromptQualityBreakdown {
  coverage: number;
  specificity: number;
  consistency: number;
  platformFit: number;
  temporalCoherence: number;
}

export interface PromptQualityReport {
  score: number;
  breakdown: PromptQualityBreakdown;
  issues: PromptIssue[];
  formula: string;
}

const SCORE_FORMULA = 'score = 0.30*coverage + 0.25*specificity + 0.20*consistency + 0.15*platformFit + 0.10*temporalCoherence';

type PlatformKey =
  | 'veo3'
  | 'sora2'
  | 'kling3'
  | 'seedance2'
  | 'runwayGen4'
  | 'hailuo'
  | 'wan'
  | 'ltx'
  | 'grok'
  | 'generic'
  | 'unknown';

const VAGUE_TERMS = [
  'cinematic',
  'beautiful',
  'stunning',
  'dramatic',
  'moody',
  'epic',
  'stylish',
  'realistic',
  'gorgeous',
  'cool',
  'nice',
  'good',
  'amazing',
  'intense',
];

const VISUAL_ACTION_REPLACEMENT = 'taps fingers against the edge of the table, shifts weight, and glances toward the doorway';

const CAMERA_TAXONOMY_MARKERS = [
  'close up',
  'wide shot',
  'extreme wide',
  'establishing shot',
  'point of view',
  'pov',
  'over the shoulder',
  'tracking shot',
  'steadicam',
  'handheld',
  'dolly in',
  'dolly out',
  'push in',
  'pull back',
  'truck left',
  'truck right',
  'pedestal up',
  'pedestal down',
  'crane shot',
  'whip pan',
  'swish pan',
  'dolly zoom',
  'vertigo effect',
  'rack focus',
  'orbit',
  'drone reveal',
  'fpv drone dive',
  'birds eye',
  'worms eye',
  'hyperlapse',
  'bullet time',
];

const LENS_DOF_MARKERS = [
  '8mm',
  '14mm',
  '16mm',
  '18mm',
  '24mm',
  '28mm',
  '35mm',
  '50mm',
  '70mm',
  '85mm',
  '100mm',
  '135mm',
  '200mm',
  '300mm',
  'telephoto',
  'ultra-wide',
  'wide-angle',
  'macro',
  'fisheye',
  'anamorphic',
  'tilt-shift',
  'f/1.2',
  'f/1.4',
  'f/2',
  'f/2.8',
  'f/8',
  'shallow depth of field',
  'deep focus',
  'subject isolation',
  'bokeh',
  'creamy bokeh',
  'oval bokeh',
  'specular highlights',
];

const LIGHTING_SPEC_MARKERS = [
  '3200k',
  '5600k',
  'camera-left',
  'camera right',
  'soft fill',
  'hard light',
  'practical lighting',
  'high-key',
  'low-key',
  'rembrandt',
  'butterfly lighting',
  'split lighting',
  'rim light',
  'three-point',
  'chiaroscuro',
  'golden hour',
  'blue hour',
  'neon practicals',
];

const COMPOSITION_MARKERS = [
  'rule of thirds',
  'symmetrical composition',
  'leading lines',
  'negative space',
  'framing within frame',
  'depth layering',
  'vanishing point',
  '2.39:1',
  '16:9',
  '9:16',
  '4:3',
  '1.85:1',
];

const AUDIO_MARKERS = ['audio', 'dialogue', 'sfx', 'sound', 'ambient', 'music', 'background sound'];

const FAST_ACTION_MARKERS = ['runs', 'sprints', 'dashes', 'lunges', 'jumps', 'explodes', 'bursts', 'whips'];
const FAST_CAMERA_MARKERS = ['whip pan', 'swish pan', 'crash zoom', 'fast pan', 'rapid camera'];

function normalizeLookup(text: string): string {
  return text
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^\w\s:/[\].]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTerminalPunctuation(text: string): string {
  return text.trim().replace(/[.\s]+$/, '');
}

function joinSentences(parts: string[]): string {
  const cleaned = parts.map(stripTerminalPunctuation).filter(Boolean);
  return cleaned.length > 0 ? `${cleaned.join('. ')}.` : '';
}

function countWords(text: string): number {
  const cleaned = normalizeLookup(text);
  if (!cleaned) return 0;
  return cleaned.split(' ').filter(Boolean).length;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(' ').trim();
}

function truncateChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).trim();
}

function hasPhrase(text: string, phrase: string): boolean {
  const haystack = normalizeLookup(text);
  const needle = normalizeLookup(phrase);
  if (needle.length === 0) return false;
  if (needle.includes(' ')) {
    return haystack.includes(needle);
  }

  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(haystack);
}

function countPhraseHits(text: string, phrases: string[]): number {
  return phrases.reduce((count, phrase) => count + (hasPhrase(text, phrase) ? 1 : 0), 0);
}

function scoreLengthFit(wordCount: number, minWords: number, maxWords: number): number {
  if (wordCount <= 0) return 0;
  if (wordCount >= minWords && wordCount <= maxWords) return 100;
  if (wordCount < minWords) {
    return clamp(100 - (minWords - wordCount) * 1.4);
  }
  return clamp(100 - (wordCount - maxWords) * 1.15);
}

function normalizePlatform(platform: string): PlatformKey {
  const key = normalizeLookup(platform).replace(/\s+/g, '');

  if (key === 'veo3' || key === 'veo') return 'veo3';
  if (key === 'sora2' || key === 'sora') return 'sora2';
  if (key === 'kling3' || key === 'kling') return 'kling3';
  if (key === 'seedance2' || key === 'seedance') return 'seedance2';
  if (key === 'runwaygen4' || key === 'runwaygen') return 'runwayGen4';
  if (key === 'hailuo' || key === 'minimax') return 'hailuo';
  if (key === 'wan' || key === 'wan22') return 'wan';
  if (key === 'ltx') return 'ltx';
  if (key === 'grok') return 'grok';
  if (key === 'generic') return 'generic';
  return 'unknown';
}

function buildCameraFragment(shot: Shot, globalStyle: GlobalStyle): string {
  return [
    shot.prompt.camera.shotType,
    shot.prompt.camera.movement,
    shot.prompt.camera.angle,
    shot.prompt.camera.lens || globalStyle.defaultLens,
  ].filter(Boolean).join(', ');
}

function buildSubjectFragment(shot: Shot): string {
  return [
    shot.prompt.subject.description,
    shot.prompt.subject.action,
  ].filter(Boolean).join(' with ');
}

function buildSettingFragment(shot: Shot): string {
  return [
    shot.prompt.setting.location,
    shot.prompt.setting.timeOfDay,
    shot.prompt.setting.weather,
    shot.prompt.setting.productionDesign,
  ].filter(Boolean).join(', ');
}

function buildLightingFragment(shot: Shot, globalStyle: GlobalStyle): string {
  return [
    shot.prompt.lighting.style || globalStyle.defaultLighting,
    shot.prompt.lighting.colorTemperature,
    shot.prompt.lighting.sources,
  ].filter(Boolean).join(', ');
}

function buildStyleFragment(shot: Shot, globalStyle: GlobalStyle): string {
  return [
    shot.prompt.style.filmStock,
    shot.prompt.style.colorGrade,
    shot.prompt.style.era || globalStyle.era,
    shot.prompt.style.reference,
    globalStyle.filmStyle,
    globalStyle.colorPalette,
  ].filter(Boolean).join(', ');
}

function buildAudioFragment(shot: Shot): string {
  const audioParts: string[] = [];

  for (const line of shot.prompt.audio.dialogue) {
    const paren = line.parenthetical ? ` (${line.parenthetical})` : '';
    audioParts.push(`${line.characterName}${paren} says, "${line.text}"`);
  }

  if (shot.prompt.audio.sfx.length > 0) {
    audioParts.push(`SFX: ${shot.prompt.audio.sfx.join(', ')}`);
  }
  if (shot.prompt.audio.ambient) {
    audioParts.push(`Ambient noise: ${shot.prompt.audio.ambient}`);
  }
  if (shot.prompt.audio.music) {
    audioParts.push(`Music: ${shot.prompt.audio.music}`);
  }

  return audioParts.join('. ');
}

function rewriteVisibleAction(prompt: string): string {
  return prompt
    .replace(/\b(looks|seems|appears)\s+nervous\b/gi, VISUAL_ACTION_REPLACEMENT)
    .replace(/\blooks\s+anxious\b/gi, VISUAL_ACTION_REPLACEMENT)
    .replace(/\bseems\s+anxious\b/gi, VISUAL_ACTION_REPLACEMENT)
    .replace(/\bappears\s+anxious\b/gi, VISUAL_ACTION_REPLACEMENT);
}

function detectNegativePhrasing(lowerPrompt: string): PromptIssue[] {
  const negativePatterns = [
    'no camera movement',
    'without camera movement',
    'no movement',
    'without motion',
    'do not move camera',
    'dont move camera',
    'camera does not move',
  ];

  if (negativePatterns.some((pattern) => hasPhrase(lowerPrompt, pattern))) {
    return [{
      code: 'negative_motion_directive',
      severity: 'warning',
      message: 'Use positive motion directives; avoid "no/without" camera instructions in positive prompts.',
    }];
  }

  return [];
}

function detectSingleShotViolations(rawPrompt: string, lowerPrompt: string): PromptIssue[] {
  const issues: PromptIssue[] = [];
  const hasSceneIndex = /(?:scene|shot)\s*\d+/i.test(rawPrompt);
  const cutHits = countPhraseHits(lowerPrompt, ['cut to', 'smash cut', 'jump cut', 'hard cut', 'flash cut', 'then cut']);

  if (hasSceneIndex || cutHits > 1) {
    issues.push({
      code: 'multi_scene_single_shot',
      severity: 'warning',
      message: 'Prompt appears to describe multiple scenes/cuts; each generation should be one clear shot.',
    });
  }

  return issues;
}

function detectContradictions(lowerPrompt: string, platformKey: PlatformKey): PromptIssue[] {
  const issues: PromptIssue[] = [];
  const matches = (term: string): boolean => hasPhrase(lowerPrompt, term);

  const pairs = [
    {
      code: 'static_whip_pan',
      left: ['static', 'still', 'locked off', 'locked-off'],
      right: ['whip pan', 'swish pan', 'whip-pan'],
      message: 'Prompt combines a static camera with a whip/swish pan.',
    },
    {
      code: 'fisheye_telephoto',
      left: ['fisheye'],
      right: ['telephoto', 'long lens'],
      message: 'Prompt combines fisheye distortion with telephoto compression.',
    },
    {
      code: 'deep_focus_shallow_dof',
      left: ['deep focus', 'deep depth of field', 'everything in focus'],
      right: ['shallow depth of field', 'shallow dof', 'shallow focus', 'subject isolation'],
      message: 'Prompt combines deep focus with shallow depth of field.',
    },
    {
      code: 'high_key_low_key',
      left: ['high key', 'high-key'],
      right: ['low key', 'low-key'],
      message: 'Prompt combines high-key and low-key lighting.',
    },
    {
      code: 'day_night_conflict',
      left: ['day', 'daylight', 'midday', 'sunlit'],
      right: ['night', 'midnight', 'moonlit'],
      message: 'Prompt combines daytime and nighttime cues.',
    },
    {
      code: 'zoom_dolly_conflict',
      left: ['zoom in', 'zoom out'],
      right: ['dolly in', 'dolly out', 'push in', 'pull back'],
      message: 'Prompt mixes zoom and dolly cues; specify "dolly zoom" if intentional.',
    },
  ];

  for (const pair of pairs) {
    const hasLeft = pair.left.some(matches);
    const hasRight = pair.right.some(matches);
    const zollyException = pair.code === 'zoom_dolly_conflict' && (
      matches('dolly zoom') || matches('vertigo effect') || matches('zolly')
    );

    if (hasLeft && hasRight && !zollyException) {
      issues.push({
        code: pair.code,
        severity: 'warning',
        message: pair.message,
      });
    }
  }

  if (platformKey === 'hailuo') {
    const fastAction = countPhraseHits(lowerPrompt, FAST_ACTION_MARKERS);
    const fastCamera = countPhraseHits(lowerPrompt, FAST_CAMERA_MARKERS);
    if (fastAction > 0 && fastCamera > 0) {
      issues.push({
        code: 'hailuo_fast_subject_camera_conflict',
        severity: 'warning',
        message: 'Hailuo prompts perform better when fast subject motion is not combined with aggressive fast camera motion.',
      });
    }
  }

  return issues;
}

function detectMissingSixLayers(lowerPrompt: string, shot: Shot): PromptIssue[] {
  const issues: PromptIssue[] = [];

  const cameraLayer = hasPhrase(lowerPrompt, shot.prompt.camera.shotType)
    || hasPhrase(lowerPrompt, shot.prompt.camera.angle)
    || countPhraseHits(lowerPrompt, CAMERA_TAXONOMY_MARKERS) > 0;
  const subjectLayer = hasPhrase(lowerPrompt, shot.prompt.subject.description)
    || hasPhrase(lowerPrompt, shot.prompt.subject.action)
    || shot.prompt.subject.characters.some((c) => hasPhrase(lowerPrompt, c));
  const settingLayer = hasPhrase(lowerPrompt, shot.prompt.setting.location)
    || hasPhrase(lowerPrompt, shot.prompt.setting.timeOfDay)
    || hasPhrase(lowerPrompt, shot.prompt.setting.weather)
    || hasPhrase(lowerPrompt, shot.prompt.setting.productionDesign);
  const movementLayer = hasPhrase(lowerPrompt, shot.prompt.camera.movement)
    || countPhraseHits(lowerPrompt, CAMERA_TAXONOMY_MARKERS) > 0;
  const lightingLayer = hasPhrase(lowerPrompt, shot.prompt.lighting.style)
    || hasPhrase(lowerPrompt, shot.prompt.lighting.colorTemperature)
    || hasPhrase(lowerPrompt, shot.prompt.lighting.sources)
    || countPhraseHits(lowerPrompt, LIGHTING_SPEC_MARKERS) > 0;
  const technicalLayer = hasPhrase(lowerPrompt, shot.prompt.camera.lens)
    || hasPhrase(lowerPrompt, shot.prompt.style.filmStock)
    || hasPhrase(lowerPrompt, shot.prompt.style.colorGrade)
    || hasPhrase(lowerPrompt, shot.prompt.style.reference)
    || countPhraseHits(lowerPrompt, LENS_DOF_MARKERS) > 0;

  if (!cameraLayer) {
    issues.push({
      code: 'missing_layer_camera_framing',
      severity: 'warning',
      message: 'Missing six-layer component: shot type/framing.',
    });
  }
  if (!subjectLayer) {
    issues.push({
      code: 'missing_layer_subject_action',
      severity: 'warning',
      message: 'Missing six-layer component: subject/action.',
    });
  }
  if (!settingLayer) {
    issues.push({
      code: 'missing_layer_setting_environment',
      severity: 'warning',
      message: 'Missing six-layer component: setting/environment.',
    });
  }
  if (!movementLayer) {
    issues.push({
      code: 'missing_layer_camera_movement',
      severity: 'warning',
      message: 'Missing six-layer component: camera movement.',
    });
  }
  if (!lightingLayer) {
    issues.push({
      code: 'missing_layer_lighting_atmosphere',
      severity: 'warning',
      message: 'Missing six-layer component: lighting/atmosphere.',
    });
  }
  if (!technicalLayer) {
    issues.push({
      code: 'missing_layer_technical_specs',
      severity: 'warning',
      message: 'Missing six-layer component: technical specs (lens/film/style).',
    });
  }

  return issues;
}

function detectVagueLighting(lowerPrompt: string): PromptIssue[] {
  const hasVagueLighting = hasPhrase(lowerPrompt, 'cinematic lighting')
    || hasPhrase(lowerPrompt, 'dramatic lighting');
  const hasSpecificLighting = countPhraseHits(lowerPrompt, LIGHTING_SPEC_MARKERS) > 0
    || /(?:\d{4}k|\bkey light\b|\bfill\b|\brim light\b)/i.test(lowerPrompt);

  if (hasVagueLighting && !hasSpecificLighting) {
    return [{
      code: 'vague_lighting_only',
      severity: 'warning',
      message: 'Lighting is vague. Specify direction, quality, temperature, and motivated light source.',
    }];
  }

  return [];
}

function dedupeIssues(issues: PromptIssue[]): PromptIssue[] {
  const seen = new Set<string>();
  const output: PromptIssue[] = [];

  for (const issue of issues) {
    if (seen.has(issue.code)) continue;
    seen.add(issue.code);
    output.push(issue);
  }

  return output;
}

function assessCoverage(lowerPrompt: string, shot: Shot): number {
  const layers = [
    {
      weight: 16,
      matched: hasPhrase(lowerPrompt, shot.prompt.camera.shotType)
        || hasPhrase(lowerPrompt, shot.prompt.camera.angle)
        || countPhraseHits(lowerPrompt, ['close up', 'wide shot', 'establishing shot', 'over the shoulder', 'pov']) > 0,
    },
    {
      weight: 16,
      matched: hasPhrase(lowerPrompt, shot.prompt.subject.description)
        || hasPhrase(lowerPrompt, shot.prompt.subject.action)
        || shot.prompt.subject.characters.some((c) => hasPhrase(lowerPrompt, c)),
    },
    {
      weight: 16,
      matched: hasPhrase(lowerPrompt, shot.prompt.setting.location)
        || hasPhrase(lowerPrompt, shot.prompt.setting.timeOfDay)
        || hasPhrase(lowerPrompt, shot.prompt.setting.weather)
        || hasPhrase(lowerPrompt, shot.prompt.setting.productionDesign),
    },
    {
      weight: 16,
      matched: hasPhrase(lowerPrompt, shot.prompt.camera.movement)
        || countPhraseHits(lowerPrompt, CAMERA_TAXONOMY_MARKERS) > 0,
    },
    {
      weight: 16,
      matched: hasPhrase(lowerPrompt, shot.prompt.lighting.style)
        || hasPhrase(lowerPrompt, shot.prompt.lighting.colorTemperature)
        || hasPhrase(lowerPrompt, shot.prompt.lighting.sources)
        || countPhraseHits(lowerPrompt, LIGHTING_SPEC_MARKERS) > 0,
    },
    {
      weight: 16,
      matched: hasPhrase(lowerPrompt, shot.prompt.camera.lens)
        || hasPhrase(lowerPrompt, shot.prompt.style.filmStock)
        || hasPhrase(lowerPrompt, shot.prompt.style.colorGrade)
        || hasPhrase(lowerPrompt, shot.prompt.style.reference)
        || countPhraseHits(lowerPrompt, LENS_DOF_MARKERS) > 0,
    },
  ];

  const baseScore = layers.reduce((sum, layer) => sum + (layer.matched ? layer.weight : 0), 0);
  const audioBonus = countPhraseHits(lowerPrompt, AUDIO_MARKERS) > 0 ? 4 : 0;
  const psychBonus = shot.psychology.transportationCues.some((cue) => hasPhrase(lowerPrompt, cue)) ? 4 : 0;

  return clamp(baseScore + audioBonus + psychBonus);
}

function assessSpecificity(lowerPrompt: string): number {
  const concreteMarkers = [
    ...CAMERA_TAXONOMY_MARKERS,
    ...LENS_DOF_MARKERS,
    ...LIGHTING_SPEC_MARKERS,
    ...COMPOSITION_MARKERS,
    'kodak',
    'cinestill',
    'arri alexa',
    'super 8',
    'teal and orange',
    'desaturated',
    'pastel',
    'cyberpunk',
  ];

  const concreteHits = countPhraseHits(lowerPrompt, concreteMarkers);
  const vagueHits = countPhraseHits(lowerPrompt, VAGUE_TERMS);
  const wordCount = countWords(lowerPrompt);

  const lengthScore = wordCount < 20
    ? 30
    : wordCount <= 70
      ? 65
      : wordCount <= 210
        ? 88
        : wordCount <= 280
          ? 75
          : 58;

  const detailScore = concreteHits * 4.8;
  const vaguePenalty = vagueHits * 8;

  return clamp(lengthScore + detailScore - vaguePenalty);
}

function assessConsistency(issues: PromptIssue[], lowerPrompt: string): number {
  const weightedPenalty = issues.reduce((sum, issue) => (
    sum + (issue.severity === 'error' ? 22 : issue.severity === 'warning' ? 12 : 4)
  ), 0);
  const uncertaintyPenalty = hasPhrase(lowerPrompt, 'maybe')
    || hasPhrase(lowerPrompt, 'kind of')
    || hasPhrase(lowerPrompt, 'sort of')
    ? 6
    : 0;
  return clamp(100 - weightedPenalty - uncertaintyPenalty);
}

function assessPlatformFit(lowerPrompt: string, platform: string): number {
  const platformKey = normalizePlatform(platform);
  const wordCount = countWords(lowerPrompt);
  const charCount = lowerPrompt.length;
  const cameraHits = countPhraseHits(lowerPrompt, CAMERA_TAXONOMY_MARKERS);
  const lensHits = countPhraseHits(lowerPrompt, LENS_DOF_MARKERS);
  const lightingHits = countPhraseHits(lowerPrompt, LIGHTING_SPEC_MARKERS);
  const audioHits = countPhraseHits(lowerPrompt, AUDIO_MARKERS);
  const connectorHits = countPhraseHits(lowerPrompt, ['while', 'as', 'then', 'after', 'meanwhile', 'gradually']);

  switch (platformKey) {
    case 'veo3': {
      const lengthScore = scoreLengthFit(wordCount, 120, 180);
      const markerScore = clamp(42 + audioHits * 11 + cameraHits * 8 + lensHits * 7 + lightingHits * 6);
      return clamp(lengthScore * 0.58 + markerScore * 0.42);
    }
    case 'sora2': {
      const lengthScore = scoreLengthFit(wordCount, 55, 170);
      const sectionHits = countPhraseHits(lowerPrompt, ['cinematography', 'actions', 'dialogue', 'background sound']);
      const dialogueBlockHit = hasPhrase(lowerPrompt, 'dialogue:') ? 1 : 0;
      const markerScore = clamp(40 + sectionHits * 14 + dialogueBlockHit * 14 + connectorHits * 5 + cameraHits * 4);
      return clamp(lengthScore * 0.55 + markerScore * 0.45);
    }
    case 'kling3': {
      const lengthScore = scoreLengthFit(wordCount, 50, 90);
      const motionHits = countPhraseHits(lowerPrompt, [
        'movement',
        'motion',
        'tracking',
        'dolly',
        'handheld',
        'pan',
        'tilt',
        'push in',
        'pull back',
        'whip pan',
        'rack focus',
        'orbit',
      ]);
      const endpointHits = countPhraseHits(lowerPrompt, [
        'then settles',
        'settles back into place',
        'comes to rest',
        'holds at end',
        'lands and steadies',
      ]);
      const emphasisHits = /\+\+[^+]+\+\+/.test(lowerPrompt) ? 1 : 0;
      const speakerTagHits = /\[speaker:\s*[^\]]+\]/i.test(lowerPrompt) ? 1 : 0;
      const markerScore = clamp(35 + motionHits * 9 + endpointHits * 10 + emphasisHits * 10 + speakerTagHits * 8 + lensHits * 5);
      return clamp(lengthScore * 0.56 + markerScore * 0.44);
    }
    case 'seedance2': {
      const lengthScore = scoreLengthFit(wordCount, 40, 120);
      const labelHits = countPhraseHits(lowerPrompt, ['cinematography', 'actions', 'background sound']);
      const compactBonus = wordCount <= 120 ? 14 : 0;
      const markerScore = clamp(42 + audioHits * 13 + compactBonus - labelHits * 7);
      return clamp(lengthScore * 0.56 + markerScore * 0.44);
    }
    case 'runwayGen4': {
      const lengthScore = scoreLengthFit(wordCount, 10, 70);
      const actionHits = countPhraseHits(lowerPrompt, [
        'action',
        'movement',
        'motion',
        'glide',
        'drift',
        'rush',
        'burst',
        'steps',
        'runs',
        'reaches',
        'turns',
        'glances',
      ]);
      const complexityPenalty = countPhraseHits(lowerPrompt, ['cinematography', 'dialogue', 'background sound', 'audio']) * 12;
      const markerScore = clamp(58 + actionHits * 9 - complexityPenalty + (wordCount <= 50 ? 10 : 0));
      return clamp(lengthScore * 0.62 + markerScore * 0.38);
    }
    case 'hailuo': {
      const lengthScore = scoreLengthFit(wordCount, 35, 260);
      const expressionHits = countPhraseHits(lowerPrompt, [
        'expression',
        'emotion',
        'stares',
        'hesitates',
        'breathes',
        'eyes',
        'face',
        'acting',
      ]);
      const fastAction = countPhraseHits(lowerPrompt, FAST_ACTION_MARKERS);
      const fastCamera = countPhraseHits(lowerPrompt, FAST_CAMERA_MARKERS);
      const conflictPenalty = fastAction > 0 && fastCamera > 0 ? 22 : 0;
      const charBudgetPenalty = charCount > 2000 ? (charCount - 2000) * 0.08 : 0;
      const markerScore = clamp(45 + expressionHits * 9 + cameraHits * 5 + lensHits * 4 - conflictPenalty - charBudgetPenalty);
      return clamp(lengthScore * 0.55 + markerScore * 0.45);
    }
    case 'wan': {
      const lengthScore = scoreLengthFit(wordCount, 20, 120);
      const timingBracket = /\[\s*\d+\s*-\s*\d+s\s*\]/i.test(lowerPrompt) ? 1 : 0;
      const charBudgetScore = clamp(100 - Math.max(0, charCount - 800) * 0.35);
      const markerScore = clamp(40 + timingBracket * 28 + cameraHits * 7 + connectorHits * 4);
      return clamp(lengthScore * 0.35 + charBudgetScore * 0.35 + markerScore * 0.30);
    }
    case 'ltx': {
      const lengthScore = scoreLengthFit(wordCount, 70, 260);
      const narrativeHits = countPhraseHits(lowerPrompt, ['the camera', 'opens with', 'as this happens', 'then', 'meanwhile', 'after']);
      const markerScore = clamp(34 + narrativeHits * 10 + connectorHits * 6 + cameraHits * 5 + lightingHits * 4);
      return clamp(lengthScore * 0.58 + markerScore * 0.42);
    }
    case 'grok': {
      const lengthScore = scoreLengthFit(wordCount, 18, 85);
      const labelPenalty = countPhraseHits(lowerPrompt, ['cinematography', 'actions', 'dialogue', 'background sound']) * 12;
      const markerScore = clamp(62 + cameraHits * 5 - labelPenalty);
      return clamp(lengthScore * 0.62 + markerScore * 0.38);
    }
    default: {
      const lengthScore = scoreLengthFit(wordCount, 45, 170);
      const sceneHits = countPhraseHits(lowerPrompt, ['camera', 'action', 'setting', 'lighting', 'sound', 'style']);
      const markerScore = clamp(55 + sceneHits * 8);
      return clamp(lengthScore * 0.74 + markerScore * 0.26);
    }
  }
}

function assessTemporalCoherence(lowerPrompt: string, durationSeconds: number, issues: PromptIssue[]): number {
  const progressionHits = countPhraseHits(lowerPrompt, [
    'then',
    'while',
    'as',
    'gradually',
    'slowly',
    'continuously',
    'unbroken',
    'seamlessly',
    'lingers',
    'holds',
  ]);
  const continuityHits = countPhraseHits(lowerPrompt, [
    'single take',
    'one continuous shot',
    'continuous shot',
    'without cutting',
    'no cut',
  ]);
  const discontinuityHits = countPhraseHits(lowerPrompt, [
    'cut to',
    'smash cut',
    'jump cut',
    'hard cut',
    'flash cut',
  ]);
  const contradictionPenalty = issues.length * 4;

  const paceCue = durationSeconds <= 4
    ? (countPhraseHits(lowerPrompt, ['quickly', 'briefly', 'snap', 'instant', 'beat', 'glimpse']) * 6)
      - (countPhraseHits(lowerPrompt, ['slowly', 'linger', 'lingers', 'long take']) * 4)
    : durationSeconds >= 9
      ? (countPhraseHits(lowerPrompt, ['slowly', 'linger', 'lingers', 'long take', 'unbroken']) * 6)
        - (countPhraseHits(lowerPrompt, ['quickly', 'snap', 'beat']) * 4)
      : progressionHits * 6;

  const timestampBonus = /\[\s*\d+\s*-\s*\d+s\s*\]/i.test(lowerPrompt) ? 6 : 0;

  return clamp(60 + progressionHits * 7 + continuityHits * 10 + paceCue + timestampBonus - discontinuityHits * 18 - contradictionPenalty);
}

function appendKlingMotionEndpoint(action: string): string {
  const trimmed = stripTerminalPunctuation(action);
  if (!trimmed) return 'The subject shifts and then settles back into place';

  const hasEndpoint = /(settles|comes to rest|holds at end|lands and steadies|stops)/i.test(trimmed);
  return hasEndpoint ? trimmed : `${trimmed}, then settles back into place`;
}

function buildPlatformPrompt(
  platformKey: PlatformKey,
  prompt: string,
  shot: Shot,
  globalStyle: GlobalStyle
): string {
  const basePrompt = stripTerminalPunctuation(rewriteVisibleAction(normalizeLookup(prompt) ? prompt.trim() : shot.prompt.subject.action));
  const camera = buildCameraFragment(shot, globalStyle);
  const subject = buildSubjectFragment(shot);
  const setting = buildSettingFragment(shot);
  const lighting = buildLightingFragment(shot, globalStyle);
  const style = buildStyleFragment(shot, globalStyle);
  const audio = buildAudioFragment(shot);
  const action = stripTerminalPunctuation(shot.prompt.subject.action || basePrompt);
  const motion = stripTerminalPunctuation([
    shot.prompt.subject.action,
    shot.prompt.camera.movement,
  ].filter(Boolean).join(', '));

  switch (platformKey) {
    case 'sora2': {
      const prose = joinSentences([basePrompt, subject, setting, lighting, style]);
      const sections = [
        prose,
        `Cinematography:\n${joinSentences([camera])}`,
        `Actions:\n- ${action}`,
      ];

      if (shot.prompt.audio.dialogue.length > 0) {
        const dialogueLines = shot.prompt.audio.dialogue.map((line) => {
          const paren = line.parenthetical ? ` (${line.parenthetical})` : '';
          return `${line.characterName}${paren}: "${line.text}"`;
        });
        sections.push(`Dialogue:\n${dialogueLines.join('\n')}`);
      }

      if (audio) {
        sections.push(`Background Sound:\n${audio}`);
      }

      return sections.filter(Boolean).join('\n\n');
    }
    case 'veo3':
      return joinSentences([basePrompt, camera, subject, setting, lighting, style, audio]);
    case 'kling3': {
      const dialogueBlock = shot.prompt.audio.dialogue
        .map((line) => `[Speaker: ${line.characterName}] "${line.text}"`)
        .join(' ');
      const emphasizedSubject = subject ? `++${stripTerminalPunctuation(subject)}++` : '';
      const klingText = joinSentences([
        emphasizedSubject,
        setting,
        lighting,
        camera,
        style,
        appendKlingMotionEndpoint(action),
        dialogueBlock,
      ]);
      return truncateWords(klingText, 90);
    }
    case 'seedance2':
      return joinSentences([basePrompt, motion, audio, setting]);
    case 'runwayGen4': {
      const concise = joinSentences([basePrompt, motion, camera, setting]);
      return truncateWords(concise, 70);
    }
    case 'hailuo':
      return truncateChars(joinSentences([camera, subject, action, setting, lighting, style]), 2000);
    case 'wan': {
      const bracket = `[0-${Math.max(1, Math.round(shot.durationSeconds || 5))}s]`;
      return truncateChars(joinSentences([bracket, camera, subject, action, setting, lighting, style]), 800);
    }
    case 'ltx': {
      const narrative = joinSentences([
        `The camera opens with ${stripTerminalPunctuation(camera).toLowerCase()}`,
        subject,
        action,
        setting ? `in ${setting}` : '',
        `As this happens, ${stripTerminalPunctuation(shot.prompt.camera.movement || 'the frame holds steady').toLowerCase()}`,
        lighting,
        style,
      ]);
      return basePrompt.length > 180 ? basePrompt : narrative;
    }
    case 'grok':
      return truncateWords(joinSentences([camera, subject, action, setting]), 85);
    case 'unknown':
      return joinSentences([basePrompt]);
    default:
      return joinSentences([basePrompt, subject, motion, setting]);
  }
}

export function optimizePromptForPlatform(params: {
  platform: string;
  prompt: string;
  shot: Shot;
  globalStyle: GlobalStyle;
}): string {
  const platformKey = normalizePlatform(params.platform);
  if (platformKey === 'unknown') {
    return joinSentences([rewriteVisibleAction(params.prompt.trim())]);
  }
  return buildPlatformPrompt(platformKey, params.prompt, params.shot, params.globalStyle);
}

export function analyzePromptForPlatform(shot: Shot, platform: string, prompt: string): PromptQualityReport {
  const normalizedPrompt = normalizeLookup(prompt);
  const platformKey = normalizePlatform(platform);
  const issues = dedupeIssues([
    ...detectMissingSixLayers(normalizedPrompt, shot),
    ...detectNegativePhrasing(normalizedPrompt),
    ...detectSingleShotViolations(prompt, normalizedPrompt),
    ...detectVagueLighting(normalizedPrompt),
    ...detectContradictions(normalizedPrompt, platformKey),
  ]);

  const breakdown: PromptQualityBreakdown = {
    coverage: assessCoverage(normalizedPrompt, shot),
    specificity: assessSpecificity(normalizedPrompt),
    consistency: assessConsistency(issues, normalizedPrompt),
    platformFit: assessPlatformFit(normalizedPrompt, platform),
    temporalCoherence: assessTemporalCoherence(normalizedPrompt, shot.durationSeconds, issues),
  };

  const rawScore = (
    0.30 * breakdown.coverage +
    0.25 * breakdown.specificity +
    0.20 * breakdown.consistency +
    0.15 * breakdown.platformFit +
    0.10 * breakdown.temporalCoherence
  );

  return {
    score: Math.round(rawScore * 10) / 10,
    breakdown,
    issues,
    formula: SCORE_FORMULA,
  };
}
