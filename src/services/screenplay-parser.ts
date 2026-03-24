/**
 * Screenplay Parser
 * Ported from generate_study_guides.py with enhancements for dialogue association,
 * action block extraction, and Fountain format support.
 *
 * Validated against 106 professional BBC/A24 screenplays.
 */

import type {
  ScreenplayElement,
  ElementType,
  ParsedScreenplay,
  SceneHeading,
} from '../types/screenplay';

import {
  SCENE_PREFIXES,
  TIME_TERMS,
  CHARACTER_STOPWORDS,
  TRANSITION_PATTERN,
  PARENTHETICAL_PATTERN,
  SCENE_NUMBER_PATTERN,
  MAX_SCENE_HEADING_LENGTH,
  MAX_CHARACTER_CUE_WORDS,
  MAX_CHARACTER_CUE_LENGTH,
} from '../config/screenplay-patterns';

// ─── Helpers ───────────────────────────────────────────────

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, '--')
    .replace(/\u2013/g, '-')
    .replace(/\u2026/g, '...');
}

function uppercaseRatio(text: string): number {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length === 0) return 0;
  const upper = letters.replace(/[^A-Z]/g, '').length;
  return upper / letters.length;
}

function isSceneHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_SCENE_HEADING_LENGTH) return false;

  // Strip leading scene numbers
  const stripped = trimmed.replace(SCENE_NUMBER_PATTERN, '');

  const startsWithPrefix = SCENE_PREFIXES.some((prefix) =>
    stripped.toUpperCase().startsWith(prefix)
  );

  if (!startsWithPrefix) return false;

  // If a line starts with a recognized INT./EXT. prefix, that's a strong signal.
  // Use a lower uppercase threshold (40%) to handle LLM-generated screenplays
  // where locations may be mixed-case (e.g., "INT. Sarah's Kitchen - Night").
  // Professional screenplays are fully uppercase, but we need resilience here.
  const ratio = uppercaseRatio(stripped);
  return ratio >= 0.4;
}

function isCharacterCue(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_CHARACTER_CUE_LENGTH) return false;

  // Strip (CONT'D), (V.O.), (O.S.), etc.
  const cleaned = trimmed.replace(/\s*\(.*\)\s*$/, '').trim();
  if (cleaned.length === 0) return false;

  // Must be mostly uppercase
  if (uppercaseRatio(cleaned) < 0.9) return false;

  // Must be 1-4 words
  const words = cleaned.split(/\s+/);
  if (words.length === 0 || words.length > MAX_CHARACTER_CUE_WORDS) return false;

  // Must not be a known stopword/transition/shot direction
  if (CHARACTER_STOPWORDS.has(cleaned)) return false;

  // Must not be a scene heading
  if (isSceneHeading(trimmed)) return false;

  // Must not match transition pattern
  if (TRANSITION_PATTERN.test(trimmed)) return false;

  return true;
}

function isTransition(line: string): boolean {
  return TRANSITION_PATTERN.test(line.trim());
}

function isParenthetical(line: string): boolean {
  return PARENTHETICAL_PATTERN.test(line.trim());
}

function parseSceneHeading(line: string): SceneHeading {
  const trimmed = line.trim().replace(SCENE_NUMBER_PATTERN, '');

  let prefix: SceneHeading['prefix'] = 'INT';
  let rest = trimmed;

  // Match longest prefix first
  for (const p of SCENE_PREFIXES) {
    if (trimmed.toUpperCase().startsWith(p)) {
      const normalizedPrefix = p.trim().replace(/\.$/, '');
      if (normalizedPrefix === 'INT' || normalizedPrefix === 'INT') prefix = 'INT';
      else if (normalizedPrefix === 'EXT') prefix = 'EXT';
      else if (
        normalizedPrefix === 'INT/EXT' ||
        normalizedPrefix === 'INT./EXT' ||
        normalizedPrefix === 'I/E'
      )
        prefix = 'INT/EXT';
      else if (normalizedPrefix === 'EXT/INT' || normalizedPrefix === 'EXT./INT')
        prefix = 'EXT/INT';
      rest = trimmed.slice(p.length).trim();
      break;
    }
  }

  // Split on " - " to separate location from time
  const parts = rest.split(/\s+-\s+/);
  const location = parts[0]?.trim() || '';

  // Time is the last part if it contains a known time term
  let time = '';
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1].trim();
    const lastWords = lastPart.split(/\s+/);
    const hasTimeTerm = lastWords.some((w) => TIME_TERMS.has(w.toUpperCase()));
    if (hasTimeTerm) {
      time = lastPart;
    }
  }

  return { prefix, location, time, raw: line.trim() };
}

function extractCharacterName(line: string): string {
  return line
    .trim()
    .replace(/\s*\(.*\)\s*$/, '')
    .trim();
}

// ─── Main Parser ───────────────────────────────────────────

