// Explore close-with-evidence builder.
//
// Reads brief + synthesis + review-verdict and emits explore.result@v1
// with a brief-referencing summary, verdict snapshot, and the canonical
// 4-pointer set (brief, analysis, synthesis, review-verdict). Brief is
// part of `reads` per the close-with-evidence primitive contract — the
// summary references brief.subject so the result is self-contained.

import { artifactPathForSchemaInWorkflow } from '../../../runtime/registries/close-writers/shared.js';
import type { CloseBuildContext, CloseBuilder } from '../../../runtime/registries/close-writers/types.js';
import {
  ExploreBrief,
  ExploreResult,
  ExploreReviewVerdict,
  ExploreSynthesis,
} from '../artifacts.js';

const POINTERS = [
  { artifact_id: 'explore.brief', schema: 'explore.brief@v1' },
  { artifact_id: 'explore.analysis', schema: 'explore.analysis@v1' },
  { artifact_id: 'explore.synthesis', schema: 'explore.synthesis@v1' },
  { artifact_id: 'explore.review-verdict', schema: 'explore.review-verdict@v1' },
] as const;

export const exploreCloseBuilder: CloseBuilder = {
  resultSchemaName: 'explore.result@v1',
  reads: [
    { name: 'brief', schema: 'explore.brief@v1', required: true },
    { name: 'synthesis', schema: 'explore.synthesis@v1', required: true },
    { name: 'review', schema: 'explore.review-verdict@v1', required: true },
  ],
  build(context: CloseBuildContext): unknown {
    const brief = ExploreBrief.parse(context.inputs.brief);
    const synthesis = ExploreSynthesis.parse(context.inputs.synthesis);
    const review = ExploreReviewVerdict.parse(context.inputs.review);
    return ExploreResult.parse({
      summary: `Explore '${brief.subject}': ${synthesis.recommendation}`,
      verdict_snapshot: {
        synthesis_verdict: synthesis.verdict,
        review_verdict: review.verdict,
        objection_count: review.objections.length,
        missed_angle_count: review.missed_angles.length,
      },
      artifact_pointers: POINTERS.map((p) => ({
        ...p,
        path: artifactPathForSchemaInWorkflow(context.workflow, p.schema),
      })),
    });
  },
};
