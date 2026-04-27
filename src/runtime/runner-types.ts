import type { BuiltInAdapter } from '../schemas/adapter.js';
import type { ResolvedSelection } from '../schemas/selection-policy.js';
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
