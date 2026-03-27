# Film Studio Production Readiness Plan
Date: 2026-03-26

## Goal
Ship the prompt-intelligence and generation pipeline safely to production with measurable quality, reliability, and rollback guarantees.

## Release Gates (must all pass)
1. `npm test -- --runInBand` passes in CI.
2. `npm run lint` passes with zero errors.
3. `npm run build` passes on clean checkout.
4. Prompt preview and adapter submission parity verified for every supported platform.
5. No P0/P1 audit findings open.

## Phase 1: Stabilize Core Prompt Stack (1-2 days)
1. Lock platform prompt contracts:
   - Veo, Sora, Kling, Seedance, Runway prompt shape tests.
   - Snapshot tests for optimized prompts per platform.
2. Add guardrail tests:
   - Six-layer coverage warnings.
   - Negative-motion directive warnings.
   - Platform fit thresholds by model.
3. Add deterministic fixtures:
   - Canonical scene fixture set (short, medium, long shots).

## Phase 2: Reliability and Recovery (2-3 days)
1. Add queue resilience features:
   - Job resume after app restart.
   - Max retry + dead-letter queue for unrecoverable failures.
2. Add per-platform timeout and backoff config in settings UI.
3. Add idempotent submission key:
   - Prevent duplicate platform submissions on retries.

## Phase 3: Security and Compliance (1-2 days)
1. Redact prompt and API-key-bearing payloads from logs by default.
2. Add secrets hygiene checks:
   - No API key in client console logs.
   - No accidental key persistence in exported artifacts.
3. Add platform-policy checks:
   - Input validation for prompt length/unsafe directives before submit.

## Phase 4: Observability and Quality Metrics (2-3 days)
1. Instrument queue telemetry:
   - Submit latency, generation duration, failure rate, retry count, cost by platform.
2. Add prompt quality analytics:
   - Median score by platform.
   - Top recurring issue codes.
3. Add review-loop metrics:
   - Approval rate by platform and prompt score band.

## Phase 5: Pre-Prod Validation and Launch (2 days)
1. Staging soak test:
   - 100+ shot batch across all platforms.
2. Golden set validation:
   - Compare outputs against baseline quality rubric.
3. Launch strategy:
   - Canary rollout (10% -> 50% -> 100%).
   - Feature flag for new prompt-intelligence path.
4. Rollback strategy:
   - One-click fallback to previous prompt renderer/scoring path.

## Immediate Backlog (next 5 tickets)
1. Persist generation queue state to disk and restore on startup.
2. Add snapshot tests for `renderAllPrompts` output by platform.
3. Add centralized platform constraints config (length, char limits, required markers).
4. Add structured telemetry event emitter for queue lifecycle.
5. Add feature flag for prompt-intelligence strict mode.
