import type { BuildBrief } from '../../schemas/artifacts/build.js';
import type { Event } from '../../schemas/event.js';
import type { InvocationId, RunId } from '../../schemas/ids.js';
import type { LaneDeclaration } from '../../schemas/lane.js';
import type { Rigor } from '../../schemas/rigor.js';
import type { Workflow } from '../../schemas/workflow.js';
import type { LayeredConfig as LayeredConfigValue } from '../../schemas/config.js';
import type {
  ChildWorkflowResolver,
  DispatchFn,
  DispatchResultMetadata,
  SynthesisWriterFn,
  WorkflowRunner,
  WorktreeRunner,
} from '../runner-types.js';

export interface RunState {
  readonly events: Event[];
  sequence: number;
  readonly dispatchResults: DispatchResultMetadata[];
}

export interface ResumeCheckpointState {
  readonly stepId: string;
  readonly attempt: number;
  readonly selection: string;
  readonly existingBrief?: BuildBrief;
}

export interface StepHandlerContext {
  readonly runRoot: string;
  readonly workflow: Workflow;
  readonly runId: RunId;
  readonly goal: string;
  readonly lane: LaneDeclaration;
  readonly rigor: Rigor;
  readonly executionSelectionConfigLayers: readonly LayeredConfigValue[];
  readonly projectRoot?: string;
  readonly invocationId?: InvocationId;
  readonly dispatcher: DispatchFn;
  readonly synthesisWriter: SynthesisWriterFn;
  readonly now: () => Date;
  readonly recordedAt: () => string;
  readonly state: RunState;
  readonly push: (ev: Event) => void;
  readonly step: Workflow['steps'][number];
  readonly attempt: number;
  readonly isResumedCheckpoint: boolean;
  readonly resumeCheckpoint?: ResumeCheckpointState;
  // Sub-run / fanout slices: invoke a child workflow run sequentially
  // (sub-run) or in parallel (fanout). Wired by the coordinator to
  // `runWorkflow`. Tests injecting a stub childRunner can avoid the full
  // executeWorkflow stack.
  readonly childRunner: WorkflowRunner;
  // Sub-run / fanout slices: resolve a `WorkflowRef` (workflow_id +
  // entry_mode + version) to the child workflow's manifest. Production
  // CLI provides a fixture-loader resolver; tests inject deterministic
  // stubs. Undefined when the parent invocation didn't supply one — the
  // sub-run handler errors loudly in that case.
  readonly childWorkflowResolver?: ChildWorkflowResolver;
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
