/**
 * Sora 2 Adapter — OpenAI API
 *
 * Uses OpenAI's video generation endpoint for Sora 2.
 * Sora 2 uses a shot-list format with explicit camera nomenclature.
 *
 * API flow:
 *   1. POST to /v1/videos/generations → returns generation ID
 *   2. GET /v1/videos/generations/{id} → poll until complete
 *   3. Download from the returned URL
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
import { renderSora2Prompt } from '../services/prompt-renderer';

const OPENAI_API_BASE = 'https://api.openai.com/v1';

export class Sora2Adapter implements VideoAPIAdapter {
  readonly platform = 'sora2' as const;

  renderPrompt(shot: Shot, globalStyle: GlobalStyle, characters: Character[]): string {
    return shot.renderedPrompts.sora2 || renderSora2Prompt(shot, globalStyle, characters);
  }

  async submitGeneration(
    shot: Shot,
    globalStyle: GlobalStyle,
    characters: Character[],
    config: AdapterConfig
  ): Promise<SubmissionResult> {
    const prompt = this.renderPrompt(shot, globalStyle, characters);

    const body = {
      model: 'sora-2',
      prompt,
      size: globalStyle.aspectRatio === '9:16' ? '1080x1920' : '1920x1080',
      duration: shot.durationSeconds,
      n: 1,
    };

    try {
      const response = await fetch(`${config.baseUrl || OPENAI_API_BASE}/videos/generations`, {
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
        return { apiRequestId: '', status: 'failed', error: `OpenAI API ${response.status}: ${errorBody}` };
      }

      const data = await response.json();
      return {
        apiRequestId: data.id,
        status: 'submitted',
        estimatedWaitSeconds: 180,
      };
    } catch (err) {
      return { apiRequestId: '', status: 'failed', error: err instanceof Error ? err.message : String(err) };
    }
  }

  async checkStatus(apiRequestId: string, config: AdapterConfig): Promise<StatusResult> {
    try {
      const response = await fetch(
        `${config.baseUrl || OPENAI_API_BASE}/videos/generations/${apiRequestId}`,
        {
          headers: { 'Authorization': `Bearer ${config.apiKey}` },
          signal: config.timeoutMs ? AbortSignal.timeout(config.timeoutMs) : undefined,
        }
      );

      if (!response.ok) {
        return { status: 'failed', error: `Status check failed: ${response.status}` };
      }

      const data = await response.json();

      if (data.status === 'completed' && data.data?.[0]?.url) {
        return { status: 'completed', progress: 100, outputUrl: data.data[0].url };
      }
      if (data.status === 'failed') {
        return { status: 'failed', error: data.error?.message || 'Generation failed' };
      }

      return { status: 'processing', progress: 50 };
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
    const baseCostPerSecond = globalStyle.resolution === '4K' ? 0.80 : 0.60;
    return {
      platform: 'sora2',
      estimatedCostUsd: shot.durationSeconds * baseCostPerSecond,
      durationSeconds: shot.durationSeconds,
      resolution: globalStyle.resolution,
    };
  }
}
