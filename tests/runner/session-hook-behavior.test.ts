import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// Slice 47b (Codex Slice 47a comprehensive review HIGH 2 fold-in) —
// behavioral coverage of the SessionStart + SessionEnd hook scripts.
//
// Pre-Slice-47b, CC#P2-4 closed at Slice 46b on the strength of two
// surfaces: (a) Check 33 `checkSessionHooksPresent` (presence +
// executable + text-references-engine + settings.json wiring), and
// (b) `tests/runner/continuity-lifecycle.test.ts` (engine CLI
// surface). Neither EXECUTED the hook scripts. The hook-audit tests
// only check that the script files contain certain strings, not that
// the scripts produce the banner/summary content the criterion
// names. A regression that left the hooks invocable but emitted the
// wrong banner (or no banner) would not surface.
//
// This test executes both hook scripts against ephemeral project
// roots scaffolded with a STUB engine that returns canned
// `continuity status --json` payloads, then asserts the captured
// stdout (SessionStart) / stderr (SessionEnd) matches the banner
// contract specified in the hook script comments + ADR-0007
// CC#P2-4 binding intent.
//
// Stub-engine rationale: `.circuit/bin/circuit-engine` is a portable
// shim that delegates to the operator's installed plugin
// (`.circuit/plugin-root` → `~/.claude/plugins/cache/petekp/circuit/
// <version>/scripts/relay/circuit-engine.sh`). Testing against the
// real engine would require the prior-gen plugin install AND would
// conflate hook-banner correctness with engine-CLI correctness.
// Stubbing isolates the SUT to the hook scripts themselves.
//
// `.gitignore` ignores `.circuit/` so the live engine shim is
// untracked; the stub engine is created in-test so a clean clone of
// circuit-next can run this test (closing the second half of Codex
// HIGH 2's "engine-shim untracked → clean-clone fails the lifecycle
// test" gap).

const SESSION_START_HOOK = resolve('.claude/hooks/SessionStart.sh');
const SESSION_END_HOOK = resolve('.claude/hooks/SessionEnd.sh');

interface StubEngineConfig {
  /** JSON object returned by `continuity status --json`. */
  readonly statusJson: Record<string, unknown>;
}

/**
 * Scaffold a portable ephemeral project root with a stub
 * `.circuit/bin/circuit-engine` that returns the configured
 * `statusJson` for `continuity status --json` invocations and
 * exits silently for any other command. The stub is a 12-line
 * bash script — no dependency on the prior-gen plugin install.
 */
function scaffoldStubEngineRoot(config: StubEngineConfig): string {
  const root = mkdtempSync(join(tmpdir(), 'circuit-next-47b-hook-'));
  // Initialize a git repo so SessionEnd's `git rev-parse HEAD` resolves.
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: root });
  execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'root'], { cwd: root });

  const binDir = join(root, '.circuit', 'bin');
  mkdirSync(binDir, { recursive: true });
  const engineStub = join(binDir, 'circuit-engine');
  // Stub: respond to `continuity status --json` with the canned JSON,
  // exit 0 for anything else (matches the hook scripts' silent-bail
  // expectation when the engine has nothing to say).
  const stubBody = [
    '#!/usr/bin/env bash',
    'if [ "$1" = "continuity" ] && [ "$2" = "status" ] && [ "$3" = "--json" ]; then',
    `  cat <<'EOF'`,
    JSON.stringify(config.statusJson),
    'EOF',
    '  exit 0',
    'fi',
    'exit 0',
    '',
  ].join('\n');
  writeFileSync(engineStub, stubBody);
  chmodSync(engineStub, 0o755);
  return root;
}

interface HookInvocationResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

function invokeHook(hookPath: string, projectRoot: string): HookInvocationResult {
  const proc = spawnSync('bash', [hookPath], {
    cwd: projectRoot,
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectRoot },
    encoding: 'utf-8',
    input: '',
  });
  return {
    stdout: proc.stdout ?? '',
    stderr: proc.stderr ?? '',
    exitCode: proc.status ?? -1,
  };
}

let scaffoldedRoots: string[] = [];

afterEach(() => {
  for (const root of scaffoldedRoots) {
    rmSync(root, { recursive: true, force: true });
  }
  scaffoldedRoots = [];
});

function makeRoot(config: StubEngineConfig): string {
  const root = scaffoldStubEngineRoot(config);
  scaffoldedRoots.push(root);
  return root;
}

// ---------------------------------------------------------------------
// SessionStart.sh behavioral assertions
// ---------------------------------------------------------------------

