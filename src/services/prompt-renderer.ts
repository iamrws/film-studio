/**
 * Prompt Renderer
 *
 * Converts the canonical Shot.prompt structure into platform-specific
 * prompt strings optimized for each AI video generation model.
 *
 * Formats based on official prompting guides and research:
 * - Veo 3.1:    Five-part master template with SFX:/Ambient noise: prefixes
 * - Sora 2:     Prose scene description + labeled sections (Cinematography, Actions, Dialogue, Sound)
 * - Kling 3:    Seven core elements, 80-150 words, motion intensity 0-3
 * - Seedance:   Audio-forward four-layer structure, compressed ~100 words
 * - Runway Gen-4: Motion-first, simple structure
 * - Hailuo:     Mute-only visual format with photorealistic keywords
 * - Wan:        Timing bracket syntax, max 800 chars
 * - LTX:        Narrative flowing prose, chronological
 * - Grok:       Simple focused single-scene prompt
 */

import type { Shot, CanonicalPrompt } from '../types/scene';
import type { GlobalStyle } from '../types/project';
import type { Character } from '../types/character';
import {
  normalizeCameraAngle,
  normalizeCameraMovement,
  normalizeCameraShotType,
  normalizeLightingStyle,
  normalizeLens,
} from '../config/cinematography-vocabulary';
import { optimizePromptForPlatform } from './prompt-intelligence';

// ─── Helper: resolve character anchors ───────────────────

function resolveCharacters(
  charIds: string[],
  characters: Character[]
): { name: string; anchor: string }[] {
  return charIds
    .map((id) => {
      const lower = id.toLowerCase().trim();
      return characters.find(
        (c) =>
          c.id === id ||
          c.name.toLowerCase() === lower ||
          c.name.toLowerCase().includes(lower) ||
          lower.includes(c.name.toLowerCase())
      );
    })
    .filter(Boolean)
    .map((c) => ({
      name: c!.name,
      anchor: c!.consistencyAnchor || c!.name,
    }));
}

// ─── Helper: map arousal to Kling motion intensity (0-3) ─

function arousalToMotionIntensity(arousal: number): number {
  // arousal is 1-10, map to Kling's 0-3 motion scale
  const clamped = Math.max(1, Math.min(10, arousal));
  const normalized = (clamped - 1) / 9;
  return Math.round(normalized * 3 * 10) / 10;
}

function ensureMotionEndpoint(action: string): string {
  const trimmed = action.trim().replace(/[.\s]+$/, '');
  if (!trimmed) {
    return 'The motion resolves and then settles back into place.';
  }
  if (/(settles|comes to rest|holds at end|stops|steadies)/i.test(trimmed)) {
    return `${trimmed}.`;
  }
  return `${trimmed}, then settles back into place.`;
}

// ─── Helper: truncate at sentence boundary ───────────────

function truncateAtSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastComma = truncated.lastIndexOf(',');
  const breakPoint = lastPeriod > maxChars * 0.5 ? lastPeriod + 1 : lastComma > maxChars * 0.5 ? lastComma : maxChars;
  return text.slice(0, breakPoint).trim();
}

// ─── Helper: truncate at word boundary ───────────────────

function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  return words.length > maxWords ? words.slice(0, maxWords).join(' ') : text;
}

function normalizePromptForRendering(
  prompt: CanonicalPrompt,
  globalStyle: GlobalStyle
): CanonicalPrompt {
  return {
    ...prompt,
    camera: {
      ...prompt.camera,
      shotType: normalizeCameraShotType(prompt.camera.shotType),
      movement: normalizeCameraMovement(prompt.camera.movement),
      angle: normalizeCameraAngle(prompt.camera.angle),
      lens: normalizeLens(prompt.camera.lens || globalStyle.defaultLens),
    },
    lighting: {
      ...prompt.lighting,
      style: normalizeLightingStyle(prompt.lighting.style || globalStyle.defaultLighting),
    },
  };
}

function normalizeShotForRendering(shot: Shot, globalStyle: GlobalStyle): Shot {
  return {
    ...shot,
    prompt: normalizePromptForRendering(shot.prompt, globalStyle),
  };
}

