import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type SynthesisWriterFn, runWorkflow } from '../../src/runtime/runner.js';
import { RunId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { Workflow } from '../../src/schemas/workflow.js';
import { BuildPlan, BuildVerification } from '../../src/workflows/build/artifacts.js';

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode: 'Build cannot honestly claim verification until commands really run',
    acceptance_evidence:
      'runtime verification step executes typed argv commands and writes build.verification@v1 pass/fail evidence',
    alternate_framing:
      'add the product Build fixture now — rejected because checkpoint and dispatch work remain separate later slices',
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

function commandPlan(command: {
  argv: string[];
  timeout_ms?: number;
  max_output_bytes?: number;
  cwd?: string;
  env?: Record<string, string>;
}) {
  return BuildPlan.parse({
    objective: 'Verify a Build run',
    approach: 'Run the planned command directly',
    slices: ['Execute verification'],
    verification: {
      commands: [
        {
          id: 'node-check',
          cwd: command.cwd ?? '.',
          argv: command.argv,
          timeout_ms: command.timeout_ms ?? 1_000,
          max_output_bytes: command.max_output_bytes ?? 20_000,
          env: command.env ?? {},
        },
      ],
    },
  });
}

function verificationWorkflow(): { workflow: Workflow; bytes: Buffer } {
  const raw = {
    schema_version: '2',
    id: 'build-verification-exec-test',
    version: '0.1.0',
    purpose: 'test Build verification execution',
    entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'seed-plan-step',
        rigor: 'standard',
        description: 'test entry mode',
      },
    ],
    phases: [
      {
        id: 'verify-phase',
        title: 'Verify',
        canonical: 'verify',
        steps: ['seed-plan-step', 'verify-step'],
      },
    ],
    spine_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'act', 'review', 'close'],
      rationale: 'test-only Build verification command execution substrate.',
    },
    steps: [
      {
        id: 'seed-plan-step',
        title: 'Seed plan',
        protocol: 'test-seed-build-plan@v1',
        reads: [],
        routes: { pass: 'verify-step' },
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
        id: 'verify-step',
        title: 'Verify',
        protocol: 'build-verify@v1',
        reads: ['artifacts/build/plan.json'],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'verification',
        writes: {
          artifact: { path: 'artifacts/build/verification.json', schema: 'build.verification@v1' },
        },
        gate: {
          kind: 'schema_sections',
          source: { kind: 'artifact', ref: 'artifact' },
          required: ['overall_status', 'commands'],
        },
      },
    ],
  };
  const bytes = Buffer.from(JSON.stringify(raw));
  return { workflow: Workflow.parse(raw), bytes };
}

function planWriter(plan: unknown): SynthesisWriterFn {
  return (input) => {
    if (input.step.id !== 'seed-plan-step') {
      throw new Error(`unexpected synthesis step ${input.step.id}`);
    }
    writeJson(input.runRoot, input.step.writes.artifact.path, plan);
  };
}

let runRootBase: string;

