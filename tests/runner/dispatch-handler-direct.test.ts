// Direct unit tests for the dispatch step handler.
//
// The runner suites exercise dispatch transitively through full
// runWorkflow runs, but the handler's own surface — gate evaluation,
// failure-reason composition, the event sequence on each error path —
// is not directly tested. This file invokes `runDispatchStep` against
// a minimal in-memory `StepHandlerContext` so each handler-local
// branch is exercised in isolation.
//
// FU-T11 priority target #1 (per HANDOFF.md). Sister tests will cover
// `checkpoint.ts`, `verification.ts`, `sub-run.ts`, and `fanout.ts`.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AgentDispatchInput } from '../../src/runtime/adapters/agent.js';
import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import { runDispatchStep } from '../../src/runtime/step-handlers/dispatch.js';
import type { RunState, StepHandlerContext } from '../../src/runtime/step-handlers/types.js';
import type { Event } from '../../src/schemas/event.js';
import { RunId, type WorkflowId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { Workflow } from '../../src/schemas/workflow.js';

const WORKFLOW_ID = 'dispatch-direct-test' as unknown as WorkflowId;
const RUN_ID = RunId.parse('44444444-4444-4444-4444-444444444444');

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode: 'dispatch handler emits the wrong event sequence on a known failure path',
    acceptance_evidence:
      'each error path emits the expected dispatch.* + gate.evaluated + step.aborted triple with the right reason',
    alternate_framing: 'unit test of the dispatch step handler in isolation',
  };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function buildWorkflow(passVerdicts: readonly string[]): Workflow {
  return Workflow.parse({
    schema_version: '2',
    id: WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose: 'dispatch handler direct-test fixture.',
    entry: { signals: { include: ['x'], exclude: [] }, intent_prefixes: ['x'] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'dispatch-step',
        rigor: 'standard',
        description: 'dispatch fixture',
      },
    ],
    phases: [{ id: 'act-phase', title: 'Act', canonical: 'act', steps: ['dispatch-step'] }],
    spine_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'narrow direct dispatch handler test fixture',
    },
    steps: [
      {
        id: 'dispatch-step',
        title: 'Dispatch — direct handler test',
        protocol: 'dispatch-direct@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'worker',
        kind: 'dispatch',
        role: 'implementer',
        writes: {
          request: 'artifacts/dispatch.request.json',
          receipt: 'artifacts/dispatch.receipt.json',
          result: 'artifacts/dispatch.result.json',
        },
        gate: {
          kind: 'result_verdict',
          source: { kind: 'dispatch_result', ref: 'result' },
          pass: passVerdicts,
        },
      },
    ],
  });
}

interface DispatcherSpec {
  readonly resultBody?: string;
  readonly throwError?: Error;
}

