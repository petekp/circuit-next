import { BuildResult } from '../reports.js';
import type {
  BuildBrief,
  BuildImplementation,
  BuildReview,
  BuildVerification,
} from '../reports.js';

export type BuildResultProjectorInputs = {
  readonly brief: BuildBrief;
  readonly implementation: BuildImplementation;
  readonly verification: BuildVerification;
  readonly review: BuildReview;
  readonly evidenceLinks: BuildResult['evidence_links'];
};

export function projectBuildResult(inputs: BuildResultProjectorInputs): BuildResult {
  const outcome: BuildResult['outcome'] =
    inputs.verification.overall_status !== 'passed'
      ? 'failed'
      : inputs.review.verdict === 'accept'
        ? 'complete'
        : inputs.review.verdict === 'accept-with-fixes'
          ? 'needs_attention'
          : 'failed';

  return BuildResult.parse({
    summary: `Build result for ${inputs.brief.objective}: ${inputs.implementation.summary}`,
    outcome,
    verification_status: inputs.verification.overall_status,
    review_verdict: inputs.review.verdict,
    evidence_links: inputs.evidenceLinks,
  });
}
