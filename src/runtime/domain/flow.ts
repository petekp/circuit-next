export type FlowId = string;
export type StageId = string;

import type { Selection } from './selection.js';

export interface ExecutableStage {
  readonly id: StageId;
  readonly title?: string;
  readonly canonical?: string;
  readonly stepIds: readonly string[];
  readonly selection?: Selection;
}
