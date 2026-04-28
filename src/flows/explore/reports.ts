import { z } from 'zod';

const EXPLORE_RESULT_SCHEMA_BY_ARTIFACT_ID = {
  'explore.brief': 'explore.brief@v1',
  'explore.analysis': 'explore.analysis@v1',
  'explore.compose': 'explore.compose@v1',
  'explore.review-verdict': 'explore.review-verdict@v1',
} as const;

export const ExploreBrief = z
  .object({
    subject: z.string().min(1),
    task: z.string().min(1),
    success_condition: z.string().min(1),
  })
  .strict();
export type ExploreBrief = z.infer<typeof ExploreBrief>;

export const ExploreEvidenceCitation = z
  .object({
    source: z.string().min(1),
    summary: z.string().min(1),
  })
  .strict();
export type ExploreEvidenceCitation = z.infer<typeof ExploreEvidenceCitation>;

export const ExploreAspect = z
  .object({
    name: z.string().min(1),
    summary: z.string().min(1),
    evidence: z.array(ExploreEvidenceCitation).min(1),
  })
  .strict();
export type ExploreAspect = z.infer<typeof ExploreAspect>;

export const ExploreAnalysis = z
  .object({
    subject: z.string().min(1),
    aspects: z.array(ExploreAspect).min(1),
  })
  .strict();
export type ExploreAnalysis = z.infer<typeof ExploreAnalysis>;

export const ExploreComposeAspect = z
  .object({
    aspect: z.string().min(1),
    contribution: z.string().min(1),
  })
  .strict();
export type ExploreComposeAspect = z.infer<typeof ExploreComposeAspect>;

export const ExploreCompose = z
  .object({
    verdict: z.string().min(1),
    subject: z.string().min(1),
    recommendation: z.string().min(1),
    success_condition_alignment: z.string().min(1),
    supporting_aspects: z.array(ExploreComposeAspect).min(1),
  })
  .strict();
export type ExploreCompose = z.infer<typeof ExploreCompose>;

export const ExploreReviewVerdictValue = z.enum(['accept', 'accept-with-fold-ins']);
export type ExploreReviewVerdictValue = z.infer<typeof ExploreReviewVerdictValue>;

export const ExploreReviewVerdict = z
  .object({
    verdict: ExploreReviewVerdictValue,
    overall_assessment: z.string().min(1),
    objections: z.array(z.string().min(1)),
    missed_angles: z.array(z.string().min(1)),
  })
  .strict();
export type ExploreReviewVerdict = z.infer<typeof ExploreReviewVerdict>;

export const ExploreResultReportId = z.enum([
  'explore.brief',
  'explore.analysis',
  'explore.compose',
  'explore.review-verdict',
]);
export type ExploreResultReportId = z.infer<typeof ExploreResultReportId>;

export const ExploreResultReportPointer = z
  .object({
    report_id: ExploreResultReportId,
    path: z.string().min(1),
    schema: z.string().min(1),
  })
  .strict()
  .superRefine((pointer, ctx) => {
    const expectedSchema = EXPLORE_RESULT_SCHEMA_BY_ARTIFACT_ID[pointer.report_id];
    if (pointer.schema !== expectedSchema) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['schema'],
        message: `schema must be '${expectedSchema}' for report_id '${pointer.report_id}'`,
      });
    }
  });
export type ExploreResultReportPointer = z.infer<typeof ExploreResultReportPointer>;

export const ExploreResultVerdictSnapshot = z
  .object({
    compose_verdict: z.string().min(1),
    review_verdict: ExploreReviewVerdictValue,
    objection_count: z.number().int().nonnegative(),
    missed_angle_count: z.number().int().nonnegative(),
  })
  .strict();
export type ExploreResultVerdictSnapshot = z.infer<typeof ExploreResultVerdictSnapshot>;

export const ExploreResult = z
  .object({
    summary: z.string().min(1),
    verdict_snapshot: ExploreResultVerdictSnapshot,
    evidence_links: z.array(ExploreResultReportPointer).length(4),
  })
  .strict()
  .superRefine((result, ctx) => {
    const seen = new Set<ExploreResultReportId>();
    for (const [index, pointer] of result.evidence_links.entries()) {
      if (seen.has(pointer.report_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['evidence_links', index, 'report_id'],
          message: `duplicate report_id '${pointer.report_id}'`,
        });
      }
      seen.add(pointer.report_id);
    }
    for (const reportId of ExploreResultReportId.options) {
      if (!seen.has(reportId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['evidence_links'],
          message: `missing report_id '${reportId}'`,
        });
      }
    }
  });
export type ExploreResult = z.infer<typeof ExploreResult>;
