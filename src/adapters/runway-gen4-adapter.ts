/**
 * Runway Gen-4 Adapter
 *
 * Runway Gen-4 uses motion-first prompting — the action and movement
 * are weighted more heavily than static scene description. Simpler
 * prompt structure compared to other platforms.
 *
 * API flow:
 *   1. POST /v1/text_to_video → returns task ID
 *   2. GET /v1/tasks/{id} → poll for status
 *   3. Download from returned output array
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
import { renderRunwayGen4Prompt } from '../services/prompt-renderer';

const RUNWAY_API_BASE = 'https://api.dev.runwayml.com';

export class RunwayGen4Adapter implements VideoAPIAdapter {
  readonly platform = 'runwayGen4' as const;

  renderPrompt(shot: Shot, globalStyle: GlobalStyle, characters: Character[]): string {
    return shot.renderedPrompts.runwayGen4 || renderRunwayGen4Prompt(shot, globalStyle, characters);
  }

  async submitGeneration(
    shot: Shot,
    globalStyle: GlobalStyle,
    characters: Character[],
    config: AdapterConfig
  ): Promise<SubmissionResult> {
    const prompt = this.renderPrompt(shot, globalStyle, characters);

    const resolutionMap: Record<string, string> = {
      '720p': '720p',
      '1080p': '1080p',
      '4K': '4k',
    };

    const body = {
      model: 'gen4',
      promptText: prompt,
      ratio: globalStyle.aspectRatio === '9:16' ? '9:16' : '16:9',
      duration: Math.min(shot.durationSeconds, 10),
      resolution: resolutionMap[globalStyle.resolution] || '1080p',
    };

    try {
      const response = await fetch(`${config.baseUrl || RUNWAY_API_BASE}/v1/text_to_video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
          'X-Runway-Version': '2024-11-06',
        },
        body: JSON.stringify(body),
        signal: config.timeoutMs ? AbortSignal.timeout(config.timeoutMs) : undefined,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return { apiRequestId: '', status: 'failed', error: `Runway API ${response.status}: ${errorBody}` };
      }

      const data = await response.json();
      return {
        apiRequestId: data.id || '',
        status: 'submitted',
        estimatedWaitSeconds: 150,
      };
    } catch (err) {
      return { apiRequestId: '', status: 'failed', error: err instanceof Error ? err.message : String(err) };
    }
  }

  async checkStatus(apiRequestId: string, config: AdapterConfig): Promise<StatusResult> {
    try {
      const response = await fetch(
        `${config.baseUrl || RUNWAY_API_BASE}/v1/tasks/${apiRequestId}`,
        {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'X-Runway-Version': '2024-11-06',
          },
          signal: config.timeoutMs ? AbortSignal.timeout(config.timeoutMs) : undefined,
        }
      );

      if (!response.ok) {
        return { status: 'failed', error: `Status check failed: ${response.status}` };
      }

      const data = await response.json();

      if (data.status === 'SUCCEEDED') {
        const videoUrl = data.output?.[0];
        if (videoUrl) {
          return { status: 'completed', progress: 100, outputUrl: videoUrl };
        }
        return { status: 'failed', error: 'Completed but no video URL' };
      }

      if (data.status === 'FAILED') {
        return { status: 'failed', error: data.failure || 'Generation failed' };
      }

      const progress = data.progress ? Math.round(data.progress * 100) : 50;
      return { status: 'processing', progress };
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
    // Runway Gen-4: ~$0.50/5s clip
    const baseCostPerSecond = globalStyle.resolution === '4K' ? 0.15 : 0.10;
    return {
      platform: 'runwayGen4',
      estimatedCostUsd: shot.durationSeconds * baseCostPerSecond,
      durationSeconds: shot.durationSeconds,
      resolution: globalStyle.resolution,
    };
  }
}

