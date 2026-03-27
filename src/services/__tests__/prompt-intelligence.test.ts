import { describe, expect, it } from 'vitest';
import { analyzePromptForPlatform, optimizePromptForPlatform } from '../prompt-intelligence';
import type { GlobalStyle } from '../../types/project';
import type { Shot } from '../../types/scene';

function createShot(): Shot {
  return {
    id: 'shot-1',
    sceneId: 'scene-1',
    sequenceOrder: 1,
    durationSeconds: 12,
    prompt: {
      camera: {
        shotType: 'CLOSE-UP',
        movement: 'slow push in',
        lens: '35mm',
        angle: 'eye level',
      },
      subject: {
        description: 'A young woman in a red coat',
        characters: ['sarah'],
        action: 'She taps her fingers against the table and checks the door.',
      },
      setting: {
        location: 'diner booth',
        timeOfDay: 'night',
        weather: 'rain outside',
        productionDesign: 'neon reflections on chrome',
      },
      lighting: {
        style: 'high-key',
        colorTemperature: '5600K',
        sources: 'practical overhead fluorescents',
      },
      style: {
        filmStock: 'Kodak 5219',
        colorGrade: 'cool blue',
        era: 'modern',
        reference: 'Michael Mann',
      },
      audio: {
        dialogue: [
          {
            characterId: 'sarah',
            characterName: 'Sarah',
            text: 'Are you coming?',
          },
        ],
        sfx: ['rain on window'],
        ambient: 'distant traffic',
        music: 'low synth pulse',
      },
      negativePrompt: 'blurry, low quality, distorted faces',
    },
    psychology: {
      targetEmotion: 'tension',
      arousalLevel: 0.6,
      valence: -0.2,
      transportationCues: ['The room feels close and tense.'],
      identificationMode: 'empathy',
      schemaRelationship: 'conforming',
      storyArcPosition: 'rising',
      suspenseCalibration: {
        informationAsymmetry: 'moderate',
        outcomeProbability: 0.4,
      },
    },
    renderedPrompts: {
      generic: '',
    },
    generations: [],
    boardStatus: 'ready',
    boardOrder: 0,
    targetPlatform: 'veo3',
  };
}

function createGlobalStyle(): GlobalStyle {
  return {
    aspectRatio: '16:9',
    resolution: '1080p',
    filmStyle: 'cinematic realism',
    colorPalette: 'steel and amber',
    era: 'modern',
    defaultLens: '35mm',
    defaultLighting: 'soft practicals',
    globalNegativePrompt: 'blurry, low quality, distorted faces',
  };
}

describe('prompt intelligence scoring', () => {
  it('returns a score derived from the explicit weighted formula', () => {
    const shot = createShot();
    const prompt = [
      'A close-up of Sarah at a diner booth at night, slow push in, 35mm lens, eye level.',
      'She taps her fingers against the table and checks the door while rain hits the window.',
      'High-key practical overhead fluorescents light neon reflections on chrome.',
      'Style: Kodak 5219, cool blue, modern cinematic realism, Michael Mann.',
      'Audio: Sarah says, "Are you coming?" SFX: rain on window. Ambient noise: distant traffic. Music: low synth pulse.',
    ].join(' ');

    const report = analyzePromptForPlatform(shot, 'veo3', prompt);
    const expected = (
      0.30 * report.breakdown.coverage +
      0.25 * report.breakdown.specificity +
      0.20 * report.breakdown.consistency +
      0.15 * report.breakdown.platformFit +
      0.10 * report.breakdown.temporalCoherence
    );
    const expectedRounded = Math.round(expected * 10) / 10;

    expect(report.formula).toBe('score = 0.30*coverage + 0.25*specificity + 0.20*consistency + 0.15*platformFit + 0.10*temporalCoherence');
    expect(report.score).toBeCloseTo(expectedRounded, 5);
    expect(report.breakdown.coverage).toBeGreaterThan(80);
    expect(report.breakdown.consistency).toBe(100);
  });

  it('detects basic contradictions and reports them as issues', () => {
    const shot = createShot();
    const prompt = 'Static shot with a whip pan from a fisheye lens to telephoto, deep focus and shallow depth of field, high-key and low-key lighting.';

    const report = analyzePromptForPlatform(shot, 'veo3', prompt);
    const issueCodes = report.issues.map((issue) => issue.code);

    expect(issueCodes).toContain('static_whip_pan');
    expect(issueCodes).toContain('fisheye_telephoto');
    expect(issueCodes).toContain('deep_focus_shallow_dof');
    expect(issueCodes).toContain('high_key_low_key');
    expect(report.breakdown.consistency).toBeLessThan(100);
  });
});

