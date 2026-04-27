import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import { sha256Hex } from '../../src/runtime/adapters/shared.js';
import {
  type DispatchFn,
  type DispatchInput,
  resumeWorkflowCheckpoint,
  runWorkflow,
} from '../../src/runtime/runner.js';
import { BuildBrief, BuildVerification } from '../../src/schemas/artifacts/build.js';
import { RunId } from '../../src/schemas/ids.js';
import { SkillId } from '../../src/schemas/ids.js';
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

function checkpointToDispatchWorkflow(): { workflow: Workflow; bytes: Buffer } {
  const raw = {
    schema_version: '2',
    id: 'build-checkpoint-dispatch-test',
    version: '0.1.0',
    purpose: 'test checkpoint resume context for dispatch',
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
      { id: 'frame-phase', title: 'Frame', canonical: 'frame', steps: ['frame-step'] },
      { id: 'act-phase', title: 'Act', canonical: 'act', steps: ['dispatch-step'] },
    ],
    spine_policy: {
      mode: 'partial',
      omits: ['analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'test-only checkpoint-to-dispatch resume.',
    },
    steps: [
      {
        id: 'frame-step',
        title: 'Frame',
        protocol: 'build-frame@v1',
        reads: [],
        routes: { pass: 'dispatch-step' },
        executor: 'orchestrator',
        kind: 'checkpoint',
        policy: {
          prompt: 'Frame',
          choices: [{ id: 'continue' }],
          safe_default_choice: 'continue',
          build_brief: {
            scope: 'Dispatch resume context test',
            success_criteria: ['Resume preserves original selection context'],
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
          allow: ['continue'],
        },
      },
      {
        id: 'dispatch-step',
        title: 'Dispatch',
        protocol: 'build-act@v1',
        reads: ['artifacts/build/brief.json'],
        routes: { pass: '@complete' },
        executor: 'worker',
        kind: 'dispatch',
        role: 'implementer',
        writes: {
          request: 'transcript/dispatch-request.txt',
          receipt: 'transcript/dispatch-receipt.json',
          result: 'transcript/dispatch-result.md',
        },
        gate: {
          kind: 'result_verdict',
          source: { kind: 'dispatch_result', ref: 'result' },
          pass: ['accept'],
        },
      },
    ],
  };
  const bytes = Buffer.from(JSON.stringify(raw));
  return { workflow: Workflow.parse(raw), bytes };
}

function checkpointToVerificationWorkflow(commandCwd = '.'): { workflow: Workflow; bytes: Buffer } {
  const raw = {
    schema_version: '2',
    id: 'build-checkpoint-verification-test',
    version: '0.1.0',
    purpose: 'test checkpoint resume context for verification',
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
      { id: 'frame-phase', title: 'Frame', canonical: 'frame', steps: ['frame-step'] },
      { id: 'plan-phase', title: 'Plan', canonical: 'plan', steps: ['plan-step'] },
      { id: 'verify-phase', title: 'Verify', canonical: 'verify', steps: ['verify-step'] },
    ],
    spine_policy: {
      mode: 'partial',
      omits: ['analyze', 'act', 'review', 'close'],
      rationale: 'test-only checkpoint-to-verification resume.',
    },
    steps: [
      {
        id: 'frame-step',
        title: 'Frame',
        protocol: 'build-frame@v1',
        reads: [],
        routes: { pass: 'plan-step' },
        executor: 'orchestrator',
        kind: 'checkpoint',
        policy: {
          prompt: 'Frame',
          choices: [{ id: 'continue' }],
          safe_default_choice: 'continue',
          build_brief: {
            scope: 'Verification resume context test',
            success_criteria: ['Resume preserves original project root'],
            verification_command_candidates: [
              {
                id: 'marker-check',
                cwd: commandCwd,
                argv: [process.execPath, '-e', "require('node:fs').accessSync('marker.txt')"],
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
          allow: ['continue'],
        },
      },
      {
        id: 'plan-step',
        title: 'Plan',
        protocol: 'build-plan@v1',
        reads: ['artifacts/build/brief.json'],
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

    const outcome = await runWorkflow({
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

    const outcome = await runWorkflow({
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

  it('resumes a paused-open checkpoint through an operator selection', async () => {
    const { workflow, bytes } = checkpointWorkflow({ safeDefault: 'continue' });
    const runRoot = join(runRootBase, 'resume-waiting');

    await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b3000000-0000-0000-0000-000000000004'),
      goal: 'Resume a deep Build run',
      rigor: 'deep',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 3, 20, 0)),
    });

    const resumed = await resumeWorkflowCheckpoint({
      runRoot,
      selection: 'continue',
      projectRoot: process.cwd(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 3, 25, 0)),
    });

    expect(resumed.result.outcome).toBe('complete');
    expect(resumed.snapshot.status).toBe('complete');
    const resolved = resumed.events.find((event) => event.kind === 'checkpoint.resolved');
    expect(resolved).toMatchObject({
      selection: 'continue',
      auto_resolved: false,
      resolution_source: 'operator',
      response_path: 'artifacts/checkpoints/frame-step-response.json',
    });
    const brief = BuildBrief.parse(readJson(runRoot, 'artifacts/build/brief.json'));
    expect(brief.objective).toBe('Resume a deep Build run');
    expect(brief.checkpoint.response_path).toBe('artifacts/checkpoints/frame-step-response.json');
    expect(readJson(runRoot, 'artifacts/result.json')).toMatchObject({ outcome: 'complete' });
  });

  it('rejects checkpoint resume choices outside the declared allow list', async () => {
    const { workflow, bytes } = checkpointWorkflow({ safeDefault: 'continue' });
    const runRoot = join(runRootBase, 'resume-reject');

    await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b3000000-0000-0000-0000-000000000005'),
      goal: 'Reject bad resume choice',
      rigor: 'deep',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 3, 30, 0)),
    });

    await expect(
      resumeWorkflowCheckpoint({
        runRoot,
        selection: 'ship-it-anyway',
        projectRoot: process.cwd(),
        now: deterministicNow(Date.UTC(2026, 3, 25, 3, 35, 0)),
      }),
    ).rejects.toThrow(/not allowed/);
    expect(existsSync(join(runRoot, 'artifacts/result.json'))).toBe(false);
  });

  it('rejects checkpoint resume when the waiting Build brief is missing', async () => {
    const { workflow, bytes } = checkpointWorkflow({ safeDefault: 'continue' });
    const runRoot = join(runRootBase, 'resume-missing-brief');

    await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b3000000-0000-0000-0000-000000000006'),
      goal: 'Reject missing brief on resume',
      rigor: 'deep',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 3, 40, 0)),
    });
    rmSync(join(runRoot, 'artifacts/build/brief.json'));

    await expect(
      resumeWorkflowCheckpoint({
        runRoot,
        selection: 'continue',
        projectRoot: process.cwd(),
        now: deterministicNow(Date.UTC(2026, 3, 25, 3, 45, 0)),
      }),
    ).rejects.toThrow(/brief\.json/);
    expect(existsSync(join(runRoot, 'artifacts/result.json'))).toBe(false);
  });

  it('rejects checkpoint resume when the waiting Build brief was replaced', async () => {
    const { workflow, bytes } = checkpointWorkflow({ safeDefault: 'continue' });
    const runRoot = join(runRootBase, 'resume-tampered-brief');

    await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b3000000-0000-0000-0000-000000000009'),
      goal: 'Reject tampered brief on resume',
      rigor: 'deep',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 4, 10, 0)),
    });
    writeFileSync(
      join(runRoot, 'artifacts/build/brief.json'),
      `${JSON.stringify(
        {
          objective: 'Tampered objective',
          scope: 'Tampered scope',
          success_criteria: ['Tampered criterion'],
          verification_command_candidates: [
            {
              id: 'tampered',
              cwd: '.',
              argv: [process.execPath, '-e', "process.stdout.write('tampered')"],
              timeout_ms: 1_000,
              max_output_bytes: 20_000,
              env: {},
            },
          ],
          checkpoint: {
            request_path: 'artifacts/checkpoints/frame-step-request.json',
            allowed_choices: ['continue', 'revise'],
          },
        },
        null,
        2,
      )}\n`,
    );

    await expect(
      resumeWorkflowCheckpoint({
        runRoot,
        selection: 'continue',
        projectRoot: process.cwd(),
        now: deterministicNow(Date.UTC(2026, 3, 25, 4, 15, 0)),
      }),
    ).rejects.toThrow(/brief hash differs/);
    expect(existsSync(join(runRoot, 'artifacts/result.json'))).toBe(false);
  });

  it('rejects checkpoint resume when the request and Build brief were replaced together', async () => {
    const { workflow, bytes } = checkpointWorkflow({ safeDefault: 'continue' });
    const runRoot = join(runRootBase, 'resume-tampered-request-and-brief');

    await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b3000000-0000-0000-0000-000000000012'),
      goal: 'Reject tampered request and brief on resume',
      rigor: 'deep',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 4, 40, 0)),
    });
    const tamperedBrief = `${JSON.stringify(
      {
        objective: 'Tampered objective',
        scope: 'Tampered scope',
        success_criteria: ['Tampered criterion'],
        verification_command_candidates: [
          {
            id: 'tampered',
            cwd: '.',
            argv: [process.execPath, '-e', "process.stdout.write('tampered')"],
            timeout_ms: 1_000,
            max_output_bytes: 20_000,
            env: {},
          },
        ],
        checkpoint: {
          request_path: 'artifacts/checkpoints/frame-step-request.json',
          allowed_choices: ['continue', 'revise'],
        },
      },
      null,
      2,
    )}\n`;
    writeFileSync(join(runRoot, 'artifacts/build/brief.json'), tamperedBrief);
    writeFileSync(
      join(runRoot, 'artifacts/checkpoints/frame-step-request.json'),
      `${JSON.stringify(
        {
          schema_version: 1,
          step_id: 'frame-step',
          prompt: 'Frame',
          allowed_choices: ['continue', 'revise'],
          safe_default_choice: 'continue',
          execution_context: {
            project_root: process.cwd(),
            selection_config_layers: [],
            build_brief_sha256: sha256Hex(tamperedBrief),
          },
        },
        null,
        2,
      )}\n`,
    );

    await expect(
      resumeWorkflowCheckpoint({
        runRoot,
        selection: 'continue',
        projectRoot: process.cwd(),
        now: deterministicNow(Date.UTC(2026, 3, 25, 4, 45, 0)),
      }),
    ).rejects.toThrow(/request hash differs/);
    expect(existsSync(join(runRoot, 'artifacts/result.json'))).toBe(false);
  });

  it('resumes post-checkpoint dispatch with the original selection context', async () => {
    const { workflow, bytes } = checkpointToDispatchWorkflow();
    const runRoot = join(runRootBase, 'resume-dispatch-context');
    const captured: DispatchInput[] = [];
    const dispatcher: DispatchFn = {
      adapterName: 'agent',
      dispatch: async (input): Promise<DispatchResult> => {
        captured.push(input);
        return {
          request_payload: input.prompt,
          receipt_id: 'resume-dispatch-context',
          result_body: '{"verdict":"accept"}',
          duration_ms: 1,
          cli_version: '0.0.0-test',
        };
      },
    };

    await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b3000000-0000-0000-0000-000000000007'),
      goal: 'Resume dispatch with original config',
      rigor: 'deep',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 3, 50, 0)),
      selectionConfigLayers: [
        {
          layer: 'invocation',
          config: {
            schema_version: 1,
            dispatch: { default: 'auto', roles: {}, circuits: {}, adapters: {} },
            circuits: {},
            defaults: {
              selection: {
                model: { provider: 'anthropic', model: 'claude-resume-original' },
                effort: 'high',
                skills: { mode: 'replace', skills: [SkillId.parse('tdd')] },
                invocation_options: {},
              },
            },
          },
        },
      ],
    });

    const resumed = await resumeWorkflowCheckpoint({
      runRoot,
      selection: 'continue',
      projectRoot: process.cwd(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 3, 55, 0)),
      dispatcher,
      selectionConfigLayers: [
        {
          layer: 'invocation',
          config: {
            schema_version: 1,
            dispatch: { default: 'auto', roles: {}, circuits: {}, adapters: {} },
            circuits: {},
            defaults: {
              selection: {
                model: { provider: 'openai', model: 'wrong-resume-model' },
                effort: 'low',
                skills: { mode: 'replace', skills: [] },
                invocation_options: {},
              },
            },
          },
        },
      ],
    });

    expect(resumed.result.outcome).toBe('complete');
    expect(captured).toHaveLength(1);
    expect(captured[0]?.resolvedSelection).toMatchObject({
      model: { provider: 'anthropic', model: 'claude-resume-original' },
      effort: 'high',
      skills: ['tdd'],
    });
  });

  it('resumes post-checkpoint dispatch with original empty selection context', async () => {
    const { workflow, bytes } = checkpointToDispatchWorkflow();
    const runRoot = join(runRootBase, 'resume-empty-dispatch-context');
    const captured: DispatchInput[] = [];
    const dispatcher: DispatchFn = {
      adapterName: 'agent',
      dispatch: async (input): Promise<DispatchResult> => {
        captured.push(input);
        return {
          request_payload: input.prompt,
          receipt_id: 'resume-empty-dispatch-context',
          result_body: '{"verdict":"accept"}',
          duration_ms: 1,
          cli_version: '0.0.0-test',
        };
      },
    };

    await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b3000000-0000-0000-0000-000000000010'),
      goal: 'Resume dispatch with original empty config',
      rigor: 'deep',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 4, 20, 0)),
    });

    const resumed = await resumeWorkflowCheckpoint({
      runRoot,
      selection: 'continue',
      projectRoot: process.cwd(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 4, 25, 0)),
      dispatcher,
      selectionConfigLayers: [
        {
          layer: 'invocation',
          config: {
            schema_version: 1,
            dispatch: { default: 'auto', roles: {}, circuits: {}, adapters: {} },
            circuits: {},
            defaults: {
              selection: {
                model: { provider: 'openai', model: 'wrong-resume-model' },
                effort: 'low',
                skills: { mode: 'replace', skills: [] },
                invocation_options: {},
              },
            },
          },
        },
      ],
    });

    expect(resumed.result.outcome).toBe('complete');
    expect(captured).toHaveLength(1);
    expect(captured[0]?.resolvedSelection?.model).toBeUndefined();
    expect(captured[0]?.resolvedSelection?.effort).toBeUndefined();
    expect(captured[0]?.resolvedSelection?.skills).toEqual([]);
  });

  it('resumes post-checkpoint verification with the original project root', async () => {
    const originalProjectRoot = join(runRootBase, 'original-project');
    const wrongProjectRoot = join(runRootBase, 'wrong-project');
    mkdirSync(originalProjectRoot, { recursive: true });
    mkdirSync(wrongProjectRoot, { recursive: true });
    writeFileSync(join(originalProjectRoot, 'marker.txt'), 'present\n');
    const { workflow, bytes } = checkpointToVerificationWorkflow();
    const runRoot = join(runRootBase, 'resume-verification-context');

    await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      projectRoot: originalProjectRoot,
      runId: RunId.parse('b3000000-0000-0000-0000-000000000008'),
      goal: 'Resume verification with original project root',
      rigor: 'deep',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 4, 0, 0)),
    });

    const resumed = await resumeWorkflowCheckpoint({
      runRoot,
      selection: 'continue',
      projectRoot: wrongProjectRoot,
      now: deterministicNow(Date.UTC(2026, 3, 25, 4, 5, 0)),
    });

    expect(resumed.result.outcome).toBe('complete');
    const verification = BuildVerification.parse(
      readJson(runRoot, 'artifacts/build/verification.json'),
    );
    expect(verification.overall_status).toBe('passed');
  });

  it('does not borrow a resume-time project root when the original run had none', async () => {
    const resumeProjectRoot = join(runRootBase, 'resume-project');
    mkdirSync(resumeProjectRoot, { recursive: true });
    writeFileSync(join(resumeProjectRoot, 'marker.txt'), 'present\n');
    const { workflow, bytes } = checkpointToVerificationWorkflow();
    const runRoot = join(runRootBase, 'resume-no-project-root');

    await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('b3000000-0000-0000-0000-000000000011'),
      goal: 'Resume verification without borrowing project root',
      rigor: 'deep',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 4, 30, 0)),
    });

    const resumed = await resumeWorkflowCheckpoint({
      runRoot,
      selection: 'continue',
      projectRoot: resumeProjectRoot,
      now: deterministicNow(Date.UTC(2026, 3, 25, 4, 35, 0)),
    });

    expect(resumed.result.outcome).toBe('aborted');
    expect(resumed.result.reason).toMatch(/requires WorkflowInvocation\.projectRoot/);
  });

  it('resolves autonomous rigor only through a declared safe autonomous choice', async () => {
    const { workflow, bytes } = checkpointWorkflow({
      safeDefault: 'continue',
      safeAutonomous: 'continue',
    });
    const runRoot = join(runRootBase, 'autonomous');

    const outcome = await runWorkflow({
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

    const outcome = await runWorkflow({
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
