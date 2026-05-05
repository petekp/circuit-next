import type { LayeredConfig as LayeredConfigValue } from '../../schemas/config.js';
import type {
  ProgressReporter,
  RelayFn,
  RuntimeEvidencePolicy,
} from '../../shared/relay-runtime-types.js';
import type { ExecutorRegistryV2 } from '../executors/index.js';
import type { RelayConnectorV2 } from '../executors/relay.js';
import type { GraphRunResultV2 } from './graph-runner.js';

export interface ChildFlowRefV2 {
  readonly flowId: string;
  readonly entryMode: string;
  readonly version?: string;
}

export interface ResolvedChildFlowV2 {
  readonly flowBytes: Uint8Array;
}

export type ChildCompiledFlowResolverV2 = (
  ref: ChildFlowRefV2,
) => ResolvedChildFlowV2 | Promise<ResolvedChildFlowV2>;

export interface WorktreeProvisionInputV2 {
  readonly worktreePath: string;
  readonly baseRef: string;
  readonly branchName: string;
}

export interface WorktreeRunnerV2 {
  add(input: WorktreeProvisionInputV2): void | Promise<void>;
  remove(worktreePath: string): void | Promise<void>;
  changedFiles?(
    worktreePath: string,
    baseRef: string,
  ): readonly string[] | Promise<readonly string[]>;
}

export interface CompiledFlowRunOptionsV2Like {
  readonly flowBytes: Uint8Array;
  readonly runDir: string;
  readonly runId?: string;
  readonly goal: string;
  readonly entryModeName?: string;
  readonly depth?: string;
  readonly now?: () => Date;
  readonly executors?: Partial<ExecutorRegistryV2>;
  readonly childExecutors?: Partial<ExecutorRegistryV2>;
  readonly childCompiledFlowResolver?: ChildCompiledFlowResolverV2;
  readonly childRunner?: CompiledFlowRunnerV2;
  readonly projectRoot?: string;
  readonly evidencePolicy?: RuntimeEvidencePolicy;
  readonly worktreeRunner?: WorktreeRunnerV2;
  readonly relayConnector?: RelayConnectorV2;
  readonly relayer?: RelayFn;
  readonly selectionConfigLayers?: readonly LayeredConfigValue[];
  readonly progress?: ProgressReporter;
  readonly maxSteps?: number;
}

export type CompiledFlowRunnerV2 = (
  options: CompiledFlowRunOptionsV2Like,
) => Promise<GraphRunResultV2>;