describe('prompt intelligence platform fit', () => {
  it('prefers Veo prompts near 120-180 words and concise Runway prompts', () => {
    const shot = createShot();

    const veoPromptLong = [
      'Close-up framing on Sarah in a red coat at a chrome diner booth at night, slow push in with a 35mm lens at eye level.',
      'She taps the table edge, scans the doorway, and checks the rain-streaked window while neon reflections pulse across steel surfaces.',
      'Setting details include wet pavement outside, soft steam from coffee, and practical overhead fluorescents motivated by the diner fixtures.',
      'Lighting is high-key with 5600K practical sources and subtle rim bounce from signage, preserving clear facial detail and controlled contrast.',
      'Style cues: Kodak 5219 texture, cool blue grade, modern crime-drama mood, Michael Mann influence, precise movement continuity and one unbroken shot.',
      'Audio: Sarah says, "Are you coming?" SFX: rain on window, distant traffic, low synth pulse.',
    ].join(' ');

    const veoPromptShort = 'Close-up of Sarah in a diner.';
    const runwayPromptShort = 'Sarah sprints through the diner hallway as the camera glides after her.';
    const runwayPromptVerbose = [
      'Cinematography: close-up with 35mm lens and highly detailed lighting specification.',
      'Dialogue: Sarah says, "Are you coming?"',
      'Background Sound: neon hum, rain, traffic, music.',
      'Actions: she moves quickly while the camera tracks and orbits with a complex multi-stage blocking description.',
    ].join(' ');

    const veoFitLong = analyzePromptForPlatform(shot, 'veo3', veoPromptLong).breakdown.platformFit;
    const veoFitShort = analyzePromptForPlatform(shot, 'veo3', veoPromptShort).breakdown.platformFit;
    const runwayFitShort = analyzePromptForPlatform(shot, 'runwayGen4', runwayPromptShort).breakdown.platformFit;
    const runwayFitVerbose = analyzePromptForPlatform(shot, 'runwayGen4', runwayPromptVerbose).breakdown.platformFit;

    expect(veoFitLong).toBeGreaterThan(veoFitShort);
    expect(runwayFitShort).toBeGreaterThan(runwayFitVerbose);
  });
});

describe('prompt optimization rewrite', () => {
  it('replaces vague nervousness with visible action cues', () => {
    const shot = createShot();
    const globalStyle = createGlobalStyle();

    const optimized = optimizePromptForPlatform({
      platform: 'runwayGen4',
      prompt: 'He looks nervous in the hallway.',
      shot,
      globalStyle,
    });

    expect(optimized.toLowerCase()).not.toContain('looks nervous');
    expect(optimized).toMatch(/taps fingers|shifts weight|glances toward the doorway/i);
  });

  it('formats wan prompts with timing brackets and budget limits', () => {
    const shot = createShot();
    const globalStyle = createGlobalStyle();

    const optimized = optimizePromptForPlatform({
      platform: 'wan',
      prompt: 'A cinematic shot of a woman in a diner.',
      shot,
      globalStyle,
    });

    expect(optimized).toMatch(/^\[0-12s\]/);
    expect(optimized.length).toBeLessThanOrEqual(800);
  });

  it('injects kling-specific speaker tags and motion endpoints', () => {
    const shot = createShot();
    const globalStyle = createGlobalStyle();

    const optimized = optimizePromptForPlatform({
      platform: 'kling3',
      prompt: 'A tense close-up in a diner.',
      shot,
      globalStyle,
    });

    expect(optimized).toMatch(/\[Speaker:\s*Sarah\]/i);
    expect(optimized).toMatch(/settles back into place|comes to rest|holds at end/i);
  });
});

describe('prompt intelligence linting', () => {
  it('flags negative motion directives and multi-scene phrasing', () => {
    const shot = createShot();
    const prompt = 'Scene 1: no camera movement, cinematic lighting, then cut to Scene 2 where Sarah runs outside.';

    const report = analyzePromptForPlatform(shot, 'runwayGen4', prompt);
    const issueCodes = report.issues.map((issue) => issue.code);

    expect(issueCodes).toContain('negative_motion_directive');
    expect(issueCodes).toContain('multi_scene_single_shot');
    expect(issueCodes).toContain('vague_lighting_only');
  });

  it('uses dedicated hailuo checks for fast-subject plus fast-camera conflicts', () => {
    const shot = createShot();
    const riskyPrompt = 'She sprints through the corridor as the camera does a whip pan and crash zoom, intense expression and trembling breath.';
    const saferPrompt = 'She hesitates and breathes deeply while the camera makes a slow push in to her eyes.';

    const risky = analyzePromptForPlatform(shot, 'hailuo', riskyPrompt);
    const safer = analyzePromptForPlatform(shot, 'hailuo', saferPrompt);

    expect(risky.issues.map((issue) => issue.code)).toContain('hailuo_fast_subject_camera_conflict');
    expect(safer.breakdown.platformFit).toBeGreaterThan(risky.breakdown.platformFit);
  });
});
