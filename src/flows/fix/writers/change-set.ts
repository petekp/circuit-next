// Fix change-set writer.
//
// Runs after fix-verify. Captures the post-fix working-tree state with
// `git status --porcelain` and `git rev-parse HEAD`, then computes the set
// of files actually touched by the fix as:
//
//     observed = (post porcelain paths) − (pre porcelain paths)
//
// (i.e. paths that became dirty during the run, not paths that were already
// dirty pre-fix). The writer compares observed against the implementer's
// `fix.change@v1` `changed_files` declaration and emits:
//
//   - status 'pass' when the two sets match exactly
//   - status 'fail' when there is at least one undeclared extra (file
//     touched but not declared) or at least one missing declared (file
//     declared but never modified). fix-close cannot mark outcome 'fixed'
//     on a failed change-set — the implementer either touched files outside
//     the declared scope or lied about which files were edited.
//
// HEAD is also compared between baseline and post-fix. If they differ the
// agent committed mid-run, which the contract does not currently allow; the
// writer flags it via reason rather than silently treating commits as no-ops.

import { readFileSync } from 'node:fs';
import { resolveRunRelative } from '../../../shared/run-relative-path.js';
import { reportPathForSchemaInCompiledFlow } from '../../registries/close-writers/shared.js';
import type {
  VerificationBuildContext,
  VerificationBuilder,
  VerificationCommand,
  VerificationCommandObservation,
} from '../../registries/verification-writers/types.js';
import { FixBaselineSnapshot, FixChange, FixChangeSet } from '../reports.js';

const GIT_TIMEOUT_MS = 30_000;
const GIT_MAX_OUTPUT_BYTES = 1_000_000;

const REV_PARSE_COMMAND: VerificationCommand = {
  id: 'fix-change-set-rev-parse',
  cwd: '.',
  argv: ['git', 'rev-parse', 'HEAD'],
  timeout_ms: GIT_TIMEOUT_MS,
  max_output_bytes: GIT_MAX_OUTPUT_BYTES,
  env: {},
};

const STATUS_COMMAND: VerificationCommand = {
  id: 'fix-change-set-status',
  cwd: '.',
  argv: ['git', 'status', '--porcelain'],
  timeout_ms: GIT_TIMEOUT_MS,
  max_output_bytes: GIT_MAX_OUTPUT_BYTES,
  env: {},
};

// Parse a single `git status --porcelain` line into the path it refers to.
// Porcelain v1 format is "XY <path>" where XY is a two-character status code
// and <path> may be quoted (when it contains special characters) or include
// a rename arrow ("R  old -> new" — we want the new path). For our purposes
// the path is what matters; we ignore XY entirely.
function parsePorcelainPath(line: string): string {
  const trimmed = line.length > 3 ? line.slice(3) : line;
  // Renames/copies use " old -> new"; take the destination since that's
  // what's currently in the tree.
  const arrowIndex = trimmed.indexOf(' -> ');
  const raw = arrowIndex >= 0 ? trimmed.slice(arrowIndex + 4) : trimmed;
  // Strip surrounding quotes if present (porcelain v1 may quote paths with
  // special characters); we don't unescape — paths in our codebase don't
  // need it, and round-trip equality is what matters for set comparison.
  if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
    return raw.slice(1, -1);
  }
  return raw;
}

function porcelainPathSet(lines: readonly string[]): Set<string> {
  const set = new Set<string>();
  for (const line of lines) {
    const path = parsePorcelainPath(line);
    if (path.length > 0) set.add(path);
  }
  return set;
}

