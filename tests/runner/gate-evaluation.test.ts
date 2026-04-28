import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RunId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { Workflow } from '../../src/schemas/workflow.js';

import type { AgentDispatchInput } from '../../src/runtime/adapters/agent.js';
import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import { type DispatchFn, runWorkflow } from '../../src/runtime/runner.js';

// Dispatch verdict truth.
//
// The runner parses the adapter's `result_body` against the minimal
// `{ verdict: string }` shape and admits only verdicts that appear in
// `step.gate.pass`. Unparseable output, output without a string
// `verdict` field, and verdicts not in the pass set all fail the gate:
// a `gate.evaluated` with `outcome: 'fail'` and a human-readable
// `reason` is emitted, followed by `step.aborted` with the same reason,
// then `run.closed` with `outcome: 'aborted'`.
//
// Tests below exercise the four cases through `runWorkflow` end-to-end
// against the dogfood-run-0 fixture (`gate.pass = ["ok"]`) so the
// integration against the runWorkflow loop's flow control is part of
// the assertion surface, not just the in-isolation verdict parser.

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

function dispatcherWith(resultBody: string): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async (input: AgentDispatchInput): Promise<DispatchResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-receipt-gate-eval',
      result_body: resultBody,
      duration_ms: 1,
      cli_version: '0.0.0-stub',
    }),
  };
}

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode:
      'dispatch verdict was returned as step.gate.pass[0] unconditionally; gate.evaluated outcome was hardcoded to pass; dispatch steps advanced by construction regardless of model output',
    acceptance_evidence:
      'gate evaluation parses adapter result_body for a string verdict field and admits only verdicts in step.gate.pass; reject / unparseable / no-verdict cases fail the gate, abort the step, and close the run with outcome=aborted',
    alternate_framing:
      'add a gate.schema field to ResultVerdictGate so adapter output can be parsed against a typed schema instead of the minimal {verdict: string} shape — rejected because it expands contract surface beyond what is needed; deferred until a verdict-with-payload pattern emerges in the wild',
  };
}

