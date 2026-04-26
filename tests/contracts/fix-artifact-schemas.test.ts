import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  FixBrief,
  FixChange,
  FixContext,
  FixDiagnosis,
  FixNoReproDecision,
  FixResult,
  FixResultArtifactPointer,
  FixReview,
  FixVerification,
  FixVerificationCommand,
} from '../../src/schemas/artifacts/fix.js';

const REPO_ROOT = resolve('.');
const ARTIFACTS_PATH = join(REPO_ROOT, 'specs', 'artifacts.json');

const FIX_ARTIFACT_IDS = [
  'fix.brief',
  'fix.context',
  'fix.diagnosis',
  'fix.no-repro-decision',
  'fix.change',
  'fix.verification',
  'fix.review',
  'fix.result',
] as const;

const EXPECTED_BACKING_PATHS = {
  'fix.brief': '<run-root>/artifacts/fix/brief.json',
  'fix.context': '<run-root>/artifacts/fix/context.json',
  'fix.diagnosis': '<run-root>/artifacts/fix/diagnosis.json',
  'fix.no-repro-decision': '<run-root>/artifacts/fix/no-repro-decision.json',
  'fix.change': '<run-root>/artifacts/fix/change.json',
  'fix.verification': '<run-root>/artifacts/fix/verification.json',
  'fix.review': '<run-root>/artifacts/fix/review.json',
  'fix.result': '<run-root>/artifacts/fix-result.json',
} as const;

function verificationCommand(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fix-proof',
    cwd: '.',
    argv: ['npm', 'run', 'verify'],
    timeout_ms: 120_000,
    max_output_bytes: 200_000,
    env: {},
    ...overrides,
  };
}

function resultPointers(
  options: { readonly includeDecision?: boolean; readonly includeReview?: boolean } = {},
) {
  const includeDecision = options.includeDecision ?? false;
  const includeReview = options.includeReview ?? true;
  const pointers = [
    FixResultArtifactPointer.parse({
      artifact_id: 'fix.brief',
      path: 'artifacts/fix/brief.json',
      schema: 'fix.brief@v1',
    }),
    FixResultArtifactPointer.parse({
      artifact_id: 'fix.context',
      path: 'artifacts/fix/context.json',
      schema: 'fix.context@v1',
    }),
    FixResultArtifactPointer.parse({
      artifact_id: 'fix.diagnosis',
      path: 'artifacts/fix/diagnosis.json',
      schema: 'fix.diagnosis@v1',
    }),
    FixResultArtifactPointer.parse({
      artifact_id: 'fix.change',
      path: 'artifacts/fix/change.json',
      schema: 'fix.change@v1',
    }),
    FixResultArtifactPointer.parse({
      artifact_id: 'fix.verification',
      path: 'artifacts/fix/verification.json',
      schema: 'fix.verification@v1',
    }),
  ];

  if (includeReview) {
    pointers.push(
      FixResultArtifactPointer.parse({
        artifact_id: 'fix.review',
        path: 'artifacts/fix/review.json',
        schema: 'fix.review@v1',
      }),
    );
  }

  if (includeDecision) {
    pointers.splice(
      3,
      0,
      FixResultArtifactPointer.parse({
        artifact_id: 'fix.no-repro-decision',
        path: 'artifacts/fix/no-repro-decision.json',
        schema: 'fix.no-repro-decision@v1',
      }),
    );
  }

  return pointers;
}

function loadArtifacts() {
  return JSON.parse(readFileSync(ARTIFACTS_PATH, 'utf-8')) as {
    artifacts: Array<{
      id: string;
      contract?: string;
      schema_file?: string;
      schema_exports?: string[];
      writers?: string[];
      readers?: string[];
      backing_paths?: string[];
      reference_evidence?: string[];
    }>;
  };
}

