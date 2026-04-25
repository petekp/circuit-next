import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  BuildBrief,
  BuildImplementation,
  BuildPlan,
  BuildResult,
  BuildResultArtifactPointer,
  BuildReview,
  BuildVerification,
  BuildVerificationCommand,
} from '../../src/schemas/artifacts/build.js';

const REPO_ROOT = resolve('.');
const ARTIFACTS_PATH = join(REPO_ROOT, 'specs', 'artifacts.json');

const BUILD_ARTIFACT_IDS = [
  'build.brief',
  'build.plan',
  'build.implementation',
  'build.verification',
  'build.review',
  'build.result',
] as const;

const EXPECTED_BACKING_PATHS = {
  'build.brief': '<run-root>/artifacts/build/brief.json',
  'build.plan': '<run-root>/artifacts/build/plan.json',
  'build.implementation': '<run-root>/artifacts/build/implementation.json',
  'build.verification': '<run-root>/artifacts/build/verification.json',
  'build.review': '<run-root>/artifacts/build/review.json',
  'build.result': '<run-root>/artifacts/build-result.json',
} as const;

function verificationCommand(overrides: Record<string, unknown> = {}) {
  return {
    id: 'verify',
    cwd: '.',
    argv: ['npm', 'run', 'verify'],
    timeout_ms: 120_000,
    max_output_bytes: 200_000,
    env: {},
    ...overrides,
  };
}

