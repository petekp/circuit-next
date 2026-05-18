import {
  type FixBaselineSnapshot,
  type FixBaselineSnapshotEntry,
  type FixChange,
  FixChangeSet,
  type FixHiddenIndexFlag,
} from '../reports.js';
import type { GitStateHelperOutput } from './baseline-snapshot.js';

export type FixChangeSetProjectorInputs = {
  readonly baseline: FixBaselineSnapshot;
  readonly post: GitStateHelperOutput;
  readonly change: FixChange;
  readonly ignoredPathPrefixes?: readonly string[];
};

function isIgnoredPath(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function filterBaseline(
  baseline: FixBaselineSnapshot,
  prefixes: readonly string[],
): FixBaselineSnapshot {
  if (prefixes.length === 0) return baseline;
  return {
    ...baseline,
    entries: baseline.entries.filter((entry) => !isIgnoredPath(entry.path, prefixes)),
    hidden_index_flags: baseline.hidden_index_flags.filter(
      (flag) => !isIgnoredPath(flag.path, prefixes),
    ),
  };
}

function filterPost(post: GitStateHelperOutput, prefixes: readonly string[]): GitStateHelperOutput {
  if (prefixes.length === 0) return post;
  return {
    ...post,
    entries: post.entries.filter((entry) => !isIgnoredPath(entry.path, prefixes)),
    hidden_index_flags: post.hidden_index_flags.filter(
      (flag) => !isIgnoredPath(flag.path, prefixes),
    ),
  };
}

function fingerprintsByPath(entries: readonly FixBaselineSnapshotEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    map.set(entry.path, entry.fingerprint);
  }
  return map;
}

function hiddenFlagsByPath(flags: readonly FixHiddenIndexFlag[]): Set<string> {
  return new Set(flags.map((flag) => flag.path));
}

function computeObservedChangeSet(options: {
  readonly baseline: FixBaselineSnapshot;
  readonly post: GitStateHelperOutput;
  readonly declared: readonly string[];
}) {
  const { baseline, post, declared } = options;
  const baselineFingerprints = fingerprintsByPath(baseline.entries);
  const postFingerprints = fingerprintsByPath(post.entries);
  const baselinePaths = new Set(baselineFingerprints.keys());
  const postPaths = new Set(postFingerprints.keys());
  const baselineHiddenPaths = hiddenFlagsByPath(baseline.hidden_index_flags);

  const newDirt = [...postPaths].filter((path) => !baselinePaths.has(path));
  const baselineDirtyMutated = [...baselinePaths].filter((path) => {
    if (baselineHiddenPaths.has(path)) return false;
    const before = baselineFingerprints.get(path);
    const after = postFingerprints.get(path);
    return before !== after;
  });

  const observedSet = new Set<string>([...newDirt, ...baselineDirtyMutated]);
  const observed = [...observedSet].sort((a, b) => a.localeCompare(b));
  const declaredSorted = [...declared].sort((a, b) => a.localeCompare(b));
  const declaredSet = new Set(declaredSorted);
  const undeclaredExtras = observed.filter((path) => !declaredSet.has(path));
  const missingDeclared = declaredSorted.filter((path) => !observedSet.has(path));
  const baselineDirtyMutatedSorted = [...baselineDirtyMutated].sort((a, b) => a.localeCompare(b));

  return {
    observed,
    declared: declaredSorted,
    undeclaredExtras,
    missingDeclared,
    baselineDirtyMutated: baselineDirtyMutatedSorted,
  };
}

export function projectFixChangeSet(inputs: FixChangeSetProjectorInputs): FixChangeSet {
  const ignoredPathPrefixes = inputs.ignoredPathPrefixes ?? [];
  const baseline = filterBaseline(inputs.baseline, ignoredPathPrefixes);
  const post = filterPost(inputs.post, ignoredPathPrefixes);
  const computed = computeObservedChangeSet({
    baseline,
    post,
    declared: inputs.change.changed_files,
  });

  const headDiverged = post.head_sha !== baseline.head_sha;
  const hiddenFlags: readonly FixHiddenIndexFlag[] = post.hidden_index_flags;
  const setsClean = computed.undeclaredExtras.length === 0 && computed.missingDeclared.length === 0;
  const status_: 'pass' | 'fail' =
    setsClean && !headDiverged && hiddenFlags.length === 0 ? 'pass' : 'fail';

  let reason: string | undefined;
  if (status_ === 'fail') {
    const parts: string[] = [];
    if (headDiverged) {
      parts.push(
        `HEAD moved during the fix run (baseline ${inputs.baseline.head_sha}, post ${inputs.post.head_sha}); the agent committed mid-run, which the change-set writer cannot reconcile against the declared file list.`,
      );
    }
    if (computed.undeclaredExtras.length > 0) {
      parts.push(`undeclared extras: ${computed.undeclaredExtras.join(', ')}`);
    }
    if (computed.missingDeclared.length > 0) {
      parts.push(`missing declared: ${computed.missingDeclared.join(', ')}`);
    }
    if (hiddenFlags.length > 0) {
      const labelled = hiddenFlags.map((flag) => `${flag.path} (${flag.tag})`).join(', ');
      parts.push(
        `hidden index flags present (assume-unchanged or skip-worktree paths can hide tracked edits from git status): ${labelled}`,
      );
    }
    reason = parts.join('; ');
  }

  return FixChangeSet.parse({
    status: status_,
    overall_status: status_ === 'pass' ? 'passed' : 'failed',
    ...(reason === undefined ? {} : { reason }),
    baseline_head_sha: baseline.head_sha,
    head_sha: post.head_sha,
    declared: computed.declared,
    observed: computed.observed,
    undeclared_extras: computed.undeclaredExtras,
    missing_declared: computed.missingDeclared,
    baseline_dirty_mutated: computed.baselineDirtyMutated,
    hidden_index_flags: [...hiddenFlags],
  });
}