describe('Fix artifact schemas', () => {
  it('accepts minimal valid objects for all Fix artifacts', () => {
    expect(
      FixBrief.parse({
        problem_statement: 'The test suite fails on a focused case',
        expected_behavior: 'The focused case should pass',
        observed_behavior: 'The focused case fails',
        scope: 'Only the failing module and its tests',
        regression_contract: {
          expected_behavior: 'The focused case should pass',
          actual_behavior: 'The focused case fails',
          repro: {
            kind: 'command',
            command: verificationCommand({ id: 'repro' }),
          },
          regression_test: {
            status: 'failing-before-fix',
            command: verificationCommand({ id: 'regression-test' }),
          },
        },
        success_criteria: ['The focused case passes', 'The full suite still passes'],
        verification_command_candidates: [verificationCommand()],
      }),
    ).toBeDefined();
    expect(
      FixContext.parse({
        verdict: 'accept',
        sources: [{ kind: 'file', ref: 'src/example.ts', summary: 'Contains the failing branch' }],
        observations: ['The guard returns before the expected state update'],
        open_questions: [],
      }),
    ).toBeDefined();
    expect(
      FixDiagnosis.parse({
        verdict: 'accept',
        reproduction_status: 'reproduced',
        cause_summary: 'The guard rejects a valid empty-list case',
        confidence: 'high',
        evidence: ['Focused test reproduces the failure'],
        residual_uncertainty: [],
      }),
    ).toBeDefined();
    expect(
      FixNoReproDecision.parse({
        decision: 'add-diagnostics',
        selected_route: 'revise',
        answered_by: 'operator',
        rationale: 'Gather one more signal before changing code',
      }),
    ).toBeDefined();
    expect(
      FixChange.parse({
        verdict: 'accept',
        summary: 'Adjusted the guard and added a focused regression test',
        diagnosis_ref: 'fix.diagnosis@v1',
        changed_files: ['src/example.ts', 'tests/contracts/example.test.ts'],
        evidence: ['Regression test now passes'],
      }),
    ).toBeDefined();
    expect(
      FixVerification.parse({
        overall_status: 'passed',
        commands: [
          {
            command_id: 'fix-proof',
            argv: ['npm', 'run', 'verify'],
            cwd: '.',
            timeout_ms: 120_000,
            max_output_bytes: 200_000,
            env: {},
            exit_code: 0,
            status: 'passed',
            duration_ms: 25,
            stdout_summary: 'All checks passed',
            stderr_summary: '',
          },
        ],
      }),
    ).toBeDefined();
    expect(
      FixReview.parse({
        verdict: 'accept',
        summary: 'No blocking issue found',
        findings: [],
      }),
    ).toBeDefined();
    expect(
      FixResult.parse({
        summary: 'Problem fixed and verified',
        outcome: 'fixed',
        verification_status: 'passed',
        regression_status: 'proved',
        review_status: 'completed',
        review_verdict: 'accept',
        residual_risks: [],
        artifact_pointers: resultPointers(),
      }),
    ).toBeDefined();
  });

  it('requires uncertainty when the problem is not cleanly reproduced', () => {
    expect(
      FixDiagnosis.safeParse({
        verdict: 'accept',
        reproduction_status: 'not-reproduced',
        cause_summary: 'No local reproduction was observed',
        confidence: 'low',
        evidence: ['The available command passed locally'],
        residual_uncertainty: [],
      }).success,
    ).toBe(false);
  });

  it('requires a failing-before-fix regression test when repro evidence exists', () => {
    expect(
      FixBrief.safeParse({
        problem_statement: 'The test suite fails on a focused case',
        expected_behavior: 'The focused case should pass',
        observed_behavior: 'The focused case fails',
        scope: 'Only the failing module and its tests',
        regression_contract: {
          expected_behavior: 'The focused case should pass',
          actual_behavior: 'The focused case fails',
          repro: {
            kind: 'recipe',
            recipe: 'Run the focused test',
          },
          regression_test: {
            status: 'deferred',
            deferred_reason: 'Later maybe',
          },
        },
        success_criteria: ['The focused case passes'],
        verification_command_candidates: [verificationCommand()],
      }).success,
    ).toBe(false);
  });

  it('keeps no-repro decisions aligned with route outcomes', () => {
    expect(
      FixNoReproDecision.safeParse({
        decision: 'stop-as-not-reproduced',
        selected_route: 'continue',
        answered_by: 'operator',
        rationale: 'This mismatches the declared decision',
      }).success,
    ).toBe(false);
  });

  it('reuses the direct-argv verification command safety floor', () => {
    expect(
      FixVerificationCommand.safeParse(verificationCommand({ argv: ['sh', '-c', 'true'] })),
    ).toMatchObject({ success: false });
    expect(
      FixVerificationCommand.safeParse(verificationCommand({ cwd: '../outside' })),
    ).toMatchObject({ success: false });
    expect(
      FixVerification.safeParse({
        overall_status: 'passed',
        commands: [
          {
            command_id: 'unsafe',
            argv: ['sh', '-c', 'true'],
            cwd: '.',
            timeout_ms: 120_000,
            max_output_bytes: 200_000,
            env: {},
            exit_code: 0,
            status: 'passed',
            duration_ms: 25,
            stdout_summary: 'passed',
            stderr_summary: '',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('keeps fix.verification overall_status tied to command results', () => {
    expect(
      FixVerification.safeParse({
        overall_status: 'passed',
        commands: [
          {
            command_id: 'fix-proof',
            argv: ['npm', 'run', 'verify'],
            cwd: '.',
            timeout_ms: 120_000,
            max_output_bytes: 200_000,
            env: {},
            exit_code: 1,
            status: 'failed',
            duration_ms: 25,
            stdout_summary: '',
            stderr_summary: 'failed',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('requires actionable findings for non-accept Fix review verdicts', () => {
    expect(
      FixReview.safeParse({
        verdict: 'reject',
        summary: 'Blocking issue found',
        findings: [],
      }).success,
    ).toBe(false);
  });

  it('keeps fix.result honest about verification and no-repro decisions', () => {
    expect(
      FixResult.safeParse({
        summary: 'Cannot be fixed without proof',
        outcome: 'fixed',
        verification_status: 'failed',
        regression_status: 'proved',
        review_status: 'completed',
        review_verdict: 'accept',
        residual_risks: [],
        artifact_pointers: resultPointers(),
      }).success,
    ).toBe(false);
    expect(
      FixResult.safeParse({
        summary: 'No reproduction seen',
        outcome: 'not-reproduced',
        verification_status: 'not-run',
        regression_status: 'deferred',
        review_status: 'skipped',
        review_skip_reason: 'Lite path skipped review after no-repro decision',
        residual_risks: ['The bug may depend on environment state'],
        artifact_pointers: resultPointers({ includeReview: false }),
      }).success,
    ).toBe(false);
    expect(
      FixResult.parse({
        summary: 'No reproduction seen; operator chose to stop',
        outcome: 'not-reproduced',
        verification_status: 'not-run',
        regression_status: 'deferred',
        review_status: 'skipped',
        review_skip_reason: 'Lite path skipped review after no-repro decision',
        residual_risks: ['The bug may depend on environment state'],
        artifact_pointers: resultPointers({ includeDecision: true, includeReview: false }),
      }),
    ).toBeDefined();
  });

  it('pins result pointer paths to the authority rows', () => {
    expect(
      FixResultArtifactPointer.safeParse({
        artifact_id: 'fix.diagnosis',
        path: 'artifacts/fix/wrong.json',
        schema: 'fix.diagnosis@v1',
      }).success,
    ).toBe(false);
  });
});

describe('Fix artifact authority rows', () => {
  const artifacts = loadArtifacts();
  const byId = new Map(artifacts.artifacts.map((artifact) => [artifact.id, artifact]));

  it('registers all eight Fix artifacts with schemas, paths, readers, writers, and reference evidence', () => {
    for (const id of FIX_ARTIFACT_IDS) {
      const artifact = byId.get(id);
      expect(artifact, `${id} row`).toBeDefined();
      expect(artifact?.contract).toBe('specs/contracts/fix.md');
      expect(artifact?.schema_file).toBe('src/schemas/artifacts/fix.ts');
      expect(artifact?.schema_exports?.length, `${id}.schema_exports`).toBeGreaterThan(0);
      expect(artifact?.writers?.length, `${id}.writers`).toBeGreaterThan(0);
      expect(artifact?.readers?.length, `${id}.readers`).toBeGreaterThan(0);
      expect(artifact?.reference_evidence).toEqual([
        'specs/reference/legacy-circuit/repair-characterization.md',
      ]);
      expect(artifact?.backing_paths).toEqual([EXPECTED_BACKING_PATHS[id]]);
    }
  });

  it('keeps fix.result path-distinct from the universal run result and other workflow results', () => {
    expect(byId.get('fix.result')?.backing_paths).toEqual(['<run-root>/artifacts/fix-result.json']);
    expect(byId.get('run.result')?.backing_paths).toEqual([
      '<circuit-next-run-root>/artifacts/result.json',
    ]);
    expect(byId.get('build.result')?.backing_paths).toEqual([
      '<run-root>/artifacts/build-result.json',
    ]);
    expect(byId.get('explore.result')?.backing_paths).toEqual([
      '<run-root>/artifacts/explore-result.json',
    ]);
  });

  it('keeps Fix role artifacts under artifacts/fix', () => {
    for (const id of FIX_ARTIFACT_IDS.filter((artifactId) => artifactId !== 'fix.result')) {
      expect(EXPECTED_BACKING_PATHS[id]).toMatch(/^<run-root>\/artifacts\/fix\/.+\.json$/);
    }
  });
});
