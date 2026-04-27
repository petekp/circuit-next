// Sweep workflow package.
//
// Sub-run only — no slash command, no router entry. Sweep is invoked
// as a child of Migrate (and potentially other future parent
// workflows). Routing is intentionally undefined.

import { SweepAnalysis, SweepBatch, SweepReview } from '../../schemas/artifacts/sweep.js';
import type { WorkflowPackage } from '../types.js';
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
    recipe: 'src/workflows/sweep/recipe.json',
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
