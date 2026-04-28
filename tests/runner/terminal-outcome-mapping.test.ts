import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AgentRelayInput } from '../../src/runtime/connectors/agent.js';
import type { RelayResult } from '../../src/runtime/connectors/shared.js';
import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
import { readRunTrace } from '../../src/runtime/trace-reader.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { RunId } from '../../src/schemas/ids.js';
import { RunResult } from '../../src/schemas/result.js';
import { RunProjection } from '../../src/schemas/run.js';
import { Snapshot } from '../../src/schemas/snapshot.js';
import type { RunClosedOutcome } from '../../src/schemas/trace-entry.js';

type TerminalRoute = '@complete' | '@stop' | '@escalate' | '@handoff';

const CASES: Array<{
  route: TerminalRoute;
  outcome: RunClosedOutcome;
  runId: string;
  reason?: string;
}> = [
  {
    route: '@complete',
    outcome: 'complete',
    runId: '73000000-0000-0000-0000-000000000001',
  },
  {
    route: '@stop',
    outcome: 'stopped',
    runId: '73000000-0000-0000-0000-000000000002',
    reason: 'terminal route @stop',
  },
  {
    route: '@escalate',
    outcome: 'escalated',
    runId: '73000000-0000-0000-0000-000000000003',
    reason: 'terminal route @escalate',
  },
  {
    route: '@handoff',
    outcome: 'handoff',
    runId: '73000000-0000-0000-0000-000000000004',
    reason: 'terminal route @handoff',
  },
];

function terminalCompiledFlow(route: TerminalRoute): { flow: CompiledFlow; bytes: Buffer } {
  const raw = {
    schema_version: '2',
    id: 'terminal-outcome-flow',
    version: '0.1.0',
    purpose: 'Runtime regression fixture for terminal route outcome mapping.',
    entry: {
      signals: { include: ['terminal-outcome'], exclude: [] },
      intent_prefixes: ['terminal-outcome'],
    },
    entry_modes: [
      {
        name: 'default',
        start_at: 'terminal-step',
        depth: 'standard',
        description: 'Start at the only step so the pass route reaches a terminal immediately.',
      },
    ],
    stages: [
      {
        id: 'plan-stage',
        title: 'Plan',
        canonical: 'plan',
        steps: ['terminal-step'],
      },
    ],
    steps: [
      {
        id: 'terminal-step',
        title: 'Terminal route step',
        protocol: 'terminal-outcome@v1',
        reads: [],
        routes: { pass: route },
        executor: 'orchestrator',
        kind: 'compose',
        writes: {
          report: {
            path: 'reports/terminal.json',
            schema: 'terminal-outcome@v1',
          },
        },
        check: {
          kind: 'schema_sections',
          source: { kind: 'report', ref: 'report' },
          required: ['summary'],
        },
      },
    ],
    stage_path_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'act', 'verify', 'review', 'close'],
      rationale: 'One-step terminal route regression keeps this fixture focused on run closure.',
    },
  };
  const flow = CompiledFlow.parse(raw);
  return { flow, bytes: Buffer.from(JSON.stringify(flow)) };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode: 'non-complete terminal routes closed as complete',
    acceptance_evidence:
      'terminal route labels map to matching run.closed outcome, state.json status, and result.json outcome',
    alternate_framing:
      'schema-only coverage — rejected because the bug lived in runner outcome selection after valid route parsing',
  };
}

function unusedRelayer(): RelayFn {
  return {
    connectorName: 'agent',
    relay: async (_input: AgentRelayInput): Promise<RelayResult> => ({
      request_payload: 'unused',
      receipt_id: 'unused',
      result_body: '{"verdict":"ok"}',
      duration_ms: 1,
      cli_version: '0.0.0-unused',
    }),
  };
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-terminal-outcome-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('RUN-I7 terminal route outcome mapping', () => {
  for (const c of CASES) {
    it(`${c.route} closes with outcome=${c.outcome} across run.closed, state.json, RunProjection, and result.json`, async () => {
      const { flow, bytes } = terminalCompiledFlow(c.route);
      const runFolder = join(runFolderBase, c.outcome);
      const outcome = await runCompiledFlow({
        runFolder,
        flow,
        flowBytes: bytes,
        runId: RunId.parse(c.runId),
        goal: `terminal route ${c.route} maps honestly`,
        depth: 'standard',
        change_kind: change_kind(),
        now: deterministicNow(Date.UTC(2026, 3, 24, 20, 0, 0)),
        relayer: unusedRelayer(),
      });

      expect(outcome.result.outcome).toBe(c.outcome);
      expect(outcome.snapshot.status).toBe(c.outcome);
      expect(existsSync(join(runFolder, 'trace.ndjson'))).toBe(true);
      expect(existsSync(join(runFolder, 'state.json'))).toBe(true);
      expect(existsSync(join(runFolder, 'reports', 'result.json'))).toBe(true);

      expect(outcome.trace_entrys.map((trace_entry) => trace_entry.kind)).toEqual([
        'run.bootstrapped',
        'step.entered',
        'step.report_written',
        'check.evaluated',
        'step.completed',
        'run.closed',
      ]);
      expect(
        outcome.trace_entrys.find((trace_entry) => trace_entry.kind === 'relay.started'),
      ).toBeUndefined();

      const completed = outcome.trace_entrys.find(
        (trace_entry) => trace_entry.kind === 'step.completed',
      );
      if (completed?.kind !== 'step.completed') throw new Error('expected step.completed');
      expect(completed.route_taken).toBe('pass');

      const closed = outcome.trace_entrys[outcome.trace_entrys.length - 1];
      if (closed?.kind !== 'run.closed') throw new Error('expected run.closed last');
      expect(closed.outcome).toBe(c.outcome);
      if (c.reason === undefined) {
        expect(closed.reason).toBeUndefined();
      } else {
        expect(closed.reason).toBe(c.reason);
        expect(closed.reason).not.toMatch(/treating as complete/i);
      }

      const snapshot = Snapshot.parse(
        JSON.parse(readFileSync(join(runFolder, 'state.json'), 'utf8')),
      );
      expect(snapshot.status).toBe(c.outcome);
      expect(snapshot.trace_entries_consumed).toBe(outcome.trace_entrys.length);
      const projectedStep = snapshot.steps.find((step) => step.step_id === 'terminal-step');
      expect(projectedStep?.status).toBe('complete');
      expect(projectedStep?.last_route_taken).toBe('pass');

      const log = readRunTrace(runFolder);
      expect(log).toHaveLength(outcome.trace_entrys.length);
      expect(RunProjection.safeParse({ log, snapshot }).success).toBe(true);

      const result = RunResult.parse(
        JSON.parse(readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8')),
      );
      expect(result.outcome).toBe(c.outcome);
      expect(result.trace_entries_observed).toBe(log.length);
      expect(result.reason).toBe(c.reason);
      if (result.reason !== undefined) {
        expect(result.reason).not.toMatch(/treating as complete/i);
      }
    });
  }
});
