import { z } from 'zod';

export const ReviewFindingSeverity = z.enum(['critical', 'high', 'low']);
export type ReviewFindingSeverity = z.infer<typeof ReviewFindingSeverity>;

export const ReviewResultVerdict = z.enum(['CLEAN', 'ISSUES_FOUND']);
export type ReviewResultVerdict = z.infer<typeof ReviewResultVerdict>;

export const ReviewRelayVerdict = z.enum(['NO_ISSUES_FOUND', 'ISSUES_FOUND']);
export type ReviewRelayVerdict = z.infer<typeof ReviewRelayVerdict>;

export const ReviewEvidenceText = z
  .object({
    text: z.string(),
    truncated: z.boolean(),
  })
  .strict();
export type ReviewEvidenceText = z.infer<typeof ReviewEvidenceText>;

export const ReviewUntrackedFileEvidence = z
  .object({
    path: z.string().min(1),
    byte_length: z.number().int().nonnegative(),
    content: ReviewEvidenceText.optional(),
    skipped_reason: z.string().min(1).optional(),
  })
  .strict();
export type ReviewUntrackedFileEvidence = z.infer<typeof ReviewUntrackedFileEvidence>;

export const ReviewEvidence = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('unavailable'),
      reason: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('git-working-tree'),
      project_root: z.string().min(1),
      status_short: z.string(),
      staged_diff: ReviewEvidenceText,
      unstaged_diff: ReviewEvidenceText,
      diff_stat: z.string(),
      untracked_file_count: z.number().int().nonnegative(),
      untracked_files_truncated: z.boolean(),
      untracked_files: z.array(ReviewUntrackedFileEvidence),
    })
    .strict(),
]);
export type ReviewEvidence = z.infer<typeof ReviewEvidence>;

export const ReviewIntake = z
  .object({
    scope: z.string().min(1),
    evidence: ReviewEvidence,
  })
  .strict();
export type ReviewIntake = z.infer<typeof ReviewIntake>;

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
        message: `verdict must be ${expected} for the report findings (CLEAN iff critical_count == 0 and high_count == 0)`,
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
