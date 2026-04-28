// Direct unit tests for the verification step handler.
//
// The runner suites exercise verification transitively (real registered
// writers running real commands), but the handler's own surface — its
// two handler-local error branches and their event sequences — is not
// directly tested. This file invokes `runVerificationStep` against a
// minimal in-memory `StepHandlerContext` so each handler-local branch
// is exercised in isolation.
//
// Registry coupling: `findVerificationWriter` pulls from a closed
// global registry built at module load from workflowPackages. Direct
// tests cannot register a fake writer, so this file is scoped to the
// two error paths reachable WITHOUT a registered writer:
//   1. projectRoot is undefined (fires before the registry call).
//   2. step.writes.artifact.schema is not a registered schema (fires
//      at the registry call, returning undefined → handler throws).
// The spawn-subprocess + builder.buildResult branches stay covered
// through runner-level tests using real workflow packages.
//
// FU-T11 priority target #5 (per HANDOFF.md).

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { RunState, StepHandlerContext } from '../../src/runtime/step-handlers/types.js';
import { runVerificationStep } from '../../src/runtime/step-handlers/verification.js';
import type { Event } from '../../src/schemas/event.js';
import { RunId, type WorkflowId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { Workflow } from '../../src/schemas/workflow.js';

const WORKFLOW_ID = 'verification-direct-test' as unknown as WorkflowId;
const RUN_ID = RunId.parse('77777777-7777-7777-7777-777777777777');

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode:
      'verification handler emits the wrong event sequence on a known handler-local error path',
    acceptance_evidence:
      'each handler-local error path emits the expected gate.evaluated/fail + step.aborted pair with the right reason',
    alternate_framing: 'unit test of the verification step handler in isolation',
  };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

interface BuildWorkflowOpts {
  // Schema name for step.writes.artifact. Default is an intentionally
  // bogus schema that is never registered, exercising the
  // "unsupported artifact schema" branch.
  readonly artifactSchema?: string;
}

function buildWorkflow(opts: BuildWorkflowOpts = {}): Workflow {
  const artifactSchema = opts.artifactSchema ?? 'never-registered.verification@v1';
  return Workflow.parse({
    schema_version: '2',
    id: WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose: 'verification handler direct-test fixture.',
    entry: { signals: { include: ['x'], exclude: [] }, intent_prefixes: ['x'] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'verification-step',
        rigor: 'standard',
        description: 'verification fixture',
      },
    ],
    phases: [
      { id: 'verify-phase', title: 'Verify', canonical: 'verify', steps: ['verification-step'] },
    ],
    spine_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'act', 'review', 'close'],
      rationale: 'narrow direct verification handler test fixture',
    },
    steps: [
      {
        id: 'verification-step',
        title: 'Verify — direct handler test',
        protocol: 'verification-direct@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'verification',
        writes: {
          artifact: { path: 'artifacts/verification.json', schema: artifactSchema },
        },
        gate: {
          kind: 'schema_sections',
          source: { kind: 'artifact', ref: 'artifact' },
          required: ['overall_status'],
        },
      },
    ],
  });
}

interface BuildHarnessOpts {
  readonly artifactSchema?: string;
  // If set, the handler ctx.projectRoot is left undefined to force the
  // pre-registry "requires projectRoot" branch.
  readonly omitProjectRoot?: boolean;
  // Otherwise, projectRoot defaults to the runRoot itself (any existing
  // directory is enough to satisfy the unsupported-schema test, since
  // that branch errors before any cwd resolution happens).
  readonly projectRoot?: string;
}

interface Harness {
  readonly events: Event[];
  readonly state: RunState;
  readonly ctx: StepHandlerContext & {
    readonly step: Workflow['steps'][number] & { kind: 'verification' };
  };
}

