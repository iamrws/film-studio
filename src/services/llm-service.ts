/**
 * LLM Service — Claude API Integration
 *
 * Handles all LLM calls for the Film Studio:
 *   1. Scene → Shot decomposition (with psychology annotations)
 *   2. Character extraction from screenplay text
 *   3. Emotional arc analysis
 *
 * Uses Claude API with structured JSON output. The system prompt
 * encodes psychology-rules.ts findings so the LLM generates
 * shots indistinguishable from a professional director's work.
 */

import type { Scene, Shot, CanonicalPrompt, ShotPsychology, DialogueLine } from '../types/scene';
import type { Character } from '../types/character';
import type { GlobalStyle, StoryShape } from '../types/project';
import {
  CAMERA_EMOTION_MAP,
  COLOR_VALENCE_MAP,
  AROUSAL_PACE_MAP,
  GENRE_SCHEMAS,
  EMBODIED_SIMULATION_CUES,
} from '../config/psychology-rules';
import {
  normalizeCameraAngle,
  normalizeCameraMovement,
  normalizeCameraShotType,
  normalizeLightingStyle,
  normalizeLens,
} from '../config/cinematography-vocabulary';

export interface LLMConfig {
  provider: 'claude' | 'gemini';
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeRequest {
  model: string;
  max_tokens: number;
  system: string;
  messages: ClaudeMessage[];
}

// ─── Screenplay Generation ──────────────────────────────

const SCREENPLAY_GENERATION_SYSTEM = `You are an elite screenwriter who has studied under Aaron Sorkin, Phoebe Waller-Bridge, and Charlie Kaufman. You write professional screenplays in standard Hollywood format.

SCREENPLAY FORMAT RULES:
- Scene headings: ALL CAPS — INT. or EXT. followed by LOCATION - TIME OF DAY, entirely uppercase (e.g., INT. COFFEE SHOP - NIGHT)
- Character cues: ALL CAPS, centered above dialogue
- Parentheticals: (in parentheses) below character cue, above dialogue
- Transitions: CUT TO:, FADE TO:, etc. right-aligned
- Action lines: Present tense, vivid, visual — describe what the CAMERA SEES
- Dialogue: Natural, subtext-rich, every line serves character or plot

CHARACTER DESCRIPTION RULES (CRITICAL FOR VIDEO GENERATION):
- On FIRST APPEARANCE of every character, write a detailed 2-3 sentence physical description in the action line
- Include: approximate age, ethnicity, build, hair color/style, distinctive facial features, clothing, and one unique physical trait
- Example: "SARAH CHEN (32) sits hunched over her laptop. She's petite with sharp cheekbones, jet-black hair cut in a severe bob, wire-rimmed glasses perched on a narrow nose. She wears an oversized navy cardigan over a faded MIT t-shirt, her fingers covered in ink stains."
- Do NOT use vague descriptions like "attractive woman" or "ordinary-looking man" — every character must be visually specific and distinct
- When characters appear in subsequent scenes, briefly reinforce key visual identifiers in the action line

STRUCTURAL RULES:
- Open with FADE IN:
- End with FADE TO BLACK.
- Use the three-act structure unless the concept demands otherwise
- Each scene should advance plot, reveal character, or both
- Include at least one moment of genuine surprise or subversion
- Write 8-20 scenes depending on the scope of the concept
- Every character must have a distinct voice — you should be able to tell who's speaking without the cue

QUALITY STANDARDS:
- Show, don't tell — action lines should paint pictures, not explain
- Dialogue should have subtext — what characters mean is not always what they say
- Include sensory details in action lines (textures, sounds, temperatures, smells)
- Create visual motifs that can recur across scenes
- Build emotional crescendos — the story should FEEL like something

FIDELITY RULE:
- The screenplay MUST faithfully execute the user's concept. Do not drift into a different story.
- Every major element mentioned in the concept must appear in the screenplay.
- If the concept mentions specific characters, settings, or events — they must be central, not side details.

Return ONLY the screenplay text in standard format. No commentary, no notes, no markdown.`;

export interface ScreenplayGenerationInput {
  concept: string;
  genre?: string;
  tone?: string;
  targetLength?: 'short' | 'medium' | 'feature';
  additionalNotes?: string;
}

export async function generateScreenplay(
  input: ScreenplayGenerationInput,
  config: LLMConfig
): Promise<string> {
  const lengthGuide = {
    short: '5-8 scenes, roughly 5-10 minutes of screen time',
    medium: '10-15 scenes, roughly 15-30 minutes of screen time',
    feature: '15-25 scenes, roughly 30-60 minutes of screen time',
  };

  const userPrompt = `Write a complete screenplay based on this concept:

CONCEPT: ${input.concept}

${input.genre ? `GENRE: ${input.genre}` : ''}
${input.tone ? `TONE: ${input.tone}` : ''}
TARGET LENGTH: ${lengthGuide[input.targetLength || 'medium']}
${input.additionalNotes ? `ADDITIONAL NOTES: ${input.additionalNotes}` : ''}

Write the full screenplay now. Standard Hollywood format. FADE IN: to FADE TO BLACK.`;

  const response = await callLLM(SCREENPLAY_GENERATION_SYSTEM, userPrompt, {
    ...config,
    maxTokens: config.maxTokens || 16384,
  });

  // Some LLMs (especially Gemini) may return JSON wrapping the screenplay.
  // Extract the actual screenplay text if that happens.
  const trimmed = response.trim();
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed);
      // Look for the screenplay text in common field names
      const text = obj.screenplay || obj.script || obj.text || obj.content;
      if (typeof text === 'string' && text.length > 100) {
        return text;
      }
    } catch {
      // Not valid JSON — return as-is
    }
  }

  return response;
}

