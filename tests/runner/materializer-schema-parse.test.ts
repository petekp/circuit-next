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

// Materializer schema-parse.
//
// The contract requires schema-parsing the result payload against
// `writes.artifact.schema` BEFORE the canonical artifact is
// materialized.
//
// Closure shape:
//   - Verdict-admissibility half: gate-fail leaves
//     `writes.artifact.path` absent on disk.
//   - Artifact-shape half: schema-parse-fail ALSO leaves
//     `writes.artifact.path` absent.
//   - Failure-path event surface is uniform across both: parse
//     failure emits `gate.evaluated outcome=fail` + reason, then
//     `step.aborted` with the same reason, then `run.closed` with
//     `outcome=aborted`. This content/schema-failure path does not
//     emit `dispatch.failed`; that event is reserved for adapter
//     invocation exceptions, where no adapter result exists.
//   - Fail-closed default: unknown schema names produce a parse
//     failure reason naming the unknown schema; the step is aborted.
//
// The dogfood-run-0 fixture's dispatch step does NOT declare
// `writes.artifact` (explore-shaped fixtures do; dogfood-run-0 is a
// partial-spine scaffold). Tests below mutate the fixture in-memory to
// add `writes.artifact`. Cases exercise through the full `runWorkflow`
// loop so the integration with the gate-evaluation path is part of the
// assertion surface.

const FIXTURE_PATH = resolve('.claude-plugin/skills/dogfood-run-0/circuit.json');

function loadMutatedFixture(
  mutator: (raw: {
    steps: Array<{
      id: string;
      writes: { artifact?: { path: string; schema: string } };
    }>;
  }) => void,
): { workflow: Workflow; bytes: Buffer } {
  const bytes = readFileSync(FIXTURE_PATH);
  const raw: {
    steps: Array<{
      id: string;
      writes: { artifact?: { path: string; schema: string } };
    }>;
  } = JSON.parse(bytes.toString('utf8'));
  mutator(raw);
  const mutated = Buffer.from(JSON.stringify(raw));
  return { workflow: Workflow.parse(raw), bytes: mutated };
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
      receipt_id: 'stub-receipt-materializer-schema-parse',
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
      'materializer wrote the canonical artifact as raw result_body bytes without schema parse; the contract requires schema-parsing result_body against writes.artifact.schema before materialization',
    acceptance_evidence:
      'artifact write requires both the verdict gate pass AND a schema-parse pass against writes.artifact.schema; unknown schemas fail-closed by default; failure emits gate.evaluated outcome=fail + step.aborted + run.closed outcome=aborted with the reason byte-identical across the three events and on the user-visible result.json',
    alternate_framing:
      'land schema parsing inside materializeDispatch instead of at the runner layer — rejected because the runner already owns gate-evaluation; keeping both checks at the same layer keeps the failure-path event surface uniform without duplicating schema logic across layers',
  };
}

function addCanonicalArtifact(
  raw: {
    steps: Array<{
      id: string;
      writes: { artifact?: { path: string; schema: string } };
    }>;
  },
  schema: string,
  path = 'artifacts/dispatch-canonical.json',
): void {
  const step = raw.steps.find((s) => s.id === 'dispatch-step');
  if (step === undefined) throw new Error('dispatch-step not found in fixture');
  step.writes.artifact = { path, schema };
}

