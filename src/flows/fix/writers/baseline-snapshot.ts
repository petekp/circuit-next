// Fix baseline-snapshot writer.
//
// Runs immediately before fix-act. Snapshots the working tree's git state so
// the post-fix-verify change-set step has a reference point. The snapshot is
// what counts as "before the fix" — anything that becomes dirty between this
// snapshot and the change-set step is owned by fix-act.
//
// Two commands run:
//   1. `git rev-parse HEAD`       — records the commit SHA at fix-act start
//   2. `git status --porcelain`   — records every file already dirty
//      (modified, untracked, staged, etc.) so the change-set writer can
//      subtract pre-existing dirt from observed post-fix dirt and end up
//      with just the fix's actual file changes.
//
// overall_status is always 'passed' here. The snapshot's job is to record
// state, not to gate routing — even on a clean tree we want the run to
// continue. Failures (e.g. git missing, not a repo) abort via the runner's
// own error path.

import type {
  VerificationBuildContext,
  VerificationBuilder,
  VerificationCommand,
  VerificationCommandObservation,
} from '../../registries/verification-writers/types.js';
import { FixBaselineSnapshot } from '../reports.js';

const GIT_TIMEOUT_MS = 30_000;
const GIT_MAX_OUTPUT_BYTES = 1_000_000;

const REV_PARSE_COMMAND: VerificationCommand = {
  id: 'fix-baseline-snapshot-rev-parse',
  cwd: '.',
  argv: ['git', 'rev-parse', 'HEAD'],
  timeout_ms: GIT_TIMEOUT_MS,
  max_output_bytes: GIT_MAX_OUTPUT_BYTES,
  env: {},
};

const STATUS_COMMAND: VerificationCommand = {
  id: 'fix-baseline-snapshot-status',
  cwd: '.',
  argv: ['git', 'status', '--porcelain'],
  timeout_ms: GIT_TIMEOUT_MS,
  max_output_bytes: GIT_MAX_OUTPUT_BYTES,
  env: {},
};

export const fixBaselineSnapshotWriter: VerificationBuilder = {
  resultSchemaName: 'fix.baseline-snapshot@v1',
  loadCommands(_context: VerificationBuildContext): readonly VerificationCommand[] {
    return [REV_PARSE_COMMAND, STATUS_COMMAND];
  },
  buildResult(observations: readonly VerificationCommandObservation[]): unknown {
    if (observations.length !== 2) {
      throw new Error(
        `fix.baseline-snapshot@v1: expected 2 git observations, got ${observations.length}`,
      );
    }
    const [revParse, status] = observations;
    if (revParse === undefined || status === undefined) {
      throw new Error('fix.baseline-snapshot@v1: git observations missing');
    }
    if (revParse.status !== 'passed') {
      throw new Error(
        `fix.baseline-snapshot@v1: git rev-parse HEAD failed (exit ${revParse.exit_code}): ${revParse.stderr_summary}`,
      );
    }
    if (status.status !== 'passed') {
      throw new Error(
        `fix.baseline-snapshot@v1: git status --porcelain failed (exit ${status.exit_code}): ${status.stderr_summary}`,
      );
    }
    const head = revParse.stdout_summary.trim();
    if (head.length === 0) {
      throw new Error('fix.baseline-snapshot@v1: git rev-parse HEAD returned no SHA');
    }
    const porcelainLines = status.stdout_summary
      .split('\n')
      .map((line) => line.replace(/\r$/, ''))
      .filter((line) => line.length > 0);
    return FixBaselineSnapshot.parse({
      overall_status: 'passed',
      head_sha: head,
      working_tree_porcelain: porcelainLines,
    });
  },
};
