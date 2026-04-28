// Real recursion integration test for fanout.
//
// Sister test to `fanout-runtime.test.ts` (which stubs `childRunner`
// to test the parent's fanout handler in isolation) and to
// `sub-run-real-recursion.test.ts` (the same no-stub approach for
// the single-child sub-run case). This test extends real-recursion
// coverage to the multi-child fanout substrate.
//
// What's specific to fanout: each branch produces its own child run
// with its own run-root, run_id, and event log. The handler also
// drives a worktreeRunner per branch. When `childRunner` is undefined
// on the WorkflowInvocation, the runner defaults to `runWorkflow`
// itself (per src/runtime/runner.ts:633), so each branch recurses
// through the real runner end-to-end.
//
// Hermetic, fast (~50ms): a stub worktreeRunner creates the branch
// directories without invoking git; a fake `acceptingDispatcher`
// serves all branch children.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AgentDispatchInput } from '../../src/runtime/adapters/agent.js';
import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import {
  type ChildWorkflowResolver,
  type DispatchFn,
  type WorktreeRunner,
  runWorkflow,
} from '../../src/runtime/runner.js';
import { RunId, type WorkflowId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { Workflow } from '../../src/schemas/workflow.js';

const PARENT_WORKFLOW_ID = 'parent-fanout-recursion-test' as unknown as WorkflowId;
const CHILD_WORKFLOW_ID = 'child-fanout-recursion-test' as unknown as WorkflowId;

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode:
      'fanout handler skips real branch execution or shares the runner instance with the parent',
    acceptance_evidence:
      'each branch recurses through real runWorkflow with a fresh RunId and a sibling run-root, each child emits its own event log, parent admits via aggregate-only join',
    alternate_framing:
      'integration test of fanout + real recursive runWorkflow rather than handler-isolation unit test',
  };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

// Fake dispatcher serves every branch child's single dispatch step.
function acceptingDispatcher(): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async (input: AgentDispatchInput): Promise<DispatchResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-receipt-fanout-real-recursion',
      result_body: JSON.stringify({ verdict: 'accept' }),
      duration_ms: 1,
      cli_version: '0.0.0-stub',
    }),
  };
}

// Stub worktree runner — the fanout handler invokes `add` to
// provision a branch directory and `remove` to release it. The real
// runner creates real git worktrees; for hermetic recursion it's
// enough to mkdir the path so the child run-root nests beneath it
// correctly.
function stubWorktreeRunner(): WorktreeRunner {
  return {
    add: ({ worktreePath }) => {
      mkdirSync(worktreePath, { recursive: true });
    },
    remove: () => {
      // No-op — the real runner removes the worktree dir, but the
      // test's afterEach rmSync covers cleanup.
    },
    changedFiles: () => [],
  };
}

function buildChildWorkflow(): Workflow {
  return Workflow.parse({
    schema_version: '2',
    id: CHILD_WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose:
      'real-recursion fanout test child — single dispatch step admits an accept verdict via the fake dispatcher.',
    entry: { signals: { include: ['child'], exclude: [] }, intent_prefixes: ['child'] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'child-dispatch',
        rigor: 'standard',
        description: 'Default child entry mode.',
      },
    ],
    phases: [{ id: 'act-phase', title: 'Act', canonical: 'act', steps: ['child-dispatch'] }],
    spine_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'narrow real-recursion fanout test child — only act phase carries dispatch.',
    },
    steps: [
      {
        id: 'child-dispatch',
        title: 'Child dispatch — admits accept',
        protocol: 'real-recursion-fanout-child@v1',
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
          pass: ['accept'],
        },
      },
    ],
  });
}

