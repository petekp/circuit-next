import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AgentDispatchInput } from '../../src/runtime/adapters/agent.js';
import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import { readRunLog } from '../../src/runtime/event-log-reader.js';
import { type DispatchFn, runWorkflow } from '../../src/runtime/runner.js';
import type { RunClosedOutcome } from '../../src/schemas/event.js';
import { RunId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { RunResult } from '../../src/schemas/result.js';
import { RunProjection } from '../../src/schemas/run.js';
import { Snapshot } from '../../src/schemas/snapshot.js';
import { Workflow } from '../../src/schemas/workflow.js';

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

function terminalWorkflow(route: TerminalRoute): { workflow: Workflow; bytes: Buffer } {
  const raw = {
    schema_version: '2',
    id: 'terminal-outcome-workflow',
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
        rigor: 'standard',
        description: 'Start at the only step so the pass route reaches a terminal immediately.',
      },
    ],
    phases: [
      {
        id: 'plan-phase',
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
        kind: 'synthesis',
        writes: {
          artifact: {
            path: 'artifacts/terminal.json',
            schema: 'terminal-outcome@v1',
          },
        },
        gate: {
          kind: 'schema_sections',
          source: { kind: 'artifact', ref: 'artifact' },
          required: ['summary'],
        },
      },
    ],
    spine_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'act', 'verify', 'review', 'close'],
      rationale: 'One-step terminal route regression keeps this fixture focused on run closure.',
    },
  };
  const workflow = Workflow.parse(raw);
  return { workflow, bytes: Buffer.from(JSON.stringify(workflow)) };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode: 'non-complete terminal routes closed as complete',
    acceptance_evidence:
      'terminal route labels map to matching run.closed outcome, state.json status, and result.json outcome',
    alternate_framing:
      'schema-only coverage — rejected because the bug lived in runner outcome selection after valid route parsing',
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
  runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-terminal-outcome-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('RUN-I7 terminal route outcome mapping', () => {
  for (const c of CASES) {
    it(`${c.route} closes with outcome=${c.outcome} across run.closed, state.json, RunProjection, and result.json`, async () => {
      const { workflow, bytes } = terminalWorkflow(c.route);
      const runRoot = join(runRootBase, c.outcome);
      const outcome = await runWorkflow({
        runRoot,
        workflow,
        workflowBytes: bytes,
        runId: RunId.parse(c.runId),
        goal: `terminal route ${c.route} maps honestly`,
        rigor: 'standard',
        lane: lane(),
        now: deterministicNow(Date.UTC(2026, 3, 24, 20, 0, 0)),
        dispatcher: unusedDispatcher(),
      });

      expect(outcome.result.outcome).toBe(c.outcome);
      expect(outcome.snapshot.status).toBe(c.outcome);
      expect(existsSync(join(runRoot, 'events.ndjson'))).toBe(true);
      expect(existsSync(join(runRoot, 'state.json'))).toBe(true);
      expect(existsSync(join(runRoot, 'artifacts', 'result.json'))).toBe(true);

      expect(outcome.events.map((event) => event.kind)).toEqual([
        'run.bootstrapped',
        'step.entered',
        'step.artifact_written',
        'gate.evaluated',
        'step.completed',
        'run.closed',
      ]);
      expect(outcome.events.find((event) => event.kind === 'dispatch.started')).toBeUndefined();

      const completed = outcome.events.find((event) => event.kind === 'step.completed');
      if (completed?.kind !== 'step.completed') throw new Error('expected step.completed');
      expect(completed.route_taken).toBe('pass');

      const closed = outcome.events[outcome.events.length - 1];
      if (closed?.kind !== 'run.closed') throw new Error('expected run.closed last');
      expect(closed.outcome).toBe(c.outcome);
      if (c.reason === undefined) {
        expect(closed.reason).toBeUndefined();
      } else {
        expect(closed.reason).toBe(c.reason);
        expect(closed.reason).not.toMatch(/treating as complete/i);
      }

      const snapshot = Snapshot.parse(
        JSON.parse(readFileSync(join(runRoot, 'state.json'), 'utf8')),
      );
      expect(snapshot.status).toBe(c.outcome);
      expect(snapshot.events_consumed).toBe(outcome.events.length);
      const projectedStep = snapshot.steps.find((step) => step.step_id === 'terminal-step');
      expect(projectedStep?.status).toBe('complete');
      expect(projectedStep?.last_route_taken).toBe('pass');

      const log = readRunLog(runRoot);
      expect(log).toHaveLength(outcome.events.length);
      expect(RunProjection.safeParse({ log, snapshot }).success).toBe(true);

      const result = RunResult.parse(
        JSON.parse(readFileSync(join(runRoot, 'artifacts', 'result.json'), 'utf8')),
      );
      expect(result.outcome).toBe(c.outcome);
      expect(result.events_observed).toBe(log.length);
      expect(result.reason).toBe(c.reason);
      if (result.reason !== undefined) {
        expect(result.reason).not.toMatch(/treating as complete/i);
      }
    });
  }
});
