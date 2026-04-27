import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Workflow } from '../../schemas/workflow.js';
import { materializeDispatch } from '../adapters/dispatch-materializer.js';
import { type DispatchResult, sha256Hex } from '../adapters/shared.js';
import { parseArtifact } from '../artifact-schemas.js';
import { runCrossArtifactValidator } from '../cross-artifact-validators.js';
import { deriveResolvedFrom, deriveResolvedSelection } from '../dispatch-selection.js';
import type { DispatchInput } from '../runner-types.js';
import { resolveRunRelative } from '../run-relative-path.js';
import { findDispatchShapeHint } from '../shape-hints/registry.js';
import type { StepHandlerContext, StepHandlerResult } from './types.js';

type DispatchStep = Workflow['steps'][number] & { kind: 'dispatch' };

// Slice 53 (Codex H14 fold-in) — parse adapter result_body for the
// gate verdict and evaluate against `step.gate.pass`. Result shape: a
// discriminated union the handler consumes downstream. On 'pass' the
// handler uses the parsed verdict on `dispatch.completed` and emits
// `gate.evaluated` with `outcome: 'pass'`. On 'fail' the handler emits
// `gate.evaluated` with `outcome: 'fail'` + the reason, then
// `step.aborted`. The dispatch-completed verdict on fail carries the
// observed verdict when one was present (e.g., a parseable body with a
// verdict not in pass), so the durable transcript reflects what the
// adapter said even on rejection. When no verdict was observable
// (unparseable / no verdict field), `dispatch.completed.verdict`
// carries the `'<no-verdict>'` sentinel — `DispatchCompletedEvent.verdict`
// is `z.string().min(1)` so the slot must hold a non-empty string.
type GateEvaluation =
  | { readonly kind: 'pass'; readonly verdict: string }
  | { readonly kind: 'fail'; readonly reason: string; readonly observedVerdict?: string };

const NO_VERDICT_SENTINEL = '<no-verdict>';

function evaluateDispatchGate(step: DispatchStep, resultBody: string): GateEvaluation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(resultBody);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      kind: 'fail',
      reason: `dispatch step '${step.id}': adapter result_body did not parse as JSON (${msg})`,
    };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      kind: 'fail',
      reason: `dispatch step '${step.id}': adapter result_body parsed but is not a JSON object (got ${parsed === null ? 'null' : Array.isArray(parsed) ? 'array' : typeof parsed})`,
    };
  }
  const verdictRaw = (parsed as Record<string, unknown>).verdict;
  if (typeof verdictRaw !== 'string' || verdictRaw.length === 0) {
    return {
      kind: 'fail',
      reason: `dispatch step '${step.id}': adapter result_body lacks a non-empty string 'verdict' field (got ${typeof verdictRaw === 'string' ? 'empty string' : typeof verdictRaw})`,
    };
  }
  if (!step.gate.pass.includes(verdictRaw)) {
    return {
      kind: 'fail',
      reason: `dispatch step '${step.id}': adapter declared verdict '${verdictRaw}' which is not in gate.pass [${step.gate.pass.join(', ')}]`,
      observedVerdict: verdictRaw,
    };
  }
  return { kind: 'pass', verdict: verdictRaw };
}

const GENERIC_DISPATCH_SHAPE_HINT =
  'Respond with a single raw JSON object whose top-level shape is exactly { "verdict": "<one-of-accepted-verdicts>" } (additional fields permitted). Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object. The runtime parses your response with JSON.parse and rejects the run on any parse failure or on a verdict not drawn from the accepted-verdicts list.';

function dispatchResponseInstruction(step: DispatchStep): string {
  return findDispatchShapeHint(step) ?? GENERIC_DISPATCH_SHAPE_HINT;
}

// v0 prompt composition: name the step, enumerate accepted verdicts, and
// inline every reads-declared artifact (or a clear placeholder if the
// reads artifact hasn't been written yet).
function composeDispatchPrompt(step: DispatchStep, runRoot: string): string {
  const readsBody =
    step.reads.length === 0
      ? '(no reads)'
      : step.reads
          .map((path) => {
            const abs = resolveRunRelative(runRoot, path);
            if (!existsSync(abs)) return `[reads unavailable: ${path}]`;
            return `--- ${path} ---\n${readFileSync(abs, 'utf8')}`;
          })
          .join('\n\n');
  return [
    `Step: ${step.id}`,
    `Title: ${step.title}`,
    `Role: ${step.role}`,
    `Accepted verdicts: ${step.gate.pass.join(', ')}`,
    '',
    'Context (from reads):',
    readsBody,
    '',
    dispatchResponseInstruction(step),
  ].join('\n');
}

function adapterFailureReason(stepId: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `dispatch step '${stepId}': adapter invocation failed (${message})`;
}

