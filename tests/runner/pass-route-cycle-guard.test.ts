import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AgentDispatchInput } from '../../src/runtime/adapters/agent.js';
import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import { readRunLog } from '../../src/runtime/event-log-reader.js';
import { type DispatchFn, runDogfood } from '../../src/runtime/runner.js';
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
    failure_mode: 'pass-route cycles could parse or bypass schema and keep a run in progress',
    acceptance_evidence:
      'pass-route cycle guard aborts with run.closed outcome=aborted, state.json status=aborted, result.json outcome=aborted, and no repeated step entry',
    alternate_framing:
      'schema-only rejection — rejected because runtime callers can still receive already-parsed or mutated workflow objects',
  };
}

function unusedDispatcher(): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async (_input: AgentDispatchInput): Promise<DispatchResult> => ({
      request_payload: 'unused',
      receipt_id: 'unused',
      result_body: '{"verdict":"ok"}',
      duration_ms: 1,
      cli_version: '0.0.0-unused',
    }),
  };
}

let runRootBase: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-pass-cycle-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('WF-I11 runtime-safety-floor pass-route cycle guard', () => {
  it('aborts cleanly instead of re-entering an already executed step when schema validation is bypassed', async () => {
    const { workflow } = loadFixture();
    const unsafeWorkflow = structuredClone(workflow);
    const firstStep = unsafeWorkflow.steps[0];
    if (firstStep === undefined) throw new Error('fixture must have a first step');
    firstStep.routes.pass = firstStep.id;
    const unsafeWorkflowBytes = Buffer.from(JSON.stringify(unsafeWorkflow));

    const runRoot = join(runRootBase, 'schema-bypass-cycle');
    const outcome = await runDogfood({
      runRoot,
      workflow: unsafeWorkflow,
      workflowBytes: unsafeWorkflowBytes,
      runId: RunId.parse('72000000-0000-0000-0000-000000000001'),
      goal: 'runtime must abort a pass-route cycle',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 19, 0, 0)),
      dispatcher: unusedDispatcher(),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toContain('pass-route cycle detected');
    expect(outcome.result.reason).toContain(firstStep.id);

    const stepKinds = outcome.events
      .filter((event) => 'step_id' in event && event.step_id === firstStep.id)
      .map((event) => event.kind);
    expect(stepKinds).toEqual([
      'step.entered',
      'step.artifact_written',
      'gate.evaluated',
      'step.aborted',
    ]);
    expect(
      outcome.events.find(
        (event) => event.kind === 'step.completed' && event.step_id === firstStep.id,
      ),
    ).toBeUndefined();
    expect(outcome.events.find((event) => event.kind === 'dispatch.started')).toBeUndefined();

    const aborted = outcome.events.find(
      (event) => event.kind === 'step.aborted' && event.step_id === firstStep.id,
    );
    if (aborted?.kind !== 'step.aborted') throw new Error('expected step.aborted');

    const closed = outcome.events[outcome.events.length - 1];
    if (closed?.kind !== 'run.closed') throw new Error('expected run.closed last');
    expect(closed.outcome).toBe('aborted');
    expect(closed.reason).toBe(aborted.reason);
    expect(outcome.result.reason).toBe(aborted.reason);

    expect(existsSync(join(runRoot, 'events.ndjson'))).toBe(true);
    expect(existsSync(join(runRoot, 'state.json'))).toBe(true);
    expect(existsSync(join(runRoot, 'artifacts', 'result.json'))).toBe(true);

    const snapshot = Snapshot.parse(JSON.parse(readFileSync(join(runRoot, 'state.json'), 'utf8')));
    expect(snapshot.status).toBe('aborted');
    const projectedStep = snapshot.steps.find((step) => step.step_id === firstStep.id);
    expect(projectedStep?.status).toBe('aborted');
    expect(projectedStep?.last_route_taken).toBeUndefined();
    const log = readRunLog(runRoot);
    expect(log).toHaveLength(outcome.events.length);
    expect(RunProjection.safeParse({ log, snapshot }).success).toBe(true);

    const result = RunResult.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts', 'result.json'), 'utf8')),
    );
    expect(result.outcome).toBe('aborted');
    expect(result.reason).toBe(outcome.result.reason);
    expect(result.events_observed).toBe(log.length);
  });
});
