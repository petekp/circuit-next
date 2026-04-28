import { runCheckpointStep } from './checkpoint.js';
import { runComposeStep } from './compose.js';
import { runFanoutStep } from './fanout.js';
import { runRelayStep } from './relay.js';
import { runSubRunStep } from './sub-run.js';
import type { StepHandlerContext, StepHandlerResult } from './types.js';
import { runVerificationStep } from './verification.js';

export type { StepHandlerContext, StepHandlerResult } from './types.js';
export type { RunState, ResumeCheckpointState } from './types.js';
export { checkpointChoiceIds, checkpointRequestBody } from './checkpoint.js';

export async function runStepHandler(ctx: StepHandlerContext): Promise<StepHandlerResult> {
  switch (ctx.step.kind) {
    case 'compose':
      return runComposeStep({ ...ctx, step: ctx.step });
    case 'verification':
      return runVerificationStep({ ...ctx, step: ctx.step });
    case 'checkpoint':
      return runCheckpointStep({ ...ctx, step: ctx.step });
    case 'relay':
      return runRelayStep({ ...ctx, step: ctx.step });
    case 'sub-run':
      return runSubRunStep({ ...ctx, step: ctx.step });
    case 'fanout':
      return runFanoutStep({ ...ctx, step: ctx.step });
    default: {
      const stepKind = (ctx.step as { readonly kind: string }).kind;
      const stepId = (ctx.step as { readonly id: string | { toString(): string } }).id;
      const idStr =
        typeof stepId === 'string' ? stepId : (stepId as { toString(): string }).toString();
      throw new Error(`step '${idStr}' has unsupported kind '${stepKind}'; no handler registered`);
    }
  }
}
