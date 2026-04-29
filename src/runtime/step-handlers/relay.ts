import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CompiledFlow } from '../../schemas/compiled-flow.js';
import { EnabledConnector, type ResolvedConnector } from '../../schemas/connector.js';
import { materializeRelay } from '../connectors/relay-materializer.js';
import { type RelayResult, sha256Hex } from '../connectors/shared.js';
import { runCrossReportValidator } from '../registries/cross-report-validators.js';
import { parseReport } from '../registries/report-schemas.js';
import { findRelayShapeHint } from '../registries/shape-hints/registry.js';
import { deriveResolvedSelection, resolveRelayDecision } from '../relay-selection.js';
import { resolveRunRelative } from '../run-relative-path.js';
import type { RelayInput } from '../runner-types.js';
import type { StepHandlerContext, StepHandlerResult } from './types.js';

export type RelayStep = CompiledFlow['steps'][number] & { kind: 'relay' };

// Parse connector result_body for the check verdict and evaluate against
// `step.check.pass`. Result shape: a discriminated union the handler
// consumes downstream. On 'pass' the handler uses the parsed verdict on
// `relay.completed` and emits `check.evaluated` with `outcome: 'pass'`.
// On 'fail' the handler emits `check.evaluated` with `outcome: 'fail'` +
// the reason, then `step.aborted`. The relay-completed verdict on
// fail carries the observed verdict when one was present (e.g., a
// parseable body with a verdict not in pass), so the durable transcript
// reflects what the connector said even on rejection. When no verdict was
// observable (unparseable / no verdict field), `relay.completed.verdict`
// carries the `'<no-verdict>'` sentinel — `RelayCompletedTraceEntry.verdict`
// is `z.string().min(1)` so the slot must hold a non-empty string.
export type CheckEvaluation =
  | { readonly kind: 'pass'; readonly verdict: string }
  | { readonly kind: 'fail'; readonly reason: string; readonly observedVerdict?: string };

const NO_VERDICT_SENTINEL = '<no-verdict>';

export function evaluateRelayCheck(step: RelayStep, resultBody: string): CheckEvaluation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(resultBody);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      kind: 'fail',
      reason: `relay step '${step.id}': connector result_body did not parse as JSON (${msg})`,
    };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      kind: 'fail',
      reason: `relay step '${step.id}': connector result_body parsed but is not a JSON object (got ${parsed === null ? 'null' : Array.isArray(parsed) ? 'array' : typeof parsed})`,
    };
  }
  const verdictRaw = (parsed as Record<string, unknown>).verdict;
  if (typeof verdictRaw !== 'string' || verdictRaw.length === 0) {
    return {
      kind: 'fail',
      reason: `relay step '${step.id}': connector result_body lacks a non-empty string 'verdict' field (got ${typeof verdictRaw === 'string' ? 'empty string' : typeof verdictRaw})`,
    };
  }
  if (!step.check.pass.includes(verdictRaw)) {
    return {
      kind: 'fail',
      reason: `relay step '${step.id}': connector declared verdict '${verdictRaw}' which is not in check.pass [${step.check.pass.join(', ')}]`,
      observedVerdict: verdictRaw,
    };
  }
  return { kind: 'pass', verdict: verdictRaw };
}

const GENERIC_DISPATCH_SHAPE_HINT =
  'Respond with a single raw JSON object whose top-level shape is exactly { "verdict": "<one-of-accepted-verdicts>" } (additional fields permitted). Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object. The runtime parses your response with JSON.parse and rejects the run on any parse failure or on a verdict not drawn from the accepted-verdicts list.';

function relayResponseInstruction(step: RelayStep): string {
  return findRelayShapeHint(step) ?? GENERIC_DISPATCH_SHAPE_HINT;
}