let runRootBase: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-materializer-schema-parse-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('materializer schema-parse', () => {
  it('(a) valid payload round-trip: gate passes + schema passes → canonical artifact written byte-equal to result_body; outcome=complete; dispatch.completed.verdict carries parsed verdict', async () => {
    const { workflow, bytes } = loadMutatedFixture((raw) => {
      addCanonicalArtifact(raw, 'dogfood-strict@v1');
    });
    const runRoot = join(runRootBase, 'a-valid');
    const resultBody = '{"verdict":"ok","rationale":"schema accepts this"}';
    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('54000000-0000-0000-0000-000000000001'),
      goal: 'case (a): valid schema-passing payload',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
      dispatcher: dispatcherWith(resultBody),
    });

    expect(outcome.result.outcome).toBe('complete');

    const artifactAbs = join(runRoot, 'artifacts', 'dispatch-canonical.json');
    expect(existsSync(artifactAbs)).toBe(true);
    const artifactBody = readFileSync(artifactAbs, 'utf8');
    expect(artifactBody).toBe(resultBody);

    const gateEvaluated = outcome.events.filter(
      (e) => e.kind === 'gate.evaluated' && e.gate_kind === 'result_verdict',
    );
    expect(gateEvaluated).toHaveLength(1);
    const ge = gateEvaluated[0];
    if (ge?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated');
    expect(ge.outcome).toBe('pass');
    expect(ge.reason).toBeUndefined();

    const dispatchCompleted = outcome.events.find((e) => e.kind === 'dispatch.completed');
    if (dispatchCompleted?.kind !== 'dispatch.completed') {
      throw new Error('expected dispatch.completed');
    }
    expect(dispatchCompleted.verdict).toBe('ok');

    expect(outcome.events.find((e) => e.kind === 'step.aborted')).toBeUndefined();
  });

  it('(b) invalid payload: gate passes but schema rejects → canonical artifact NOT written; outcome=aborted; gate.evaluated outcome=fail names the schema parse error; reason byte-identical across gate.evaluated / step.aborted / run.closed / result.json', async () => {
    const { workflow, bytes } = loadMutatedFixture((raw) => {
      addCanonicalArtifact(raw, 'dogfood-strict@v1');
    });
    const runRoot = join(runRootBase, 'b-invalid');
    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('54000000-0000-0000-0000-000000000002'),
      goal: 'case (b): gate pass, schema fail (missing required field)',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
      // Passes gate.pass=["ok"] verdict check but fails dogfood-strict@v1
      // which requires a `rationale` field.
      dispatcher: dispatcherWith('{"verdict":"ok"}'),
    });

    expect(outcome.result.outcome).toBe('aborted');

    const artifactAbs = join(runRoot, 'artifacts', 'dispatch-canonical.json');
    expect(existsSync(artifactAbs)).toBe(false);

    // Transcript slots DO exist — durable evidence the dispatch happened.
    expect(existsSync(join(runRoot, 'artifacts', 'dispatch.request.json'))).toBe(true);
    expect(existsSync(join(runRoot, 'artifacts', 'dispatch.receipt.json'))).toBe(true);
    expect(existsSync(join(runRoot, 'artifacts', 'dispatch.result.json'))).toBe(true);

    const ge = outcome.events.find(
      (e) => e.kind === 'gate.evaluated' && e.gate_kind === 'result_verdict',
    );
    if (ge?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated');
    expect(ge.outcome).toBe('fail');
    expect(ge.reason).toBeDefined();
    // Reason names the schema parse failure, not a verdict rejection.
    expect(ge.reason).toMatch(/schema/i);
    expect(ge.reason).toMatch(/rationale/);
    expect(ge.reason).toMatch(/dogfood-strict@v1/);

    const aborted = outcome.events.find((e) => e.kind === 'step.aborted');
    if (aborted?.kind !== 'step.aborted') throw new Error('expected step.aborted');
    expect(aborted.step_id).toBe('dispatch-step');

    const dispatchStepCompleted = outcome.events.find(
      (e) => e.kind === 'step.completed' && e.step_id === 'dispatch-step',
    );
    expect(dispatchStepCompleted).toBeUndefined();

    const closed = outcome.events.find((e) => e.kind === 'run.closed');
    if (closed?.kind !== 'run.closed') throw new Error('expected run.closed');
    expect(closed.outcome).toBe('aborted');

    // Reason byte-identity across the four event-surface slots. Same
    // invariant the verdict-rejection path locks down; this extends it
    // to the schema-parse failure path.
    expect(ge.reason).toBe(aborted.reason);
    expect(closed.reason).toBe(aborted.reason);
    expect(outcome.result.reason).toBe(aborted.reason);

    // dispatch.completed.verdict carries the OBSERVED verdict ("ok"),
    // not the runtime sentinel — adapter declared a verdict in
    // gate.pass but the body failed schema parse. The durable
    // transcript reflects what the adapter said.
    const dispatchCompleted = outcome.events.find((e) => e.kind === 'dispatch.completed');
    if (dispatchCompleted?.kind !== 'dispatch.completed') {
      throw new Error('expected dispatch.completed');
    }
    expect(dispatchCompleted.verdict).toBe('ok');

    // result.json on disk mirrors the aborted outcome + reason (RESULT-I4).
    const resultBody = readFileSync(join(runRoot, 'artifacts', 'result.json'), 'utf8');
    const resultParsed: { outcome: string; reason?: string } = JSON.parse(resultBody);
    expect(resultParsed.outcome).toBe('aborted');
    expect(resultParsed.reason).toBe(aborted.reason);
  });

  it('(c) schema-missing fallback: writes.artifact.schema names an unregistered schema → fail-closed; full uniform failure surface (no step.completed, byte-identical reason across 4 slots, dispatch.completed.verdict carries observed verdict)', async () => {
    const { workflow, bytes } = loadMutatedFixture((raw) => {
      addCanonicalArtifact(raw, 'not-registered-anywhere@v1');
    });
    const runRoot = join(runRootBase, 'c-missing');
    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('54000000-0000-0000-0000-000000000003'),
      goal: 'case (c): unknown schema name → fail-closed',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
      // Body would satisfy gate.pass and minimal verdict shape, but the
      // declared schema name is not in the registry → fail-closed.
      dispatcher: dispatcherWith('{"verdict":"ok"}'),
    });

    expect(outcome.result.outcome).toBe('aborted');

    const artifactAbs = join(runRoot, 'artifacts', 'dispatch-canonical.json');
    expect(existsSync(artifactAbs)).toBe(false);

    // Transcript slots DO exist — durable evidence the dispatch happened.
    expect(existsSync(join(runRoot, 'artifacts', 'dispatch.request.json'))).toBe(true);
    expect(existsSync(join(runRoot, 'artifacts', 'dispatch.receipt.json'))).toBe(true);
    expect(existsSync(join(runRoot, 'artifacts', 'dispatch.result.json'))).toBe(true);

    const ge = outcome.events.find(
      (e) => e.kind === 'gate.evaluated' && e.gate_kind === 'result_verdict',
    );
    if (ge?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated');
    expect(ge.outcome).toBe('fail');
    expect(ge.reason).toMatch(/not registered/);
    expect(ge.reason).toMatch(/not-registered-anywhere@v1/);
    expect(ge.reason).toMatch(/fail-closed/);

    const aborted = outcome.events.find((e) => e.kind === 'step.aborted');
    if (aborted?.kind !== 'step.aborted') throw new Error('expected step.aborted');
    expect(aborted.step_id).toBe('dispatch-step');

    // No step.completed for the aborted step — the uniform failure
    // surface. The fail-closed branch is the one most likely to regress
    // independently, so it must lock the full surface the
    // gate-pass/schema-fail case locks.
    const dispatchStepCompleted = outcome.events.find(
      (e) => e.kind === 'step.completed' && e.step_id === 'dispatch-step',
    );
    expect(dispatchStepCompleted).toBeUndefined();

    const closed = outcome.events.find((e) => e.kind === 'run.closed');
    if (closed?.kind !== 'run.closed') throw new Error('expected run.closed');
    expect(closed.outcome).toBe('aborted');

    // Reason byte-identity across all four event-surface slots —
    // mirrors case (b) exactly. Without this, a future regression that
    // diverged reasons on the fail-closed path would silently degrade
    // audit traceability.
    expect(ge.reason).toBe(aborted.reason);
    expect(closed.reason).toBe(aborted.reason);
    expect(outcome.result.reason).toBe(aborted.reason);

    // dispatch.completed.verdict carries the OBSERVED verdict ("ok"),
    // not the runtime sentinel — adapter declared a verdict in
    // gate.pass; only the schema lookup failed, not the adapter output
    // itself. Symmetric to case (b).
    const dispatchCompleted = outcome.events.find((e) => e.kind === 'dispatch.completed');
    if (dispatchCompleted?.kind !== 'dispatch.completed') {
      throw new Error('expected dispatch.completed');
    }
    expect(dispatchCompleted.verdict).toBe('ok');

    // result.json on disk mirrors the aborted outcome + reason (RESULT-I4).
    const resultBody = readFileSync(join(runRoot, 'artifacts', 'result.json'), 'utf8');
    const resultParsed: { outcome: string; reason?: string } = JSON.parse(resultBody);
    expect(resultParsed.outcome).toBe('aborted');
    expect(resultParsed.reason).toBe(aborted.reason);
  });

  it('(d) gate-fail interaction: gate-fail on bad verdict still skips artifact write even when body would be schema-valid — gate-fail reason (not schema-parse reason) is what lands', async () => {
    // Body { verdict: "reject", rationale: "..." } would PASS
    // dogfood-strict@v1 schema parse if we got that far — but the
    // gate evaluator rejects "reject" (not in gate.pass ["ok"]).
    // Expectation: the artifact is NOT written and the reason text
    // names the verdict rejection path, not the schema parse path.
    const { workflow, bytes } = loadMutatedFixture((raw) => {
      addCanonicalArtifact(raw, 'dogfood-strict@v1');
    });
    const runRoot = join(runRootBase, 'd-gate-fail-schema-valid');
    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('54000000-0000-0000-0000-000000000004'),
      goal: 'case (d): gate-fail dominates even on schema-valid body',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 18, 0, 0)),
      dispatcher: dispatcherWith(
        '{"verdict":"reject","rationale":"schema-valid but verdict not in gate.pass"}',
      ),
    });

    expect(outcome.result.outcome).toBe('aborted');

    const artifactAbs = join(runRoot, 'artifacts', 'dispatch-canonical.json');
    expect(existsSync(artifactAbs)).toBe(false);

    const ge = outcome.events.find(
      (e) => e.kind === 'gate.evaluated' && e.gate_kind === 'result_verdict',
    );
    if (ge?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated');
    expect(ge.outcome).toBe('fail');

    // Gate-fail reason names the verdict rejection, NOT a schema parse
    // error. The assertion guards against a regression that flips the
    // ordering and lets schema-parse "win" the failure attribution
    // when both would fail.
    expect(ge.reason).toMatch(/reject/);
    expect(ge.reason).toMatch(/not in gate.pass/);
    // The verdict-rejection reason string never mentions "schema"
    // or "registered" — that would only appear on the schema-parse
    // path.
    expect(ge.reason).not.toMatch(/not registered/);
    expect(ge.reason).not.toMatch(/did not validate against schema/);

    // dispatch.completed.verdict carries the observed verdict "reject"
    // — durable transcript reflects what adapter said even on
    // rejection.
    const dispatchCompleted = outcome.events.find((e) => e.kind === 'dispatch.completed');
    if (dispatchCompleted?.kind !== 'dispatch.completed') {
      throw new Error('expected dispatch.completed');
    }
    expect(dispatchCompleted.verdict).toBe('reject');
  });

  it('(e) orchestrator-only explore.analysis is not admitted through the dispatch artifact registry', async () => {
    const { workflow, bytes } = loadMutatedFixture((raw) => {
      addCanonicalArtifact(raw, 'explore.analysis@v1', 'artifacts/dispatch-analysis.json');
    });
    const runRoot = join(runRootBase, 'e-orchestrator-only-schema');
    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('54000000-0000-0000-0000-000000000005'),
      goal: 'dispatch cannot materialize orchestrator-only analysis',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 16, 10, 0)),
      dispatcher: dispatcherWith('{"verdict":"ok"}'),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(existsSync(join(runRoot, 'artifacts', 'dispatch-analysis.json'))).toBe(false);

    const ge = outcome.events.find(
      (e) => e.kind === 'gate.evaluated' && e.gate_kind === 'result_verdict',
    );
    if (ge?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated');
    expect(ge.outcome).toBe('fail');
    expect(ge.reason).toMatch(/explore\.analysis@v1/);
    expect(ge.reason).toMatch(/not registered/);

    const dispatchCompleted = outcome.events.find((e) => e.kind === 'dispatch.completed');
    if (dispatchCompleted?.kind !== 'dispatch.completed') {
      throw new Error('expected dispatch.completed');
    }
    expect(dispatchCompleted.verdict).toBe('ok');
  });
});