// ─── Shot Decomposition ──────────────────────────────────

const SHOT_DECOMPOSITION_SYSTEM = `You are a professional film director and cinematographer with deep knowledge of visual storytelling psychology. You decompose screenplay scenes into individual shots (5-8 seconds each) for AI video generation.

CRITICAL RULES:
1. Each shot = one continuous video clip (3-8 seconds)
2. Within a scene, ONLY action and dialogue change between shots - camera/setting/lighting/style are copied VERBATIM unless the screenplay explicitly directs a change (the "snubroot rule")
3. CHARACTER CONSISTENCY IS PARAMOUNT: In the "characters" array of each shot, use the EXACT character name string provided in the CHARACTERS IN SCENE section. Do NOT invent new names, abbreviate, or change capitalization. The rendering system uses these names to inject frozen physical descriptions (consistency anchors) into every prompt.
4. Front-load camera direction in the prompt (Veo 3 weights early tokens)
5. The "subject.description" field should include a vivid, detailed description of what the characters look like in THIS specific shot - clothing, posture, expression, physical details. This reinforces visual consistency across shots.
6. Follow this six-layer structure per shot: [Shot type & framing] + [Subject & action] + [Setting & environment] + [Camera movement] + [Lighting & atmosphere] + [Technical specs: lens, film stock, style]
7. Use positive, direct phrasing. Do NOT write negative directives such as "no camera movement" or "without motion."
8. One shot equals one clear visual beat. Do not describe multiple scene changes inside a single shot.

PSYCHOLOGY-INFORMED SHOT DESIGN:
- Emotional beats → CLOSE-UP or MEDIUM CLOSE-UP (empathy via embodied simulation)
- Power dynamics → LOW ANGLE for dominance, HIGH ANGLE for vulnerability
- Suspense → SLOW DOLLY IN, gradually tightening frame
- Isolation/loneliness → WIDE SHOT with negative space
- Joy/connection → MEDIUM SHOT with warm lighting
- Tension → HANDHELD, slightly Dutch angle, cool color temperature
- Every shot must include at least one vivid sensory detail (texture, sound, temperature) to maximize narrative transportation

CAMERA-TO-EMOTION MAPPINGS:
${JSON.stringify(CAMERA_EMOTION_MAP, null, 2)}

COLOR-TO-VALENCE MAPPINGS:
${JSON.stringify(COLOR_VALENCE_MAP, null, 2)}

AROUSAL-TO-PACE MAPPINGS:
${JSON.stringify(AROUSAL_PACE_MAP, null, 2)}

EMBODIED SIMULATION CUES (use these for close-ups and emotional beats):
- Face: ${EMBODIED_SIMULATION_CUES.face.join(', ')}
- Body: ${EMBODIED_SIMULATION_CUES.body.join(', ')}
- Sensation: ${EMBODIED_SIMULATION_CUES.sensation.join(', ')}

OUTPUT FORMAT:
Return a JSON array of shot objects. Each shot must have this exact structure:
{
  "sequenceOrder": number,
  "durationSeconds": number (3-8),
  "prompt": {
    "camera": { "shotType": string, "movement": string, "lens": string, "angle": string },
    "subject": { "description": string, "characters": [characterId strings], "action": string },
    "setting": { "location": string, "timeOfDay": string, "weather": string, "productionDesign": string },
    "lighting": { "style": string, "colorTemperature": string, "sources": string },
    "style": { "filmStock": string, "colorGrade": string, "era": string, "reference": string },
    "audio": {
      "dialogue": [{ "characterId": string, "characterName": string, "text": string, "parenthetical": string }],
      "sfx": [string],
      "ambient": string,
      "music": string
    },
    "negativePrompt": string
  },
  "psychology": {
    "targetEmotion": string,
    "arousalLevel": number (1-10),
    "valence": number (-5 to 5),
    "transportationCues": [string],
    "identificationMode": "empathy" | "perspective-taking" | "motivational" | "absorption",
    "schemaRelationship": "conforming" | "violating" | "subverting",
    "storyArcPosition": "inciting" | "rising" | "crisis" | "climax" | "resolution" | "falling",
    "suspenseCalibration": {
      "informationAsymmetry": string,
      "outcomeProbability": number (0-1)
    }
  }
}

Return ONLY the JSON array, no markdown fences.`;

