import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AgentRelayInput } from '../../src/runtime/connectors/agent.js';
import { materializeRelay } from '../../src/runtime/connectors/relay-materializer.js';
import type { RelayResult } from '../../src/runtime/connectors/shared.js';
import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { RunId, StepId } from '../../src/schemas/ids.js';

// Relay-trace_entry provenance plumbing through `runCompiledFlow`.
//
// `materializeRelay` does not hardcode
// `resolved_selection: { skills: [], invocation_options: {} }` or
// `resolved_from: { source: 'default' }`; both fields flow from the
// runner's actual selection-resolution path. This test file pins the
// invariant: provenance is derived from real inputs at the runner
// boundary and the materializer is fail-closed at the type signature.

const FIXTURE_PATH = resolve('.claude-plugin/skills/runtime-proof/circuit.json');

function loadFixture(): { flow: CompiledFlow; bytes: Buffer } {
  const bytes = readFileSync(FIXTURE_PATH);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  return { flow: CompiledFlow.parse(raw), bytes };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function stubRelayer(): RelayFn {
  return {
    connectorName: 'agent',
    relay: async (input: AgentRelayInput): Promise<RelayResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-receipt',
      result_body: '{"verdict":"ok"}',
      duration_ms: 1,
      cli_version: '0.0.0-stub',
    }),
  };
}

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode:
      'relay.started trace_entry carries hardcoded `resolved_selection: empty` + `resolved_from: default` regardless of caller intent',
    acceptance_evidence:
      'relay.started trace_entry carries provenance derived from actual runner decision path',
    alternate_framing:
      'leave the materializer to fabricate defaults and let P2-MODEL-EFFORT fix it later — rejected because the audit trail consumed by P2.8 router work is materially false until this lands',
  };
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-relay-provenance-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe("relay.started carries honest 'resolved_from' from the runner's decision path", () => {
  it('injecting a relayer via CompiledFlowInvocation.relayer lands resolved_from.source="explicit"', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'explicit-provenance');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('47a47a47-a47a-47a4-7a47-a47a47a47a47'),
      goal: 'explicit provenance',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 14, 0, 0)),
      relayer: stubRelayer(),
    });

    const relayStarted = outcome.trace_entrys.find((e) => e.kind === 'relay.started');
    if (!relayStarted || relayStarted.kind !== 'relay.started') {
      throw new Error('expected relay.started trace_entry');
    }
    expect(relayStarted.resolved_from).toEqual({ source: 'explicit' });
  });
});

describe("relay.started carries honest 'resolved_selection' from flow + step inputs", () => {
  it('canonical empty selection survives when flow.default_selection and step.selection are both absent', async () => {
    const { flow, bytes } = loadFixture();
    // The runtime-proof fixture does not declare default_selection or per-step
    // selection; the canonical empty resolution is the honest claim and
    // is genuinely derived from inputs that are empty.
    expect(flow.default_selection).toBeUndefined();
    const relayStep = flow.steps.find((s) => s.kind === 'relay');
    if (relayStep === undefined) throw new Error('fixture missing relay step');
    expect(relayStep.selection).toBeUndefined();

    const runFolder = join(runFolderBase, 'empty-selection');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('47a47a47-a47a-47a4-7a47-a47a47a47a48'),
      goal: 'empty selection composition',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 14, 0, 0)),
      relayer: stubRelayer(),
    });

    const relayStarted = outcome.trace_entrys.find((e) => e.kind === 'relay.started');
    if (!relayStarted || relayStarted.kind !== 'relay.started') {
      throw new Error('expected relay.started trace_entry');
    }
    expect(relayStarted.resolved_selection).toEqual({ skills: [], invocation_options: {} });
  });

  it('flow.default_selection contributes to resolved_selection when step.selection is absent', async () => {
    const { flow: baseCompiledFlow, bytes } = loadFixture();
    // Inject a flow.default_selection by re-parsing a mutated copy.
    const mutated = {
      ...JSON.parse(bytes.toString('utf8')),
      default_selection: {
        model: { provider: 'anthropic', model: 'claude-opus-4-7' },
        effort: 'medium',
        skills: { mode: 'replace', skills: ['tdd', 'react-doctor'] },
        invocation_options: { temperature: 0 },
      },
    };
    const flow = CompiledFlow.parse(mutated);
    expect(flow.default_selection).toBeDefined();
    expect(baseCompiledFlow).toBeDefined();

    const runFolder = join(runFolderBase, 'flow-selection');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('47a47a47-a47a-47a4-7a47-a47a47a47a49'),
      goal: 'flow-level selection',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 14, 0, 0)),
      relayer: stubRelayer(),
    });

    const relayStarted = outcome.trace_entrys.find((e) => e.kind === 'relay.started');
    if (!relayStarted || relayStarted.kind !== 'relay.started') {
      throw new Error('expected relay.started trace_entry');
    }
    expect(relayStarted.resolved_selection).toEqual({
      model: { provider: 'anthropic', model: 'claude-opus-4-7' },
      effort: 'medium',
      skills: ['tdd', 'react-doctor'],
      invocation_options: { temperature: 0 },
    });
  });

  it('step.selection wins over flow.default_selection on field collision (right-biased per SEL precedence)', async () => {
    const { bytes } = loadFixture();
    const raw = JSON.parse(bytes.toString('utf8'));
    raw.default_selection = {
      model: { provider: 'anthropic', model: 'claude-opus-4-7' },
      effort: 'low',
      skills: { mode: 'replace', skills: ['tdd'] },
      invocation_options: { temperature: 0 },
    };
    // Find the relay step and overlay a step-level selection.
    for (const step of raw.steps) {
      if (step.kind === 'relay') {
        step.selection = {
          model: { provider: 'openai', model: 'gpt-5.4' },
          effort: 'high',
          skills: { mode: 'replace', skills: ['react-doctor'] },
          invocation_options: { reasoning: 'xhigh' },
        };
      }
    }
    const flow = CompiledFlow.parse(raw);

    const runFolder = join(runFolderBase, 'step-overrides-flow');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('47a47a47-a47a-47a4-7a47-a47a47a47a4a'),
      goal: 'step overrides flow',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 14, 0, 0)),
      relayer: stubRelayer(),
    });

    const relayStarted = outcome.trace_entrys.find((e) => e.kind === 'relay.started');
    if (!relayStarted || relayStarted.kind !== 'relay.started') {
      throw new Error('expected relay.started trace_entry');
    }
    // step.selection wins on collisions (model + effort + skills); both
    // layers contribute to invocation_options via shallow merge with
    // step-side keys winning collisions.
    expect(relayStarted.resolved_selection).toEqual({
      model: { provider: 'openai', model: 'gpt-5.4' },
      effort: 'high',
      skills: ['react-doctor'],
      invocation_options: { temperature: 0, reasoning: 'xhigh' },
    });
  });
});