// ═══════════════════════════════════════════════════════════
// Veo 3.1 Renderer
// Five-part master template:
// [Camera move + lens]: [Subject] [Action & physics],
// in [Setting + atmosphere], lit by [Light source].
// Style: [Texture/finish]. Audio: [Dialogue/SFX/ambience].
// ═══════════════════════════════════════════════════════════

export function renderVeo3Prompt(
  shot: Shot,
  globalStyle: GlobalStyle,
  characters: Character[]
): string {
  const p = shot.prompt;
  const parts: string[] = [];

  // Camera move + lens (front-loaded — Veo weights early words heavily)
  const cameraStr = [p.camera.shotType, p.camera.movement, p.camera.angle]
    .filter(Boolean).join(', ');
  const lensStr = p.camera.lens ? `, ${p.camera.lens}` : '';
  parts.push(`${cameraStr}${lensStr}`);

  // Subject with character consistency anchors + action
  // Front-load character anchors with names for maximum consistency
  const chars = resolveCharacters(p.subject.characters, characters);
  if (chars.length > 0) {
    parts.push(chars.map((c) => `${c.name}: ${c.anchor}`).join('. '));
  }
  if (p.subject.description) parts.push(p.subject.description);
  parts.push(p.subject.action);

  // Setting + atmosphere
  const settingParts = [p.setting.location, p.setting.timeOfDay, p.setting.weather]
    .filter(Boolean).join(', ');
  if (settingParts) parts.push(`in ${settingParts}`);
  if (p.setting.productionDesign) parts.push(p.setting.productionDesign);

  // Lighting
  if (p.lighting.style || p.lighting.sources) {
    const litBy = [p.lighting.style, p.lighting.colorTemperature, p.lighting.sources]
      .filter(Boolean).join(', ');
    parts.push(`lit by ${litBy}`);
  }

  // Style: texture/finish
  const styleParts: string[] = [];
  if (p.style.filmStock) styleParts.push(p.style.filmStock);
  if (p.style.colorGrade) styleParts.push(p.style.colorGrade);
  if (p.style.era) styleParts.push(`${p.style.era} aesthetic`);
  if (p.style.reference) styleParts.push(`in the style of ${p.style.reference}`);
  if (globalStyle.filmStyle) styleParts.push(globalStyle.filmStyle);
  if (styleParts.length > 0) {
    parts.push(`Style: ${styleParts.join(', ')}`);
  }

  // Audio: Dialogue with quotation marks, SFX: prefix, Ambient noise: prefix
  const audioParts: string[] = [];
  for (const line of p.audio.dialogue) {
    const paren = line.parenthetical ? ` (${line.parenthetical})` : '';
    audioParts.push(`${line.characterName}${paren} says, "${line.text}"`);
  }
  if (p.audio.sfx.length > 0) {
    audioParts.push(`SFX: ${p.audio.sfx.join(', ')}`);
  }
  if (p.audio.ambient) {
    audioParts.push(`Ambient noise: ${p.audio.ambient}`);
  }
  if (p.audio.music) {
    audioParts.push(p.audio.music);
  }
  if (audioParts.length > 0) {
    parts.push(`Audio: ${audioParts.join('. ')}`);
  }

  // Transportation cues from psychology engine
  if (shot.psychology.transportationCues.length > 0) {
    parts.push(shot.psychology.transportationCues.join('. '));
  }

  return parts.filter(Boolean).join('. ') + '.';
}

// ═══════════════════════════════════════════════════════════
// Sora 2 Renderer
// Prose scene description + labeled sections:
// Cinematography, Actions, Dialogue, Background Sound
// Style/mood placed early. One camera move + one action max.
// ═══════════════════════════════════════════════════════════

