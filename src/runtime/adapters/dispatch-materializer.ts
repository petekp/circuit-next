import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Event } from '../../schemas/event.js';
import type { RunId, StepId } from '../../schemas/ids.js';
import type { DispatchRole } from '../../schemas/step.js';
import { sha256Hex } from './agent.js';
import type { AgentDispatchResult } from './agent.js';

// Slice 42 (P2.4) — dispatch materialization glue between the agent
// adapter's raw subprocess output and the five-event dispatch transcript
// + ADR-0008 §Decision.3a artifact materialization.
//
// Per ADR-0007 CC#P2-2 §Amendment (Slice 37), the durable dispatch
// transcript is the five-event sequence
//   dispatch.started → dispatch.request → dispatch.receipt →
//   dispatch.result → dispatch.completed
// on a single `(step_id, attempt)` pair. This module builds that
// sequence deterministically from a single `AgentDispatchResult`,
// writes the four on-disk transcript slots (request payload, receipt,
// result bytes, materialized artifact), and returns the event array
// for the caller to append through `event-writer.ts`.
//
// Why live in `src/runtime/adapters/` and not `src/runtime/` proper.
// The materializer is the adapter's downstream binding — it knows how
// to translate `AgentDispatchResult` into the event schema. Check 29's
// scope is `src/runtime/adapters/**`, and this module's only external
// imports are stdlib + sibling `agent.ts` + sibling schemas. Keeping
// the glue under the scanned tree ensures a future regression cannot
// smuggle a forbidden SDK through the materialization path either.

export interface DispatchMaterializeInput {
  readonly runId: RunId;
  readonly stepId: StepId;
  readonly attempt: number;
  readonly role: DispatchRole;
  readonly startingSequence: number;
  readonly runRoot: string;
  readonly writes: {
    readonly request: string;
    readonly receipt: string;
    readonly result: string;
    readonly artifact?: { readonly path: string; readonly schema: string };
  };
  readonly agentResult: AgentDispatchResult;
  readonly verdict: string;
  readonly now: () => Date;
}

export interface DispatchMaterializeOutput {
  readonly events: readonly Event[];
  readonly sequenceAfter: number;
  readonly requestPath: string;
  readonly receiptPath: string;
  readonly resultPath: string;
  readonly artifactPath: string | undefined;
  readonly requestPayloadHash: string;
  readonly resultArtifactHash: string;
}

// Write four on-disk transcript slots + the validated artifact file if
// `writes.artifact` is declared. Then produce the five-event sequence.
// Caller is responsible for appending the events via `appendEvent`
// (or `appendAndDerive` if snapshot derivation is wanted).
//
// ADR-0008 §Decision.3a materialization rule: when `writes.artifact` is
// declared, after the gate would pass the runtime materializes the
// artifact at `writes.artifact.path` from the `result` payload. At v0
// we materialize the raw `result_body` bytes verbatim (no schema
// parsing); a future slice lands the schema-parse step once the
// artifact schemas become enforceable at runtime. The key structural
// property — materialization produces a separate on-disk file at the
// canonical `writes.artifact.path` distinct from the transcript
// `writes.result` — is already honored here.
export function materializeDispatch(input: DispatchMaterializeInput): DispatchMaterializeOutput {
  const {
    runId,
    stepId,
    attempt,
    role,
    startingSequence,
    runRoot,
    writes,
    agentResult,
    verdict,
    now,
  } = input;

  const requestAbs = join(runRoot, writes.request);
  const receiptAbs = join(runRoot, writes.receipt);
  const resultAbs = join(runRoot, writes.result);
  const artifactAbs = writes.artifact ? join(runRoot, writes.artifact.path) : undefined;

  for (const p of [requestAbs, receiptAbs, resultAbs]) {
    mkdirSync(dirname(p), { recursive: true });
  }
  writeFileSync(requestAbs, agentResult.request_payload);
  writeFileSync(receiptAbs, agentResult.receipt_id);
  writeFileSync(resultAbs, agentResult.result_body);
  if (artifactAbs !== undefined) {
    mkdirSync(dirname(artifactAbs), { recursive: true });
    writeFileSync(artifactAbs, agentResult.result_body);
  }

  const requestPayloadHash = sha256Hex(agentResult.request_payload);
  const resultArtifactHash = sha256Hex(agentResult.result_body);

  let sequence = startingSequence;
  const ts = () => now().toISOString();
  const events: Event[] = [];

  events.push({
    schema_version: 1,
    sequence: sequence++,
    recorded_at: ts(),
    run_id: runId,
    kind: 'dispatch.started',
    step_id: stepId,
    attempt,
    adapter: { kind: 'builtin', name: 'agent' },
    role,
    resolved_selection: { skills: [], invocation_options: {} },
    resolved_from: { source: 'default' },
  });

  events.push({
    schema_version: 1,
    sequence: sequence++,
    recorded_at: ts(),
    run_id: runId,
    kind: 'dispatch.request',
    step_id: stepId,
    attempt,
    request_payload_hash: requestPayloadHash,
  });

  events.push({
    schema_version: 1,
    sequence: sequence++,
    recorded_at: ts(),
    run_id: runId,
    kind: 'dispatch.receipt',
    step_id: stepId,
    attempt,
    receipt_id: agentResult.receipt_id,
  });

  events.push({
    schema_version: 1,
    sequence: sequence++,
    recorded_at: ts(),
    run_id: runId,
    kind: 'dispatch.result',
    step_id: stepId,
    attempt,
    result_artifact_hash: resultArtifactHash,
  });

  events.push({
    schema_version: 1,
    sequence: sequence++,
    recorded_at: ts(),
    run_id: runId,
    kind: 'dispatch.completed',
    step_id: stepId,
    attempt,
    verdict,
    duration_ms: Math.max(0, Math.round(agentResult.duration_ms)),
    result_path: writes.result,
    receipt_path: writes.receipt,
  });

  return {
    events,
    sequenceAfter: sequence,
    requestPath: requestAbs,
    receiptPath: receiptAbs,
    resultPath: resultAbs,
    artifactPath: artifactAbs,
    requestPayloadHash,
    resultArtifactHash,
  };
}
