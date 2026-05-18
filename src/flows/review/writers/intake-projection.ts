import { ReviewIntake } from '../reports.js';
import type { ReviewEvidence, ReviewEvidenceWarning } from '../reports.js';

export type ReviewIntakeProjectorInputs = {
  readonly scope: string;
  readonly evidence: ReviewEvidence;
  readonly maxUntrackedFiles: number;
};

function gitCommandFailed(text: string): boolean {
  return /^git\s+.+\s+failed:/.test(text);
}

export function reviewEvidenceWarnings(input: {
  readonly evidence: ReviewEvidence;
  readonly maxUntrackedFiles: number;
}): ReviewEvidenceWarning[] {
  if (input.evidence.kind === 'unavailable') {
    return [
      {
        kind: 'evidence_unavailable',
        message: input.evidence.reason,
      },
    ];
  }

  const warnings: ReviewEvidenceWarning[] = [];
  const evidence = input.evidence;
  const hasUntrackedContent = evidence.untracked_files.some((file) => file.content !== undefined);
  if (
    evidence.staged_diff.text.length === 0 &&
    evidence.unstaged_diff.text.length === 0 &&
    !hasUntrackedContent &&
    !gitCommandFailed(evidence.staged_diff.text) &&
    !gitCommandFailed(evidence.unstaged_diff.text)
  ) {
    warnings.push({
      kind: 'scope_empty',
      message:
        'review scoped to uncommitted changes only; HEAD~1 differences not examined. The reviewer had no source content to inspect: staged/unstaged diffs were empty and no untracked file content was relayed.',
    });
  }
  if (evidence.staged_diff.truncated) {
    warnings.push({
      kind: 'diff_truncated',
      message: 'staged diff was truncated before relay',
    });
  }
  if (evidence.unstaged_diff.truncated) {
    warnings.push({
      kind: 'diff_truncated',
      message: 'unstaged diff was truncated before relay',
    });
  }
  if (gitCommandFailed(evidence.staged_diff.text)) {
    warnings.push({
      kind: 'git_command_failed',
      message: evidence.staged_diff.text,
    });
  }
  if (gitCommandFailed(evidence.unstaged_diff.text)) {
    warnings.push({
      kind: 'git_command_failed',
      message: evidence.unstaged_diff.text,
    });
  }
  if (gitCommandFailed(evidence.diff_stat)) {
    warnings.push({
      kind: 'git_command_failed',
      message: evidence.diff_stat,
    });
  }
  if (evidence.untracked_files_truncated) {
    warnings.push({
      kind: 'untracked_files_truncated',
      message: `untracked file evidence was limited to ${input.maxUntrackedFiles} files`,
    });
  }
  if (evidence.untracked_content_policy === 'metadata-only' && evidence.untracked_file_count > 0) {
    warnings.push({
      kind: 'untracked_file_content_omitted',
      message:
        'untracked file contents were not included; pass --include-untracked-content only when those files are safe to relay',
    });
  }
  for (const file of evidence.untracked_files) {
    if (file.skipped_reason !== undefined) {
      warnings.push({
        kind: 'untracked_file_skipped',
        path: file.path,
        message: file.skipped_reason,
      });
    }
  }
  return warnings;
}

export function projectReviewIntake(input: ReviewIntakeProjectorInputs): ReviewIntake {
  return ReviewIntake.parse({
    scope: input.scope,
    evidence: input.evidence,
    evidence_warnings: reviewEvidenceWarnings({
      evidence: input.evidence,
      maxUntrackedFiles: input.maxUntrackedFiles,
    }),
  });
}
