/**
 * Generation Store - Zustand
 *
 * Manages video generation state separately from project state.
 * Bridges the GenerationQueue service with the React UI and project shots.
 */

import { create } from 'zustand';
import type { PlatformId } from '../types/scene';
import type { DeadLetterEntry, QueuedJob } from '../services/generation-queue';
import type { ProjectSettings } from '../types/project';
import { generationQueue } from '../services/generation-queue';
import { useProjectStore } from './project-store';

interface GenerationState {
  jobs: QueuedJob[];
  deadLetters: DeadLetterEntry[];
  stats: {
    total: number;
    queued: number;
    active: number;
    completed: number;
    failed: number;
    deadLettered: number;
    totalCostUsd: number;
  };
  selectedJobId: string | null;
  isPolling: boolean;

  // Actions
  refreshJobs: () => void;
  selectJob: (id: string | null) => void;
  configureApi: (platform: PlatformId, apiKey: string) => void;
  syncFromProjectSettings: (settings: ProjectSettings) => void;
  cancelJob: (id: string) => boolean;
  clearFinished: () => void;
  clearDeadLetters: () => void;
}

export const useGenerationStore = create<GenerationState>((set) => {
  // Subscribe to queue events for real-time updates and project-shot synchronization.
  generationQueue.onEvent((job, event) => {
    set({
      jobs: generationQueue.getJobs(),
      deadLetters: generationQueue.getDeadLetters(),
      stats: generationQueue.getStats(),
    });

    const projectStore = useProjectStore.getState();
    if (job.generation) {
      projectStore.upsertShotGeneration(job.shot.id, { ...job.generation });
    }

    const linkedClip = projectStore.project.bRollClips.find((clip) => clip.generationJobId === job.id);
    if (linkedClip) {
      if (event === 'submitted' || event === 'progress') {
        projectStore.updateBRollClip(linkedClip.id, { status: 'generating' });
      } else if (event === 'completed') {
        projectStore.updateBRollClip(linkedClip.id, { status: 'completed' });
      } else if (event === 'failed' || event === 'dead_lettered') {
        projectStore.updateBRollClip(linkedClip.id, { status: 'failed' });
      }
    }

    if (event === 'submitted' || event === 'progress') {
      projectStore.updateShotBoardStatus(job.shot.id, 'generating');
      return;
    }

    if (event === 'completed') {
      projectStore.updateShotBoardStatus(job.shot.id, 'review');
      return;
    }

    if (event === 'failed') {
      projectStore.updateShotBoardStatus(job.shot.id, 'ready');
    }
  });

  return {
    jobs: generationQueue.getJobs(),
    deadLetters: generationQueue.getDeadLetters(),
    stats: generationQueue.getStats(),
    selectedJobId: null,
    isPolling: false,

    refreshJobs: () =>
      set({
        jobs: generationQueue.getJobs(),
        deadLetters: generationQueue.getDeadLetters(),
        stats: generationQueue.getStats(),
      }),

    selectJob: (id) => set({ selectedJobId: id }),

    configureApi: (platform, apiKey) => {
      generationQueue.setApiConfig(platform, { apiKey });
    },

    syncFromProjectSettings: (settings) => {
      generationQueue.configureRuntime(settings.queue);

      const keyFieldByPlatform: Record<PlatformId, string> = {
        veo3: 'gemini',
        sora2: 'openai',
        kling3: 'kling',
        seedance2: 'seedance',
        runwayGen4: 'runway',
        wan22: 'wan',
      };

      (Object.keys(keyFieldByPlatform) as PlatformId[]).forEach((platform) => {
        const keyField = keyFieldByPlatform[platform];
        const apiKey = settings.apiKeys[keyField];
        if (apiKey) {
          generationQueue.setApiConfig(platform, {
            apiKey,
            timeoutMs: settings.queue.platform[platform].timeoutMs,
            maxRetries: settings.queue.platform[platform].maxRetries,
          });
        }
      });

      set({
        jobs: generationQueue.getJobs(),
        deadLetters: generationQueue.getDeadLetters(),
        stats: generationQueue.getStats(),
      });
    },

    cancelJob: (id) => {
      const ok = generationQueue.cancel(id);
      set({
        jobs: generationQueue.getJobs(),
        deadLetters: generationQueue.getDeadLetters(),
        stats: generationQueue.getStats(),
      });
      return ok;
    },

    clearFinished: () => {
      generationQueue.clearFinished();
      set({
        jobs: generationQueue.getJobs(),
        deadLetters: generationQueue.getDeadLetters(),
        stats: generationQueue.getStats(),
      });
    },

    clearDeadLetters: () => {
      generationQueue.clearDeadLetters();
      set({
        jobs: generationQueue.getJobs(),
        deadLetters: generationQueue.getDeadLetters(),
        stats: generationQueue.getStats(),
      });
    },
  };
});
