// Direct unit tests for the checkpoint step handler.
//
// The runner suites exercise checkpoint transitively (resume path,
// build-frame brief assembly), but the handler's own surface — the
// resolution lattice (waiting / failed / resolved) and each branch's
// trace_entry sequence + reason string — is not directly covered. This
// file invokes `runCheckpointStep` against a minimal in-memory
// `StepHandlerContext` so each handler-local branch is exercised in
// isolation.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runCheckpointStep } from '../../src/runtime/step-handlers/checkpoint.js';
import type { RunState, StepHandlerContext } from '../../src/runtime/step-handlers/types.js';
import { traceEntryLogPath } from '../../src/runtime/trace-writer.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import type { Depth } from '../../src/schemas/depth.js';
import { type CompiledFlowId, RunId } from '../../src/schemas/ids.js';
import type { TraceEntry } from '../../src/schemas/trace-entry.js';
import { expectStepWaitingCheckpoint } from '../helpers/failure-message.js';

const WORKFLOW_ID = 'checkpoint-direct-test' as unknown as CompiledFlowId;
const RUN_ID = RunId.parse('66666666-6666-6666-6666-666666666666');

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode:
      'checkpoint handler emits the wrong trace_entry sequence on a known resolution-lattice path',
    acceptance_evidence:
      'each resolution branch (waiting / failed / resolved) emits the expected trace_entry sequence with the right reason',
    alternate_framing: 'unit test of the checkpoint step handler in isolation',
  };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

interface BuildCompiledFlowOpts {
  readonly safeDefaultChoice?: string;
  readonly safeAutonomousChoice?: string;
  // If set, drives a divergence between the policy choice ids and
  // check.allow — used to force the post-resolution `selection ∉ allow`
  // throw. Default: check.allow mirrors policy.choices ids.
  readonly choices?: readonly { readonly id: string }[];
  readonly checkAllow?: readonly string[];
}

function buildCompiledFlow(opts: BuildCompiledFlowOpts): CompiledFlow {
  const choices = opts.choices ?? [{ id: 'continue' }];
  const checkAllow = opts.checkAllow ?? choices.map((c) => c.id);
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
  return CompiledFlow.parse({
    schema_version: '2',
    id: WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose: 'checkpoint handler direct-test fixture.',
    entry: { signals: { include: ['x'], exclude: [] }, intent_prefixes: ['x'] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'checkpoint-step',
        depth: 'standard',
        description: 'checkpoint fixture',
      },
    ],
    stages: [{ id: 'frame-stage', title: 'Frame', canonical: 'frame', steps: ['checkpoint-step'] }],
    stage_path_policy: {
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
          request: 'reports/checkpoint.request.json',
          response: 'reports/checkpoint.response.json',
        },
        check: {
          kind: 'checkpoint_selection',
          source: { kind: 'checkpoint_response', ref: 'response' },
          allow: checkAllow,
        },
      },
    ],
  });
}

interface BuildHarnessOpts {
  readonly depth: Depth;
  readonly safeDefaultChoice?: string;
  readonly safeAutonomousChoice?: string;
  readonly choices?: readonly { readonly id: string }[];
  readonly checkAllow?: readonly string[];
  readonly isResumedCheckpoint?: boolean;
  readonly resumeSelection?: string;
}

interface Harness {
  readonly trace_entries: TraceEntry[];
  readonly state: RunState;
  readonly ctx: StepHandlerContext & {
    readonly step: CompiledFlow['steps'][number] & { kind: 'checkpoint' };
  };
}

