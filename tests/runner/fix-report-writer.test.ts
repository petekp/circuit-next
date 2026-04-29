// Unit tests for the Fix compose writers added to runner.ts.
//
// fix.brief@v1: fabricated from the run goal at frame time when no operator-
//   supplied brief exists. Schema-validates and writes a deferred-repro
//   default; downstream steps see a well-formed FixBrief.
// fix.result@v1: close writer that aggregates brief + context + diagnosis +
//   change + verification (and optionally review) into the final FixResult.
//   Lite mode skips review via route_overrides; the writer treats review as
//   absent when fix.review@v1 is not in the flow's step.writes set.
//
// Tests use a synthetic close-only CompiledFlow (the simplest substrate that
// satisfies the CompiledFlow validator) and pre-write the upstream reports
// before invoking writeComposeReport directly. This isolates the
// new code paths without spinning up the full runtime.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type FixBrief, FixResult } from '../../src/flows/fix/reports.js';
import { writeComposeReport } from '../../src/runtime/runner.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';

function writeJson(root: string, rel: string, body: unknown): void {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(body, null, 2)}\n`);
}

function readJson(root: string, rel: string): unknown {
  return JSON.parse(readFileSync(join(root, rel), 'utf8')) as unknown;
}

function frameOnlyCompiledFlow(): CompiledFlow {
  return CompiledFlow.parse({
    schema_version: '2',
    id: 'fix-frame-test',
    version: '0.1.0',
    purpose: 'Test substrate for fix.brief compose writer',
    entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'frame-step',
        depth: 'standard',
        description: 'frame-only test',
      },
    ],
    stages: [{ id: 'frame-stage', title: 'Frame', canonical: 'frame', steps: ['frame-step'] }],
    stage_path_policy: {
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
        kind: 'compose',
        writes: { report: { path: 'reports/fix/brief.json', schema: 'fix.brief@v1' } },
        check: {
          kind: 'schema_sections',
          source: { kind: 'report', ref: 'report' },
          required: ['problem_statement', 'success_criteria'],
        },
      },
    ],
  });
}

function liteCloseCompiledFlow(): CompiledFlow {
  // A close-only CompiledFlow that includes one step per report schema the
  // close writer's `reportPathForSchema` lookup resolves. The upstream
  // steps are all-compose stubs; we don't run them — we pre-write their
  // reports on disk and only invoke the close-step writer.
  const stub = (id: string, next: string, path: string, schema: string): unknown => ({
    id,
    title: id,
    protocol: `${id}@v1`,
    reads: [],
    routes: { pass: next },
    executor: 'orchestrator',
    kind: 'compose',
    writes: { report: { path, schema } },
    check: {
      kind: 'schema_sections',
      source: { kind: 'report', ref: 'report' },
      required: ['problem_statement'],
    },
  });
  return CompiledFlow.parse({
    schema_version: '2',
    id: 'fix-close-lite-test',
    version: '0.1.0',
    purpose: 'Test substrate for fix.result close writer (lite, no review)',
    entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
    entry_modes: [
      {
        name: 'lite',
        start_at: 'frame-stub',
        depth: 'lite',
        description: 'lite close-only test',
      },
    ],
    stages: [
      {
        id: 'frame-stage',
        title: 'Frame',
        canonical: 'frame',
        steps: ['frame-stub'],
      },
      {
        id: 'analyze-stage',
        title: 'Analyze',
        canonical: 'analyze',
        steps: ['context-stub', 'diagnose-stub'],
      },
      { id: 'act-stage', title: 'Act', canonical: 'act', steps: ['change-stub'] },
      { id: 'verify-stage', title: 'Verify', canonical: 'verify', steps: ['verify-stub'] },
      { id: 'close-stage', title: 'Close', canonical: 'close', steps: ['close-step'] },
    ],
    stage_path_policy: {
      mode: 'partial',
      omits: ['plan', 'review'],
      rationale: 'Test substrate: lite Fix skips plan and review per route_overrides for close.',
    },
    steps: [
      stub('frame-stub', 'context-stub', 'reports/fix/brief.json', 'fix.brief@v1'),
      stub('context-stub', 'diagnose-stub', 'reports/fix/context.json', 'fix.context@v1'),
      stub('diagnose-stub', 'change-stub', 'reports/fix/diagnosis.json', 'fix.diagnosis@v1'),
      stub('change-stub', 'verify-stub', 'reports/fix/change.json', 'fix.change@v1'),
      stub('verify-stub', 'close-step', 'reports/fix/verification.json', 'fix.verification@v1'),
      {
        id: 'close-step',
        title: 'Close',
        protocol: 'fix-close@v1',
        reads: [
          'reports/fix/brief.json',
          'reports/fix/context.json',
          'reports/fix/diagnosis.json',
          'reports/fix/change.json',
          'reports/fix/verification.json',
        ],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'compose',
        writes: { report: { path: 'reports/fix-result.json', schema: 'fix.result@v1' } },
        check: {
          kind: 'schema_sections',
          source: { kind: 'report', ref: 'report' },
          required: ['summary', 'outcome'],
        },
      },
    ],
  });
}

function standardCloseCompiledFlow(): CompiledFlow {
  // Same shape as liteCloseCompiledFlow but with a review step wired in. Used to
  // verify the close writer treats review as present when fix.review@v1 is
  // declared in the flow's writers and listed in close-step reads.
  const stub = (id: string, next: string, path: string, schema: string): unknown => ({
    id,
    title: id,
    protocol: `${id}@v1`,
    reads: [],
    routes: { pass: next },
    executor: 'orchestrator',
    kind: 'compose',
    writes: { report: { path, schema } },
    check: {
      kind: 'schema_sections',
      source: { kind: 'report', ref: 'report' },
      required: ['problem_statement'],
    },
  });
  return CompiledFlow.parse({
    schema_version: '2',
    id: 'fix-close-standard-test',
    version: '0.1.0',
    purpose: 'Test substrate for fix.result close writer (standard, review present)',
    entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'frame-stub',
        depth: 'standard',
        description: 'standard close-with-review test',
      },
    ],
    stages: [
      { id: 'frame-stage', title: 'Frame', canonical: 'frame', steps: ['frame-stub'] },
      {
        id: 'analyze-stage',
        title: 'Analyze',
        canonical: 'analyze',
        steps: ['context-stub', 'diagnose-stub'],
      },
      { id: 'act-stage', title: 'Act', canonical: 'act', steps: ['change-stub'] },
      { id: 'verify-stage', title: 'Verify', canonical: 'verify', steps: ['verify-stub'] },
      { id: 'review-stage', title: 'Review', canonical: 'review', steps: ['review-stub'] },
      { id: 'close-stage', title: 'Close', canonical: 'close', steps: ['close-step'] },
    ],
    stage_path_policy: {
      mode: 'partial',
      omits: ['plan'],
      rationale: 'Test substrate: standard Fix omits plan but keeps review.',
    },
    steps: [
      stub('frame-stub', 'context-stub', 'reports/fix/brief.json', 'fix.brief@v1'),
      stub('context-stub', 'diagnose-stub', 'reports/fix/context.json', 'fix.context@v1'),
      stub('diagnose-stub', 'change-stub', 'reports/fix/diagnosis.json', 'fix.diagnosis@v1'),
      stub('change-stub', 'verify-stub', 'reports/fix/change.json', 'fix.change@v1'),
      stub('verify-stub', 'review-stub', 'reports/fix/verification.json', 'fix.verification@v1'),
      stub('review-stub', 'close-step', 'reports/fix/review.json', 'fix.review@v1'),
      {
        id: 'close-step',
        title: 'Close',
        protocol: 'fix-close@v1',
        reads: [
          'reports/fix/brief.json',
          'reports/fix/context.json',
          'reports/fix/diagnosis.json',
          'reports/fix/change.json',
          'reports/fix/verification.json',
          'reports/fix/review.json',
        ],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'compose',
        writes: { report: { path: 'reports/fix-result.json', schema: 'fix.result@v1' } },
        check: {
          kind: 'schema_sections',
          source: { kind: 'report', ref: 'report' },
          required: ['summary', 'outcome'],
        },
      },
    ],
  });
}

let runFolder: string;

beforeEach(() => {
  runFolder = mkdtempSync(join(tmpdir(), 'circuit-next-fix-writer-'));
});

afterEach(() => {
  rmSync(runFolder, { recursive: true, force: true });
});

describe('fix.brief compose writer', () => {
  it('fabricates a schema-valid FixBrief from goal alone', () => {
    const flow = frameOnlyCompiledFlow();
    const frameStep = flow.steps.find((s) => s.id === 'frame-step');
    if (frameStep?.kind !== 'compose') throw new Error('expected frame step');

    writeComposeReport({
      runFolder,
      flow,
      step: frameStep,
      goal: 'Fix the off-by-one in pagination',
    });

    const brief = readJson(runFolder, 'reports/fix/brief.json') as FixBrief;
    expect(brief.problem_statement).toBe('Fix the off-by-one in pagination');
    expect(brief.regression_contract.repro.kind).toBe('not-reproducible');
    expect(brief.regression_contract.regression_test.status).toBe('deferred');
    expect(brief.verification_command_candidates.length).toBeGreaterThan(0);
    expect(brief.verification_command_candidates[0]?.argv).toEqual(['npm', 'run', 'verify']);
  });
});

describe('fix.result close writer (lite path, review absent)', () => {
  it('aggregates the typed evidence chain into a FixResult with review_status=skipped', () => {
    const flow = liteCloseCompiledFlow();
    const closeStep = flow.steps.find((s) => s.id === 'close-step');
    if (closeStep?.kind !== 'compose') throw new Error('expected close step');

    // Pre-populate upstream reports. The writer reads brief, context,
    // diagnosis, change, verification — all five must exist on disk.
    writeJson(runFolder, 'reports/fix/brief.json', {
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
    writeJson(runFolder, 'reports/fix/context.json', {
      verdict: 'accept',
      sources: [{ kind: 'file', ref: 'src/pagination.ts:42', summary: 'offset uses page*size' }],
      observations: ['off-by-one at boundary between pages'],
      open_questions: [],
    });
    writeJson(runFolder, 'reports/fix/diagnosis.json', {
      verdict: 'accept',
      reproduction_status: 'reproduced',
      cause_summary: 'offset starts at 1 instead of 0',
      confidence: 'high',
      evidence: ['Repro command shows wrong items'],
      residual_uncertainty: [],
    });
    writeJson(runFolder, 'reports/fix/change.json', {
      verdict: 'accept',
      summary: 'Subtract one from page-derived offset',
      diagnosis_ref: 'fix.diagnosis@v1',
      changed_files: ['src/pagination.ts'],
      evidence: ['Diff shows offset = (page - 1) * size'],
    });
    writeJson(runFolder, 'reports/fix/verification.json', {
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

    writeComposeReport({
      runFolder,
      flow,
      step: closeStep,
      goal: 'Pagination off-by-one',
    });

    const result = FixResult.parse(readJson(runFolder, 'reports/fix-result.json'));
    expect(result.outcome).toBe('fixed');
    expect(result.verification_status).toBe('passed');
    expect(result.regression_status).toBe('proved');
    expect(result.review_status).toBe('skipped');
    expect(result.review_skip_reason).toBeDefined();
    expect(result.review_verdict).toBeUndefined();
    expect(result.summary).toContain('Pagination off-by-one');
    expect(result.summary).toContain('Subtract one from page-derived offset');
    // Required pointers (5) — review absent in lite.
    expect(result.evidence_links).toHaveLength(5);
    const ids = result.evidence_links.map((p) => p.report_id);
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
    const flow = standardCloseCompiledFlow();
    const closeStep = flow.steps.find((s) => s.id === 'close-step');
    if (closeStep?.kind !== 'compose') throw new Error('expected close step');

    writeJson(runFolder, 'reports/fix/brief.json', {
      problem_statement: 'Login retry storm',
      expected_behavior: 'After three failed logins the user is rate-limited',
      observed_behavior: 'Rate-limit never engages',
      scope: 'src/auth/login.ts',
      regression_contract: {
        expected_behavior: 'After fix: rate limit triggers at 3',
        actual_behavior: 'Before fix: unlimited retries',
        repro: { kind: 'procedure', procedure: 'POST /login 4x within 1s' },
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
    writeJson(runFolder, 'reports/fix/context.json', {
      verdict: 'accept',
      sources: [{ kind: 'file', ref: 'src/auth/login.ts:88', summary: 'rate-limit guard' }],
      observations: ['Guard never reached on retry'],
      open_questions: [],
    });
    writeJson(runFolder, 'reports/fix/diagnosis.json', {
      verdict: 'accept',
      reproduction_status: 'reproduced',
      cause_summary: 'rate-limit cache key incorrect',
      confidence: 'high',
      evidence: ['Counter increments but never matches threshold key'],
      residual_uncertainty: [],
    });
    writeJson(runFolder, 'reports/fix/change.json', {
      verdict: 'accept',
      summary: 'Use IP+user-agent as the rate-limit key',
      diagnosis_ref: 'fix.diagnosis@v1',
      changed_files: ['src/auth/login.ts'],
      evidence: ['Cache lookup now matches threshold key'],
    });
    writeJson(runFolder, 'reports/fix/verification.json', {
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
    writeJson(runFolder, 'reports/fix/review.json', {
      verdict: 'accept',
      summary: 'Looks correct',
      findings: [],
    });

    writeComposeReport({
      runFolder,
      flow,
      step: closeStep,
      goal: 'Login retry storm',
    });

    const result = FixResult.parse(readJson(runFolder, 'reports/fix-result.json'));
    expect(result.outcome).toBe('fixed');
    expect(result.review_status).toBe('completed');
    expect(result.review_verdict).toBe('accept');
    expect(result.review_skip_reason).toBeUndefined();
    expect(result.evidence_links).toHaveLength(6);
    const ids = result.evidence_links.map((p) => p.report_id);
    expect(ids).toContain('fix.review');

    writeJson(runFolder, 'reports/fix/review.json', {
      verdict: 'accept-with-fixes',
      summary: 'One follow-up is still required',
      findings: [
        {
          severity: 'medium',
          text: 'Add regression coverage for lockout reset timing',
          file_refs: ['tests/auth/login.test.ts:1'],
        },
      ],
    });

    writeComposeReport({
      runFolder,
      flow,
      step: closeStep,
      goal: 'Login retry storm',
    });

    const followupResult = FixResult.parse(readJson(runFolder, 'reports/fix-result.json'));
    expect(followupResult.outcome).toBe('partial');
    expect(followupResult.review_status).toBe('completed');
    expect(followupResult.review_verdict).toBe('accept-with-fixes');
  });
});