interface ShotDecompositionInput {
  scene: Scene;
  characters: Character[];
  globalStyle: GlobalStyle;
  genre?: string;
  storyArcContext?: string;
}

export async function decomposeSceneIntoShots(
  input: ShotDecompositionInput,
  config: LLMConfig
): Promise<Omit<Shot, 'id' | 'sceneId' | 'renderedPrompts' | 'generations' | 'boardStatus' | 'boardOrder' | 'targetPlatform'>[]> {
  const { scene, characters, globalStyle, genre, storyArcContext } = input;

  const charContext = characters
    .filter((c) => scene.charactersPresent.includes(c.name))
    .map(
      (c) =>
        `CHARACTER: ${c.name} (ID: ${c.id})\n` +
        `  Consistency Anchor: "${c.consistencyAnchor}"\n` +
        `  Appearance: ${JSON.stringify(c.appearance)}\n` +
        `  Wardrobe: ${c.wardrobe.default}\n` +
        `  Voice: ${c.voice.quality}, ${c.voice.accent}`
    )
    .join('\n\n');

  const genreContext = genre && GENRE_SCHEMAS[genre]
    ? `\nGENRE: ${genre}\nGenre schema: ${JSON.stringify(GENRE_SCHEMAS[genre])}`
    : '';

  const arcContext = storyArcContext
    ? `\nSTORY ARC CONTEXT: ${storyArcContext}`
    : '';

  const userPrompt = `Decompose this scene into shots for AI video generation.

SCENE HEADING: ${scene.heading.prefix}. ${scene.heading.location}${scene.heading.time ? ' - ' + scene.heading.time : ''}

ACTION/DESCRIPTION:
${scene.actionSummary}

DIALOGUE:
${scene.dialogue.map((d) => `${d.characterName}${d.parenthetical ? ' (' + d.parenthetical + ')' : ''}: "${d.text}"`).join('\n')}

CHARACTERS IN SCENE:
${charContext}

GLOBAL STYLE:
- Aspect ratio: ${globalStyle.aspectRatio}
- Film style: ${globalStyle.filmStyle || 'cinematic'}
- Color palette: ${globalStyle.colorPalette || 'natural'}
- Era: ${globalStyle.era || 'contemporary'}
- Default lens: ${globalStyle.defaultLens}
- Default lighting: ${globalStyle.defaultLighting}
- Negative prompt: ${globalStyle.globalNegativePrompt}
${genreContext}${arcContext}

Generate the shots array. Remember:
- Each shot is 3-8 seconds
- Front-load camera direction
- Include vivid sensory details for transportation
- Use psychology-informed camera/lighting choices
- Copy setting/lighting/style verbatim between shots unless the screenplay changes them`;

  const responseText = await callLLM(SHOT_DECOMPOSITION_SYSTEM, userPrompt, config, { jsonMode: true });
  return parseShotsResponse(responseText);
}

