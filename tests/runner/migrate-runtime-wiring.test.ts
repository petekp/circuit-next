import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AgentDispatchInput } from '../../src/runtime/adapters/agent.js';
import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import { resultPath } from '../../src/runtime/result-writer.js';
import {
  type ChildWorkflowResolver,
  type DispatchFn,
  type WorkflowInvocation,
  type WorkflowRunResult,
  type WorkflowRunner,
  runWorkflow,
} from '../../src/runtime/runner.js';
import {
  MigrateBatch,
  MigrateBrief,
  MigrateCoexistence,
  MigrateInventory,
  MigrateResult,
  MigrateReview,
  MigrateVerification,
} from '../../src/schemas/artifacts/migrate.js';
import { RunId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { RunResult } from '../../src/schemas/result.js';
import { Snapshot } from '../../src/schemas/snapshot.js';
import { Workflow } from '../../src/schemas/workflow.js';

// Migrate runtime wiring test. Loads the live Migrate fixture compiled
// from specs/workflow-recipes/migrate.recipe.json, runs it end-to-end
// with a stub childRunner (so the batch sub-run does not descend into a
// real Build child) and a stub reviewer dispatcher, and asserts that
// every typed Migrate artifact is materialised correctly. Verification
// runs the brief's default `npm run check` command in REPO_ROOT, the
// same pattern as sweep-runtime-wiring.test.ts.
//
// What this test proves at the substrate level:
//   - The recipe → Workflow compile path supports `sub-run` execution
//     kind end-to-end (recipe schema → compiler → runtime handler).
//   - The sub-run gate admits the child's terminal verdict
//     (deriveTerminalVerdict in runner.ts populates RunResult.verdict
//     for a Build-like child whose review dispatch passed).
//   - The migrate close-writer reads brief + inventory + coexistence +
//     batch (RunResult shape) + verification + review and produces a
//     valid migrate.result@v1 with the canonical 6-pointer set.

const FIXTURE_PATH = resolve('.claude-plugin', 'skills', 'migrate', 'circuit.json');
const REPO_ROOT = resolve('.');

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
    failure_mode:
      'Migrate had typed artifacts and a sub-run handler but no live fixture proving the seven-canonical-phase spine through the runtime with a sub-run-per-batch executor',
    acceptance_evidence:
      'migrate-runtime-wiring loads the live Migrate fixture, runs frame → inventory → coexistence → sub-run-to-Build → verify → cutover-review → close, and parses all six typed Migrate artifacts plus the close result',
    alternate_framing:
      'extend the sub-run runtime test to cover Migrate — rejected because the substrate-proof claim is that Migrate composes from registered writers + the sub-run handler with no migrate-specific runner edits',
  };
}

const DEFAULT_REVIEW_BODY = JSON.stringify({
  verdict: 'cutover-approved',
  summary: 'Cutover review approved; no follow-ups',
  findings: [],
});

