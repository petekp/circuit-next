import { z } from 'zod';
import { CompiledFlowId, RunId, StepId } from './ids.js';
import { RelayRole } from './step.js';
import { RunClosedOutcome } from './trace-entry.js';

export const ProgressDisplay = z
  .object({
    text: z.string().min(1).max(240),
    importance: z.enum(['major', 'detail']),
    tone: z.enum(['info', 'success', 'warning', 'error', 'checkpoint']),
  })
  .strict();
export type ProgressDisplay = z.infer<typeof ProgressDisplay>;

const ProgressEventBase = z
  .object({
    schema_version: z.literal(1),
    type: z.string().min(1),
    run_id: RunId,
    flow_id: CompiledFlowId,
    recorded_at: z.string().datetime(),
    label: z.string().min(1),
    display: ProgressDisplay,
  })
  .strict();

export const RunStartedProgressEvent = ProgressEventBase.extend({
  type: z.literal('run.started'),
  run_folder: z.string().min(1),
}).strict();

export const RouteSelectedProgressEvent = ProgressEventBase.extend({
  type: z.literal('route.selected'),
  selected_flow: CompiledFlowId,
  routed_by: z.enum(['explicit', 'classifier']),
  router_reason: z.string().min(1),
  router_signal: z.string().min(1).optional(),
}).strict();

export const StepStartedProgressEvent = ProgressEventBase.extend({
  type: z.literal('step.started'),
  step_id: StepId,
  step_title: z.string().min(1),
  attempt: z.number().int().positive(),
}).strict();

export const StepCompletedProgressEvent = ProgressEventBase.extend({
  type: z.literal('step.completed'),
  step_id: StepId,
  step_title: z.string().min(1),
  attempt: z.number().int().positive(),
  route_taken: z.string().min(1),
}).strict();

export const StepAbortedProgressEvent = ProgressEventBase.extend({
  type: z.literal('step.aborted'),
  step_id: StepId,
  step_title: z.string().min(1),
  attempt: z.number().int().positive(),
  reason: z.string().min(1),
}).strict();

export const EvidenceCollectedProgressEvent = ProgressEventBase.extend({
  type: z.literal('evidence.collected'),
  step_id: StepId,
  report_path: z.string().min(1),
  report_schema: z.string().min(1),
  warning_count: z.number().int().nonnegative(),
}).strict();

export const EvidenceWarningProgressEvent = ProgressEventBase.extend({
  type: z.literal('evidence.warning'),
  step_id: StepId,
  report_path: z.string().min(1),
  warning_kind: z.string().min(1),
  message: z.string().min(1),
  path: z.string().min(1).optional(),
}).strict();

export const RelayStartedProgressEvent = ProgressEventBase.extend({
  type: z.literal('relay.started'),
  step_id: StepId,
  step_title: z.string().min(1),
  attempt: z.number().int().positive(),
  role: RelayRole,
  connector_name: z.string().min(1),
  connector_kind: z.enum(['builtin', 'custom']),
  filesystem_capability: z.enum(['read-only', 'trusted-write', 'isolated-write']),
}).strict();

export const RelayCompletedProgressEvent = ProgressEventBase.extend({
  type: z.literal('relay.completed'),
  step_id: StepId,
  step_title: z.string().min(1),
  attempt: z.number().int().positive(),
  verdict: z.string().min(1),
  duration_ms: z.number().int().nonnegative(),
}).strict();

export const CheckpointWaitingProgressEvent = ProgressEventBase.extend({
  type: z.literal('checkpoint.waiting'),
  step_id: StepId,
  request_path: z.string().min(1),
  allowed_choices: z.array(z.string().min(1)).min(1),
}).strict();

export const RunCompletedProgressEvent = ProgressEventBase.extend({
  type: z.literal('run.completed'),
  outcome: RunClosedOutcome,
  result_path: z.string().min(1),
}).strict();

export const RunAbortedProgressEvent = ProgressEventBase.extend({
  type: z.literal('run.aborted'),
  outcome: z.literal('aborted'),
  result_path: z.string().min(1),
  reason: z.string().min(1).optional(),
}).strict();

export const ProgressEvent = z.discriminatedUnion('type', [
  RunStartedProgressEvent,
  RouteSelectedProgressEvent,
  StepStartedProgressEvent,
  StepCompletedProgressEvent,
  StepAbortedProgressEvent,
  EvidenceCollectedProgressEvent,
  EvidenceWarningProgressEvent,
  RelayStartedProgressEvent,
  RelayCompletedProgressEvent,
  CheckpointWaitingProgressEvent,
  RunCompletedProgressEvent,
  RunAbortedProgressEvent,
]);
export type ProgressEvent = z.infer<typeof ProgressEvent>;
