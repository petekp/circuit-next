import type { Workflow } from '../../schemas/workflow.js';
import { isRunRelativePathError } from './shared.js';
import type { StepHandlerContext, StepHandlerResult } from './types.js';

type SynthesisStep = Workflow['steps'][number] & { kind: 'synthesis' };

function synthesisFailureReason(stepId: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `synthesis step '${stepId}': artifact writer failed (${message})`;
}

export function runSynthesisStep(
  ctx: StepHandlerContext & { readonly step: SynthesisStep },
): StepHandlerResult {
  const { runRoot, workflow, step, goal, runId, attempt, recordedAt, push, state } = ctx;
  try {
    ctx.synthesisWriter({ runRoot, workflow, step, goal });
  } catch (err) {
    if (isRunRelativePathError(err)) throw err;
    const reason = synthesisFailureReason(step.id as unknown as string, err);
    push({
      schema_version: 1,
      sequence: state.sequence,
      recorded_at: recordedAt(),
      run_id: runId,
      kind: 'gate.evaluated',
      step_id: step.id,
      attempt,
      gate_kind: 'schema_sections',
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
    kind: 'step.artifact_written',
    step_id: step.id,
    attempt,
    artifact_path: step.writes.artifact.path,
    artifact_schema: step.writes.artifact.schema,
  });
  push({
    schema_version: 1,
    sequence: state.sequence,
    recorded_at: recordedAt(),
    run_id: runId,
    kind: 'gate.evaluated',
    step_id: step.id,
    attempt,
    gate_kind: 'schema_sections',
    outcome: 'pass',
  });
  return { kind: 'advance' };
}
