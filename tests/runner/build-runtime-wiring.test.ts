import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AgentDispatchInput } from '../../src/runtime/adapters/agent.js';
import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import { type DispatchFn, runDogfood } from '../../src/runtime/runner.js';
import {
  BuildImplementation,
  BuildResult,
  BuildReview,
  BuildVerification,
} from '../../src/schemas/artifacts/build.js';
import { RunId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { Workflow } from '../../src/schemas/workflow.js';

const FIXTURE_PATH = resolve('.claude-plugin', 'skills', 'build', 'circuit.json');
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
      'Build had typed artifacts but no live fixture proving implementation and review dispatch through the runtime',
    acceptance_evidence:
      'build-runtime-wiring runs the live Build fixture with stubbed worker dispatch and parses implementation, verification, review, and close artifacts',
    alternate_framing:
      'add entry-mode routing first — rejected because the dispatch path is the smaller blocker for a real Build spine',
  };
}

function dispatcherWith(
  options: {
    implementationBody?: string;
    reviewBody?: string;
  } = {},
): DispatchFn {
  const implementationBody =
    options.implementationBody ??
    JSON.stringify({
      verdict: 'accept',
      summary: 'Implemented the requested change',
      changed_files: ['src/example.ts'],
      evidence: ['Stub implementation dispatch completed'],
    });
  const reviewBody =
    options.reviewBody ??
    JSON.stringify({
      verdict: 'accept',
      summary: 'No blocking issue found',
      findings: [],
    });

  return {
    adapterName: 'agent',
    dispatch: async (input: AgentDispatchInput): Promise<DispatchResult> => {
      const isAct = input.prompt.includes('Step: act-step');
      const isReview = input.prompt.includes('Step: review-step');
      expect(isAct || isReview).toBe(true);
      expect(input.prompt).toContain('Context (from reads):');
      expect(input.prompt).toContain('Respond with a single raw JSON object');
      return {
        request_payload: input.prompt,
        receipt_id: isAct ? 'stub-build-act' : 'stub-build-review',
        result_body: isAct ? implementationBody : reviewBody,
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

function eventLabel(event: { kind: string; step_id?: unknown }): string {
  return typeof event.step_id === 'string' ? `${event.kind}:${event.step_id}` : event.kind;
}

function eventByKind<T extends { kind: string }>(
  events: readonly T[],
  kind: string,
): T | undefined {
  return events.find((event) => event.kind === kind);
}

let runRootBase: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-build-runtime-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('Build runtime wiring', () => {
  it('runs the live Build fixture through checkpoint, implementation dispatch, verification, review dispatch, and close', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'complete');

    const outcome = await runDogfood({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('b2000000-0000-0000-0000-000000000000'),
      goal: 'Add a tiny Build feature',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 8, 0, 0)),
      dispatcher: dispatcherWith(),
      projectRoot: REPO_ROOT,
    });

    expect(outcome.result.outcome).toBe('complete');
    expect(outcome.events.map(eventLabel)).toContain('checkpoint.resolved:frame-step');
    expect(outcome.events.map(eventLabel)).toContain('dispatch.completed:act-step');
    expect(outcome.events.map(eventLabel)).toContain('dispatch.completed:review-step');

    const implementation = BuildImplementation.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts/build/implementation.json'), 'utf8')),
    );
    expect(implementation.verdict).toBe('accept');

    const verification = BuildVerification.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts/build/verification.json'), 'utf8')),
    );
    expect(verification.overall_status).toBe('passed');
    expect(verification.commands[0]?.argv).toEqual(['npm', 'run', 'check']);

    const review = BuildReview.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts/build/review.json'), 'utf8')),
    );
    expect(review.verdict).toBe('accept');

    const result = BuildResult.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts/build-result.json'), 'utf8')),
    );
    expect(result.outcome).toBe('complete');
    expect(result.review_verdict).toBe('accept');
  });

  it('aborts when implementation dispatch passes the verdict gate but fails build.implementation@v1 parsing', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'bad-implementation');

    const outcome = await runDogfood({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('b2000000-0000-0000-0000-000000000001'),
      goal: 'Reject malformed implementation artifact',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 8, 10, 0)),
      dispatcher: dispatcherWith({
        implementationBody: JSON.stringify({
          verdict: 'accept',
          summary: 'Missing evidence',
          changed_files: ['src/example.ts'],
        }),
      }),
      projectRoot: REPO_ROOT,
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toMatch(/build\.implementation@v1/);
    expect(outcome.result.reason).toMatch(/evidence/);
    expect(existsSync(join(runRoot, 'artifacts/build/implementation.json'))).toBe(false);
    expect(existsSync(join(runRoot, 'artifacts/dispatch/build-act.result.json'))).toBe(true);
  });

  it('aborts review rejection before writing the canonical Build review artifact', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'review-reject');

    const outcome = await runDogfood({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('b2000000-0000-0000-0000-000000000002'),
      goal: 'Reject a blocking Build review',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 8, 20, 0)),
      dispatcher: dispatcherWith({
        reviewBody: JSON.stringify({
          verdict: 'reject',
          summary: 'Blocking issue found',
          findings: [
            {
              severity: 'high',
              text: 'The implementation does not satisfy the requested goal',
              file_refs: ['src/example.ts:1'],
            },
          ],
        }),
      }),
      projectRoot: REPO_ROOT,
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toMatch(/adapter declared verdict 'reject'/);
    expect(existsSync(join(runRoot, 'artifacts/build/review.json'))).toBe(false);
    expect(existsSync(join(runRoot, 'artifacts/dispatch/build-review.result.json'))).toBe(true);
  });

  it('aborts accept-with-fixes without findings before writing the canonical Build review artifact', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'review-empty-fixes');

    const outcome = await runDogfood({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('b2000000-0000-0000-0000-000000000003'),
      goal: 'Reject a non-actionable Build review',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 8, 30, 0)),
      dispatcher: dispatcherWith({
        reviewBody: JSON.stringify({
          verdict: 'accept-with-fixes',
          summary: 'Fixes needed but omitted',
          findings: [],
        }),
      }),
      projectRoot: REPO_ROOT,
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toMatch(/build\.review@v1/);
    expect(outcome.result.reason).toMatch(/findings/);
    expect(existsSync(join(runRoot, 'artifacts/build/review.json'))).toBe(false);
    expect(existsSync(join(runRoot, 'artifacts/dispatch/build-review.result.json'))).toBe(true);
  });

  it('declares default, lite, deep, and autonomous entry modes, and lite reaches Review by the pass route', () => {
    const { workflow } = loadFixture();
    expect(workflow.entry_modes.map((mode) => mode.name)).toEqual([
      'default',
      'lite',
      'deep',
      'autonomous',
    ]);
    expect(workflow.entry_modes.map((mode) => mode.rigor)).toEqual([
      'standard',
      'lite',
      'deep',
      'autonomous',
    ]);

    const lite = workflow.entry_modes.find((mode) => mode.name === 'lite');
    if (lite === undefined) throw new Error('expected lite entry mode');
    const stepsById = new Map(workflow.steps.map((step) => [step.id as unknown as string, step]));
    const visited: string[] = [];
    let current: string | undefined = lite.start_at as unknown as string;
    while (current !== undefined && !current.startsWith('@')) {
      visited.push(current);
      current = stepsById.get(current)?.routes.pass;
    }
    expect(visited).toEqual([
      'frame-step',
      'plan-step',
      'act-step',
      'verify-step',
      'review-step',
      'close-step',
    ]);
  });

  it('uses the selected lite entry mode as the run rigor when no explicit rigor is supplied', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'lite-entry-mode');
    const dispatchInputs: AgentDispatchInput[] = [];
    const dispatcher = dispatcherWith();

    const outcome = await runDogfood({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('b2000000-0000-0000-0000-000000000004'),
      goal: 'Add a tiny Build feature in lite mode',
      entryModeName: 'lite',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 8, 40, 0)),
      dispatcher: {
        adapterName: dispatcher.adapterName,
        dispatch: async (input) => {
          dispatchInputs.push(input);
          return dispatcher.dispatch(input);
        },
      },
      projectRoot: REPO_ROOT,
    });

    const bootstrap = eventByKind(outcome.events, 'run.bootstrapped');
    const checkpoint = outcome.events.find(
      (event) =>
        event.kind === 'checkpoint.resolved' &&
        eventLabel(event) === 'checkpoint.resolved:frame-step',
    );
    expect(outcome.result.outcome).toBe('complete');
    expect(bootstrap).toMatchObject({ rigor: 'lite' });
    expect(checkpoint).toMatchObject({
      selection: 'continue',
      resolution_source: 'safe-default',
    });
    expect(dispatchInputs[0]?.resolvedSelection).toMatchObject({ rigor: 'lite' });
    expect(outcome.events.map(eventLabel)).toContain('dispatch.completed:review-step');
  });

  it('uses deep entry mode to pause at the operator checkpoint when no explicit rigor is supplied', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'deep-entry-mode');

    const outcome = await runDogfood({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('b2000000-0000-0000-0000-000000000005'),
      goal: 'Add a tiny Build feature in deep mode',
      entryModeName: 'deep',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 8, 50, 0)),
      dispatcher: dispatcherWith(),
      projectRoot: REPO_ROOT,
    });

    const bootstrap = eventByKind(outcome.events, 'run.bootstrapped');
    expect(outcome.result.outcome).toBe('checkpoint_waiting');
    expect(bootstrap).toMatchObject({ rigor: 'deep' });
    expect(outcome.events.map(eventLabel)).not.toContain('run.closed');
    expect(existsSync(join(runRoot, 'artifacts/result.json'))).toBe(false);
  });

  it('lets an explicit rigor override the selected entry mode default', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'entry-mode-rigor-override');
    const dispatchInputs: AgentDispatchInput[] = [];
    const dispatcher = dispatcherWith();

    const outcome = await runDogfood({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('b2000000-0000-0000-0000-000000000006'),
      goal: 'Add a tiny Build feature with an explicit standard override',
      entryModeName: 'deep',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 9, 0, 0)),
      dispatcher: {
        adapterName: dispatcher.adapterName,
        dispatch: async (input) => {
          dispatchInputs.push(input);
          return dispatcher.dispatch(input);
        },
      },
      projectRoot: REPO_ROOT,
    });

    const bootstrap = eventByKind(outcome.events, 'run.bootstrapped');
    expect(outcome.result.outcome).toBe('complete');
    expect(bootstrap).toMatchObject({ rigor: 'standard' });
    expect(dispatchInputs[0]?.resolvedSelection).toMatchObject({ rigor: 'standard' });
  });

  it('uses explicit autonomous rigor over the default entry mode for checkpoint policy', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'default-entry-autonomous-override');
    const dispatchInputs: AgentDispatchInput[] = [];
    const dispatcher = dispatcherWith();

    const outcome = await runDogfood({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('b2000000-0000-0000-0000-000000000009'),
      goal: 'Add a tiny Build feature with explicit autonomous rigor',
      entryModeName: 'default',
      rigor: 'autonomous',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 9, 5, 0)),
      dispatcher: {
        adapterName: dispatcher.adapterName,
        dispatch: async (input) => {
          dispatchInputs.push(input);
          return dispatcher.dispatch(input);
        },
      },
      projectRoot: REPO_ROOT,
    });

    const bootstrap = eventByKind(outcome.events, 'run.bootstrapped');
    const checkpoint = outcome.events.find(
      (event) =>
        event.kind === 'checkpoint.resolved' &&
        eventLabel(event) === 'checkpoint.resolved:frame-step',
    );
    expect(outcome.result.outcome).toBe('complete');
    expect(bootstrap).toMatchObject({ rigor: 'autonomous' });
    expect(checkpoint).toMatchObject({
      selection: 'continue',
      resolution_source: 'safe-autonomous',
    });
    expect(dispatchInputs[0]?.resolvedSelection).toMatchObject({ rigor: 'autonomous' });
  });

  it('uses autonomous entry mode to take the declared safe autonomous checkpoint choice', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'autonomous-entry-mode');

    const outcome = await runDogfood({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('b2000000-0000-0000-0000-000000000007'),
      goal: 'Add a tiny Build feature in autonomous mode',
      entryModeName: 'autonomous',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 9, 10, 0)),
      dispatcher: dispatcherWith(),
      projectRoot: REPO_ROOT,
    });

    const bootstrap = eventByKind(outcome.events, 'run.bootstrapped');
    const checkpoint = outcome.events.find(
      (event) =>
        event.kind === 'checkpoint.resolved' &&
        eventLabel(event) === 'checkpoint.resolved:frame-step',
    );
    expect(outcome.result.outcome).toBe('complete');
    expect(bootstrap).toMatchObject({ rigor: 'autonomous' });
    expect(checkpoint).toMatchObject({
      selection: 'continue',
      resolution_source: 'safe-autonomous',
    });
  });

  it('rejects an unknown entry mode before bootstrapping a run root', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'unknown-entry-mode');

    await expect(
      runDogfood({
        runRoot,
        workflow,
        workflowBytes: bytes,
        runId: RunId.parse('b2000000-0000-0000-0000-000000000008'),
        goal: 'Try a missing entry mode',
        entryModeName: 'missing',
        lane: lane(),
        now: deterministicNow(Date.UTC(2026, 3, 25, 9, 20, 0)),
        dispatcher: dispatcherWith(),
        projectRoot: REPO_ROOT,
      }),
    ).rejects.toThrow(/entry_mode named 'missing'/);
    expect(existsSync(runRoot)).toBe(false);
  });
});
