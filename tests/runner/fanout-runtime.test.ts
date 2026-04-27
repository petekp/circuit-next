import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resultPath } from '../../src/runtime/result-writer.js';
import {
  type ChildWorkflowResolver,
  type DispatchFn,
  type WorkflowInvocation,
  type WorkflowRunResult,
  type WorkflowRunner,
  type WorktreeRunner,
  runWorkflow,
} from '../../src/runtime/runner.js';
import { RunId, type WorkflowId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { RunResult } from '../../src/schemas/result.js';
import { Snapshot } from '../../src/schemas/snapshot.js';
import { Workflow } from '../../src/schemas/workflow.js';

// Fanout runtime test. Verifies that a parent workflow declaring a
// `fanout` step:
//   - Resolves static and dynamic branches.
//   - Provisions a per-branch worktree via the injected runner.
//   - Runs each branch through the injected childRunner with isolated
//     RunIds and the worktree path as projectRoot.
//   - Emits fanout.{started,branch_started,branch_completed,joined}
//     events with the resolved branch_ids on fanout.started.
//   - Materializes the aggregate artifact at writes.aggregate.path.
//   - Honors the join policy (pick-winner, disjoint-merge, aggregate-only)
//     and the gate.evaluated outcome that follows.
//   - Cleans up worktrees in try/finally even when branches fail.

const PARENT_WORKFLOW_ID = 'parent-fanout' as unknown as WorkflowId;
const CHILD_WORKFLOW_ID = 'child-branch' as unknown as WorkflowId;

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode: 'fanout omits worktree cleanup or audit linkage',
    acceptance_evidence:
      'parent log carries fanout.started + per-branch fanout.branch_{started,completed} + fanout.joined; aggregate artifact materialized; worktrees provisioned + released',
    alternate_framing: 'unit test of the fanout handler in isolation',
  };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function unusedDispatcher(): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async () => {
      throw new Error('dispatcher should not run during fanout-only parent execution');
    },
  };
}

interface ParentWorkflowOpts {
  branches: 'static-two' | 'dynamic-from-source';
  policy: 'pick-winner' | 'disjoint-merge' | 'aggregate-only';
  admit?: readonly string[];
  concurrency?: { kind: 'unbounded' } | { kind: 'bounded'; max: number };
  on_child_failure?: 'abort-all' | 'continue-others';
}

function buildParentWorkflow(opts: ParentWorkflowOpts): Workflow {
  const admit = opts.admit ?? ['ok'];
  const branches =
    opts.branches === 'static-two'
      ? {
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
        }
      : {
          kind: 'dynamic',
          source_artifact: 'artifacts/source.json',
          items_path: 'items',
          template: {
            branch_id: '$item.id',
            workflow_ref: {
              workflow_id: CHILD_WORKFLOW_ID as unknown as string,
              entry_mode: 'default',
            },
            goal: '$item.goal',
            rigor: 'standard',
          },
        };
  const raw = {
    schema_version: '2',
    id: PARENT_WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose: 'fanout runtime test parent',
    entry: {
      signals: { include: ['fanout-test'], exclude: [] },
      intent_prefixes: ['fanout-test'],
    },
    entry_modes: [
      {
        name: 'fanout-test',
        start_at: 'fanout-step',
        rigor: 'standard',
        description: 'Default fanout entry.',
      },
    ],
    phases: [{ id: 'act-phase', title: 'Act', canonical: 'act', steps: ['fanout-step'] }],
    spine_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'narrow fanout runtime test.',
    },
    steps: [
      {
        id: 'fanout-step',
        title: 'Fanout — N parallel branches',
        protocol: 'fanout-protocol@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'fanout',
        branches,
        concurrency: opts.concurrency ?? { kind: 'bounded', max: 4 },
        on_child_failure: opts.on_child_failure ?? 'abort-all',
        writes: {
          branches_dir: 'artifacts/branches',
          aggregate: { path: 'artifacts/aggregate.json', schema: 'fanout-aggregate@v1' },
        },
        gate: {
          kind: 'fanout_aggregate',
          source: { kind: 'fanout_results', ref: 'aggregate' },
          join: { policy: opts.policy },
          verdicts: { admit },
        },
      },
    ],
  };
  return Workflow.parse(raw);
}

