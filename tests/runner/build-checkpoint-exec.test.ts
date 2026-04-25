import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runDogfood } from '../../src/runtime/runner.js';
import { BuildBrief } from '../../src/schemas/artifacts/build.js';
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
    failure_mode: 'Build cannot honestly claim Frame parity while checkpoint steps throw',
    acceptance_evidence:
      'runtime checkpoint step can write build.brief, safely resolve, or leave the run paused-open',
    alternate_framing:
      'add the product Build fixture now — rejected because the checkpoint substrate must be proven first',
  };
}

function readJson(root: string, rel: string): unknown {
  return JSON.parse(readFileSync(join(root, rel), 'utf8')) as unknown;
}

function checkpointWorkflow(options: {
  safeDefault?: string;
  safeAutonomous?: string;
}): { workflow: Workflow; bytes: Buffer } {
  const raw = {
    schema_version: '2',
    id: 'build-checkpoint-exec-test',
    version: '0.1.0',
    purpose: 'test Build checkpoint execution',
    entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'frame-step',
        rigor: 'standard',
        description: 'test entry mode',
      },
    ],
    phases: [
      {
        id: 'frame-phase',
        title: 'Frame',
        canonical: 'frame',
        steps: ['frame-step'],
      },
    ],
    spine_policy: {
      mode: 'partial',
      omits: ['analyze', 'plan', 'act', 'verify', 'review', 'close'],
      rationale: 'test-only Build checkpoint substrate.',
    },
    steps: [
      {
        id: 'frame-step',
        title: 'Frame',
        protocol: 'build-frame@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'checkpoint',
        policy: {
          prompt: 'Frame the Build work',
          choices: [{ id: 'continue' }, { id: 'revise' }],
          ...(options.safeDefault === undefined
            ? {}
            : { safe_default_choice: options.safeDefault }),
          ...(options.safeAutonomous === undefined
            ? {}
            : { safe_autonomous_choice: options.safeAutonomous }),
          build_brief: {
            scope: 'Only prove checkpoint execution',
            success_criteria: ['Frame checkpoint is represented honestly'],
            verification_command_candidates: [
              {
                id: 'verify',
                cwd: '.',
                argv: [process.execPath, '-e', "process.stdout.write('ok')"],
                timeout_ms: 1_000,
                max_output_bytes: 20_000,
                env: {},
              },
            ],
          },
        },
        writes: {
          request: 'artifacts/checkpoints/frame-step-request.json',
          response: 'artifacts/checkpoints/frame-step-response.json',
          artifact: { path: 'artifacts/build/brief.json', schema: 'build.brief@v1' },
        },
        gate: {
          kind: 'checkpoint_selection',
          source: { kind: 'checkpoint_response', ref: 'response' },
          allow: ['continue', 'revise'],
        },
      },
    ],
  };
  const bytes = Buffer.from(JSON.stringify(raw));
  return { workflow: Workflow.parse(raw), bytes };
}

let runRootBase: string;

beforeEach(() => {
  runRootBase = join(tmpdir(), `circuit-next-build-checkpoint-${randomUUID()}`);
  mkdirSync(runRootBase, { recursive: true });
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('Build checkpoint execution substrate', () => {
  it('resolves standard rigor through a declared safe default choice', async () => {
    const { workflow, bytes } = checkpointWorkflow({ safeDefault: 'continue' });
    const runRoot = join(runRootBase, 'safe-default');

    const outcome = await runDogfood({
      runRoot,
      workflow,
      workflowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b3000000-0000-0000-0000-000000000000'),
      goal: 'Frame a Build run',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 3, 0, 0)),
    });

    expect(outcome.result.outcome).toBe('complete');
    const brief = BuildBrief.parse(readJson(runRoot, 'artifacts/build/brief.json'));
    expect(brief.objective).toBe('Frame a Build run');
    expect(brief.checkpoint).toMatchObject({
      request_path: 'artifacts/checkpoints/frame-step-request.json',
      response_path: 'artifacts/checkpoints/frame-step-response.json',
      allowed_choices: ['continue', 'revise'],
    });
    const resolved = outcome.events.find((event) => event.kind === 'checkpoint.resolved');
    expect(resolved).toMatchObject({
      selection: 'continue',
      auto_resolved: true,
      resolution_source: 'safe-default',
    });
  });

  it('leaves deep rigor paused-open with no run.closed and no result artifact', async () => {
    const { workflow, bytes } = checkpointWorkflow({ safeDefault: 'continue' });
    const runRoot = join(runRootBase, 'waiting');

    const outcome = await runDogfood({
      runRoot,
      workflow,
      workflowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b3000000-0000-0000-0000-000000000001'),
      goal: 'Frame a deep Build run',
      rigor: 'deep',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 3, 5, 0)),
    });

    const waiting = outcome.result;
    if (waiting.outcome !== 'checkpoint_waiting') {
      throw new Error(`expected checkpoint_waiting, got ${waiting.outcome}`);
    }
    expect(waiting.checkpoint).toMatchObject({
      step_id: 'frame-step',
      request_path: join(runRoot, 'artifacts/checkpoints/frame-step-request.json'),
      allowed_choices: ['continue', 'revise'],
    });
    expect(outcome.snapshot.status).toBe('in_progress');
    expect(outcome.snapshot.current_step).toBe('frame-step');
    expect(outcome.events.some((event) => event.kind === 'run.closed')).toBe(false);
    expect(existsSync(join(runRoot, 'artifacts/result.json'))).toBe(false);
    expect(existsSync(join(runRoot, 'artifacts/checkpoints/frame-step-response.json'))).toBe(false);
    const brief = BuildBrief.parse(readJson(runRoot, 'artifacts/build/brief.json'));
    expect(brief.objective).toBe('Frame a deep Build run');
    expect(brief.checkpoint.response_path).toBeUndefined();
  });

  it('resolves autonomous rigor only through a declared safe autonomous choice', async () => {
    const { workflow, bytes } = checkpointWorkflow({
      safeDefault: 'continue',
      safeAutonomous: 'continue',
    });
    const runRoot = join(runRootBase, 'autonomous');

    const outcome = await runDogfood({
      runRoot,
      workflow,
      workflowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b3000000-0000-0000-0000-000000000002'),
      goal: 'Frame an autonomous Build run',
      rigor: 'autonomous',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 3, 10, 0)),
    });

    expect(outcome.result.outcome).toBe('complete');
    const resolved = outcome.events.find((event) => event.kind === 'checkpoint.resolved');
    expect(resolved).toMatchObject({
      selection: 'continue',
      auto_resolved: true,
      resolution_source: 'safe-autonomous',
    });
  });

  it('fails autonomous rigor closed when no safe autonomous choice exists', async () => {
    const { workflow, bytes } = checkpointWorkflow({ safeDefault: 'continue' });
    const runRoot = join(runRootBase, 'autonomous-missing');

    const outcome = await runDogfood({
      runRoot,
      workflow,
      workflowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b3000000-0000-0000-0000-000000000003'),
      goal: 'Reject unsafe autonomous checkpoint',
      rigor: 'autonomous',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 3, 15, 0)),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toMatch(/safe autonomous choice/);
    expect(existsSync(join(runRoot, 'artifacts/result.json'))).toBe(true);
  });
});
