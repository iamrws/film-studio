/**
 * Generation Queue Service
 *
 * Reliability features:
 * - Restart recovery via local snapshot persistence
 * - Per-platform timeout/retry/backoff runtime configuration
 * - Dead-letter queue for unrecoverable failures
 * - Idempotent submission keys to prevent duplicate active jobs
 */

import type { Shot, Generation, PlatformId } from '../types/scene';
import type { GlobalStyle, QueuePlatformSettings, QueueSettings } from '../types/project';
import { createDefaultQueueSettings } from '../types/project';
import type { Character } from '../types/character';
import type { AdapterConfig, VideoAPIAdapter } from '../adapters/base-adapter';
import { Veo3Adapter } from '../adapters/veo3-adapter';
import { Sora2Adapter } from '../adapters/sora2-adapter';
import { Kling3Adapter } from '../adapters/kling3-adapter';
import { Seedance2Adapter } from '../adapters/seedance2-adapter';
import { RunwayGen4Adapter } from '../adapters/runway-gen4-adapter';

const QUEUE_SNAPSHOT_KEY = 'film-studio:generation-queue:v2';
const QUEUE_SNAPSHOT_VERSION = 2;
const MAX_DEAD_LETTERS = 200;
const MAX_POLL_DURATION_MS = 30 * 60 * 1000; // 30 minutes max poll time per job

const adapters: Partial<Record<PlatformId, VideoAPIAdapter>> = {
  veo3: new Veo3Adapter(),
  sora2: new Sora2Adapter(),
  kling3: new Kling3Adapter(),
  seedance2: new Seedance2Adapter(),
  runwayGen4: new RunwayGen4Adapter(),
};

const ACTIVE_JOB_STATUSES = ['queued', 'submitting', 'submitted', 'polling', 'downloading'] as const;

type QueueJobStatus = 'queued' | 'submitting' | 'submitted' | 'polling' | 'downloading' | 'completed' | 'failed';

interface QueueSnapshot {
  version: number;
  jobs: QueuedJob[];
  deadLetters: DeadLetterEntry[];
  runtimeSettings: QueueSettings;
}

export interface QueuedJob {
  id: string;
  shot: Shot;
  platform: PlatformId;
  globalStyle: GlobalStyle;
  characters: Character[];
  status: QueueJobStatus;
  generation: Generation | null;
  submissionKey: string;
  attemptCount: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeadLetterEntry {
  id: string;
  job: QueuedJob;
  reason: string;
  retryCount: number;
  createdAt: string;
}

export type QueueEventType = 'submitted' | 'progress' | 'completed' | 'failed' | 'downloaded' | 'dead_lettered';
export type QueueEventHandler = (job: QueuedJob, event: QueueEventType) => void;

export function getAdapter(platform: PlatformId): VideoAPIAdapter {
  const adapter = adapters[platform];
  if (!adapter) throw new Error(`No adapter for platform: ${platform}`);
  return adapter;
}

function isJobStatus(value: string): value is QueueJobStatus {
  return ['queued', 'submitting', 'submitted', 'polling', 'downloading', 'completed', 'failed'].includes(value);
}

function isRateLimitedMessage(msg: string): boolean {
  const lower = msg.toLowerCase();
  return lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('rate limit') || lower.includes('quota');
}

function toQueuePlatformSettings(raw: QueuePlatformSettings | undefined, fallback: QueuePlatformSettings): QueuePlatformSettings {
  return {
    timeoutMs: typeof raw?.timeoutMs === 'number' ? Math.max(5_000, Math.round(raw.timeoutMs)) : fallback.timeoutMs,
    maxRetries: typeof raw?.maxRetries === 'number' ? Math.max(0, Math.round(raw.maxRetries)) : fallback.maxRetries,
    baseBackoffMs: typeof raw?.baseBackoffMs === 'number' ? Math.max(1_000, Math.round(raw.baseBackoffMs)) : fallback.baseBackoffMs,
  };
}

function normalizeQueueSettings(raw: QueueSettings | undefined): QueueSettings {
  const defaults = createDefaultQueueSettings();
  return {
    maxConcurrent: typeof raw?.maxConcurrent === 'number' ? Math.max(1, Math.min(6, Math.round(raw.maxConcurrent))) : defaults.maxConcurrent,
    pollIntervalMs: typeof raw?.pollIntervalMs === 'number' ? Math.max(2_000, Math.round(raw.pollIntervalMs)) : defaults.pollIntervalMs,
    submissionDelayMs: typeof raw?.submissionDelayMs === 'number' ? Math.max(0, Math.round(raw.submissionDelayMs)) : defaults.submissionDelayMs,
    platform: {
      veo3: toQueuePlatformSettings(raw?.platform?.veo3, defaults.platform.veo3),
      sora2: toQueuePlatformSettings(raw?.platform?.sora2, defaults.platform.sora2),
      kling3: toQueuePlatformSettings(raw?.platform?.kling3, defaults.platform.kling3),
      seedance2: toQueuePlatformSettings(raw?.platform?.seedance2, defaults.platform.seedance2),
      runwayGen4: toQueuePlatformSettings(raw?.platform?.runwayGen4, defaults.platform.runwayGen4),
      wan22: toQueuePlatformSettings(raw?.platform?.wan22, defaults.platform.wan22),
    },
  };
}

export class GenerationQueue {
  private jobs: Map<string, QueuedJob> = new Map();
  private deadLetters: DeadLetterEntry[] = [];
  private activeSubmissions = 0;
  private maxConcurrent: number;
  private pollIntervalMs: number;
  private submissionDelayMs: number;
  private runtimeSettings: QueueSettings;
  private pollTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private eventHandlers: QueueEventHandler[] = [];
  private apiConfigs: Partial<Record<PlatformId, AdapterConfig>> = {};
  private isProcessing = false;

