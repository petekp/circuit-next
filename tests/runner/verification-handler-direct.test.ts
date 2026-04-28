// Direct unit tests for the verification step handler.
//
// The runner suites exercise verification transitively (real registered
// writers running real commands), but the handler's own surface — its
// two handler-local error branches and their trace_entry sequences — is not
// directly tested. This file invokes `runVerificationStep` against a
// minimal in-memory `StepHandlerContext` so each handler-local branch
// is exercised in isolation.
//
// Registry coupling: `findVerificationWriter` pulls from a closed
// global registry built at module load from flowPackages. Direct
// tests cannot register a fake writer, so this file is scoped to the
// two error paths reachable WITHOUT a registered writer:
//   1. projectRoot is undefined (fires before the registry call).
//   2. step.writes.report.schema is not a registered schema (fires
//      at the registry call, returning undefined → handler throws).
// The spawn-subprocess + builder.buildResult branches stay covered
// through runner-level tests using real flow packages.
//
// FU-T11 priority target #5 (per HANDOFF.md).

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { RunState, StepHandlerContext } from '../../src/runtime/step-handlers/types.js';
import { runVerificationStep } from '../../src/runtime/step-handlers/verification.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { type CompiledFlowId, RunId } from '../../src/schemas/ids.js';
import type { TraceEntry } from '../../src/schemas/trace-entry.js';

const WORKFLOW_ID = 'verification-direct-test' as unknown as CompiledFlowId;
const RUN_ID = RunId.parse('77777777-7777-7777-7777-777777777777');

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode:
      'verification handler emits the wrong trace_entry sequence on a known handler-local error path',
    acceptance_evidence:
      'each handler-local error path emits the expected check.evaluated/fail + step.aborted pair with the right reason',
    alternate_framing: 'unit test of the verification step handler in isolation',
  };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

interface BuildCompiledFlowOpts {
  // Schema name for step.writes.report. Default is an intentionally
  // bogus schema that is never registered, exercising the
  // "unsupported report schema" branch.
  readonly reportSchema?: string;
}

function buildCompiledFlow(opts: BuildCompiledFlowOpts = {}): CompiledFlow {
  const reportSchema = opts.reportSchema ?? 'never-registered.verification@v1';
  return CompiledFlow.parse({
    schema_version: '2',
    id: WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose: 'verification handler direct-test fixture.',
    entry: { signals: { include: ['x'], exclude: [] }, intent_prefixes: ['x'] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'verification-step',
        depth: 'standard',
        description: 'verification fixture',
      },
    ],
    stages: [
      { id: 'verify-stage', title: 'Verify', canonical: 'verify', steps: ['verification-step'] },
    ],
    stage_path_policy: {
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
          report: { path: 'reports/verification.json', schema: reportSchema },
        },
        check: {
          kind: 'schema_sections',
          source: { kind: 'report', ref: 'report' },
          required: ['overall_status'],
        },
      },
    ],
  });
}

interface BuildHarnessOpts {
  readonly reportSchema?: string;
  // If set, the handler ctx.projectRoot is left undefined to force the
  // pre-registry "requires projectRoot" branch.
  readonly omitProjectRoot?: boolean;
  // Otherwise, projectRoot defaults to the runFolder itself (any existing
  // directory is enough to satisfy the unsupported-schema test, since
  // that branch errors before any cwd resolution happens).
  readonly projectRoot?: string;
}

interface Harness {
  readonly trace_entrys: TraceEntry[];
  readonly state: RunState;
  readonly ctx: StepHandlerContext & {
    readonly step: CompiledFlow['steps'][number] & { kind: 'verification' };
  };
}

