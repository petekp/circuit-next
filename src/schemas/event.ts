import { z } from 'zod';
import { AdapterRef } from './adapter.js';
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
});
export type RunBootstrappedEvent = z.infer<typeof RunBootstrappedEvent>;

export const StepEnteredEvent = EventBase.extend({
  kind: z.literal('step.entered'),
  step_id: StepId,
  attempt: z.number().int().positive(),
});
export type StepEnteredEvent = z.infer<typeof StepEnteredEvent>;

export const StepArtifactWrittenEvent = EventBase.extend({
  kind: z.literal('step.artifact_written'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  artifact_path: z.string().min(1),
  artifact_schema: z.string().min(1),
});
export type StepArtifactWrittenEvent = z.infer<typeof StepArtifactWrittenEvent>;

export const GateEvaluatedEvent = EventBase.extend({
  kind: z.literal('gate.evaluated'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  gate_kind: z.enum(['schema_sections', 'checkpoint_selection', 'result_verdict']),
  outcome: z.enum(['pass', 'fail']),
  missing_sections: z.array(z.string()).optional(),
  reason: z.string().optional(),
});
export type GateEvaluatedEvent = z.infer<typeof GateEvaluatedEvent>;

export const CheckpointRequestedEvent = EventBase.extend({
  kind: z.literal('checkpoint.requested'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  options: z.array(z.string()).min(1),
});
export type CheckpointRequestedEvent = z.infer<typeof CheckpointRequestedEvent>;

export const CheckpointResolvedEvent = EventBase.extend({
  kind: z.literal('checkpoint.resolved'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  selection: z.string().min(1),
  auto_resolved: z.boolean(),
});
export type CheckpointResolvedEvent = z.infer<typeof CheckpointResolvedEvent>;

export const DispatchStartedEvent = EventBase.extend({
  kind: z.literal('dispatch.started'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  adapter: AdapterRef,
  role: DispatchRole,
  resolved_selection: ResolvedSelection,
  resolved_from: z.enum(['explicit', 'role', 'circuit', 'default', 'auto']),
});
export type DispatchStartedEvent = z.infer<typeof DispatchStartedEvent>;

export const DispatchCompletedEvent = EventBase.extend({
  kind: z.literal('dispatch.completed'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  verdict: z.string().min(1),
  duration_ms: z.number().int().nonnegative(),
  result_path: z.string().min(1),
  receipt_path: z.string().min(1),
});
export type DispatchCompletedEvent = z.infer<typeof DispatchCompletedEvent>;

export const StepCompletedEvent = EventBase.extend({
  kind: z.literal('step.completed'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  route_taken: z.string().min(1),
});
export type StepCompletedEvent = z.infer<typeof StepCompletedEvent>;

export const StepAbortedEvent = EventBase.extend({
  kind: z.literal('step.aborted'),
  step_id: StepId,
  attempt: z.number().int().positive(),
  reason: z.string().min(1),
});
export type StepAbortedEvent = z.infer<typeof StepAbortedEvent>;

export const RunClosedEvent = EventBase.extend({
  kind: z.literal('run.closed'),
  outcome: z.enum(['complete', 'aborted', 'handoff', 'stopped', 'escalated']),
  reason: z.string().optional(),
});
export type RunClosedEvent = z.infer<typeof RunClosedEvent>;

export const Event = z.discriminatedUnion('kind', [
  RunBootstrappedEvent,
  StepEnteredEvent,
  StepArtifactWrittenEvent,
  GateEvaluatedEvent,
  CheckpointRequestedEvent,
  CheckpointResolvedEvent,
  DispatchStartedEvent,
  DispatchCompletedEvent,
  StepCompletedEvent,
  StepAbortedEvent,
  RunClosedEvent,
]);
export type Event = z.infer<typeof Event>;
