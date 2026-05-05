import type { CompiledFlow } from '../../schemas/compiled-flow.js';
import type { ExecutableStepV2 } from '../manifest/executable-flow.js';
import type { RunContextV2 } from './run-context.js';

export function requireCompiledFlowV1(context: RunContextV2, step: ExecutableStepV2): CompiledFlow {
  if (context.compiledFlowV1 === undefined) {
    throw new Error(
      `step '${step.id}' requires compiled-flow v1 context for production ${step.kind} execution`,
    );
  }
  return context.compiledFlowV1;
}

export function requireCompiledStepV1<Kind extends CompiledFlow['steps'][number]['kind']>(
  context: RunContextV2,
  step: ExecutableStepV2,
  kind: Kind,
): Extract<CompiledFlow['steps'][number], { kind: Kind }> {
  const flow = requireCompiledFlowV1(context, step);
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

export function recoveryRouteForExecutableStep(step: ExecutableStepV2): string | undefined {
  for (const route of ['retry', 'revise', 'ask', 'stop', 'handoff', 'escalate']) {
    if (Object.hasOwn(step.routes, route)) return route;
  }
  return undefined;
}
