import { z } from 'zod';

export const ReviewFindingSeverity = z.enum(['critical', 'high', 'low']);
export type ReviewFindingSeverity = z.infer<typeof ReviewFindingSeverity>;

export const ReviewResultVerdict = z.enum(['CLEAN', 'ISSUES_FOUND']);
export type ReviewResultVerdict = z.infer<typeof ReviewResultVerdict>;

export const ReviewDispatchVerdict = z.enum(['NO_ISSUES_FOUND', 'ISSUES_FOUND']);
export type ReviewDispatchVerdict = z.infer<typeof ReviewDispatchVerdict>;

export const ReviewFinding = z
  .object({
    severity: ReviewFindingSeverity,
    id: z.string().min(1),
    text: z.string().min(1),
    file_refs: z.array(z.string().min(1)),
  })
  .strict();
export type ReviewFinding = z.infer<typeof ReviewFinding>;

export function computeReviewVerdict(
  findings: readonly { readonly severity: ReviewFindingSeverity }[],
): ReviewResultVerdict {
  return findings.some((finding) => finding.severity === 'critical' || finding.severity === 'high')
    ? 'ISSUES_FOUND'
    : 'CLEAN';
}

export const ReviewResult = z
  .object({
    scope: z.string().min(1),
    findings: z.array(ReviewFinding),
    verdict: ReviewResultVerdict,
  })
  .strict()
  .superRefine((artifact, ctx) => {
    const expected = computeReviewVerdict(artifact.findings);
    if (artifact.verdict !== expected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['verdict'],
        message: `REVIEW-I2: verdict must be ${expected} for the artifact findings (CLEAN iff critical_count == 0 and high_count == 0)`,
      });
    }
  });
export type ReviewResult = z.infer<typeof ReviewResult>;

export const ReviewDispatchResult = z
  .object({
    verdict: ReviewDispatchVerdict,
    findings: z.array(ReviewFinding),
  })
  .strict();
export type ReviewDispatchResult = z.infer<typeof ReviewDispatchResult>;
