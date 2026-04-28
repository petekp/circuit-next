// Sweep workflow package.
//
// Sub-run only — no slash command, no router entry. Sweep is invoked
// as a child of Migrate (and potentially other future parent
// workflows). Routing is intentionally undefined.

import type { WorkflowPackage } from '../types.js';
import { SweepAnalysis, SweepBatch, SweepReview } from './artifacts.js';
import { validateSweepBatchAgainstQueue } from './cross-artifact-validators.js';
import {
  sweepAnalysisShapeHint,
  sweepBatchShapeHint,
  sweepReviewShapeHint,
} from './dispatch-hints.js';
import { sweepBriefSynthesisBuilder } from './writers/brief.js';
import { sweepCloseBuilder } from './writers/close.js';
import { sweepQueueSynthesisBuilder } from './writers/queue.js';
import { sweepVerificationWriter } from './writers/verification.js';

export const sweepWorkflowPackage: WorkflowPackage = {
  id: 'sweep',
  paths: {
    schematic: 'src/workflows/sweep/schematic.json',
  },
  dispatchArtifacts: [
    {
      schemaName: 'sweep.analysis@v1',
      schema: SweepAnalysis,
      dispatchHint: sweepAnalysisShapeHint.instruction,
    },
    {
      schemaName: 'sweep.batch@v1',
      schema: SweepBatch,
      dispatchHint: sweepBatchShapeHint.instruction,
      crossArtifactValidate: validateSweepBatchAgainstQueue,
    },
    {
      schemaName: 'sweep.review@v1',
      schema: SweepReview,
      dispatchHint: sweepReviewShapeHint.instruction,
    },
  ],
  writers: {
    synthesis: [sweepBriefSynthesisBuilder, sweepQueueSynthesisBuilder],
    close: [sweepCloseBuilder],
    verification: [sweepVerificationWriter],
    checkpoint: [],
  },
};
