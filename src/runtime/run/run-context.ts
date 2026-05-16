import type { RuntimePackageIndex } from '../../flows/registries/runtime-index.js';
import type { LayeredConfig as LayeredConfigValue } from '../../schemas/config.js';
import type {
  ProgressReporter,
  RelayFn,
  RuntimeEvidencePolicy,
} from '../../shared/relay-runtime-types.js';
import type { RunId } from '../domain/run.js';
import type { ExecutorRegistry } from '../executors/index.js';
import type { RelayConnector } from '../executors/relay.js';
import type { ExecutableFlow } from '../manifest/executable-flow.js';
import type { RunFileStore } from '../run-files/run-file-store.js';
import type { TraceStore } from '../trace/trace-store.js';
import type {
  ChildCompiledFlowResolver,
  CompiledFlowRunner,
  WorktreeRunner,
} from './child-runner.js';

export interface RunContext {
  readonly flow: ExecutableFlow;
  readonly packageIndex: RuntimePackageIndex;
  readonly runId: RunId;
  readonly runDir: string;
  readonly goal: string;
  readonly manifestHash: string;
  readonly entryModeName?: string;
  readonly depth?: string;
  readonly now: () => Date;
  readonly files: RunFileStore;
  readonly trace: TraceStore;
  readonly childCompiledFlowResolver?: ChildCompiledFlowResolver;
  readonly childRunner?: CompiledFlowRunner;
  readonly childExecutors?: Partial<ExecutorRegistry>;
  readonly projectRoot?: string;
  readonly evidencePolicy?: RuntimeEvidencePolicy;
  readonly worktreeRunner?: WorktreeRunner;
  readonly relayConnector?: RelayConnector;
  readonly relayer?: RelayFn;
  readonly selectionConfigLayers?: readonly LayeredConfigValue[];
  readonly progress?: ProgressReporter;
  readonly activeStepAttempt?: number;
  readonly resumeCheckpoint?: {
    readonly stepId: string;
    readonly attempt: number;
    readonly selection: string;
  };
}
