import type { StepKindV2, StepOutcomeV2 } from '../domain/step.js';
import type { ExecutableStepV2 } from '../manifest/executable-flow.js';
import type { RunContextV2 } from '../run/run-context.js';
import { executeCheckpointV2 } from './checkpoint.js';
import { executeComposeV2 } from './compose.js';
import { executeFanoutV2 } from './fanout.js';
import { type RelayConnectorV2, executeRelayV2 } from './relay.js';
import { executeSubRunV2 } from './sub-run.js';
import { executeVerificationV2 } from './verification.js';

export type StepExecutorV2 = (
  step: ExecutableStepV2,
  context: RunContextV2,
) => Promise<StepOutcomeV2>;

export type ExecutorRegistryV2 = Readonly<Record<StepKindV2, StepExecutorV2>>;

export interface DefaultExecutorOptionsV2 {
  readonly relayConnector?: RelayConnectorV2;
}

function unsupportedStep(step: ExecutableStepV2): never {
  throw new Error(`step kind '${step.kind}' is not implemented in core-v2 baseline`);
}

export function createDefaultExecutorsV2(
  options: DefaultExecutorOptionsV2 = {},
): ExecutorRegistryV2 {
  const relayConnector = options.relayConnector;
  return {
    compose: async (step, context) => {
      if (step.kind !== 'compose') return unsupportedStep(step);
      return executeComposeV2(step, context);
    },
    relay: async (step, context) => {
      if (step.kind !== 'relay') return unsupportedStep(step);
      return executeRelayV2(step, context, relayConnector);
    },
    verification: async (step, context) => {
      if (step.kind !== 'verification') return unsupportedStep(step);
      return executeVerificationV2(step, context);
    },
    checkpoint: async (step, context) => {
      if (step.kind !== 'checkpoint') return unsupportedStep(step);
      return executeCheckpointV2(step, context);
    },
    'sub-run': async (step, context) => {
      if (step.kind !== 'sub-run') return unsupportedStep(step);
      return executeSubRunV2(step, context);
    },
    fanout: async (step, context) => {
      if (step.kind !== 'fanout') return unsupportedStep(step);
      return executeFanoutV2(step, context, relayConnector);
    },
  };
}