export function renderSora2Prompt(
  shot: Shot,
  globalStyle: GlobalStyle,
  characters: Character[]
): string {
  const p = shot.prompt;
  const sections: string[] = [];

  // Prose scene description (style and mood early)
  const sceneParts: string[] = [];
  if (p.style.era || p.style.reference || globalStyle.filmStyle) {
    const moodParts = [p.style.era, globalStyle.filmStyle, p.style.reference ? `inspired by ${p.style.reference}` : '']
      .filter(Boolean);
    if (moodParts.length > 0) sceneParts.push(moodParts.join(', ') + '.');
  }

  // Subject description
  const chars = resolveCharacters(p.subject.characters, characters);
  if (chars.length > 0) {
    sceneParts.push(chars.map((c) => c.anchor).join('. ') + '.');
  }

  // Setting and atmosphere
  const setting = [p.setting.location, p.setting.timeOfDay, p.setting.weather, p.setting.productionDesign]
    .filter(Boolean).join(', ');
  if (setting) sceneParts.push(setting + '.');

  // Lighting
  if (p.lighting.style) {
    sceneParts.push([p.lighting.style, p.lighting.colorTemperature, p.lighting.sources].filter(Boolean).join(', ') + '.');
  }

  if (sceneParts.length > 0) sections.push(sceneParts.join(' '));

  // Cinematography section
  const cameraLine = [p.camera.shotType, p.camera.angle, p.camera.movement].filter(Boolean).join(', ');
  const filmStock = p.style.filmStock ? `; ${p.style.filmStock}` : '';
  const colorGrade = p.style.colorGrade ? `; ${p.style.colorGrade}` : '';
  sections.push(`Cinematography:\nCamera shot: ${cameraLine}${filmStock}${colorGrade}`);

  // Actions section (bulleted)
  sections.push(`Actions:\n- ${p.subject.action}`);

  // Dialogue section (labeled speakers)
  if (p.audio.dialogue.length > 0) {
    const dialogueLines = p.audio.dialogue.map((d) => {
      const paren = d.parenthetical ? ` (${d.parenthetical})` : '';
      return `${d.characterName}${paren}: "${d.text}"`;
    });
    sections.push(`Dialogue:\n${dialogueLines.join('\n')}`);
  }

  // Background Sound section
  const soundParts: string[] = [];
  if (p.audio.sfx.length > 0) soundParts.push(p.audio.sfx.join(', '));
  if (p.audio.ambient) soundParts.push(p.audio.ambient);
  if (p.audio.music) soundParts.push(p.audio.music);
  if (soundParts.length > 0) {
    sections.push(`Background Sound:\n${soundParts.join('. ')}`);
  }

  return sections.join('\n\n');
}

// ═══════════════════════════════════════════════════════════
// Kling 3 Renderer
// Seven core elements: Subject → Environment → Lighting →
// Camera → Mood/Style → Motion Specs → Audio
// Target 80-150 words. Physics-descriptive action.
// ═══════════════════════════════════════════════════════════

export function renderKling3Prompt(
  shot: Shot,
  globalStyle: GlobalStyle,
  characters: Character[]
): string {
  const p = shot.prompt;
  const parts: string[] = [];

  // 1. Subject Details
  const chars = resolveCharacters(p.subject.characters, characters);
  if (chars.length > 0) {
    parts.push(`++${chars.map((c) => c.anchor).join('. ')}++`);
  }

  // 2. Environment Description
  const envParts = [p.setting.location, p.setting.timeOfDay, p.setting.weather, p.setting.productionDesign]
    .filter(Boolean);
  if (envParts.length > 0) parts.push(envParts.join(', '));

  // 3. Lighting Conditions
  if (p.lighting.style) {
    parts.push([p.lighting.style + ' lighting', p.lighting.colorTemperature, p.lighting.sources].filter(Boolean).join(', '));
  }

  // 4. Camera Movement and Framing
  parts.push([p.camera.shotType, p.camera.movement, p.camera.angle, p.camera.lens].filter(Boolean).join(', '));

  // 5. Mood and Style
  const styleParts = [p.style.filmStock, p.style.colorGrade, p.style.era ? `${p.style.era} aesthetic` : '', p.style.reference ? `in the style of ${p.style.reference}` : '', globalStyle.filmStyle].filter(Boolean);
  if (styleParts.length > 0) parts.push(styleParts.join(', '));

  // 6. Motion Specifications (with physics-descriptive action)
  const motionIntensity = arousalToMotionIntensity(shot.psychology.arousalLevel);
  parts.push(`Motion intensity ${motionIntensity}. ${ensureMotionEndpoint(p.subject.action)}`);

  // 7. Dialogue or Audio Cues
  const audioParts: string[] = [];
  for (const d of p.audio.dialogue) {
    const voiceDesc = d.parenthetical ? ` (${d.parenthetical})` : '';
    audioParts.push(`[Speaker: ${d.characterName}]${voiceDesc} "${d.text}"`);
  }
  if (p.audio.sfx.length > 0) audioParts.push(p.audio.sfx.join(', '));
  if (p.audio.ambient) audioParts.push(p.audio.ambient);
  if (audioParts.length > 0) parts.push(audioParts.join('. '));

  const result = parts.filter(Boolean).join('. ') + '.';
  // Target 80-150 words — trim if over
  return truncateWords(result, 150);
}

