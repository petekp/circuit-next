import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BuildBrief, BuildVerification } from '../../src/flows/build/reports.js';
import type { RelayResult } from '../../src/runtime/connectors/shared.js';
import { sha256Hex } from '../../src/runtime/connectors/shared.js';
import {
  type RelayFn,
  type RelayInput,
  resumeCompiledFlowCheckpoint,
  runCompiledFlow,
} from '../../src/runtime/runner.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { RunId } from '../../src/schemas/ids.js';
import { SkillId } from '../../src/schemas/ids.js';

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
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

function checkpointCompiledFlow(options: {
  safeDefault?: string;
  safeAutonomous?: string;
}): { flow: CompiledFlow; bytes: Buffer } {
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
        depth: 'standard',
        description: 'test entry mode',
      },
    ],
    stages: [
      {
        id: 'frame-stage',
        title: 'Frame',
        canonical: 'frame',
        steps: ['frame-step'],
      },
    ],
    stage_path_policy: {
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
          request: 'reports/checkpoints/frame-step-request.json',
          response: 'reports/checkpoints/frame-step-response.json',
          report: { path: 'reports/build/brief.json', schema: 'build.brief@v1' },
        },
        check: {
          kind: 'checkpoint_selection',
          source: { kind: 'checkpoint_response', ref: 'response' },
          allow: ['continue', 'revise'],
        },
      },
    ],
  };
  const bytes = Buffer.from(JSON.stringify(raw));
  return { flow: CompiledFlow.parse(raw), bytes };
}

function checkpointToRelayCompiledFlow(): { flow: CompiledFlow; bytes: Buffer } {
  const raw = {
    schema_version: '2',
    id: 'build-checkpoint-relay-test',
    version: '0.1.0',
    purpose: 'test checkpoint resume context for relay',
    entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'frame-step',
        depth: 'standard',
        description: 'test entry mode',
      },
    ],
    stages: [
      { id: 'frame-stage', title: 'Frame', canonical: 'frame', steps: ['frame-step'] },
      { id: 'act-stage', title: 'Act', canonical: 'act', steps: ['relay-step'] },
    ],
    stage_path_policy: {
      mode: 'partial',
      omits: ['analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'test-only checkpoint-to-relay resume.',
    },
    steps: [
      {
        id: 'frame-step',
        title: 'Frame',
        protocol: 'build-frame@v1',
        reads: [],
        routes: { pass: 'relay-step' },
        executor: 'orchestrator',
        kind: 'checkpoint',
        policy: {
          prompt: 'Frame',
          choices: [{ id: 'continue' }],
          safe_default_choice: 'continue',
          build_brief: {
            scope: 'Relay resume context test',
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
          request: 'reports/checkpoints/frame-step-request.json',
          response: 'reports/checkpoints/frame-step-response.json',
          report: { path: 'reports/build/brief.json', schema: 'build.brief@v1' },
        },
        check: {
          kind: 'checkpoint_selection',
          source: { kind: 'checkpoint_response', ref: 'response' },
          allow: ['continue'],
        },
      },
      {
        id: 'relay-step',
        title: 'Relay',
        protocol: 'build-act@v1',
        reads: ['reports/build/brief.json'],
        routes: { pass: '@complete' },
        executor: 'worker',
        kind: 'relay',
        role: 'implementer',
        writes: {
          request: 'transcript/relay-request.txt',
          receipt: 'transcript/relay-receipt.json',
          result: 'transcript/relay-result.md',
        },
        check: {
          kind: 'result_verdict',
          source: { kind: 'relay_result', ref: 'result' },
          pass: ['accept'],
        },
      },
    ],
  };
  const bytes = Buffer.from(JSON.stringify(raw));
  return { flow: CompiledFlow.parse(raw), bytes };
}