function buildParentWorkflow(): Workflow {
  return Workflow.parse({
    schema_version: '2',
    id: PARENT_WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose:
      'real-recursion fanout test parent — two branches, each recurses into the child via real runWorkflow.',
    entry: { signals: { include: ['fanout'], exclude: [] }, intent_prefixes: ['fanout'] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'fanout-step',
        rigor: 'standard',
        description: 'Default parent entry mode.',
      },
    ],
    phases: [{ id: 'act-phase', title: 'Act', canonical: 'act', steps: ['fanout-step'] }],
    spine_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale:
        'narrow real-recursion fanout test parent — only act phase carries the fanout step.',
    },
    steps: [
      {
        id: 'fanout-step',
        title: 'Fanout — two branches, real recursion',
        protocol: 'real-recursion-fanout-parent@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'fanout',
        branches: {
          kind: 'static',
          branches: [
            {
              branch_id: 'a',
              workflow_ref: {
                workflow_id: CHILD_WORKFLOW_ID as unknown as string,
                entry_mode: 'default',
              },
              goal: 'branch-a goal',
              rigor: 'standard',
            },
            {
              branch_id: 'b',
              workflow_ref: {
                workflow_id: CHILD_WORKFLOW_ID as unknown as string,
                entry_mode: 'default',
              },
              goal: 'branch-b goal',
              rigor: 'standard',
            },
          ],
        },
        concurrency: { kind: 'bounded', max: 2 },
        on_child_failure: 'abort-all',
        writes: {
          branches_dir: 'artifacts/branches',
          aggregate: { path: 'artifacts/aggregate.json', schema: 'fanout-aggregate@v1' },
        },
        gate: {
          kind: 'fanout_aggregate',
          source: { kind: 'fanout_results', ref: 'aggregate' },
          join: { policy: 'aggregate-only' },
          verdicts: { admit: ['accept'] },
        },
      },
    ],
  });
}

