/**
 * Seedance 2.0 Adapter — ByteDance API
 *
 * Seedance uses compressed prompts (30-100 words) with @Tag asset referencing.
 * Known for dance/motion-heavy generation with strong character consistency.
 *
 * API flow:
 *   1. POST /v2/video/generate → returns task ID
 *   2. GET /v2/video/task/{id} → poll for status
 *   3. Download from returned URL
 */

import type { Shot } from '../types/scene';
import type { GlobalStyle } from '../types/project';
import type { Character } from '../types/character';
import type {
  VideoAPIAdapter,
  SubmissionResult,
  StatusResult,
  CostEstimate,
  AdapterConfig,
} from './base-adapter';
import { renderSeedance2Prompt } from '../services/prompt-renderer';

const SEEDANCE_API_BASE = 'https://api.seedance.ai';

export class Seedance2Adapter implements VideoAPIAdapter {
  readonly platform = 'seedance2' as const;

  renderPrompt(shot: Shot, globalStyle: GlobalStyle, characters: Character[]): string {
    return shot.renderedPrompts.seedance2 || renderSeedance2Prompt(shot, globalStyle, characters);
  }

  async submitGeneration(
    shot: Shot,
    globalStyle: GlobalStyle,
    characters: Character[],
    config: AdapterConfig
  ): Promise<SubmissionResult> {
    const prompt = this.renderPrompt(shot, globalStyle, characters);

    const body = {
      prompt,
      negative_prompt: shot.prompt.negativePrompt || globalStyle.globalNegativePrompt,
      aspect_ratio: globalStyle.aspectRatio,
      duration: shot.durationSeconds,
      resolution: globalStyle.resolution === '4K' ? '2160p' : '1080p',
    };

    try {
      const response = await fetch(`${config.baseUrl || SEEDANCE_API_BASE}/v2/video/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: config.timeoutMs ? AbortSignal.timeout(config.timeoutMs) : undefined,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return { apiRequestId: '', status: 'failed', error: `Seedance API ${response.status}: ${errorBody}` };
      }

      const data = await response.json();
      return {
        apiRequestId: data.task_id || data.id || '',
        status: 'submitted',
        estimatedWaitSeconds: 90,
      };
    } catch (err) {
      return { apiRequestId: '', status: 'failed', error: err instanceof Error ? err.message : String(err) };
    }
  }

  async checkStatus(apiRequestId: string, config: AdapterConfig): Promise<StatusResult> {
    try {
      const response = await fetch(
        `${config.baseUrl || SEEDANCE_API_BASE}/v2/video/task/${apiRequestId}`,
        {
          headers: { 'Authorization': `Bearer ${config.apiKey}` },
          signal: config.timeoutMs ? AbortSignal.timeout(config.timeoutMs) : undefined,
        }
      );

      if (!response.ok) {
        return { status: 'failed', error: `Status check failed: ${response.status}` };
      }

      const data = await response.json();

      if (data.status === 'completed' || data.status === 'success') {
        const videoUrl = data.video_url || data.output?.url;
        if (videoUrl) {
          return { status: 'completed', progress: 100, outputUrl: videoUrl };
        }
        return { status: 'failed', error: 'Completed but no video URL' };
      }

      if (data.status === 'failed') {
        return { status: 'failed', error: data.message || 'Generation failed' };
      }

      return { status: 'processing', progress: data.progress || 50 };
    } catch (err) {
      return { status: 'failed', error: err instanceof Error ? err.message : String(err) };
    }
  }

  async downloadResult(outputUrl: string, outputPath: string): Promise<void> {
    const response = await fetch(outputUrl);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);

    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();

    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      await writeFile(outputPath, new Uint8Array(buffer));
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = outputPath.split('/').pop() || 'output.mp4';
      a.click();
      URL.revokeObjectURL(a.href);
    }
  }

  estimateCost(shot: Shot, globalStyle: GlobalStyle): CostEstimate {
    const baseCostPerSecond = globalStyle.resolution === '4K' ? 0.35 : 0.20;
    return {
      platform: 'seedance2',
      estimatedCostUsd: shot.durationSeconds * baseCostPerSecond,
      durationSeconds: shot.durationSeconds,
      resolution: globalStyle.resolution,
    };
  }
}