// SkillOverride composition pins. The helper applies SEL-I3
// composition (inherit no-op, replace set, append union, remove
// difference) over a flow → step base chain.
describe("SkillOverride 'append' / 'remove' / 'inherit' compose per SEL-I3", () => {
  it("flow=replace ['tdd','react-doctor'] + step=remove ['tdd'] → ['react-doctor']", async () => {
    const { bytes } = loadFixture();
    const raw = JSON.parse(bytes.toString('utf8'));
    raw.default_selection = {
      skills: { mode: 'replace', skills: ['tdd', 'react-doctor'] },
    };
    for (const step of raw.steps) {
      if (step.kind === 'relay') {
        step.selection = { skills: { mode: 'remove', skills: ['tdd'] } };
      }
    }
    const flow = CompiledFlow.parse(raw);
    const runFolder = join(runFolderBase, 'remove-after-replace');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('47a47a47-a47a-47a4-7a47-a47a47a47b01'),
      goal: 'remove after replace composition',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 14, 0, 0)),
      relayer: stubRelayer(),
    });
    const relayStarted = outcome.trace_entrys.find((e) => e.kind === 'relay.started');
    if (!relayStarted || relayStarted.kind !== 'relay.started') {
      throw new Error('expected relay.started trace_entry');
    }
    expect(relayStarted.resolved_selection.skills).toEqual(['react-doctor']);
  });

  it("flow=replace ['tdd'] + step=append ['react-doctor'] → ['tdd','react-doctor'] (set-union)", async () => {
    const { bytes } = loadFixture();
    const raw = JSON.parse(bytes.toString('utf8'));
    raw.default_selection = { skills: { mode: 'replace', skills: ['tdd'] } };
    for (const step of raw.steps) {
      if (step.kind === 'relay') {
        step.selection = { skills: { mode: 'append', skills: ['react-doctor'] } };
      }
    }
    const flow = CompiledFlow.parse(raw);
    const runFolder = join(runFolderBase, 'append-after-replace');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('47a47a47-a47a-47a4-7a47-a47a47a47b02'),
      goal: 'append after replace composition',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 14, 0, 0)),
      relayer: stubRelayer(),
    });
    const relayStarted = outcome.trace_entrys.find((e) => e.kind === 'relay.started');
    if (!relayStarted || relayStarted.kind !== 'relay.started') {
      throw new Error('expected relay.started trace_entry');
    }
    expect(relayStarted.resolved_selection.skills).toEqual(['tdd', 'react-doctor']);
  });

  it("flow=replace ['tdd','react-doctor'] + step=append ['tdd'] → ['tdd','react-doctor'] (set-union dedupes)", async () => {
    const { bytes } = loadFixture();
    const raw = JSON.parse(bytes.toString('utf8'));
    raw.default_selection = {
      skills: { mode: 'replace', skills: ['tdd', 'react-doctor'] },
    };
    for (const step of raw.steps) {
      if (step.kind === 'relay') {
        step.selection = { skills: { mode: 'append', skills: ['tdd'] } };
      }
    }
    const flow = CompiledFlow.parse(raw);
    const runFolder = join(runFolderBase, 'append-existing');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('47a47a47-a47a-47a4-7a47-a47a47a47b03'),
      goal: 'append existing dedupes',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 14, 0, 0)),
      relayer: stubRelayer(),
    });
    const relayStarted = outcome.trace_entrys.find((e) => e.kind === 'relay.started');
    if (!relayStarted || relayStarted.kind !== 'relay.started') {
      throw new Error('expected relay.started trace_entry');
    }
    expect(relayStarted.resolved_selection.skills).toEqual(['tdd', 'react-doctor']);
  });

  it("flow=replace ['tdd'] + step=inherit → ['tdd'] (no-op preserves base)", async () => {
    const { bytes } = loadFixture();
    const raw = JSON.parse(bytes.toString('utf8'));
    raw.default_selection = { skills: { mode: 'replace', skills: ['tdd'] } };
    for (const step of raw.steps) {
      if (step.kind === 'relay') {
        step.selection = { skills: { mode: 'inherit' } };
      }
    }
    const flow = CompiledFlow.parse(raw);
    const runFolder = join(runFolderBase, 'inherit-noop');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('47a47a47-a47a-47a4-7a47-a47a47a47b04'),
      goal: 'inherit no-op preserves flow base',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 14, 0, 0)),
      relayer: stubRelayer(),
    });
    const relayStarted = outcome.trace_entrys.find((e) => e.kind === 'relay.started');
    if (!relayStarted || relayStarted.kind !== 'relay.started') {
      throw new Error('expected relay.started trace_entry');
    }
    expect(relayStarted.resolved_selection.skills).toEqual(['tdd']);
  });
});

