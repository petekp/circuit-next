import type { ChangeKindDeclaration } from '../schemas/change-kind.js';
import type { CompiledFlow } from '../schemas/compiled-flow.js';
import type { LayeredConfig as LayeredConfigValue } from '../schemas/config.js';
import type { Depth } from '../schemas/depth.js';
import type { CompiledFlowId, InvocationId, RunId } from '../schemas/ids.js';
import type { RunResult } from '../schemas/result.js';
import type { Snapshot } from '../schemas/snapshot.js';
import type { CompiledFlowRef } from '../schemas/step.js';
import type { TraceEntry } from '../schemas/trace-entry.js';
import type {
  ProgressReporter,
  RelayFn,
  RuntimeEvidencePolicy,
} from '../shared/relay-runtime-types.js';
export type {
  ProgressReporter,
  RelayFn,
  RelayInput,
  RuntimeEvidencePolicy,
} from '../shared/relay-runtime-types.js';

export interface ComposeWriterInput {
  readonly runFolder: string;
  readonly flow: CompiledFlow;
  readonly step: CompiledFlow['steps'][number] & { kind: 'compose' };
  readonly goal: string;
  readonly projectRoot?: string;
  readonly evidencePolicy?: RuntimeEvidencePolicy;
}

export type ComposeWriterFn = (input: ComposeWriterInput) => void;

// Surface per-relay metadata (`connectorName`, `cli_version`, `stepId`)
// so the AGENT_SMOKE fingerprint writer can bind `cli_version` to the
// actual subprocess init trace_entry rather than reading it from a
// side-channel env var.
export interface RelayResultMetadata {
  readonly stepId: string;
  readonly connectorName: string;
  readonly cli_version: string;
}

// Sub-run / fanout child flow lookup. The runtime stays flow-
// agnostic by accepting a resolver from the caller (CLI / tests) instead
// of baking in a manifest-layout convention. The CLI's resolver reads
// `generated/flows/<flow_id>/<entry_mode|circuit>.json`; tests
// inject deterministic stubs.
export interface ResolvedChildCompiledFlow {
  readonly flow: CompiledFlow;
  readonly bytes: Buffer;
}

export type ChildCompiledFlowResolver = (ref: CompiledFlowRef) => ResolvedChildCompiledFlow;

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

export interface CompiledFlowInvocation {
  runFolder: string;
  flow: CompiledFlow;
  flowBytes: Buffer;
  projectRoot?: string;
  evidencePolicy?: RuntimeEvidencePolicy;
  runId: RunId;
  goal: string;
  depth?: Depth;
  entryModeName?: string;
  change_kind: ChangeKindDeclaration;
  now: () => Date;
  invocationId?: InvocationId;
  // Injection seam for the relay connector. Default is `relayClaudeCode`
  // (lazy-imported so tests that don't exercise relay don't pull the
  // subprocess module into their graph).
  relayer?: RelayFn;
  // Test seam for deterministic compose fixtures. Production invocations
  // omit this and use the registered writer below, which fails closed when
  // a compose step has no schema-specific writer.
  composeWriter?: ComposeWriterFn;
  // Parsed config layers are supplied by callers that have already handled
  // discovery/loading. The product CLI discovers user-global and project
  // layers; direct runtime callers can still inject already-parsed layers.
  selectionConfigLayers?: readonly LayeredConfigValue[];
  // Sub-run / fanout child flow lookup. When omitted, sub-run and
  // fanout steps abort with a clear "no resolver provided" error.
  childCompiledFlowResolver?: ChildCompiledFlowResolver;
  // Sub-run / fanout child runner injection seam. Default is the runner's
  // own `runCompiledFlow`. Tests inject deterministic child-run stubs so they
  // can exercise sub-run handler logic without a full executeCompiledFlow
  // descent on the inner side.
  childRunner?: CompiledFlowRunner;
  // Fanout worktree provisioning seam. Default shells out to
  // `git worktree add/remove`. Tests inject in-memory stubs so they
  // don't require a real git repo at projectRoot.
  worktreeRunner?: WorktreeRunner;
  // Optional host-facing progress stream. The CLI wires this to stderr
  // JSONL for hosts that want live updates while preserving final stdout
  // JSON. Runtime correctness never depends on this callback.
  progress?: ProgressReporter;
}

export interface CheckpointResumeInvocation {
  runFolder: string;
  selection: string;
  projectRoot?: string;
  now: () => Date;
  relayer?: RelayFn;
  composeWriter?: ComposeWriterFn;
  selectionConfigLayers?: readonly LayeredConfigValue[];
  childCompiledFlowResolver?: ChildCompiledFlowResolver;
  childRunner?: CompiledFlowRunner;
  worktreeRunner?: WorktreeRunner;
  progress?: ProgressReporter;
}

export interface CheckpointWaitingResult {
  readonly schema_version: 1;
  readonly run_id: RunId;
  readonly flow_id: CompiledFlowId;
  readonly goal: string;
  readonly outcome: 'checkpoint_waiting';
  readonly summary: string;
  readonly trace_entries_observed: number;
  readonly manifest_hash: string;
  readonly checkpoint: {
    readonly step_id: string;
    readonly request_path: string;
    readonly allowed_choices: readonly string[];
  };
  readonly reason?: string;
}

export interface CompiledFlowRunResult {
  runFolder: string;
  result: RunResult | CheckpointWaitingResult;
  snapshot: Snapshot;
  trace_entries: TraceEntry[];
  relayResults: readonly RelayResultMetadata[];
}

export type CompiledFlowRunner = (inv: CompiledFlowInvocation) => Promise<CompiledFlowRunResult>;
