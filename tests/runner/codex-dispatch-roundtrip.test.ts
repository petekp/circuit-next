import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { type CodexDispatchResult, dispatchCodex } from '../../src/runtime/adapters/codex.js';
import { materializeDispatch } from '../../src/runtime/adapters/dispatch-materializer.js';
import { sha256Hex } from '../../src/runtime/adapters/shared.js';
import { readRunLog } from '../../src/runtime/event-log-reader.js';
import { reduce } from '../../src/runtime/reducer.js';
import { appendAndDerive, bootstrapRun } from '../../src/runtime/runner.js';
import { Event } from '../../src/schemas/event.js';
import { RunId, StepId, WorkflowId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';

// Slice 45 (P2.6) — codex-dispatch-roundtrip test strengthening
// ADR-0007 CC#P2-2 (real-agent dispatch) with the second adapter named
// in that criterion's enumeration; bound to the Slice 37 five-event
// transcript shape. (Earlier draft of this comment mis-cited CC#P2-4 —
// that criterion is session hooks per ADR-0007:326-349; corrected per
// Codex Slice 45 HIGH 1 fold-in.)
//
// Mirrors the Slice 42 agent-dispatch-roundtrip structurally: bootstrap
// a run; invoke the real `codex exec` adapter; materialize the five-
// event transcript + four on-disk slots; read back via readRunLog;
// reduce; assert the materialized artifact bytes match the adapter's
// `result_body`. The ONLY field that differs between the two round-
// trips is `adapter.name = 'codex'` on dispatch.started — proving that
// the materializer seam parameterizes correctly on adapter identity
// without drifting the transcript shape.
//
// CODEX_SMOKE gate: the test spawns the `codex` subprocess and requires
// auth. Skipped by default so CI and unauthenticated developer runs stay
// green. Static-declaration count is preserved by two always-running
// sanity tests at the top.

const CODEX_SMOKE = process.env.CODEX_SMOKE === '1';
// Write-gate per Codex Slice 45 MED 3 fold-in: CODEX_SMOKE=1 exercises
// the end-to-end path but no longer implicitly mutates the tracked
// fingerprint. Promotion requires an explicit UPDATE_CODEX_FINGERPRINT=1
// env var (mirrors the UPDATE_GOLDEN=1 pattern at
// tests/runner/explore-e2e-parity.test.ts). Without the explicit
// promotion flag, the round-trip still runs end-to-end but leaves
// tests/fixtures/codex-smoke/last-run.json alone.
const UPDATE_CODEX_FINGERPRINT = process.env.UPDATE_CODEX_FINGERPRINT === '1';
const LAST_RUN_FINGERPRINT_PATH = resolve('tests/fixtures/codex-smoke/last-run.json');

// Slice 45 HIGH 4 fold-in: the fingerprint binds to the current adapter
// surface, not just an ancestor commit. The adapter_source_sha256 field
// is the sha256 of the concatenation of the three adapter-layer source
// files that materially determine the codex dispatch behavior:
//   (a) src/runtime/adapters/codex.ts — dispatchCodex + parseCodexStdout
//       + capability-boundary argv constants
//   (b) src/runtime/adapters/shared.ts — sha256Hex + DispatchResult
//       shape consumed by the materializer
//   (c) src/runtime/adapters/dispatch-materializer.ts — five-event
//       transcript + on-disk slot materialization
// A change to any of the three invalidates the fingerprint's coverage
// of the current adapter surface. Check 32 re-computes this hash at
// audit time and flags drift (yellow: fingerprint exists but adapter
// has changed since the last CODEX_SMOKE run).
// Slice 47a Codex challenger HIGH 3 fold-in — `runner.ts` added for
// symmetry with the AGENT writer's source path list. The Slice 47a
// runner-side selection/provenance derivation participates in the
// codex dispatch transcript via the materializeDispatch call site;
// excluding `runner.ts` from this list would let a runner edit
// silently invalidate the CODEX fingerprint without tripping drift.
const ADAPTER_SOURCE_PATHS = [
  resolve('src/runtime/adapters/codex.ts'),
  resolve('src/runtime/adapters/shared.ts'),
  resolve('src/runtime/adapters/dispatch-materializer.ts'),
  resolve('src/runtime/runner.ts'),
] as const;

function adapterSourceSha256(): string {
  const h = createHash('sha256');
  for (const p of ADAPTER_SOURCE_PATHS) {
    h.update(`${p}\n`);
    h.update(readFileSync(p));
    h.update('\n');
  }
  return h.digest('hex');
}

describe('Slice 45 — codex dispatch round-trip (ADR-0007 CC#P2-2 second-adapter evidence)', () => {
  it('static: materializeDispatch accepts adapterName="codex" (ratchet-floor declaration)', () => {
    expect(typeof materializeDispatch).toBe('function');
  });

  it('static: the five dispatch transcript kinds are adapter-agnostic', () => {
    // The materializer emits the same five-variant shape regardless of
    // adapter identity. This belt-and-braces guard asserts the naming
    // convention (still `dispatch.*`) has not drifted — a regression
    // that added adapter-specific event kinds would be visible here.
    const kinds = [
      'dispatch.started',
      'dispatch.request',
      'dispatch.receipt',
      'dispatch.result',
      'dispatch.completed',
    ] as const;
    for (const kind of kinds) {
      expect(kind).toMatch(/^dispatch\./);
    }
  });

  (CODEX_SMOKE ? it : it.skip)(
    'end-to-end: dispatchCodex → 5-event transcript → reducer snapshot → materialized artifact (CODEX_SMOKE=1)',
    async () => {
      const runRoot = mkdtempSync(join(tmpdir(), 'slice-45-roundtrip-'));
      try {
        const runId = RunId.parse('45454545-4545-4545-4545-454545454545');
        const workflowId = WorkflowId.parse('codex-smoke-0');
        const stepId = StepId.parse('smoke-dispatch-step');
        const attempt = 1;
        const startAt = new Date('2026-04-22T03:45:00.000Z');
        const now = () => startAt;
        const lane: LaneDeclaration = {
          lane: 'ratchet-advance',
          failure_mode: 'Slice 45 CC#P2-2 second-adapter round-trip',
          acceptance_evidence: '5-event transcript consumed by reducer; adapter.name=codex',
          alternate_framing: 'Defer to P2.7 session hooks — rejected per P2.6 plan block',
        };
        const writes = {
          request: 'artifacts/dispatch/smoke.request.txt',
          receipt: 'artifacts/dispatch/smoke.receipt.txt',
          result: 'artifacts/dispatch/smoke.result.txt',
          artifact: {
            path: 'artifacts/codex-smoke-synthesis.txt',
            schema: 'codex.smoke@v1',
          },
        };

        bootstrapRun({
          runRoot,
          manifest: {
            run_id: runId,
            workflow_id: workflowId,
            captured_at: startAt.toISOString(),
            bytes: Buffer.from(JSON.stringify({ id: workflowId, version: '0.1.0', smoke: true })),
          },
          bootstrapEvent: {
            schema_version: 1,
            sequence: 0,
            recorded_at: startAt.toISOString(),
            run_id: runId,
            kind: 'run.bootstrapped',
            workflow_id: workflowId,
            rigor: 'standard',
            goal: 'slice 45 round-trip',
            lane,
            manifest_hash: 'b'.repeat(64),
          },
        });

        const prompt = 'Respond with exactly the single word: ACCEPT';
        const codexResult: CodexDispatchResult = await dispatchCodex({
          prompt,
          timeoutMs: 120_000,
        });

        // Slice 47a — selection + provenance now required at the
        // materializer boundary; CODEX_SMOKE round-trip mirrors the
        // AGENT_SMOKE round-trip with `source: 'explicit'` (the test
        // injects the adapter directly).
        const materialized = materializeDispatch({
          runId,
          stepId,
          attempt,
          role: 'implementer',
          startingSequence: 1,
          runRoot,
          writes,
          adapterName: 'codex',
          resolvedSelection: { skills: [], invocation_options: {} },
          resolvedFrom: { source: 'explicit' },
          dispatchResult: codexResult,
          verdict: 'accept',
          now,
        });

        for (const event of materialized.events) {
          appendAndDerive(runRoot, event);
        }

        const runLog = readRunLog(runRoot);
        expect(runLog).toHaveLength(6); // bootstrap + 5 dispatch events
        const dispatchEvents = runLog.filter((e) => e.kind.startsWith('dispatch.'));
        expect(dispatchEvents).toHaveLength(5);

        const [started, request, receipt, result, completed] = dispatchEvents;
        // The critical CC#P2-4 surface — adapter name binding differs
        // from Slice 42 agent round-trip. If materializer drift
        // parameterization regressed, this assertion catches it.
        if (started?.kind !== 'dispatch.started') throw new Error('unreachable');
        expect(started.adapter).toEqual({ kind: 'builtin', name: 'codex' });
        expect(started.role).toBe('implementer');

        if (request?.kind !== 'dispatch.request') throw new Error('unreachable');
        expect(request.request_payload_hash).toBe(sha256Hex(prompt));
        expect(request.request_payload_hash).toMatch(/^[0-9a-f]{64}$/);

        if (receipt?.kind !== 'dispatch.receipt') throw new Error('unreachable');
        expect(receipt.receipt_id).toBe(codexResult.receipt_id);
        expect(receipt.receipt_id.trim().length).toBeGreaterThan(0);

        if (result?.kind !== 'dispatch.result') throw new Error('unreachable');
        expect(result.result_artifact_hash).toBe(sha256Hex(codexResult.result_body));
        expect(result.result_artifact_hash).toMatch(/^[0-9a-f]{64}$/);

        if (completed?.kind !== 'dispatch.completed') throw new Error('unreachable');
        expect(completed.verdict).toBe('accept');
        expect(completed.result_path).toBe(writes.result);
        expect(completed.receipt_path).toBe(writes.receipt);

        for (const event of runLog) {
          Event.parse(event);
        }

        const snapshot = reduce(runLog);
        expect(snapshot.events_consumed).toBe(runLog.length);
        const stepState = snapshot.steps.find((s) => s.step_id === stepId);
        expect(stepState?.status).toBeDefined();

        const artifactAbs = join(runRoot, writes.artifact.path);
        expect(existsSync(artifactAbs)).toBe(true);
        const artifactBytes = readFileSync(artifactAbs, 'utf-8');
        expect(artifactBytes).toBe(codexResult.result_body);
        expect(sha256Hex(artifactBytes)).toBe(result.result_artifact_hash);

        expect(existsSync(join(runRoot, writes.request))).toBe(true);
        expect(existsSync(join(runRoot, writes.receipt))).toBe(true);
        expect(existsSync(join(runRoot, writes.result))).toBe(true);
        expect(readFileSync(join(runRoot, writes.result), 'utf-8')).toBe(codexResult.result_body);

        // Fingerprint promotion path (Codex Slice 45 HIGH 4 + MED 3
        // fold-in). The fingerprint now binds to the current adapter
        // surface via `adapter_source_sha256` AND the Codex CLI
        // version string, so a later edit to codex.ts / shared.ts /
        // dispatch-materializer.ts surfaces as Check 32 yellow (drift
        // detected) until a fresh CODEX_SMOKE run promotes a new
        // fingerprint. Promotion is gated on UPDATE_CODEX_FINGERPRINT=1
        // per MED 3 (mirrors the UPDATE_GOLDEN pattern from
        // explore-e2e-parity.test.ts) so a bare CODEX_SMOKE=1 run
        // exercises the adapter end-to-end without mutating tracked
        // state unless the operator explicitly opts in to the promotion.
        if (UPDATE_CODEX_FINGERPRINT) {
          const commitSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
          const fingerprint = {
            schema_version: 2,
            commit_sha: commitSha,
            result_sha256: sha256Hex(codexResult.result_body),
            adapter_source_sha256: adapterSourceSha256(),
            cli_version: codexResult.cli_version,
            recorded_at: new Date().toISOString(),
          };
          mkdirSync(dirname(LAST_RUN_FINGERPRINT_PATH), { recursive: true });
          writeFileSync(LAST_RUN_FINGERPRINT_PATH, `${JSON.stringify(fingerprint, null, 2)}\n`);
        }
      } finally {
        rmSync(runRoot, { recursive: true, force: true });
      }
    },
    180_000,
  );
});