let runRootBase: string;
let projectRoot: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'fanout-real-recursion-'));
  projectRoot = mkdtempSync(join(tmpdir(), 'fanout-real-recursion-project-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('fanout real recursion', () => {
  it('runs each branch via real runWorkflow (no childRunner stub) and admits via aggregate-only', async () => {
    const parentWorkflow = buildParentWorkflow();
    const parentBytes = Buffer.from(JSON.stringify(parentWorkflow));
    const childWorkflow = buildChildWorkflow();
    const childBytes = Buffer.from(JSON.stringify(childWorkflow));

    const childResolver: ChildWorkflowResolver = () => ({
      workflow: childWorkflow,
      bytes: childBytes,
    });

    const parentRunId = RunId.parse('33333333-3333-3333-3333-333333333333');
    const parentRunRoot = join(runRootBase, parentRunId as unknown as string);

    // KEY: NO `childRunner` field — runner defaults to `runWorkflow`
    // itself, so each branch recurses through the real runner.
    const outcome = await runWorkflow({
      runRoot: parentRunRoot,
      workflow: parentWorkflow,
      workflowBytes: parentBytes,
      runId: parentRunId,
      goal: 'parent run goal — exercise fanout real recursion',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 0, 0, 0)),
      dispatcher: acceptingDispatcher(),
      projectRoot,
      childWorkflowResolver: childResolver,
      worktreeRunner: stubWorktreeRunner(),
    });

    if (outcome.result.outcome === 'checkpoint_waiting') {
      throw new Error('parent unexpectedly waited at a checkpoint');
    }
    expect(outcome.result.outcome).toBe('complete');

    // Fanout audit linkage on the parent's event log.
    const fanoutStarted = outcome.events.find((e) => e.kind === 'fanout.started');
    if (fanoutStarted?.kind !== 'fanout.started') throw new Error('expected fanout.started');
    expect(fanoutStarted.branch_ids).toEqual(['a', 'b']);

    const branchStarted = outcome.events.filter((e) => e.kind === 'fanout.branch_started');
    const branchCompleted = outcome.events.filter((e) => e.kind === 'fanout.branch_completed');
    expect(branchStarted).toHaveLength(2);
    expect(branchCompleted).toHaveLength(2);

    const fanoutJoined = outcome.events.find((e) => e.kind === 'fanout.joined');
    if (fanoutJoined?.kind !== 'fanout.joined') throw new Error('expected fanout.joined');
    expect(fanoutJoined.policy).toBe('aggregate-only');
    expect(fanoutJoined.branches_completed).toBe(2);
    expect(fanoutJoined.branches_failed).toBe(0);

    // Each branch produced a child run with its own fresh run_id.
    const branchChildRunIds: string[] = [];
    for (const ev of branchCompleted) {
      if (ev.kind !== 'fanout.branch_completed') continue;
      branchChildRunIds.push(ev.child_run_id as unknown as string);
    }
    expect(branchChildRunIds).toHaveLength(2);
    expect(new Set(branchChildRunIds).size).toBe(2); // distinct
    for (const id of branchChildRunIds) {
      expect(id).not.toBe(parentRunId as unknown as string);
    }

    // Each branch child has its own event log, with every event
    // carrying that branch's child_run_id and dispatch lifecycle
    // events firing — proof real recursion ran each branch.
    for (const branchChildRunId of branchChildRunIds) {
      const branchChildRoot = findChildRunRoot(runRootBase, branchChildRunId);
      const eventsRaw = readFileSync(join(branchChildRoot, 'events.ndjson'), 'utf8');
      const eventLines = eventsRaw.split('\n').filter((l) => l.length > 0);
      expect(eventLines.length).toBeGreaterThan(0);
      const kinds = new Set<string>();
      for (const line of eventLines) {
        const parsed = JSON.parse(line) as { run_id: string; kind: string };
        expect(parsed.run_id).toBe(branchChildRunId);
        expect(parsed.run_id).not.toBe(parentRunId as unknown as string);
        kinds.add(parsed.kind);
      }
      expect(kinds.has('dispatch.started')).toBe(true);
      expect(kinds.has('dispatch.completed')).toBe(true);
      expect(kinds.has('gate.evaluated')).toBe(true);

      // Each branch child's result.json was authored via the real
      // result-writer.
      const childResult = JSON.parse(
        readFileSync(join(branchChildRoot, 'artifacts', 'result.json'), 'utf8'),
      ) as { run_id: string; verdict: string; outcome: string };
      expect(childResult.run_id).toBe(branchChildRunId);
      expect(childResult.verdict).toBe('accept');
      expect(childResult.outcome).toBe('complete');
    }

    // The aggregate artifact was materialized at the parent's
    // declared path.
    const aggregatePath = join(parentRunRoot, 'artifacts', 'aggregate.json');
    const aggregate = JSON.parse(readFileSync(aggregatePath, 'utf8')) as {
      branches: ReadonlyArray<{ branch_id: string; admitted: boolean }>;
    };
    expect(aggregate.branches.map((b) => b.branch_id).sort()).toEqual(['a', 'b']);
  });
});

// Branch children's run-roots may live as siblings under runRootBase
// OR under a per-branch worktree directory provisioned by the
// worktreeRunner stub. Both tree shapes are valid; the test scans
// both to find the run-root for a known child run_id.
function findChildRunRoot(runRootBase: string, childRunId: string): string {
  for (const entry of readdirSync(runRootBase)) {
    if (entry === childRunId) return join(runRootBase, entry);
    // Worktree-style: branch dir contains the child run-root inside it.
    const candidate = join(runRootBase, entry, childRunId);
    try {
      readdirSync(candidate);
      return candidate;
    } catch {
      // Not a directory — try the next entry.
    }
  }
  // Fallback — walk one level deeper for any branch-specific layout.
  for (const entry of readdirSync(runRootBase)) {
    const sub = join(runRootBase, entry);
    try {
      for (const inner of readdirSync(sub)) {
        if (inner === childRunId) return join(sub, inner);
      }
    } catch {
      // Not a directory — skip.
    }
  }
  throw new Error(`child run-root for ${childRunId} not found under ${runRootBase}`);
}
