// Sweep workflow package.
//
// Sub-run only — no slash command, no router entry. Sweep is invoked
// as a child of Migrate (and potentially other future parent
// workflows). Routing is intentionally undefined.

import { sweepCloseBuilder } from '../../runtime/close-writers/sweep.js';
import {
  sweepAnalysisShapeHint,
  sweepBatchShapeHint,
  sweepReviewShapeHint,
} from '../../runtime/shape-hints/sweep.js';
import { sweepBriefSynthesisBuilder } from '../../runtime/synthesis-writers/sweep-brief.js';
import { sweepQueueSynthesisBuilder } from '../../runtime/synthesis-writers/sweep-queue.js';
import { sweepVerificationWriter } from '../../runtime/verification-writers/sweep-verification.js';
import { SweepAnalysis, SweepBatch, SweepReview } from '../../schemas/artifacts/sweep.js';
import type { WorkflowPackage } from '../types.js';

export const sweepWorkflowPackage: WorkflowPackage = {
  id: 'sweep',
  paths: {
    recipe: 'specs/workflow-recipes/sweep.recipe.json',
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
