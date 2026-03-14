/**
 * Screenplay parsing patterns ported from generate_study_guides.py
 * These are empirically validated against 106 professional BBC/A24 screenplays.
 */

export const SCENE_PREFIXES = [
  'INT./EXT.',
  'EXT./INT.',
  'INT/EXT.',
  'EXT/INT.',
  'I/E.',
  'INT.',
  'EXT.',
  'INT ',
  'EXT ',
] as const;

export const TIME_TERMS = new Set([
  'DAY',
  'NIGHT',
  'MORNING',
  'EVENING',
  'AFTERNOON',
  'LATER',
  'CONTINUOUS',
  'MOMENTS LATER',
  'DAWN',
  'DUSK',
  'SUNRISE',
  'SUNSET',
  'SAME',
  'TIME',
]);

export const CHARACTER_STOPWORDS = new Set([
  'CUT TO',
  'DISSOLVE TO',
  'SMASH CUT TO',
  'MATCH CUT TO',
  'FADE IN',
  'FADE OUT',
  'TITLE',
  'SUPER',
  'END CREDITS',
  'MONTAGE',
  'END MONTAGE',
  'INTERCUT',
  'SERIES OF SHOTS',
  'CLOSE ON',
  'ANGLE ON',
  'WIDE SHOT',
  'INSERT',
  'NOTE',
  'OMITTED',
  'CONTINUED',
  'CONTINUOUS',
  'LATER',
  'FLASHBACK',
  'BACK TO SCENE',
  'BACK TO',
  'LONG LENS ON',
  'CROSS DISSOLVE',
  'THE END',
  'FREEZE FRAME',
  'SLOW MOTION',
  'TIME CUT',
  'JUMP CUT',
  'SMASH CUT',
  'MATCH CUT',
  'BLACKOUT',
  'FADE TO BLACK',
  'FADE UP',
  'TITLE CARD',
  'CHYRON',
  'SUBTITLE',
  'SUPERIMPOSE',
  'ULTRA-WIDE',
  'MEDIUM SHOT',
  'CLOSE UP',
  'EXTREME CLOSE UP',
  'POV',
  'OTS',
  'BIRDS EYE',
  'OVERHEAD',
]);

export const TRANSITION_PATTERN =
  /^(CUT TO|FADE TO|DISSOLVE TO|SMASH CUT TO|MATCH CUT TO|FADE IN|FADE OUT|CROSS DISSOLVE|FADE TO BLACK|TIME CUT|JUMP CUT)[:.]*\s*$/i;

export const PARENTHETICAL_PATTERN = /^\(.*\)$/;

/** Scene number prefix pattern: "1 ", "1A ", "12B " etc. */
export const SCENE_NUMBER_PATTERN = /^\d+[A-Z]?\s+/;

/** Maximum characters for a valid scene heading */
export const MAX_SCENE_HEADING_LENGTH = 140;

/** Minimum uppercase ratio for scene headings (75%) */
export const MIN_UPPERCASE_RATIO = 0.75;

/** Maximum words for a character cue */
export const MAX_CHARACTER_CUE_WORDS = 4;

/** Maximum characters for a character cue */
export const MAX_CHARACTER_CUE_LENGTH = 40;