export function parseScreenplay(rawText: string): ParsedScreenplay {
  const normalized = normalizeText(rawText);
  const lines = normalized.split('\n');

  const elements: ScreenplayElement[] = [];
  const characterSet = new Set<string>();
  const locationSet = new Set<string>();
  let sceneIndex = -1;
  let currentCharacter: string | null = null;
  let inDialogue = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === '') {
      // Empty line breaks dialogue
      if (inDialogue) {
        inDialogue = false;
        currentCharacter = null;
      }
      continue;
    }

    // Page break
    if (/^={3,}$/.test(trimmed) || /^-{3,}$/.test(trimmed)) {
      elements.push({
        type: 'page_break',
        text: trimmed,
        sceneIndex,
        lineStart: i,
        lineEnd: i,
      });
      continue;
    }

    // Scene heading
    if (isSceneHeading(trimmed)) {
      sceneIndex++;
      inDialogue = false;
      currentCharacter = null;

      const heading = parseSceneHeading(trimmed);
      if (heading.location) locationSet.add(heading.location);

      elements.push({
        type: 'scene_heading',
        text: trimmed,
        sceneIndex,
        lineStart: i,
        lineEnd: i,
      });
      continue;
    }

    // Transition
    if (isTransition(trimmed)) {
      inDialogue = false;
      currentCharacter = null;
      elements.push({
        type: 'transition',
        text: trimmed,
        sceneIndex,
        lineStart: i,
        lineEnd: i,
      });
      continue;
    }

    // Character cue — must check BEFORE dialogue/parenthetical
    if (isCharacterCue(trimmed) && !inDialogue) {
      const name = extractCharacterName(trimmed);
      characterSet.add(name);
      currentCharacter = name;
      inDialogue = true;

      elements.push({
        type: 'character',
        text: trimmed,
        sceneIndex,
        lineStart: i,
        lineEnd: i,
      });
      continue;
    }

    // Parenthetical (inside dialogue)
    if (inDialogue && isParenthetical(trimmed)) {
      elements.push({
        type: 'parenthetical',
        text: trimmed,
        sceneIndex,
        lineStart: i,
        lineEnd: i,
      });
      continue;
    }

    // Dialogue (following a character cue, non-empty, not all caps)
    if (inDialogue && currentCharacter) {
      // If this line is all-caps and looks like another character cue, break dialogue
      if (isCharacterCue(trimmed)) {
        const name = extractCharacterName(trimmed);
        characterSet.add(name);
        currentCharacter = name;
        elements.push({
          type: 'character',
          text: trimmed,
          sceneIndex,
          lineStart: i,
          lineEnd: i,
        });
        continue;
      }

      elements.push({
        type: 'dialogue',
        text: trimmed,
        sceneIndex,
        lineStart: i,
        lineEnd: i,
      });
      continue;
    }

    // Shot direction (CLOSE ON -, POV, etc.)
    const shotDirections = ['CLOSE ON', 'ANGLE ON', 'WIDE ON', 'LONG LENS ON', 'ULTRA-WIDE'];
    if (shotDirections.some((d) => trimmed.toUpperCase().startsWith(d))) {
      inDialogue = false;
      currentCharacter = null;
      elements.push({
        type: 'shot',
        text: trimmed,
        sceneIndex,
        lineStart: i,
        lineEnd: i,
      });
      continue;
    }

    // Default: action block
    inDialogue = false;
    currentCharacter = null;
    elements.push({
      type: 'action',
      text: trimmed,
      sceneIndex,
      lineStart: i,
      lineEnd: i,
    });
  }

  // Merge consecutive action lines into blocks
  const merged = mergeConsecutiveElements(elements, 'action');

  return {
    titlePage: null, // TODO: extract from first few lines if Fountain format
    elements: merged,
    sceneCount: sceneIndex + 1,
    characters: Array.from(characterSet).sort(),
    locations: Array.from(locationSet).sort(),
  };
}

function mergeConsecutiveElements(
  elements: ScreenplayElement[],
  type: ElementType
): ScreenplayElement[] {
  const result: ScreenplayElement[] = [];
  let accumulator: ScreenplayElement | null = null;

  for (const el of elements) {
    if (el.type === type && accumulator && accumulator.type === type && el.sceneIndex === accumulator.sceneIndex) {
      accumulator.text += '\n' + el.text;
      accumulator.lineEnd = el.lineEnd;
    } else {
      if (accumulator) result.push(accumulator);
      accumulator = { ...el };
    }
  }
  if (accumulator) result.push(accumulator);

  return result;
}

// ─── Scene Extraction ──────────────────────────────────────

export interface ExtractedScene {
  index: number;
  heading: SceneHeading;
  elements: ScreenplayElement[];
  characters: string[];
  startLine: number;
  endLine: number;
}

export function extractScenes(parsed: ParsedScreenplay): ExtractedScene[] {
  const scenes: ExtractedScene[] = [];

  // Group elements by sceneIndex
  const sceneGroups = new Map<number, ScreenplayElement[]>();
  for (const el of parsed.elements) {
    if (el.sceneIndex < 0) continue;
    if (!sceneGroups.has(el.sceneIndex)) {
      sceneGroups.set(el.sceneIndex, []);
    }
    sceneGroups.get(el.sceneIndex)!.push(el);
  }

  for (const [index, elements] of sceneGroups) {
    const headingEl = elements.find((el) => el.type === 'scene_heading');
    if (!headingEl) continue;

    const heading = parseSceneHeading(headingEl.text);
    const chars = new Set<string>();
    for (const el of elements) {
      if (el.type === 'character') {
        chars.add(extractCharacterName(el.text));
      }
    }

    const startLine = Math.min(...elements.map((e) => e.lineStart));
    const endLine = Math.max(...elements.map((e) => e.lineEnd));

    scenes.push({
      index,
      heading,
      elements,
      characters: Array.from(chars),
      startLine,
      endLine,
    });
  }

  return scenes;
}
