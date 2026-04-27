import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  type SynthesisWriterFn,
  runWorkflow,
  writeSynthesisArtifact,
} from '../../src/runtime/runner.js';
import {
  BuildBrief,
  BuildImplementation,
  BuildPlan,
  BuildResult,
  BuildReview,
  BuildVerification,
} from '../../src/workflows/build/artifacts.js';
import { RunId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { Workflow } from '../../src/schemas/workflow.js';

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode:
      'Build artifacts have schemas but the runtime fallback writer can still emit placeholders',
    acceptance_evidence:
      'default runWorkflow path writes build.plan@v1 and build.result@v1 artifacts that parse through their schemas',
    alternate_framing:
      'add the full Build fixture now — rejected because verification execution and checkpoint execution are not landed yet',
  };
}

function writeJson(root: string, rel: string, body: unknown): void {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${JSON.stringify(body, null, 2)}\n`);
}

function readJson(root: string, rel: string): unknown {
  return JSON.parse(readFileSync(join(root, rel), 'utf8')) as unknown;
}

function planWorkflow(options: { omitBriefRead?: boolean } = {}): {
  workflow: Workflow;
  bytes: Buffer;
} {
  const raw = {
    schema_version: '2',
    id: 'build-plan-writer-test',
    version: '0.1.0',
    purpose: 'test Build plan writer',
    entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'seed-brief-step',
        rigor: 'standard',
        description: 'test entry mode',
      },
    ],
    phases: [
      {
        id: 'plan-phase',
        title: 'Plan',
        canonical: 'plan',
        steps: ['seed-brief-step', 'plan-step'],
      },
    ],
    spine_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'act', 'verify', 'review', 'close'],
      rationale: 'test-only Build plan writer payload with all other phases out of scope.',
    },
    steps: [
      {
        id: 'seed-brief-step',
        title: 'Seed brief',
        protocol: 'test-seed-build-brief@v1',
        reads: [],
        routes: { pass: 'plan-step' },
        executor: 'orchestrator',
        kind: 'synthesis',
        writes: { artifact: { path: 'artifacts/build/brief.json', schema: 'build.brief@v1' } },
        gate: {
          kind: 'schema_sections',
          source: { kind: 'artifact', ref: 'artifact' },
          required: ['objective', 'verification_command_candidates'],
        },
      },
      {
        id: 'plan-step',
        title: 'Plan',
        protocol: 'build-plan@v1',
        reads: options.omitBriefRead === true ? [] : ['artifacts/build/brief.json'],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'synthesis',
        writes: { artifact: { path: 'artifacts/build/plan.json', schema: 'build.plan@v1' } },
        gate: {
          kind: 'schema_sections',
          source: { kind: 'artifact', ref: 'artifact' },
          required: ['objective', 'verification'],
        },
      },
    ],
  };
  const bytes = Buffer.from(JSON.stringify(raw));
  return { workflow: Workflow.parse(raw), bytes };
}

function closeWorkflow(
  options: {
    reads?: string[];
    omitProducerSchema?: string;
  } = {},
): { workflow: Workflow; bytes: Buffer } {
  const seedSteps = [
    {
      id: 'seed-brief-step',
      title: 'Seed brief',
      protocol: 'test-seed-build-brief@v1',
      reads: [],
      routes: { pass: 'seed-plan-step' },
      executor: 'orchestrator',
      kind: 'synthesis',
      writes: { artifact: { path: 'artifacts/build/brief.json', schema: 'build.brief@v1' } },
      gate: {
        kind: 'schema_sections',
        source: { kind: 'artifact', ref: 'artifact' },
        required: ['objective', 'verification_command_candidates'],
      },
    },
    {
      id: 'seed-plan-step',
      title: 'Seed plan',
      protocol: 'test-seed-build-plan@v1',
      reads: ['artifacts/build/brief.json'],
      routes: { pass: 'seed-implementation-step' },
      executor: 'orchestrator',
      kind: 'synthesis',
      writes: { artifact: { path: 'artifacts/build/plan.json', schema: 'build.plan@v1' } },
      gate: {
        kind: 'schema_sections',
        source: { kind: 'artifact', ref: 'artifact' },
        required: ['objective', 'verification'],
      },
    },
    {
      id: 'seed-implementation-step',
      title: 'Seed implementation',
      protocol: 'test-seed-build-implementation@v1',
      reads: ['artifacts/build/plan.json'],
      routes: { pass: 'seed-verification-step' },
      executor: 'orchestrator',
      kind: 'synthesis',
      writes: {
        artifact: {
          path: 'artifacts/build/implementation.json',
          schema: 'build.implementation@v1',
        },
      },
      gate: {
        kind: 'schema_sections',
        source: { kind: 'artifact', ref: 'artifact' },
        required: ['summary', 'evidence'],
      },
    },
    {
      id: 'seed-verification-step',
      title: 'Seed verification',
      protocol: 'test-seed-build-verification@v1',
      reads: ['artifacts/build/implementation.json'],
      routes: { pass: 'seed-review-step' },
      executor: 'orchestrator',
      kind: 'synthesis',
      writes: {
        artifact: {
          path: 'artifacts/build/verification.json',
          schema: 'build.verification@v1',
        },
      },
      gate: {
        kind: 'schema_sections',
        source: { kind: 'artifact', ref: 'artifact' },
        required: ['overall_status', 'commands'],
      },
    },
    {
      id: 'seed-review-step',
      title: 'Seed review',
      protocol: 'test-seed-build-review@v1',
      reads: ['artifacts/build/verification.json'],
      routes: { pass: 'close-step' },
      executor: 'orchestrator',
      kind: 'synthesis',
      writes: { artifact: { path: 'artifacts/build/review.json', schema: 'build.review@v1' } },
      gate: {
        kind: 'schema_sections',
        source: { kind: 'artifact', ref: 'artifact' },
        required: ['verdict', 'summary'],
      },
    },
  ].filter((step) => step.writes.artifact.schema !== options.omitProducerSchema);
  for (const [index, seedStep] of seedSteps.entries()) {
    seedStep.routes = { pass: seedSteps[index + 1]?.id ?? 'close-step' };
  }
  const raw = {
    schema_version: '2',
    id: 'build-result-writer-test',
    version: '0.1.0',
    purpose: 'test Build result writer',
    entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
    entry_modes: [
      {
        name: 'default',
        start_at: seedSteps[0]?.id ?? 'close-step',
        rigor: 'standard',
        description: 'test entry mode',
      },
    ],
    phases: [
      {
        id: 'close-phase',
        title: 'Close',
        canonical: 'close',
        steps: [...seedSteps.map((step) => step.id), 'close-step'],
      },
    ],
    spine_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'act', 'verify', 'review'],
      rationale: 'test-only Build close writer payload with prior artifacts prewritten.',
    },
    steps: [
      ...seedSteps,
      {
        id: 'close-step',
        title: 'Close',
        protocol: 'build-close@v1',
        reads: options.reads ?? buildRoleArtifactPaths(),
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'synthesis',
        writes: {
          artifact: { path: 'artifacts/build-result.json', schema: 'build.result@v1' },
        },
        gate: {
          kind: 'schema_sections',
          source: { kind: 'artifact', ref: 'artifact' },
          required: ['summary', 'artifact_pointers'],
        },
      },
    ],
  };
  const bytes = Buffer.from(JSON.stringify(raw));
  return { workflow: Workflow.parse(raw), bytes };
}

function buildRoleArtifactPaths(): string[] {
  return [
    'artifacts/build/brief.json',
    'artifacts/build/plan.json',
    'artifacts/build/implementation.json',
    'artifacts/build/verification.json',
    'artifacts/build/review.json',
  ];
}

function seedBuildRoleArtifact(runRoot: string, schema: string): void {
  if (schema === 'build.brief@v1') {
    writeJson(
      runRoot,
      'artifacts/build/brief.json',
      BuildBrief.parse({
        objective: 'Add a small feature',
        scope: 'Runtime writer test',
        success_criteria: ['Build result parses'],
        verification_command_candidates: [
          {
            id: 'npm-verify',
            cwd: '.',
            argv: ['npm', 'run', 'verify'],
            timeout_ms: 120_000,
            max_output_bytes: 200_000,
            env: {},
          },
        ],
        checkpoint: {
          request_path: 'artifacts/checkpoints/frame-request.json',
          allowed_choices: ['proceed'],
        },
      }),
    );
    return;
  }
  if (schema === 'build.plan@v1') {
    writeJson(
      runRoot,
      'artifacts/build/plan.json',
      BuildPlan.parse({
        objective: 'Add a small feature',
        approach: 'Implement and verify',
        slices: ['Runtime writer test'],
        verification: {
          commands: [
            {
              id: 'npm-verify',
              cwd: '.',
              argv: ['npm', 'run', 'verify'],
              timeout_ms: 120_000,
              max_output_bytes: 200_000,
              env: {},
            },
          ],
        },
      }),
    );
    return;
  }
  if (schema === 'build.implementation@v1') {
    writeJson(
      runRoot,
      'artifacts/build/implementation.json',
      BuildImplementation.parse({
        verdict: 'accept',
        summary: 'Implemented the requested change',
        changed_files: ['src/runtime/runner.ts'],
        evidence: ['Focused runtime writer test'],
      }),
    );
    return;
  }
  if (schema === 'build.verification@v1') {
    writeJson(
      runRoot,
      'artifacts/build/verification.json',
      BuildVerification.parse({
        overall_status: 'passed',
        commands: [
          {
            command_id: 'npm-verify',
            argv: ['npm', 'run', 'verify'],
            cwd: '.',
            exit_code: 0,
            status: 'passed',
            duration_ms: 1,
            stdout_summary: 'passed',
            stderr_summary: '',
          },
        ],
      }),
    );
    return;
  }
  if (schema === 'build.review@v1') {
    writeJson(
      runRoot,
      'artifacts/build/review.json',
      BuildReview.parse({
        verdict: 'accept',
        summary: 'No blocking issues',
        findings: [],
      }),
    );
    return;
  }
  throw new Error(`unexpected test seed schema ${schema}`);
}

function seedThenDefaultWriter(
  options: { removeVerification?: boolean; corruptBrief?: boolean; corruptPlan?: boolean } = {},
): SynthesisWriterFn {
  return (input) => {
    if (input.step.id.startsWith('seed-')) {
      seedBuildRoleArtifact(input.runRoot, input.step.writes.artifact.schema);
      if (options.removeVerification === true) {
        rmSync(join(input.runRoot, 'artifacts/build/verification.json'));
      }
      if (options.corruptBrief === true) {
        writeJson(input.runRoot, 'artifacts/build/brief.json', {
          objective: 'missing required fields',
        });
      }
      if (options.corruptPlan === true) {
        writeJson(input.runRoot, 'artifacts/build/plan.json', {
          objective: 'missing required fields',
        });
      }
      return;
    }
    writeSynthesisArtifact(input);
  };
}

let runRootBase: string;

beforeEach(() => {
  runRootBase = join(tmpdir(), `circuit-next-build-artifacts-${randomUUID()}`);
  mkdirSync(runRootBase, { recursive: true });
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('Build synthesis writers', () => {
  it('writes schema-valid build.plan with typed verification commands', async () => {
    const { workflow, bytes } = planWorkflow();
    const runRoot = join(runRootBase, 'plan');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('b1000000-0000-0000-0000-000000000000'),
      goal: 'Add a Build plan writer',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 1, 0, 0)),
      synthesisWriter: seedThenDefaultWriter(),
    });

    expect(outcome.result.outcome).toBe('complete');
    const plan = BuildPlan.parse(readJson(runRoot, 'artifacts/build/plan.json'));
    expect(plan.verification.commands).toEqual([
      {
        id: 'npm-verify',
        cwd: '.',
        argv: ['npm', 'run', 'verify'],
        timeout_ms: 120_000,
        max_output_bytes: 200_000,
        env: {},
      },
    ]);
    expect(plan.objective).toBe('Add a small feature');
    expect(plan.slices).toEqual(['Satisfy: Build result parses']);
  });

  it('aborts Build plan when the brief is not an explicit read', async () => {
    const { workflow, bytes } = planWorkflow({ omitBriefRead: true });
    const runRoot = join(runRootBase, 'plan-missing-brief-read');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('b1000000-0000-0000-0000-000000000006'),
      goal: 'Reject ungrounded Build plan',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 1, 1, 0)),
      synthesisWriter: seedThenDefaultWriter(),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(existsSync(join(runRoot, 'artifacts/build/plan.json'))).toBe(false);
    expect(outcome.result.reason).toMatch(/build\.brief@v1|brief\.json/);
  });

  it('aborts Build plan when the brief is malformed', async () => {
    const { workflow, bytes } = planWorkflow();
    const runRoot = join(runRootBase, 'plan-malformed-brief');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('b1000000-0000-0000-0000-000000000007'),
      goal: 'Reject malformed Build brief',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 1, 2, 0)),
      synthesisWriter: seedThenDefaultWriter({ corruptBrief: true }),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(existsSync(join(runRoot, 'artifacts/build/plan.json'))).toBe(false);
    expect(outcome.result.reason).toMatch(/verification_command_candidates|scope/);
  });

  it('writes schema-valid build.result at build-result.json while result.json remains universal', async () => {
    const { workflow, bytes } = closeWorkflow();
    const runRoot = join(runRootBase, 'close');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('b1000000-0000-0000-0000-000000000001'),
      goal: 'Close a Build run',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 1, 5, 0)),
      synthesisWriter: seedThenDefaultWriter(),
    });

    expect(outcome.result.outcome).toBe('complete');
    const buildResult = BuildResult.parse(readJson(runRoot, 'artifacts/build-result.json'));
    expect(buildResult.artifact_pointers.map((pointer) => pointer.path)).toEqual(
      buildRoleArtifactPaths(),
    );
    expect(buildResult.summary).toContain('Implemented the requested change');

    expect(existsSync(join(runRoot, 'artifacts', 'result.json'))).toBe(true);
    const universalResult = JSON.parse(
      readFileSync(join(runRoot, 'artifacts', 'result.json'), 'utf8'),
    ) as { result_path?: string; outcome?: string };
    expect(universalResult.outcome).toBe('complete');
    expect(universalResult).not.toHaveProperty('artifact_pointers');
  });

  it('aborts Build close instead of writing placeholder success when a prior artifact is missing', async () => {
    const { workflow, bytes } = closeWorkflow();
    const runRoot = join(runRootBase, 'missing-prior');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('b1000000-0000-0000-0000-000000000002'),
      goal: 'Reject missing verification',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 1, 10, 0)),
      synthesisWriter: seedThenDefaultWriter({ removeVerification: true }),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(existsSync(join(runRoot, 'artifacts/build-result.json'))).toBe(false);
    expect(outcome.result.reason).toMatch(/build\.result@v1|verification\.json/);
  });

  it('aborts Build close when build.brief is malformed', async () => {
    const { workflow, bytes } = closeWorkflow();
    const runRoot = join(runRootBase, 'malformed-brief-close');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('b1000000-0000-0000-0000-000000000003'),
      goal: 'Reject malformed brief at close',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 1, 15, 0)),
      synthesisWriter: seedThenDefaultWriter({ corruptBrief: true }),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(existsSync(join(runRoot, 'artifacts/build-result.json'))).toBe(false);
    expect(outcome.result.reason).toMatch(/verification_command_candidates|scope/);
  });

  it('aborts Build close when build.plan is malformed', async () => {
    const { workflow, bytes } = closeWorkflow();
    const runRoot = join(runRootBase, 'malformed-plan-close');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('b1000000-0000-0000-0000-000000000004'),
      goal: 'Reject malformed plan at close',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 1, 20, 0)),
      synthesisWriter: seedThenDefaultWriter({ corruptPlan: true }),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(existsSync(join(runRoot, 'artifacts/build-result.json'))).toBe(false);
    expect(outcome.result.reason).toMatch(/verification|approach|slices/);
  });

  it('aborts Build close when a required producer step is absent', async () => {
    const { workflow, bytes } = closeWorkflow({ omitProducerSchema: 'build.plan@v1' });
    const runRoot = join(runRootBase, 'missing-plan-producer');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('b1000000-0000-0000-0000-000000000005'),
      goal: 'Reject missing Build producer',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 1, 25, 0)),
      synthesisWriter: seedThenDefaultWriter(),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(existsSync(join(runRoot, 'artifacts/build-result.json'))).toBe(false);
    expect(outcome.result.reason).toMatch(/build\.plan@v1|exactly one workflow step/);
  });
});
