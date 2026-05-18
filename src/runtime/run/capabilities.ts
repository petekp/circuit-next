import type { CompiledFlowProgressSurface } from '../../flows/types.js';
import type { LayeredConfig as LayeredConfigValue } from '../../schemas/config.js';
import type {
  ProgressReporter,
  RelayFn,
  RuntimeEvidencePolicy,
} from '../../shared/relay-runtime-types.js';
import type { ExecutorRegistry } from '../executors/index.js';
import type { RelayConnector } from '../executors/relay.js';
import type {
  ChildCompiledFlowResolver,
  CompiledFlowRunner,
  WorktreeRunner,
} from './child-runner.js';

export const RUNTIME_CAPABILITY_NAMES = [
  'now',
  'executors',
  'childExecutors',
  'childCompiledFlowResolver',
  'childRunner',
  'projectRoot',
  'evidencePolicy',
  'worktreeRunner',
  'relayConnector',
  'relayer',
  'selectionConfigLayers',
  'progress',
  'progressSurface',
] as const;

export type RuntimeCapabilityName = (typeof RUNTIME_CAPABILITY_NAMES)[number];

export interface RuntimeExecutionCapabilities {
  readonly now?: () => Date;
  readonly executors?: Partial<ExecutorRegistry>;
  readonly childExecutors?: Partial<ExecutorRegistry>;
  readonly childCompiledFlowResolver?: ChildCompiledFlowResolver;
  readonly childRunner?: CompiledFlowRunner;
  readonly projectRoot?: string;
  readonly evidencePolicy?: RuntimeEvidencePolicy;
  readonly worktreeRunner?: WorktreeRunner;
  readonly relayConnector?: RelayConnector;
  readonly relayer?: RelayFn;
  readonly selectionConfigLayers?: readonly LayeredConfigValue[];
  readonly progress?: ProgressReporter;
  readonly progressSurface?: CompiledFlowProgressSurface;
}
