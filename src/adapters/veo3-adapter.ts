/**
 * Veo 3.1 Adapter — Google Gemini API
 *
 * Correct REST API flow per docs:
 *   1. POST /models/veo-3.1-generate-preview:predictLongRunning
 *      - Body: { instances: [{ prompt }], parameters: { ... } }
 *      - Auth: x-goog-api-key header
 *   2. GET /operations/{name} with same auth header → poll until done
 *   3. Download video from response URI
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
import { renderVeo3Prompt } from '../services/prompt-renderer';

// In dev mode, route through Vite proxy to avoid CORS.
const isDev = import.meta.env.DEV;
const GEMINI_API_BASE = isDev
  ? '/gemini-api/v1beta'
  : 'https://generativelanguage.googleapis.com/v1beta';
const VEO_MODEL = 'veo-3.1-generate-preview';

export class Veo3Adapter implements VideoAPIAdapter {
  readonly platform = 'veo3' as const;

  async submitGeneration(
    shot: Shot,
    globalStyle: GlobalStyle,
    characters: Character[],
    config: AdapterConfig
  ): Promise<SubmissionResult> {
    const prompt = this.renderPrompt(shot, globalStyle, characters);

    const aspectRatioMap: Record<string, string> = {
      '16:9': '16:9',
      '21:9': '16:9',
      '4:3': '16:9',
      '9:16': '9:16',
    };

    // Clamp duration to valid Veo values: 4, 6, or 8
    const validDurations = [4, 6, 8];
    const duration = validDurations.reduce((prev, curr) =>
      Math.abs(curr - shot.durationSeconds) < Math.abs(prev - shot.durationSeconds) ? curr : prev
    );

    // REST body format: instances + parameters
    const body: Record<string, unknown> = {
      instances: [
        { prompt },
      ],
      parameters: {
        aspectRatio: aspectRatioMap[globalStyle.aspectRatio] || '16:9',
        personGeneration: 'allow_all',
        durationSeconds: duration,
      },
    };

    const url = `${GEMINI_API_BASE}/models/${VEO_MODEL}:predictLongRunning`;

    console.log('[Film Studio] Veo request URL:', url);
    console.log('[Film Studio] Veo request body:', JSON.stringify(body, null, 2));

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.apiKey,
        },
        body: JSON.stringify(body),
        signal: config.timeoutMs ? AbortSignal.timeout(config.timeoutMs) : undefined,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('[Film Studio] Veo error:', response.status, errorBody);
        return {
          apiRequestId: '',
          status: 'failed',
          error: `Veo API ${response.status}: ${errorBody.slice(0, 500)}`,
        };
      }

      const operation = await response.json();
      const opName = operation.name || '';

      console.log('[Film Studio] Veo job submitted:', opName);

      if (!opName) {
        return {
          apiRequestId: '',
          status: 'failed',
          error: 'No operation name returned from Veo API',
        };
      }

      return {
        apiRequestId: opName,
        status: 'submitted',
        estimatedWaitSeconds: 120,
      };
    } catch (err) {
      return {
        apiRequestId: '',
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async checkStatus(
    apiRequestId: string,
    config: AdapterConfig
  ): Promise<StatusResult> {
    // Poll the operation by its full name
    const url = `${GEMINI_API_BASE}/${apiRequestId}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.apiKey,
        },
        signal: config.timeoutMs ? AbortSignal.timeout(config.timeoutMs) : undefined,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          status: 'failed',
          error: `Poll failed ${response.status}: ${errorBody.slice(0, 200)}`,
        };
      }

      const operation = await response.json();

      if (operation.error) {
        return {
          status: 'failed',
          error: `${operation.error.code}: ${operation.error.message}`,
        };
      }

      if (operation.done) {
        // Try all known response shapes
        const generatedVideos =
          operation.response?.generateVideoResponse?.generatedSamples ||
          operation.response?.generatedVideos ||
          operation.response?.generated_videos ||
          operation.response?.videos ||
          [];

        const videoObj = generatedVideos[0]?.video;
        const videoUri = videoObj?.uri || videoObj?.url || null;

        if (videoUri) {
          return { status: 'completed', progress: 100, outputUrl: videoUri };
        }

        console.warn('[Film Studio] Veo done but no video URI:', JSON.stringify(operation.response).slice(0, 500));
        return { status: 'failed', error: 'Completed but no video URI in response' };
      }

      const progress = operation.metadata?.percentComplete || 50;
      return { status: 'processing', progress };
    } catch (err) {
      return {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async downloadResult(
    outputUrl: string,
    outputPath: string
  ): Promise<void> {
    const response = await fetch(outputUrl);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

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

  estimateCost(
    shot: Shot,
    globalStyle: GlobalStyle
  ): CostEstimate {
    const baseCostPerSecond = globalStyle.resolution === '4K' ? 0.75 : 0.50;
    return {
      platform: 'veo3',
      estimatedCostUsd: shot.durationSeconds * baseCostPerSecond,
      durationSeconds: shot.durationSeconds,
      resolution: globalStyle.resolution,
    };
  }

  renderPrompt(
    shot: Shot,
    globalStyle: GlobalStyle,
    characters: Character[]
  ): string {
    return renderVeo3Prompt(shot, globalStyle, characters);
  }
}
