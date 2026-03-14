import { describe, it, expect } from 'vitest';
import {
  CAMERA_EMOTION_MAP,
  COLOR_VALENCE_MAP,
  AROUSAL_PACE_MAP,
  GENRE_SCHEMAS,
  EMBODIED_SIMULATION_CUES,
  NOSTALGIA_TRIGGERS,
  STORY_SHAPE_TREATMENTS,
} from '../psychology-rules';

// ─── Camera-to-Emotion Map ───────────────────────────────

describe('CAMERA_EMOTION_MAP', () => {
  it('contains all primary emotions', () => {
    const expectedEmotions = [
      'empathy', 'fear', 'joy', 'tension', 'sadness',
      'power', 'vulnerability', 'hope', 'surprise', 'isolation',
    ];
    for (const emotion of expectedEmotions) {
      expect(CAMERA_EMOTION_MAP).toHaveProperty(emotion);
    }
  });

  it('each emotion has valid shot types, movements, angles, and rationale', () => {
    for (const [, config] of Object.entries(CAMERA_EMOTION_MAP)) {
      expect(config.shotTypes.length).toBeGreaterThan(0);
      expect(config.movements.length).toBeGreaterThan(0);
      expect(config.angles.length).toBeGreaterThan(0);
      expect(config.rationale.length).toBeGreaterThan(0);
    }
  });

  it('empathy maps to close-up shot types (Gallese 2012)', () => {
    const empathy = CAMERA_EMOTION_MAP['empathy'];
    expect(empathy.shotTypes).toContain('CLOSE-UP');
    expect(empathy.rationale).toContain('Gallese');
  });

  it('fear includes dutch angle (schema instability)', () => {
    const fear = CAMERA_EMOTION_MAP['fear'];
    expect(fear.angles).toContain('DUTCH ANGLE');
  });

  it('power maps to low angle (dominance schema)', () => {
    const power = CAMERA_EMOTION_MAP['power'];
    expect(power.angles).toContain('LOW ANGLE');
  });

  it('isolation maps to extreme wide shots', () => {
    const isolation = CAMERA_EMOTION_MAP['isolation'];
    expect(isolation.shotTypes).toContain('EXTREME WIDE');
  });
});

// ─── Color-to-Valence Map ─────────────────────────────────

describe('COLOR_VALENCE_MAP', () => {
  it('contains all valence states', () => {
    const expectedStates = ['warm_safe', 'nostalgic', 'neutral', 'alienation', 'threat', 'dream'];
    for (const state of expectedStates) {
      expect(COLOR_VALENCE_MAP).toHaveProperty(state);
    }
  });

  it('warm_safe uses tungsten color temperature', () => {
    expect(COLOR_VALENCE_MAP['warm_safe'].colorTemp).toContain('3200K');
  });

  it('threat uses cool blue temperature', () => {
    expect(COLOR_VALENCE_MAP['threat'].colorTemp).toContain('6500K');
  });

  it('nostalgic references golden hour', () => {
    expect(COLOR_VALENCE_MAP['nostalgic'].colorTemp).toContain('golden hour');
  });

  it('each state has all required fields', () => {
    for (const [, config] of Object.entries(COLOR_VALENCE_MAP)) {
      expect(config.colorTemp).toBeTruthy();
      expect(config.colorGrade).toBeTruthy();
      expect(config.filmStock).toBeTruthy();
    }
  });
});

// ─── Arousal-to-Pace Map ──────────────────────────────────

describe('AROUSAL_PACE_MAP', () => {
  it('covers arousal levels 1-10', () => {
    for (let i = 1; i <= 10; i++) {
      expect(AROUSAL_PACE_MAP).toHaveProperty(String(i));
    }
  });

  it('shot duration decreases with higher arousal', () => {
    const low = AROUSAL_PACE_MAP[1].avgShotDuration;
    const high = AROUSAL_PACE_MAP[10].avgShotDuration;
    expect(low).toBeGreaterThan(high);
  });

  it('movement intensity increases with arousal', () => {
    expect(AROUSAL_PACE_MAP[1].movementIntensity).toBe('minimal');
    expect(AROUSAL_PACE_MAP[10].movementIntensity).toBe('frenetic');
  });

  it('cut style becomes more aggressive at high arousal', () => {
    expect(AROUSAL_PACE_MAP[1].cutStyle).toContain('long takes');
    expect(AROUSAL_PACE_MAP[10].cutStyle).toContain('staccato');
  });
});

// ─── Genre Schemas ────────────────────────────────────────