// ═══════════════════════════════════════════════════════════
// Seedance Renderer
// Audio-forward four-layer structure:
// Layer 1: Dialogue (in quotes) → Layer 2: Primary Action →
// Layer 3: Environmental Audio → Layer 4: Visual Style/Mood
// Compressed ~100 words with @Tag references.
// ═══════════════════════════════════════════════════════════

export function renderSeedance2Prompt(
  shot: Shot,
  globalStyle: GlobalStyle,
  characters: Character[]
): string {
  const p = shot.prompt;
  const parts: string[] = [];

  // Layer 1: Dialogue (audio-forward — lead with speech)
  for (const d of p.audio.dialogue) {
    parts.push(`${d.characterName} declaring '${d.text}'`);
  }

  // Layer 2: Primary Action + character @Tags
  const charRefs = resolveCharacters(p.subject.characters, characters);
  const actionWithRefs = charRefs.length > 0
    ? `${charRefs.map((c) => `@${c.name}`).join(' ')} ${p.subject.action}`
    : p.subject.action;
  parts.push(actionWithRefs);

  // Layer 3: Environmental Audio
  const envAudio: string[] = [];
  if (p.audio.sfx.length > 0) envAudio.push(...p.audio.sfx);
  if (p.audio.ambient) envAudio.push(p.audio.ambient);
  if (envAudio.length > 0) parts.push(envAudio.join(', '));

  // Layer 4: Visual Style and Mood
  const visualParts = [
    p.camera.shotType,
    p.camera.movement,
    p.setting.location,
    p.lighting.style,
    p.style.colorGrade,
    globalStyle.filmStyle,
  ].filter(Boolean);
  if (visualParts.length > 0) parts.push(visualParts.join(', '));

  const full = parts.filter(Boolean).join(', ');
  return truncateWords(full, 100);
}

// ═══════════════════════════════════════════════════════════
// Runway Gen-4 Renderer
// Motion-first, simpler structure
// ═══════════════════════════════════════════════════════════

export function renderRunwayGen4Prompt(
  shot: Shot,
  globalStyle: GlobalStyle,
  characters: Character[]
): string {
  const p = shot.prompt;
  const parts: string[] = [];

  // Motion-first
  parts.push(p.subject.action);

  const chars = resolveCharacters(p.subject.characters, characters);
  if (chars.length > 0) parts.push(chars.map((c) => c.anchor).join('. '));

  parts.push(`${p.camera.shotType}, ${p.camera.movement}`);
  parts.push(`${p.setting.location}, ${p.setting.timeOfDay}`);
  if (p.lighting.style) parts.push(`${p.lighting.style} lighting`);
  if (p.style.colorGrade) parts.push(p.style.colorGrade);
  if (globalStyle.filmStyle) parts.push(globalStyle.filmStyle);

  return parts.filter(Boolean).join('. ') + '.';
}

// ═══════════════════════════════════════════════════════════
// Hailuo (MiniMax) Renderer
// Formula: [Camera + Motion] + [Subject + Desc] + [Action] +
//          [Scene + Desc] + [Lighting] + [Style/Mood]
// MUTE ONLY — strip ALL audio elements.
// Add photorealistic keywords. ((...)) for emphasis.
// ═══════════════════════════════════════════════════════════

