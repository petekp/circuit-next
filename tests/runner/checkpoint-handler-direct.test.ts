// Direct unit tests for the checkpoint step handler.
//
// The runner suites exercise checkpoint transitively (resume path,
// build-frame brief assembly), but the handler's own surface — the
// resolution lattice (waiting / failed / resolved) and each branch's
// event sequence + reason string — is not directly tested. This file
// invokes `runCheckpointStep` against a minimal in-memory
// `StepHandlerContext` so each handler-local branch is exercised in
// isolation.
//
// FU-T11 priority target #3 (per HANDOFF.md).

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { eventLogPath } from '../../src/runtime/event-writer.js';
import { runCheckpointStep } from '../../src/runtime/step-handlers/checkpoint.js';
import type { RunState, StepHandlerContext } from '../../src/runtime/step-handlers/types.js';
import type { Event } from '../../src/schemas/event.js';
import { RunId, type WorkflowId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import type { Rigor } from '../../src/schemas/rigor.js';
import { Workflow } from '../../src/schemas/workflow.js';

const WORKFLOW_ID = 'checkpoint-direct-test' as unknown as WorkflowId;
const RUN_ID = RunId.parse('66666666-6666-6666-6666-666666666666');

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode:
      'checkpoint handler emits the wrong event sequence on a known resolution-lattice path',
    acceptance_evidence:
      'each resolution branch (waiting / failed / resolved) emits the expected event sequence with the right reason',
    alternate_framing: 'unit test of the checkpoint step handler in isolation',
  };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

interface BuildWorkflowOpts {
  readonly safeDefaultChoice?: string;
  readonly safeAutonomousChoice?: string;
  // If set, drives a divergence between the policy choice ids and
  // gate.allow — used to force the post-resolution `selection ∉ allow`
  // throw. Default: gate.allow mirrors policy.choices ids.
  readonly choices?: readonly { readonly id: string }[];
  readonly gateAllow?: readonly string[];
}

function buildWorkflow(opts: BuildWorkflowOpts): Workflow {
  const choices = opts.choices ?? [{ id: 'continue' }];
  const gateAllow = opts.gateAllow ?? choices.map((c) => c.id);
  const policy: Record<string, unknown> = {
    prompt: 'Confirm the direct-handler checkpoint test fixture.',
    choices,
  };
  if (opts.safeDefaultChoice !== undefined) {
    policy.safe_default_choice = opts.safeDefaultChoice;
  }
  if (opts.safeAutonomousChoice !== undefined) {
    policy.safe_autonomous_choice = opts.safeAutonomousChoice;
  }
  return Workflow.parse({
    schema_version: '2',
    id: WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose: 'checkpoint handler direct-test fixture.',
    entry: { signals: { include: ['x'], exclude: [] }, intent_prefixes: ['x'] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'checkpoint-step',
        rigor: 'standard',
        description: 'checkpoint fixture',
      },
    ],
    phases: [{ id: 'frame-phase', title: 'Frame', canonical: 'frame', steps: ['checkpoint-step'] }],
    spine_policy: {
      mode: 'partial',
      omits: ['analyze', 'plan', 'act', 'verify', 'review', 'close'],
      rationale: 'narrow direct checkpoint handler test fixture',
    },
    steps: [
      {
        id: 'checkpoint-step',
        title: 'Checkpoint — direct handler test',
        protocol: 'checkpoint-direct@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'checkpoint',
        policy,
        writes: {
          request: 'artifacts/checkpoint.request.json',
          response: 'artifacts/checkpoint.response.json',
        },
        gate: {
          kind: 'checkpoint_selection',
          source: { kind: 'checkpoint_response', ref: 'response' },
          allow: gateAllow,
        },
      },
    ],
  });
}

interface BuildHarnessOpts {
  readonly rigor: Rigor;
  readonly safeDefaultChoice?: string;
  readonly safeAutonomousChoice?: string;
  readonly choices?: readonly { readonly id: string }[];
  readonly gateAllow?: readonly string[];
  readonly isResumedCheckpoint?: boolean;
  readonly resumeSelection?: string;
}

interface Harness {
  readonly events: Event[];
  readonly state: RunState;
  readonly ctx: StepHandlerContext & {
    readonly step: Workflow['steps'][number] & { kind: 'checkpoint' };
  };
}

