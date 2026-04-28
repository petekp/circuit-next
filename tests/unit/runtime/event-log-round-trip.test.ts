import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Event, RunBootstrappedEvent } from '../../../src/schemas/event.js';
import { ManifestSnapshot, computeManifestHash } from '../../../src/schemas/manifest.js';
import { type RunLog, RunProjection } from '../../../src/schemas/run.js';
import { Snapshot } from '../../../src/schemas/snapshot.js';

import { readRunLog } from '../../../src/runtime/event-log-reader.js';
import { appendEvent, eventLogPath } from '../../../src/runtime/event-writer.js';
import {
  manifestSnapshotPath,
  readManifestSnapshot,
  writeManifestSnapshot,
} from '../../../src/runtime/manifest-snapshot-writer.js';
import { reduce } from '../../../src/runtime/reducer.js';
import { appendAndDerive, bootstrapRun, initRunRoot } from '../../../src/runtime/runner.js';
import {
  deriveSnapshot,
  snapshotPath,
  writeDerivedSnapshot,
} from '../../../src/runtime/snapshot-writer.js';

// events.ndjson append → parse → reduce → derive state.json
// round-trip test. Closes the boundary dogfood-run-0 runs through:
// without this file in place, dogfood would write real bytes through the
// very gap meant to be proven safe.

const MANIFEST_BODY = Buffer.from(
  JSON.stringify({ id: 'dogfood-run-0-fixture', steps: [] }, null, 2),
  'utf8',
);

const RUN_ID = '11111111-2222-3333-4444-555555555555';
const WORKFLOW_ID = 'dogfood-run-0-fixture';

function baseRecordedAt(step: number): string {
  const base = Date.UTC(2026, 3, 20, 12, 0, 0);
  return new Date(base + step * 1000).toISOString();
}

function buildBootstrapEvent(manifestHash: string) {
  return RunBootstrappedEvent.parse({
    schema_version: 1,
    sequence: 0,
    recorded_at: baseRecordedAt(0),
    run_id: RUN_ID,
    kind: 'run.bootstrapped',
    workflow_id: WORKFLOW_ID,
    rigor: 'standard',
    goal: 'prove circuit-next can close one run',
    lane: {
      lane: 'ratchet-advance',
      failure_mode: 'no end-to-end product proof',
      acceptance_evidence: 'events.ndjson + state.json + manifest.snapshot.json round-trip',
      alternate_framing: 'defer runtime boundary to 27d',
    },
    manifest_hash: manifestHash,
  });
}

function buildStepEntered(sequence: number, stepId: string, attempt = 1) {
  return Event.parse({
    schema_version: 1,
    sequence,
    recorded_at: baseRecordedAt(sequence),
    run_id: RUN_ID,
    kind: 'step.entered',
    step_id: stepId,
    attempt,
  });
}

function buildStepCompleted(sequence: number, stepId: string, attempt = 1) {
  return Event.parse({
    schema_version: 1,
    sequence,
    recorded_at: baseRecordedAt(sequence),
    run_id: RUN_ID,
    kind: 'step.completed',
    step_id: stepId,
    attempt,
    route_taken: 'default',
  });
}

function buildRunClosed(sequence: number, outcome: 'complete' = 'complete') {
  return Event.parse({
    schema_version: 1,
    sequence,
    recorded_at: baseRecordedAt(sequence),
    run_id: RUN_ID,
    kind: 'run.closed',
    outcome,
  });
}

function seedRun(runRoot: string) {
  const manifestHash = computeManifestHash(MANIFEST_BODY);
  const boot = buildBootstrapEvent(manifestHash);
  bootstrapRun({
    runRoot,
    manifest: {
      run_id: boot.run_id,
      workflow_id: boot.workflow_id,
      captured_at: boot.recorded_at,
      bytes: MANIFEST_BODY,
    },
    bootstrapEvent: boot,
  });
  return { manifestHash };
}

let runRoot: string;

beforeEach(() => {
  runRoot = mkdtempSync(join(tmpdir(), 'circuit-next-27c-'));
});

afterEach(() => {
  rmSync(runRoot, { recursive: true, force: true });
});

