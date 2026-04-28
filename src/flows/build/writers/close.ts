// Build close-with-evidence builder.
//
// Reads brief + plan + implementation + verification + review and emits
// build.result@v1 with verification_status, review_verdict, summary, and
// the canonical pointer set. Outcome is 'complete' iff verification
// passed AND review did not reject.

import { reportPathForSchemaInCompiledFlow } from '../../../runtime/registries/close-writers/shared.js';
import type {
  CloseBuildContext,
  CloseBuilder,
} from '../../../runtime/registries/close-writers/types.js';
import {
  BuildBrief,
  BuildImplementation,
  BuildPlan,
  BuildResult,
  BuildReview,
  BuildVerification,
} from '../reports.js';

const POINTERS = [
  { report_id: 'build.brief', schema: 'build.brief@v1' },
  { report_id: 'build.plan', schema: 'build.plan@v1' },
  { report_id: 'build.implementation', schema: 'build.implementation@v1' },
  { report_id: 'build.verification', schema: 'build.verification@v1' },
  { report_id: 'build.review', schema: 'build.review@v1' },
] as const;

export const buildCloseBuilder: CloseBuilder = {
  resultSchemaName: 'build.result@v1',
  reads: [
    { name: 'brief', schema: 'build.brief@v1', required: true },
    { name: 'plan', schema: 'build.plan@v1', required: true },
    { name: 'implementation', schema: 'build.implementation@v1', required: true },
    { name: 'verification', schema: 'build.verification@v1', required: true },
    { name: 'review', schema: 'build.review@v1', required: true },
  ],
  build(context: CloseBuildContext): unknown {
    const brief = BuildBrief.parse(context.inputs.brief);
    BuildPlan.parse(context.inputs.plan);
    const implementation = BuildImplementation.parse(context.inputs.implementation);
    const verification = BuildVerification.parse(context.inputs.verification);
    const review = BuildReview.parse(context.inputs.review);
    return BuildResult.parse({
      summary: `Build result for ${brief.objective}: ${implementation.summary}`,
      outcome:
        verification.overall_status === 'passed' && review.verdict !== 'reject'
          ? 'complete'
          : 'failed',
      verification_status: verification.overall_status,
      review_verdict: review.verdict,
      evidence_links: POINTERS.map((p) => ({
        ...p,
        path: reportPathForSchemaInCompiledFlow(context.flow, p.schema),
      })),
    });
  },
};