function resultPointers() {
  return [
    BuildResultArtifactPointer.parse({
      artifact_id: 'build.brief',
      path: 'artifacts/build/brief.json',
      schema: 'build.brief@v1',
    }),
    BuildResultArtifactPointer.parse({
      artifact_id: 'build.plan',
      path: 'artifacts/build/plan.json',
      schema: 'build.plan@v1',
    }),
    BuildResultArtifactPointer.parse({
      artifact_id: 'build.implementation',
      path: 'artifacts/build/implementation.json',
      schema: 'build.implementation@v1',
    }),
    BuildResultArtifactPointer.parse({
      artifact_id: 'build.verification',
      path: 'artifacts/build/verification.json',
      schema: 'build.verification@v1',
    }),
    BuildResultArtifactPointer.parse({
      artifact_id: 'build.review',
      path: 'artifacts/build/review.json',
      schema: 'build.review@v1',
    }),
  ];
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

describe('Build artifact schemas', () => {
  it('accepts build.brief while waiting at the Frame checkpoint and after resume', () => {
    const waiting = BuildBrief.parse({
      objective: 'Add a small feature',
      scope: 'Touch the CLI and tests only',
      success_criteria: ['The requested behavior works', 'Verification passes'],
      verification_command_candidates: [verificationCommand()],
      checkpoint: {
        request_path: 'artifacts/checkpoints/frame-request.json',
        allowed_choices: ['proceed', 'revise', 'abort'],
      },
    });
    const resumed = BuildBrief.parse({
      ...waiting,
      checkpoint: {
        ...waiting.checkpoint,
        response_path: 'artifacts/checkpoints/frame-response.json',
      },
    });

    expect(waiting.checkpoint.response_path).toBeUndefined();
    expect(resumed.checkpoint.response_path).toBe('artifacts/checkpoints/frame-response.json');
  });

  it('accepts minimal valid objects for all six Build artifacts', () => {
    expect(
      BuildPlan.parse({
        objective: 'Add a small feature',
        approach: 'Make the smallest code change and verify it',
        slices: ['Implement the behavior'],
        verification: { commands: [verificationCommand()] },
      }),
    ).toBeDefined();
    expect(
      BuildImplementation.parse({
        summary: 'Implemented the behavior',
        changed_files: ['src/example.ts'],
        evidence: ['Unit tests cover the change'],
      }),
    ).toBeDefined();
    expect(
      BuildVerification.parse({
        overall_status: 'passed',
        commands: [
          {
            command_id: 'verify',
            argv: ['npm', 'run', 'verify'],
            cwd: '.',
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
      BuildReview.parse({
        verdict: 'accept',
        summary: 'No blocking issue found',
        findings: [],
      }),
    ).toBeDefined();
    expect(
      BuildResult.parse({
        summary: 'Feature added and verified',
        outcome: 'complete',
        verification_status: 'passed',
        review_verdict: 'accept',
        artifact_pointers: resultPointers(),
      }),
    ).toBeDefined();
  });

  it('rejects missing required fields and surplus keys across artifact schemas', () => {
    expect(
      BuildBrief.safeParse({
        objective: 'Add a small feature',
        scope: 'Touch the CLI and tests only',
        success_criteria: ['Verification passes'],
        checkpoint: {
          request_path: 'artifacts/checkpoints/frame-request.json',
          allowed_choices: ['proceed'],
        },
      }).success,
    ).toBe(false);

    expect(
      BuildImplementation.safeParse({
        summary: 'Implemented the behavior',
        changed_files: [],
        evidence: ['Unit tests cover the change'],
        smuggled: true,
      }).success,
    ).toBe(false);
  });

  it('rejects unsafe or incomplete verification command payloads', () => {
    expect(
      BuildVerificationCommand.safeParse({
        id: 'shell-string',
        cwd: '.',
        command: 'npm run verify',
        timeout_ms: 120_000,
        max_output_bytes: 200_000,
        env: {},
      }).success,
    ).toBe(false);
    expect(BuildVerificationCommand.safeParse(verificationCommand({ argv: [] })).success).toBe(
      false,
    );
    expect(
      BuildVerificationCommand.safeParse({
        id: 'missing-timeout',
        cwd: '.',
        argv: ['npm', 'run', 'verify'],
        max_output_bytes: 200_000,
        env: {},
      }).success,
    ).toBe(false);
    expect(
      BuildVerificationCommand.safeParse({
        id: 'missing-output-bound',
        cwd: '.',
        argv: ['npm', 'run', 'verify'],
        timeout_ms: 120_000,
        env: {},
      }).success,
    ).toBe(false);
    expect(
      BuildVerificationCommand.safeParse(verificationCommand({ cwd: '../outside' })).success,
    ).toBe(false);
    expect(BuildVerificationCommand.safeParse(verificationCommand({ cwd: '/tmp' })).success).toBe(
      false,
    );
    expect(
      BuildVerificationCommand.safeParse(verificationCommand({ cwd: 'C:\\tmp' })).success,
    ).toBe(false);
    expect(
      BuildVerificationCommand.safeParse(verificationCommand({ argv: ['sh', '-c', 'true'] })),
    ).toMatchObject({ success: false });
    expect(
      BuildVerificationCommand.safeParse(verificationCommand({ argv: ['bash', 'scripts/check'] })),
    ).toMatchObject({ success: false });
    expect(
      BuildVerificationCommand.safeParse(verificationCommand({ argv: ['cmd.exe', '/c', 'dir'] })),
    ).toMatchObject({ success: false });
  });

  it('keeps build.verification overall_status tied to command results', () => {
    expect(
      BuildVerification.safeParse({
        overall_status: 'passed',
        commands: [
          {
            command_id: 'verify',
            argv: ['npm', 'run', 'verify'],
            cwd: '.',
            exit_code: 1,
            status: 'failed',
            duration_ms: 25,
            stdout_summary: '',
            stderr_summary: 'failed',
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      BuildVerification.safeParse({
        overall_status: 'failed',
        commands: [
          {
            command_id: 'verify',
            argv: ['npm', 'run', 'verify'],
            cwd: '.',
            exit_code: 0,
            status: 'failed',
            duration_ms: 25,
            stdout_summary: 'passed',
            stderr_summary: '',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('accepts critical Build review findings without downgrading severity', () => {
    expect(
      BuildReview.parse({
        verdict: 'reject',
        summary: 'A critical issue blocks the change',
        findings: [
          {
            severity: 'critical',
            text: 'The change can corrupt existing run evidence',
            file_refs: ['src/runtime/runner.ts'],
          },
        ],
      }).findings[0]?.severity,
    ).toBe('critical');
  });

  it('rejects build.result pointer omissions, duplicates, and schema mismatches', () => {
    expect(
      BuildResultArtifactPointer.safeParse({
        artifact_id: 'build.plan',
        path: 'artifacts/build/plan.json',
        schema: 'build.review@v1',
      }).success,
    ).toBe(false);

    expect(
      BuildResult.safeParse({
        summary: 'Missing pointer',
        outcome: 'complete',
        verification_status: 'passed',
        review_verdict: 'accept',
        artifact_pointers: resultPointers().slice(1),
      }).success,
    ).toBe(false);

    expect(
      BuildResult.safeParse({
        summary: 'Duplicate pointer',
        outcome: 'complete',
        verification_status: 'passed',
        review_verdict: 'accept',
        artifact_pointers: [resultPointers()[0], resultPointers()[0], ...resultPointers().slice(2)],
      }).success,
    ).toBe(false);
  });
});

describe('Build artifact authority rows', () => {
  const artifacts = loadArtifacts();
  const byId = new Map(artifacts.artifacts.map((artifact) => [artifact.id, artifact]));

  it('registers all six Build artifacts with schemas, paths, readers, writers, and reference evidence', () => {
    for (const id of BUILD_ARTIFACT_IDS) {
      const artifact = byId.get(id);
      expect(artifact, `${id} row`).toBeDefined();
      expect(artifact?.contract).toBe('specs/contracts/build.md');
      expect(artifact?.schema_file).toBe('src/schemas/artifacts/build.ts');
      expect(artifact?.schema_exports?.length, `${id}.schema_exports`).toBeGreaterThan(0);
      expect(artifact?.writers?.length, `${id}.writers`).toBeGreaterThan(0);
      expect(artifact?.readers?.length, `${id}.readers`).toBeGreaterThan(0);
      expect(artifact?.reference_evidence).toEqual([
        'specs/reference/legacy-circuit/build-characterization.md',
      ]);
      expect(artifact?.backing_paths).toEqual([EXPECTED_BACKING_PATHS[id]]);
    }
  });

  it('keeps build.result path-distinct from the universal run result', () => {
    expect(byId.get('build.result')?.backing_paths).toEqual([
      '<run-root>/artifacts/build-result.json',
    ]);
    expect(byId.get('run.result')?.backing_paths).toEqual([
      '<circuit-next-run-root>/artifacts/result.json',
    ]);
  });

  it('keeps Build role artifacts under artifacts/build and path-distinct from Explore and Review', () => {
    const occupied = new Map<string, string>();
    for (const artifact of artifacts.artifacts) {
      for (const backingPath of artifact.backing_paths ?? []) {
        occupied.set(backingPath, artifact.id);
      }
    }

    for (const id of BUILD_ARTIFACT_IDS.filter((artifactId) => artifactId !== 'build.result')) {
      const path = EXPECTED_BACKING_PATHS[id];
      expect(path).toMatch(/^<run-root>\/artifacts\/build\/.+\.json$/);
      expect(occupied.get(path)).toBe(id);
    }

    const nonBuildWorkflowPaths = [
      '<run-root>/artifacts/brief.json',
      '<run-root>/artifacts/analysis.json',
      '<run-root>/artifacts/synthesis.json',
      '<run-root>/artifacts/review-verdict.json',
      '<run-root>/artifacts/explore-result.json',
      '<run-root>/artifacts/review-result.json',
    ];
    for (const path of nonBuildWorkflowPaths) {
      expect(BUILD_ARTIFACT_IDS.some((id) => EXPECTED_BACKING_PATHS[id] === path)).toBe(false);
    }
  });
});
