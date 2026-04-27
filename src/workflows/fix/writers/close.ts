// Fix close-with-evidence builder.
//
// Reads brief + context + diagnosis + change + verification (required)
// plus review (optional — lite mode skips review via route_overrides).
// Outcome rules:
//   - reproduction_status='not-reproduced' → 'not-reproduced'
//   - verification passed AND regression proved AND review not 'reject' → 'fixed'
//   - verification passed AND regression not proved → 'partial'
//   - otherwise → 'failed'
// review_status is 'completed' when the review input is present (and
// review_verdict is set), 'skipped' otherwise (with a default skip reason).

import { artifactPathForSchemaInWorkflow } from '../../../runtime/registries/close-writers/shared.js';
import type {
  CloseBuildContext,
  CloseBuilder,
} from '../../../runtime/registries/close-writers/types.js';
import {
  FixBrief,
  FixChange,
  FixContext,
  FixDiagnosis,
  FixResult,
  type FixResultArtifactPointer,
  FixReview,
  FixVerification,
} from '../artifacts.js';

const REQUIRED_POINTERS = [
  { artifact_id: 'fix.brief', schema: 'fix.brief@v1' },
  { artifact_id: 'fix.context', schema: 'fix.context@v1' },
  { artifact_id: 'fix.diagnosis', schema: 'fix.diagnosis@v1' },
  { artifact_id: 'fix.change', schema: 'fix.change@v1' },
  { artifact_id: 'fix.verification', schema: 'fix.verification@v1' },
] as const;

const OPTIONAL_REVIEW_POINTER = {
  artifact_id: 'fix.review',
  schema: 'fix.review@v1',
} as const;

export const fixCloseBuilder: CloseBuilder = {
  resultSchemaName: 'fix.result@v1',
  reads: [
    { name: 'brief', schema: 'fix.brief@v1', required: true },
    { name: 'context', schema: 'fix.context@v1', required: true },
    { name: 'diagnosis', schema: 'fix.diagnosis@v1', required: true },
    { name: 'change', schema: 'fix.change@v1', required: true },
    { name: 'verification', schema: 'fix.verification@v1', required: true },
    { name: 'review', schema: 'fix.review@v1', required: false },
  ],
  build(context: CloseBuildContext): unknown {
    const brief = FixBrief.parse(context.inputs.brief);
    FixContext.parse(context.inputs.context);
    const diagnosis = FixDiagnosis.parse(context.inputs.diagnosis);
    const change = FixChange.parse(context.inputs.change);
    const verification = FixVerification.parse(context.inputs.verification);
    const review =
      context.inputs.review === undefined ? undefined : FixReview.parse(context.inputs.review);

    const verificationStatus = verification.overall_status === 'passed' ? 'passed' : 'failed';
    const regressionStatus =
      brief.regression_contract.regression_test.status === 'failing-before-fix'
        ? 'proved'
        : 'deferred';
    const reviewStatus = review === undefined ? 'skipped' : 'completed';

    const outcome: FixResult['outcome'] =
      diagnosis.reproduction_status === 'not-reproduced'
        ? 'not-reproduced'
        : verificationStatus === 'passed' &&
            regressionStatus === 'proved' &&
            (review === undefined || review.verdict !== 'reject')
          ? 'fixed'
          : verificationStatus === 'passed' && regressionStatus !== 'proved'
            ? 'partial'
            : 'failed';

    const pointers: FixResultArtifactPointer[] = REQUIRED_POINTERS.map((p) => ({
      artifact_id: p.artifact_id,
      schema: p.schema,
      path: artifactPathForSchemaInWorkflow(context.workflow, p.schema),
    }));
    if (review !== undefined) {
      pointers.push({
        artifact_id: OPTIONAL_REVIEW_POINTER.artifact_id,
        schema: OPTIONAL_REVIEW_POINTER.schema,
        path: artifactPathForSchemaInWorkflow(context.workflow, OPTIONAL_REVIEW_POINTER.schema),
      });
    }

    return FixResult.parse({
      summary: `Fix '${brief.problem_statement}': ${change.summary}`,
      outcome,
      verification_status: verificationStatus,
      regression_status: regressionStatus,
      review_status: reviewStatus,
      ...(review === undefined ? {} : { review_verdict: review.verdict }),
      ...(review === undefined
        ? { review_skip_reason: 'Lite mode skipped review per route_overrides.' }
        : {}),
      residual_risks: [...diagnosis.residual_uncertainty],
      artifact_pointers: pointers,
    });
  },
};