  constructor() {
    this.runtimeSettings = normalizeQueueSettings(undefined);
    this.maxConcurrent = this.runtimeSettings.maxConcurrent;
    this.pollIntervalMs = this.runtimeSettings.pollIntervalMs;
    this.submissionDelayMs = this.runtimeSettings.submissionDelayMs;
    this.restoreSnapshot();
  }

  setApiConfig(platform: PlatformId, config: AdapterConfig): void {
    this.apiConfigs[platform] = { ...config };
    this.persistSnapshot();
    void this.processQueue();
  }

  configureRuntime(settings: QueueSettings): void {
    const normalized = normalizeQueueSettings(settings);
    this.runtimeSettings = normalized;
    this.maxConcurrent = normalized.maxConcurrent;
    this.pollIntervalMs = normalized.pollIntervalMs;
    this.submissionDelayMs = normalized.submissionDelayMs;
    this.persistSnapshot();
    void this.processQueue();
  }

  onEvent(handler: QueueEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
    };
  }

  enqueue(
    shot: Shot,
    platform: PlatformId,
    globalStyle: GlobalStyle,
    characters: Character[]
  ): string {
    const submissionKey = this.buildSubmissionKey(shot, platform);
    const duplicate = this.getJobs().find(
      (job) =>
        job.submissionKey === submissionKey &&
        (ACTIVE_JOB_STATUSES as readonly QueueJobStatus[]).includes(job.status)
    );
    if (duplicate) {
      return duplicate.id;
    }

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
      submissionKey,
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(id, job);
    this.persistSnapshot();
    void this.processQueue();
    return id;
  }

  enqueueBatch(
    shots: Shot[],
    platform: PlatformId,
    globalStyle: GlobalStyle,
    characters: Character[]
  ): string[] {
    return shots.map((shot) => this.enqueue(shot, platform, globalStyle, characters));
  }

  cancel(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'queued') return false;

