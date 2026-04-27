import { randomUUID } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { RunId } from '../../schemas/ids.js';
import type { Workflow } from '../../schemas/workflow.js';
import { resultPath } from '../result-writer.js';
import { resolveRunRelative } from '../run-relative-path.js';
import type { WorkflowInvocation } from '../runner-types.js';
import { isRunRelativePathError } from './shared.js';
import type { StepHandlerContext, StepHandlerResult } from './types.js';

type SubRunStep = Workflow['steps'][number] & { kind: 'sub-run' };

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
  if (!step.gate.pass.includes(verdictRaw)) {
    return {
      verdict: verdictRaw,
      admitted: false,
      failureReason: `sub-run step '${step.id}': child verdict '${verdictRaw}' is not in gate.pass [${step.gate.pass.join(', ')}]`,
    };
  }
  return { verdict: verdictRaw, admitted: true };
}

export async function runSubRunStep(
  ctx: StepHandlerContext & { readonly step: SubRunStep },
): Promise<StepHandlerResult> {
  const {
    runRoot,
    step,
    runId,
    attempt,
    recordedAt,
    push,
    state,
    now,
    childRunner,
    childWorkflowResolver,
    dispatcher,
    synthesisWriter,
    executionSelectionConfigLayers,
    projectRoot,
    lane,
  } = ctx;

  if (step.writes.artifact !== undefined && step.writes.artifact.path !== step.writes.result) {
    // v0 narrows scope: writes.artifact materialization (republishing the
    // child's primary artifact into a parent slot at a DIFFERENT path)
    // is not yet wired — semantics depend on what "republish verbatim"
    // means for each child workflow, and there's no consumer driving the
    // choice yet. The schema-annotation case (artifact.path equals
    // result path) is allowed: the result.json IS the typed artifact,
    // and downstream lookups via artifactPathForSchemaInWorkflow can
    // find this sub-run step by its declared schema. Authors who
    // declare a divergent artifact path today get a loud abort rather
    // than silent omission.
    const reason = `sub-run step '${step.id}': writes.artifact materialization at a path different from writes.result is not yet supported; either omit writes.artifact or declare it with the same path as writes.result (schema-annotation form)`;
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

  if (childWorkflowResolver === undefined) {
    const reason = `sub-run step '${step.id}': WorkflowInvocation.childWorkflowResolver is required to resolve child workflow '${step.workflow_ref.workflow_id as unknown as string}'`;
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

  // RUN-I3: child gets a fresh RunId. Audit linkage flows through
  // sub_run.{started,completed} events at the parent step boundary —
  // not by sharing the parent's run_id. Child run-roots are sibling
  // directories under the parent's runs base, NOT nested under the
  // parent's run-root.
  const childRunId: RunId = RunId.parse(randomUUID());
  const runsBase = dirname(runRoot);
  const childRunRoot = `${runsBase}/${childRunId as unknown as string}`;
  mkdirSync(runsBase, { recursive: true });

  let resolved: { workflow: Workflow; bytes: Buffer };
  try {
    resolved = childWorkflowResolver(step.workflow_ref);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const reason = `sub-run step '${step.id}': child workflow resolution failed (${message})`;
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

  if (
    (resolved.workflow.id as unknown as string) !==
    (step.workflow_ref.workflow_id as unknown as string)
  ) {
    const reason = `sub-run step '${step.id}': resolver returned workflow id '${resolved.workflow.id as unknown as string}' but workflow_ref names '${step.workflow_ref.workflow_id as unknown as string}'`;
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

  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'sub_run.started',
    step_id: step.id,
    attempt,
    child_run_id: childRunId,
    child_workflow_id: resolved.workflow.id,
    child_entry_mode: step.workflow_ref.entry_mode,
    child_rigor: step.rigor,
  });

  const startMs = Date.now();
  const childInvocation: WorkflowInvocation = {
    runRoot: childRunRoot,
    workflow: resolved.workflow,
    workflowBytes: resolved.bytes,
    runId: childRunId,
    goal: step.goal,
    rigor: step.rigor,
    entryModeName: step.workflow_ref.entry_mode,
    lane,
    now,
    dispatcher,
    synthesisWriter,
    selectionConfigLayers: executionSelectionConfigLayers,
    childWorkflowResolver,
    ...(projectRoot === undefined ? {} : { projectRoot }),
  };

  let childResult: Awaited<ReturnType<typeof childRunner>>;
  try {
    childResult = await childRunner(childInvocation);
  } catch (err) {
    if (isRunRelativePathError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    const reason = `sub-run step '${step.id}': child workflow invocation failed (${message})`;
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

  if (childResult.result.outcome === 'checkpoint_waiting') {
    // v0 narrows scope: a child sub-run that waited at a checkpoint
    // cannot be resumed through the parent's checkpoint-resume API
    // (parent's `current_step` is a sub-run, not a checkpoint). This is
    // a future-slice concern. Practically, child rigor of lite /
    // standard / autonomous resolves checkpoints automatically; deep /
    // tournament rigor on a child is the path that surfaces this.
    const reason = `sub-run step '${step.id}': child workflow waited at checkpoint '${childResult.result.checkpoint.step_id}'; nested checkpoint resume is not yet supported in v0 (use child rigor lite/standard/autonomous to auto-resolve)`;
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

  const durationMs = Math.max(0, Date.now() - startMs);
  const childResultPathAbs = resultPath(childRunRoot);
  const childResultBody = readFileSync(childResultPathAbs, 'utf8');

  const parentResultAbs = resolveRunRelative(runRoot, step.writes.result);
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
      kind: 'gate.evaluated',
      step_id: step.id,
      attempt,
      gate_kind: 'result_verdict',
      outcome: 'pass',
    });
    return { kind: 'advance' };
  }

  // Gate-fail termination path. Verdict was either rejected by gate.pass,
  // unparseable, or child closed with a non-complete RunClosedOutcome
  // (aborted / handoff / stopped / escalated). Each is a runtime-level
  // sub-run failure even when the verdict itself is in gate.pass — a
  // child that aborts midway hasn't earned the verdict it might emit.
  const reason =
    verdictEvaluation.failureReason ??
    `sub-run step '${step.id}': child closed with outcome '${childResult.result.outcome}'`;
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
