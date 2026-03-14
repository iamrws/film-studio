/**
 * Kling 3.0 Adapter — Kuaishou API
 *
 * Kling 3.0 supports multi-shot connected clips with frame chaining.
 * Uses a structured JSON format for scene descriptions.
 *
 * API flow:
 *   1. POST /v1/videos/text2video → returns task ID
 *   2. GET /v1/videos/text2video/{id} → poll for completion
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

const KLING_API_BASE = 'https://api.klingai.com';

export class Kling3Adapter implements VideoAPIAdapter {
  readonly platform = 'kling3' as const;

  renderPrompt(shot: Shot, globalStyle: GlobalStyle, characters: Character[]): string {
    const p = shot.prompt;
    const parts: string[] = [];

    // Kling uses natural language with camera directions inline
    parts.push(`${p.camera.shotType} ${p.camera.movement} ${p.camera.angle}`);

    const charAnchors = p.subject.characters
      .map((charId) => characters.find((c) => c.id === charId || c.name === charId))
      .filter(Boolean)
      .map((c) => c!.consistencyAnchor || c!.name);

    if (charAnchors.length > 0) {
      parts.push(charAnchors.join('. '));
    }

    parts.push(p.subject.action);
    parts.push(`${p.setting.location}, ${p.setting.timeOfDay}`);

    if (p.lighting.style) {
      parts.push(`${p.lighting.style} lighting`);
    }

    if (p.style.filmStock || p.style.colorGrade) {
      parts.push([p.style.filmStock, p.style.colorGrade].filter(Boolean).join(', '));
    }

    if (globalStyle.filmStyle) {
      parts.push(globalStyle.filmStyle);
    }

    if (p.audio.dialogue.length > 0) {
      for (const d of p.audio.dialogue) {
        parts.push(`${d.characterName} says "${d.text}"`);
      }
    }

    return parts.filter(Boolean).join('. ') + '.';
  }

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
      '4:3': '4:3',
      '9:16': '9:16',
    };

    const body = {
      prompt,
      negative_prompt: shot.prompt.negativePrompt || globalStyle.globalNegativePrompt,
      cfg_scale: 0.5,
      mode: 'std',
      aspect_ratio: aspectRatioMap[globalStyle.aspectRatio] || '16:9',
      duration: String(Math.min(shot.durationSeconds, 10)),
    };

    try {
      const response = await fetch(`${config.baseUrl || KLING_API_BASE}/v1/videos/text2video`, {
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
        return { apiRequestId: '', status: 'failed', error: `Kling API ${response.status}: ${errorBody}` };
      }

      const data = await response.json();
      return {
        apiRequestId: data.data?.task_id || data.task_id || '',
        status: 'submitted',
        estimatedWaitSeconds: 120,
      };
    } catch (err) {
      return { apiRequestId: '', status: 'failed', error: err instanceof Error ? err.message : String(err) };
    }
  }

  async checkStatus(apiRequestId: string, config: AdapterConfig): Promise<StatusResult> {
    try {
      const response = await fetch(
        `${config.baseUrl || KLING_API_BASE}/v1/videos/text2video/${apiRequestId}`,
        {
          headers: { 'Authorization': `Bearer ${config.apiKey}` },
          signal: config.timeoutMs ? AbortSignal.timeout(config.timeoutMs) : undefined,
        }
      );

      if (!response.ok) {
        return { status: 'failed', error: `Status check failed: ${response.status}` };
      }

      const data = await response.json();
      const taskData = data.data || data;

      if (taskData.task_status === 'succeed') {
        const videoUrl = taskData.task_result?.videos?.[0]?.url;
        if (videoUrl) {
          return { status: 'completed', progress: 100, outputUrl: videoUrl };
        }
        return { status: 'failed', error: 'Completed but no video URL' };
      }

      if (taskData.task_status === 'failed') {
        return { status: 'failed', error: taskData.task_status_msg || 'Generation failed' };
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
    const baseCostPerSecond = globalStyle.resolution === '4K' ? 0.40 : 0.25;
    return {
      platform: 'kling3',
      estimatedCostUsd: shot.durationSeconds * baseCostPerSecond,
      durationSeconds: shot.durationSeconds,
      resolution: globalStyle.resolution,
    };
  }
}
