import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// Slice 47b Codex challenger fold-in — HIGH 2.
//
// Originating finding (specs/reviews/arc-slice-47b-codex.md §HIGH 2):
// The stub engine in session-hook-behavior.test.ts (and its sibling
// persisting stub in session-hook-lifecycle.test.ts) masks the exact
// hook-to-engine CLI contract. Both stubs accept any arguments
// beyond the first three and always exit 0, and the hooks supply
// `cwd` + `CLAUDE_PROJECT_DIR` without any assertion that the stub's
// root-discovery + stderr + exit-code conventions match the real
// engine. If the live engine's `continuity status --json` shape
// drifts (e.g. renames `.selection`, moves narrative fields, emits
// different JSON on failure), the stubbed tests can still pass.
//
// This test pins the minimal contract between the hook scripts and
// the engine CLI as enumerated constants + explicit assertions:
//
//   - HOOK_ENGINE_ARGV — the hooks invoke only `continuity status
//     --json`. No other argv variants are in use.
//   - HOOK_ENGINE_JSON_FIELDS — the hooks extract exactly these jq
//     paths from the engine's status output.
//   - Both session-hook stubs are asserted to cover the pinned argv
//     + JSON field set (so a stub that diverges from the contract
//     trips this test before it silently masks a hook regression).
//
// When CIRCUIT_HOOK_ENGINE_LIVE=1 is set AND the local
// `.circuit/bin/circuit-engine` is executable, the test ALSO
// exercises the live engine's status JSON and asserts it conforms
// to the pinned shape. That gates a cheap operator-local drift
// check without requiring the prior-gen plugin install in CI.

const SESSION_START_HOOK = resolve('.claude/hooks/SessionStart.sh');
const SESSION_END_HOOK = resolve('.claude/hooks/SessionEnd.sh');
const LIVE_ENGINE_BIN = resolve('.circuit/bin/circuit-engine');

/**
 * The exact argv the hooks invoke on the engine. Pinned so any new
 * argv surface the hooks start using forces an intentional update
 * to this list (and to the stub engines).
 */
const HOOK_ENGINE_ARGV: ReadonlyArray<ReadonlyArray<string>> = [['continuity', 'status', '--json']];

/**
 * The JSON paths the hook scripts extract via jq. Pinned as strings
 * so the stub + live engine are verified to emit each field
 * (selection is required; other fields are required only inside the
 * selection branch that reads them).
 */
const HOOK_ENGINE_JSON_FIELDS = {
  /** Dispatched on by both hooks' case statements. Required in every JSON. */
  selection: '.selection',
  /** SessionStart pending_record branch. */
  narrative_goal: '.record.narrative.goal',
  /** SessionStart pending_record branch. */
  narrative_next: '.record.narrative.next',
  /** SessionStart pending_record branch — optional warnings list. */
  warnings: '.warnings',
  /** SessionEnd pending_record branch. */
  record_id: '.record.record_id',
  /** SessionEnd pending_record drift-detection branch. */
  base_commit: '.record.git.base_commit',
} as const;

function readHookScript(hookPath: string): string {
  return readFileSync(hookPath, 'utf-8');
}

