import { describe, it, expect } from 'vitest';
import {
  CAMERA_SHOT_TYPES,
  CAMERA_SHOT_TYPE_SET,
  CAMERA_MOVEMENTS,
  CAMERA_MOVEMENT_SET,
  CAMERA_ANGLES,
  CAMERA_ANGLE_SET,
  LENS_TERMS,
  LENS_TERM_SET,
  LIGHTING_STYLES,
  LIGHTING_STYLE_SET,
  normalizeCameraShotType,
  normalizeCameraMovement,
  normalizeCameraAngle,
  normalizeLens,
  normalizeLightingStyle,
} from '../cinematography-vocabulary';

describe('cinematography vocabulary collections', () => {
  it('exports non-empty controlled vocab arrays and sets', () => {
    expect(CAMERA_SHOT_TYPES.length).toBeGreaterThan(0);
    expect(CAMERA_MOVEMENTS.length).toBeGreaterThan(0);
    expect(CAMERA_ANGLES.length).toBeGreaterThan(0);
    expect(LENS_TERMS.length).toBeGreaterThan(0);
    expect(LIGHTING_STYLES.length).toBeGreaterThan(0);

    expect(CAMERA_SHOT_TYPE_SET.has('CLOSE-UP')).toBe(true);
    expect(CAMERA_SHOT_TYPE_SET.has('AERIAL SHOT')).toBe(true);
    expect(CAMERA_MOVEMENT_SET.has('DOLLY IN')).toBe(true);
    expect(CAMERA_MOVEMENT_SET.has('DOLLY ZOOM')).toBe(true);
    expect(CAMERA_ANGLE_SET.has("BIRD'S-EYE VIEW")).toBe(true);
    expect(CAMERA_ANGLE_SET.has("WORM'S-EYE VIEW")).toBe(true);
    expect(LENS_TERM_SET.has('35MM')).toBe(true);
    expect(LENS_TERM_SET.has('TILT-SHIFT')).toBe(true);
    expect(LIGHTING_STYLE_SET.has('LOW-KEY')).toBe(true);
    expect(LIGHTING_STYLE_SET.has('REMBRANDT')).toBe(true);
  });
});

describe('normalizeCameraShotType', () => {
  it('normalizes common aliases to canonical shot types', () => {
    expect(normalizeCameraShotType('close up')).toBe('CLOSE-UP');
    expect(normalizeCameraShotType('extreme close up')).toBe('EXTREME CLOSE-UP');
    expect(normalizeCameraShotType('over the shoulder')).toBe('OVER-THE-SHOULDER');
    expect(normalizeCameraShotType('pov')).toBe('POINT OF VIEW');
    expect(normalizeCameraShotType('aerial')).toBe('AERIAL SHOT');
  });

  it('preserves unknown values with uppercase formatting only', () => {
    expect(normalizeCameraShotType('  hero profile shot  ')).toBe('HERO PROFILE SHOT');
  });
});

describe('normalizeCameraMovement', () => {
  it('normalizes common aliases to canonical camera movements', () => {
    expect(normalizeCameraMovement('push in')).toBe('DOLLY IN');
    expect(normalizeCameraMovement('pull back')).toBe('DOLLY OUT');
    expect(normalizeCameraMovement('hand held')).toBe('HANDHELD');
    expect(normalizeCameraMovement('whip pan')).toBe('WHIP PAN');
    expect(normalizeCameraMovement('vertigo effect')).toBe('DOLLY ZOOM');
    expect(normalizeCameraMovement('swish pan')).toBe('WHIP PAN');
    expect(normalizeCameraMovement('truck left')).toBe('TRUCK LEFT');
    expect(normalizeCameraMovement('rack focus')).toBe('RACK FOCUS');
  });

  it('preserves unknown values with uppercase formatting only', () => {
    expect(normalizeCameraMovement('  floating drift  ')).toBe('FLOATING DRIFT');
  });
});

describe('normalizeCameraAngle', () => {
  it('normalizes common aliases to canonical camera angles', () => {
    expect(normalizeCameraAngle('birds eye')).toBe("BIRD'S-EYE VIEW");
    expect(normalizeCameraAngle('birds-eye')).toBe("BIRD'S-EYE VIEW");
    expect(normalizeCameraAngle('top-down')).toBe("BIRD'S-EYE VIEW");
    expect(normalizeCameraAngle('worms eye view')).toBe("WORM'S-EYE VIEW");
    expect(normalizeCameraAngle('low angle')).toBe('LOW ANGLE');
    expect(normalizeCameraAngle('dutch angle')).toBe('DUTCH ANGLE');
  });

  it('preserves unknown values with uppercase formatting only', () => {
    expect(normalizeCameraAngle('  canted horizon  ')).toBe('CANTED HORIZON');
  });
});

describe('normalizeLens', () => {
  it('normalizes common lens aliases to canonical lens terms', () => {
    expect(normalizeLens('35 mm')).toBe('35MM');
    expect(normalizeLens('50mm lens')).toBe('50MM');
    expect(normalizeLens('wide angle')).toBe('WIDE-ANGLE');
    expect(normalizeLens('tele')).toBe('TELEPHOTO');
    expect(normalizeLens('14 mm')).toBe('14MM');
    expect(normalizeLens('tilt shift')).toBe('TILT-SHIFT');
  });

  it('preserves unknown values with uppercase formatting only', () => {
    expect(normalizeLens('  vintage prime  ')).toBe('VINTAGE PRIME');
  });
});

describe('normalizeLightingStyle', () => {
  it('normalizes common lighting aliases to canonical terms', () => {
    expect(normalizeLightingStyle('high key')).toBe('HIGH-KEY');
    expect(normalizeLightingStyle('rim light')).toBe('RIM LIGHTING');
    expect(normalizeLightingStyle('three point')).toBe('THREE-POINT');
    expect(normalizeLightingStyle('butterfly')).toBe('BUTTERFLY');
  });

  it('preserves unknown values with uppercase formatting only', () => {
    expect(normalizeLightingStyle(' moonbounce ambience ')).toBe('MOONBOUNCE AMBIENCE');
  });
});