function buildHarness(opts: BuildHarnessOpts, runFolder: string): Harness {
  const flow = buildCompiledFlow({
    ...(opts.reportSchema === undefined ? {} : { reportSchema: opts.reportSchema }),
  });
  const step = flow.steps[0];
  if (step === undefined || step.kind !== 'verification') {
    throw new Error('test fixture invariant: step[0] must be a verification step');
  }
  const trace_entrys: TraceEntry[] = [];
  const state: RunState = { trace_entrys, sequence: 0, relayResults: [] };
  const now = deterministicNow(Date.UTC(2026, 3, 27, 0, 0, 0));
  const recordedAt = (): string => now().toISOString();
  const projectRoot = opts.omitProjectRoot === true ? undefined : (opts.projectRoot ?? runFolder);
  const ctx: StepHandlerContext & {
    readonly step: CompiledFlow['steps'][number] & { kind: 'verification' };
  } = {
    runFolder,
    flow,
    runId: RUN_ID,
    goal: 'direct verification handler test goal',
    change_kind: change_kind(),
    depth: 'standard',
    executionSelectionConfigLayers: [],
    ...(projectRoot === undefined ? {} : { projectRoot }),
    relayer: {
      connectorName: 'agent',
      relay: async () => {
        throw new Error('relayer should not be invoked by these tests');
      },
    },
    composeWriter: () => {
      throw new Error('composeWriter should not be invoked by a verification step');
    },
    now,
    recordedAt,
    state,
    push: (ev: TraceEntry) => {
      trace_entrys.push({ ...ev, sequence: state.sequence });
      state.sequence += 1;
    },
    step,
    attempt: 1,
    isResumedCheckpoint: false,
    childRunner: async () => {
      throw new Error('childRunner should not be invoked by a verification step');
    },
  };
  return { trace_entrys, state, ctx };
}

let runFolder: string;

beforeEach(() => {
  runFolder = mkdtempSync(join(tmpdir(), 'verification-handler-direct-'));
});

afterEach(() => {
  rmSync(runFolder, { recursive: true, force: true });
});

describe('runVerificationStep direct — handler-local error paths', () => {
  it('aborts with projectRoot-required reason when ctx.projectRoot is undefined', () => {
    const harness = buildHarness({ omitProjectRoot: true }, runFolder);

    const result = runVerificationStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/verification step 'verification-step': report writer failed/);
    expect(result.reason).toMatch(
      /verification step 'verification-step' requires CompiledFlowInvocation\.projectRoot/,
    );
    const check = harness.trace_entrys.find((e) => e.kind === 'check.evaluated');
    if (check?.kind !== 'check.evaluated') throw new Error('expected check.evaluated');
    expect(check.outcome).toBe('fail');
    expect(check.check_kind).toBe('schema_sections');
    expect(harness.trace_entrys.some((e) => e.kind === 'step.aborted')).toBe(true);
    // step.report_written must NOT fire on a pre-write failure path.
    expect(harness.trace_entrys.find((e) => e.kind === 'step.report_written')).toBeUndefined();
  });

  it('aborts with unsupported-report-schema reason when the writer is not registered', () => {
    const harness = buildHarness(
      { reportSchema: 'definitely-not-registered.verification@v9' },
      runFolder,
    );

    const result = runVerificationStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/verification step 'verification-step': report writer failed/);
    expect(result.reason).toMatch(
      /verification step 'verification-step' has unsupported report schema/,
    );
    const check = harness.trace_entrys.find((e) => e.kind === 'check.evaluated');
    if (check?.kind !== 'check.evaluated') throw new Error('expected check.evaluated');
    expect(check.outcome).toBe('fail');
    expect(check.check_kind).toBe('schema_sections');
    expect(harness.trace_entrys.some((e) => e.kind === 'step.aborted')).toBe(true);
    expect(harness.trace_entrys.find((e) => e.kind === 'step.report_written')).toBeUndefined();
  });
});

describe('runVerificationStep direct — trace_entry sequence invariants', () => {
  it('on projectRoot-undefined: check.evaluated/fail → step.aborted only (no step.report_written)', () => {
    const harness = buildHarness({ omitProjectRoot: true }, runFolder);

    runVerificationStep(harness.ctx);

    const kinds = harness.trace_entrys.map((e) => e.kind);
    expect(kinds).toEqual(['check.evaluated', 'step.aborted']);
  });

  it('on unsupported-report-schema: check.evaluated/fail → step.aborted only', () => {
    const harness = buildHarness({ reportSchema: 'not-a-real-schema@v1' }, runFolder);

    runVerificationStep(harness.ctx);

    const kinds = harness.trace_entrys.map((e) => e.kind);
    expect(kinds).toEqual(['check.evaluated', 'step.aborted']);
  });

  it('reasons on check.evaluated and step.aborted are identical (transcript continuity)', () => {
    const harness = buildHarness({ omitProjectRoot: true }, runFolder);

    runVerificationStep(harness.ctx);

    const check = harness.trace_entrys.find((e) => e.kind === 'check.evaluated');
    const aborted = harness.trace_entrys.find((e) => e.kind === 'step.aborted');
    if (check?.kind !== 'check.evaluated' || aborted?.kind !== 'step.aborted') {
      throw new Error('expected both check.evaluated and step.aborted');
    }
    expect(check.reason).toBeDefined();
    expect(check.reason).toBe(aborted.reason);
  });
});