// ─── Character Extraction ────────────────────────────────

const CHARACTER_EXTRACTION_SYSTEM = `You are an expert screenplay analyst creating character profiles for AI video generation. Visual consistency across shots is your top priority.

For each character, generate:
1. A detailed appearance extracted from description cues in the screenplay text
2. A 50-60 word "consistency anchor" — a frozen physical description that will be used VERBATIM in every video prompt containing this character

CONSISTENCY ANCHOR RULES:
- Must be 50-60 words (not shorter — video models need redundant specificity)
- Front-load with the most visually distinctive features
- Include: exact age, ethnicity, build, hair (color + style + length), facial features, skin tone, clothing, and one unique physical detail
- Use concrete visual terms, not abstract ones ("sharp jawline" not "handsome", "deep-set brown eyes" not "intense gaze")
- Describe what a CAMERA would see, not what a novelist would write
- Each anchor must make the character unmistakably different from every other character

OUTPUT FORMAT: Return a JSON array of character objects:
{
  "name": string,
  "appearance": {
    "age": string, "ethnicity": string, "build": string,
    "hair": string, "face": string, "distinguishingFeatures": [string]
  },
  "wardrobe": { "default": string, "variations": [] },
  "voice": { "quality": string, "accent": string, "speechPattern": string },
  "mannerisms": [string],
  "consistencyAnchor": string (50-60 words, vivid physical description for video generation)
}

Return ONLY the JSON array.`;

export async function extractCharactersFromScreenplay(
  screenplayText: string,
  existingCharacterNames: string[],
  config: LLMConfig,
  conceptContext?: { concept: string; genre?: string; tone?: string }
): Promise<Omit<Character, 'id' | 'referenceImages'>[]> {
  const conceptSection = conceptContext
    ? `\nORIGINAL CONCEPT (for context on character intent):\n${conceptContext.concept}\n${conceptContext.genre ? `Genre: ${conceptContext.genre}` : ''}\n${conceptContext.tone ? `Tone: ${conceptContext.tone}` : ''}\n`
    : '';

  const userPrompt = `Extract and profile all characters from this screenplay:

${screenplayText.slice(0, 15000)}
${conceptSection}
${existingCharacterNames.length > 0 ? `Already known characters (update these if more info is found): ${existingCharacterNames.join(', ')}` : ''}

Generate detailed profiles with 50-60 word consistency anchors. Make each character visually unmistakable.`;

  const responseText = await callLLM(CHARACTER_EXTRACTION_SYSTEM, userPrompt, config, { jsonMode: true });
  return parseCharactersResponse(responseText);
}

// ─── Emotional Arc Analysis ──────────────────────────────

