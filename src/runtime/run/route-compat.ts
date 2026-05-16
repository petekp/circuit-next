import {
  type RuntimeIndexedStep,
  requireRuntimeIndexedStep,
} from '../../flows/registries/runtime-index.js';
import { recoveryRouteForStep } from '../../shared/recovery-route.js';
import type { ExecutableStep } from '../manifest/executable-flow.js';
import type { RunContext } from './run-context.js';

export function requireRuntimeStep<Kind extends RuntimeIndexedStep['kind']>(
  context: RunContext,
  step: ExecutableStep,
  kind: Kind,
): Extract<RuntimeIndexedStep, { readonly kind: Kind }> {
  return requireRuntimeIndexedStep(context.packageIndex, step.id, kind);
}

export function recoveryRouteForExecutableStep(step: ExecutableStep): string | undefined {
  return recoveryRouteForStep(step);
}
