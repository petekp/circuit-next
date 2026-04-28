// Explore close-with-evidence builder.
//
// Reads brief + compose + review-verdict and emits explore.result@v1
// with a brief-referencing summary, verdict snapshot, and the canonical
// 4-pointer set (brief, analysis, compose, review-verdict). Brief is
// part of `reads` per the close-with-evidence scalar contract — the
// summary references brief.subject so the result is self-contained.

import { reportPathForSchemaInCompiledFlow } from '../../../runtime/registries/close-writers/shared.js';
import type {
  CloseBuildContext,
  CloseBuilder,
} from '../../../runtime/registries/close-writers/types.js';
import { ExploreBrief, ExploreCompose, ExploreResult, ExploreReviewVerdict } from '../reports.js';

const POINTERS = [
  { report_id: 'explore.brief', schema: 'explore.brief@v1' },
  { report_id: 'explore.analysis', schema: 'explore.analysis@v1' },
  { report_id: 'explore.compose', schema: 'explore.compose@v1' },
  { report_id: 'explore.review-verdict', schema: 'explore.review-verdict@v1' },
] as const;

export const exploreCloseBuilder: CloseBuilder = {
  resultSchemaName: 'explore.result@v1',
  reads: [
    { name: 'brief', schema: 'explore.brief@v1', required: true },
    { name: 'compose', schema: 'explore.compose@v1', required: true },
    { name: 'review', schema: 'explore.review-verdict@v1', required: true },
  ],
  build(context: CloseBuildContext): unknown {
    const brief = ExploreBrief.parse(context.inputs.brief);
    const compose = ExploreCompose.parse(context.inputs.compose);
    const review = ExploreReviewVerdict.parse(context.inputs.review);
    return ExploreResult.parse({
      summary: `Explore '${brief.subject}': ${compose.recommendation}`,
      verdict_snapshot: {
        compose_verdict: compose.verdict,
        review_verdict: review.verdict,
        objection_count: review.objections.length,
        missed_angle_count: review.missed_angles.length,
      },
      evidence_links: POINTERS.map((p) => ({
        ...p,
        path: reportPathForSchemaInCompiledFlow(context.flow, p.schema),
      })),
    });
  },
};