export function renderHailuoPrompt(
  shot: Shot,
  globalStyle: GlobalStyle,
  characters: Character[]
): string {
  const p = shot.prompt;
  const parts: string[] = [];

  // Camera Shot + Motion
  parts.push([p.camera.shotType, p.camera.movement, p.camera.angle].filter(Boolean).join(', '));

  // Subject + Description with ((...)) emphasis on consistency anchors
  const chars = resolveCharacters(p.subject.characters, characters);
  if (chars.length > 0) {
    parts.push(chars.map((c) => `((${c.anchor}))`).join(', '));
  }

  // Action
  parts.push(p.subject.action);

  // Scene + Description
  const scene = [p.setting.location, p.setting.timeOfDay, p.setting.weather, p.setting.productionDesign]
    .filter(Boolean).join(', ');
  if (scene) parts.push(scene);

  // Lighting
  if (p.lighting.style) {
    parts.push([p.lighting.style + ' lighting', p.lighting.colorTemperature, p.lighting.sources].filter(Boolean).join(', '));
  }

  // Style/Mood + photorealistic keywords
  const styleParts = [
    p.style.filmStock,
    p.style.colorGrade,
    p.style.era ? `${p.style.era} aesthetic` : '',
    p.style.reference ? `in the style of ${p.style.reference}` : '',
    globalStyle.filmStyle,
    'photorealistic, hyper-detailed, cinematic movie style',
  ].filter(Boolean);
  parts.push(styleParts.join(', '));

  // NO audio — Hailuo is mute only
  return parts.filter(Boolean).join('. ') + '.';
}

// ═══════════════════════════════════════════════════════════
// Wan (Alibaba) Renderer
// Timing bracket syntax: [0-3s], [3-7s], etc.
// Max 800 characters. Supports negative prompt (500 chars).
// ═══════════════════════════════════════════════════════════

export function renderWanPrompt(
  shot: Shot,
  globalStyle: GlobalStyle,
  characters: Character[]
): string {
  const p = shot.prompt;
  const duration = shot.durationSeconds || 5;
  const parts: string[] = [];

  // Single shot with timing bracket
  parts.push(`[0-${duration}s]`);

  // Camera
  parts.push([p.camera.shotType, p.camera.movement, p.camera.angle].filter(Boolean).join(', '));

  // Characters
  const chars = resolveCharacters(p.subject.characters, characters);
  if (chars.length > 0) {
    parts.push(chars.map((c) => c.anchor).join('. '));
  }

  // Action
  parts.push(p.subject.action);

  // Setting
  const setting = [p.setting.location, p.setting.timeOfDay, p.setting.weather].filter(Boolean).join(', ');
  if (setting) parts.push(setting);

  // Lighting
  if (p.lighting.style) {
    parts.push([p.lighting.style, p.lighting.colorTemperature].filter(Boolean).join(', '));
  }

  // Style
  const styleParts = [p.style.filmStock, p.style.colorGrade, globalStyle.filmStyle].filter(Boolean);
  if (styleParts.length > 0) parts.push(styleParts.join(', '));

  // Audio (Wan supports audio via audio_url, but include dialogue cues in text)
  for (const d of p.audio.dialogue) {
    parts.push(`${d.characterName}: "${d.text}"`);
  }

  const result = parts.filter(Boolean).join('. ') + '.';
  // Enforce 800 character max
  return truncateAtSentence(result, 800);
}

// ═══════════════════════════════════════════════════════════
// LTX Renderer
// Narrative flowing prose, chronological order.
// Transitional phrases. Longer = better. No truncation.
// ═══════════════════════════════════════════════════════════