let runRootBase: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-gate-eval-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('dispatch verdict truth', () => {
  it('PASS: adapter result_body parses with verdict in step.gate.pass → gate.evaluated outcome=pass; dispatch step advances; run closes complete', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'pass-case');
    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('53000000-0000-0000-0000-000000000001'),
      goal: 'pass-case: verdict matches gate.pass',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
      dispatcher: dispatcherWith('{"verdict":"ok"}'),
    });

    expect(outcome.result.outcome).toBe('complete');

    const resultVerdictGate = outcome.events.filter(
      (e) => e.kind === 'gate.evaluated' && e.gate_kind === 'result_verdict',
    );
    expect(resultVerdictGate).toHaveLength(1);
    const ge = resultVerdictGate[0];
    if (ge?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated event');
    expect(ge.outcome).toBe('pass');
    expect(ge.reason).toBeUndefined();

    const dispatchCompleted = outcome.events.find((e) => e.kind === 'dispatch.completed');
    if (dispatchCompleted?.kind !== 'dispatch.completed')
      throw new Error('expected dispatch.completed event');
    expect(dispatchCompleted.verdict).toBe('ok');

    expect(outcome.events.find((e) => e.kind === 'step.aborted')).toBeUndefined();
    const dispatchStepCompleted = outcome.events.find(
      (e) => e.kind === 'step.completed' && e.step_id === 'dispatch-step',
    );
    expect(dispatchStepCompleted).toBeDefined();
  });

  it('REJECT (verdict not in step.gate.pass): adapter declares "reject" but gate.pass=["ok"] → gate.evaluated outcome=fail with reason naming the verdict; step.aborted; step does NOT advance; run.closed outcome=aborted', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'reject-case');
    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('53000000-0000-0000-0000-000000000002'),
      goal: 'reject-case: verdict not in gate.pass',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
      dispatcher: dispatcherWith('{"verdict":"reject"}'),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toBeDefined();
    expect(outcome.result.reason).toMatch(/reject/);

    const resultVerdictGate = outcome.events.filter(
      (e) => e.kind === 'gate.evaluated' && e.gate_kind === 'result_verdict',
    );
    expect(resultVerdictGate).toHaveLength(1);
    const ge = resultVerdictGate[0];
    if (ge?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated event');
    expect(ge.outcome).toBe('fail');
    expect(ge.reason).toBeDefined();
    expect(ge.reason).toMatch(/reject/);

    const aborted = outcome.events.find((e) => e.kind === 'step.aborted');
    if (aborted?.kind !== 'step.aborted') throw new Error('expected step.aborted event');
    expect(aborted.step_id).toBe('dispatch-step');
    expect(aborted.reason).toMatch(/reject/);

    const dispatchStepCompleted = outcome.events.find(
      (e) => e.kind === 'step.completed' && e.step_id === 'dispatch-step',
    );
    expect(dispatchStepCompleted).toBeUndefined();

    const closed = outcome.events.find((e) => e.kind === 'run.closed');
    if (closed?.kind !== 'run.closed') throw new Error('expected run.closed event');
    expect(closed.outcome).toBe('aborted');
    expect(closed.reason).toBeDefined();

    // The reason is byte-identical across the three events that carry
    // it AND on the user-visible result.json. A future regression that
    // diverged the strings would silently degrade audit traceability.
    expect(ge.reason).toBe(aborted.reason);
    expect(closed.reason).toBe(aborted.reason);
    expect(outcome.result.reason).toBe(aborted.reason);

    // The dispatch.completed event carries the OBSERVED verdict
    // ("reject"), not the runtime sentinel — the adapter said
    // something parseable, so the durable transcript reflects it.
    const dispatchCompleted = outcome.events.find((e) => e.kind === 'dispatch.completed');
    if (dispatchCompleted?.kind !== 'dispatch.completed')
      throw new Error('expected dispatch.completed event');
    expect(dispatchCompleted.verdict).toBe('reject');

    // result.json on disk binds to the aborted run-closed event per RESULT-I2.
    const resultBody = readFileSync(join(runRoot, 'artifacts', 'result.json'), 'utf8');
    const resultParsed: { outcome: string; reason?: string } = JSON.parse(resultBody);
    expect(resultParsed.outcome).toBe('aborted');
    expect(resultParsed.reason).toBe(aborted.reason);
  });

  it('UNPARSEABLE: adapter result_body is not valid JSON → gate.evaluated outcome=fail with reason naming parse failure; dispatch.completed.verdict carries the runtime sentinel (no observed verdict); step.aborted; step does NOT advance; run.closed outcome=aborted; result.json carries the same reason', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'unparseable-case');
    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('53000000-0000-0000-0000-000000000003'),
      goal: 'unparseable-case: adapter output is not JSON',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
      dispatcher: dispatcherWith('not-json{'),
    });

    expect(outcome.result.outcome).toBe('aborted');

    const ge = outcome.events.find(
      (e) => e.kind === 'gate.evaluated' && e.gate_kind === 'result_verdict',
    );
    if (ge?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated event');
    expect(ge.outcome).toBe('fail');
    expect(ge.reason).toMatch(/parse/i);

    const aborted = outcome.events.find((e) => e.kind === 'step.aborted');
    if (aborted?.kind !== 'step.aborted') throw new Error('expected step.aborted event');
    expect(aborted.step_id).toBe('dispatch-step');

    const dispatchStepCompleted = outcome.events.find(
      (e) => e.kind === 'step.completed' && e.step_id === 'dispatch-step',
    );
    expect(dispatchStepCompleted).toBeUndefined();

    const closed = outcome.events.find((e) => e.kind === 'run.closed');
    if (closed?.kind !== 'run.closed') throw new Error('expected run.closed event');
    expect(closed.outcome).toBe('aborted');

    // No observed verdict, so dispatch.completed.verdict carries the
    // runtime '<no-verdict>' sentinel — disclosed in the explore
    // contract as runtime-injected, not adapter-declared.
    const dispatchCompleted = outcome.events.find((e) => e.kind === 'dispatch.completed');
    if (dispatchCompleted?.kind !== 'dispatch.completed')
      throw new Error('expected dispatch.completed event');
    expect(dispatchCompleted.verdict).toBe('<no-verdict>');

    expect(ge.reason).toBe(aborted.reason);
    expect(closed.reason).toBe(aborted.reason);
    expect(outcome.result.reason).toBe(aborted.reason);
  });

  it('VERDICT PARSED FROM BODY (not gate.pass[0]): when gate.pass has multiple entries and adapter declares a non-first member, dispatch.completed.verdict carries the parsed value; pre-refactor regression where dispatchVerdictForStep returned pass[0] would set dispatch.completed.verdict to the FIRST entry instead of the parsed one', async () => {
    // Mutate the dogfood fixture in-test to give the dispatch step a
    // multi-entry gate.pass so we can distinguish "parsed from body" from
    // "returned as pass[0]".
    const { bytes } = loadFixture();
    const raw = JSON.parse(bytes.toString('utf8'));
    const dispatchStep = raw.steps.find((s: { id: string }) => s.id === 'dispatch-step') as {
      gate: { pass: string[] };
    };
    dispatchStep.gate.pass = ['ok', 'ok-with-caveats'];
    const mutatedBytes = Buffer.from(JSON.stringify(raw));
    const workflow = Workflow.parse(raw);

    const runRoot = join(runRootBase, 'parsed-not-first');
    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: mutatedBytes,
      runId: RunId.parse('53000000-0000-0000-0000-000000000005'),
      goal: 'parsed-from-body: verdict is the second entry in gate.pass',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
      dispatcher: dispatcherWith('{"verdict":"ok-with-caveats"}'),
    });

    expect(outcome.result.outcome).toBe('complete');

    const dispatchCompleted = outcome.events.find((e) => e.kind === 'dispatch.completed');
    if (dispatchCompleted?.kind !== 'dispatch.completed')
      throw new Error('expected dispatch.completed event');
    // Earlier regression: dispatchVerdictForStep returned
    // step.gate.pass[0] → dispatch.completed.verdict would be "ok"
    // here. Now the verdict comes from the parsed body and is
    // "ok-with-caveats".
    expect(dispatchCompleted.verdict).toBe('ok-with-caveats');

    const ge = outcome.events.find(
      (e) => e.kind === 'gate.evaluated' && e.gate_kind === 'result_verdict',
    );
    if (ge?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated event');
    expect(ge.outcome).toBe('pass');
  });

  it('NO VERDICT FIELD: adapter result_body parses but lacks a string verdict field → gate.evaluated outcome=fail with reason naming the missing field; step.aborted; step does NOT advance; run.closed outcome=aborted', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'no-verdict-case');
    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('53000000-0000-0000-0000-000000000004'),
      goal: 'no-verdict-case: adapter output has no verdict field',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
      dispatcher: dispatcherWith('{"foo":"bar"}'),
    });

    expect(outcome.result.outcome).toBe('aborted');

    const ge = outcome.events.find(
      (e) => e.kind === 'gate.evaluated' && e.gate_kind === 'result_verdict',
    );
    if (ge?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated event');
    expect(ge.outcome).toBe('fail');
    expect(ge.reason).toMatch(/verdict/);

    const aborted = outcome.events.find((e) => e.kind === 'step.aborted');
    if (aborted?.kind !== 'step.aborted') throw new Error('expected step.aborted event');
    expect(aborted.step_id).toBe('dispatch-step');

    const dispatchStepCompleted = outcome.events.find(
      (e) => e.kind === 'step.completed' && e.step_id === 'dispatch-step',
    );
    expect(dispatchStepCompleted).toBeUndefined();

    const closed = outcome.events.find((e) => e.kind === 'run.closed');
    if (closed?.kind !== 'run.closed') throw new Error('expected run.closed event');
    expect(closed.outcome).toBe('aborted');

    const dispatchCompleted = outcome.events.find((e) => e.kind === 'dispatch.completed');
    if (dispatchCompleted?.kind !== 'dispatch.completed')
      throw new Error('expected dispatch.completed event');
    expect(dispatchCompleted.verdict).toBe('<no-verdict>');

    expect(ge.reason).toBe(aborted.reason);
    expect(closed.reason).toBe(aborted.reason);
    expect(outcome.result.reason).toBe(aborted.reason);
  });
});

