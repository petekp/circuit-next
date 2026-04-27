import type { BuildBrief } from '../../schemas/artifacts/build.js';
import type { Event } from '../../schemas/event.js';
import type { InvocationId, RunId } from '../../schemas/ids.js';
import type { LaneDeclaration } from '../../schemas/lane.js';
import type { Rigor } from '../../schemas/rigor.js';
import type { Workflow } from '../../schemas/workflow.js';
import type { LayeredConfig as LayeredConfigValue } from '../../schemas/config.js';
import type { DispatchFn, DispatchResultMetadata, SynthesisWriterFn } from '../runner-types.js';

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
