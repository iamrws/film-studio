import { describe, expect, it } from 'vitest';
import type { Shot } from '../../types/scene';
import type { GlobalStyle } from '../../types/project';
import type { Character } from '../../types/character';
import { Veo3Adapter } from '../veo3-adapter';
import { Sora2Adapter } from '../sora2-adapter';
import { Kling3Adapter } from '../kling3-adapter';
import { Seedance2Adapter } from '../seedance2-adapter';
import { RunwayGen4Adapter } from '../runway-gen4-adapter';

function createShot(): Shot {
  return {
    id: 'shot-1',
    sceneId: 'scene-1',
    sequenceOrder: 1,
    durationSeconds: 6,
    prompt: {
      camera: {
        shotType: 'CLOSE-UP',
        movement: 'DOLLY IN',
        lens: '35MM',
        angle: 'EYE LEVEL',
      },
      subject: {
        description: 'A focused engineer',
        characters: ['alex'],
        action: 'Alex studies a monitor.',
      },
      setting: {
        location: 'lab',
        timeOfDay: 'night',
        weather: '',
        productionDesign: 'neon practicals',
      },
      lighting: {
        style: 'LOW-KEY',
        colorTemperature: '3200K',
        sources: 'desk practical',
      },
      style: {
        filmStock: 'Kodak 5219',
        colorGrade: 'teal and orange',
        era: 'modern',
        reference: 'thriller',
      },
      audio: {
        dialogue: [],
        sfx: [],
        ambient: '',
        music: '',
      },
      negativePrompt: '',
    },
    psychology: {
      targetEmotion: 'focus',
      arousalLevel: 5,
      valence: 0,
      transportationCues: [],
      identificationMode: 'empathy',
      schemaRelationship: 'conforming',
      storyArcPosition: 'rising',
      suspenseCalibration: {
        informationAsymmetry: '',
        outcomeProbability: 0.5,
      },
    },
    renderedPrompts: {
      veo3: 'veo3-optimized-prompt',
      sora2: 'sora2-optimized-prompt',
      kling3: 'kling3-optimized-prompt',
      seedance2: 'seedance2-optimized-prompt',
      runwayGen4: 'runwaygen4-optimized-prompt',
      generic: 'generic-fallback',
    },
    generations: [],
    boardStatus: 'ready',
    boardOrder: 1,
    targetPlatform: 'veo3',
  };
}

function createGlobalStyle(): GlobalStyle {
  return {
    aspectRatio: '16:9',
    resolution: '1080p',
    filmStyle: 'cinematic realism',
    colorPalette: 'teal and orange',
    era: 'modern',
    defaultLens: '35MM',
    defaultLighting: 'LOW-KEY',
    globalNegativePrompt: '',
  };
}

describe('adapter prompt source parity', () => {
  it('prefers pre-rendered platform prompts over raw adapter rendering', () => {
    const shot = createShot();
    const globalStyle = createGlobalStyle();
    const characters: Character[] = [];

    const veo = new Veo3Adapter().renderPrompt(shot, globalStyle, characters);
    const sora = new Sora2Adapter().renderPrompt(shot, globalStyle, characters);
    const kling = new Kling3Adapter().renderPrompt(shot, globalStyle, characters);
    const seedance = new Seedance2Adapter().renderPrompt(shot, globalStyle, characters);
    const runway = new RunwayGen4Adapter().renderPrompt(shot, globalStyle, characters);

    expect(veo).toBe('veo3-optimized-prompt');
    expect(sora).toBe('sora2-optimized-prompt');
    expect(kling).toBe('kling3-optimized-prompt');
    expect(seedance).toBe('seedance2-optimized-prompt');
    expect(runway).toBe('runwaygen4-optimized-prompt');
  });
});