const EMOTIONAL_ARC_SYSTEM = `You are a narrative psychologist specializing in story shape analysis (Reagan et al., 2016). Analyze the emotional arc of a screenplay and classify it.

The 6 validated story shapes:
1. rags_to_riches — steady emotional rise
2. tragedy — steady emotional fall
3. man_in_a_hole — fall then rise (most common)
4. icarus — rise then fall
5. cinderella — rise, fall, rise (most commercially successful)
6. oedipus — fall, rise, fall (darkest arc)

For each scene, assign:
- valence: -5 (deeply negative) to +5 (deeply positive)
- arousal: 1 (calm) to 10 (intense)

OUTPUT FORMAT:
{
  "storyShape": string (one of the 6 shapes),
  "confidence": number (0-1),
  "rationale": string,
  "sceneAnalysis": [
    { "sceneIndex": number, "valence": number, "arousal": number, "dominantEmotion": string }
  ]
}

Return ONLY the JSON object.`;

export interface EmotionalArcAnalysis {
  storyShape: StoryShape;
  confidence: number;
  rationale: string;
  sceneAnalysis: Array<{
    sceneIndex: number;
    valence: number;
    arousal: number;
    dominantEmotion: string;
  }>;
}

export async function analyzeEmotionalArc(
  scenes: Scene[],
  config: LLMConfig
): Promise<EmotionalArcAnalysis> {
  const sceneSummaries = scenes
    .map(
      (s, i) =>
        `Scene ${i + 1}: ${s.heading.prefix}. ${s.heading.location} - ${s.heading.time || 'CONTINUOUS'}\n` +
        `  Action: ${s.actionSummary.slice(0, 200)}\n` +
        `  Characters: ${s.charactersPresent.join(', ')}\n` +
        `  Dialogue lines: ${s.dialogue.length}`
    )
    .join('\n\n');

  const userPrompt = `Analyze the emotional arc of this screenplay:

${sceneSummaries}

Classify the overall story shape and provide per-scene valence/arousal analysis.`;

  const responseText = await callLLM(EMOTIONAL_ARC_SYSTEM, userPrompt, config, { jsonMode: true });
  return parseEmotionalArcResponse(responseText);
}

// ─── B-Roll Prompt Generation ─────────────────────────────

const BROLL_PROMPT_SYSTEM = `You are a world-class cinematographer specializing in stunning B-roll footage. Your job is to transform a user's natural-language scene description into a highly detailed, cinematic video generation prompt.

ABSOLUTE RULE — ZERO DIALOGUE:
- B-roll is purely visual. NEVER include spoken words, dialogue, voice-over, narration, lip movement, or any character speaking.
- NEVER include text overlays, subtitles, captions, signs with readable text, or on-screen graphics.
- The output must describe ONLY visuals, ambient sound, natural sound effects, and music.

PROMPT STRUCTURE — write a single, richly detailed paragraph that covers:
1. CAMERA: Shot type (aerial, tracking, dolly, crane, macro, wide establishing, slow-motion, timelapse, etc.), lens (wide-angle, telephoto, tilt-shift, anamorphic), movement (smooth glide, orbit, push-in, pull-back, static lockdown)
2. SUBJECT & ACTION: What is happening visually — no people talking, just environment, objects, nature, architecture, activity observed from a distance
3. SETTING: Location, time of day, season, weather, atmosphere
4. LIGHTING: Golden hour, blue hour, overcast soft light, neon reflections, dappled shade, etc.
5. STYLE: Color grade (warm, cool, teal-orange, desaturated, vivid), film look (cinematic 24fps, vintage 16mm, modern digital, drone footage), mood
6. AUDIO (ambient only): Wind, waves, traffic hum, birdsong, crowd murmur, rain, silence — NEVER speech

QUALITY STANDARDS:
- Every prompt should feel like a National Geographic or Apple commercial shot
- Include at least one striking sensory detail (light behavior, texture, movement quality)
- Prompts should be 80-150 words — detailed enough for AI video generators but focused
- Add a negative prompt line at the end: "Negative: dialogue, speech, talking, text, subtitles, captions, voice-over, narration, words, letters, watermark, blurry, low quality"

OUTPUT FORMAT:
Return a JSON object:
{
  "prompt": "the detailed cinematic prompt text",
  "negativePrompt": "dialogue, speech, talking, text, subtitles, captions, voice-over, narration, words, letters, watermark, blurry, low quality",
  "suggestedDuration": number (5-15 seconds),
  "mood": "one-word mood descriptor"
}

Return ONLY the JSON object.`;

