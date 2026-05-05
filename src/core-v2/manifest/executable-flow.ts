import type { ExecutableStageV2, FlowId } from '../domain/flow.js';
import type { RoutesV2 } from '../domain/route.js';
import type { RunFileRef } from '../domain/run-file.js';
import type { Selection } from '../domain/selection.js';
import type { StepId } from '../domain/step.js';

export interface ExecutableEntryModeV2 {
  readonly name: string;
  readonly startAt: StepId;
  readonly depth: string;
  readonly description: string;
  readonly defaultChangeKind?: string;
}

export interface BaseStepV2 {
  readonly id: StepId;
  readonly title?: string;
  readonly protocol?: string;
  readonly routes: RoutesV2;
  readonly reads?: readonly RunFileRef[];
  readonly writes?: Readonly<Record<string, RunFileRef>>;
  readonly selection?: Selection;
  readonly check?: unknown;
  readonly budgets?: unknown;
}

export interface ComposeStepV2 extends BaseStepV2 {
  readonly kind: 'compose';
  readonly writer: string;
  readonly body?: unknown;
}

export interface VerificationStepV2 extends BaseStepV2 {
  readonly kind: 'verification';
  readonly check: unknown;
}

export interface CheckpointStepV2 extends BaseStepV2 {
  readonly kind: 'checkpoint';
  readonly choices: readonly string[];
  readonly policy?: unknown;
}

export interface RelayStepV2 extends BaseStepV2 {
  readonly kind: 'relay';
  readonly role: string;
  readonly connector?: string;
  readonly prompt?: string;
  readonly report?: RunFileRef;
}

export interface SubRunStepV2 extends BaseStepV2 {
  readonly kind: 'sub-run';
  readonly flowRef: FlowId;
  readonly entryMode: string;
  readonly version?: string;
  readonly goal: string;
  readonly depth: string;
}

export interface FanoutStepV2 extends BaseStepV2 {
  readonly kind: 'fanout';
  readonly branches: unknown;
  readonly join: unknown;
  readonly concurrency?: unknown;
  readonly onChildFailure?: string;
}

export type ExecutableStepV2 =
  | ComposeStepV2
  | VerificationStepV2
  | CheckpointStepV2
  | RelayStepV2
  | SubRunStepV2
  | FanoutStepV2;

export interface ExecutableFlowV2 {
  readonly id: FlowId;
  readonly version: string;
  readonly entry: StepId;
  readonly entryModes?: readonly ExecutableEntryModeV2[];
  readonly stages: readonly ExecutableStageV2[];
  readonly steps: readonly ExecutableStepV2[];
  readonly purpose?: string;
  readonly defaultSelection?: Selection;
  readonly stagePathPolicy?: unknown;
  readonly metadata?: Record<string, unknown>;
}