function checkpointToVerificationCompiledFlow(commandCwd = '.'): {
  flow: CompiledFlow;
  bytes: Buffer;
} {
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
        depth: 'standard',
        description: 'test entry mode',
      },
    ],
    stages: [
      { id: 'frame-stage', title: 'Frame', canonical: 'frame', steps: ['frame-step'] },
      { id: 'plan-stage', title: 'Plan', canonical: 'plan', steps: ['plan-step'] },
      { id: 'verify-stage', title: 'Verify', canonical: 'verify', steps: ['verify-step'] },
    ],
    stage_path_policy: {
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
          request: 'reports/checkpoints/frame-step-request.json',
          response: 'reports/checkpoints/frame-step-response.json',
          report: { path: 'reports/build/brief.json', schema: 'build.brief@v1' },
        },
        check: {
          kind: 'checkpoint_selection',
          source: { kind: 'checkpoint_response', ref: 'response' },
          allow: ['continue'],
        },
      },
      {
        id: 'plan-step',
        title: 'Plan',
        protocol: 'build-plan@v1',
        reads: ['reports/build/brief.json'],
        routes: { pass: 'verify-step' },
        executor: 'orchestrator',
        kind: 'compose',
        writes: { report: { path: 'reports/build/plan.json', schema: 'build.plan@v1' } },
        check: {
          kind: 'schema_sections',
          source: { kind: 'report', ref: 'report' },
          required: ['objective', 'verification'],
        },
      },
      {
        id: 'verify-step',
        title: 'Verify',
        protocol: 'build-verify@v1',
        reads: ['reports/build/plan.json'],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'verification',
        writes: {
          report: { path: 'reports/build/verification.json', schema: 'build.verification@v1' },
        },
        check: {
          kind: 'schema_sections',
          source: { kind: 'report', ref: 'report' },
          required: ['overall_status', 'commands'],
        },
      },
    ],
  };
  const bytes = Buffer.from(JSON.stringify(raw));
  return { flow: CompiledFlow.parse(raw), bytes };
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = join(tmpdir(), `circuit-next-build-checkpoint-${randomUUID()}`);
  mkdirSync(runFolderBase, { recursive: true });
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('Build checkpoint execution substrate', () => {
  it('resolves standard depth through a declared safe default choice', async () => {
    const { flow, bytes } = checkpointCompiledFlow({ safeDefault: 'continue' });
    const runFolder = join(runFolderBase, 'safe-default');

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b3000000-0000-0000-0000-000000000000'),
      goal: 'Frame a Build run',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 3, 0, 0)),
    });

    expect(outcome.result.outcome).toBe('complete');
    const brief = BuildBrief.parse(readJson(runFolder, 'reports/build/brief.json'));
    expect(brief.objective).toBe('Frame a Build run');
    expect(brief.checkpoint).toMatchObject({
      request_path: 'reports/checkpoints/frame-step-request.json',
      response_path: 'reports/checkpoints/frame-step-response.json',
      allowed_choices: ['continue', 'revise'],
    });
    const resolved = outcome.trace_entrys.find(
      (trace_entry) => trace_entry.kind === 'checkpoint.resolved',
    );
    expect(resolved).toMatchObject({
      selection: 'continue',
      auto_resolved: true,
      resolution_source: 'safe-default',
    });
  });

  it('leaves deep depth paused-open with no run.closed and no result report', async () => {
    const { flow, bytes } = checkpointCompiledFlow({ safeDefault: 'continue' });
    const runFolder = join(runFolderBase, 'waiting');

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b3000000-0000-0000-0000-000000000001'),
      goal: 'Frame a deep Build run',
      depth: 'deep',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 3, 5, 0)),
    });

    const waiting = outcome.result;
    if (waiting.outcome !== 'checkpoint_waiting') {
      throw new Error(`expected checkpoint_waiting, got ${waiting.outcome}`);
    }
    expect(waiting.checkpoint).toMatchObject({
      step_id: 'frame-step',
      request_path: join(runFolder, 'reports/checkpoints/frame-step-request.json'),
      allowed_choices: ['continue', 'revise'],
    });
    expect(outcome.snapshot.status).toBe('in_progress');
    expect(outcome.snapshot.current_step).toBe('frame-step');
    expect(outcome.trace_entrys.some((trace_entry) => trace_entry.kind === 'run.closed')).toBe(
      false,
    );
    expect(existsSync(join(runFolder, 'reports/result.json'))).toBe(false);
    expect(existsSync(join(runFolder, 'reports/checkpoints/frame-step-response.json'))).toBe(false);
    const brief = BuildBrief.parse(readJson(runFolder, 'reports/build/brief.json'));
    expect(brief.objective).toBe('Frame a deep Build run');
    // Brief is fully populated at first write — response_path always
    // resolves to step.writes.response, even before operator selection.
    // The response file itself is created only at resolution.
    expect(brief.checkpoint.response_path).toBe('reports/checkpoints/frame-step-response.json');
  });

  it('resumes a paused-open checkpoint through an operator selection', async () => {
    const { flow, bytes } = checkpointCompiledFlow({ safeDefault: 'continue' });
    const runFolder = join(runFolderBase, 'resume-waiting');

    await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b3000000-0000-0000-0000-000000000004'),
      goal: 'Resume a deep Build run',
      depth: 'deep',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 3, 20, 0)),
    });

    const resumed = await resumeCompiledFlowCheckpoint({
      runFolder,
      selection: 'continue',
      projectRoot: process.cwd(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 3, 25, 0)),
    });

    expect(resumed.result.outcome).toBe('complete');
    expect(resumed.snapshot.status).toBe('complete');
    const resolved = resumed.trace_entrys.find(
      (trace_entry) => trace_entry.kind === 'checkpoint.resolved',
    );
    expect(resolved).toMatchObject({
      selection: 'continue',
      auto_resolved: false,
      resolution_source: 'operator',
      response_path: 'reports/checkpoints/frame-step-response.json',
    });
    const brief = BuildBrief.parse(readJson(runFolder, 'reports/build/brief.json'));
    expect(brief.objective).toBe('Resume a deep Build run');
    expect(brief.checkpoint.response_path).toBe('reports/checkpoints/frame-step-response.json');
    expect(readJson(runFolder, 'reports/result.json')).toMatchObject({ outcome: 'complete' });

    // Resume-crash recoverability invariant: the brief is written
    // exactly once for the frame-step checkpoint — at request creation —
    // and is never re-stamped during resolution. This eliminates the
    // crash window between a stamped-brief write and the
    // checkpoint.resolved trace_entry. A second step.report_written would
    // mean the brief is being mutated post-request, re-opening that
    // window.
    const briefReportWrites = resumed.trace_entrys.filter(
      (trace_entry) =>
        trace_entry.kind === 'step.report_written' &&
        (trace_entry.step_id as unknown as string) === 'frame-step' &&
        trace_entry.report_path === 'reports/build/brief.json',
    );
    expect(briefReportWrites).toHaveLength(1);
  });

  it('rejects checkpoint resume choices outside the declared allow list', async () => {
    const { flow, bytes } = checkpointCompiledFlow({ safeDefault: 'continue' });
    const runFolder = join(runFolderBase, 'resume-reject');

    await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b3000000-0000-0000-0000-000000000005'),
      goal: 'Reject bad resume choice',
      depth: 'deep',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 3, 30, 0)),
    });

    await expect(
      resumeCompiledFlowCheckpoint({
        runFolder,
        selection: 'ship-it-anyway',
        projectRoot: process.cwd(),
        now: deterministicNow(Date.UTC(2026, 3, 25, 3, 35, 0)),
      }),
    ).rejects.toThrow(/not allowed/);
    expect(existsSync(join(runFolder, 'reports/result.json'))).toBe(false);
  });

  it('rejects checkpoint resume when the waiting Build brief is missing', async () => {
    const { flow, bytes } = checkpointCompiledFlow({ safeDefault: 'continue' });
    const runFolder = join(runFolderBase, 'resume-missing-brief');

    await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b3000000-0000-0000-0000-000000000006'),
      goal: 'Reject missing brief on resume',
      depth: 'deep',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 3, 40, 0)),
    });
    rmSync(join(runFolder, 'reports/build/brief.json'));

    await expect(
      resumeCompiledFlowCheckpoint({
        runFolder,
        selection: 'continue',
        projectRoot: process.cwd(),
        now: deterministicNow(Date.UTC(2026, 3, 25, 3, 45, 0)),
      }),
    ).rejects.toThrow(/brief\.json/);
    expect(existsSync(join(runFolder, 'reports/result.json'))).toBe(false);
  });

  it('rejects checkpoint resume when the waiting Build brief was replaced', async () => {
    const { flow, bytes } = checkpointCompiledFlow({ safeDefault: 'continue' });
    const runFolder = join(runFolderBase, 'resume-tampered-brief');

    await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b3000000-0000-0000-0000-000000000009'),
      goal: 'Reject tampered brief on resume',
      depth: 'deep',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 4, 10, 0)),
    });
    writeFileSync(
      join(runFolder, 'reports/build/brief.json'),
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
            request_path: 'reports/checkpoints/frame-step-request.json',
            allowed_choices: ['continue', 'revise'],
          },
        },
        null,
        2,
      )}\n`,
    );

    await expect(
      resumeCompiledFlowCheckpoint({
        runFolder,
        selection: 'continue',
        projectRoot: process.cwd(),
        now: deterministicNow(Date.UTC(2026, 3, 25, 4, 15, 0)),
      }),
    ).rejects.toThrow(/brief hash differs/);
    expect(existsSync(join(runFolder, 'reports/result.json'))).toBe(false);
  });

  it('rejects checkpoint resume when the request and Build brief were replaced together', async () => {
    const { flow, bytes } = checkpointCompiledFlow({ safeDefault: 'continue' });
    const runFolder = join(runFolderBase, 'resume-tampered-request-and-brief');

    await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b3000000-0000-0000-0000-000000000012'),
      goal: 'Reject tampered request and brief on resume',
      depth: 'deep',
      change_kind: change_kind(),
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
          request_path: 'reports/checkpoints/frame-step-request.json',
          allowed_choices: ['continue', 'revise'],
        },
      },
      null,
      2,
    )}\n`;
    writeFileSync(join(runFolder, 'reports/build/brief.json'), tamperedBrief);
    writeFileSync(
      join(runFolder, 'reports/checkpoints/frame-step-request.json'),
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
            checkpoint_report_sha256: sha256Hex(tamperedBrief),
          },
        },
        null,
        2,
      )}\n`,
    );

    await expect(
      resumeCompiledFlowCheckpoint({
        runFolder,
        selection: 'continue',
        projectRoot: process.cwd(),
        now: deterministicNow(Date.UTC(2026, 3, 25, 4, 45, 0)),
      }),
    ).rejects.toThrow(/request hash differs/);
    expect(existsSync(join(runFolder, 'reports/result.json'))).toBe(false);
  });

  it('resumes post-checkpoint relay with the original selection context', async () => {
    const { flow, bytes } = checkpointToRelayCompiledFlow();
    const runFolder = join(runFolderBase, 'resume-relay-context');
    const captured: RelayInput[] = [];
    const relayer: RelayFn = {
      connectorName: 'agent',
      relay: async (input): Promise<RelayResult> => {
        captured.push(input);
        return {
          request_payload: input.prompt,
          receipt_id: 'resume-relay-context',
          result_body: '{"verdict":"accept"}',
          duration_ms: 1,
          cli_version: '0.0.0-test',
        };
      },
    };

    await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b3000000-0000-0000-0000-000000000007'),
      goal: 'Resume relay with original config',
      depth: 'deep',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 3, 50, 0)),
      selectionConfigLayers: [
        {
          layer: 'invocation',
          config: {
            schema_version: 1,
            relay: { default: 'auto', roles: {}, circuits: {}, connectors: {} },
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

    const resumed = await resumeCompiledFlowCheckpoint({
      runFolder,
      selection: 'continue',
      projectRoot: process.cwd(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 3, 55, 0)),
      relayer,
      selectionConfigLayers: [
        {
          layer: 'invocation',
          config: {
            schema_version: 1,
            relay: { default: 'auto', roles: {}, circuits: {}, connectors: {} },
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

  it('resumes post-checkpoint relay with original empty selection context', async () => {
    const { flow, bytes } = checkpointToRelayCompiledFlow();
    const runFolder = join(runFolderBase, 'resume-empty-relay-context');
    const captured: RelayInput[] = [];
    const relayer: RelayFn = {
      connectorName: 'agent',
      relay: async (input): Promise<RelayResult> => {
        captured.push(input);
        return {
          request_payload: input.prompt,
          receipt_id: 'resume-empty-relay-context',
          result_body: '{"verdict":"accept"}',
          duration_ms: 1,
          cli_version: '0.0.0-test',
        };
      },
    };

    await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b3000000-0000-0000-0000-000000000010'),
      goal: 'Resume relay with original empty config',
      depth: 'deep',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 4, 20, 0)),
    });

    const resumed = await resumeCompiledFlowCheckpoint({
      runFolder,
      selection: 'continue',
      projectRoot: process.cwd(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 4, 25, 0)),
      relayer,
      selectionConfigLayers: [
        {
          layer: 'invocation',
          config: {
            schema_version: 1,
            relay: { default: 'auto', roles: {}, circuits: {}, connectors: {} },
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
    const originalProjectRoot = join(runFolderBase, 'original-project');
    const wrongProjectRoot = join(runFolderBase, 'wrong-project');
    mkdirSync(originalProjectRoot, { recursive: true });
    mkdirSync(wrongProjectRoot, { recursive: true });
    writeFileSync(join(originalProjectRoot, 'marker.txt'), 'present\n');
    const { flow, bytes } = checkpointToVerificationCompiledFlow();
    const runFolder = join(runFolderBase, 'resume-verification-context');

    await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      projectRoot: originalProjectRoot,
      runId: RunId.parse('b3000000-0000-0000-0000-000000000008'),
      goal: 'Resume verification with original project root',
      depth: 'deep',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 4, 0, 0)),
    });

    const resumed = await resumeCompiledFlowCheckpoint({
      runFolder,
      selection: 'continue',
      projectRoot: wrongProjectRoot,
      now: deterministicNow(Date.UTC(2026, 3, 25, 4, 5, 0)),
    });

    expect(resumed.result.outcome).toBe('complete');
    const verification = BuildVerification.parse(
      readJson(runFolder, 'reports/build/verification.json'),
    );
    expect(verification.overall_status).toBe('passed');
  });

  it('does not borrow a resume-time project root when the original run had none', async () => {
    const resumeProjectRoot = join(runFolderBase, 'resume-project');
    mkdirSync(resumeProjectRoot, { recursive: true });
    writeFileSync(join(resumeProjectRoot, 'marker.txt'), 'present\n');
    const { flow, bytes } = checkpointToVerificationCompiledFlow();
    const runFolder = join(runFolderBase, 'resume-no-project-root');

    await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('b3000000-0000-0000-0000-000000000011'),
      goal: 'Resume verification without borrowing project root',
      depth: 'deep',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 4, 30, 0)),
    });

    const resumed = await resumeCompiledFlowCheckpoint({
      runFolder,
      selection: 'continue',
      projectRoot: resumeProjectRoot,
      now: deterministicNow(Date.UTC(2026, 3, 25, 4, 35, 0)),
    });

    expect(resumed.result.outcome).toBe('aborted');
    expect(resumed.result.reason).toMatch(/requires CompiledFlowInvocation\.projectRoot/);
  });

  it('resolves autonomous depth only through a declared safe autonomous choice', async () => {
    const { flow, bytes } = checkpointCompiledFlow({
      safeDefault: 'continue',
      safeAutonomous: 'continue',
    });
    const runFolder = join(runFolderBase, 'autonomous');

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b3000000-0000-0000-0000-000000000002'),
      goal: 'Frame an autonomous Build run',
      depth: 'autonomous',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 3, 10, 0)),
    });

    expect(outcome.result.outcome).toBe('complete');
    const resolved = outcome.trace_entrys.find(
      (trace_entry) => trace_entry.kind === 'checkpoint.resolved',
    );
    expect(resolved).toMatchObject({
      selection: 'continue',
      auto_resolved: true,
      resolution_source: 'safe-autonomous',
    });
  });

  it('fails autonomous depth closed when no safe autonomous choice exists', async () => {
    const { flow, bytes } = checkpointCompiledFlow({ safeDefault: 'continue' });
    const runFolder = join(runFolderBase, 'autonomous-missing');

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      projectRoot: process.cwd(),
      runId: RunId.parse('b3000000-0000-0000-0000-000000000003'),
      goal: 'Reject unsafe autonomous checkpoint',
      depth: 'autonomous',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 25, 3, 15, 0)),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toMatch(/safe autonomous choice/);
    expect(existsSync(join(runFolder, 'reports/result.json'))).toBe(true);
  });
});