function buildHarness(opts: BuildHarnessOpts, runRoot: string): Harness {
  const workflow = buildWorkflow({
    ...(opts.safeDefaultChoice === undefined ? {} : { safeDefaultChoice: opts.safeDefaultChoice }),
    ...(opts.safeAutonomousChoice === undefined
      ? {}
      : { safeAutonomousChoice: opts.safeAutonomousChoice }),
    ...(opts.choices === undefined ? {} : { choices: opts.choices }),
    ...(opts.gateAllow === undefined ? {} : { gateAllow: opts.gateAllow }),
  });
  const step = workflow.steps[0];
  if (step === undefined || step.kind !== 'checkpoint') {
    throw new Error('test fixture invariant: step[0] must be a checkpoint step');
  }
  const events: Event[] = [];
  const state: RunState = { events, sequence: 0, dispatchResults: [] };
  const now = deterministicNow(Date.UTC(2026, 3, 27, 0, 0, 0));
  const recordedAt = (): string => now().toISOString();
  const isResumedCheckpoint = opts.isResumedCheckpoint ?? false;
  const ctx: StepHandlerContext & {
    readonly step: Workflow['steps'][number] & { kind: 'checkpoint' };
  } = {
    runRoot,
    workflow,
    runId: RUN_ID,
    goal: 'direct checkpoint handler test goal',
    lane: lane(),
    rigor: opts.rigor,
    executionSelectionConfigLayers: [],
    dispatcher: {
      adapterName: 'agent',
      dispatch: async () => {
        throw new Error('dispatcher should not be invoked by these tests');
      },
    },
    synthesisWriter: () => {
      throw new Error('synthesisWriter should not be invoked by a checkpoint step');
    },
    now,
    recordedAt,
    state,
    push: (ev: Event) => {
      events.push({ ...ev, sequence: state.sequence });
      state.sequence += 1;
    },
    step,
    attempt: 1,
    isResumedCheckpoint,
    ...(isResumedCheckpoint && opts.resumeSelection !== undefined
      ? {
          resumeCheckpoint: {
            stepId: step.id as unknown as string,
            attempt: 1,
            selection: opts.resumeSelection,
          },
        }
      : {}),
    childRunner: async () => {
      throw new Error('childRunner should not be invoked by a checkpoint step');
    },
  };
  return { events, state, ctx };
}

// The waiting-rigor branch (deep / tournament) calls writeDerivedSnapshot,
// which reads events.ndjson from disk and reduces it. Direct tests don't
// run the bootstrap path, so we prime the log with a single
// run.bootstrapped event whenever a test exercises the waiting branch,
// and bump the in-memory sequence to match.
function primeBootstrap(harness: Harness, workflowId: WorkflowId): void {
  const bootstrap = {
    schema_version: 1,
    sequence: 0,
    recorded_at: new Date(Date.UTC(2026, 3, 26, 0, 0, 0)).toISOString(),
    run_id: RUN_ID as unknown as string,
    kind: 'run.bootstrapped',
    workflow_id: workflowId as unknown as string,
    rigor: 'deep',
    goal: 'direct checkpoint handler test goal',
    lane: harness.ctx.lane,
    manifest_hash: 'stub-manifest-hash',
  };
  writeFileSync(eventLogPath(harness.ctx.runRoot), `${JSON.stringify(bootstrap)}\n`);
  // Next push() should stamp sequence=1.
  harness.state.sequence = 1;
}

let runRoot: string;

beforeEach(() => {
  runRoot = mkdtempSync(join(tmpdir(), 'checkpoint-handler-direct-'));
});

afterEach(() => {
  rmSync(runRoot, { recursive: true, force: true });
});