// CompiledFlowRunResult.relayResults surface for AGENT_SMOKE /
// CODEX_SMOKE fingerprint cli_version binding. The path reads from the
// actual connector return and the audit rejects v2 fingerprints with
// empty/unknown cli_version.
describe('CompiledFlowRunResult.relayResults surfaces per-relay cli_version', () => {
  it('captures stepId + connectorName + cli_version from each relayer invocation', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'cli-version-capture');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('47a47a47-a47a-47a4-7a47-a47a47a47b05'),
      goal: 'cli_version capture',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 14, 0, 0)),
      relayer: stubRelayer(),
    });
    expect(outcome.relayResults.length).toBeGreaterThan(0);
    const first = outcome.relayResults[0];
    if (first === undefined) throw new Error('expected relayResults[0]');
    expect(first.connectorName).toBe('agent');
    expect(first.cli_version).toBe('0.0.0-stub');
    expect(typeof first.stepId).toBe('string');
    expect(first.stepId.length).toBeGreaterThan(0);
  });
});

describe("materializer fails closed when resolved_from.role does not match the relay step's role", () => {
  it('materializeRelay throws when resolvedFrom.source="role" carries a role that disagrees with the trace_entry role', () => {
    const stub: RelayResult = {
      request_payload: 'x',
      receipt_id: 'r',
      result_body: 'y',
      duration_ms: 1,
      cli_version: '0',
    };
    const runFolder = mkdtempSync(join(tmpdir(), 'circuit-next-relay-provenance-throw-'));
    try {
      expect(() =>
        materializeRelay({
          runId: RunId.parse('47a47a47-a47a-47a4-7a47-a47a47a47a4b'),
          stepId: StepId.parse('s1'),
          attempt: 1,
          role: 'researcher',
          startingSequence: 0,
          runFolder,
          writes: { request: 'request', receipt: 'receipt', result: 'result' },
          connectorName: 'agent',
          resolvedSelection: { skills: [], invocation_options: {} },
          // `role` source with a role that does NOT equal the step's role
          // — the cross-validation in src/schemas/trace-entry.ts catches this at
          // the TraceEntry-union level; the materializer surfaces it earlier
          // with a precise error.
          resolvedFrom: { source: 'role', role: 'implementer' },
          relayResult: stub,
          verdict: 'accept',
          now: () => new Date(0),
        }),
      ).toThrowError(/resolvedFrom.role 'implementer' does not match relay step role 'researcher'/);
    } finally {
      rmSync(runFolder, { recursive: true, force: true });
    }
  });
});