function buildChildWorkflow(): Workflow {
  const raw = {
    schema_version: '2',
    id: CHILD_WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose: 'fanout test child',
    entry: { signals: { include: ['child'], exclude: [] }, intent_prefixes: ['child'] },
    entry_modes: [
      { name: 'default', start_at: 'child-step', rigor: 'standard', description: 'Child entry.' },
    ],
    phases: [{ id: 'act-phase', title: 'Act', canonical: 'act', steps: ['child-step'] }],
    spine_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'narrow stub child for fanout test.',
    },
    steps: [
      {
        id: 'child-step',
        title: 'Child synthesis',
        protocol: 'child-synthesis@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'synthesis',
        writes: {
          artifact: { path: 'artifacts/child-synthesis.json', schema: 'child-synthesis@v1' },
        },
        gate: {
          kind: 'schema_sections',
          source: { kind: 'artifact', ref: 'artifact' },
          required: ['summary'],
        },
      },
    ],
  };
  return Workflow.parse(raw);
}

interface BranchVerdictPlan {
  // Map branch_id -> verdict to write into the child's result.json.
  // 'aborted' means the stub childRunner returns outcome='aborted' too.
  readonly verdicts: Record<string, string | 'aborted'>;
}

function makeStubChildRunner(plan: BranchVerdictPlan): WorkflowRunner {
  return async (inv: WorkflowInvocation): Promise<WorkflowRunResult> => {
    // Map by goal — branches differ by goal. For static fixtures we use
    // unique goals per branch; for dynamic fixtures the goal includes
    // the substituted $item.goal.
    const planEntry = Object.entries(plan.verdicts).find(
      ([branchId]) => inv.goal.includes(branchId) || inv.runRoot.includes(branchId),
    );
    const verdict: string | 'aborted' = planEntry?.[1] ?? 'ok';
    const outcome: 'complete' | 'aborted' = verdict === 'aborted' ? 'aborted' : 'complete';
    const childResultAbs = resultPath(inv.runRoot);
    mkdirSync(dirname(childResultAbs), { recursive: true });
    const body = RunResult.parse({
      schema_version: 1,
      run_id: inv.runId as unknown as string,
      workflow_id: inv.workflow.id as unknown as string,
      goal: inv.goal,
      outcome,
      summary: 'stub child result',
      closed_at: new Date(0).toISOString(),
      events_observed: 1,
      manifest_hash: 'stub-manifest-hash',
      ...(verdict === 'aborted' ? {} : { verdict }),
    });
    writeFileSync(childResultAbs, `${JSON.stringify(body, null, 2)}\n`);
    return {
      runRoot: inv.runRoot,
      result: body,
      snapshot: Snapshot.parse({
        schema_version: 1,
        run_id: body.run_id,
        workflow_id: body.workflow_id,
        rigor: 'standard',
        lane: inv.lane,
        status: outcome === 'complete' ? 'complete' : 'aborted',
        steps: [],
        events_consumed: 1,
        manifest_hash: 'stub-manifest-hash',
        updated_at: new Date(0).toISOString(),
      }),
      events: [],
      dispatchResults: [],
    };
  };
}

interface WorktreeStub {
  provisioned: Set<string>;
  released: Set<string>;
  changedFilesByPath: Map<string, readonly string[]>;
  runner: WorktreeRunner;
}

function makeStubWorktreeRunner(initial: Map<string, readonly string[]> = new Map()): WorktreeStub {
  const provisioned = new Set<string>();
  const released = new Set<string>();
  const changedFilesByPath = initial;
  const runner: WorktreeRunner = {
    add: ({ worktreePath }) => {
      provisioned.add(worktreePath);
      mkdirSync(worktreePath, { recursive: true });
    },
    remove: (worktreePath: string) => {
      released.add(worktreePath);
    },
    changedFiles: (worktreePath: string) => changedFilesByPath.get(worktreePath) ?? [],
  };
  return { provisioned, released, changedFilesByPath, runner };
}