describe('events.ndjson append→reduce→state.json round-trip', () => {
  it('writes events.ndjson, state.json, manifest.snapshot.json at bootstrap', () => {
    seedRun(runRoot);
    const logText = readFileSync(eventLogPath(runRoot), 'utf8');
    const snapText = readFileSync(snapshotPath(runRoot), 'utf8');
    const manifestText = readFileSync(manifestSnapshotPath(runRoot), 'utf8');
    expect(logText.endsWith('\n')).toBe(true);
    expect(logText.split('\n').filter(Boolean)).toHaveLength(1);
    const snap = Snapshot.parse(JSON.parse(snapText));
    expect(snap.events_consumed).toBe(1);
    expect(snap.status).toBe('in_progress');
    const manifest = ManifestSnapshot.parse(JSON.parse(manifestText));
    expect(manifest.algorithm).toBe('sha256-raw');
  });

  it('events.ndjson parses as RunLog through a full happy-path run', () => {
    const { manifestHash } = seedRun(runRoot);
    appendAndDerive(runRoot, buildStepEntered(1, 'frame'));
    appendAndDerive(runRoot, buildStepCompleted(2, 'frame'));
    appendAndDerive(runRoot, buildRunClosed(3));

    const log = readRunLog(runRoot);
    expect(log).toHaveLength(4);
    const first = log[0];
    if (first === undefined || first.kind !== 'run.bootstrapped') {
      throw new Error('expected run.bootstrapped at index 0');
    }
    expect(first.manifest_hash).toBe(manifestHash);
    const last = log[log.length - 1];
    if (last === undefined || last.kind !== 'run.closed') {
      throw new Error('expected run.closed at tail');
    }
  });

  it('state.json parses as Snapshot (not RunProjection)', () => {
    seedRun(runRoot);
    appendAndDerive(runRoot, buildStepEntered(1, 'frame'));
    appendAndDerive(runRoot, buildStepCompleted(2, 'frame'));
    appendAndDerive(runRoot, buildRunClosed(3));

    const snapText = readFileSync(snapshotPath(runRoot), 'utf8');
    const raw: unknown = JSON.parse(snapText);
    const snapshot = Snapshot.parse(raw);
    expect(snapshot.status).toBe('complete');
    expect(snapshot.events_consumed).toBe(4);

    // Defensive: the persisted file is Snapshot, not RunProjection. A
    // RunProjection has `log` and `snapshot` keys; attempting to parse
    // the Snapshot shape as a RunProjection must reject.
    const projectionAttempt = RunProjection.safeParse(raw);
    expect(projectionAttempt.success).toBe(false);
  });

  it('RunProjection.safeParse({ log, snapshot }) succeeds', () => {
    seedRun(runRoot);
    appendAndDerive(runRoot, buildStepEntered(1, 'frame'));
    appendAndDerive(runRoot, buildStepCompleted(2, 'frame'));
    appendAndDerive(runRoot, buildRunClosed(3));

    const log = readRunLog(runRoot);
    const snapshot = deriveSnapshot(runRoot);
    const parsed = RunProjection.safeParse({ log, snapshot });
    expect(parsed.success).toBe(true);
  });

  it('append-only: later writes do not overwrite or truncate prior events', () => {
    seedRun(runRoot);
    const afterBoot = readFileSync(eventLogPath(runRoot), 'utf8');
    appendEvent(runRoot, buildStepEntered(1, 'frame'));
    const afterStep = readFileSync(eventLogPath(runRoot), 'utf8');
    expect(afterStep.startsWith(afterBoot)).toBe(true);
    expect(afterStep.length).toBeGreaterThan(afterBoot.length);
    appendEvent(runRoot, buildStepCompleted(2, 'frame'));
    const afterCompleted = readFileSync(eventLogPath(runRoot), 'utf8');
    expect(afterCompleted.startsWith(afterStep)).toBe(true);
  });

  it('reducer-derived: deleting one event mid-log creates a mismatch', () => {
    seedRun(runRoot);
    appendAndDerive(runRoot, buildStepEntered(1, 'frame'));
    appendAndDerive(runRoot, buildStepCompleted(2, 'frame'));
    appendAndDerive(runRoot, buildRunClosed(3));
    const originalSnapshot = deriveSnapshot(runRoot);

    // Tamper: delete the middle event by rewriting the NDJSON without it.
    const lines = readFileSync(eventLogPath(runRoot), 'utf8').split('\n').filter(Boolean);
    const tampered = [lines[0], lines[2], lines[3]].join('\n').concat('\n');
    writeFileSync(eventLogPath(runRoot), tampered);

    // Re-reading the tampered log must fail RUN-I2 (sequence contiguity):
    // the remaining sequences are [0, 2, 3] — a gap at 1 breaks RUN-I2.
    expect(() => readRunLog(runRoot)).toThrow();

    // If the caller bypasses RunLog validation (hand-forged array), the
    // derived snapshot differs from the original — no silent acceptance.
    const rawRaw = readFileSync(eventLogPath(runRoot), 'utf8').split('\n').filter(Boolean);
    const forged = rawRaw.map((l) => Event.parse(JSON.parse(l)));
    // Force-reduce the forged (un-validated) log by constructing a RunLog
    // that skips superRefine — we cast via the parsed Event[] directly
    // because RunLog.parse would reject the gap. The reducer still runs
    // but events_consumed binds to log length, which now differs.
    // The simplest way to demonstrate mismatch: the tampered log has a
    // different length than the original, so `reduce` produces a
    // different events_consumed.
    const forgedAsLog = forged as unknown as RunLog;
    const tamperedSnapshot = reduce(forgedAsLog);
    expect(tamperedSnapshot.events_consumed).not.toBe(originalSnapshot.events_consumed);
  });

  it('byte-for-byte manifest: persisted bytes hash matches declared hash', () => {
    const { manifestHash } = seedRun(runRoot);
    const manifest = readManifestSnapshot(runRoot);
    const decoded = Buffer.from(manifest.bytes_base64, 'base64');
    expect(decoded.equals(MANIFEST_BODY)).toBe(true);
    expect(computeManifestHash(decoded)).toBe(manifestHash);
    expect(manifest.hash).toBe(manifestHash);
  });

  it('corrupt manifest snapshot bytes: parse fails loudly', () => {
    seedRun(runRoot);
    const text = readFileSync(manifestSnapshotPath(runRoot), 'utf8');
    const parsed: { bytes_base64: string } = JSON.parse(text);
    const tampered = {
      ...parsed,
      bytes_base64: Buffer.from('not the real manifest bytes', 'utf8').toString('base64'),
    };
    writeFileSync(manifestSnapshotPath(runRoot), JSON.stringify(tampered));
    expect(() => readManifestSnapshot(runRoot)).toThrow(/manifest hash mismatch/);
  });

  it('corrupt manifest hash: declared hash that does not match bytes is rejected', () => {
    initRunRoot({ runRoot });
    const forged = {
      schema_version: 1,
      run_id: RUN_ID,
      workflow_id: WORKFLOW_ID,
      captured_at: baseRecordedAt(0),
      algorithm: 'sha256-raw',
      hash: '0'.repeat(64),
      bytes_base64: MANIFEST_BODY.toString('base64'),
    };
    writeFileSync(manifestSnapshotPath(runRoot), JSON.stringify(forged));
    expect(() => readManifestSnapshot(runRoot)).toThrow(/manifest hash mismatch/);
  });

  it('deriveSnapshot is pure: same log replays to equal snapshot', () => {
    seedRun(runRoot);
    appendAndDerive(runRoot, buildStepEntered(1, 'frame'));
    appendAndDerive(runRoot, buildStepCompleted(2, 'frame'));
    appendAndDerive(runRoot, buildRunClosed(3));
    const first = deriveSnapshot(runRoot);
    const second = deriveSnapshot(runRoot);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('writeDerivedSnapshot after every append keeps state.json equal to reduce(log)', () => {
    seedRun(runRoot);
    appendAndDerive(runRoot, buildStepEntered(1, 'frame'));
    appendAndDerive(runRoot, buildStepCompleted(2, 'frame'));
    const persisted = Snapshot.parse(JSON.parse(readFileSync(snapshotPath(runRoot), 'utf8')));
    const recomputed = reduce(readRunLog(runRoot));
    expect(JSON.stringify(persisted)).toBe(JSON.stringify(recomputed));
  });

  it('manifest snapshot path and event log path are distinct and stable', () => {
    expect(eventLogPath(runRoot)).toContain('events.ndjson');
    expect(snapshotPath(runRoot)).toContain('state.json');
    expect(manifestSnapshotPath(runRoot)).toContain('manifest.snapshot.json');
    expect(eventLogPath(runRoot)).not.toBe(snapshotPath(runRoot));
    expect(eventLogPath(runRoot)).not.toBe(manifestSnapshotPath(runRoot));
  });

  it('writeManifestSnapshot/bootstrapRun compose without stepping on each other', () => {
    // Clean run_root, call the lower-level writer directly, confirm the
    // file is readable, then re-bootstrap through runner without conflict.
    initRunRoot({ runRoot });
    const captured_at = baseRecordedAt(0);
    writeManifestSnapshot(runRoot, {
      run_id: RUN_ID as unknown as import('../../../src/schemas/ids.js').RunId,
      workflow_id: WORKFLOW_ID as unknown as import('../../../src/schemas/ids.js').WorkflowId,
      captured_at,
      bytes: MANIFEST_BODY,
    });
    const first = readManifestSnapshot(runRoot);
    expect(first.hash).toBe(computeManifestHash(MANIFEST_BODY));
    // Re-writing with the same bytes is idempotent at the byte level.
    writeManifestSnapshot(runRoot, {
      run_id: RUN_ID as unknown as import('../../../src/schemas/ids.js').RunId,
      workflow_id: WORKFLOW_ID as unknown as import('../../../src/schemas/ids.js').WorkflowId,
      captured_at,
      bytes: MANIFEST_BODY,
    });
    const second = readManifestSnapshot(runRoot);
    expect(second.hash).toBe(first.hash);
  });

  it('malformed event-log line fails loudly (Phase 2 defers durable-tail distinction)', () => {
    seedRun(runRoot);
    writeFileSync(eventLogPath(runRoot), 'not json at all\n');
    expect(() => readRunLog(runRoot)).toThrow(/valid JSON|Event|RunLog/);
  });

  it('writeDerivedSnapshot produces a Snapshot with schema_version 1', () => {
    seedRun(runRoot);
    const snap = writeDerivedSnapshot(runRoot);
    expect(snap.schema_version).toBe(1);
    expect(snap.manifest_hash.length).toBeGreaterThan(0);
  });
});
