import type { BuiltInAdapter } from '../schemas/adapter.js';
import type { LayeredConfig as LayeredConfigValue } from '../schemas/config.js';
import type { Event } from '../schemas/event.js';
import type { InvocationId, RunId, WorkflowId } from '../schemas/ids.js';
import type { LaneDeclaration } from '../schemas/lane.js';
import type { RunResult } from '../schemas/result.js';
import type { Rigor } from '../schemas/rigor.js';
import type { ResolvedSelection } from '../schemas/selection-policy.js';
import type { Snapshot } from '../schemas/snapshot.js';
import type { WorkflowRef } from '../schemas/step.js';
import type { Workflow } from '../schemas/workflow.js';
import type { AdapterDispatchInput, DispatchResult } from './adapters/shared.js';

// Slice 45a (P2.6 HIGH 3 fold-in): structured dispatcher descriptor.
// Prior to 45a, `DispatchFn` was a bare function type and the runner's
// materializer call site hardcoded `adapterName: 'agent'`; injecting a
// non-agent dispatcher (e.g. `dispatchCodex`) through
// `WorkflowInvocation.dispatcher` would silently lie on the
// `dispatch.started` event's adapter discriminant. The descriptor binds
// the dispatcher function to its adapter identity at the injection seam,
// so the materializer is parameterized from the descriptor instead of
// from a call-site literal.
export interface DispatchFn {
  readonly adapterName: BuiltInAdapter;
  readonly dispatch: (input: DispatchInput) => Promise<DispatchResult>;
}

export interface DispatchInput extends AdapterDispatchInput {
  readonly resolvedSelection?: ResolvedSelection;
}

export interface SynthesisWriterInput {
  readonly runRoot: string;
  readonly workflow: Workflow;
  readonly step: Workflow['steps'][number] & { kind: 'synthesis' };
  readonly goal: string;
}

export type SynthesisWriterFn = (input: SynthesisWriterInput) => void;

// Slice 47a Codex HIGH 2 fold-in — surface per-dispatch metadata
// (`adapterName`, `cli_version`, `stepId`) so the AGENT_SMOKE
// fingerprint writer can bind `cli_version` to the actual subprocess
// init event rather than reading it from a side-channel env var.
export interface DispatchResultMetadata {
  readonly stepId: string;
  readonly adapterName: BuiltInAdapter;
  readonly cli_version: string;
}

// Sub-run / fanout child workflow lookup. The runtime stays workflow-
// agnostic by accepting a resolver from the caller (CLI / tests) instead
// of baking in a manifest-layout convention. The CLI's resolver reads
// `.claude-plugin/skills/<workflow_id>/<entry_mode|circuit>.json`; tests
// inject deterministic stubs.
export interface ResolvedChildWorkflow {
  readonly workflow: Workflow;
  readonly bytes: Buffer;
}

export type ChildWorkflowResolver = (ref: WorkflowRef) => ResolvedChildWorkflow;

// Fanout-runtime worktree provisioning seam. Default implementation
// shells out to `git worktree add` / `git worktree remove`. The seam
// keeps tests fast and side-effect-free (no real git repo required)
// while the production CLI wires the git-backed default.
export interface WorktreeProvisionInput {
  readonly worktreePath: string;
  readonly baseRef: string;
  readonly branchName: string;
}

export interface WorktreeRunner {
  add(input: WorktreeProvisionInput): void | Promise<void>;
  remove(worktreePath: string): void | Promise<void>;
  // Returns files changed in the worktree relative to baseRef, used by
  // the disjoint-merge join policy to validate per-branch changes are
  // pairwise disjoint. Default implementation runs `git diff --name-only
  // <baseRef>..HEAD` inside the worktree.
  changedFiles?(
    worktreePath: string,
    baseRef: string,
  ): readonly string[] | Promise<readonly string[]>;
}

export interface WorkflowInvocation {
  runRoot: string;
  workflow: Workflow;
  workflowBytes: Buffer;
  projectRoot?: string;
  runId: RunId;
  goal: string;
  rigor?: Rigor;
  entryModeName?: string;
  lane: LaneDeclaration;
  now: () => Date;
  invocationId?: InvocationId;
  // Slice 43b: injection seam for the dispatch adapter. Default is
  // `dispatchAgent` (lazy-imported so tests that don't exercise dispatch
  // don't pull the subprocess module into their graph).
  dispatcher?: DispatchFn;
  // Test seam for deterministic synthesis fixtures. Production invocations
  // omit this and use the registered writer below, which composes the
  // schema-specific synthesis builder with a placeholder fallback.
  synthesisWriter?: SynthesisWriterFn;
  // Parsed config layers are supplied by callers that have already handled
  // discovery/loading. The product CLI discovers user-global and project
  // layers; direct runtime callers can still inject already-parsed layers.
  selectionConfigLayers?: readonly LayeredConfigValue[];
  // Sub-run / fanout child workflow lookup. When omitted, sub-run and
  // fanout steps abort with a clear "no resolver provided" error.
  childWorkflowResolver?: ChildWorkflowResolver;
  // Sub-run / fanout child runner injection seam. Default is the runner's
  // own `runWorkflow`. Tests inject deterministic child-run stubs so they
  // can exercise sub-run handler logic without a full executeWorkflow
  // descent on the inner side.
  childRunner?: WorkflowRunner;
  // Fanout worktree provisioning seam. Default shells out to
  // `git worktree add/remove`. Tests inject in-memory stubs so they
  // don't require a real git repo at projectRoot.
  worktreeRunner?: WorktreeRunner;
}

export interface CheckpointResumeInvocation {
  runRoot: string;
  selection: string;
  projectRoot?: string;
  now: () => Date;
  dispatcher?: DispatchFn;
  synthesisWriter?: SynthesisWriterFn;
  selectionConfigLayers?: readonly LayeredConfigValue[];
  childWorkflowResolver?: ChildWorkflowResolver;
  childRunner?: WorkflowRunner;
  worktreeRunner?: WorktreeRunner;
}

export interface CheckpointWaitingResult {
  readonly schema_version: 1;
  readonly run_id: RunId;
  readonly workflow_id: WorkflowId;
  readonly goal: string;
  readonly outcome: 'checkpoint_waiting';
  readonly summary: string;
  readonly events_observed: number;
  readonly manifest_hash: string;
  readonly checkpoint: {
    readonly step_id: string;
    readonly request_path: string;
    readonly allowed_choices: readonly string[];
  };
  readonly reason?: string;
}

export interface WorkflowRunResult {
  runRoot: string;
  result: RunResult | CheckpointWaitingResult;
  snapshot: Snapshot;
  events: Event[];
  dispatchResults: readonly DispatchResultMetadata[];
}

export type WorkflowRunner = (inv: WorkflowInvocation) => Promise<WorkflowRunResult>;