describe('Slice 47b — SessionStart.sh banner behavior (Codex HIGH 2 fold-in)', () => {
  it('emits empty stdout when continuity status reports selection: none', () => {
    const root = makeRoot({ statusJson: { selection: 'none' } });
    const result = invokeHook(SESSION_START_HOOK, root);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  it("emits the 'Circuit continuity pending' banner with goal + next when selection: pending_record", () => {
    const root = makeRoot({
      statusJson: {
        selection: 'pending_record',
        record: {
          narrative: {
            goal: 'finish the slice 47 hardening arc',
            next: 'open slice 47c after this lands',
          },
        },
        warnings: [],
      },
    });
    const result = invokeHook(SESSION_START_HOOK, root);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('> **Circuit continuity pending.**');
    expect(result.stdout).toContain('> Goal: finish the slice 47 hardening arc');
    expect(result.stdout).toContain('> Next: open slice 47c after this lands');
    expect(result.stdout).toContain('> **To pick back up:**');
    expect(result.stdout).toContain('/circuit:handoff resume');
    expect(result.stdout).toContain('Available: pending continuity');
  });

  it('surfaces continuity warnings inline in the pending-record banner', () => {
    const root = makeRoot({
      statusJson: {
        selection: 'pending_record',
        record: {
          narrative: {
            goal: 'g',
            next: 'n',
          },
        },
        warnings: ['warning-A', 'warning-B'],
      },
    });
    const result = invokeHook(SESSION_START_HOOK, root);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('> Warning: warning-A');
    expect(result.stdout).toContain('> Warning: warning-B');
  });

  it("emits the 'Circuit active run attached' banner when selection: current_run", () => {
    const root = makeRoot({ statusJson: { selection: 'current_run' } });
    const result = invokeHook(SESSION_START_HOOK, root);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('> **Circuit active run attached.**');
    expect(result.stdout).toContain('Available: active run');
  });

  it('exits 0 silently when .circuit/bin/circuit-engine is missing (clean-clone safety)', () => {
    const root = mkdtempSync(join(tmpdir(), 'circuit-next-47b-no-engine-'));
    scaffoldedRoots.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root });
    const result = invokeHook(SESSION_START_HOOK, root);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });
});

// ---------------------------------------------------------------------
// SessionEnd.sh behavioral assertions
// ---------------------------------------------------------------------

describe('Slice 47b — SessionEnd.sh tombstone behavior (Codex HIGH 2 fold-in)', () => {
  it('emits a synced-to-HEAD summary when pending continuity matches current HEAD', () => {
    const root = makeRoot({
      statusJson: {
        selection: 'pending_record',
        record: {
          record_id: 'continuity-abcd1234567890abcdef',
          git: { base_commit: '<placeholder>' }, // patched after we know HEAD
        },
      },
    });
    // Patch base_commit to match the current HEAD after git init.
    const head = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf-8',
    }).trim();
    // Re-scaffold with the actual HEAD so base_commit matches.
    rmSync(root, { recursive: true, force: true });
    scaffoldedRoots = scaffoldedRoots.filter((r) => r !== root);
    const root2 = makeRoot({
      statusJson: {
        selection: 'pending_record',
        record: {
          record_id: 'continuity-abcd1234567890abcdef',
          git: { base_commit: head },
        },
      },
    });
    // Need the same HEAD on root2; git init produces a different commit. Reset
    // by using the same author + same empty commit message + same tree (empty
    // commits have a deterministic SHA only if all inputs match; in practice
    // each `git init` + `git commit` pair produces a different SHA because of
    // the timestamp). Easier: read the new HEAD from root2 and re-emit the
    // status JSON via a regenerated stub.
    const head2 = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root2,
      encoding: 'utf-8',
    }).trim();
    // Overwrite the stub engine's canned JSON so base_commit matches root2's HEAD.
    const stubBody = [
      '#!/usr/bin/env bash',
      'if [ "$1" = "continuity" ] && [ "$2" = "status" ] && [ "$3" = "--json" ]; then',
      `  cat <<'EOF'`,
      JSON.stringify({
        selection: 'pending_record',
        record: {
          record_id: 'continuity-abcd1234567890abcdef',
          git: { base_commit: head2 },
        },
      }),
      'EOF',
      '  exit 0',
      'fi',
      'exit 0',
      '',
    ].join('\n');
    writeFileSync(join(root2, '.circuit', 'bin', 'circuit-engine'), stubBody);
    chmodSync(join(root2, '.circuit', 'bin', 'circuit-engine'), 0o755);

    const result = invokeHook(SESSION_END_HOOK, root2);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('circuit-next session ended');
    expect(result.stderr).toContain('synced to HEAD');
    // SessionEnd.sh truncates RECORD_ID to 24 chars (`${RECORD_ID:0:24}`):
    // continuity-abcd1234567890abcdef → continuity-abcd123456789.
    expect(result.stderr).toContain('continuity-abcd123456789');
  });

  it('emits a drift summary when pending continuity HEAD diverges from current HEAD', () => {
    const root = makeRoot({
      statusJson: {
        selection: 'pending_record',
        record: {
          record_id: 'continuity-deadbeefdeadbeef0000',
          git: { base_commit: 'cafebabe1234567890abcdef1234567890abcdef' },
        },
      },
    });
    const result = invokeHook(SESSION_END_HOOK, root);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('circuit-next session ended');
    expect(result.stderr).toContain('drifted past saved base_commit');
  });

  it('emits a no-continuity-record summary when selection: none', () => {
    const root = makeRoot({ statusJson: { selection: 'none' } });
    const result = invokeHook(SESSION_END_HOOK, root);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('circuit-next session ended: no continuity record');
  });

  it('emits a current-run-attached summary when selection: current_run', () => {
    const root = makeRoot({ statusJson: { selection: 'current_run' } });
    const result = invokeHook(SESSION_END_HOOK, root);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain(
      'circuit-next session ended: current_run attached without pending continuity record',
    );
  });

  it('exits 0 silently when .circuit/bin/circuit-engine is missing (clean-clone safety)', () => {
    const root = mkdtempSync(join(tmpdir(), 'circuit-next-47b-no-engine-'));
    scaffoldedRoots.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root });
    const result = invokeHook(SESSION_END_HOOK, root);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
  });
});
