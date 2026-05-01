import type { CompiledFlow } from '../../../schemas/compiled-flow.js';
import type { RunId } from '../../../schemas/ids.js';
import type {
  CompiledFlowRef,
  FanoutBranch,
  FanoutRelayBranch,
  FanoutStep,
  FanoutSubRunBranch,
} from '../../../schemas/step.js';

export type FanoutStepNarrow = CompiledFlow['steps'][number] & { kind: 'fanout' };

export type ResolvedBranch =
  | {
      readonly kind: 'sub-run';
      readonly branch_id: string;
      readonly flow_ref: CompiledFlowRef;
      readonly goal: string;
      readonly depth: FanoutSubRunBranch['depth'];
      readonly selection?: FanoutBranch['selection'];
    }
  | {
      readonly kind: 'relay';
      readonly branch_id: string;
      readonly role: FanoutRelayBranch['execution']['role'];
      readonly goal: string;
      readonly report_schema: string;
      readonly provenance_field?: string;
      readonly selection?: FanoutBranch['selection'];
    };

export type ResolvedRelayBranch = Extract<ResolvedBranch, { kind: 'relay' }>;

export interface BranchOutcome {
  readonly branch_id: string;
  readonly child_run_id: RunId;
  readonly worktree_path: string;
  readonly child_outcome: 'complete' | 'aborted' | 'handoff' | 'stopped' | 'escalated';
  readonly verdict: string;
  readonly result_path: string;
  readonly result_body: unknown;
  readonly duration_ms: number;
  readonly admitted: boolean;
  readonly failure_reason?: string;
}

export interface FanoutAggregateBody {
  readonly schema_version: 1;
  readonly join_policy: FanoutStep['check']['join']['policy'];
  readonly branch_count: number;
  readonly winner_branch_id?: string;
  readonly branches: ReadonlyArray<{
    readonly branch_id: string;
    readonly child_run_id: string;
    readonly child_outcome: BranchOutcome['child_outcome'];
    readonly verdict: string;
    readonly admitted: boolean;
    readonly result_path: string;
    readonly duration_ms: number;
    readonly result_body?: unknown;
  }>;
}

export const NO_VERDICT_SENTINEL = '<no-verdict>';
