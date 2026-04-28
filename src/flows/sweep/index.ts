// Sweep flow package.
//
// Sub-run only — no slash command, no router entry. Sweep is invoked
// as a child of Migrate (and potentially other future parent
// flows). Routing is intentionally undefined.

import type { CompiledFlowPackage } from '../types.js';
import { validateSweepBatchAgainstQueue } from './cross-report-validators.js';
import {
  sweepAnalysisShapeHint,
  sweepBatchShapeHint,
  sweepReviewShapeHint,
} from './relay-hints.js';
import { SweepAnalysis, SweepBatch, SweepReview } from './reports.js';
import { sweepBriefComposeBuilder } from './writers/brief.js';
import { sweepCloseBuilder } from './writers/close.js';
import { sweepQueueComposeBuilder } from './writers/queue.js';
import { sweepVerificationWriter } from './writers/verification.js';

export const sweepCompiledFlowPackage: CompiledFlowPackage = {
  id: 'sweep',
  paths: {
    schematic: 'src/flows/sweep/schematic.json',
  },
  relayReports: [
    {
      schemaName: 'sweep.analysis@v1',
      schema: SweepAnalysis,
      relayHint: sweepAnalysisShapeHint.instruction,
    },
    {
      schemaName: 'sweep.batch@v1',
      schema: SweepBatch,
      relayHint: sweepBatchShapeHint.instruction,
      crossReportValidate: validateSweepBatchAgainstQueue,
    },
    {
      schemaName: 'sweep.review@v1',
      schema: SweepReview,
      relayHint: sweepReviewShapeHint.instruction,
    },
  ],
  writers: {
    compose: [sweepBriefComposeBuilder, sweepQueueComposeBuilder],
    close: [sweepCloseBuilder],
    verification: [sweepVerificationWriter],
    checkpoint: [],
  },
};
