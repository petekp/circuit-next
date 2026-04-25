import { z } from 'zod';
import { DispatchResolutionSource, ResolvedAdapter } from './adapter.js';
import { InvocationId, RunId, StepId, WorkflowId } from './ids.js';
import { LaneDeclaration } from './lane.js';
import { Rigor } from './rigor.js';
import { ResolvedSelection } from './selection-policy.js';
import { DispatchRole } from './step.js';

const EventBase = z.object({
  schema_version: z.literal(1),
  sequence: z.number().int().nonnegative(),
  recorded_at: z.string().datetime(),
  run_id: RunId,
});

export const RunBootstrappedEvent = EventBase.extend({
  kind: z.literal('run.bootstrapped'),
  workflow_id: WorkflowId,
  invocation_id: InvocationId.optional(),
  rigor: Rigor,
  goal: z.string().min(1),
  lane: LaneDeclaration,
  manifest_hash: z.string().min(1),
}).strict();
export type RunBootstrappedEvent = z.infer<typeof RunBootstrappedEvent>;

export const StepEnteredEvent = EventBase.extend({
  kind: z.literal('step.entered'),
  step_id: StepId,
  attempt: z.number().int().positive(),
}).strict();
export type StepEnteredEvent = z.infer<typeof StepEnteredEvent>;

