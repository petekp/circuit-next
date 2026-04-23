import { z } from 'zod';
import { RunClosedOutcome } from './event.js';
import { RunId, WorkflowId } from './ids.js';

// RESULT-I1 — RunResult is the user-visible artifact a run produces at
// closure. Written to <run-root>/artifacts/result.json by the runtime
// when the closing `run.closed` event is appended. Unlike state.json
// (reducer-derived, recomputable) a RunResult is persisted once at close
// and never mutated: it is the authoritative "what happened" summary
// independent of future log rewrites.
//
// RESULT-I2 — `outcome` and `run_id` must match the closing
// `run.closed` event; `workflow_id` must match `run.bootstrapped`.
// Binding is asserted at write-time by the runtime (see
// src/runtime/result-writer.ts); this schema only enforces shape.
//
// RESULT-I3 — `goal` is the original operator-facing goal string from
// bootstrap; `summary` is a short model-authored or runtime-authored
// narrative of what the run produced. Both are user-visible strings;
// neither is a dispatch sink.
//
// RESULT-I4 (Slice 53 Codex H1 fold-in) — `reason` mirrors
// `RunClosedEvent.reason` and is OPTIONAL. When `outcome` is
// 'aborted' / 'stopped' / 'escalated' / 'handoff', the runtime SHOULD
// populate `reason` with a human-readable explanation so the
// user-visible close artifact carries the same explanation the event
// log carries. When `outcome` is 'complete', `reason` is typically
// omitted. The runtime asserts `result.reason === run.closed.reason`
// at write time when it sets either.
export const RunResult = z
  .object({
    schema_version: z.literal(1),
    run_id: RunId,
    workflow_id: WorkflowId,
    goal: z.string().min(1),
    outcome: RunClosedOutcome,
    summary: z.string().min(1),
    closed_at: z.string().datetime(),
    events_observed: z.number().int().nonnegative(),
    manifest_hash: z.string().min(1),
    reason: z.string().min(1).optional(),
  })
  .strict();
export type RunResult = z.infer<typeof RunResult>;