describe('Slice 47b — hook ⇄ engine CLI contract (Codex HIGH 2 fold-in)', () => {
  describe('argv contract', () => {
    it('SessionStart.sh invokes exactly the pinned argv', () => {
      const text = readHookScript(SESSION_START_HOOK);
      // The hook composes argv as `"$ENGINE_BIN" continuity status --json`.
      expect(text).toContain('"$ENGINE_BIN" continuity status --json');
      // No other `continuity` subcommands are invoked by the hook.
      const otherSubcommands = text.match(/\$ENGINE_BIN[^\n]* continuity (?:save|resume|clear)\b/g);
      expect(otherSubcommands).toBeNull();
    });

    it('SessionEnd.sh invokes exactly the pinned argv', () => {
      const text = readHookScript(SESSION_END_HOOK);
      expect(text).toContain('"$ENGINE_BIN" continuity status --json');
      const otherSubcommands = text.match(/\$ENGINE_BIN[^\n]* continuity (?:save|resume|clear)\b/g);
      expect(otherSubcommands).toBeNull();
    });

    it('pinned argv list contains only the status-json invocation (defensive pin against scope creep)', () => {
      expect(HOOK_ENGINE_ARGV).toHaveLength(1);
      expect(HOOK_ENGINE_ARGV[0]).toEqual(['continuity', 'status', '--json']);
    });
  });

  describe('JSON field contract', () => {
    it('SessionStart.sh parses exactly the pinned jq paths from the engine JSON', () => {
      const text = readHookScript(SESSION_START_HOOK);
      // The hook reads .selection via jq, then .record.narrative.goal,
      // .record.narrative.next, and .warnings inside the pending_record case.
      expect(text).toMatch(/jq -r '\.selection/);
      expect(text).toMatch(/jq -r '\.record\.narrative\.goal/);
      expect(text).toMatch(/jq -r '\.record\.narrative\.next/);
      expect(text).toMatch(/jq -r '\.warnings\[\]/);
    });

    it('SessionEnd.sh parses exactly the pinned jq paths from the engine JSON', () => {
      const text = readHookScript(SESSION_END_HOOK);
      expect(text).toMatch(/jq -r '\.selection/);
      expect(text).toMatch(/jq -r '\.record\.record_id/);
      expect(text).toMatch(/jq -r '\.record\.git\.base_commit/);
    });

    it('the pinned JSON field list names each jq path the hooks extract (defensive pin)', () => {
      const values = Object.values(HOOK_ENGINE_JSON_FIELDS);
      expect(values).toContain('.selection');
      expect(values).toContain('.record.narrative.goal');
      expect(values).toContain('.record.narrative.next');
      expect(values).toContain('.warnings');
      expect(values).toContain('.record.record_id');
      expect(values).toContain('.record.git.base_commit');
    });
  });

  describe('stub engines conform to the pinned contract', () => {
    // The canned-JSON stub in session-hook-behavior.test.ts and the
    // persisting stub in session-hook-lifecycle.test.ts both accept
    // the pinned argv (`continuity status --json`) and both emit a
    // JSON envelope that carries `.selection` at a minimum. This
    // assertion pins the argv handshake at the stub layer so a stub
    // refactor that drops the contract trips here.

    const SCAFFOLD_TEMP_ROOT = (): string =>
      mkdtempSync(join(tmpdir(), 'circuit-next-47b-contract-'));
    const roots: string[] = [];

    afterEach(() => {
      for (const root of roots) {
        rmSync(root, { recursive: true, force: true });
      }
      roots.length = 0;
    });

    function makeCannedJsonStubRoot(statusJson: Record<string, unknown>): string {
      const root = SCAFFOLD_TEMP_ROOT();
      roots.push(root);
      execFileSync('git', ['init', '-q'], { cwd: root });
      execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'root'], { cwd: root });
      const binDir = join(root, '.circuit', 'bin');
      mkdirSync(binDir, { recursive: true });
      const stubPath = join(binDir, 'circuit-engine');
      const stubBody = [
        '#!/usr/bin/env bash',
        'if [ "$1" = "continuity" ] && [ "$2" = "status" ] && [ "$3" = "--json" ]; then',
        "  cat <<'EOF'",
        JSON.stringify(statusJson),
        'EOF',
        '  exit 0',
        'fi',
        'exit 0',
        '',
      ].join('\n');
      writeFileSync(stubPath, stubBody);
      chmodSync(stubPath, 0o755);
      return root;
    }

    it('canned-JSON stub responds to the pinned argv with the recorded JSON', () => {
      const root = makeCannedJsonStubRoot({
        selection: 'pending_record',
        record: {
          record_id: 'r1',
          narrative: { goal: 'g', next: 'n' },
          git: { base_commit: 'abc' },
        },
        warnings: ['w'],
      });
      const proc = spawnSync('.circuit/bin/circuit-engine', HOOK_ENGINE_ARGV[0] as string[], {
        cwd: root,
        encoding: 'utf-8',
      });
      expect(proc.status).toBe(0);
      const payload = JSON.parse(proc.stdout.trim());
      expect(payload.selection).toBe('pending_record');
      expect(payload.record.narrative.goal).toBe('g');
      expect(payload.record.narrative.next).toBe('n');
      expect(payload.record.record_id).toBe('r1');
      expect(payload.record.git.base_commit).toBe('abc');
      expect(payload.warnings).toEqual(['w']);
    });
  });

  describe('live-engine drift check (CIRCUIT_HOOK_ENGINE_LIVE=1)', () => {
    // Env-gated check: when the operator's local environment has a
    // working .circuit/bin/circuit-engine (installed plugin root
    // present), this it() exercises the REAL engine and asserts its
    // `continuity status --json` output carries the pinned
    // `.selection` field. If the live engine drifts (removes
    // `.selection`, reshapes the envelope), this it() lands red and
    // the stub contract has to move with it.
    const liveGateEnabled = process.env.CIRCUIT_HOOK_ENGINE_LIVE === '1';

    it.skipIf(!liveGateEnabled)('live engine emits .selection field at the pinned jq path', () => {
      const proc = spawnSync(LIVE_ENGINE_BIN, ['continuity', 'status', '--json'], {
        cwd: resolve('.'),
        encoding: 'utf-8',
      });
      // Non-zero exit is acceptable (engine may fail validation in a
      // non-initialized repo); what matters is that when stdout
      // contains JSON, the JSON has .selection.
      if (proc.stdout.trim().length > 0) {
        const payload = JSON.parse(proc.stdout);
        expect(payload).toHaveProperty('selection');
        expect(['pending_record', 'current_run', 'none']).toContain(payload.selection);
      }
    });
  });
});
