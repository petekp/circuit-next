import { randomUUID } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CompiledFlow } from '../../schemas/compiled-flow.js';
import { RunId } from '../../schemas/ids.js';
import { resultPath } from '../result-writer.js';
import { resolveRunRelative } from '../run-relative-path.js';
import type { CompiledFlowInvocation } from '../runner-types.js';
import { isRunRelativePathError } from './shared.js';
import type { StepHandlerContext, StepHandlerResult } from './types.js';

type SubRunStep = CompiledFlow['steps'][number] & { kind: 'sub-run' };

const NO_VERDICT_SENTINEL = '<no-verdict>';

interface ChildVerdict {
  readonly verdict: string;
  readonly admitted: boolean;
  readonly failureReason?: string;
}

function evaluateChildVerdict(step: SubRunStep, resultBody: string): ChildVerdict {
  let parsed: unknown;
  try {
    parsed = JSON.parse(resultBody);
  } catch {
    return {
      verdict: NO_VERDICT_SENTINEL,
      admitted: false,
      failureReason: `sub-run step '${step.id}': child result body did not parse as JSON`,
    };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      verdict: NO_VERDICT_SENTINEL,
      admitted: false,
      failureReason: `sub-run step '${step.id}': child result body parsed but is not a JSON object`,
    };
  }
  const verdictRaw = (parsed as Record<string, unknown>).verdict;
  if (typeof verdictRaw !== 'string' || verdictRaw.length === 0) {
    return {
      verdict: NO_VERDICT_SENTINEL,
      admitted: false,
      failureReason: `sub-run step '${step.id}': child result body lacks a non-empty string 'verdict' field`,
    };
  }
  if (!step.check.pass.includes(verdictRaw)) {
    return {
      verdict: verdictRaw,
      admitted: false,
      failureReason: `sub-run step '${step.id}': child verdict '${verdictRaw}' is not in check.pass [${step.check.pass.join(', ')}]`,
    };
  }
  return { verdict: verdictRaw, admitted: true };
}

export async function runSubRunStep(
  ctx: StepHandlerContext & { readonly step: SubRunStep },
): Promise<StepHandlerResult> {
  const {
    runFolder,
    step,
    runId,
    attempt,
    recordedAt,
    push,
    state,
    now,
    childRunner,
    childCompiledFlowResolver,
    relayer,
    composeWriter,
    executionSelectionConfigLayers,
    projectRoot,
    change_kind,
  } = ctx;

  if (step.writes.report !== undefined && step.writes.report.path !== step.writes.result) {
    // v0 narrows scope: writes.report materialization (republishing the
    // child's primary report into a parent slot at a DIFFERENT path)
    // is not yet wired — semantics depend on what "republish verbatim"
    // means for each child flow, and there's no consumer driving the
    // choice yet. The schema-annotation case (report.path equals
    // result path) is allowed: the result.json IS the typed report,
    // and downstream lookups via reportPathForSchemaInCompiledFlow can
    // find this sub-run step by its declared schema. Authors who
    // declare a divergent report path today get a loud abort rather
    // than silent omission.
    const reason = `sub-run step '${step.id}': writes.report materialization at a path different from writes.result is not yet supported; either omit writes.report or declare it with the same path as writes.result (schema-annotation form)`;
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

  if (childCompiledFlowResolver === undefined) {
    const reason = `sub-run step '${step.id}': CompiledFlowInvocation.childCompiledFlowResolver is required to resolve child flow '${step.flow_ref.flow_id as unknown as string}'`;
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

  // RUN-I3: child gets a fresh RunId. Audit linkage flows through
  // sub_run.{started,completed} trace_entrys at the parent step boundary —
  // not by sharing the parent's run_id. Child run-folders are sibling
  // directories under the parent's runs base, NOT nested under the
  // parent's run-folder.
  const childRunId: RunId = RunId.parse(randomUUID());
  const runsBase = dirname(runFolder);
  const childRunFolder = `${runsBase}/${childRunId as unknown as string}`;
  mkdirSync(runsBase, { recursive: true });

  let resolved: { flow: CompiledFlow; bytes: Buffer };
  try {
    resolved = childCompiledFlowResolver(step.flow_ref);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const reason = `sub-run step '${step.id}': child flow resolution failed (${message})`;
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

  if ((resolved.flow.id as unknown as string) !== (step.flow_ref.flow_id as unknown as string)) {
    const reason = `sub-run step '${step.id}': resolver returned flow id '${resolved.flow.id as unknown as string}' but flow_ref names '${step.flow_ref.flow_id as unknown as string}'`;
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

  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'sub_run.started',
    step_id: step.id,
    attempt,
    child_run_id: childRunId,
    child_flow_id: resolved.flow.id,
    child_entry_mode: step.flow_ref.entry_mode,
    child_depth: step.depth,
  });

  const startMs = Date.now();
  const childInvocation: CompiledFlowInvocation = {
    runFolder: childRunFolder,
    flow: resolved.flow,
    flowBytes: resolved.bytes,
    runId: childRunId,
    goal: step.goal,
    depth: step.depth,
    entryModeName: step.flow_ref.entry_mode,
    change_kind,
    now,
    relayer,
    composeWriter,
    selectionConfigLayers: executionSelectionConfigLayers,
    childCompiledFlowResolver,
    ...(projectRoot === undefined ? {} : { projectRoot }),
  };

  let childResult: Awaited<ReturnType<typeof childRunner>>;
  try {
    childResult = await childRunner(childInvocation);
  } catch (err) {
    if (isRunRelativePathError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    const reason = `sub-run step '${step.id}': child flow invocation failed (${message})`;
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

  if (childResult.result.outcome === 'checkpoint_waiting') {
    // v0 narrows scope: a child sub-run that waited at a checkpoint
    // cannot be resumed through the parent's checkpoint-resume API
    // (parent's `current_step` is a sub-run, not a checkpoint). This is
    // a future-slice concern. Practically, child depth of lite /
    // standard / autonomous resolves checkpoints automatically; deep /
    // tournament depth on a child is the path that surfaces this.
    const reason = `sub-run step '${step.id}': child flow waited at checkpoint '${childResult.result.checkpoint.step_id}'; nested checkpoint resume is not yet supported in v0 (use child depth lite/standard/autonomous to auto-resolve)`;
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

  const durationMs = Math.max(0, Date.now() - startMs);
  const childResultPathAbs = resultPath(childRunFolder);
  const childResultBody = readFileSync(childResultPathAbs, 'utf8');

  const parentResultAbs = resolveRunRelative(runFolder, step.writes.result);
  mkdirSync(dirname(parentResultAbs), { recursive: true });
  copyFileSync(childResultPathAbs, parentResultAbs);

  const verdictEvaluation = evaluateChildVerdict(step, childResultBody);

  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'sub_run.completed',
    step_id: step.id,
    attempt,
    child_run_id: childRunId,
    child_outcome: childResult.result.outcome,
    verdict: verdictEvaluation.verdict,
    duration_ms: durationMs,
    result_path: step.writes.result,
  });

  if (verdictEvaluation.admitted && childResult.result.outcome === 'complete') {
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

  // Check-fail termination path. Verdict was either rejected by check.pass,
  // unparseable, or child closed with a non-complete RunClosedOutcome
  // (aborted / handoff / stopped / escalated). Each is a runtime-level
  // sub-run failure even when the verdict itself is in check.pass — a
  // child that aborts midway hasn't earned the verdict it might emit.
  const reason =
    verdictEvaluation.failureReason ??
    `sub-run step '${step.id}': child closed with outcome '${childResult.result.outcome}'`;
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