function makeDispatcher(spec: DispatcherSpec) {
  return {
    adapterName: 'agent' as const,
    dispatch: async (_input: AgentDispatchInput): Promise<DispatchResult> => {
      if (spec.throwError !== undefined) throw spec.throwError;
      return {
        request_payload: 'unused-by-test',
        receipt_id: 'stub-receipt-direct',
        result_body: spec.resultBody ?? '',
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

interface Harness {
  readonly events: Event[];
  readonly state: RunState;
  readonly ctx: StepHandlerContext;
}

function buildHarness(opts: { readonly passVerdicts: readonly string[] } & DispatcherSpec): {
  workflow: Workflow;
  harness: Harness;
} {
  const workflow = buildWorkflow(opts.passVerdicts);
  const step = workflow.steps[0];
  if (step === undefined || step.kind !== 'dispatch') {
    throw new Error('test fixture invariant: step[0] must be a dispatch step');
  }
  const events: Event[] = [];
  const state: RunState = { events, sequence: 0, dispatchResults: [] };
  const now = deterministicNow(Date.UTC(2026, 3, 27, 0, 0, 0));
  const recordedAt = (): string => now().toISOString();
  const ctx: StepHandlerContext = {
    runRoot,
    workflow,
    runId: RUN_ID,
    goal: 'direct dispatch handler test goal',
    lane: lane(),
    rigor: 'standard',
    executionSelectionConfigLayers: [],
    dispatcher: makeDispatcher(opts),
    synthesisWriter: () => {
      throw new Error('synthesisWriter should not be invoked by a dispatch step');
    },
    now,
    recordedAt,
    state,
    push: (ev: Event) => {
      const stamped = { ...ev, sequence: state.sequence };
      events.push(stamped);
      state.sequence += 1;
    },
    step,
    attempt: 1,
    isResumedCheckpoint: false,
    childRunner: async () => {
      throw new Error('childRunner should not be invoked by a dispatch step');
    },
  };
  return { workflow, harness: { events, state, ctx } };
}

let runRoot: string;

beforeEach(() => {
  runRoot = mkdtempSync(join(tmpdir(), 'dispatch-handler-direct-'));
});

afterEach(() => {
  rmSync(runRoot, { recursive: true, force: true });
});

describe('runDispatchStep direct — gate evaluation', () => {
  it('returns advance and emits gate.evaluated/pass when verdict is in gate.pass', async () => {
    const { harness } = buildHarness({
      passVerdicts: ['accept'],
      resultBody: JSON.stringify({ verdict: 'accept' }),
    });

    const result = await runDispatchStep(
      harness.ctx as StepHandlerContext & {
        step: Workflow['steps'][number] & { kind: 'dispatch' };
      },
    );

    expect(result).toEqual({ kind: 'advance' });
    const gate = harness.events.find((e) => e.kind === 'gate.evaluated');
    if (gate?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated');
    expect(gate.outcome).toBe('pass');
    // dispatch.completed carries the admitted verdict.
    const completed = harness.events.find((e) => e.kind === 'dispatch.completed');
    if (completed?.kind !== 'dispatch.completed') throw new Error('expected dispatch.completed');
    expect(completed.verdict).toBe('accept');
    // No abort event.
    expect(harness.events.find((e) => e.kind === 'step.aborted')).toBeUndefined();
  });

  it('aborts with parse-failure reason when result_body is not valid JSON', async () => {
    const { harness } = buildHarness({
      passVerdicts: ['accept'],
      resultBody: 'not-json{{{',
    });

    const result = await runDispatchStep(
      harness.ctx as StepHandlerContext & {
        step: Workflow['steps'][number] & { kind: 'dispatch' };
      },
    );

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/did not parse as JSON/);
    const gate = harness.events.find((e) => e.kind === 'gate.evaluated');
    if (gate?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated');
    expect(gate.outcome).toBe('fail');
    expect(harness.events.some((e) => e.kind === 'step.aborted')).toBe(true);
    // dispatch.completed.verdict carries the no-verdict sentinel
    // because no verdict could be parsed.
    const completed = harness.events.find((e) => e.kind === 'dispatch.completed');
    if (completed?.kind !== 'dispatch.completed') throw new Error('expected dispatch.completed');
    expect(completed.verdict).toBe('<no-verdict>');
  });

  it('aborts with shape-failure reason when result_body parses to an array', async () => {
    const { harness } = buildHarness({
      passVerdicts: ['accept'],
      resultBody: JSON.stringify(['accept']),
    });

    const result = await runDispatchStep(
      harness.ctx as StepHandlerContext & {
        step: Workflow['steps'][number] & { kind: 'dispatch' };
      },
    );

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/parsed but is not a JSON object/);
    expect(result.reason).toMatch(/got array/);
  });

  it('aborts with shape-failure reason when result_body parses to null', async () => {
    const { harness } = buildHarness({
      passVerdicts: ['accept'],
      resultBody: 'null',
    });

    const result = await runDispatchStep(
      harness.ctx as StepHandlerContext & {
        step: Workflow['steps'][number] & { kind: 'dispatch' };
      },
    );

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/parsed but is not a JSON object/);
    expect(result.reason).toMatch(/got null/);
  });

  it('aborts when result_body lacks a verdict field', async () => {
    const { harness } = buildHarness({
      passVerdicts: ['accept'],
      resultBody: JSON.stringify({ note: 'no verdict here' }),
    });

    const result = await runDispatchStep(
      harness.ctx as StepHandlerContext & {
        step: Workflow['steps'][number] & { kind: 'dispatch' };
      },
    );

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/lacks a non-empty string 'verdict' field/);
  });

  it('aborts when verdict is the empty string', async () => {
    const { harness } = buildHarness({
      passVerdicts: ['accept'],
      resultBody: JSON.stringify({ verdict: '' }),
    });

    const result = await runDispatchStep(
      harness.ctx as StepHandlerContext & {
        step: Workflow['steps'][number] & { kind: 'dispatch' };
      },
    );

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/lacks a non-empty string 'verdict' field/);
  });

  it('aborts when verdict is not in gate.pass and dispatch.completed carries the observed verdict', async () => {
    const { harness } = buildHarness({
      passVerdicts: ['accept'],
      resultBody: JSON.stringify({ verdict: 'reject' }),
    });

    const result = await runDispatchStep(
      harness.ctx as StepHandlerContext & {
        step: Workflow['steps'][number] & { kind: 'dispatch' };
      },
    );

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(
      /declared verdict 'reject' which is not in gate\.pass \[accept\]/,
    );
    // dispatch.completed.verdict carries the observed (rejected) verdict
    // — the durable transcript reflects what the adapter said.
    const completed = harness.events.find((e) => e.kind === 'dispatch.completed');
    if (completed?.kind !== 'dispatch.completed') throw new Error('expected dispatch.completed');
    expect(completed.verdict).toBe('reject');
  });
});

describe('runDispatchStep direct — adapter failure', () => {
  it('emits dispatch.failed when the dispatcher throws and returns aborted', async () => {
    const { harness } = buildHarness({
      passVerdicts: ['accept'],
      throwError: new Error('upstream adapter exploded'),
    });

    const result = await runDispatchStep(
      harness.ctx as StepHandlerContext & {
        step: Workflow['steps'][number] & { kind: 'dispatch' };
      },
    );

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/adapter invocation failed.*upstream adapter exploded/);
    const failed = harness.events.find((e) => e.kind === 'dispatch.failed');
    if (failed?.kind !== 'dispatch.failed') throw new Error('expected dispatch.failed');
    expect(failed.reason).toMatch(/upstream adapter exploded/);
    // dispatch.completed should NOT fire on adapter throw — only dispatch.failed.
    expect(harness.events.find((e) => e.kind === 'dispatch.completed')).toBeUndefined();
    // gate.evaluated/fail + step.aborted both fire.
    const gate = harness.events.find((e) => e.kind === 'gate.evaluated');
    if (gate?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated');
    expect(gate.outcome).toBe('fail');
    expect(harness.events.some((e) => e.kind === 'step.aborted')).toBe(true);
  });
});

describe('runDispatchStep direct — event sequence invariants', () => {
  it('on success: started → request → completed → result_admitted? → gate.evaluated/pass (no aborted)', async () => {
    const { harness } = buildHarness({
      passVerdicts: ['accept'],
      resultBody: JSON.stringify({ verdict: 'accept' }),
    });

    await runDispatchStep(
      harness.ctx as StepHandlerContext & {
        step: Workflow['steps'][number] & { kind: 'dispatch' };
      },
    );

    const kinds = harness.events.map((e) => e.kind);
    // Anchor: the first three events MUST be dispatch.started, dispatch.request, ...
    expect(kinds[0]).toBe('dispatch.started');
    expect(kinds[1]).toBe('dispatch.request');
    // Final event MUST be gate.evaluated (pass) — no step.aborted.
    expect(kinds[kinds.length - 1]).toBe('gate.evaluated');
    expect(kinds).not.toContain('step.aborted');
    expect(kinds).toContain('dispatch.completed');
  });

  it('on adapter throw: started → request → failed → gate.evaluated/fail → step.aborted (no completed)', async () => {
    const { harness } = buildHarness({
      passVerdicts: ['accept'],
      throwError: new Error('boom'),
    });

    await runDispatchStep(
      harness.ctx as StepHandlerContext & {
        step: Workflow['steps'][number] & { kind: 'dispatch' };
      },
    );

    const kinds = harness.events.map((e) => e.kind);
    expect(kinds).toEqual([
      'dispatch.started',
      'dispatch.request',
      'dispatch.failed',
      'gate.evaluated',
      'step.aborted',
    ]);
  });

  it('on gate fail: started → request → completed → gate.evaluated/fail → step.aborted', async () => {
    const { harness } = buildHarness({
      passVerdicts: ['accept'],
      resultBody: JSON.stringify({ verdict: 'reject' }),
    });

    await runDispatchStep(
      harness.ctx as StepHandlerContext & {
        step: Workflow['steps'][number] & { kind: 'dispatch' };
      },
    );

    const kinds = harness.events.map((e) => e.kind);
    // First and last anchors.
    expect(kinds[0]).toBe('dispatch.started');
    expect(kinds[kinds.length - 1]).toBe('step.aborted');
    // dispatch.completed must fire (the dispatch happened) — even on gate fail.
    expect(kinds).toContain('dispatch.completed');
  });
});
