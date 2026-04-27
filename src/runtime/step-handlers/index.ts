import { runCheckpointStep } from './checkpoint.js';
import { runDispatchStep } from './dispatch.js';
import { runSynthesisStep } from './synthesis.js';
import type { StepHandlerContext, StepHandlerResult } from './types.js';
import { runVerificationStep } from './verification.js';

export type { StepHandlerContext, StepHandlerResult } from './types.js';
export type { RunState, ResumeCheckpointState } from './types.js';
export { checkpointChoiceIds, checkpointRequestBody } from './checkpoint.js';

export async function runStepHandler(ctx: StepHandlerContext): Promise<StepHandlerResult> {
  switch (ctx.step.kind) {
    case 'synthesis':
      return runSynthesisStep({ ...ctx, step: ctx.step });
    case 'verification':
      return runVerificationStep({ ...ctx, step: ctx.step });
    case 'checkpoint':
      return runCheckpointStep({ ...ctx, step: ctx.step });
    case 'dispatch':
      return runDispatchStep({ ...ctx, step: ctx.step });
    default: {
      // sub-run and fanout step kinds reach this branch until the
      // matching slices land. Compose + parallelism schemas were
      // committed (a5a80ee) ahead of runtime so Migrate authoring can
      // type-compile against them; runtime support arrives in the
      // sub-run and fanout slices that follow this extraction.
      const stepKind = (ctx.step as { readonly kind: string }).kind;
      const stepId = (ctx.step as { readonly id: string | { toString(): string } }).id;
      const idStr =
        typeof stepId === 'string' ? stepId : (stepId as { toString(): string }).toString();
      throw new Error(
        `step '${idStr}' has unsupported kind '${stepKind}'; no handler registered`,
      );
    }
  }
}
