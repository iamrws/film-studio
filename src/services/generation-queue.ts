/**
 * Generation Queue Service
 *
 * Manages the lifecycle of video generation jobs:
 *   1. Queue shots for generation
 *   2. Submit to platform adapters (with concurrency control)
 *   3. Poll for completion
 *   4. Download results
 *   5. Track costs
 *
 * Uses a simple in-memory queue with Zustand integration for UI reactivity.
 */

import type { Shot, Generation, PlatformId } from '../types/scene';
import type { GlobalStyle } from '../types/project';
import type { Character } from '../types/character';
import type { AdapterConfig, VideoAPIAdapter } from '../adapters/base-adapter';
import { Veo3Adapter } from '../adapters/veo3-adapter';
import { Sora2Adapter } from '../adapters/sora2-adapter';
import { Kling3Adapter } from '../adapters/kling3-adapter';
import { Seedance2Adapter } from '../adapters/seedance2-adapter';
import { RunwayGen4Adapter } from '../adapters/runway-gen4-adapter';

// ─── Adapter Registry ────────────────────────────────────

const adapters: Partial<Record<PlatformId, VideoAPIAdapter>> = {
  veo3: new Veo3Adapter(),
  sora2: new Sora2Adapter(),
  kling3: new Kling3Adapter(),
  seedance2: new Seedance2Adapter(),
  runwayGen4: new RunwayGen4Adapter(),
};

export function getAdapter(platform: PlatformId): VideoAPIAdapter {
  const adapter = adapters[platform];
  if (!adapter) throw new Error(`No adapter for platform: ${platform}`);
  return adapter;
}

// ─── Queue Types ─────────────────────────────────────────

export interface QueuedJob {
  id: string;
  shot: Shot;
  platform: PlatformId;
  globalStyle: GlobalStyle;
  characters: Character[];
  status: 'queued' | 'submitting' | 'submitted' | 'polling' | 'downloading' | 'completed' | 'failed';
  generation: Generation | null;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export type QueueEventType = 'submitted' | 'progress' | 'completed' | 'failed' | 'downloaded';
export type QueueEventHandler = (job: QueuedJob, event: QueueEventType) => void;

// ─── Generation Queue ────────────────────────────────────

export class GenerationQueue {
  private jobs: Map<string, QueuedJob> = new Map();
  private activeSubmissions = 0;
  private maxConcurrent: number;
  private pollIntervalMs: number;
  private pollTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private eventHandlers: QueueEventHandler[] = [];
  private apiConfigs: Partial<Record<PlatformId, AdapterConfig>> = {};

  constructor(maxConcurrent = 3, pollIntervalMs = 10000) {
    this.maxConcurrent = maxConcurrent;
    this.pollIntervalMs = pollIntervalMs;
  }

  setApiConfig(platform: PlatformId, config: AdapterConfig): void {
    this.apiConfigs[platform] = config;
  }

  onEvent(handler: QueueEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
    };
  }

  private emit(job: QueuedJob, event: QueueEventType): void {
    for (const handler of this.eventHandlers) {
      handler(job, event);
    }
  }

  /** Add a shot to the generation queue */
  enqueue(
    shot: Shot,
    platform: PlatformId,
    globalStyle: GlobalStyle,
    characters: Character[]
  ): string {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const job: QueuedJob = {
      id,
      shot,
      platform,
      globalStyle,
      characters,
      status: 'queued',
      generation: null,
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(id, job);
    this.processQueue();
    return id;
  }

  /** Enqueue multiple shots (batch) */
  enqueueBatch(
    shots: Shot[],
    platform: PlatformId,
    globalStyle: GlobalStyle,
    characters: Character[]
  ): string[] {
    return shots.map((shot) => this.enqueue(shot, platform, globalStyle, characters));
  }

  /** Cancel a queued job (only if not yet submitted) */
  cancel(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'queued') return false;

    this.jobs.delete(jobId);
    return true;
  }

