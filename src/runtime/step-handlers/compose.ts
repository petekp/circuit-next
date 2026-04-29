import type { CompiledFlow } from '../../schemas/compiled-flow.js';
import { isRunRelativePathError } from './shared.js';
import type { StepHandlerContext, StepHandlerResult } from './types.js';

type ComposeStep = CompiledFlow['steps'][number] & { kind: 'compose' };

function composeFailureReason(stepId: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `compose step '${stepId}': report writer failed (${message})`;
}

export function runComposeStep(
  ctx: StepHandlerContext & { readonly step: ComposeStep },
): StepHandlerResult {
  const {
    runFolder,
    flow,
    step,
    goal,
    runId,
    attempt,
    recordedAt,
    push,
    state,
    projectRoot,
    evidencePolicy,
  } = ctx;
  try {
    ctx.composeWriter({
      runFolder,
      flow,
      step,
      goal,
      ...(projectRoot === undefined ? {} : { projectRoot }),
      ...(evidencePolicy === undefined ? {} : { evidencePolicy }),
    });
  } catch (err) {
    if (isRunRelativePathError(err)) throw err;
    const reason = composeFailureReason(step.id as unknown as string, err);
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'check.evaluated',
      step_id: step.id,
      attempt,
      check_kind: 'schema_sections',
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
    kind: 'step.report_written',
    step_id: step.id,
    attempt,
    report_path: step.writes.report.path,
    report_schema: step.writes.report.schema,
  });
  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'check.evaluated',
    step_id: step.id,
    attempt,
    check_kind: 'schema_sections',
    outcome: 'pass',
  });
  return { kind: 'advance' };
}