describe('GENRE_SCHEMAS', () => {
  it('contains all major genres', () => {
    const genres = ['horror', 'drama', 'thriller', 'comedy', 'scifi', 'period'];
    for (const genre of genres) {
      expect(GENRE_SCHEMAS).toHaveProperty(genre);
    }
  });

  it('each genre has all required fields', () => {
    for (const [, schema] of Object.entries(GENRE_SCHEMAS)) {
      expect(schema.dominantEmotions.length).toBeGreaterThan(0);
      expect(schema.lightingDefaults).toBeTruthy();
      expect(schema.cameraDefaults).toBeTruthy();
      expect(schema.colorDefaults).toBeTruthy();
      expect(schema.audioDefaults).toBeTruthy();
      expect(schema.schemaConventions.length).toBeGreaterThan(0);
    }
  });

  it('horror dominant emotions include fear', () => {
    expect(GENRE_SCHEMAS['horror'].dominantEmotions).toContain('fear');
  });

  it('drama dominant emotions include empathy', () => {
    expect(GENRE_SCHEMAS['drama'].dominantEmotions).toContain('empathy');
  });

  it('thriller references suspense theory', () => {
    const conventions = GENRE_SCHEMAS['thriller'].schemaConventions.join(' ');
    expect(conventions).toContain('suspense');
  });

  it('period references nostalgia (Sedikides)', () => {
    const conventions = GENRE_SCHEMAS['period'].schemaConventions.join(' ');
    expect(conventions).toContain('nostalgia');
  });
});

// ─── Embodied Simulation Cues ─────────────────────────────

describe('EMBODIED_SIMULATION_CUES', () => {
  it('has face, body, and sensation categories', () => {
    expect(EMBODIED_SIMULATION_CUES).toHaveProperty('face');
    expect(EMBODIED_SIMULATION_CUES).toHaveProperty('body');
    expect(EMBODIED_SIMULATION_CUES).toHaveProperty('sensation');
  });

  it('each category has multiple cues', () => {
    expect(EMBODIED_SIMULATION_CUES.face.length).toBeGreaterThan(5);
    expect(EMBODIED_SIMULATION_CUES.body.length).toBeGreaterThan(5);
    expect(EMBODIED_SIMULATION_CUES.sensation.length).toBeGreaterThan(5);
  });

  it('face cues describe visible micro-expressions', () => {
    const allFace = EMBODIED_SIMULATION_CUES.face.join(' ');
    // Should reference specific facial features
    expect(allFace).toMatch(/jaw|eyes|mouth|brow|lips|cheek|chin|gaze/);
  });

  it('body cues describe observable physical states', () => {
    const allBody = EMBODIED_SIMULATION_CUES.body.join(' ');
    expect(allBody).toMatch(/shoulder|hand|finger|chest|spine|arm/);
  });

  it('sensation cues include sensory details for transportation', () => {
    const allSensation = EMBODIED_SIMULATION_CUES.sensation.join(' ');
    expect(allSensation).toMatch(/rain|cold|warmth|wind|sweat/);
  });
});

// ─── Story Shape Treatments ──────────────────────────────

describe('STORY_SHAPE_TREATMENTS', () => {
  it('covers all 6 Reagan et al. story shapes', () => {
    const shapes = ['rags_to_riches', 'tragedy', 'man_in_a_hole', 'icarus', 'cinderella', 'oedipus'];
    for (const shape of shapes) {
      expect(STORY_SHAPE_TREATMENTS).toHaveProperty(shape);
    }
  });

  it('each shape has complete visual treatment', () => {
    for (const [, treatment] of Object.entries(STORY_SHAPE_TREATMENTS)) {
      expect(treatment.description).toBeTruthy();
      expect(treatment.lightingProgression).toBeTruthy();
      expect(treatment.colorProgression).toBeTruthy();
      expect(treatment.framingProgression).toBeTruthy();
      expect(treatment.musicProgression).toBeTruthy();
    }
  });

  it('rags_to_riches ends bright (emotional rise)', () => {
    const treatment = STORY_SHAPE_TREATMENTS['rags_to_riches'];
    expect(treatment.lightingProgression).toContain('golden');
  });

  it('tragedy ends dark (emotional fall)', () => {
    const treatment = STORY_SHAPE_TREATMENTS['tragedy'];
    expect(treatment.lightingProgression).toContain('dark');
  });
});

// ─── Nostalgia Triggers ───────────────────────────────────

describe('NOSTALGIA_TRIGGERS', () => {
  it('covers decades from 1950s to 2010s', () => {
    const decades = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s'];
    for (const decade of decades) {
      expect(NOSTALGIA_TRIGGERS).toHaveProperty(decade);
    }
  });

  it('each decade has all trigger categories', () => {
    for (const [, triggers] of Object.entries(NOSTALGIA_TRIGGERS)) {
      expect(triggers.musicStyle).toBeTruthy();
      expect(triggers.filmStock).toBeTruthy();
      expect(triggers.colorPalette).toBeTruthy();
      expect(triggers.productionDesignCues.length).toBeGreaterThan(0);
    }
  });

  it('1980s includes synth-pop and neon (era-appropriate)', () => {
    const eighties = NOSTALGIA_TRIGGERS['1980s'];
    expect(eighties.musicStyle).toContain('synth');
    expect(eighties.colorPalette).toContain('neon');
  });
});
