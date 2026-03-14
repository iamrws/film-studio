/**
 * Prompt Renderer
 *
 * Converts the canonical Shot.prompt structure into platform-specific
 * prompt strings. Each platform has different conventions:
 *
 * - Veo 3: Natural language paragraph, front-loaded camera, dialogue in quotes
 * - Sora 2: Shot-list style, explicit camera nomenclature
 * - Kling 3: Multi-shot JSON format
 * - Seedance 2: Compressed 30-100 words with @Tag references
 * - Runway Gen-4: Motion-first, simpler structure
 *
 * The canonical prompt is the single source of truth; adapters
 * only format, never add or modify creative content.
 */

import type { Shot } from '../types/scene';
import type { GlobalStyle } from '../types/project';
import type { Character } from '../types/character';

// ─── Veo 3 Renderer ───────────────────────────────────────

export function renderVeo3Prompt(
  shot: Shot,
  globalStyle: GlobalStyle,
  characters: Character[]
): string {
  const p = shot.prompt;
  const parts: string[] = [];

  // 1. Camera (front-loaded — Veo weights early words heavily)
  parts.push(
    `${p.camera.shotType}, ${p.camera.movement}, ${p.camera.angle}` +
    (p.camera.lens ? `, shot on ${p.camera.lens}` : '')
  );

  // 2. Subject with character consistency anchors
  const charAnchors = p.subject.characters
    .map((charId) => characters.find((c) => c.id === charId || c.name === charId))
    .filter(Boolean)
    .map((c) => c!.consistencyAnchor || c!.name);

  if (charAnchors.length > 0) {
    parts.push(charAnchors.join('. '));
  }
  parts.push(p.subject.action);

  // 3. Setting
  parts.push(
    `${p.setting.location}${p.setting.timeOfDay ? ', ' + p.setting.timeOfDay : ''}` +
    (p.setting.weather ? `, ${p.setting.weather}` : '') +
    (p.setting.productionDesign ? `. ${p.setting.productionDesign}` : '')
  );

  // 4. Lighting & Style
  if (p.lighting.style) {
    parts.push(
      `${p.lighting.style} lighting, ${p.lighting.colorTemperature}` +
      (p.lighting.sources ? `, ${p.lighting.sources}` : '')
    );
  }

  // 5. Style references
  if (p.style.filmStock || p.style.colorGrade || p.style.era) {
    const styleParts: string[] = [];
    if (p.style.filmStock) styleParts.push(`shot on ${p.style.filmStock}`);
    if (p.style.colorGrade) styleParts.push(p.style.colorGrade);
    if (p.style.era) styleParts.push(`${p.style.era} aesthetic`);
    if (p.style.reference) styleParts.push(`in the style of ${p.style.reference}`);
    parts.push(styleParts.join(', '));
  }

  // Global style
  if (globalStyle.filmStyle) parts.push(globalStyle.filmStyle);

  // 6. Audio
  const audioParts: string[] = [];
  if (p.audio.dialogue.length > 0) {
    for (const line of p.audio.dialogue) {
      const paren = line.parenthetical ? ` (${line.parenthetical})` : '';
      audioParts.push(`${line.characterName}${paren}: "${line.text}"`);
    }
  }
  if (p.audio.sfx.length > 0) {
    audioParts.push(`[SFX: ${p.audio.sfx.join(', ')}]`);
  }
  if (p.audio.ambient) {
    audioParts.push(`[Ambient: ${p.audio.ambient}]`);
  }
  if (p.audio.music) {
    audioParts.push(`[Music: ${p.audio.music}]`);
  }
  if (audioParts.length > 0) {
    parts.push(audioParts.join('. '));
  }

  // 7. Transportation cues (from psychology engine)
  if (shot.psychology.transportationCues.length > 0) {
    parts.push(shot.psychology.transportationCues.join('. '));
  }

  return parts.filter(Boolean).join('. ') + '.';
}

// ─── Generic Renderer ──────────────────────────────────────

export function renderGenericPrompt(
  shot: Shot,
  globalStyle: GlobalStyle,
  characters: Character[]
): string {
  // Generic format: structured JSON-like but as readable text
  return renderVeo3Prompt(shot, globalStyle, characters);
}

// ─── Negative Prompt ───────────────────────────────────────

export function renderNegativePrompt(
  shot: Shot,
  globalStyle: GlobalStyle
): string {
  const parts: string[] = [];
  if (globalStyle.globalNegativePrompt) parts.push(globalStyle.globalNegativePrompt);
  if (shot.prompt.negativePrompt) parts.push(shot.prompt.negativePrompt);
  return parts.join(', ');
}

// ─── JSON Prompt (for platforms that support structured input) ──

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

// ─── Sora 2 Renderer ──────────────────────────────────────

