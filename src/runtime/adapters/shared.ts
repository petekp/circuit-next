import { createHash } from 'node:crypto';
import type { ResolvedSelection } from '../../schemas/selection-policy.js';

// Slice 45 (P2.6) — shared adapter-layer primitives. Extracted from
// Slice 42 `agent.ts` when the `codex` adapter landed and both adapters
// needed symmetric access to the hash helper + a uniform dispatch-result
// shape.
//
// Adapter files import these two symbols so the five-event dispatch
// transcript (Slice 37) is byte-identical regardless of which adapter
// produced the result: both adapters hash request/result bytes via
// `sha256Hex`, both adapters return the same `DispatchResult` struct,
// and the materializer at `dispatch-materializer.ts` consumes that
// struct uniformly (discriminating only on the `adapterName` passed
// alongside it).
//
// This module stays under `src/runtime/adapters/**` so Check 29's
// import-level scan over the adapters tree covers it — a future
// regression that smuggles a forbidden SDK identifier into a shared
// helper would trip Check 29 the same way a direct import under
// `codex.ts` or `agent.ts` would.

// Shared dispatch-result shape produced by both the `agent` and
// `codex` adapters. The materializer is parameterized on
// `adapterName` and consumes this shape uniformly per-adapter.
//
// Fields are the adapter-producer contract:
//
//   - `request_payload` — the prompt bytes submitted to the subprocess.
//     Hashed into `dispatch.request.request_payload_hash` per Slice 37
//     event schema.
//   - `receipt_id` — the subprocess-assigned session identifier
//     (claude session_id for `agent`; Codex thread_id for `codex`).
//     Carried verbatim into `dispatch.receipt.receipt_id`.
//   - `result_body` — the terminal text payload from the subprocess.
//     Hashed into `dispatch.result.result_artifact_hash` per Slice 37;
//     also the raw bytes the runtime materializes into the validated
//     artifact per ADR-0008 §Decision.3a.
//   - `duration_ms` — monotonic wall-clock duration of the subprocess
//     invocation, measured via performance.now(). Feeds
//     `dispatch.completed.duration_ms`.
//   - `cli_version` — vendor-CLI version string captured at dispatch
//     time. For `agent`, from the subprocess's init event
//     `claude_code_version` field. For `codex`, from a pre-invocation
//     `codex --version` shellout (Codex's `--json` stream does not emit
//     version in-band). Recorded for version-pinned transcript evidence
//     per Codex Slice 42 MED 2 fold-in.
export interface DispatchResult {
  readonly request_payload: string;
  readonly receipt_id: string;
  readonly result_body: string;
  readonly duration_ms: number;
  readonly cli_version: string;
}

export interface AdapterDispatchInput {
  prompt: string;
  timeoutMs?: number;
  resolvedSelection?: ResolvedSelection;
}

export function selectedModelForProvider(
  adapterName: string,
  selection: ResolvedSelection | undefined,
  expectedProvider: NonNullable<ResolvedSelection['model']>['provider'],
): string | undefined {
  const model = selection?.model;
  if (model === undefined) return undefined;
  if (model.provider !== expectedProvider) {
    throw new Error(
      `${adapterName} adapter cannot honor model provider '${model.provider}' for model '${model.model}'; expected provider '${expectedProvider}'`,
    );
  }
  return model.model;
}

export function sha256Hex(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}