function buildHarness(opts: BuildHarnessOpts, runFolder: string): Harness {
  const flow = buildCompiledFlow({
    ...(opts.safeDefaultChoice === undefined ? {} : { safeDefaultChoice: opts.safeDefaultChoice }),
    ...(opts.safeAutonomousChoice === undefined
      ? {}
      : { safeAutonomousChoice: opts.safeAutonomousChoice }),
    ...(opts.choices === undefined ? {} : { choices: opts.choices }),
    ...(opts.checkAllow === undefined ? {} : { checkAllow: opts.checkAllow }),
  });
  const step = flow.steps[0];
  if (step === undefined || step.kind !== 'checkpoint') {
    throw new Error('test fixture invariant: step[0] must be a checkpoint step');
  }
  const trace_entries: TraceEntry[] = [];
  const state: RunState = { trace_entries, sequence: 0, relayResults: [] };
  const now = deterministicNow(Date.UTC(2026, 3, 27, 0, 0, 0));
  const recordedAt = (): string => now().toISOString();
  const isResumedCheckpoint = opts.isResumedCheckpoint ?? false;
  const ctx: StepHandlerContext & {
    readonly step: CompiledFlow['steps'][number] & { kind: 'checkpoint' };
  } = {
    runFolder,
    flow,
    runId: RUN_ID,
    goal: 'direct checkpoint handler test goal',
    change_kind: change_kind(),
    depth: opts.depth,
    executionSelectionConfigLayers: [],
    relayer: {
      connectorName: 'claude-code',
      relay: async () => {
        throw new Error('relayer should not be invoked by these tests');
      },
    },
    composeWriter: () => {
      throw new Error('composeWriter should not be invoked by a checkpoint step');
    },
    now,
    recordedAt,
    state,
    push: (ev: TraceEntry) => {
      trace_entries.push({ ...ev, sequence: state.sequence });
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
  return { trace_entries, state, ctx };
}

// The waiting-depth branch (deep / tournament) calls writeDerivedSnapshot,
// which reads trace.ndjson from disk and reduces it. Direct tests don't
// run the bootstrap path, so we prime the log with a single
// run.bootstrapped trace_entry whenever a test exercises the waiting branch,
// and bump the in-memory sequence to match.
function primeBootstrap(harness: Harness, flowId: CompiledFlowId): void {
  const bootstrap = {
    schema_version: 1,
    sequence: 0,
    recorded_at: new Date(Date.UTC(2026, 3, 26, 0, 0, 0)).toISOString(),
    run_id: RUN_ID as unknown as string,
    kind: 'run.bootstrapped',
    flow_id: flowId as unknown as string,
    depth: 'deep',
    goal: 'direct checkpoint handler test goal',
    change_kind: harness.ctx.change_kind,
    manifest_hash: 'stub-manifest-hash',
  };
  writeFileSync(traceEntryLogPath(harness.ctx.runFolder), `${JSON.stringify(bootstrap)}\n`);
  // Next push() should stamp sequence=1.
  harness.state.sequence = 1;
}

let runFolder: string;

beforeEach(() => {
  runFolder = mkdtempSync(join(tmpdir(), 'checkpoint-handler-direct-'));
});

afterEach(() => {
  rmSync(runFolder, { recursive: true, force: true });
});

describe('runCheckpointStep direct — resolution lattice', () => {
  it('returns waiting_checkpoint at deep depth and emits checkpoint.requested but not check.evaluated', async () => {
    const harness = buildHarness({ depth: 'deep', safeDefaultChoice: 'continue' }, runFolder);
    primeBootstrap(harness, WORKFLOW_ID);

    const result = runCheckpointStep(harness.ctx);

    expectStepWaitingCheckpoint(
      result,
      'checkpoint handler: deep / tournament depth pauses for operator selection — check.evaluated and checkpoint.resolved are deferred to the post-resume invocation',
    );
    expect(result.checkpoint.stepId).toBe('checkpoint-step');
    expect(result.checkpoint.allowedChoices).toEqual(['continue']);
    expect(harness.trace_entries.some((e) => e.kind === 'checkpoint.requested')).toBe(true);
    expect(harness.trace_entries.find((e) => e.kind === 'check.evaluated')).toBeUndefined();
    expect(harness.trace_entries.find((e) => e.kind === 'checkpoint.resolved')).toBeUndefined();
    expect(harness.trace_entries.find((e) => e.kind === 'step.aborted')).toBeUndefined();
  });

  it('returns waiting_checkpoint at tournament depth', () => {
    const harness = buildHarness({ depth: 'tournament', safeDefaultChoice: 'continue' }, runFolder);
    primeBootstrap(harness, WORKFLOW_ID);

    const result = runCheckpointStep(harness.ctx);

    if (result.kind !== 'waiting_checkpoint') throw new Error('expected waiting_checkpoint');
    expect(result.checkpoint.stepId).toBe('checkpoint-step');
  });

  it('aborts at standard depth with a default-choice-required reason when policy.safe_default_choice is undefined', () => {
    const harness = buildHarness({ depth: 'standard' }, runFolder);

    const result = runCheckpointStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(
      /checkpoint step 'checkpoint-step' cannot resolve standard depth without a declared safe default choice/,
    );
    const check = harness.trace_entries.find((e) => e.kind === 'check.evaluated');
    if (check?.kind !== 'check.evaluated') throw new Error('expected check.evaluated');
    expect(check.outcome).toBe('fail');
    expect(check.check_kind).toBe('checkpoint_selection');
    expect(harness.trace_entries.some((e) => e.kind === 'step.aborted')).toBe(true);
    // checkpoint.resolved should NOT fire on a failed-resolution branch.
    expect(harness.trace_entries.find((e) => e.kind === 'checkpoint.resolved')).toBeUndefined();
  });

  it('aborts at autonomous depth with an autonomous-choice-required reason when policy.safe_autonomous_choice is undefined', async () => {
    const harness = buildHarness({ depth: 'autonomous', safeDefaultChoice: 'continue' }, runFolder);

    const result = runCheckpointStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(
      /checkpoint step 'checkpoint-step' cannot auto-resolve autonomous depth without a declared safe autonomous choice/,
    );
  });

  it('returns advance at standard depth with safe-default resolution source', async () => {
    const harness = buildHarness({ depth: 'standard', safeDefaultChoice: 'continue' }, runFolder);

    const result = runCheckpointStep(harness.ctx);

    expect(result).toEqual({ kind: 'advance' });
    const resolved = harness.trace_entries.find((e) => e.kind === 'checkpoint.resolved');
    if (resolved?.kind !== 'checkpoint.resolved') throw new Error('expected checkpoint.resolved');
    expect(resolved.selection).toBe('continue');
    expect(resolved.resolution_source).toBe('safe-default');
    expect(resolved.auto_resolved).toBe(true);
    const check = harness.trace_entries.find((e) => e.kind === 'check.evaluated');
    if (check?.kind !== 'check.evaluated') throw new Error('expected check.evaluated');
    expect(check.outcome).toBe('pass');
  });

  it('returns advance at autonomous depth with safe-autonomous resolution source', async () => {
    const harness = buildHarness(
      {
        depth: 'autonomous',
        safeDefaultChoice: 'continue',
        safeAutonomousChoice: 'continue',
      },
      runFolder,
    );

    const result = runCheckpointStep(harness.ctx);

    expect(result).toEqual({ kind: 'advance' });
    const resolved = harness.trace_entries.find((e) => e.kind === 'checkpoint.resolved');
    if (resolved?.kind !== 'checkpoint.resolved') throw new Error('expected checkpoint.resolved');
    expect(resolved.resolution_source).toBe('safe-autonomous');
    expect(resolved.auto_resolved).toBe(true);
  });

  it('returns advance at lite depth (treated like standard — uses safe_default_choice)', async () => {
    const harness = buildHarness({ depth: 'lite', safeDefaultChoice: 'continue' }, runFolder);

    const result = runCheckpointStep(harness.ctx);

    expect(result).toEqual({ kind: 'advance' });
    const resolved = harness.trace_entries.find((e) => e.kind === 'checkpoint.resolved');
    if (resolved?.kind !== 'checkpoint.resolved') throw new Error('expected checkpoint.resolved');
    expect(resolved.resolution_source).toBe('safe-default');
  });
});

describe('runCheckpointStep direct — operator resume', () => {
  it('uses the operator selection (not the safe default) when isResumedCheckpoint is true', async () => {
    const harness = buildHarness(
      {
        depth: 'deep',
        choices: [{ id: 'continue' }, { id: 'revise' }],
        checkAllow: ['continue', 'revise'],
        isResumedCheckpoint: true,
        resumeSelection: 'revise',
      },
      runFolder,
    );

    const result = runCheckpointStep(harness.ctx);

    expect(result).toEqual({ kind: 'advance' });
    const resolved = harness.trace_entries.find((e) => e.kind === 'checkpoint.resolved');
    if (resolved?.kind !== 'checkpoint.resolved') throw new Error('expected checkpoint.resolved');
    expect(resolved.selection).toBe('revise');
    expect(resolved.resolution_source).toBe('operator');
    expect(resolved.auto_resolved).toBe(false);
    // On resume, checkpoint.requested should NOT fire — the request was
    // emitted on the original (pre-resume) invocation.
    expect(harness.trace_entries.find((e) => e.kind === 'checkpoint.requested')).toBeUndefined();
  });

  it('falls back to the resolveCheckpoint lattice when isResumedCheckpoint is true but resumeCheckpoint is undefined', async () => {
    // Passes safeDefaultChoice so resolveCheckpoint succeeds at standard
    // depth — the value of this case is proving that the handler does
    // NOT short-circuit to operator-resolution merely because the
    // resumed flag is set; both flag + state must be present.
    const harness = buildHarness(
      {
        depth: 'standard',
        safeDefaultChoice: 'continue',
        isResumedCheckpoint: true,
      },
      runFolder,
    );

    const result = runCheckpointStep(harness.ctx);

    expect(result).toEqual({ kind: 'advance' });
    const resolved = harness.trace_entries.find((e) => e.kind === 'checkpoint.resolved');
    if (resolved?.kind !== 'checkpoint.resolved') throw new Error('expected checkpoint.resolved');
    expect(resolved.resolution_source).toBe('safe-default');
    // checkpoint.requested still skipped because isResumedCheckpoint is true.
    expect(harness.trace_entries.find((e) => e.kind === 'checkpoint.requested')).toBeUndefined();
  });
});

describe('runCheckpointStep direct — error paths caught by the catch block', () => {
  it('aborts when the resolved selection is not in step.check.allow (caught throw)', async () => {
    // Ordinary z.parse() of the flow rejects safe_default_choice
    // not in policy.choices, and rejects check.allow that does not match
    // policy.choices. To force the post-resolution divergence the
    // handler guards against, we author a step where check.allow
    // intentionally drops the only choice id at construction time. Skip
    // schema enforcement by constructing the step shape manually.
    const harness = buildHarness(
      {
        depth: 'standard',
        safeDefaultChoice: 'continue',
      },
      runFolder,
    );
    // Mutate the step's check.allow to exclude the resolved selection.
    // The handler's catch-block path treats a selection-not-in-check.allow
    // mismatch as a thrown invariant.
    const step = harness.ctx.step;
    (step.check as { allow: string[] }).allow = ['something-else'];

    const result = runCheckpointStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/checkpoint step 'checkpoint-step': checkpoint handling failed/);
    expect(result.reason).toMatch(/selected 'continue' but check\.allow is \[something-else\]/);
    const check = harness.trace_entries.find((e) => e.kind === 'check.evaluated');
    if (check?.kind !== 'check.evaluated') throw new Error('expected check.evaluated');
    expect(check.outcome).toBe('fail');
    expect(harness.trace_entries.some((e) => e.kind === 'step.aborted')).toBe(true);
  });
});

describe('runCheckpointStep direct — trace_entry sequence invariants', () => {
  it('on safe-default success: checkpoint.requested → checkpoint.resolved → check.evaluated/pass (no aborted, no report_written)', async () => {
    const harness = buildHarness({ depth: 'standard', safeDefaultChoice: 'continue' }, runFolder);

    runCheckpointStep(harness.ctx);

    const kinds = harness.trace_entries.map((e) => e.kind);
    expect(kinds).toEqual(['checkpoint.requested', 'checkpoint.resolved', 'check.evaluated']);
  });

  it('on failed-resolution: checkpoint.requested → check.evaluated/fail → step.aborted (no checkpoint.resolved)', async () => {
    const harness = buildHarness({ depth: 'standard' }, runFolder);

    runCheckpointStep(harness.ctx);

    const kinds = harness.trace_entries.map((e) => e.kind);
    expect(kinds).toEqual(['checkpoint.requested', 'check.evaluated', 'step.aborted']);
  });

  it('on operator resume: checkpoint.resolved → check.evaluated/pass (no checkpoint.requested)', async () => {
    const harness = buildHarness(
      {
        depth: 'deep',
        isResumedCheckpoint: true,
        resumeSelection: 'continue',
      },
      runFolder,
    );

    runCheckpointStep(harness.ctx);

    const kinds = harness.trace_entries.map((e) => e.kind);
    expect(kinds).toEqual(['checkpoint.resolved', 'check.evaluated']);
  });

  it('writes the request body verbatim to writes.request when not resumed', async () => {
    const harness = buildHarness({ depth: 'standard', safeDefaultChoice: 'continue' }, runFolder);

    runCheckpointStep(harness.ctx);

    const requestText = readFileSync(join(runFolder, 'reports/checkpoint.request.json'), 'utf8');
    const parsed = JSON.parse(requestText);
    expect(parsed.step_id).toBe('checkpoint-step');
    expect(parsed.allowed_choices).toEqual(['continue']);
    expect(parsed.safe_default_choice).toBe('continue');
    expect(parsed.prompt).toMatch(/Confirm the direct-handler/);
  });
});
