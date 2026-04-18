import { z } from 'zod';
import { InvocationId, RunId, StepId, WorkflowId } from './ids.js';
import { LaneDeclaration } from './lane.js';
import { Rigor } from './rigor.js';

export const StepStatus = z.enum(['pending', 'in_progress', 'gate_failed', 'complete', 'aborted']);
export type StepStatus = z.infer<typeof StepStatus>;

export const StepState = z.object({
  step_id: StepId,
  status: StepStatus,
  attempts: z.number().int().nonnegative(),
  last_artifact_path: z.string().optional(),
  last_checkpoint_selection: z.string().optional(),
  last_route_taken: z.string().optional(),
});
export type StepState = z.infer<typeof StepState>;

export const Snapshot = z.object({
  schema_version: z.literal(1),
  run_id: RunId,
  workflow_id: WorkflowId,
  invocation_id: InvocationId.optional(),
  rigor: Rigor,
  lane: LaneDeclaration,
  current_step: StepId.optional(),
  status: z.enum(['in_progress', 'complete', 'aborted', 'handoff', 'stopped', 'escalated']),
  steps: z.array(StepState),
  events_consumed: z.number().int().nonnegative(),
  manifest_hash: z.string().min(1),
  updated_at: z.string().datetime(),
});
export type Snapshot = z.infer<typeof Snapshot>;
