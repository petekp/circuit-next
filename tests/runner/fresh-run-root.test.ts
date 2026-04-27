import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AgentDispatchInput } from '../../src/runtime/adapters/agent.js';
import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import { eventLogPath } from '../../src/runtime/event-writer.js';
import { manifestSnapshotPath } from '../../src/runtime/manifest-snapshot-writer.js';
import { resultPath } from '../../src/runtime/result-writer.js';
import {
  type DispatchFn,
  claimFreshRunRoot,
  releaseFreshRunRootClaim,
  runWorkflow,
} from '../../src/runtime/runner.js';
import { snapshotPath } from '../../src/runtime/snapshot-writer.js';
import { RunId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { Workflow } from '../../src/schemas/workflow.js';

const FIXTURE_PATH = resolve('.claude-plugin/skills/dogfood-run-0/circuit.json');

function loadFixture(): { workflow: Workflow; bytes: Buffer } {
  const bytes = readFileSync(FIXTURE_PATH);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  return { workflow: Workflow.parse(raw), bytes };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode: 'run-root reuse can corrupt prior run evidence',
    acceptance_evidence:
      'fresh run-root guard rejects reuse before events, manifest, state, or result bytes change',
    alternate_framing:
      'implement resume mode — rejected because this slice only adds a fresh-run guard',
  };
}

function stubDispatcher(): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async (input: AgentDispatchInput): Promise<DispatchResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-receipt-fresh-run-root',
      result_body: '{"verdict":"ok"}',
      duration_ms: 1,
      cli_version: '0.0.0-stub',
    }),
  };
}

async function closeFixtureRun(input: {
  runRoot: string;
  runId: string;
  goal: string;
  startMs: number;
}): Promise<void> {
  const { workflow, bytes } = loadFixture();
  await runWorkflow({
    runRoot: input.runRoot,
    workflow,
    workflowBytes: bytes,
    runId: RunId.parse(input.runId),
    goal: input.goal,
    rigor: 'standard',
    lane: lane(),
    now: deterministicNow(input.startMs),
    dispatcher: stubDispatcher(),
  });
}

function persistentRunBytes(runRoot: string): ReadonlyMap<string, string> {
  return new Map(
    [
      eventLogPath(runRoot),
      manifestSnapshotPath(runRoot),
      snapshotPath(runRoot),
      resultPath(runRoot),
    ].map((path) => [path, readFileSync(path, 'utf8')] as const),
  );
}

let runRootBase: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-fresh-root-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('runtime-safety-floor fresh run-root guard', () => {
  it('claims an empty run-root before the first persistent artifact is written', () => {
    const runRoot = join(runRootBase, 'claimed-before-first-write');
    const claim = claimFreshRunRoot(runRoot);
    try {
      expect(existsSync(eventLogPath(runRoot))).toBe(false);
      expect(existsSync(manifestSnapshotPath(runRoot))).toBe(false);
      expect(existsSync(snapshotPath(runRoot))).toBe(false);
      expect(existsSync(resultPath(runRoot))).toBe(false);

      expect(() => claimFreshRunRoot(runRoot)).toThrow(/run-root reuse.*checkpoint resume/i);

      expect(existsSync(eventLogPath(runRoot))).toBe(false);
      expect(existsSync(manifestSnapshotPath(runRoot))).toBe(false);
      expect(existsSync(snapshotPath(runRoot))).toBe(false);
      expect(existsSync(resultPath(runRoot))).toBe(false);
    } finally {
      releaseFreshRunRootClaim(claim);
    }
  });

  it('rejects run-root reuse before events, manifest, state, or result bytes change', async () => {
    const runRoot = join(runRootBase, 'reused-root');
    await closeFixtureRun({
      runRoot,
      runId: '69000000-0000-0000-0000-000000000201',
      goal: 'first run owns this root',
      startMs: Date.UTC(2026, 3, 24, 14, 0, 0),
    });
    const before = persistentRunBytes(runRoot);

    await expect(
      closeFixtureRun({
        runRoot,
        runId: '69000000-0000-0000-0000-000000000202',
        goal: 'second run must not mutate this root',
        startMs: Date.UTC(2026, 3, 24, 15, 0, 0),
      }),
    ).rejects.toThrow(/run-root reuse.*checkpoint resume/i);

    for (const [path, contents] of before) {
      expect(readFileSync(path, 'utf8')).toBe(contents);
    }
  });

  it('permits an existing empty run-root directory', async () => {
    const runRoot = join(runRootBase, 'precreated-empty-root');
    mkdirSync(runRoot, { recursive: true });

    await closeFixtureRun({
      runRoot,
      runId: '69000000-0000-0000-0000-000000000203',
      goal: 'precreated empty root is still a fresh run',
      startMs: Date.UTC(2026, 3, 24, 16, 0, 0),
    });

    expect(existsSync(eventLogPath(runRoot))).toBe(true);
    expect(existsSync(manifestSnapshotPath(runRoot))).toBe(true);
    expect(existsSync(snapshotPath(runRoot))).toBe(true);
    expect(existsSync(resultPath(runRoot))).toBe(true);
  });

  it('rejects an existing file or symlink run-root with the reuse/no-resume message', () => {
    const fileRoot = join(runRootBase, 'file-root');
    writeFileSync(fileRoot, 'not a directory');
    expect(() => claimFreshRunRoot(fileRoot)).toThrow(/run-root reuse.*checkpoint resume/i);
    expect(readFileSync(fileRoot, 'utf8')).toBe('not a directory');

    const symlinkTarget = join(runRootBase, 'symlink-target');
    const symlinkRoot = join(runRootBase, 'symlink-root');
    mkdirSync(symlinkTarget, { recursive: true });
    symlinkSync(symlinkTarget, symlinkRoot);
    expect(() => claimFreshRunRoot(symlinkRoot)).toThrow(/run-root reuse.*checkpoint resume/i);
    expect(existsSync(eventLogPath(symlinkTarget))).toBe(false);
  });

  it('rejects each canonical run artifact marker before writing new bytes', async () => {
    const cases = [
      ['events', eventLogPath],
      ['manifest', manifestSnapshotPath],
      ['state', snapshotPath],
      ['result', resultPath],
    ] as const;

    for (const [index, [label, pathFor]] of cases.entries()) {
      const runRoot = join(runRootBase, `marker-${label}`);
      const markerPath = pathFor(runRoot);
      mkdirSync(dirname(markerPath), { recursive: true });
      writeFileSync(markerPath, `sentinel-${label}`);

      await expect(
        closeFixtureRun({
          runRoot,
          runId: `69000000-0000-0000-0000-00000000030${index}`,
          goal: `marker ${label} must reject reuse`,
          startMs: Date.UTC(2026, 3, 24, 17, 0, 0),
        }),
      ).rejects.toThrow(/run-root reuse.*checkpoint resume/i);

      expect(readFileSync(markerPath, 'utf8')).toBe(`sentinel-${label}`);
    }
  });
});
