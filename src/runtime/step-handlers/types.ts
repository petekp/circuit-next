import type { ChangeKindDeclaration } from '../../schemas/change-kind.js';
import type { CompiledFlow } from '../../schemas/compiled-flow.js';
import type { LayeredConfig as LayeredConfigValue } from '../../schemas/config.js';
import type { Depth } from '../../schemas/depth.js';
import type { InvocationId, RunId } from '../../schemas/ids.js';
import type { TraceEntry } from '../../schemas/trace-entry.js';
import type {
  ChildCompiledFlowResolver,
  CompiledFlowRunner,
  ComposeWriterFn,
  RelayFn,
  RelayResultMetadata,
  RuntimeEvidencePolicy,
  WorktreeRunner,
} from '../runner-types.js';

export interface RunState {
  readonly trace_entries: TraceEntry[];
  sequence: number;
  readonly relayResults: RelayResultMetadata[];
}

export interface ResumeCheckpointState {
  readonly stepId: string;
  readonly attempt: number;
  readonly selection: string;
}

export interface StepHandlerContext {
  readonly runFolder: string;
  readonly flow: CompiledFlow;
  readonly runId: RunId;
  readonly goal: string;
  readonly change_kind: ChangeKindDeclaration;
  readonly depth: Depth;
  readonly executionSelectionConfigLayers: readonly LayeredConfigValue[];
  readonly projectRoot?: string;
  readonly evidencePolicy?: RuntimeEvidencePolicy;
  readonly invocationId?: InvocationId;
  readonly relayer?: RelayFn;
  readonly composeWriter: ComposeWriterFn;
  readonly now: () => Date;
  readonly recordedAt: () => string;
  readonly state: RunState;
  readonly push: (ev: TraceEntry) => void;
  readonly step: CompiledFlow['steps'][number];
  readonly attempt: number;
  readonly isResumedCheckpoint: boolean;
  readonly resumeCheckpoint?: ResumeCheckpointState;
  // Sub-run / fanout slices: invoke a child flow run sequentially
  // (sub-run) or in parallel (fanout). Wired by the coordinator to
  // `runCompiledFlow`. Tests injecting a stub childRunner can avoid the full
  // executeCompiledFlow stack.
  readonly childRunner: CompiledFlowRunner;
  // Sub-run / fanout slices: resolve a `CompiledFlowRef` (flow_id +
  // entry_mode + version) to the child flow's manifest. Production
  // CLI provides a fixture-loader resolver; tests inject deterministic
  // stubs. Undefined when the parent invocation didn't supply one — the
  // sub-run handler errors loudly in that case.
  readonly childCompiledFlowResolver?: ChildCompiledFlowResolver;
  // Fanout slice: provisions / releases per-branch git worktrees.
  // Default (wired by the coordinator) shells out to `git worktree`.
  // Tests inject in-memory stubs.
  readonly worktreeRunner?: WorktreeRunner;
}

export type StepHandlerResult =
  | { readonly kind: 'advance' }
  | { readonly kind: 'aborted'; readonly reason: string }
  | {
      readonly kind: 'waiting_checkpoint';
      readonly checkpoint: {
        readonly stepId: string;
        readonly requestPath: string;
        readonly allowedChoices: readonly string[];
      };
    };