function reviewerDispatcherWith(reviewBody: string = DEFAULT_REVIEW_BODY): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async (input: AgentDispatchInput): Promise<DispatchResult> => {
      expect(input.prompt).toContain('Step: review-step');
      expect(input.prompt).toContain('Respond with a single raw JSON object');
      return {
        request_payload: input.prompt,
        receipt_id: 'stub-migrate-review',
        result_body: reviewBody,
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

// Stub child workflow — a single-step shape that exists only so the
// resolver can hand back a parseable Workflow object. The child runner
// stub never executes the child's loop, so the child's actual step
// catalog is unused by the test.
function buildStubChildWorkflow(): Workflow {
  return Workflow.parse({
    schema_version: '2',
    id: 'build',
    version: '0.1.0',
    purpose: 'stub Build child for migrate-runtime-wiring test',
    entry: { signals: { include: ['stub'], exclude: [] }, intent_prefixes: ['stub'] },
    entry_modes: [
      { name: 'default', start_at: 'stub-step', rigor: 'standard', description: 'stub' },
    ],
    phases: [{ id: 'act-phase', title: 'Act', canonical: 'act', steps: ['stub-step'] }],
    spine_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'stub child — single-step act phase only',
    },
    steps: [
      {
        id: 'stub-step',
        title: 'Stub child synthesis',
        protocol: 'stub-protocol@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'synthesis',
        writes: { artifact: { path: 'artifacts/stub.json', schema: 'stub.payload@v1' } },
        gate: {
          kind: 'schema_sections',
          source: { kind: 'artifact', ref: 'artifact' },
          required: ['summary'],
        },
      },
    ],
  });
}

function makeChildResolver(): ChildWorkflowResolver {
  const workflow = buildStubChildWorkflow();
  const bytes = Buffer.from(JSON.stringify(workflow));
  return () => ({ workflow, bytes });
}

// Stub childRunner that bypasses real Build child execution. Writes a
// synthetic child result.json carrying the verdict the migrate batch-
// step gate expects, then returns a minimal WorkflowRunResult so the
// sub-run handler's path-derivation, file-copy, and audit-event surface
// all execute against deterministic data.
function makeStubChildRunner(verdict: string): WorkflowRunner {
  return async (inv: WorkflowInvocation): Promise<WorkflowRunResult> => {
    const childResultAbs = resultPath(inv.runRoot);
    mkdirSync(dirname(childResultAbs), { recursive: true });
    const body = RunResult.parse({
      schema_version: 1,
      run_id: inv.runId as unknown as string,
      workflow_id: inv.workflow.id as unknown as string,
      goal: inv.goal,
      outcome: 'complete',
      summary: `stub ${inv.workflow.id as unknown as string} child result`,
      closed_at: new Date(0).toISOString(),
      events_observed: 1,
      manifest_hash: 'stub-manifest-hash',
      verdict,
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
        status: 'complete',
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

function eventLabel(event: { kind: string; step_id?: unknown }): string {
  return typeof event.step_id === 'string' ? `${event.kind}:${event.step_id}` : event.kind;
}

let runRootBase: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-migrate-runtime-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('Migrate runtime wiring', () => {
  it('declares the seven-canonical-phase spine with the standard four entry modes', () => {
    const { workflow } = loadFixture();
    expect(workflow.entry_modes.map((mode) => mode.name)).toEqual([
      'default',
      'lite',
      'deep',
      'autonomous',
    ]);
    expect(workflow.phases.map((phase) => phase.canonical)).toEqual([
      'frame',
      'analyze',
      'plan',
      'act',
      'verify',
      'review',
      'close',
    ]);
    const stepsById = new Map(workflow.steps.map((step) => [step.id as unknown as string, step]));
    const visited: string[] = [];
    let current: string | undefined = workflow.entry_modes[0]?.start_at as unknown as string;
    while (current !== undefined && !current.startsWith('@')) {
      visited.push(current);
      current = stepsById.get(current)?.routes.pass;
    }
    expect(visited).toEqual([
      'frame-step',
      'inventory-step',
      'coexistence-step',
      'batch-step',
      'verify-step',
      'review-step',
      'close-step',
    ]);
    const batchStep = stepsById.get('batch-step');
    expect(batchStep?.kind).toBe('sub-run');
  });

  it('runs the live Migrate fixture end-to-end with a stub Build child and writes all six typed artifacts plus the close result', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'complete');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('a1000000-0000-0000-0000-000000000001'),
      goal: 'Migrate the legacy auth middleware to the new identity stack',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 9, 0, 0)),
      dispatcher: reviewerDispatcherWith(),
      childWorkflowResolver: makeChildResolver(),
      childRunner: makeStubChildRunner('accept'),
      projectRoot: REPO_ROOT,
    });

    expect(outcome.result.outcome).toBe('complete');
    const labels = outcome.events.map(eventLabel);
    expect(labels).toContain('sub_run.started:batch-step');
    expect(labels).toContain('sub_run.completed:batch-step');
    expect(labels).toContain('dispatch.completed:review-step');

    const brief = MigrateBrief.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts/migrate/brief.json'), 'utf8')),
    );
    expect(brief.objective).toBe('Migrate the legacy auth middleware to the new identity stack');
    expect(brief.coexistence_appetite).toBe('short-window');

    const inventory = MigrateInventory.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts/migrate/inventory.json'), 'utf8')),
    );
    expect(inventory.batches).toHaveLength(1);
    expect(inventory.batches[0]?.id).toBe('batch-1');

    MigrateCoexistence.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts/migrate/coexistence.json'), 'utf8')),
    );

    const batch = MigrateBatch.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts/migrate/batch-result.json'), 'utf8')),
    );
    expect(batch.outcome).toBe('complete');
    expect(batch.verdict).toBe('accept');

    const verification = MigrateVerification.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts/migrate/verification.json'), 'utf8')),
    );
    expect(verification.overall_status).toBe('passed');
    expect(verification.commands[0]?.argv).toEqual(['npm', 'run', 'check']);

    const review = MigrateReview.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts/migrate/review.json'), 'utf8')),
    );
    expect(review.verdict).toBe('cutover-approved');

    const result = MigrateResult.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts/migrate-result.json'), 'utf8')),
    );
    expect(result.outcome).toBe('complete');
    expect(result.verification_status).toBe('passed');
    expect(result.review_verdict).toBe('cutover-approved');
    expect(result.batch_count).toBe(1);
    expect(result.artifact_pointers.map((p) => p.artifact_id)).toEqual([
      'migrate.brief',
      'migrate.inventory',
      'migrate.coexistence',
      'migrate.batch',
      'migrate.verification',
      'migrate.review',
    ]);
  }, 180_000);

  it('marks outcome=cutover-deferred when the cutover review returns cutover-with-followups', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'cutover-deferred');

    const reviewBody = JSON.stringify({
      verdict: 'cutover-with-followups',
      summary: 'Cutover passes verification but two follow-ups should land before sunset.',
      findings: [
        {
          severity: 'low',
          text: 'Open follow-up: rename the deprecated config key once the old reader is gone.',
          file_refs: [],
        },
      ],
    });

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('a1000000-0000-0000-0000-000000000002'),
      goal: 'Migrate the search adapter from the legacy provider to the new SDK',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 10, 0, 0)),
      dispatcher: reviewerDispatcherWith(reviewBody),
      childWorkflowResolver: makeChildResolver(),
      childRunner: makeStubChildRunner('accept-with-fixes'),
      projectRoot: REPO_ROOT,
    });

    expect(outcome.result.outcome).toBe('complete');
    const result = MigrateResult.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts/migrate-result.json'), 'utf8')),
    );
    expect(result.outcome).toBe('cutover-deferred');
    expect(result.review_verdict).toBe('cutover-with-followups');
  }, 180_000);

  it('aborts with outcome=aborted when the child Build sub-run returns a verdict outside gate.pass', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'gate-rejected');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('a1000000-0000-0000-0000-000000000003'),
      goal: 'Migrate the storage layer to the new persistence engine',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 11, 0, 0)),
      dispatcher: reviewerDispatcherWith(),
      childWorkflowResolver: makeChildResolver(),
      childRunner: makeStubChildRunner('reject'),
      projectRoot: REPO_ROOT,
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toContain('reject');
    const labels = outcome.events.map(eventLabel);
    expect(labels).toContain('sub_run.completed:batch-step');
    expect(labels).toContain('step.aborted:batch-step');
  });
});