export interface BRollGenerationInput {
  description: string;
  category?: string;
  style?: string;
  targetPlatform?: 'veo3' | 'generic';
}

export interface BRollGenerationOutput {
  prompt: string;
  negativePrompt: string;
  suggestedDuration: number;
  mood: string;
}

export async function generateBRollPrompt(
  input: BRollGenerationInput,
  config: LLMConfig
): Promise<BRollGenerationOutput> {
  const targetGuidance = input.targetPlatform === 'veo3'
    ? 'Optimize this prompt for Veo 3: front-load camera/lens/movement in the first sentence, then subject/action, then environment and lighting.'
    : 'Create a platform-neutral prompt that works across modern video models.';

  const userPrompt = `Generate a stunning B-roll video prompt for this scene:

DESCRIPTION: ${input.description}
${input.category ? `CATEGORY: ${input.category}` : ''}
${input.style ? `PREFERRED STYLE: ${input.style}` : ''}
TARGET MODEL PROFILE: ${input.targetPlatform === 'veo3' ? 'Veo 3' : 'Generic'}

Remember: ABSOLUTELY ZERO DIALOGUE. This is pure visual B-roll footage. No people speaking, no text on screen, no narration.
${targetGuidance}`;

  const responseText = await callLLM(BROLL_PROMPT_SYSTEM, userPrompt, config, { jsonMode: true });
  return parseBRollResponse(responseText);
}

function parseBRollResponse(text: string): BRollGenerationOutput {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return {
    prompt: parsed.prompt || '',
    negativePrompt: parsed.negativePrompt || 'dialogue, speech, talking, text, subtitles, watermark, blurry, low quality',
    suggestedDuration: Math.max(5, Math.min(15, parsed.suggestedDuration || 8)),
    mood: parsed.mood || 'cinematic',
  };
}

// ─── Core LLM Call ───────────────────────────────────────

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  config: LLMConfig,
  options?: { jsonMode?: boolean }
): Promise<string> {
  if (config.provider === 'claude') {
    return callClaude(systemPrompt, userPrompt, config);
  }
  return callGemini(systemPrompt, userPrompt, { ...config, jsonMode: options?.jsonMode });
}

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  config: LLMConfig
): Promise<string> {
  const body: ClaudeRequest = {
    model: config.model || 'claude-sonnet-4-20250514',
    max_tokens: config.maxTokens || 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  };

  const isDev = import.meta.env.DEV;
  const baseUrl = isDev
    ? '/claude-api/v1/messages'
    : 'https://api.anthropic.com/v1/messages';
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Claude API ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((b: { type: string }) => b.type === 'text');
  if (!textBlock) throw new Error('No text content in Claude response');
  return textBlock.text;
}

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  config: LLMConfig & { jsonMode?: boolean }
): Promise<string> {
  const model = config.model || 'gemini-2.5-pro';
  const isDev = import.meta.env.DEV;
  const base = isDev
    ? '/gemini-api/v1beta'
    : 'https://generativelanguage.googleapis.com/v1beta';
  const url = `${base}/models/${model}:generateContent?key=${config.apiKey}`;

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: config.maxTokens || 8192,
  };
  // Only force JSON mode when explicitly requested (shot decomposition, character extraction, etc.)
  // Screenplay generation returns plain text, not JSON.
  if (config.jsonMode) {
    generationConfig.responseMimeType = 'application/json';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ─── Response Parsers ────────────────────────────────────

function parseShotsResponse(
  text: string
): Omit<Shot, 'id' | 'sceneId' | 'renderedPrompts' | 'generations' | 'boardStatus' | 'boardOrder' | 'targetPlatform'>[] {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) {
    throw new Error('Expected JSON array of shots');
  }

  return parsed.map((s: Record<string, unknown>, i: number) => ({
    sequenceOrder: (s.sequenceOrder as number) ?? i,
    durationSeconds: clamp(s.durationSeconds as number, 3, 8),
    prompt: validatePrompt(s.prompt as Record<string, unknown>),
    psychology: validatePsychology(s.psychology as Record<string, unknown>),
  }));
}

