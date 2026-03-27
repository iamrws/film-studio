import { afterEach, describe, expect, it } from 'vitest';
import type { Character } from '../../types/character';
import type { GlobalStyle } from '../../types/project';
import type { Shot } from '../../types/scene';
import { GenerationQueue, getAdapter } from '../generation-queue';

function createShot(): Shot {
  return {
    id: 'shot-1',
    sceneId: 'scene-1',
    sequenceOrder: 1,
    durationSeconds: 6,
    prompt: {
      camera: { shotType: 'CLOSE-UP', movement: 'DOLLY IN', lens: '35MM', angle: 'EYE LEVEL' },
      subject: { description: 'A focused engineer', characters: ['alex'], action: 'Alex studies a monitor.' },
      setting: { location: 'lab', timeOfDay: 'night', weather: '', productionDesign: 'neon practicals' },
      lighting: { style: 'LOW-KEY', colorTemperature: '3200K', sources: 'desk practical' },
      style: { filmStock: 'Kodak 5219', colorGrade: 'teal and orange', era: 'modern', reference: 'thriller' },
      audio: { dialogue: [], sfx: [], ambient: '', music: '' },
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
      suspenseCalibration: { informationAsymmetry: '', outcomeProbability: 0.5 },
    },
    renderedPrompts: {
      veo3: 'veo3-optimized-prompt',
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

async function waitFor(predicate: () => boolean, timeoutMs = 800): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Condition timeout');
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe('generation queue phase-2 reliability', () => {
  const queue = new GenerationQueue();

  afterEach(() => {
    queue.destroy();
  });

  it('deduplicates active enqueue requests by idempotent submission key', () => {
    const shot = createShot();
    const globalStyle = createGlobalStyle();
    const chars: Character[] = [];

    const firstId = queue.enqueue(shot, 'veo3', globalStyle, chars);
    const secondId = queue.enqueue(shot, 'veo3', globalStyle, chars);

    expect(secondId).toBe(firstId);
    expect(queue.getJobs().length).toBe(1);
  });

  it('moves unrecoverable submission failures to dead-letter queue', async () => {
    const shot = createShot();
    const globalStyle = createGlobalStyle();
    const chars: Character[] = [];

    const adapter = getAdapter('veo3');
    const originalSubmit = adapter.submitGeneration.bind(adapter);

    try {
      adapter.submitGeneration = async () => ({
        apiRequestId: '',
        status: 'failed',
        error: 'fatal upstream error',
      });

      queue.setApiConfig('veo3', { apiKey: 'test-key', maxRetries: 0, timeoutMs: 1000 });
      const jobId = queue.enqueue(shot, 'veo3', globalStyle, chars);

      await waitFor(() => {
        const job = queue.getJob(jobId);
        return Boolean(job && job.status === 'failed');
      });

      expect(queue.getStats().deadLettered).toBe(1);
      expect(queue.getDeadLetters()[0].reason).toContain('fatal upstream error');
    } finally {
      adapter.submitGeneration = originalSubmit;
    }
  });
});