function makeChildResolver(child: { workflow: Workflow; bytes: Buffer }): ChildWorkflowResolver {
  return () => child;
}

let runRootBase: string;
let projectRoot: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-fanout-'));
  projectRoot = mkdtempSync(join(tmpdir(), 'circuit-next-fanout-project-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('fanout runtime', () => {
  it('fans out to two static branches, picks the winner under pick-winner, and cleans up worktrees', async () => {
    const parent = buildParentWorkflow({
      branches: 'static-two',
      policy: 'pick-winner',
      admit: ['ok'],
    });
    const parentBytes = Buffer.from(JSON.stringify(parent));
    const child = buildChildWorkflow();
    const childBytes = Buffer.from(JSON.stringify(child));

    const stubChildRunner = makeStubChildRunner({
      verdicts: { 'branch-a': 'ok', 'branch-b': 'ok' },
    });
    const worktree = makeStubWorktreeRunner();
    const childResolver = makeChildResolver({ workflow: child, bytes: childBytes });

    const parentRunId = RunId.parse('22222222-2222-2222-2222-222222222221');
    const parentRunRoot = join(runRootBase, parentRunId as unknown as string);

    const outcome = await runWorkflow({
      runRoot: parentRunRoot,
      workflow: parent,
      workflowBytes: parentBytes,
      runId: parentRunId,
      goal: 'fanout pick-winner test',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 12, 0, 0)),
      dispatcher: unusedDispatcher(),
      projectRoot,
      childWorkflowResolver: childResolver,
      childRunner: stubChildRunner,
      worktreeRunner: worktree.runner,
    });

    expect(outcome.result.outcome).toBe('complete');

    const fanoutStarted = outcome.events.find((e) => e.kind === 'fanout.started');
    if (fanoutStarted?.kind !== 'fanout.started') throw new Error('expected fanout.started');
    expect(fanoutStarted.branch_ids).toEqual(['a', 'b']);
    expect(fanoutStarted.on_child_failure).toBe('abort-all');

    const fanoutJoined = outcome.events.find((e) => e.kind === 'fanout.joined');
    if (fanoutJoined?.kind !== 'fanout.joined') throw new Error('expected fanout.joined');
    expect(fanoutJoined.policy).toBe('pick-winner');
    expect(fanoutJoined.selected_branch_id).toBe('a');
    expect(fanoutJoined.aggregate_path).toBe('artifacts/aggregate.json');
    expect(fanoutJoined.branches_completed).toBe(2);
    expect(fanoutJoined.branches_failed).toBe(0);

    // Aggregate artifact materialized.
    const aggregateAbs = join(parentRunRoot, 'artifacts', 'aggregate.json');
    const aggregateBody = JSON.parse(readFileSync(aggregateAbs, 'utf8')) as {
      branch_count: number;
      winner_branch_id?: string;
      branches: ReadonlyArray<{ branch_id: string; admitted: boolean }>;
    };
    expect(aggregateBody.branch_count).toBe(2);
    expect(aggregateBody.winner_branch_id).toBe('a');

    // Worktrees provisioned and released for both branches.
    expect(worktree.provisioned.size).toBe(2);
    expect(worktree.released.size).toBe(2);
    for (const path of worktree.provisioned) {
      expect(worktree.released.has(path)).toBe(true);
    }
  });

  it('aggregate-only join admits all-complete + parseable branches', async () => {
    const parent = buildParentWorkflow({
      branches: 'static-two',
      policy: 'aggregate-only',
      admit: ['ok'],
    });
    const parentBytes = Buffer.from(JSON.stringify(parent));
    const child = buildChildWorkflow();
    const childBytes = Buffer.from(JSON.stringify(child));

    const stubChildRunner = makeStubChildRunner({
      verdicts: { 'branch-a': 'ok', 'branch-b': 'something-else' },
    });
    const worktree = makeStubWorktreeRunner();
    const childResolver = makeChildResolver({ workflow: child, bytes: childBytes });

    const parentRunId = RunId.parse('22222222-2222-2222-2222-222222222222');
    const parentRunRoot = join(runRootBase, parentRunId as unknown as string);

    const outcome = await runWorkflow({
      runRoot: parentRunRoot,
      workflow: parent,
      workflowBytes: parentBytes,
      runId: parentRunId,
      goal: 'fanout aggregate-only test',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 12, 30, 0)),
      dispatcher: unusedDispatcher(),
      projectRoot,
      childWorkflowResolver: childResolver,
      childRunner: stubChildRunner,
      worktreeRunner: worktree.runner,
    });

    // aggregate-only passes when both branches close cleanly with parseable bodies — verdicts irrelevant.
    expect(outcome.result.outcome).toBe('complete');
    const fanoutJoined = outcome.events.find((e) => e.kind === 'fanout.joined');
    if (fanoutJoined?.kind !== 'fanout.joined') throw new Error('expected fanout.joined');
    expect(fanoutJoined.policy).toBe('aggregate-only');
    expect(fanoutJoined.selected_branch_id).toBeUndefined();
  });

  it('disjoint-merge fails when two branches modify the same file', async () => {
    const parent = buildParentWorkflow({
      branches: 'static-two',
      policy: 'disjoint-merge',
      admit: ['ok'],
    });
    const parentBytes = Buffer.from(JSON.stringify(parent));
    const child = buildChildWorkflow();
    const childBytes = Buffer.from(JSON.stringify(child));

    const stubChildRunner = makeStubChildRunner({
      verdicts: { 'branch-a': 'ok', 'branch-b': 'ok' },
    });
    // Pre-set changedFiles to overlap between the two branches.
    const initialChangedFiles = new Map<string, readonly string[]>();
    const worktree = makeStubWorktreeRunner(initialChangedFiles);
    // Override the runner so we can record worktree paths AT add-time
    // and seed changedFiles for them.
    const originalAdd = worktree.runner.add;
    worktree.runner.add = (input) => {
      originalAdd(input);
      // Both branches "modified" the same file.
      worktree.changedFilesByPath.set(input.worktreePath, ['shared.txt']);
    };
    const childResolver = makeChildResolver({ workflow: child, bytes: childBytes });

    const parentRunId = RunId.parse('22222222-2222-2222-2222-222222222223');
    const parentRunRoot = join(runRootBase, parentRunId as unknown as string);

    const outcome = await runWorkflow({
      runRoot: parentRunRoot,
      workflow: parent,
      workflowBytes: parentBytes,
      runId: parentRunId,
      goal: 'fanout disjoint-merge collision test',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 13, 0, 0)),
      dispatcher: unusedDispatcher(),
      projectRoot,
      childWorkflowResolver: childResolver,
      childRunner: stubChildRunner,
      worktreeRunner: worktree.runner,
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toContain('disjoint-merge');
    expect(outcome.result.reason).toContain('shared.txt');
  });

  it('expands dynamic branches from a source artifact via $item.<key> templates', async () => {
    // For dynamic, the parent recipe needs a synthesis upstream that
    // materializes the source artifact before fanout reads it. The
    // simplest path: build a 2-step parent (synthesis → fanout) where
    // synthesis writes source.json via the injected synthesisWriter.
    const child = buildChildWorkflow();
    const childBytes = Buffer.from(JSON.stringify(child));

    const dynamicParent = Workflow.parse({
      schema_version: '2',
      id: PARENT_WORKFLOW_ID as unknown as string,
      version: '0.1.0',
      purpose: 'fanout dynamic test',
      entry: { signals: { include: ['fanout-dyn'], exclude: [] }, intent_prefixes: ['fanout-dyn'] },
      entry_modes: [
        { name: 'fanout-dyn', start_at: 'seed-source', rigor: 'standard', description: 'Dynamic.' },
      ],
      phases: [
        { id: 'plan-phase', title: 'Plan', canonical: 'plan', steps: ['seed-source'] },
        { id: 'act-phase', title: 'Act', canonical: 'act', steps: ['fanout-step'] },
      ],
      spine_policy: {
        mode: 'partial',
        omits: ['frame', 'analyze', 'verify', 'review', 'close'],
        rationale: 'narrow dynamic-fanout test.',
      },
      steps: [
        {
          id: 'seed-source',
          title: 'Seed source artifact for fanout expansion',
          protocol: 'seed-source@v1',
          reads: [],
          routes: { pass: 'fanout-step' },
          executor: 'orchestrator',
          kind: 'synthesis',
          writes: { artifact: { path: 'artifacts/source.json', schema: 'fanout-source@v1' } },
          gate: {
            kind: 'schema_sections',
            source: { kind: 'artifact', ref: 'artifact' },
            required: ['items'],
          },
        },
        {
          id: 'fanout-step',
          title: 'Fanout — dynamic branches',
          protocol: 'fanout-protocol@v1',
          reads: [],
          routes: { pass: '@complete' },
          executor: 'orchestrator',
          kind: 'fanout',
          branches: {
            kind: 'dynamic',
            source_artifact: 'artifacts/source.json',
            items_path: 'items',
            template: {
              branch_id: '$item.id',
              workflow_ref: {
                workflow_id: CHILD_WORKFLOW_ID as unknown as string,
                entry_mode: 'default',
              },
              goal: '$item.goal',
              rigor: 'standard',
            },
          },
          concurrency: { kind: 'bounded', max: 4 },
          on_child_failure: 'continue-others',
          writes: {
            branches_dir: 'artifacts/branches',
            aggregate: { path: 'artifacts/aggregate.json', schema: 'fanout-aggregate@v1' },
          },
          gate: {
            kind: 'fanout_aggregate',
            source: { kind: 'fanout_results', ref: 'aggregate' },
            join: { policy: 'aggregate-only' },
            verdicts: { admit: ['ok'] },
          },
        },
      ],
    });
    const dynamicParentBytes = Buffer.from(JSON.stringify(dynamicParent));

    const seedSourceArtifact = (input: {
      runRoot: string;
      step: { writes: { artifact: { path: string } } };
    }): void => {
      const dest = join(input.runRoot, input.step.writes.artifact.path);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(
        dest,
        `${JSON.stringify(
          {
            items: [
              { id: 'batch-1', goal: 'goal for batch-1' },
              { id: 'batch-2', goal: 'goal for batch-2' },
            ],
          },
          null,
          2,
        )}\n`,
      );
    };

    const stubChildRunner = makeStubChildRunner({
      verdicts: { 'batch-1': 'ok', 'batch-2': 'ok' },
    });
    const worktree = makeStubWorktreeRunner();
    const childResolver = makeChildResolver({ workflow: child, bytes: childBytes });

    const parentRunId = RunId.parse('22222222-2222-2222-2222-222222222224');
    const parentRunRoot = join(runRootBase, parentRunId as unknown as string);

    const outcome = await runWorkflow({
      runRoot: parentRunRoot,
      workflow: dynamicParent,
      workflowBytes: dynamicParentBytes,
      runId: parentRunId,
      goal: 'dynamic fanout test',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 14, 0, 0)),
      dispatcher: unusedDispatcher(),
      projectRoot,
      synthesisWriter: seedSourceArtifact as never,
      childWorkflowResolver: childResolver,
      childRunner: stubChildRunner,
      worktreeRunner: worktree.runner,
    });

    expect(outcome.result.outcome).toBe('complete');

    const fanoutStarted = outcome.events.find((e) => e.kind === 'fanout.started');
    if (fanoutStarted?.kind !== 'fanout.started') throw new Error('expected fanout.started');
    expect(fanoutStarted.branch_ids).toEqual(['batch-1', 'batch-2']);

    const fanoutJoined = outcome.events.find((e) => e.kind === 'fanout.joined');
    if (fanoutJoined?.kind !== 'fanout.joined') throw new Error('expected fanout.joined');
    expect(fanoutJoined.policy).toBe('aggregate-only');
    expect(fanoutJoined.branches_completed).toBe(2);
  });
});
