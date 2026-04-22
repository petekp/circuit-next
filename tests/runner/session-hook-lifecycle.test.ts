import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// Slice 47b Codex challenger fold-in — HIGH 1.
//
// Originating finding (specs/reviews/arc-slice-47b-codex.md §HIGH 1):
// The pre-fold-in `session-hook-behavior.test.ts` tests hook rendering
// against canned JSON; it does NOT exercise the save → persist →
// SessionStart resume → clear lifecycle ADR-0007 CC#P2-4 names. A
// regression in the real continuity save/clear path could still leave
// the hook-behavior tests green. Closing the CC#P2-4 binding requires
// one integration test that drives the lifecycle across the
// hook/engine boundary.
//
// This test uses a PERSISTING stub engine (not the canned-JSON stub in
// session-hook-behavior.test.ts): the stub implements the minimal
// `continuity save` / `continuity status --json` / `continuity clear`
// surface with real state-file persistence. The full create → render →
// clear cycle exercises the same data path the hooks traverse in
// production, so a regression in that path (e.g. the save command
// writes a JSON shape SessionStart.sh cannot parse, or clear leaves
// residual state) lands red here.
//
// Engine contract coverage is pinned separately at
// tests/runner/hook-engine-contract.test.ts (Slice 47b Codex HIGH 2
// fold-in) so this test focuses strictly on the lifecycle flow.

const SESSION_START_HOOK = resolve('.claude/hooks/SessionStart.sh');
const SESSION_END_HOOK = resolve('.claude/hooks/SessionEnd.sh');

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

/**
 * Scaffold a project root with a PERSISTING stub engine. Unlike the
 * canned-JSON stub used in session-hook-behavior.test.ts, this stub
 * implements real state management for the three `continuity`
 * subcommands the hooks + lifecycle test exercise:
 *
 *   - `continuity save --goal G --next N --state-markdown S
 *      --debt-markdown D` writes a pending-record JSON to the stub's
 *      state file.
 *   - `continuity status --json` prints the current state-file JSON,
 *      or nothing if no state exists.
 *   - `continuity clear` removes the state file.
 *
 * Any other subcommand exits 0 silently.
 *
 * The persisting stub pins the minimal JSON shape SessionStart.sh +
 * SessionEnd.sh parse (selection / record.narrative.goal / record.
 * narrative.next / record.record_id / record.git.base_commit /
 * warnings). The hook-engine-contract.test.ts sibling file pins
 * argv + JSON shape against live-engine observations.
 */
const PERSISTING_STUB_BODY = [
  '#!/usr/bin/env bash',
  '# Persisting stub engine for Slice 47b hook-lifecycle integration test.',
  '# Supports exactly the three continuity subcommands the hooks + this',
  '# test exercise; any other command is a silent no-op.',
  'set -uo pipefail',
  'STATE_DIR=".circuit/state"',
  'STATE_FILE="$STATE_DIR/continuity-stub.json"',
  '',
  'if [ "$1" = "continuity" ] && [ "$2" = "status" ]; then',
  '  if [ $# -ge 3 ] && [ "$3" = "--json" ]; then',
  '    if [ -f "$STATE_FILE" ]; then',
  '      cat "$STATE_FILE"',
  '    else',
  '      # Empty-state shape: mirror the real engine contract by always',
  '      # returning JSON with an explicit selection, so downstream hooks',
  '      # exercise their "none" branches instead of the empty-STATUS bail.',
  '      printf \'{"selection": "none"}\\n\'',
  '    fi',
  '  fi',
  '  exit 0',
  'fi',
  '',
  'if [ "$1" = "continuity" ] && [ "$2" = "save" ]; then',
  '  shift 2',
  '  GOAL=""; NEXT=""',
  '  while [ $# -gt 0 ]; do',
  '    case "$1" in',
  '      --goal)           GOAL="$2";           shift 2 ;;',
  '      --next)           NEXT="$2";           shift 2 ;;',
  '      --state-markdown) shift 2 ;;',
  '      --debt-markdown)  shift 2 ;;',
  '      *) shift ;;',
  '    esac',
  '  done',
  '  HEAD=$(git rev-parse HEAD 2>/dev/null || printf "none")',
  '  mkdir -p "$STATE_DIR" 2>/dev/null || true',
  '  # Escape backslashes and double-quotes for JSON embedding.',
  '  ESC_GOAL=$(printf "%s" "$GOAL" | sed \'s/\\\\/\\\\\\\\/g; s/"/\\\\"/g\')',
  '  ESC_NEXT=$(printf "%s" "$NEXT" | sed \'s/\\\\/\\\\\\\\/g; s/"/\\\\"/g\')',
  '  {',
  "    printf '{\\n'",
  '    printf \'  "selection": "pending_record",\\n\'',
  '    printf \'  "record": {\\n\'',
  '    printf \'    "record_id": "continuity-lifecycle-test-record-01",\\n\'',
  '    printf \'    "narrative": {"goal": "%s", "next": "%s"},\\n\' "$ESC_GOAL" "$ESC_NEXT"',
  '    printf \'    "git": {"base_commit": "%s"}\\n\' "$HEAD"',
  "    printf '  },\\n'",
  '    printf \'  "warnings": []\\n\'',
  "    printf '}\\n'",
  '  } > "$STATE_FILE"',
  '  exit 0',
  'fi',
  '',
  'if [ "$1" = "continuity" ] && [ "$2" = "clear" ]; then',
  '  rm -f "$STATE_FILE"',
  '  exit 0',
  'fi',
  '',
  'exit 0',
  '',
].join('\n');

function scaffoldPersistingStubRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'circuit-next-47b-lifecycle-'));

  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: root });
  execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'root'], { cwd: root });

  const binDir = join(root, '.circuit', 'bin');
  mkdirSync(binDir, { recursive: true });
  const engineStub = join(binDir, 'circuit-engine');
  writeFileSync(engineStub, PERSISTING_STUB_BODY);
  chmodSync(engineStub, 0o755);
  return root;
}

let scaffoldedRoots: string[] = [];

afterEach(() => {
  for (const root of scaffoldedRoots) {
    rmSync(root, { recursive: true, force: true });
  }
  scaffoldedRoots = [];
});

function makePersistingRoot(): string {
  const root = scaffoldPersistingStubRoot();
  scaffoldedRoots.push(root);
  return root;
}

function runEngine(root: string, args: string[]): { exitCode: number; stdout: string } {
  const proc = spawnSync('.circuit/bin/circuit-engine', args, {
    cwd: root,
    encoding: 'utf-8',
  });
  return { exitCode: proc.status ?? -1, stdout: proc.stdout ?? '' };
}

describe('Slice 47b — hook + engine lifecycle (Codex HIGH 1 fold-in)', () => {
  it('full cycle: status(empty) → SessionStart silent → save → SessionStart banner → clear → SessionStart silent', () => {
    const root = makePersistingRoot();

    // 1. Initial state: no continuity record exists. Stub mirrors the real
    //    engine contract by returning `{"selection": "none"}` rather than
    //    exiting silent, so the hook dispatches through its selection
    //    switch instead of bailing on an empty STATUS_JSON guard.
    const initialStatus = runEngine(root, ['continuity', 'status', '--json']).stdout;
    expect(initialStatus).toContain('"selection": "none"');
    let hook = invokeHook(SESSION_START_HOOK, root);
    expect(hook.exitCode).toBe(0);
    expect(hook.stdout).toBe('');

    // 2. Save a pending continuity record through the engine.
    const saveResult = runEngine(root, [
      'continuity',
      'save',
      '--goal',
      'prove the full hook/engine lifecycle works end-to-end',
      '--next',
      'run the integration test',
      '--state-markdown',
      'lifecycle-state',
      '--debt-markdown',
      'none',
    ]);
    expect(saveResult.exitCode).toBe(0);

    // 3. Status reflects the saved record as pending.
    const statusAfterSave = runEngine(root, ['continuity', 'status', '--json']).stdout;
    expect(statusAfterSave).toContain('"selection": "pending_record"');
    expect(statusAfterSave).toContain(
      '"goal": "prove the full hook/engine lifecycle works end-to-end"',
    );

    // 4. SessionStart renders the pending-record banner with saved content.
    hook = invokeHook(SESSION_START_HOOK, root);
    expect(hook.exitCode).toBe(0);
    expect(hook.stdout).toContain('> **Circuit continuity pending.**');
    expect(hook.stdout).toContain('> Goal: prove the full hook/engine lifecycle works end-to-end');
    expect(hook.stdout).toContain('> Next: run the integration test');
    expect(hook.stdout).toContain('Available: pending continuity');

    // 5. SessionEnd emits a synced-to-HEAD tombstone (base_commit == current HEAD).
    hook = invokeHook(SESSION_END_HOOK, root);
    expect(hook.exitCode).toBe(0);
    expect(hook.stderr).toContain('synced to HEAD');

    // 6. Clear the continuity record through the engine.
    const clearResult = runEngine(root, ['continuity', 'clear']);
    expect(clearResult.exitCode).toBe(0);

    // 7. Status reports selection: none again (stub mirrors real engine
    //    by always emitting a JSON envelope).
    expect(runEngine(root, ['continuity', 'status', '--json']).stdout).toContain(
      '"selection": "none"',
    );

    // 8. SessionStart is silent again (regression: the prior canned-stub
    //    tests could not catch a bug where clear failed to persist).
    hook = invokeHook(SESSION_START_HOOK, root);
    expect(hook.exitCode).toBe(0);
    expect(hook.stdout).toBe('');

    // 9. SessionEnd reflects no-record state.
    hook = invokeHook(SESSION_END_HOOK, root);
    expect(hook.exitCode).toBe(0);
    expect(hook.stderr).toContain('no continuity record');
  });

  it('save writes a state file on disk at .circuit/state/continuity-stub.json', () => {
    const root = makePersistingRoot();
    const stateFile = join(root, '.circuit', 'state', 'continuity-stub.json');
    expect(existsSync(stateFile)).toBe(false);

    runEngine(root, [
      'continuity',
      'save',
      '--goal',
      'persistence-check',
      '--next',
      'read the file back',
      '--state-markdown',
      's',
      '--debt-markdown',
      'none',
    ]);

    expect(existsSync(stateFile)).toBe(true);
    const payload = JSON.parse(readFileSync(stateFile, 'utf-8'));
    expect(payload.selection).toBe('pending_record');
    expect(payload.record.narrative.goal).toBe('persistence-check');
    expect(payload.record.narrative.next).toBe('read the file back');
  });

  it('clear removes the state file so status returns empty', () => {
    const root = makePersistingRoot();
    runEngine(root, [
      'continuity',
      'save',
      '--goal',
      'g',
      '--next',
      'n',
      '--state-markdown',
      's',
      '--debt-markdown',
      'none',
    ]);
    const stateFile = join(root, '.circuit', 'state', 'continuity-stub.json');
    expect(existsSync(stateFile)).toBe(true);

    runEngine(root, ['continuity', 'clear']);
    expect(existsSync(stateFile)).toBe(false);
    expect(runEngine(root, ['continuity', 'status', '--json']).stdout).toContain(
      '"selection": "none"',
    );
  });
});