// v0 prompt composition: name the step, enumerate accepted verdicts, and
// inline every reads-declared report (or a clear placeholder if the
// reads report hasn't been written yet).
export function composeRelayPrompt(step: RelayStep, runFolder: string): string {
  const readsBody =
    step.reads.length === 0
      ? '(no reads)'
      : step.reads
          .map((path) => {
            const abs = resolveRunRelative(runFolder, path);
            if (!existsSync(abs)) return `[reads unavailable: ${path}]`;
            return `--- ${path} ---\n${readFileSync(abs, 'utf8')}`;
          })
          .join('\n\n');
  return [
    `Step: ${step.id}`,
    `Title: ${step.title}`,
    `Role: ${step.role}`,
    `Accepted verdicts: ${step.check.pass.join(', ')}`,
    '',
    'Context (from reads):',
    readsBody,
    '',
    relayResponseInstruction(step),
  ].join('\n');
}

function connectorFailureReason(stepId: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `relay step '${stepId}': connector invocation failed (${message})`;
}

export function connectorForRelayer(relayer: {
  connectorName: string;
  connector?: ResolvedConnector;
}) {
  return (
    relayer.connector ?? {
      kind: 'builtin' as const,
      name: EnabledConnector.parse(relayer.connectorName),
    }
  );
}

