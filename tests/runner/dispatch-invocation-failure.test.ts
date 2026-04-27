import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AgentDispatchInput } from '../../src/runtime/adapters/agent.js';
import { readRunLog } from '../../src/runtime/event-log-reader.js';
import { type DispatchFn, runWorkflow } from '../../src/runtime/runner.js';
import { RunId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { RunResult } from '../../src/schemas/result.js';
import { RunProjection } from '../../src/schemas/run.js';
import { Snapshot } from '../../src/schemas/snapshot.js';
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
    failure_mode: 'adapter invocation failures escaped after step.entered and stranded runs',
    acceptance_evidence:
      'throwing dispatchers emit dispatch.failed, gate.evaluated outcome=fail, step.aborted, run.closed outcome=aborted, state.json status=aborted, and result.json outcome=aborted',
    alternate_framing:
      'represent adapter exceptions only as gate.evaluated failure — rejected because infrastructure failure should remain distinct from model verdict failure',
  };
}

function throwingDispatcher(): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async (_input: AgentDispatchInput) => {
      throw new Error('auth token missing');
    },
  };
}

let runRootBase: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-dispatch-failure-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('runtime-safety-floor adapter invocation failure closure', () => {
  it('closes a throwing dispatcher as an aborted run with durable invocation provenance', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'throwing-dispatcher');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('71000000-0000-0000-0000-000000000001'),
      goal: 'adapter failure must close durably',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 18, 0, 0)),
      dispatcher: throwingDispatcher(),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toMatch(/adapter invocation failed/i);
    expect(outcome.result.reason).toMatch(/auth token missing/);

    const started = outcome.events.find((e) => e.kind === 'dispatch.started');
    if (started?.kind !== 'dispatch.started') throw new Error('expected dispatch.started');
    expect(started.step_id).toBe('dispatch-step');
    expect(started.adapter).toEqual({ kind: 'builtin', name: 'agent' });
    expect(started.role).toBe('implementer');
    expect(started.resolved_from).toEqual({ source: 'explicit' });
    expect(started.resolved_selection).toEqual({ skills: [], invocation_options: {} });

    const dispatchStepKinds = outcome.events
      .filter((event) => 'step_id' in event && event.step_id === 'dispatch-step')
      .map((event) => event.kind);
    expect(dispatchStepKinds).toEqual([
      'step.entered',
      'dispatch.started',
      'dispatch.request',
      'dispatch.failed',
      'gate.evaluated',
      'step.aborted',
    ]);

    const request = outcome.events.find((e) => e.kind === 'dispatch.request');
    if (request?.kind !== 'dispatch.request') throw new Error('expected dispatch.request');
    expect(request.step_id).toBe('dispatch-step');
    expect(request.request_payload_hash).toMatch(/^[0-9a-f]{64}$/);

    const failed = outcome.events.find((e) => e.kind === 'dispatch.failed');
    if (failed?.kind !== 'dispatch.failed') throw new Error('expected dispatch.failed');
    expect(failed.step_id).toBe('dispatch-step');
    expect(failed.adapter).toEqual(started.adapter);
    expect(failed.role).toBe(started.role);
    expect(failed.resolved_from).toEqual(started.resolved_from);
    expect(failed.resolved_selection).toEqual(started.resolved_selection);
    expect(failed.request_payload_hash).toBe(request.request_payload_hash);

    const gate = outcome.events.find(
      (e) => e.kind === 'gate.evaluated' && e.step_id === 'dispatch-step',
    );
    if (gate?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated');
    expect(gate.outcome).toBe('fail');

    const aborted = outcome.events.find((e) => e.kind === 'step.aborted');
    if (aborted?.kind !== 'step.aborted') throw new Error('expected step.aborted');
    expect(aborted.step_id).toBe('dispatch-step');

    const closed = outcome.events.find((e) => e.kind === 'run.closed');
    if (closed?.kind !== 'run.closed') throw new Error('expected run.closed');
    expect(closed.outcome).toBe('aborted');

    expect(gate.reason).toBe(failed.reason);
    expect(aborted.reason).toBe(failed.reason);
    expect(closed.reason).toBe(failed.reason);
    expect(outcome.result.reason).toBe(failed.reason);

    expect(
      outcome.events.find((e) => e.kind === 'step.completed' && e.step_id === 'dispatch-step'),
    ).toBeUndefined();
    expect(outcome.events.find((e) => e.kind === 'dispatch.completed')).toBeUndefined();
    expect(outcome.events.find((e) => e.kind === 'dispatch.receipt')).toBeUndefined();
    expect(outcome.events.find((e) => e.kind === 'dispatch.result')).toBeUndefined();

    expect(existsSync(join(runRoot, 'artifacts', 'dispatch.request.json'))).toBe(true);
    expect(existsSync(join(runRoot, 'artifacts', 'dispatch.receipt.json'))).toBe(false);
    expect(existsSync(join(runRoot, 'artifacts', 'dispatch.result.json'))).toBe(false);

    const snapshot = Snapshot.parse(JSON.parse(readFileSync(join(runRoot, 'state.json'), 'utf8')));
    expect(snapshot.status).toBe('aborted');
    const log = readRunLog(runRoot);
    expect(RunProjection.safeParse({ log, snapshot }).success).toBe(true);

    const result = RunResult.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts', 'result.json'), 'utf8')),
    );
    expect(result.outcome).toBe('aborted');
    expect(result.reason).toBe(failed.reason);
  });
});
