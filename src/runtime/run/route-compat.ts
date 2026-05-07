import type { CompiledFlow } from '../../schemas/compiled-flow.js';
import { recoveryRouteForStep } from '../../shared/recovery-route.js';
import type { ExecutableStep } from '../manifest/executable-flow.js';
import type { RunContext } from './run-context.js';

export function requireCompiledFlow(context: RunContext, step: ExecutableStep): CompiledFlow {
  if (context.compiledFlow === undefined) {
    throw new Error(
      `step '${step.id}' requires compiled-flow v1 context for production ${step.kind} execution`,
    );
  }
  return context.compiledFlow;
}

export function requireCompiledStep<Kind extends CompiledFlow['steps'][number]['kind']>(
  context: RunContext,
  step: ExecutableStep,
  kind: Kind,
): Extract<CompiledFlow['steps'][number], { kind: Kind }> {
  const flow = requireCompiledFlow(context, step);
  const compiledStep = flow.steps.find((candidate) => candidate.id === step.id);
  if (compiledStep === undefined) {
    throw new Error(`compiled-flow v1 context has no step '${step.id}'`);
  }
  if (compiledStep.kind !== kind) {
    throw new Error(
      `compiled-flow v1 step '${step.id}' has kind '${compiledStep.kind}', expected '${kind}'`,
    );
  }
  return compiledStep as Extract<CompiledFlow['steps'][number], { kind: Kind }>;
}

export function recoveryRouteForExecutableStep(step: ExecutableStep): string | undefined {
  return recoveryRouteForStep(step);
}
