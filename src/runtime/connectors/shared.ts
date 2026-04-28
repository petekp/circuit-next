import { createHash } from 'node:crypto';
import type { ResolvedSelection } from '../../schemas/selection-policy.js';

// Shared connector-layer scalars. Both `claude-code` and `codex` connectors
// need symmetric access to the hash helper + a uniform relay-result
// shape.
//
// Connector files import these two symbols so the five-trace_entry relay
// transcript is byte-identical regardless of which connector produced the
// result: both connectors hash request/result bytes via `sha256Hex`, both
// connectors return the same `RelayResult` struct, and the materializer
// at `relay-materializer.ts` consumes that struct uniformly
// (discriminating only on the `connectorName` passed alongside it).
//
// This module stays under `src/runtime/connectors/**` so Check 29's
// import-level scan over the connectors tree covers it — a future
// regression that smuggles a forbidden SDK identifier into a shared
// helper would trip Check 29 the same way a direct import under
// `codex.ts` or `claude-code.ts` would.

// Shared relay-result shape produced by both the `claude-code` and
// `codex` connectors. The materializer is parameterized on
// `connectorName` and consumes this shape uniformly per-connector.
//
// Fields are the connector-producer contract:
//
//   - `request_payload` — the prompt bytes submitted to the subprocess.
//     Hashed into `relay.request.request_payload_hash`.
//   - `receipt_id` — the subprocess-assigned session identifier
//     (Claude Code session_id for `claude-code`; Codex thread_id for `codex`).
//     Carried verbatim into `relay.receipt.receipt_id`.
//   - `result_body` — the terminal text payload from the subprocess.
//     Hashed into `relay.result.result_report_hash`; also the raw
//     bytes the runtime materializes into the validated report.
//   - `duration_ms` — monotonic wall-clock duration of the subprocess
//     invocation, measured via performance.now(). Feeds
//     `relay.completed.duration_ms`.
//   - `cli_version` — vendor-CLI version string captured at relay
//     time. For `claude-code`, from the subprocess's init trace_entry
//     `claude_code_version` field. For `codex`, from a pre-invocation
//     `codex --version` shellout (Codex's `--json` stream does not emit
//     version in-band). Recorded for version-pinned transcript evidence.
export interface RelayResult {
  readonly request_payload: string;
  readonly receipt_id: string;
  readonly result_body: string;
  readonly duration_ms: number;
  readonly cli_version: string;
}

export interface ConnectorRelayInput {
  prompt: string;
  timeoutMs?: number;
  resolvedSelection?: ResolvedSelection;
}

export function selectedModelForProvider(
  connectorName: string,
  selection: ResolvedSelection | undefined,
  expectedProvider: NonNullable<ResolvedSelection['model']>['provider'],
): string | undefined {
  const model = selection?.model;
  if (model === undefined) return undefined;
  if (model.provider !== expectedProvider) {
    throw new Error(
      `${connectorName} connector cannot honor model provider '${model.provider}' for model '${model.model}'; expected provider '${expectedProvider}'`,
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
// the relay on the first non-JSON character.
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
