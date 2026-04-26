// Sweep close-with-evidence builder.
//
// Reads brief + analysis + queue + batch + verification + review and
// emits sweep.result@v1 with verification_status, review_verdict,
// deferred_count, summary, and the canonical 6-pointer set. Outcome
// is 'complete' iff verification passed AND review verdict is 'clean'
// AND batch verdict is 'accept'; 'partial' iff batch is 'partial' or
// review reports minor injections; 'reverted' iff batch is 'reverted';
// otherwise 'failed'.

import {
  SweepAnalysis,
  SweepBatch,
  SweepBrief,
  SweepQueue,
  SweepResult,
  SweepReview,
  SweepVerification,
} from '../../schemas/artifacts/sweep.js';
import { artifactPathForSchemaInWorkflow } from './shared.js';
import type { CloseBuildContext, CloseBuilder } from './types.js';

const POINTERS = [
  { artifact_id: 'sweep.brief', schema: 'sweep.brief@v1' },
  { artifact_id: 'sweep.analysis', schema: 'sweep.analysis@v1' },
  { artifact_id: 'sweep.queue', schema: 'sweep.queue@v1' },
  { artifact_id: 'sweep.batch', schema: 'sweep.batch@v1' },
  { artifact_id: 'sweep.verification', schema: 'sweep.verification@v1' },
  { artifact_id: 'sweep.review', schema: 'sweep.review@v1' },
] as const;

export const sweepCloseBuilder: CloseBuilder = {
  resultSchemaName: 'sweep.result@v1',
  reads: [
    { name: 'brief', schema: 'sweep.brief@v1', required: true },
    { name: 'analysis', schema: 'sweep.analysis@v1', required: true },
    { name: 'queue', schema: 'sweep.queue@v1', required: true },
    { name: 'batch', schema: 'sweep.batch@v1', required: true },
    { name: 'verification', schema: 'sweep.verification@v1', required: true },
    { name: 'review', schema: 'sweep.review@v1', required: true },
  ],
  build(context: CloseBuildContext): unknown {
    const brief = SweepBrief.parse(context.inputs.brief);
    SweepAnalysis.parse(context.inputs.analysis);
    const queue = SweepQueue.parse(context.inputs.queue);
    const batch = SweepBatch.parse(context.inputs.batch);
    const verification = SweepVerification.parse(context.inputs.verification);
    const review = SweepReview.parse(context.inputs.review);

    const verificationOk = verification.overall_status === 'passed';
    const reviewClean = review.verdict === 'clean';
    const reviewMinor = review.verdict === 'minor-injections';

    const outcome =
      batch.verdict === 'reverted'
        ? 'reverted'
        : !verificationOk || review.verdict === 'critical-injections' || review.verdict === 'reject'
          ? 'failed'
          : batch.verdict === 'partial' || reviewMinor
            ? 'partial'
            : reviewClean
              ? 'complete'
              : 'failed';

    return SweepResult.parse({
      summary: `Sweep result for ${brief.objective}: ${batch.summary}`,
      outcome,
      verification_status: verification.overall_status,
      review_verdict: review.verdict,
      deferred_count: queue.deferred.length,
      artifact_pointers: POINTERS.map((p) => ({
        ...p,
        path: artifactPathForSchemaInWorkflow(context.workflow, p.schema),
      })),
    });
  },
};
