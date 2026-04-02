/**
 * Base Video API Adapter
 *
 * All platform adapters implement this interface. The adapter pattern
 * ensures each platform's quirks are isolated — the rest of the system
 * works with a unified submission/polling/download lifecycle.
 */

import type { Shot, PlatformId, Generation } from '../types/scene';
import type { GlobalStyle } from '../types/project';
import type { Character } from '../types/character';

export interface SubmissionResult {
  apiRequestId: string;
  status: 'submitted' | 'failed';
  error?: string;
  estimatedWaitSeconds?: number;
}

export interface StatusResult {
  status: Generation['status'];
  progress?: number; // 0-100
  error?: string;
  outputUrl?: string;
}

export interface CostEstimate {
  platform: PlatformId;
  estimatedCostUsd: number;
  durationSeconds: number;
  resolution: string;
}

export interface AdapterConfig {
  apiKey: string;
  baseUrl?: string;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface VideoAPIAdapter {
  readonly platform: PlatformId;

  /** Submit a shot for video generation */
  submitGeneration(
    shot: Shot,
    globalStyle: GlobalStyle,
    characters: Character[],
    config: AdapterConfig
  ): Promise<SubmissionResult>;

  /** Poll for generation status */
  checkStatus(
    apiRequestId: string,
    config: AdapterConfig
  ): Promise<StatusResult>;

  /** Download completed video to local path */
  downloadResult(
    outputUrl: string,
    outputPath: string,
    config?: AdapterConfig
  ): Promise<void>;

  /** Estimate cost before submission */
  estimateCost(
    shot: Shot,
    globalStyle: GlobalStyle
  ): CostEstimate;

  /** Render platform-specific prompt string */
  renderPrompt(
    shot: Shot,
    globalStyle: GlobalStyle,
    characters: Character[]
  ): string;
}
