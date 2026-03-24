/**
 * Generation Store - Zustand
 *
 * Manages video generation state separately from project state.
 * Bridges the GenerationQueue service with the React UI and project shots.
 */

import { create } from 'zustand';
import type { PlatformId } from '../types/scene';
import type { QueuedJob } from '../services/generation-queue';
import { generationQueue } from '../services/generation-queue';
import { useProjectStore } from './project-store';

interface GenerationState {
  jobs: QueuedJob[];
  stats: {
    total: number;
    queued: number;
    active: number;
    completed: number;
    failed: number;
    totalCostUsd: number;
  };
  selectedJobId: string | null;
  isPolling: boolean;

  // Actions
  refreshJobs: () => void;
  selectJob: (id: string | null) => void;
  configureApi: (platform: PlatformId, apiKey: string) => void;
  cancelJob: (id: string) => boolean;
  clearFinished: () => void;
}

export const useGenerationStore = create<GenerationState>((set) => {
  // Subscribe to queue events for real-time updates and project-shot synchronization.
  generationQueue.onEvent((job, event) => {
    set({
      jobs: generationQueue.getJobs(),
      stats: generationQueue.getStats(),
    });

    const projectStore = useProjectStore.getState();
    if (job.generation) {
      projectStore.upsertShotGeneration(job.shot.id, { ...job.generation });
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
    jobs: [],
    stats: { total: 0, queued: 0, active: 0, completed: 0, failed: 0, totalCostUsd: 0 },
    selectedJobId: null,
    isPolling: false,

    refreshJobs: () =>
      set({
        jobs: generationQueue.getJobs(),
        stats: generationQueue.getStats(),
      }),

    selectJob: (id) => set({ selectedJobId: id }),

    configureApi: (platform, apiKey) => {
      generationQueue.setApiConfig(platform, { apiKey });
    },

    cancelJob: (id) => {
      const ok = generationQueue.cancel(id);
      set({
        jobs: generationQueue.getJobs(),
        stats: generationQueue.getStats(),
      });
      return ok;
    },

    clearFinished: () => {
      generationQueue.clearFinished();
      set({
        jobs: generationQueue.getJobs(),
        stats: generationQueue.getStats(),
      });
    },
  };
});