export async function runRelayStep(
  ctx: StepHandlerContext & { readonly step: RelayStep },
): Promise<StepHandlerResult> {
  const { runFolder, flow, step, runId, depth, attempt, recordedAt, push, state, now } = ctx;
  const relayerInv = {
    ...(ctx.relayer === undefined ? {} : { relayer: ctx.relayer }),
    selectionConfigLayers: ctx.executionSelectionConfigLayers,
  };

  const prompt = composeRelayPrompt(step, runFolder);
  const resolvedSelection = deriveResolvedSelection(relayerInv, flow, step, depth);
  const relayInput: RelayInput = { prompt, resolvedSelection };
  if (step.budgets?.wall_clock_ms !== undefined) {
    relayInput.timeoutMs = step.budgets.wall_clock_ms;
  }
  const { relayer, resolvedFrom } = await resolveRelayDecision({
    ...(ctx.relayer === undefined ? {} : { explicitRelayer: ctx.relayer }),
    configLayers: ctx.executionSelectionConfigLayers,
    flow,
    step,
  });
  const requestAbs = resolveRunRelative(runFolder, step.writes.request);
  const connector = connectorForRelayer(relayer);
  mkdirSync(dirname(requestAbs), { recursive: true });
  writeFileSync(requestAbs, prompt);
  const requestPayloadHash = sha256Hex(prompt);

  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'relay.started',
    step_id: step.id,
    attempt,
    connector,
    role: step.role,
    resolved_selection: resolvedSelection,
    resolved_from: resolvedFrom,
  });
  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'relay.request',
    step_id: step.id,
    attempt,
    request_payload_hash: requestPayloadHash,
  });

  let relayResult: RelayResult;
  try {
    relayResult = await relayer.relay(relayInput);
  } catch (err) {
    const reason = connectorFailureReason(step.id as unknown as string, err);
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'relay.failed',
      step_id: step.id,
      attempt,
      connector,
      role: step.role,
      resolved_selection: resolvedSelection,
      resolved_from: resolvedFrom,
      request_payload_hash: requestPayloadHash,
      reason,
    });
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'check.evaluated',
      step_id: step.id,
      attempt,
      check_kind: 'result_verdict',
      outcome: 'fail',
      reason,
    });
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'step.aborted',
      step_id: step.id,
      attempt,
      reason,
    });
    return { kind: 'aborted', reason };
  }

  state.relayResults.push({
    stepId: step.id as unknown as string,
    connectorName: relayer.connectorName,
    cli_version: relayResult.cli_version,
  });

  // Evaluate the check against the connector's actual result_body BEFORE
  // materializing, so the verdict written into `relay.completed`
  // reflects what the connector declared (or a sentinel on unparseable /
  // no-verdict cases). The transcript still materializes either way —
  // the relay happened, and the request/receipt/result bytes are
  // durable evidence of the call regardless of admission.
  //
  // When the check admits a verdict AND the step declares
  // `writes.report`, schema-parse `relayResult.result_body` against
  // `writes.report.schema`. A parse failure coerces the evaluation to
  // `kind: 'fail'` with the parse reason — mirroring the
  // reject-on-bad-verdict shape so the content/schema failure-path trace_entry
  // surface stays uniform. Report write requires BOTH check pass AND
  // schema parse pass; failure on either path leaves
  // `writes.report.path` absent on disk.
  const checkEvaluation = evaluateRelayCheck(step, relayResult.result_body);
  let evaluation: CheckEvaluation = checkEvaluation;
  if (checkEvaluation.kind === 'pass' && step.writes.report !== undefined) {
    const parseResult = parseReport(step.writes.report.schema, relayResult.result_body);
    if (parseResult.kind === 'fail') {
      evaluation = {
        kind: 'fail',
        reason: `relay step '${step.id}': ${parseResult.reason}`,
        observedVerdict: checkEvaluation.verdict,
      };
    } else {
      // Cross-report validation enforces constraints that span more
      // than one report (e.g., sweep.batch.items[].candidate_id ⊆
      // sweep.queue.to_execute). Returns ok for schemas with no
      // registered cross-report rule.
      const crossResult = runCrossReportValidator(
        step.writes.report.schema,
        flow,
        runFolder,
        relayResult.result_body,
      );
      if (crossResult.kind === 'fail') {
        evaluation = {
          kind: 'fail',
          reason: `relay step '${step.id}': ${crossResult.reason}`,
          observedVerdict: checkEvaluation.verdict,
        };
      }
    }
  }
  const relayCompletedVerdict =
    evaluation.kind === 'pass'
      ? evaluation.verdict
      : (evaluation.observedVerdict ?? NO_VERDICT_SENTINEL);

  // Check the canonical report write on `evaluation.kind === 'pass'` —
  // the canonical downstream-readable report at `writes.report.path`
  // is materialized ONLY after the verdict check passes. The transcript
  // slots (request / receipt / result) remain durable evidence on
  // either path.
  const materialized = materializeRelay({
    runId,
    stepId: step.id,
    attempt,
    role: step.role,
    startingSequence: state.sequence,
    runFolder,
    writes: {
      request: step.writes.request,
      receipt: step.writes.receipt,
      result: step.writes.result,
      ...(step.writes.report === undefined || evaluation.kind !== 'pass'
        ? {}
        : { report: step.writes.report }),
    },
    connector,
    resolvedSelection,
    resolvedFrom,
    relayResult,
    verdict: relayCompletedVerdict,
    now,
    priorStart: { requestPayloadHash },
  });
  // Adversarial-review fix #12: emit through push() rather than
  // mutating state.trace_entries directly. push() overwrites each trace_entry's
  // sequence atomically, so the materializer's pre-assigned sequences
  // (and `sequenceAfter`) become advisory — they remain on the return
  // shape because tests call materializeRelay directly and assert
  // on its trace_entry array. The state.sequence advance previously done
  // manually here is now handled by push() per emission.
  for (const ev of materialized.trace_entries) {
    push(ev);
  }

  if (evaluation.kind === 'pass') {
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'check.evaluated',
      step_id: step.id,
      attempt,
      check_kind: 'result_verdict',
      outcome: 'pass',
    });
    return { kind: 'advance' };
  }

  // Check-fail termination path.
  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'check.evaluated',
    step_id: step.id,
    attempt,
    check_kind: 'result_verdict',
    outcome: 'fail',
    reason: evaluation.reason,
  });
  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'step.aborted',
    step_id: step.id,
    attempt,
    reason: evaluation.reason,
  });
  return { kind: 'aborted', reason: evaluation.reason };
}