describe('runCheckpointStep direct — resolution lattice', () => {
  it('returns waiting_checkpoint at deep rigor and emits checkpoint.requested but not gate.evaluated', async () => {
    const harness = buildHarness({ rigor: 'deep', safeDefaultChoice: 'continue' }, runRoot);
    primeBootstrap(harness, WORKFLOW_ID);

    const result = runCheckpointStep(harness.ctx);

    if (result.kind !== 'waiting_checkpoint') throw new Error('expected waiting_checkpoint');
    expect(result.checkpoint.stepId).toBe('checkpoint-step');
    expect(result.checkpoint.allowedChoices).toEqual(['continue']);
    expect(harness.events.some((e) => e.kind === 'checkpoint.requested')).toBe(true);
    expect(harness.events.find((e) => e.kind === 'gate.evaluated')).toBeUndefined();
    expect(harness.events.find((e) => e.kind === 'checkpoint.resolved')).toBeUndefined();
    expect(harness.events.find((e) => e.kind === 'step.aborted')).toBeUndefined();
  });

  it('returns waiting_checkpoint at tournament rigor', () => {
    const harness = buildHarness({ rigor: 'tournament', safeDefaultChoice: 'continue' }, runRoot);
    primeBootstrap(harness, WORKFLOW_ID);

    const result = runCheckpointStep(harness.ctx);

    if (result.kind !== 'waiting_checkpoint') throw new Error('expected waiting_checkpoint');
    expect(result.checkpoint.stepId).toBe('checkpoint-step');
  });

  it('aborts at standard rigor with a default-choice-required reason when policy.safe_default_choice is undefined', () => {
    const harness = buildHarness({ rigor: 'standard' }, runRoot);

    const result = runCheckpointStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(
      /checkpoint step 'checkpoint-step' cannot resolve standard rigor without a declared safe default choice/,
    );
    const gate = harness.events.find((e) => e.kind === 'gate.evaluated');
    if (gate?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated');
    expect(gate.outcome).toBe('fail');
    expect(gate.gate_kind).toBe('checkpoint_selection');
    expect(harness.events.some((e) => e.kind === 'step.aborted')).toBe(true);
    // checkpoint.resolved should NOT fire on a failed-resolution branch.
    expect(harness.events.find((e) => e.kind === 'checkpoint.resolved')).toBeUndefined();
  });

  it('aborts at autonomous rigor with an autonomous-choice-required reason when policy.safe_autonomous_choice is undefined', async () => {
    const harness = buildHarness({ rigor: 'autonomous', safeDefaultChoice: 'continue' }, runRoot);

    const result = runCheckpointStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(
      /checkpoint step 'checkpoint-step' cannot auto-resolve autonomous rigor without a declared safe autonomous choice/,
    );
  });

  it('returns advance at standard rigor with safe-default resolution source', async () => {
    const harness = buildHarness({ rigor: 'standard', safeDefaultChoice: 'continue' }, runRoot);

    const result = runCheckpointStep(harness.ctx);

    expect(result).toEqual({ kind: 'advance' });
    const resolved = harness.events.find((e) => e.kind === 'checkpoint.resolved');
    if (resolved?.kind !== 'checkpoint.resolved') throw new Error('expected checkpoint.resolved');
    expect(resolved.selection).toBe('continue');
    expect(resolved.resolution_source).toBe('safe-default');
    expect(resolved.auto_resolved).toBe(true);
    const gate = harness.events.find((e) => e.kind === 'gate.evaluated');
    if (gate?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated');
    expect(gate.outcome).toBe('pass');
  });

  it('returns advance at autonomous rigor with safe-autonomous resolution source', async () => {
    const harness = buildHarness(
      {
        rigor: 'autonomous',
        safeDefaultChoice: 'continue',
        safeAutonomousChoice: 'continue',
      },
      runRoot,
    );

    const result = runCheckpointStep(harness.ctx);

    expect(result).toEqual({ kind: 'advance' });
    const resolved = harness.events.find((e) => e.kind === 'checkpoint.resolved');
    if (resolved?.kind !== 'checkpoint.resolved') throw new Error('expected checkpoint.resolved');
    expect(resolved.resolution_source).toBe('safe-autonomous');
    expect(resolved.auto_resolved).toBe(true);
  });

  it('returns advance at lite rigor (treated like standard — uses safe_default_choice)', async () => {
    const harness = buildHarness({ rigor: 'lite', safeDefaultChoice: 'continue' }, runRoot);

    const result = runCheckpointStep(harness.ctx);

    expect(result).toEqual({ kind: 'advance' });
    const resolved = harness.events.find((e) => e.kind === 'checkpoint.resolved');
    if (resolved?.kind !== 'checkpoint.resolved') throw new Error('expected checkpoint.resolved');
    expect(resolved.resolution_source).toBe('safe-default');
  });
});

describe('runCheckpointStep direct — operator resume', () => {
  it('uses the operator selection (not the safe default) when isResumedCheckpoint is true', async () => {
    const harness = buildHarness(
      {
        rigor: 'deep',
        choices: [{ id: 'continue' }, { id: 'revise' }],
        gateAllow: ['continue', 'revise'],
        isResumedCheckpoint: true,
        resumeSelection: 'revise',
      },
      runRoot,
    );

    const result = runCheckpointStep(harness.ctx);

    expect(result).toEqual({ kind: 'advance' });
    const resolved = harness.events.find((e) => e.kind === 'checkpoint.resolved');
    if (resolved?.kind !== 'checkpoint.resolved') throw new Error('expected checkpoint.resolved');
    expect(resolved.selection).toBe('revise');
    expect(resolved.resolution_source).toBe('operator');
    expect(resolved.auto_resolved).toBe(false);
    // On resume, checkpoint.requested should NOT fire — the request was
    // emitted on the original (pre-resume) invocation.
    expect(harness.events.find((e) => e.kind === 'checkpoint.requested')).toBeUndefined();
  });

  it('falls back to the resolveCheckpoint lattice when isResumedCheckpoint is true but resumeCheckpoint is undefined', async () => {
    // Passes safeDefaultChoice so resolveCheckpoint succeeds at standard
    // rigor — the value of this case is proving that the handler does
    // NOT short-circuit to operator-resolution merely because the
    // resumed flag is set; both flag + state must be present.
    const harness = buildHarness(
      {
        rigor: 'standard',
        safeDefaultChoice: 'continue',
        isResumedCheckpoint: true,
      },
      runRoot,
    );

    const result = runCheckpointStep(harness.ctx);

    expect(result).toEqual({ kind: 'advance' });
    const resolved = harness.events.find((e) => e.kind === 'checkpoint.resolved');
    if (resolved?.kind !== 'checkpoint.resolved') throw new Error('expected checkpoint.resolved');
    expect(resolved.resolution_source).toBe('safe-default');
    // checkpoint.requested still skipped because isResumedCheckpoint is true.
    expect(harness.events.find((e) => e.kind === 'checkpoint.requested')).toBeUndefined();
  });
});

describe('runCheckpointStep direct — error paths caught by the catch block', () => {
  it('aborts when the resolved selection is not in step.gate.allow (caught throw)', async () => {
    // Ordinary z.parse() of the workflow rejects safe_default_choice
    // not in policy.choices, and rejects gate.allow that does not match
    // policy.choices. To force the post-resolution divergence the
    // handler guards against, we author a step where gate.allow
    // intentionally drops the only choice id at construction time. Skip
    // schema enforcement by constructing the step shape manually.
    const harness = buildHarness(
      {
        rigor: 'standard',
        safeDefaultChoice: 'continue',
      },
      runRoot,
    );
    // Mutate the step's gate.allow to exclude the resolved selection.
    // The handler's catch-block path treats a selection-not-in-gate.allow
    // mismatch as a thrown invariant.
    const step = harness.ctx.step;
    (step.gate as { allow: string[] }).allow = ['something-else'];

    const result = runCheckpointStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/checkpoint step 'checkpoint-step': checkpoint handling failed/);
    expect(result.reason).toMatch(/selected 'continue' but gate\.allow is \[something-else\]/);
    const gate = harness.events.find((e) => e.kind === 'gate.evaluated');
    if (gate?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated');
    expect(gate.outcome).toBe('fail');
    expect(harness.events.some((e) => e.kind === 'step.aborted')).toBe(true);
  });
});

describe('runCheckpointStep direct — event sequence invariants', () => {
  it('on safe-default success: checkpoint.requested → checkpoint.resolved → gate.evaluated/pass (no aborted, no artifact_written)', async () => {
    const harness = buildHarness({ rigor: 'standard', safeDefaultChoice: 'continue' }, runRoot);

    runCheckpointStep(harness.ctx);

    const kinds = harness.events.map((e) => e.kind);
    expect(kinds).toEqual(['checkpoint.requested', 'checkpoint.resolved', 'gate.evaluated']);
  });

  it('on failed-resolution: checkpoint.requested → gate.evaluated/fail → step.aborted (no checkpoint.resolved)', async () => {
    const harness = buildHarness({ rigor: 'standard' }, runRoot);

    runCheckpointStep(harness.ctx);

    const kinds = harness.events.map((e) => e.kind);
    expect(kinds).toEqual(['checkpoint.requested', 'gate.evaluated', 'step.aborted']);
  });

  it('on operator resume: checkpoint.resolved → gate.evaluated/pass (no checkpoint.requested)', async () => {
    const harness = buildHarness(
      {
        rigor: 'deep',
        isResumedCheckpoint: true,
        resumeSelection: 'continue',
      },
      runRoot,
    );

    runCheckpointStep(harness.ctx);

    const kinds = harness.events.map((e) => e.kind);
    expect(kinds).toEqual(['checkpoint.resolved', 'gate.evaluated']);
  });

  it('writes the request body verbatim to writes.request when not resumed', async () => {
    const harness = buildHarness({ rigor: 'standard', safeDefaultChoice: 'continue' }, runRoot);

    runCheckpointStep(harness.ctx);

    const requestText = readFileSync(join(runRoot, 'artifacts/checkpoint.request.json'), 'utf8');
    const parsed = JSON.parse(requestText);
    expect(parsed.step_id).toBe('checkpoint-step');
    expect(parsed.allowed_choices).toEqual(['continue']);
    expect(parsed.safe_default_choice).toBe('continue');
    expect(parsed.prompt).toMatch(/Confirm the direct-handler/);
  });
});