export function renderLtxPrompt(
  shot: Shot,
  globalStyle: GlobalStyle,
  characters: Character[]
): string {
  const p = shot.prompt;
  const sentences: string[] = [];

  // Open with camera establishing the scene
  const cameraOpening = `The camera opens with a ${p.camera.shotType.toLowerCase()}`;
  const settingIntro = p.setting.location
    ? ` of ${p.setting.location}`
    : '';
  const timeWeather = [p.setting.timeOfDay, p.setting.weather].filter(Boolean).join(', ');
  sentences.push(`${cameraOpening}${settingIntro}${timeWeather ? `, ${timeWeather}` : ''}.`);

  // Production design details
  if (p.setting.productionDesign) {
    sentences.push(p.setting.productionDesign + '.');
  }

  // Introduce characters
  const chars = resolveCharacters(p.subject.characters, characters);
  if (chars.length > 0) {
    sentences.push(chars.map((c) => c.anchor).join('. ') + '.');
  }

  // Action with transitional phrases
  sentences.push(p.subject.action + '.');

  // Camera movement as narration
  if (p.camera.movement && p.camera.movement.toLowerCase() !== 'static') {
    sentences.push(`As this happens, the camera ${p.camera.movement.toLowerCase()}.`);
  }

  // Lighting as atmosphere
  if (p.lighting.style) {
    const lightDesc = [p.lighting.style, p.lighting.colorTemperature, p.lighting.sources].filter(Boolean).join(', ');
    sentences.push(`The scene is bathed in ${lightDesc}.`);
  }

  // Lens detail
  if (p.camera.lens) {
    sentences.push(`Shot on ${p.camera.lens}, ${p.camera.angle || 'eye level'}.`);
  }

  // Style as texture
  const styleParts = [p.style.filmStock, p.style.colorGrade, p.style.era ? `${p.style.era} aesthetic` : '', globalStyle.filmStyle].filter(Boolean);
  if (styleParts.length > 0) {
    sentences.push(`The visual tone is ${styleParts.join(', ')}.`);
  }

  // Dialogue woven into narrative
  for (const d of p.audio.dialogue) {
    const paren = d.parenthetical ? `, ${d.parenthetical},` : '';
    sentences.push(`${d.characterName}${paren} says, "${d.text}"`);
  }

  return sentences.join(' ');
}

// ═══════════════════════════════════════════════════════════
// Grok Imagine Video Renderer
// Simple, focused. One subject, one action, one camera.
// Standard cinematic terms, minimal complexity.
// ═══════════════════════════════════════════════════════════

export function renderGrokPrompt(
  shot: Shot,
  globalStyle: GlobalStyle,
  characters: Character[]
): string {
  const p = shot.prompt;
  const parts: string[] = [];

  // Camera (simple)
  parts.push(`${p.camera.shotType} ${p.camera.movement}`.trim());

  // Subject
  const chars = resolveCharacters(p.subject.characters, characters);
  if (chars.length > 0) {
    parts.push(chars.map((c) => c.name).join(' and '));
  }

  // Action (core)
  parts.push(p.subject.action);

  // Setting (brief)
  if (p.setting.location) {
    parts.push(p.setting.location + (p.setting.timeOfDay ? `, ${p.setting.timeOfDay}` : ''));
  }

  // Lighting (simple)
  if (p.lighting.style) parts.push(`${p.lighting.style} lighting`);

  // Style (one line)
  if (globalStyle.filmStyle) parts.push(globalStyle.filmStyle);
  if (p.style.colorGrade) parts.push(p.style.colorGrade);

  return parts.filter(Boolean).join('. ') + '.';
}

// ═══════════════════════════════════════════════════════════
// Generic Renderer (fallback)
// ═══════════════════════════════════════════════════════════

export function renderGenericPrompt(
  shot: Shot,
  globalStyle: GlobalStyle,
  characters: Character[]
): string {
  return renderVeo3Prompt(shot, globalStyle, characters);
}

// ═══════════════════════════════════════════════════════════
// Negative Prompt
// ═══════════════════════════════════════════════════════════

export function renderNegativePrompt(
  shot: Shot,
  globalStyle: GlobalStyle
): string {
  const parts: string[] = [];
  if (globalStyle.globalNegativePrompt) parts.push(globalStyle.globalNegativePrompt);
  if (shot.prompt.negativePrompt) parts.push(shot.prompt.negativePrompt);
  return parts.join(', ');
}

// ═══════════════════════════════════════════════════════════
// JSON Prompt (for structured API endpoints)
// ═══════════════════════════════════════════════════════════