export const fixChangeSetWriter: VerificationBuilder = {
  resultSchemaName: 'fix.change-set@v1',
  loadCommands(context: VerificationBuildContext): readonly VerificationCommand[] {
    // Verify that this step reads the inputs the writer requires; mirror the
    // pattern in regression-baseline so misconfigured schematics fail fast.
    const baselinePath = reportPathForSchemaInCompiledFlow(
      context.flow,
      'fix.baseline-snapshot@v1',
    );
    const changePath = reportPathForSchemaInCompiledFlow(context.flow, 'fix.change@v1');
    if (!context.step.reads.includes(baselinePath as never)) {
      throw new Error(
        `fix.change-set@v1 requires step '${context.step.id}' to read ${baselinePath}`,
      );
    }
    if (!context.step.reads.includes(changePath as never)) {
      throw new Error(`fix.change-set@v1 requires step '${context.step.id}' to read ${changePath}`);
    }
    return [REV_PARSE_COMMAND, STATUS_COMMAND];
  },
  buildResult(
    observations: readonly VerificationCommandObservation[],
    context: VerificationBuildContext,
  ): unknown {
    if (observations.length !== 2) {
      throw new Error(`fix.change-set@v1: expected 2 git observations, got ${observations.length}`);
    }
    const [revParse, status] = observations;
    if (revParse === undefined || status === undefined) {
      throw new Error('fix.change-set@v1: git observations missing');
    }
    if (revParse.status !== 'passed') {
      throw new Error(
        `fix.change-set@v1: git rev-parse HEAD failed (exit ${revParse.exit_code}): ${revParse.stderr_summary}`,
      );
    }
    if (status.status !== 'passed') {
      throw new Error(
        `fix.change-set@v1: git status --porcelain failed (exit ${status.exit_code}): ${status.stderr_summary}`,
      );
    }
    const headSha = revParse.stdout_summary.trim();
    if (headSha.length === 0) {
      throw new Error('fix.change-set@v1: git rev-parse HEAD returned no SHA');
    }
    const postPorcelain = status.stdout_summary
      .split('\n')
      .map((line) => line.replace(/\r$/, ''))
      .filter((line) => line.length > 0);

    const baselinePath = reportPathForSchemaInCompiledFlow(
      context.flow,
      'fix.baseline-snapshot@v1',
    );
    const changePath = reportPathForSchemaInCompiledFlow(context.flow, 'fix.change@v1');
    const baseline = FixBaselineSnapshot.parse(
      JSON.parse(readFileSync(resolveRunRelative(context.runFolder, baselinePath), 'utf8')),
    );
    const change = FixChange.parse(
      JSON.parse(readFileSync(resolveRunRelative(context.runFolder, changePath), 'utf8')),
    );

    const baselinePathSet = porcelainPathSet(baseline.working_tree_porcelain);
    const postPathSet = porcelainPathSet(postPorcelain);
    // Observed = anything dirty post-fix that wasn't already dirty pre-fix.
    // Sort so the result is deterministic regardless of git's output order.
    const observed = [...postPathSet]
      .filter((path) => !baselinePathSet.has(path))
      .sort((a, b) => a.localeCompare(b));
    const declared = [...change.changed_files].sort((a, b) => a.localeCompare(b));

    const declaredSet = new Set(declared);
    const observedSet = new Set(observed);
    const undeclaredExtras = observed.filter((path) => !declaredSet.has(path));
    const missingDeclared = declared.filter((path) => !observedSet.has(path));

    const headDiverged = headSha !== baseline.head_sha;

    let status_: 'pass' | 'fail';
    let reason: string | undefined;
    if (headDiverged) {
      status_ = 'fail';
      reason = `HEAD moved during the fix run (baseline ${baseline.head_sha}, post ${headSha}); the agent committed mid-run, which the change-set writer cannot reconcile against the declared file list.`;
    } else if (undeclaredExtras.length === 0 && missingDeclared.length === 0) {
      status_ = 'pass';
      reason = undefined;
    } else {
      status_ = 'fail';
      const parts: string[] = [];
      if (undeclaredExtras.length > 0) {
        parts.push(`undeclared extras: ${undeclaredExtras.join(', ')}`);
      }
      if (missingDeclared.length > 0) {
        parts.push(`missing declared: ${missingDeclared.join(', ')}`);
      }
      reason = `Change-set diverges from the declared file list — ${parts.join('; ')}.`;
    }

    return FixChangeSet.parse({
      status: status_,
      overall_status: status_ === 'pass' ? 'passed' : 'failed',
      ...(reason === undefined ? {} : { reason }),
      baseline_head_sha: baseline.head_sha,
      head_sha: headSha,
      declared,
      observed,
      undeclared_extras: undeclaredExtras,
      missing_declared: missingDeclared,
    });
  },
};
