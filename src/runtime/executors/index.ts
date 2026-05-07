import type { StepKind, StepOutcome } from '../domain/step.js';
import type { ExecutableStep } from '../manifest/executable-flow.js';
import type { RunContext } from '../run/run-context.js';
import { executeCheckpoint } from './checkpoint.js';
import { executeCompose } from './compose.js';
import { executeFanout } from './fanout.js';
import { type RelayConnector, executeRelay } from './relay.js';
import { executeSubRun } from './sub-run.js';
import { executeVerification } from './verification.js';

export type StepExecutor = (step: ExecutableStep, context: RunContext) => Promise<StepOutcome>;

export type ExecutorRegistry = Readonly<Record<StepKind, StepExecutor>>;

export interface DefaultExecutorOptions {
  readonly relayConnector?: RelayConnector;
}

function unsupportedStep(step: ExecutableStep): never {
  throw new Error(`step kind '${step.kind}' is not implemented in runtime baseline`);
}

export function createDefaultExecutors(options: DefaultExecutorOptions = {}): ExecutorRegistry {
  const relayConnector = options.relayConnector;
  return {
    compose: async (step, context) => {
      if (step.kind !== 'compose') return unsupportedStep(step);
      return executeCompose(step, context);
    },
    relay: async (step, context) => {
      if (step.kind !== 'relay') return unsupportedStep(step);
      return executeRelay(step, context, relayConnector);
    },
    verification: async (step, context) => {
      if (step.kind !== 'verification') return unsupportedStep(step);
      return executeVerification(step, context);
    },
    checkpoint: async (step, context) => {
      if (step.kind !== 'checkpoint') return unsupportedStep(step);
      return executeCheckpoint(step, context);
    },
    'sub-run': async (step, context) => {
      if (step.kind !== 'sub-run') return unsupportedStep(step);
      return executeSubRun(step, context);
    },
    fanout: async (step, context) => {
      if (step.kind !== 'fanout') return unsupportedStep(step);
      return executeFanout(step, context, relayConnector);
    },
  };
}
