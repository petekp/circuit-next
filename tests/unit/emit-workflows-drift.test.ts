// Tests for the stale-sibling guard in scripts/emit-workflows.mjs.
//
// The CLI loader at src/cli/circuit.ts prefers `<mode>.json` over
// `circuit.json` when an entry mode is requested, so a stale per-mode
// sibling (left behind from a renamed/collapsed entry mode) can silently
// drive runtime behavior even after `npm run verify` reports clean.
//
// `--check` must fail when an unexpected JSON sibling exists in a
// recipe-controlled skill dir; `emit` mode must remove it.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const projectRoot = resolve(__dirname, '../..');
const emitScript = resolve(projectRoot, 'scripts/emit-workflows.mjs');
const buildSkillDir = resolve(projectRoot, '.claude-plugin/skills/build');
const stalePath = resolve(buildSkillDir, 'never-a-mode.json');

function planted(): boolean {
  return existsSync(stalePath);
}

function plantStaleSibling() {
  writeFileSync(stalePath, '{"stale":"sibling"}\n');
}

function removeStaleSiblingIfPresent() {
  if (planted()) unlinkSync(stalePath);
}

describe('emit-workflows.mjs — stale per-mode sibling guard', () => {
  beforeAll(() => {
    // The script imports from dist/, so make sure it's built before any
    // subprocess calls. The verify pipeline does this in order; the test
    // suite needs to do it too when invoked in isolation.
    execFileSync('npm', ['run', 'build'], { cwd: projectRoot, stdio: 'pipe' });
  });

  afterEach(() => {
    removeStaleSiblingIfPresent();
  });

  it('--check exits 1 and names the stale sibling when one exists', () => {
    plantStaleSibling();
    const res = spawnSync('node', [emitScript, '--check'], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    expect(res.status).toBe(1);
    const combined = `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
    expect(combined).toContain('.claude-plugin/skills/build/never-a-mode.json');
    expect(combined).toContain('not in the emit plan');
  });

  it('emit mode removes a stale sibling on the next run', () => {
    plantStaleSibling();
    expect(planted()).toBe(true);
    const res = spawnSync('node', [emitScript], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    expect(res.status).toBe(0);
    expect(planted()).toBe(false);
    expect(res.stdout ?? '').toContain(
      'removed stale .claude-plugin/skills/build/never-a-mode.json',
    );
  });
});
