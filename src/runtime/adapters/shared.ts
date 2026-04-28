import { createHash } from 'node:crypto';
import type { ResolvedSelection } from '../../schemas/selection-policy.js';

// Shared adapter-layer primitives. Both `agent` and `codex` adapters
// need symmetric access to the hash helper + a uniform dispatch-result
// shape.
//
// Adapter files import these two symbols so the five-event dispatch
// transcript is byte-identical regardless of which adapter produced the
// result: both adapters hash request/result bytes via `sha256Hex`, both
// adapters return the same `DispatchResult` struct, and the materializer
// at `dispatch-materializer.ts` consumes that struct uniformly
// (discriminating only on the `adapterName` passed alongside it).
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
//     Hashed into `dispatch.request.request_payload_hash`.
//   - `receipt_id` — the subprocess-assigned session identifier
//     (claude session_id for `agent`; Codex thread_id for `codex`).
//     Carried verbatim into `dispatch.receipt.receipt_id`.
//   - `result_body` — the terminal text payload from the subprocess.
//     Hashed into `dispatch.result.result_artifact_hash`; also the raw
//     bytes the runtime materializes into the validated artifact.
//   - `duration_ms` — monotonic wall-clock duration of the subprocess
//     invocation, measured via performance.now(). Feeds
//     `dispatch.completed.duration_ms`.
//   - `cli_version` — vendor-CLI version string captured at dispatch
//     time. For `agent`, from the subprocess's init event
//     `claude_code_version` field. For `codex`, from a pre-invocation
//     `codex --version` shellout (Codex's `--json` stream does not emit
//     version in-band). Recorded for version-pinned transcript evidence.
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

// Tolerant JSON-object extraction. Workers occasionally narrate status
// in prose before or after their JSON response despite the shape-hint
// instruction telling them not to ("Type check passes.\n\n{...}",
// "{...}\n\nDone."). Without tolerance the downstream JSON.parse aborts
// the dispatch on the first non-JSON character.
//
// Algorithm: walk forward from the first `{`, balance-match braces while
// tracking string state, and try JSON.parse on the candidate. If it
// parses, return that substring. If not, advance past the candidate and
// try the next `{`. If no candidate parses (or no `{` exists), return
// the original text unchanged so downstream JSON.parse surfaces the
// real error message.
//
// Idempotent on clean JSON: a string that starts with `{` and is fully
// balanced is returned verbatim after one parse attempt.
export function extractJsonObject(text: string): string {
  let cursor = 0;
  while (cursor < text.length) {
    const start = text.indexOf('{', cursor);
    if (start === -1) break;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (inString) {
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end === -1) break;
    const candidate = text.slice(start, end);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      cursor = start + 1;
    }
  }
  return text;
}