export function renderSora2Prompt(
  shot: Shot,
  globalStyle: GlobalStyle,
  characters: Character[]
): string {
  const p = shot.prompt;
  const lines: string[] = [];

  lines.push(`[CAMERA: ${p.camera.shotType}, ${p.camera.movement}, ${p.camera.angle}, ${p.camera.lens}]`);

  const charAnchors = p.subject.characters
    .map((charId) => characters.find((c) => c.id === charId || c.name === charId))
    .filter(Boolean)
    .map((c) => c!.consistencyAnchor || c!.name);

  if (charAnchors.length > 0) {
    lines.push(`[SUBJECT: ${charAnchors.join('; ')}]`);
  }

  lines.push(`[ACTION: ${p.subject.action}]`);
  lines.push(`[SETTING: ${p.setting.location}, ${p.setting.timeOfDay}${p.setting.weather ? `, ${p.setting.weather}` : ''}]`);
  lines.push(`[LIGHTING: ${p.lighting.style}, ${p.lighting.colorTemperature}]`);

  if (p.style.filmStock || p.style.colorGrade) {
    lines.push(`[STYLE: ${[p.style.filmStock, p.style.colorGrade, p.style.era].filter(Boolean).join(', ')}]`);
  }

  for (const d of p.audio.dialogue) {
    lines.push(`[DIALOGUE: ${d.characterName}: "${d.text}"]`);
  }

  if (globalStyle.filmStyle) lines.push(`[AESTHETIC: ${globalStyle.filmStyle}]`);

  return lines.join('\n');
}

// ─── Kling 3 Renderer ─────────────────────────────────────

export function renderKling3Prompt(
  shot: Shot,
  globalStyle: GlobalStyle,
  characters: Character[]
): string {
  const p = shot.prompt;
  const parts: string[] = [];

  parts.push(`${p.camera.shotType} ${p.camera.movement} ${p.camera.angle}`);

  const charAnchors = p.subject.characters
    .map((charId) => characters.find((c) => c.id === charId || c.name === charId))
    .filter(Boolean)
    .map((c) => c!.consistencyAnchor || c!.name);

  if (charAnchors.length > 0) parts.push(charAnchors.join('. '));
  parts.push(p.subject.action);
  parts.push(`${p.setting.location}, ${p.setting.timeOfDay}`);
  if (p.lighting.style) parts.push(`${p.lighting.style} lighting`);
  if (p.style.colorGrade) parts.push(p.style.colorGrade);
  if (globalStyle.filmStyle) parts.push(globalStyle.filmStyle);

  for (const d of p.audio.dialogue) {
    parts.push(`${d.characterName} says "${d.text}"`);
  }

  return parts.filter(Boolean).join('. ') + '.';
}

// ─── Seedance 2 Renderer ──────────────────────────────────

export function renderSeedance2Prompt(
  shot: Shot,
  globalStyle: GlobalStyle,
  characters: Character[]
): string {
  const p = shot.prompt;
  const parts: string[] = [];

  // Motion-first for Seedance
  parts.push(p.subject.action);

  const charRefs = p.subject.characters
    .map((charId) => characters.find((c) => c.id === charId || c.name === charId))
    .filter(Boolean);

  for (const c of charRefs) {
    parts.push(`@${c!.name} ${c!.consistencyAnchor || ''}`);
  }

  parts.push(`${p.camera.shotType} ${p.camera.movement}`);
  parts.push(`${p.setting.location} ${p.setting.timeOfDay}`);
  if (p.lighting.style) parts.push(p.lighting.style);
  if (p.style.colorGrade) parts.push(p.style.colorGrade);
  if (globalStyle.filmStyle) parts.push(globalStyle.filmStyle);

  const full = parts.filter(Boolean).join(', ');
  const words = full.split(/\s+/);
  return words.length > 100 ? words.slice(0, 100).join(' ') : full;
}

// ─── Runway Gen-4 Renderer ─────────────────────────────────

export function renderRunwayGen4Prompt(
  shot: Shot,
  globalStyle: GlobalStyle,
  characters: Character[]
): string {
  const p = shot.prompt;
  const parts: string[] = [];

  // Motion-first for Runway
  parts.push(p.subject.action);

  const charAnchors = p.subject.characters
    .map((charId) => characters.find((c) => c.id === charId || c.name === charId))
    .filter(Boolean)
    .map((c) => c!.consistencyAnchor || c!.name);

  if (charAnchors.length > 0) parts.push(charAnchors.join('. '));
  parts.push(`${p.camera.shotType}, ${p.camera.movement}`);
  parts.push(`${p.setting.location}, ${p.setting.timeOfDay}`);
  if (p.lighting.style) parts.push(`${p.lighting.style} lighting`);
  if (p.style.colorGrade) parts.push(p.style.colorGrade);
  if (globalStyle.filmStyle) parts.push(globalStyle.filmStyle);

  return parts.filter(Boolean).join('. ') + '.';
}

// ─── Render All Platforms ──────────────────────────────────

export function renderAllPrompts(
  shot: Shot,
  globalStyle: GlobalStyle,
  characters: Character[]
): Shot['renderedPrompts'] {
  return {
    veo3: renderVeo3Prompt(shot, globalStyle, characters),
    sora2: renderSora2Prompt(shot, globalStyle, characters),
    kling3: renderKling3Prompt(shot, globalStyle, characters),
    seedance2: renderSeedance2Prompt(shot, globalStyle, characters),
    runwayGen4: renderRunwayGen4Prompt(shot, globalStyle, characters),
    generic: renderGenericPrompt(shot, globalStyle, characters),
  };
}