    this.jobs.delete(jobId);
    this.persistSnapshot();
    return true;
  }

  getJobs(): QueuedJob[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  getJob(id: string): QueuedJob | undefined {
    return this.jobs.get(id);
  }

  getDeadLetters(): DeadLetterEntry[] {
    return this.deadLetters.map((entry) => ({ ...entry }));
  }

  getStats(): {
    total: number;
    queued: number;
    active: number;
    completed: number;
    failed: number;
    deadLettered: number;
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
      deadLettered: this.deadLetters.length,
      totalCostUsd: jobs
        .filter((j) => j.generation)
        .reduce((sum, j) => sum + (j.generation?.costEstimate || 0), 0),
    };
  }

  clearFinished(): void {
    for (const [id, job] of this.jobs) {
      if (job.status === 'completed' || job.status === 'failed') {
        this.jobs.delete(id);
      }
    }
    this.persistSnapshot();
  }

  clearDeadLetters(): void {
    this.deadLetters = [];
    this.persistSnapshot();
  }

  destroy(): void {
    for (const timer of this.pollTimers.values()) {
      clearInterval(timer);
    }
    this.pollTimers.clear();
    this.jobs.clear();
    this.deadLetters = [];
    this.persistSnapshot();
  }

  private emit(job: QueuedJob, event: QueueEventType): void {
    for (const handler of this.eventHandlers) {
      handler(job, event);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const queued = this.getJobs().filter((j) => j.status === 'queued');

      for (const job of queued) {
        if (this.activeSubmissions >= this.maxConcurrent) break;
        if (!this.apiConfigs[job.platform]?.apiKey) continue;

        if (this.activeSubmissions > 0 || this.getJobs().some((j) => j.status === 'submitting')) {
          await this.delay(this.submissionDelayMs);
        }

        await this.submitJob(job);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isRateLimitError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return isRateLimitedMessage(msg);
  }

  private getPlatformRuntime(platform: PlatformId): QueuePlatformSettings {
    return this.runtimeSettings.platform[platform] ?? createDefaultQueueSettings().platform[platform];
  }

  private getEffectiveConfig(platform: PlatformId, base: AdapterConfig): AdapterConfig {
    const runtime = this.getPlatformRuntime(platform);
    return {
      ...base,
      timeoutMs: base.timeoutMs ?? runtime.timeoutMs,
      maxRetries: base.maxRetries ?? runtime.maxRetries,
    };
  }

  private async submitJob(job: QueuedJob, retryCount = 0): Promise<void> {
    const baseConfig = this.apiConfigs[job.platform];
    if (!baseConfig?.apiKey) {
      this.updateJob(job.id, {
        status: 'queued',
        error: `Waiting for API key/config for ${job.platform}.`,
      });
      return;
    }

    const runtime = this.getPlatformRuntime(job.platform);
    const effectiveConfig = this.getEffectiveConfig(job.platform, baseConfig);
    const maxRetries = effectiveConfig.maxRetries ?? runtime.maxRetries;

    const adapter = getAdapter(job.platform);
    this.activeSubmissions++;
    this.updateJob(job.id, {
      status: 'submitting',
      error: undefined,
      attemptCount: retryCount + 1,
    });

    try {
      const result = await adapter.submitGeneration(
        job.shot,
        job.globalStyle,
        job.characters,
        effectiveConfig
      );

      if (result.status === 'failed') {
        if (this.isRateLimitError(result.error || '') && retryCount < maxRetries) {
          this.activeSubmissions = Math.max(0, this.activeSubmissions - 1);
          const backoff = Math.pow(2, retryCount) * runtime.baseBackoffMs;
          this.updateJob(job.id, {
            status: 'queued',
            error: `Rate limited; retrying in ${Math.round(backoff / 1000)}s...`,
          });
          this.emit(this.jobs.get(job.id)!, 'progress');
          await this.delay(backoff);
          return this.submitJob(job, retryCount + 1);
        }

        this.activeSubmissions = Math.max(0, this.activeSubmissions - 1);
        this.moveToDeadLetter(job.id, result.error || 'Submission failed', retryCount);
        void this.processQueue();
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

      this.startPolling(job.id, result.apiRequestId, effectiveConfig);
    } catch (err) {
      if (this.isRateLimitError(err) && retryCount < maxRetries) {
        this.activeSubmissions = Math.max(0, this.activeSubmissions - 1);
        const backoff = Math.pow(2, retryCount) * runtime.baseBackoffMs;
        this.updateJob(job.id, {
          status: 'queued',
          error: `Rate limited; retrying in ${Math.round(backoff / 1000)}s...`,
        });
        this.emit(this.jobs.get(job.id)!, 'progress');
        await this.delay(backoff);
        return this.submitJob(job, retryCount + 1);
      }

      this.activeSubmissions = Math.max(0, this.activeSubmissions - 1);
      this.moveToDeadLetter(
        job.id,
        err instanceof Error ? err.message : String(err),
        retryCount
      );
      void this.processQueue();
    }
  }

  private startPolling(
    jobId: string,
    apiRequestId: string,
    config: AdapterConfig
  ): void {
    this.updateJob(jobId, { status: 'polling' });

    const existing = this.pollTimers.get(jobId);
    if (existing) {
      clearInterval(existing);
      this.pollTimers.delete(jobId);
    }

    const pollStartedAt = Date.now();

    const timer = setInterval(async () => {
      const job = this.jobs.get(jobId);
      if (!job || job.status === 'completed' || job.status === 'failed') {
        clearInterval(timer);
        this.pollTimers.delete(jobId);
        return;
      }

      // Fail jobs that have been polling for too long
      if (Date.now() - pollStartedAt > MAX_POLL_DURATION_MS) {
        clearInterval(timer);
        this.pollTimers.delete(jobId);
        this.activeSubmissions = Math.max(0, this.activeSubmissions - 1);
        this.moveToDeadLetter(jobId, 'Polling timed out after 30 minutes', job.attemptCount);
        void this.processQueue();
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
            await adapter.downloadResult(status.outputUrl, outputPath, config);
            if (job.generation) {
              job.generation.status = 'completed';
              job.generation.completedAt = new Date().toISOString();
              job.generation.outputPath = outputPath;
            }
            this.updateJob(jobId, { status: 'completed', error: undefined });
            this.emit(this.jobs.get(jobId)!, 'completed');
          } catch (downloadErr) {
            // Download to local disk failed — fall back to the remote CDN URL so the
            // video is still playable, but surface a warning so the user knows the
            // file was not saved locally (CDN links may expire).
            const downloadErrMsg = downloadErr instanceof Error ? downloadErr.message : String(downloadErr);
            console.warn(`[GenerationQueue] Local download failed for job ${jobId}; using remote URL as fallback. Reason: ${downloadErrMsg}`);
            if (job.generation) {
              job.generation.status = 'completed';
              job.generation.completedAt = new Date().toISOString();
              job.generation.outputPath = status.outputUrl;
            }
            this.updateJob(jobId, {
              status: 'completed',
              error: `Download to disk failed (${downloadErrMsg}). Video available at remote URL — save it manually before the link expires.`,
            });
            this.emit(this.jobs.get(jobId)!, 'completed');
          }

          this.activeSubmissions = Math.max(0, this.activeSubmissions - 1);
          void this.processQueue();
        } else if (status.status === 'failed') {
          clearInterval(timer);
          this.pollTimers.delete(jobId);
          this.activeSubmissions = Math.max(0, this.activeSubmissions - 1);
          this.moveToDeadLetter(jobId, status.error || 'Polling failed', job.attemptCount);
          void this.processQueue();
        } else {
          this.emit(this.jobs.get(jobId)!, 'progress');
        }
      } catch (err) {
        // Keep polling on transient polling errors.
        console.error(`Poll error for job ${jobId}:`, err);
      }
    }, this.pollIntervalMs);

    this.pollTimers.set(jobId, timer);
  }

  private updateJob(id: string, updates: Partial<QueuedJob>): void {
    const job = this.jobs.get(id);
    if (!job) return;
    Object.assign(job, updates, { updatedAt: new Date().toISOString() });
    this.persistSnapshot();
  }

  private moveToDeadLetter(jobId: string, reason: string, retryCount: number): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    if (job.generation) {
      job.generation.status = 'failed';
    }

    this.updateJob(jobId, {
      status: 'failed',
      error: reason,
    });

    const latestJob = this.jobs.get(jobId);
    if (!latestJob) return;

    const deadLetter: DeadLetterEntry = {
      id: crypto.randomUUID(),
      job: this.cloneJob(latestJob),
      reason,
      retryCount,
      createdAt: new Date().toISOString(),
    };

    this.deadLetters.unshift(deadLetter);
    if (this.deadLetters.length > MAX_DEAD_LETTERS) {
      this.deadLetters = this.deadLetters.slice(0, MAX_DEAD_LETTERS);
    }
    this.persistSnapshot();

    this.emit(latestJob, 'failed');
    this.emit(latestJob, 'dead_lettered');
  }

  private buildSubmissionKey(shot: Shot, platform: PlatformId): string {
    const promptKey = platform === 'wan22' ? 'wan' : platform;
    const promptText = (
      shot.renderedPrompts[promptKey] ||
      shot.renderedPrompts.generic ||
      shot.prompt.subject.action ||
      ''
    ).trim();
    const promptHash = this.hashString(promptText);
    return `${platform}:${shot.id}:${shot.durationSeconds}:${promptHash}`;
  }

  private hashString(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16);
  }

  private cloneJob(job: QueuedJob): QueuedJob {
    return JSON.parse(JSON.stringify(job)) as QueuedJob;
  }

  private persistSnapshot(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const payload: QueueSnapshot = {
        version: QUEUE_SNAPSHOT_VERSION,
        jobs: this.getJobs(),
        deadLetters: this.deadLetters,
        runtimeSettings: this.runtimeSettings,
      };
      localStorage.setItem(QUEUE_SNAPSHOT_KEY, JSON.stringify(payload));
    } catch {
      // Ignore persistence failures and keep queue running in memory.
    }
  }

  private restoreSnapshot(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(QUEUE_SNAPSHOT_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<QueueSnapshot>;
      if (parsed.version !== QUEUE_SNAPSHOT_VERSION) return;

      this.runtimeSettings = normalizeQueueSettings(parsed.runtimeSettings as QueueSettings | undefined);
      this.maxConcurrent = this.runtimeSettings.maxConcurrent;
      this.pollIntervalMs = this.runtimeSettings.pollIntervalMs;
      this.submissionDelayMs = this.runtimeSettings.submissionDelayMs;

      const restoredJobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
      for (const rawJob of restoredJobs) {
        const rawStatus = typeof rawJob.status === 'string' ? rawJob.status : 'queued';
        const status: QueueJobStatus = isJobStatus(rawStatus) ? rawStatus : 'queued';
        const recoveredStatus: QueueJobStatus = ['submitting', 'submitted', 'polling', 'downloading'].includes(status)
          ? 'queued'
          : status;

        const restored: QueuedJob = {
          ...rawJob,
          status: recoveredStatus,
          submissionKey: rawJob.submissionKey || this.buildSubmissionKey(rawJob.shot, rawJob.platform),
          attemptCount: typeof rawJob.attemptCount === 'number' ? rawJob.attemptCount : 0,
          error: recoveredStatus === 'queued' && status !== 'queued'
            ? 'Recovered after restart; awaiting resume.'
            : rawJob.error,
          createdAt: rawJob.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (restored.generation && recoveredStatus === 'queued' && restored.generation.status !== 'completed') {
          restored.generation = {
            ...restored.generation,
            status: 'queued',
          };
        }

        this.jobs.set(restored.id, restored);
      }

      const restoredDeadLetters = Array.isArray(parsed.deadLetters) ? parsed.deadLetters : [];
      this.deadLetters = restoredDeadLetters.slice(0, MAX_DEAD_LETTERS);
    } catch {
      // Ignore restore failures and continue with an empty queue.
    }
  }
}

export const generationQueue = new GenerationQueue();