// Exhaustive edge-case coverage on the gate evaluator. The
// implementation requires a top-level `verdict` field that is a
// non-empty string. These cases lock down the exact boundary so a
// future "be lenient" refactor can't silently widen admission. Each
// case asserts run.outcome=aborted (the gate failure path); the
// per-case reason regex names the surface the case exercises.
describe('dispatch verdict truth: edge-case parser coverage', () => {
  const cases: ReadonlyArray<{
    label: string;
    body: string;
    reasonPattern: RegExp;
  }> = [
    { label: 'empty-verdict-string', body: '{"verdict":""}', reasonPattern: /empty string/ },
    {
      label: 'whitespace-only-verdict',
      body: '{"verdict":" "}',
      reasonPattern: /not in gate.pass/,
    },
    { label: 'numeric-verdict', body: '{"verdict":123}', reasonPattern: /verdict/ },
    { label: 'boolean-verdict', body: '{"verdict":true}', reasonPattern: /verdict/ },
    { label: 'null-verdict', body: '{"verdict":null}', reasonPattern: /verdict/ },
    { label: 'object-verdict', body: '{"verdict":{"nested":"ok"}}', reasonPattern: /verdict/ },
    {
      label: 'nested-payload-no-toplevel-verdict',
      body: '{"payload":{"verdict":"ok"}}',
      reasonPattern: /verdict/,
    },
    { label: 'parsed-as-array', body: '[{"verdict":"ok"}]', reasonPattern: /not a JSON object/ },
    { label: 'parsed-as-null', body: 'null', reasonPattern: /not a JSON object/ },
    { label: 'parsed-as-string', body: '"ok"', reasonPattern: /not a JSON object/ },
    { label: 'parsed-as-number', body: '42', reasonPattern: /not a JSON object/ },
    {
      label: 'case-mismatch (gate.pass=["ok"], adapter says "OK")',
      body: '{"verdict":"OK"}',
      reasonPattern: /not in gate.pass/,
    },
  ];

  for (const c of cases) {
    it(`rejects: ${c.label}`, async () => {
      const { workflow, bytes } = loadFixture();
      const runRoot = join(runRootBase, `edge-${c.label.replace(/\W+/g, '-')}`);
      const outcome = await runWorkflow({
        runRoot,
        workflow,
        workflowBytes: bytes,
        runId: RunId.parse('53000000-0000-0000-0000-00000000ed01'),
        goal: `edge case: ${c.label}`,
        rigor: 'standard',
        lane: lane(),
        now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
        dispatcher: dispatcherWith(c.body),
      });
      expect(outcome.result.outcome).toBe('aborted');
      const ge = outcome.events.find(
        (e) => e.kind === 'gate.evaluated' && e.gate_kind === 'result_verdict',
      );
      if (ge?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated event');
      expect(ge.outcome).toBe('fail');
      expect(ge.reason).toMatch(c.reasonPattern);
    });
  }
});

// When a dispatch step declares `writes.artifact` and the gate FAILS,
// the canonical artifact at `writes.artifact.path` must NOT be written.
// Transcript slots (request / receipt / result) are still durable
// evidence of what was attempted and ARE written. This locks down the
// verdict-admissibility half of materialization; the materializer
// schema-parse test covers the symmetric schema-parse condition.
describe('gate fail does not materialize the canonical artifact', () => {
  it('explore-shaped fixture (writes.artifact declared) on gate fail: transcript files exist, artifact file does NOT', async () => {
    // Mutate the dogfood fixture to declare writes.artifact on the
    // dispatch step (dogfood-run-0 vanilla has no artifact slot).
    const { bytes } = loadFixture();
    const raw = JSON.parse(bytes.toString('utf8'));
    const dispatchStep = raw.steps.find((s: { id: string }) => s.id === 'dispatch-step') as {
      writes: { request: string; receipt: string; result: string; artifact?: unknown };
    };
    dispatchStep.writes.artifact = {
      path: 'artifacts/dispatch-canonical.json',
      schema: 'dogfood-canonical@v1',
    };
    const mutatedBytes = Buffer.from(JSON.stringify(raw));
    const workflow = Workflow.parse(raw);

    const runRoot = join(runRootBase, 'artifact-not-written-on-fail');
    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: mutatedBytes,
      runId: RunId.parse('53000000-0000-0000-0000-00000000a200'),
      goal: 'slice 53 HIGH 2: gate fail must not materialize canonical artifact',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
      dispatcher: dispatcherWith('{"verdict":"reject"}'),
    });

    expect(outcome.result.outcome).toBe('aborted');

    // Transcript files DO exist (durable evidence of the dispatch).
    expect(existsSync(join(runRoot, 'artifacts', 'dispatch.request.json'))).toBe(true);
    expect(existsSync(join(runRoot, 'artifacts', 'dispatch.receipt.json'))).toBe(true);
    expect(existsSync(join(runRoot, 'artifacts', 'dispatch.result.json'))).toBe(true);

    // Canonical artifact file does NOT exist (gate failed → not materialized).
    expect(existsSync(join(runRoot, 'artifacts', 'dispatch-canonical.json'))).toBe(false);
  });

  it('explore-shaped fixture on gate PASS: artifact IS materialized (sanity counterpart)', async () => {
    const { bytes } = loadFixture();
    const raw = JSON.parse(bytes.toString('utf8'));
    const dispatchStep = raw.steps.find((s: { id: string }) => s.id === 'dispatch-step') as {
      writes: { request: string; receipt: string; result: string; artifact?: unknown };
    };
    dispatchStep.writes.artifact = {
      path: 'artifacts/dispatch-canonical.json',
      schema: 'dogfood-canonical@v1',
    };
    const mutatedBytes = Buffer.from(JSON.stringify(raw));
    const workflow = Workflow.parse(raw);

    const runRoot = join(runRootBase, 'artifact-written-on-pass');
    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: mutatedBytes,
      runId: RunId.parse('53000000-0000-0000-0000-00000000a201'),
      goal: 'slice 53 HIGH 2 sanity: gate pass materializes canonical artifact',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
      dispatcher: dispatcherWith('{"verdict":"ok"}'),
    });

    expect(outcome.result.outcome).toBe('complete');
    expect(existsSync(join(runRoot, 'artifacts', 'dispatch-canonical.json'))).toBe(true);
  });
});