export async function runDispatchStep(
  ctx: StepHandlerContext & { readonly step: DispatchStep },
): Promise<StepHandlerResult> {
  const {
    runRoot,
    workflow,
    step,
    runId,
    rigor,
    attempt,
    recordedAt,
    push,
    state,
    dispatcher,
    now,
  } = ctx;
  const dispatcherInv = {
    dispatcher: ctx.dispatcher,
    selectionConfigLayers: ctx.executionSelectionConfigLayers,
  };

  const prompt = composeDispatchPrompt(step, runRoot);
  const resolvedSelection = deriveResolvedSelection(dispatcherInv, workflow, step, rigor);
  const dispatchInput: DispatchInput = { prompt, resolvedSelection };
  if (step.budgets?.wall_clock_ms !== undefined) {
    dispatchInput.timeoutMs = step.budgets.wall_clock_ms;
  }
  const resolvedFrom = deriveResolvedFrom(dispatcherInv);
  const requestAbs = resolveRunRelative(runRoot, step.writes.request);
  mkdirSync(dirname(requestAbs), { recursive: true });
  writeFileSync(requestAbs, prompt);
  const requestPayloadHash = sha256Hex(prompt);

  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'dispatch.started',
    step_id: step.id,
    attempt,
    adapter: { kind: 'builtin', name: dispatcher.adapterName },
    role: step.role,
    resolved_selection: resolvedSelection,
    resolved_from: resolvedFrom,
  });
  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'dispatch.request',
    step_id: step.id,
    attempt,
    request_payload_hash: requestPayloadHash,
  });

  let dispatchResult: DispatchResult;
  try {
    dispatchResult = await dispatcher.dispatch(dispatchInput);
  } catch (err) {
    const reason = adapterFailureReason(step.id as unknown as string, err);
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'dispatch.failed',
      step_id: step.id,
      attempt,
      adapter: { kind: 'builtin', name: dispatcher.adapterName },
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
      kind: 'gate.evaluated',
      step_id: step.id,
      attempt,
      gate_kind: 'result_verdict',
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

  state.dispatchResults.push({
    stepId: step.id as unknown as string,
    adapterName: dispatcher.adapterName,
    cli_version: dispatchResult.cli_version,
  });

  // Slice 53 (Codex H14 fold-in): evaluate the gate against the
  // adapter's actual result_body BEFORE materializing, so the
  // verdict written into `dispatch.completed` reflects what the
  // adapter declared (or a sentinel on unparseable / no-verdict
  // cases). The transcript still materializes either way — the
  // dispatch happened, and the request/receipt/result bytes are
  // durable evidence of the call regardless of admission.
  //
  // Slice 54 (Codex H15 fold-in): when the Slice 53 gate admits a
  // verdict AND the step declares `writes.artifact`, schema-parse
  // `dispatchResult.result_body` against `writes.artifact.schema`. A
  // parse failure coerces the evaluation to `kind: 'fail'` with the
  // parse reason — mirroring the Slice 53 reject-on-bad-verdict shape
  // so the content/schema failure-path event surface stays uniform.
  // Artifact write requires BOTH gate pass (Slice 53) AND schema parse
  // pass (Slice 54); failure on either path leaves
  // `writes.artifact.path` absent on disk.
  const gateEvaluation = evaluateDispatchGate(step, dispatchResult.result_body);
  let evaluation: GateEvaluation = gateEvaluation;
  if (gateEvaluation.kind === 'pass' && step.writes.artifact !== undefined) {
    const parseResult = parseArtifact(step.writes.artifact.schema, dispatchResult.result_body);
    if (parseResult.kind === 'fail') {
      evaluation = {
        kind: 'fail',
        reason: `dispatch step '${step.id}': ${parseResult.reason}`,
        observedVerdict: gateEvaluation.verdict,
      };
    } else {
      // Cross-artifact validation enforces constraints that span more
      // than one artifact (e.g., sweep.batch.items[].candidate_id ⊆
      // sweep.queue.to_execute). Returns ok for schemas with no
      // registered cross-artifact rule.
      const crossResult = runCrossArtifactValidator(
        step.writes.artifact.schema,
        workflow,
        runRoot,
        dispatchResult.result_body,
      );
      if (crossResult.kind === 'fail') {
        evaluation = {
          kind: 'fail',
          reason: `dispatch step '${step.id}': ${crossResult.reason}`,
          observedVerdict: gateEvaluation.verdict,
        };
      }
    }
  }
  const dispatchCompletedVerdict =
    evaluation.kind === 'pass'
      ? evaluation.verdict
      : (evaluation.observedVerdict ?? NO_VERDICT_SENTINEL);

  // Slice 53 (Codex H2 fold-in): gate the canonical artifact write on
  // `evaluation.kind === 'pass'` per ADR-0008 §Decision.3a — the
  // canonical downstream-readable artifact at `writes.artifact.path`
  // is materialized ONLY after the verdict gate passes. The transcript
  // slots (request / receipt / result) remain durable evidence on
  // either path.
  const materialized = materializeDispatch({
    runId,
    stepId: step.id,
    attempt,
    role: step.role,
    startingSequence: state.sequence,
    runRoot,
    writes: {
      request: step.writes.request,
      receipt: step.writes.receipt,
      result: step.writes.result,
      ...(step.writes.artifact === undefined || evaluation.kind !== 'pass'
        ? {}
        : { artifact: step.writes.artifact }),
    },
    adapterName: dispatcher.adapterName,
    resolvedSelection,
    resolvedFrom,
    dispatchResult,
    verdict: dispatchCompletedVerdict,
    now,
    priorStart: { requestPayloadHash },
  });
  // Adversarial-review fix #12: emit through push() rather than
  // mutating state.events directly. push() overwrites each event's
  // sequence atomically, so the materializer's pre-assigned sequences
  // (and `sequenceAfter`) become advisory — they remain on the return
  // shape because tests call materializeDispatch directly and assert
  // on its event array. The state.sequence advance previously done
  // manually here is now handled by push() per emission.
  for (const ev of materialized.events) {
    push(ev);
  }

  if (evaluation.kind === 'pass') {
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'gate.evaluated',
      step_id: step.id,
      attempt,
      gate_kind: 'result_verdict',
      outcome: 'pass',
    });
    return { kind: 'advance' };
  }

  // Slice 53 (Codex H14 fold-in): gate-fail termination path.
  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'gate.evaluated',
    step_id: step.id,
    attempt,
    gate_kind: 'result_verdict',
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
