import { z } from 'zod';

export const ReviewFindingSeverity = z.enum(['critical', 'high', 'low']);
export type ReviewFindingSeverity = z.infer<typeof ReviewFindingSeverity>;

export const ReviewResultVerdict = z.enum(['CLEAN', 'ISSUES_FOUND']);
export type ReviewResultVerdict = z.infer<typeof ReviewResultVerdict>;

export const ReviewRelayVerdict = z.enum(['NO_ISSUES_FOUND', 'ISSUES_FOUND']);
export type ReviewRelayVerdict = z.infer<typeof ReviewRelayVerdict>;

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
  .superRefine((report, ctx) => {
    const expected = computeReviewVerdict(report.findings);
    if (report.verdict !== expected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['verdict'],
        message: `REVIEW-I2: verdict must be ${expected} for the report findings (CLEAN iff critical_count == 0 and high_count == 0)`,
      });
    }
  });
export type ReviewResult = z.infer<typeof ReviewResult>;

export const ReviewRelayResult = z
  .object({
    verdict: ReviewRelayVerdict,
    findings: z.array(ReviewFinding),
  })
  .strict()
  .superRefine((report, ctx) => {
    const expected = report.findings.length === 0 ? 'NO_ISSUES_FOUND' : 'ISSUES_FOUND';
    if (report.verdict !== expected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['verdict'],
        message: `review relay verdict must be ${expected} for findings.length=${report.findings.length}`,
      });
    }
  });
export type ReviewRelayResult = z.infer<typeof ReviewRelayResult>;