beforeEach(() => {
  runRootBase = join(tmpdir(), `circuit-next-build-verification-${randomUUID()}`);
  mkdirSync(runRootBase, { recursive: true });
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('Build verification command execution', () => {
  it('runs a direct argv command and writes passed build.verification evidence', async () => {
    const { workflow, bytes } = verificationWorkflow();
    const runRoot = join(runRootBase, 'pass');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b2000000-0000-0000-0000-000000000000'),
      goal: 'Run verification',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 2, 0, 0)),
      synthesisWriter: planWriter(
        commandPlan({
          argv: [process.execPath, '-e', "process.stdout.write('verified')"],
        }),
      ),
    });

    expect(outcome.result.outcome).toBe('complete');
    const verification = BuildVerification.parse(
      readJson(runRoot, 'artifacts/build/verification.json'),
    );
    expect(verification).toMatchObject({
      overall_status: 'passed',
      commands: [
        {
          command_id: 'node-check',
          argv: [process.execPath, '-e', "process.stdout.write('verified')"],
          cwd: '.',
          exit_code: 0,
          status: 'passed',
          stdout_summary: 'verified',
        },
      ],
    });
  });

  it('writes failed verification evidence and aborts when a command exits nonzero', async () => {
    const { workflow, bytes } = verificationWorkflow();
    const runRoot = join(runRootBase, 'fail');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b2000000-0000-0000-0000-000000000001'),
      goal: 'Run failing verification',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 2, 5, 0)),
      synthesisWriter: planWriter(
        commandPlan({
          argv: [process.execPath, '-e', "process.stderr.write('nope'); process.exit(2)"],
        }),
      ),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toMatch(/verification step 'verify-step' failed/);
    const verification = BuildVerification.parse(
      readJson(runRoot, 'artifacts/build/verification.json'),
    );
    expect(verification.overall_status).toBe('failed');
    expect(verification.commands[0]).toMatchObject({
      exit_code: 2,
      status: 'failed',
      stderr_summary: 'nope',
    });
  });

  it('fails closed on timeout while keeping typed verification evidence', async () => {
    const { workflow, bytes } = verificationWorkflow();
    const runRoot = join(runRootBase, 'timeout');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b2000000-0000-0000-0000-000000000002'),
      goal: 'Run timed verification',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 2, 10, 0)),
      synthesisWriter: planWriter(
        commandPlan({
          argv: [process.execPath, '-e', 'setTimeout(() => {}, 500)'],
          timeout_ms: 25,
        }),
      ),
    });

    expect(outcome.result.outcome).toBe('aborted');
    const verification = BuildVerification.parse(
      readJson(runRoot, 'artifacts/build/verification.json'),
    );
    expect(verification.overall_status).toBe('failed');
    expect(verification.commands[0]?.stderr_summary).toMatch(/ETIMEDOUT|SIGTERM/);
  });

  it('rejects unsafe verification command payloads before execution', async () => {
    const { workflow, bytes } = verificationWorkflow();
    const runRoot = join(runRootBase, 'unsafe');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b2000000-0000-0000-0000-000000000003'),
      goal: 'Reject unsafe verification',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 2, 15, 0)),
      synthesisWriter: planWriter({
        objective: 'Unsafe',
        approach: 'Do not run',
        slices: ['Reject'],
        verification: {
          commands: [
            {
              id: 'shell',
              cwd: '.',
              argv: ['sh', '-c', 'echo unsafe'],
              timeout_ms: 1_000,
              max_output_bytes: 20_000,
              env: {},
            },
          ],
        },
      }),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toMatch(/direct argv execution|shell executable/);
    expect(existsSync(join(runRoot, 'artifacts/build/verification.json'))).toBe(false);
  });

  it('rejects project cwd escapes and symlinked cwd ancestors before execution', async () => {
    const { workflow, bytes } = verificationWorkflow();
    const projectRoot = join(runRootBase, 'project');
    const outside = join(runRootBase, 'outside');
    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(outside, { recursive: true });
    symlinkSync(outside, join(projectRoot, 'linked-outside'));
    const marker = join(outside, 'marker.txt');

    const lexicalRunRoot = join(runRootBase, 'cwd-lexical');
    const lexical = await runWorkflow({
      runRoot: lexicalRunRoot,
      workflow,
      workflowBytes: bytes,
      projectRoot,
      runId: RunId.parse('b2000000-0000-0000-0000-000000000004'),
      goal: 'Reject lexical cwd escape',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 2, 20, 0)),
      synthesisWriter: planWriter({
        objective: 'Unsafe cwd',
        approach: 'Do not run',
        slices: ['Reject'],
        verification: {
          commands: [
            {
              id: 'cwd-escape',
              cwd: '../outside',
              argv: [
                process.execPath,
                '-e',
                "require('node:fs').writeFileSync('marker.txt', 'bad')",
              ],
              timeout_ms: 1_000,
              max_output_bytes: 20_000,
              env: {},
            },
          ],
        },
      }),
    });
    expect(lexical.result.outcome).toBe('aborted');
    expect(lexical.result.reason).toMatch(/cwd must not escape|cwd/);

    const symlinkRunRoot = join(runRootBase, 'cwd-symlink');
    const symlinked = await runWorkflow({
      runRoot: symlinkRunRoot,
      workflow,
      workflowBytes: bytes,
      projectRoot,
      runId: RunId.parse('b2000000-0000-0000-0000-000000000005'),
      goal: 'Reject symlink cwd escape',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 2, 25, 0)),
      synthesisWriter: planWriter(
        commandPlan({
          cwd: 'linked-outside',
          argv: [process.execPath, '-e', "require('node:fs').writeFileSync('marker.txt', 'bad')"],
        }),
      ),
    });

    expect(symlinked.result.outcome).toBe('aborted');
    expect(symlinked.result.reason).toMatch(/symlink/);
    expect(existsSync(marker)).toBe(false);
    expect(existsSync(join(symlinkRunRoot, 'artifacts/build/verification.json'))).toBe(false);
  });

  it('uses declared projectRoot instead of ambient process cwd', async () => {
    const { workflow, bytes } = verificationWorkflow();
    const projectRoot = join(runRootBase, 'declared-project');
    const ambient = join(runRootBase, 'ambient');
    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(ambient, { recursive: true });
    const runRoot = join(runRootBase, 'declared-root');
    const originalCwd = process.cwd();
    process.chdir(ambient);
    try {
      const outcome = await runWorkflow({
        runRoot,
        workflow,
        workflowBytes: bytes,
        projectRoot,
        runId: RunId.parse('b2000000-0000-0000-0000-000000000006'),
        goal: 'Use declared project root',
        rigor: 'standard',
        lane: lane(),
        now: deterministicNow(Date.UTC(2026, 3, 25, 2, 30, 0)),
        synthesisWriter: planWriter(
          commandPlan({
            argv: [process.execPath, '-e', 'process.stdout.write(process.cwd())'],
          }),
        ),
      });

      expect(outcome.result.outcome).toBe('complete');
      const verification = BuildVerification.parse(
        readJson(runRoot, 'artifacts/build/verification.json'),
      );
      expect(verification.commands[0]?.stdout_summary).toBe(realpathSync(projectRoot));
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('uses an explicit environment policy instead of inheriting arbitrary parent env', async () => {
    const { workflow, bytes } = verificationWorkflow();
    const runRoot = join(runRootBase, 'env');
    const priorParent = process.env.CIRCUIT_NEXT_PARENT_ONLY_SECRET;
    process.env.CIRCUIT_NEXT_PARENT_ONLY_SECRET = 'leaked';
    try {
      const outcome = await runWorkflow({
        runRoot,
        workflow,
        workflowBytes: bytes,
        projectRoot: process.cwd(),
        runId: RunId.parse('b2000000-0000-0000-0000-000000000007'),
        goal: 'Constrain verification env',
        rigor: 'standard',
        lane: lane(),
        now: deterministicNow(Date.UTC(2026, 3, 25, 2, 35, 0)),
        synthesisWriter: planWriter(
          commandPlan({
            argv: [
              process.execPath,
              '-e',
              "process.stdout.write(`parent=${process.env.CIRCUIT_NEXT_PARENT_ONLY_SECRET ?? ''};explicit=${process.env.CIRCUIT_NEXT_EXPLICIT ?? ''}`)",
            ],
            env: { CIRCUIT_NEXT_EXPLICIT: 'present' },
          }),
        ),
      });

      expect(outcome.result.outcome).toBe('complete');
      const verification = BuildVerification.parse(
        readJson(runRoot, 'artifacts/build/verification.json'),
      );
      expect(verification.commands[0]?.stdout_summary).toBe('parent=;explicit=present');
    } finally {
      if (priorParent === undefined) {
        Reflect.deleteProperty(process.env, 'CIRCUIT_NEXT_PARENT_ONLY_SECRET');
      } else {
        process.env.CIRCUIT_NEXT_PARENT_ONLY_SECRET = priorParent;
      }
    }
  });

  it('fails closed and bounds captured stdout when output exceeds max_output_bytes', async () => {
    const { workflow, bytes } = verificationWorkflow();
    const runRoot = join(runRootBase, 'output-limit');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b2000000-0000-0000-0000-000000000008'),
      goal: 'Bound verification output',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 2, 40, 0)),
      synthesisWriter: planWriter(
        commandPlan({
          argv: [process.execPath, '-e', "process.stdout.write('x'.repeat(10000))"],
          max_output_bytes: 256,
        }),
      ),
    });

    expect(outcome.result.outcome).toBe('aborted');
    const verification = BuildVerification.parse(
      readJson(runRoot, 'artifacts/build/verification.json'),
    );
    expect(verification.overall_status).toBe('failed');
    const command = verification.commands[0];
    expect(command).toMatchObject({ status: 'failed', exit_code: 1 });
    expect(Buffer.byteLength(command?.stdout_summary ?? '')).toBeLessThanOrEqual(256);
    expect(Buffer.byteLength(command?.stderr_summary ?? '')).toBeLessThanOrEqual(256);
    expect(command?.stderr_summary).toMatch(/ENOBUFS|SIGTERM|spawnSync/);
  });
});