function parseCharactersResponse(
  text: string
): Omit<Character, 'id' | 'referenceImages'>[] {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) {
    throw new Error('Expected JSON array of characters');
  }

  return parsed;
}

function parseEmotionalArcResponse(text: string): EmotionalArcAnalysis {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val ?? min));
}

function validatePrompt(raw: Record<string, unknown>): CanonicalPrompt {
  const cam = (raw.camera || {}) as Record<string, string>;
  const sub = (raw.subject || {}) as Record<string, unknown>;
  const set = (raw.setting || {}) as Record<string, string>;
  const lit = (raw.lighting || {}) as Record<string, string>;
  const sty = (raw.style || {}) as Record<string, string>;
  const aud = (raw.audio || {}) as Record<string, unknown>;

  return {
    camera: {
      shotType: normalizeCameraShotType(cam.shotType || 'MEDIUM SHOT'),
      movement: normalizeCameraMovement(cam.movement || 'STATIC'),
      lens: normalizeLens(cam.lens || '35mm'),
      angle: normalizeCameraAngle(cam.angle || 'EYE LEVEL'),
    },
    subject: {
      description: (sub.description as string) || '',
      characters: (sub.characters as string[]) || [],
      action: (sub.action as string) || '',
    },
    setting: {
      location: set.location || '',
      timeOfDay: set.timeOfDay || '',
      weather: set.weather || '',
      productionDesign: set.productionDesign || '',
    },
    lighting: {
      style: normalizeLightingStyle(lit.style || 'natural'),
      colorTemperature: lit.colorTemperature || 'daylight 5600K',
      sources: lit.sources || '',
    },
    style: {
      filmStock: sty.filmStock || '',
      colorGrade: sty.colorGrade || '',
      era: sty.era || '',
      reference: sty.reference || '',
    },
    audio: {
      dialogue: ((aud.dialogue as DialogueLine[]) || []).map((d) => ({
        characterId: d.characterId || '',
        characterName: d.characterName || '',
        text: d.text || '',
        parenthetical: d.parenthetical,
      })),
      sfx: (aud.sfx as string[]) || [],
      ambient: (aud.ambient as string) || '',
      music: (aud.music as string) || '',
    },
    negativePrompt: (raw.negativePrompt as string) || '',
  };
}

function validatePsychology(raw: Record<string, unknown>): ShotPsychology {
  const susp = (raw.suspenseCalibration || {}) as Record<string, unknown>;
  return {
    targetEmotion: (raw.targetEmotion as string) || 'neutral',
    arousalLevel: clamp(raw.arousalLevel as number, 1, 10),
    valence: clamp(raw.valence as number, -5, 5),
    transportationCues: (raw.transportationCues as string[]) || [],
    identificationMode: validateEnum(
      raw.identificationMode as string,
      ['empathy', 'perspective-taking', 'motivational', 'absorption'],
      'empathy'
    ),
    schemaRelationship: validateEnum(
      raw.schemaRelationship as string,
      ['conforming', 'violating', 'subverting'],
      'conforming'
    ),
    storyArcPosition: validateEnum(
      raw.storyArcPosition as string,
      ['inciting', 'rising', 'crisis', 'climax', 'resolution', 'falling'],
      'rising'
    ),
    suspenseCalibration: {
      informationAsymmetry: (susp.informationAsymmetry as string) || '',
      outcomeProbability: clamp(susp.outcomeProbability as number, 0, 1),
    },
  };
}

function validateEnum<T extends string>(val: string, options: T[], fallback: T): T {
  return options.includes(val as T) ? (val as T) : fallback;
}