  /** Get all jobs */
  getJobs(): QueuedJob[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  /** Get job by ID */
  getJob(id: string): QueuedJob | undefined {
    return this.jobs.get(id);
  }

  /** Get queue stats */
  getStats(): {
    total: number;
    queued: number;
    active: number;
    completed: number;
    failed: number;
    totalCostUsd: number;
  } {
    const jobs = this.getJobs();
    return {
      total: jobs.length,
      queued: jobs.filter((j) => j.status === 'queued').length,
      active: jobs.filter((j) =>
        ['submitting', 'submitted', 'polling', 'downloading'].includes(j.status)
      ).length,
      completed: jobs.filter((j) => j.status === 'completed').length,
      failed: jobs.filter((j) => j.status === 'failed').length,
      totalCostUsd: jobs
        .filter((j) => j.generation)
        .reduce((sum, j) => sum + (j.generation!.costEstimate || 0), 0),
    };
  }

  /** Clear completed/failed jobs */
  clearFinished(): void {
    for (const [id, job] of this.jobs) {
      if (job.status === 'completed' || job.status === 'failed') {
        this.jobs.delete(id);
      }
    }
  }

  /** Stop all polling and clear queue */
  destroy(): void {
    for (const timer of this.pollTimers.values()) {
      clearInterval(timer);
    }
    this.pollTimers.clear();
    this.jobs.clear();
  }

  // ─── Internal ────────────────────────────────────────

  private async processQueue(): Promise<void> {
    const queued = this.getJobs().filter((j) => j.status === 'queued');

    for (const job of queued) {
      if (this.activeSubmissions >= this.maxConcurrent) break;
      await this.submitJob(job);
    }
  }

  private async submitJob(job: QueuedJob): Promise<void> {
    const config = this.apiConfigs[job.platform];
    if (!config) {
      this.updateJob(job.id, {
        status: 'failed',
        error: `No API config for platform: ${job.platform}`,
      });
      this.emit(job, 'failed');
      return;
    }

    const adapter = getAdapter(job.platform);
    this.activeSubmissions++;
    this.updateJob(job.id, { status: 'submitting' });

    try {
      const result = await adapter.submitGeneration(
        job.shot,
        job.globalStyle,
        job.characters,
        config
      );

      if (result.status === 'failed') {
        this.activeSubmissions--;
        this.updateJob(job.id, { status: 'failed', error: result.error });
        this.emit(this.jobs.get(job.id)!, 'failed');
        this.processQueue();
        return;
      }

      const generation: Generation = {
        id: crypto.randomUUID(),
        shotId: job.shot.id,
        platform: job.platform,
        status: 'submitted',
        promptUsed: adapter.renderPrompt(job.shot, job.globalStyle, job.characters),
        apiRequestId: result.apiRequestId,
        submittedAt: new Date().toISOString(),
        completedAt: null,
        outputPath: null,
        costEstimate: adapter.estimateCost(job.shot, job.globalStyle).estimatedCostUsd,
        seed: null,
        rating: null,
        notes: '',
      };

      this.updateJob(job.id, {
        status: 'submitted',
        generation,
      });
      this.emit(this.jobs.get(job.id)!, 'submitted');

      // Start polling
      this.startPolling(job.id, result.apiRequestId, config);
    } catch (err) {
      this.activeSubmissions--;
      this.updateJob(job.id, {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
      this.emit(this.jobs.get(job.id)!, 'failed');
      this.processQueue();
    }
  }

  private startPolling(
    jobId: string,
    apiRequestId: string,
    config: AdapterConfig
  ): void {
    this.updateJob(jobId, { status: 'polling' });

    const timer = setInterval(async () => {
      const job = this.jobs.get(jobId);
      if (!job || job.status === 'completed' || job.status === 'failed') {
        clearInterval(timer);
        this.pollTimers.delete(jobId);
        return;
      }

      try {
        const adapter = getAdapter(job.platform);
        const status = await adapter.checkStatus(apiRequestId, config);

        if (status.status === 'completed' && status.outputUrl) {
          clearInterval(timer);
          this.pollTimers.delete(jobId);

          this.updateJob(jobId, { status: 'downloading' });

          const outputPath = `generated/${job.platform}/${job.shot.id}_${Date.now()}.mp4`;
          try {
            await adapter.downloadResult(status.outputUrl, outputPath);
            if (job.generation) {
              job.generation.status = 'completed';
              job.generation.completedAt = new Date().toISOString();
              job.generation.outputPath = outputPath;
            }
            this.updateJob(jobId, { status: 'completed' });
            this.emit(this.jobs.get(jobId)!, 'completed');
          } catch (dlErr) {
            // Download failed but video was generated — store the URL
            if (job.generation) {
              job.generation.status = 'completed';
              job.generation.completedAt = new Date().toISOString();
              job.generation.outputPath = status.outputUrl;
            }
            this.updateJob(jobId, { status: 'completed' });
            this.emit(this.jobs.get(jobId)!, 'completed');
          }

          this.activeSubmissions--;
          this.processQueue();
        } else if (status.status === 'failed') {
          clearInterval(timer);
          this.pollTimers.delete(jobId);
          if (job.generation) {
            job.generation.status = 'failed';
          }
          this.updateJob(jobId, { status: 'failed', error: status.error });
          this.emit(this.jobs.get(jobId)!, 'failed');
          this.activeSubmissions--;
          this.processQueue();
        }
        // Otherwise, keep polling (status is 'processing')
      } catch (err) {
        // Poll error — don't fail the job, just log and retry on next interval
        console.error(`Poll error for job ${jobId}:`, err);
      }
    }, this.pollIntervalMs);

    this.pollTimers.set(jobId, timer);
  }

  private updateJob(id: string, updates: Partial<QueuedJob>): void {
    const job = this.jobs.get(id);
    if (!job) return;
    Object.assign(job, updates, { updatedAt: new Date().toISOString() });
  }
}

// ─── Singleton instance ──────────────────────────────────

export const generationQueue = new GenerationQueue();
