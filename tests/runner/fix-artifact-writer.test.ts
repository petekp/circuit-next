// Unit tests for the Fix synthesis writers added to runner.ts.
//
// fix.brief@v1: fabricated from the run goal at frame time when no operator-
//   supplied brief exists. Schema-validates and writes a deferred-repro
//   default; downstream steps see a well-formed FixBrief.
// fix.result@v1: close writer that aggregates brief + context + diagnosis +
//   change + verification (and optionally review) into the final FixResult.
//   Lite mode skips review via route_overrides; the writer treats review as
//   absent when fix.review@v1 is not in the workflow's step.writes set.
//
// Tests use a synthetic close-only Workflow (the simplest substrate that
// satisfies the Workflow validator) and pre-write the upstream artifacts
// before invoking writeSynthesisArtifact directly. This isolates the
// new code paths without spinning up the full runtime.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writeSynthesisArtifact } from '../../src/runtime/runner.js';
import { Workflow } from '../../src/schemas/workflow.js';
import { type FixBrief, FixResult } from '../../src/workflows/fix/artifacts.js';

function writeJson(root: string, rel: string, body: unknown): void {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(body, null, 2)}\n`);
}

function readJson(root: string, rel: string): unknown {
  return JSON.parse(readFileSync(join(root, rel), 'utf8')) as unknown;
}

function frameOnlyWorkflow(): Workflow {
  return Workflow.parse({
    schema_version: '2',
    id: 'fix-frame-test',
    version: '0.1.0',
    purpose: 'Test substrate for fix.brief synthesis writer',
    entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'frame-step',
        rigor: 'standard',
        description: 'frame-only test',
      },
    ],
    phases: [{ id: 'frame-phase', title: 'Frame', canonical: 'frame', steps: ['frame-step'] }],
    spine_policy: {
      mode: 'partial',
      omits: ['analyze', 'plan', 'act', 'verify', 'review', 'close'],
      rationale: 'frame-only substrate for fix.brief writer test.',
    },
    steps: [
      {
        id: 'frame-step',
        title: 'Frame',
        protocol: 'fix-frame@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'synthesis',
        writes: { artifact: { path: 'artifacts/fix/brief.json', schema: 'fix.brief@v1' } },
        gate: {
          kind: 'schema_sections',
          source: { kind: 'artifact', ref: 'artifact' },
          required: ['problem_statement', 'success_criteria'],
        },
      },
    ],
  });
}

function liteCloseWorkflow(): Workflow {
  // A close-only Workflow that includes one step per artifact schema the
  // close writer's `artifactPathForSchema` lookup resolves. The upstream
  // steps are all-synthesis stubs; we don't run them — we pre-write their
  // artifacts on disk and only invoke the close-step writer.
  const stub = (id: string, next: string, path: string, schema: string): unknown => ({
    id,
    title: id,
    protocol: `${id}@v1`,
    reads: [],
    routes: { pass: next },
    executor: 'orchestrator',
    kind: 'synthesis',
    writes: { artifact: { path, schema } },
    gate: {
      kind: 'schema_sections',
      source: { kind: 'artifact', ref: 'artifact' },
      required: ['problem_statement'],
    },
  });
  return Workflow.parse({
    schema_version: '2',
    id: 'fix-close-lite-test',
    version: '0.1.0',
    purpose: 'Test substrate for fix.result close writer (lite, no review)',
    entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
    entry_modes: [
      {
        name: 'lite',
        start_at: 'frame-stub',
        rigor: 'lite',
        description: 'lite close-only test',
      },
    ],
    phases: [
      {
        id: 'frame-phase',
        title: 'Frame',
        canonical: 'frame',
        steps: ['frame-stub'],
      },
      {
        id: 'analyze-phase',
        title: 'Analyze',
        canonical: 'analyze',
        steps: ['context-stub', 'diagnose-stub'],
      },
      { id: 'act-phase', title: 'Act', canonical: 'act', steps: ['change-stub'] },
      { id: 'verify-phase', title: 'Verify', canonical: 'verify', steps: ['verify-stub'] },
      { id: 'close-phase', title: 'Close', canonical: 'close', steps: ['close-step'] },
    ],
    spine_policy: {
      mode: 'partial',
      omits: ['plan', 'review'],
      rationale: 'Test substrate: lite Fix skips plan and review per route_overrides for close.',
    },
    steps: [
      stub('frame-stub', 'context-stub', 'artifacts/fix/brief.json', 'fix.brief@v1'),
      stub('context-stub', 'diagnose-stub', 'artifacts/fix/context.json', 'fix.context@v1'),
      stub('diagnose-stub', 'change-stub', 'artifacts/fix/diagnosis.json', 'fix.diagnosis@v1'),
      stub('change-stub', 'verify-stub', 'artifacts/fix/change.json', 'fix.change@v1'),
      stub('verify-stub', 'close-step', 'artifacts/fix/verification.json', 'fix.verification@v1'),
      {
        id: 'close-step',
        title: 'Close',
        protocol: 'fix-close@v1',
        reads: [
          'artifacts/fix/brief.json',
          'artifacts/fix/context.json',
          'artifacts/fix/diagnosis.json',
          'artifacts/fix/change.json',
          'artifacts/fix/verification.json',
        ],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'synthesis',
        writes: { artifact: { path: 'artifacts/fix-result.json', schema: 'fix.result@v1' } },
        gate: {
          kind: 'schema_sections',
          source: { kind: 'artifact', ref: 'artifact' },
          required: ['summary', 'outcome'],
        },
      },
    ],
  });
}

function standardCloseWorkflow(): Workflow {
  // Same shape as liteCloseWorkflow but with a review step wired in. Used to
  // verify the close writer treats review as present when fix.review@v1 is
  // declared in the workflow's writers and listed in close-step reads.
  const stub = (id: string, next: string, path: string, schema: string): unknown => ({
    id,
    title: id,
    protocol: `${id}@v1`,
    reads: [],
    routes: { pass: next },
    executor: 'orchestrator',
    kind: 'synthesis',
    writes: { artifact: { path, schema } },
    gate: {
      kind: 'schema_sections',
      source: { kind: 'artifact', ref: 'artifact' },
      required: ['problem_statement'],
    },
  });
  return Workflow.parse({
    schema_version: '2',
    id: 'fix-close-standard-test',
    version: '0.1.0',
    purpose: 'Test substrate for fix.result close writer (standard, review present)',
    entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'frame-stub',
        rigor: 'standard',
        description: 'standard close-with-review test',
      },
    ],
    phases: [
      { id: 'frame-phase', title: 'Frame', canonical: 'frame', steps: ['frame-stub'] },
      {
        id: 'analyze-phase',
        title: 'Analyze',
        canonical: 'analyze',
        steps: ['context-stub', 'diagnose-stub'],
      },
      { id: 'act-phase', title: 'Act', canonical: 'act', steps: ['change-stub'] },
      { id: 'verify-phase', title: 'Verify', canonical: 'verify', steps: ['verify-stub'] },
      { id: 'review-phase', title: 'Review', canonical: 'review', steps: ['review-stub'] },
      { id: 'close-phase', title: 'Close', canonical: 'close', steps: ['close-step'] },
    ],
    spine_policy: {
      mode: 'partial',
      omits: ['plan'],
      rationale: 'Test substrate: standard Fix omits plan but keeps review.',
    },
    steps: [
      stub('frame-stub', 'context-stub', 'artifacts/fix/brief.json', 'fix.brief@v1'),
      stub('context-stub', 'diagnose-stub', 'artifacts/fix/context.json', 'fix.context@v1'),
      stub('diagnose-stub', 'change-stub', 'artifacts/fix/diagnosis.json', 'fix.diagnosis@v1'),
      stub('change-stub', 'verify-stub', 'artifacts/fix/change.json', 'fix.change@v1'),
      stub('verify-stub', 'review-stub', 'artifacts/fix/verification.json', 'fix.verification@v1'),
      stub('review-stub', 'close-step', 'artifacts/fix/review.json', 'fix.review@v1'),
      {
        id: 'close-step',
        title: 'Close',
        protocol: 'fix-close@v1',
        reads: [
          'artifacts/fix/brief.json',
          'artifacts/fix/context.json',
          'artifacts/fix/diagnosis.json',
          'artifacts/fix/change.json',
          'artifacts/fix/verification.json',
          'artifacts/fix/review.json',
        ],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'synthesis',
        writes: { artifact: { path: 'artifacts/fix-result.json', schema: 'fix.result@v1' } },
        gate: {
          kind: 'schema_sections',
          source: { kind: 'artifact', ref: 'artifact' },
          required: ['summary', 'outcome'],
        },
      },
    ],
  });
}

let runRoot: string;

beforeEach(() => {
  runRoot = mkdtempSync(join(tmpdir(), 'circuit-next-fix-writer-'));
});

afterEach(() => {
  rmSync(runRoot, { recursive: true, force: true });
});

describe('fix.brief synthesis writer', () => {
  it('fabricates a schema-valid FixBrief from goal alone', () => {
    const workflow = frameOnlyWorkflow();
    const frameStep = workflow.steps.find((s) => s.id === 'frame-step');
    if (frameStep?.kind !== 'synthesis') throw new Error('expected frame step');

    writeSynthesisArtifact({
      runRoot,
      workflow,
      step: frameStep,
      goal: 'Fix the off-by-one in pagination',
    });

    const brief = readJson(runRoot, 'artifacts/fix/brief.json') as FixBrief;
    expect(brief.problem_statement).toBe('Fix the off-by-one in pagination');
    expect(brief.regression_contract.repro.kind).toBe('not-reproducible');
    expect(brief.regression_contract.regression_test.status).toBe('deferred');
    expect(brief.verification_command_candidates.length).toBeGreaterThan(0);
    expect(brief.verification_command_candidates[0]?.argv).toEqual(['npm', 'run', 'verify']);
  });
});

describe('fix.result close writer (lite path, review absent)', () => {
  it('aggregates the typed evidence chain into a FixResult with review_status=skipped', () => {
    const workflow = liteCloseWorkflow();
    const closeStep = workflow.steps.find((s) => s.id === 'close-step');
    if (closeStep?.kind !== 'synthesis') throw new Error('expected close step');

    // Pre-populate upstream artifacts. The writer reads brief, context,
    // diagnosis, change, verification — all five must exist on disk.
    writeJson(runRoot, 'artifacts/fix/brief.json', {
      problem_statement: 'Pagination off-by-one',
      expected_behavior: 'Page 2 shows items 11-20',
      observed_behavior: 'Page 2 shows items 12-21',
      scope: 'src/pagination.ts',
      regression_contract: {
        expected_behavior: 'After fix: items 11-20',
        actual_behavior: 'Before fix: items 12-21',
        repro: {
          kind: 'command',
          command: {
            id: 'pagination-repro',
            cwd: '.',
            argv: ['node', '-e', 'process.exit(0)'],
            timeout_ms: 60_000,
            max_output_bytes: 200_000,
            env: {},
          },
        },
        regression_test: {
          status: 'failing-before-fix',
          command: {
            id: 'pagination-test',
            cwd: '.',
            argv: ['node', '-e', 'process.exit(0)'],
            timeout_ms: 60_000,
            max_output_bytes: 200_000,
            env: {},
          },
        },
      },
      success_criteria: ['Page 2 shows items 11-20'],
      verification_command_candidates: [
        {
          id: 'noop',
          cwd: '.',
          argv: ['true'],
          timeout_ms: 60_000,
          max_output_bytes: 200_000,
          env: {},
        },
      ],
    });
    writeJson(runRoot, 'artifacts/fix/context.json', {
      verdict: 'accept',
      sources: [{ kind: 'file', ref: 'src/pagination.ts:42', summary: 'offset uses page*size' }],
      observations: ['off-by-one at boundary between pages'],
      open_questions: [],
    });
    writeJson(runRoot, 'artifacts/fix/diagnosis.json', {
      verdict: 'accept',
      reproduction_status: 'reproduced',
      cause_summary: 'offset starts at 1 instead of 0',
      confidence: 'high',
      evidence: ['Repro command shows wrong items'],
      residual_uncertainty: [],
    });
    writeJson(runRoot, 'artifacts/fix/change.json', {
      verdict: 'accept',
      summary: 'Subtract one from page-derived offset',
      diagnosis_ref: 'fix.diagnosis@v1',
      changed_files: ['src/pagination.ts'],
      evidence: ['Diff shows offset = (page - 1) * size'],
    });
    writeJson(runRoot, 'artifacts/fix/verification.json', {
      overall_status: 'passed',
      commands: [
        {
          command_id: 'noop',
          cwd: '.',
          argv: ['true'],
          timeout_ms: 60_000,
          max_output_bytes: 200_000,
          env: {},
          exit_code: 0,
          status: 'passed',
          duration_ms: 1,
          stdout_summary: '',
          stderr_summary: '',
        },
      ],
    });

    writeSynthesisArtifact({
      runRoot,
      workflow,
      step: closeStep,
      goal: 'Pagination off-by-one',
    });

    const result = FixResult.parse(readJson(runRoot, 'artifacts/fix-result.json'));
    expect(result.outcome).toBe('fixed');
    expect(result.verification_status).toBe('passed');
    expect(result.regression_status).toBe('proved');
    expect(result.review_status).toBe('skipped');
    expect(result.review_skip_reason).toBeDefined();
    expect(result.review_verdict).toBeUndefined();
    expect(result.summary).toContain('Pagination off-by-one');
    expect(result.summary).toContain('Subtract one from page-derived offset');
    // Required pointers (5) — review absent in lite.
    expect(result.artifact_pointers).toHaveLength(5);
    const ids = result.artifact_pointers.map((p) => p.artifact_id);
    expect(ids).toEqual([
      'fix.brief',
      'fix.context',
      'fix.diagnosis',
      'fix.change',
      'fix.verification',
    ]);
  });
});

describe('fix.result close writer (standard path, review present)', () => {
  it('emits review_status=completed with the review verdict and pointer', () => {
    const workflow = standardCloseWorkflow();
    const closeStep = workflow.steps.find((s) => s.id === 'close-step');
    if (closeStep?.kind !== 'synthesis') throw new Error('expected close step');

    writeJson(runRoot, 'artifacts/fix/brief.json', {
      problem_statement: 'Login retry storm',
      expected_behavior: 'After three failed logins the user is rate-limited',
      observed_behavior: 'Rate-limit never engages',
      scope: 'src/auth/login.ts',
      regression_contract: {
        expected_behavior: 'After fix: rate limit triggers at 3',
        actual_behavior: 'Before fix: unlimited retries',
        repro: { kind: 'recipe', recipe: 'POST /login 4x within 1s' },
        regression_test: {
          status: 'failing-before-fix',
          command: {
            id: 'login-rate-limit',
            cwd: '.',
            argv: ['node', '-e', 'process.exit(0)'],
            timeout_ms: 60_000,
            max_output_bytes: 200_000,
            env: {},
          },
        },
      },
      success_criteria: ['Fourth attempt within 1s returns 429'],
      verification_command_candidates: [
        {
          id: 'noop',
          cwd: '.',
          argv: ['true'],
          timeout_ms: 60_000,
          max_output_bytes: 200_000,
          env: {},
        },
      ],
    });
    writeJson(runRoot, 'artifacts/fix/context.json', {
      verdict: 'accept',
      sources: [{ kind: 'file', ref: 'src/auth/login.ts:88', summary: 'rate-limit guard' }],
      observations: ['Guard never reached on retry'],
      open_questions: [],
    });
    writeJson(runRoot, 'artifacts/fix/diagnosis.json', {
      verdict: 'accept',
      reproduction_status: 'reproduced',
      cause_summary: 'rate-limit cache key incorrect',
      confidence: 'high',
      evidence: ['Counter increments but never matches threshold key'],
      residual_uncertainty: [],
    });
    writeJson(runRoot, 'artifacts/fix/change.json', {
      verdict: 'accept',
      summary: 'Use IP+user-agent as the rate-limit key',
      diagnosis_ref: 'fix.diagnosis@v1',
      changed_files: ['src/auth/login.ts'],
      evidence: ['Cache lookup now matches threshold key'],
    });
    writeJson(runRoot, 'artifacts/fix/verification.json', {
      overall_status: 'passed',
      commands: [
        {
          command_id: 'noop',
          cwd: '.',
          argv: ['true'],
          timeout_ms: 60_000,
          max_output_bytes: 200_000,
          env: {},
          exit_code: 0,
          status: 'passed',
          duration_ms: 1,
          stdout_summary: '',
          stderr_summary: '',
        },
      ],
    });
    writeJson(runRoot, 'artifacts/fix/review.json', {
      verdict: 'accept',
      summary: 'Looks correct',
      findings: [],
    });

    writeSynthesisArtifact({
      runRoot,
      workflow,
      step: closeStep,
      goal: 'Login retry storm',
    });

    const result = FixResult.parse(readJson(runRoot, 'artifacts/fix-result.json'));
    expect(result.review_status).toBe('completed');
    expect(result.review_verdict).toBe('accept');
    expect(result.review_skip_reason).toBeUndefined();
    expect(result.artifact_pointers).toHaveLength(6);
    const ids = result.artifact_pointers.map((p) => p.artifact_id);
    expect(ids).toContain('fix.review');
  });
});