export const StepArtifactWrittenEvent = EventBase.extend({
  kind: z.literal('step.artifact_written'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  artifact_path: z.string().min(1),
  artifact_schema: z.string().min(1),
}).strict();
export type StepArtifactWrittenEvent = z.infer<typeof StepArtifactWrittenEvent>;

export const GateEvaluatedEvent = EventBase.extend({
  kind: z.literal('gate.evaluated'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  gate_kind: z.enum(['schema_sections', 'checkpoint_selection', 'result_verdict']),
  outcome: z.enum(['pass', 'fail']),
  missing_sections: z.array(z.string()).optional(),
  reason: z.string().optional(),
}).strict();
export type GateEvaluatedEvent = z.infer<typeof GateEvaluatedEvent>;

export const CheckpointRequestedEvent = EventBase.extend({
  kind: z.literal('checkpoint.requested'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  options: z.array(z.string()).min(1),
  request_path: z.string().min(1),
}).strict();
export type CheckpointRequestedEvent = z.infer<typeof CheckpointRequestedEvent>;

export const CheckpointResolvedEvent = EventBase.extend({
  kind: z.literal('checkpoint.resolved'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  selection: z.string().min(1),
  auto_resolved: z.boolean(),
  resolution_source: z.enum(['safe-default', 'operator', 'safe-autonomous']),
  response_path: z.string().min(1),
}).strict();
export type CheckpointResolvedEvent = z.infer<typeof CheckpointResolvedEvent>;

// ADAPTER-I7: `resolved_from` is a `DispatchResolutionSource` discriminated
// union that names the winning precedence category AND carries the
// disambiguator (`role` on role-match, `workflow_id` on circuit-match).
// An audit reading this event can reconstruct the exact merged-config entry
// that chose the adapter — closes the category-only-provenance gap that the
// flat-enum drafting left open.
//
// Codex HIGH #1 fold-in — `adapter: ResolvedAdapter` (2-variant: built-in or
// custom descriptor). Named references are pre-resolution pointers and MUST
// NOT appear in the event log; the dispatcher dereferences them against the
// registry before emitting the event.
//
// The role ↔ resolved_from.role binding (Codex HIGH #4) is enforced at the
// Event-union level, not here, because `z.discriminatedUnion` cannot admit
// ZodEffects variants (wrapped via superRefine). Mirrors the `Step` pattern.
export const DispatchStartedEvent = EventBase.extend({
  kind: z.literal('dispatch.started'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  adapter: ResolvedAdapter,
  role: DispatchRole,
  resolved_selection: ResolvedSelection,
  resolved_from: DispatchResolutionSource,
}).strict();
export type DispatchStartedEvent = z.infer<typeof DispatchStartedEvent>;

export const DispatchCompletedEvent = EventBase.extend({
  kind: z.literal('dispatch.completed'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  verdict: z.string().min(1),
  duration_ms: z.number().int().nonnegative(),
  result_path: z.string().min(1),
  receipt_path: z.string().min(1),
}).strict();
export type DispatchCompletedEvent = z.infer<typeof DispatchCompletedEvent>;

// SHA-256 over raw bytes, 64-char lowercase hex. Mirrors the convention
// used by `ManifestHash` in src/schemas/manifest.ts so durable dispatch
// transcript hashes are shape-compatible with manifest hashes at audit
// time. Per ADR-0007 CC#P2-2 the three intermediate dispatch events must
// carry concrete request/receipt/result identifiers so a mock adapter
// returning a fixed byte string cannot satisfy the close criterion even
// if byte-shape matches.
const HEX64 = /^[0-9a-f]{64}$/;
const ContentHash = z.string().regex(HEX64, {
  message: 'must be a 64-character lowercase hex SHA-256 digest',
});

// ADR-0007 CC#P2-2 §Amendment (Slice 37) — the durable dispatch
// transcript the P2.4 adapter round-trip test asserts on is a five-event
// sequence on a single `(step_id, attempt)` pair:
//
//   dispatch.started → dispatch.request → dispatch.receipt →
//   dispatch.result → dispatch.completed
//
// `dispatch.request` carries the SHA-256 of the request payload bytes
// submitted to the adapter, before the adapter replies. A mock adapter
// cannot elide this event because the hash is observable independent of
// adapter output.
export const DispatchRequestEvent = EventBase.extend({
  kind: z.literal('dispatch.request'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  request_payload_hash: ContentHash,
}).strict();
export type DispatchRequestEvent = z.infer<typeof DispatchRequestEvent>;

// Adapter invocation failures are infrastructure failures, not model
// verdict failures. The event is additive to the existing dispatch audit
// trail: `dispatch.started` and `dispatch.request` still precede it, and
// this event repeats the dispatch provenance plus the pre-await request
// hash so the failed attempt is tied to the exact invocation payload.
export const DispatchFailedEvent = EventBase.extend({
  kind: z.literal('dispatch.failed'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  adapter: ResolvedAdapter,
  role: DispatchRole,
  resolved_selection: ResolvedSelection,
  resolved_from: DispatchResolutionSource,
  request_payload_hash: ContentHash,
  reason: z.string().min(1),
}).strict();
export type DispatchFailedEvent = z.infer<typeof DispatchFailedEvent>;

// `dispatch.receipt` carries the adapter-returned receipt id — an opaque
// identifier the adapter assigns to the in-flight dispatch so audit
// tooling can reconstruct what receipt the adapter handed back. Kept as
// `z.string().min(1)` (not a hash) because adapters choose their own
// receipt-id format (UUID, ULID, provider-side run id, etc.).
//
// Codex MED #2 (Slice 37) — scoping note. The intra-log correlation
// between `dispatch.request` and `dispatch.result` is `(step_id,
// attempt, ordering)`, NOT `receipt_id`. `DispatchResultEvent` does not
// echo the receipt. The receipt id is identity-of-record for the
// adapter-side dispatch (so an auditor can ask the adapter "what
// happened to receipt X"), not a cryptographic binding between the
// in-log events. Hash-tightening of `receipt_id` is deferred until a
// real adapter surfaces concrete receipt formats; `z.string().min(1)`
// + the whitespace-rejection test in
// `tests/contracts/slice-37-dispatch-transcript.test.ts` is the
// current boundary. A stricter format constraint authored now would
// over-specify without provider-shape evidence.
export const DispatchReceiptEvent = EventBase.extend({
  kind: z.literal('dispatch.receipt'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  receipt_id: z
    .string()
    .min(1)
    .refine((s) => s.trim().length > 0, {
      message: 'receipt_id must contain at least one non-whitespace character',
    }),
}).strict();
export type DispatchReceiptEvent = z.infer<typeof DispatchReceiptEvent>;

// `dispatch.result` carries the SHA-256 of the result artifact bytes
// returned by the adapter, before the reducer projects and the result-
// writer persists. Hash is required so the close-criterion test can
// assert on content — not byte-shape — of a real adapter's output.
export const DispatchResultEvent = EventBase.extend({
  kind: z.literal('dispatch.result'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  result_artifact_hash: ContentHash,
}).strict();
export type DispatchResultEvent = z.infer<typeof DispatchResultEvent>;

export const StepCompletedEvent = EventBase.extend({
  kind: z.literal('step.completed'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  route_taken: z.string().min(1),
}).strict();
export type StepCompletedEvent = z.infer<typeof StepCompletedEvent>;

export const StepAbortedEvent = EventBase.extend({
  kind: z.literal('step.aborted'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  reason: z.string().min(1),
}).strict();
export type StepAbortedEvent = z.infer<typeof StepAbortedEvent>;

export const RunClosedOutcome = z.enum(['complete', 'aborted', 'handoff', 'stopped', 'escalated']);
export type RunClosedOutcome = z.infer<typeof RunClosedOutcome>;

export const RunClosedEvent = EventBase.extend({
  kind: z.literal('run.closed'),
  outcome: RunClosedOutcome,
  reason: z.string().optional(),
}).strict();
export type RunClosedEvent = z.infer<typeof RunClosedEvent>;

// Codex HIGH #4 fold-in — cross-variant superRefine enforces the
// `DispatchStartedEvent.role === resolved_from.role` binding when
// `resolved_from.source === 'role'`. Mirrors the Step pattern: keep each
// discriminated-union variant as a plain ZodObject (so discrimination works)
// and hoist cross-field refinements to the union level.
export const Event = z
  .discriminatedUnion('kind', [
    RunBootstrappedEvent,
    StepEnteredEvent,
    StepArtifactWrittenEvent,
    GateEvaluatedEvent,
    CheckpointRequestedEvent,
    CheckpointResolvedEvent,
    DispatchStartedEvent,
    DispatchRequestEvent,
    DispatchFailedEvent,
    DispatchReceiptEvent,
    DispatchResultEvent,
    DispatchCompletedEvent,
    StepCompletedEvent,
    StepAbortedEvent,
    RunClosedEvent,
  ])
  .superRefine((ev, ctx) => {
    if (ev.kind !== 'dispatch.started' && ev.kind !== 'dispatch.failed') return;
    if (ev.resolved_from.source === 'role' && ev.resolved_from.role !== ev.role) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resolved_from', 'role'],
        message: `resolved_from.role '${ev.resolved_from.role}' does not agree with event role '${ev.role}'`,
      });
    }
  });
export type Event = z.infer<typeof Event>;