export function renderJsonPrompt(
  shot: Shot,
  globalStyle: GlobalStyle,
  characters: Character[]
): object {
  const p = shot.prompt;

  const charProfiles = p.subject.characters
    .map((charId) => characters.find((c) => c.id === charId || c.name === charId))
    .filter(Boolean)
    .map((c) => ({
      name: c!.name,
      consistency_anchor: c!.consistencyAnchor,
      wardrobe: c!.wardrobe.default,
    }));

  return {
    camera: {
      shot_type: p.camera.shotType,
      movement: p.camera.movement,
      angle: p.camera.angle,
      lens: p.camera.lens,
    },
    subject: {
      characters: charProfiles,
      action: p.subject.action,
      description: p.subject.description,
    },
    setting: {
      location: p.setting.location,
      time_of_day: p.setting.timeOfDay,
      weather: p.setting.weather,
      production_design: p.setting.productionDesign,
    },
    lighting: {
      style: p.lighting.style,
      color_temperature: p.lighting.colorTemperature,
      sources: p.lighting.sources,
    },
    style: {
      film_stock: p.style.filmStock,
      color_grade: p.style.colorGrade,
      era: p.style.era,
      reference: p.style.reference,
      global_style: globalStyle.filmStyle,
    },
    audio: {
      dialogue: p.audio.dialogue.map((d) => ({
        character: d.characterName,
        line: d.text,
        direction: d.parenthetical || '',
      })),
      sfx: p.audio.sfx,
      ambient: p.audio.ambient,
      music: p.audio.music,
    },
    psychology: {
      target_emotion: shot.psychology.targetEmotion,
      arousal: shot.psychology.arousalLevel,
      valence: shot.psychology.valence,
      arc_position: shot.psychology.storyArcPosition,
    },
    negative_prompt: renderNegativePrompt(shot, globalStyle),
    duration_seconds: shot.durationSeconds,
    aspect_ratio: globalStyle.aspectRatio,
    resolution: globalStyle.resolution,
    no_subtitles: true,
  };
}

// ═══════════════════════════════════════════════════════════
// Render All Platforms
// ═══════════════════════════════════════════════════════════

export function renderAllPrompts(
  shot: Shot,
  globalStyle: GlobalStyle,
  characters: Character[]
): Shot['renderedPrompts'] {
  const normalizedShot = normalizeShotForRendering(shot, globalStyle);

  const rawPrompts: Shot['renderedPrompts'] = {
    veo3: renderVeo3Prompt(normalizedShot, globalStyle, characters),
    sora2: renderSora2Prompt(normalizedShot, globalStyle, characters),
    kling3: renderKling3Prompt(normalizedShot, globalStyle, characters),
    seedance2: renderSeedance2Prompt(normalizedShot, globalStyle, characters),
    runwayGen4: renderRunwayGen4Prompt(normalizedShot, globalStyle, characters),
    hailuo: renderHailuoPrompt(normalizedShot, globalStyle, characters),
    wan: renderWanPrompt(normalizedShot, globalStyle, characters),
    ltx: renderLtxPrompt(normalizedShot, globalStyle, characters),
    grok: renderGrokPrompt(normalizedShot, globalStyle, characters),
    generic: renderGenericPrompt(normalizedShot, globalStyle, characters),
  };

  return {
    veo3: optimizePromptForPlatform({ platform: 'veo3', prompt: rawPrompts.veo3 || '', shot: normalizedShot, globalStyle }),
    sora2: optimizePromptForPlatform({ platform: 'sora2', prompt: rawPrompts.sora2 || '', shot: normalizedShot, globalStyle }),
    kling3: optimizePromptForPlatform({ platform: 'kling3', prompt: rawPrompts.kling3 || '', shot: normalizedShot, globalStyle }),
    seedance2: optimizePromptForPlatform({ platform: 'seedance2', prompt: rawPrompts.seedance2 || '', shot: normalizedShot, globalStyle }),
    runwayGen4: optimizePromptForPlatform({ platform: 'runwayGen4', prompt: rawPrompts.runwayGen4 || '', shot: normalizedShot, globalStyle }),
    hailuo: optimizePromptForPlatform({ platform: 'hailuo', prompt: rawPrompts.hailuo || '', shot: normalizedShot, globalStyle }),
    wan: optimizePromptForPlatform({ platform: 'wan', prompt: rawPrompts.wan || '', shot: normalizedShot, globalStyle }),
    ltx: optimizePromptForPlatform({ platform: 'ltx', prompt: rawPrompts.ltx || '', shot: normalizedShot, globalStyle }),
    grok: optimizePromptForPlatform({ platform: 'grok', prompt: rawPrompts.grok || '', shot: normalizedShot, globalStyle }),
    generic: optimizePromptForPlatform({ platform: 'generic', prompt: rawPrompts.generic, shot: normalizedShot, globalStyle }),
  };
}
