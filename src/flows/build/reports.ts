import { z } from 'zod';
import {
  VerificationCommand,
  VerificationCommandResult,
  VerificationResult,
} from '../../schemas/verification.js';

const BUILD_RESULT_SCHEMA_BY_ARTIFACT_ID = {
  'build.brief': 'build.brief@v1',
  'build.plan': 'build.plan@v1',
  'build.implementation': 'build.implementation@v1',
  'build.verification': 'build.verification@v1',
  'build.review': 'build.review@v1',
} as const;

const NonEmptyStringArray = z.array(z.string().min(1)).min(1);

const BuildCheckpointPointer = z
  .object({
    request_path: z.string().min(1),
    response_path: z.string().min(1).optional(),
    allowed_choices: NonEmptyStringArray,
  })
  .strict();

export const BuildBrief = z
  .object({
    objective: z.string().min(1),
    scope: z.string().min(1),
    success_criteria: NonEmptyStringArray,
    verification_command_candidates: z.array(VerificationCommand).min(1),
    checkpoint: BuildCheckpointPointer,
  })
  .strict();
export type BuildBrief = z.infer<typeof BuildBrief>;

export const BuildPlan = z
  .object({
    objective: z.string().min(1),
    approach: z.string().min(1),
    slices: NonEmptyStringArray,
    verification: z
      .object({
        commands: z.array(VerificationCommand).min(1),
      })
      .strict(),
  })
  .strict();
export type BuildPlan = z.infer<typeof BuildPlan>;

export const BuildImplementation = z
  .object({
    verdict: z.literal('accept'),
    summary: z.string().min(1),
    changed_files: z.array(z.string().min(1)),
    evidence: NonEmptyStringArray,
  })
  .strict();
export type BuildImplementation = z.infer<typeof BuildImplementation>;

export const BuildVerificationCommand = VerificationCommand;
export type BuildVerificationCommand = z.infer<typeof BuildVerificationCommand>;

export const BuildVerification = VerificationResult;
export type BuildVerification = z.infer<typeof BuildVerification>;

export const BuildVerificationCommandResult = VerificationCommandResult;
export type BuildVerificationCommandResult = z.infer<typeof BuildVerificationCommandResult>;

export const BuildReviewVerdict = z.enum(['accept', 'accept-with-fixes', 'reject']);
export type BuildReviewVerdict = z.infer<typeof BuildReviewVerdict>;

export const BuildReviewFinding = z
  .object({
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    text: z.string().min(1),
    file_refs: z.array(z.string().min(1)),
  })
  .strict();
export type BuildReviewFinding = z.infer<typeof BuildReviewFinding>;

export const BuildReview = z
  .object({
    verdict: BuildReviewVerdict,
    summary: z.string().min(1),
    findings: z.array(BuildReviewFinding),
  })
  .strict()
  .superRefine((review, ctx) => {
    if (review.verdict !== 'accept' && review.findings.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['findings'],
        message: `findings must be non-empty when verdict is '${review.verdict}'`,
      });
    }
  });
export type BuildReview = z.infer<typeof BuildReview>;

export const BuildResultReportId = z.enum([
  'build.brief',
  'build.plan',
  'build.implementation',
  'build.verification',
  'build.review',
]);
export type BuildResultReportId = z.infer<typeof BuildResultReportId>;

export const BuildResultReportPointer = z
  .object({
    report_id: BuildResultReportId,
    path: z.string().min(1),
    schema: z.string().min(1),
  })
  .strict()
  .superRefine((pointer, ctx) => {
    const expectedSchema = BUILD_RESULT_SCHEMA_BY_ARTIFACT_ID[pointer.report_id];
    if (pointer.schema !== expectedSchema) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['schema'],
        message: `schema must be '${expectedSchema}' for report_id '${pointer.report_id}'`,
      });
    }
  });
export type BuildResultReportPointer = z.infer<typeof BuildResultReportPointer>;

export const BuildResult = z
  .object({
    summary: z.string().min(1),
    outcome: z.enum(['complete', 'needs_attention', 'failed']),
    verification_status: z.enum(['passed', 'failed']),
    review_verdict: BuildReviewVerdict,
    evidence_links: z.array(BuildResultReportPointer).length(5),
  })
  .strict()
  .superRefine((result, ctx) => {
    const seen = new Set<BuildResultReportId>();
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
    for (const reportId of BuildResultReportId.options) {
      if (!seen.has(reportId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['evidence_links'],
          message: `missing report_id '${reportId}'`,
        });
      }
    }
    if (result.outcome === 'complete') {
      if (result.verification_status !== 'passed') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['verification_status'],
          message: "verification_status must be 'passed' when outcome is 'complete'",
        });
      }
      if (result.review_verdict !== 'accept') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['review_verdict'],
          message: "review_verdict must be 'accept' when outcome is 'complete'",
        });
      }
    }
    if (result.outcome === 'needs_attention') {
      if (result.verification_status !== 'passed') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['verification_status'],
          message: "verification_status must be 'passed' when outcome is 'needs_attention'",
        });
      }
      if (result.review_verdict !== 'accept-with-fixes') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['review_verdict'],
          message: "review_verdict must be 'accept-with-fixes' when outcome is 'needs_attention'",
        });
      }
    }
  });
export type BuildResult = z.infer<typeof BuildResult>;
