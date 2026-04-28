import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AgentDispatchInput } from '../../src/runtime/adapters/agent.js';
import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import { type DispatchFn, runWorkflow } from '../../src/runtime/runner.js';
import { RunId, WorkflowId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { Workflow } from '../../src/schemas/workflow.js';

// Adapter-identity plumbing through `runWorkflow`. `DispatchFn` is a
// structured descriptor
// `{ adapterName: BuiltInAdapter; dispatch: (input) => Promise<DispatchResult> }`
// and the materializer call site is parameterized on
// `dispatcher.adapterName`. This test injects a codex-shaped descriptor
// (no real codex subprocess; stub `dispatch` function returning a
// deterministic `DispatchResult`) and asserts the event-log records
// `adapter.name='codex'` — proving the descriptor-to-event plumbing
// carries adapter identity end-to-end through `runWorkflow`.
//
// The companion second-adapter round-trip at
// `tests/runner/codex-dispatch-roundtrip.test.ts` exercises the real
// `dispatchCodex → materializeDispatch` path directly (CODEX_SMOKE=1).
// This test exercises the `runWorkflow` seam on top of that — the
// regression the round-trip alone cannot catch, since the round-trip
// calls `materializeDispatch` directly and bypasses `runWorkflow`.

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

function codexShapedStub(): DispatchFn {
  return {
    adapterName: 'codex',
    dispatch: async (input: AgentDispatchInput): Promise<DispatchResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-codex-thread-id',
      result_body: '{"verdict":"ok"}',
      duration_ms: 1,
      cli_version: '0.0.0-codex-stub',
    }),
  };
}

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode: 'runner materializer call site hardcodes adapterName="agent"',
    acceptance_evidence:
      'dispatch.started event carries adapter.name="codex" when a codex-shaped descriptor is injected',
    alternate_framing:
      'let P2.7 carry a break-glass lane instead — rejected because the refactor is pure type-signature work and unblocks multi-adapter routing without an escrow',
  };
}

let runRootBase: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-adapter-identity-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('DispatchFn descriptor carries adapter identity into dispatch.started', () => {
  it('injecting a codex-shaped descriptor through WorkflowInvocation.dispatcher lands adapter.name="codex"', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'codex-identity');
    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('45a45a45-a45a-45a4-5a45-a45a45a45a45'),
      goal: 'adapter-identity regression',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 22, 14, 0, 0)),
      dispatcher: codexShapedStub(),
    });

    expect(outcome.result.outcome).toBe('complete');
    expect(outcome.result.workflow_id).toBe(WorkflowId.parse('dogfood-run-0'));

    const dispatchStarted = outcome.events.find((e) => e.kind === 'dispatch.started');
    if (!dispatchStarted || dispatchStarted.kind !== 'dispatch.started') {
      throw new Error('expected dispatch.started event');
    }
    // The critical regression: identity comes from the descriptor, not
    // a call-site literal. A regression here would land `name: 'agent'`
    // and fail this test.
    expect(dispatchStarted.adapter).toEqual({ kind: 'builtin', name: 'codex' });
  });
});
