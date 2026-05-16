import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { isoForPath, safeSegment } from './json.mjs';
import { commandOutput } from './process.mjs';

export function repoMetadata(repoRoot) {
  const gitStatus = commandOutput('git', ['status', '--short'], '', { cwd: repoRoot });
  return {
    repo_commit: commandOutput('git', ['rev-parse', 'HEAD'], 'unavailable', { cwd: repoRoot }),
    dirty_worktree: gitStatus.trim().length > 0,
    git_status_short: gitStatus,
  };
}

export function createResultRoot(outDir, label) {
  const resultRoot = resolve(outDir, `${isoForPath()}-${safeSegment(label)}`);
  mkdirSync(resultRoot, { recursive: true });
  return resultRoot;
}
