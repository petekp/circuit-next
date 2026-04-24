import { z } from 'zod';

const EXPLORE_RESULT_SCHEMA_BY_ARTIFACT_ID = {
  'explore.brief': 'explore.brief@v1',
  'explore.analysis': 'explore.analysis@v1',
  'explore.synthesis': 'explore.synthesis@v1',
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

export const ExploreSynthesisAspect = z
  .object({
    aspect: z.string().min(1),
    contribution: z.string().min(1),
  })
  .strict();
export type ExploreSynthesisAspect = z.infer<typeof ExploreSynthesisAspect>;

export const ExploreSynthesis = z
  .object({
    verdict: z.string().min(1),
    subject: z.string().min(1),
    recommendation: z.string().min(1),
    success_condition_alignment: z.string().min(1),
    supporting_aspects: z.array(ExploreSynthesisAspect).min(1),
  })
  .strict();
export type ExploreSynthesis = z.infer<typeof ExploreSynthesis>;

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

export const ExploreResultArtifactId = z.enum([
  'explore.brief',
  'explore.analysis',
  'explore.synthesis',
  'explore.review-verdict',
]);
export type ExploreResultArtifactId = z.infer<typeof ExploreResultArtifactId>;

export const ExploreResultArtifactPointer = z
  .object({
    artifact_id: ExploreResultArtifactId,
    path: z.string().min(1),
    schema: z.string().min(1),
  })
  .strict()
  .superRefine((pointer, ctx) => {
    const expectedSchema = EXPLORE_RESULT_SCHEMA_BY_ARTIFACT_ID[pointer.artifact_id];
    if (pointer.schema !== expectedSchema) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['schema'],
        message: `schema must be '${expectedSchema}' for artifact_id '${pointer.artifact_id}'`,
      });
    }
  });
export type ExploreResultArtifactPointer = z.infer<typeof ExploreResultArtifactPointer>;

export const ExploreResultVerdictSnapshot = z
  .object({
    synthesis_verdict: z.string().min(1),
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
    artifact_pointers: z.array(ExploreResultArtifactPointer).length(4),
  })
  .strict()
  .superRefine((result, ctx) => {
    const seen = new Set<ExploreResultArtifactId>();
    for (const [index, pointer] of result.artifact_pointers.entries()) {
      if (seen.has(pointer.artifact_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['artifact_pointers', index, 'artifact_id'],
          message: `duplicate artifact_id '${pointer.artifact_id}'`,
        });
      }
      seen.add(pointer.artifact_id);
    }
    for (const artifactId of ExploreResultArtifactId.options) {
      if (!seen.has(artifactId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['artifact_pointers'],
          message: `missing artifact_id '${artifactId}'`,
        });
      }
    }
  });
export type ExploreResult = z.infer<typeof ExploreResult>;