function buildHarness(opts: BuildHarnessOpts, runRoot: string): Harness {
  const workflow = buildWorkflow({
    ...(opts.artifactSchema === undefined ? {} : { artifactSchema: opts.artifactSchema }),
  });
  const step = workflow.steps[0];
  if (step === undefined || step.kind !== 'verification') {
    throw new Error('test fixture invariant: step[0] must be a verification step');
  }
  const events: Event[] = [];
  const state: RunState = { events, sequence: 0, dispatchResults: [] };
  const now = deterministicNow(Date.UTC(2026, 3, 27, 0, 0, 0));
  const recordedAt = (): string => now().toISOString();
  const projectRoot = opts.omitProjectRoot === true ? undefined : (opts.projectRoot ?? runRoot);
  const ctx: StepHandlerContext & {
    readonly step: Workflow['steps'][number] & { kind: 'verification' };
  } = {
    runRoot,
    workflow,
    runId: RUN_ID,
    goal: 'direct verification handler test goal',
    lane: lane(),
    rigor: 'standard',
    executionSelectionConfigLayers: [],
    ...(projectRoot === undefined ? {} : { projectRoot }),
    dispatcher: {
      adapterName: 'agent',
      dispatch: async () => {
        throw new Error('dispatcher should not be invoked by these tests');
      },
    },
    synthesisWriter: () => {
      throw new Error('synthesisWriter should not be invoked by a verification step');
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
    isResumedCheckpoint: false,
    childRunner: async () => {
      throw new Error('childRunner should not be invoked by a verification step');
    },
  };
  return { events, state, ctx };
}

let runRoot: string;

beforeEach(() => {
  runRoot = mkdtempSync(join(tmpdir(), 'verification-handler-direct-'));
});

afterEach(() => {
  rmSync(runRoot, { recursive: true, force: true });
});

describe('runVerificationStep direct — handler-local error paths', () => {
  it('aborts with projectRoot-required reason when ctx.projectRoot is undefined', () => {
    const harness = buildHarness({ omitProjectRoot: true }, runRoot);

    const result = runVerificationStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/verification step 'verification-step': artifact writer failed/);
    expect(result.reason).toMatch(
      /verification step 'verification-step' requires WorkflowInvocation\.projectRoot/,
    );
    const gate = harness.events.find((e) => e.kind === 'gate.evaluated');
    if (gate?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated');
    expect(gate.outcome).toBe('fail');
    expect(gate.gate_kind).toBe('schema_sections');
    expect(harness.events.some((e) => e.kind === 'step.aborted')).toBe(true);
    // step.artifact_written must NOT fire on a pre-write failure path.
    expect(harness.events.find((e) => e.kind === 'step.artifact_written')).toBeUndefined();
  });

  it('aborts with unsupported-artifact-schema reason when the writer is not registered', () => {
    const harness = buildHarness(
      { artifactSchema: 'definitely-not-registered.verification@v9' },
      runRoot,
    );

    const result = runVerificationStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/verification step 'verification-step': artifact writer failed/);
    expect(result.reason).toMatch(
      /verification step 'verification-step' has unsupported artifact schema/,
    );
    const gate = harness.events.find((e) => e.kind === 'gate.evaluated');
    if (gate?.kind !== 'gate.evaluated') throw new Error('expected gate.evaluated');
    expect(gate.outcome).toBe('fail');
    expect(gate.gate_kind).toBe('schema_sections');
    expect(harness.events.some((e) => e.kind === 'step.aborted')).toBe(true);
    expect(harness.events.find((e) => e.kind === 'step.artifact_written')).toBeUndefined();
  });
});

describe('runVerificationStep direct — event sequence invariants', () => {
  it('on projectRoot-undefined: gate.evaluated/fail → step.aborted only (no step.artifact_written)', () => {
    const harness = buildHarness({ omitProjectRoot: true }, runRoot);

    runVerificationStep(harness.ctx);

    const kinds = harness.events.map((e) => e.kind);
    expect(kinds).toEqual(['gate.evaluated', 'step.aborted']);
  });

  it('on unsupported-artifact-schema: gate.evaluated/fail → step.aborted only', () => {
    const harness = buildHarness({ artifactSchema: 'not-a-real-schema@v1' }, runRoot);

    runVerificationStep(harness.ctx);

    const kinds = harness.events.map((e) => e.kind);
    expect(kinds).toEqual(['gate.evaluated', 'step.aborted']);
  });

  it('reasons on gate.evaluated and step.aborted are identical (transcript continuity)', () => {
    const harness = buildHarness({ omitProjectRoot: true }, runRoot);

    runVerificationStep(harness.ctx);

    const gate = harness.events.find((e) => e.kind === 'gate.evaluated');
    const aborted = harness.events.find((e) => e.kind === 'step.aborted');
    if (gate?.kind !== 'gate.evaluated' || aborted?.kind !== 'step.aborted') {
      throw new Error('expected both gate.evaluated and step.aborted');
    }
    expect(gate.reason).toBeDefined();
    expect(gate.reason).toBe(aborted.reason);
  });
});
