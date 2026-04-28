import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { main } from '../../src/cli/circuit.js';
import type { RelayResult } from '../../src/runtime/connectors/shared.js';
import type { RelayFn, RelayInput } from '../../src/runtime/runner.js';

const EXPLORE_SYNTHESIS_BODY = JSON.stringify({
  verdict: 'accept',
  subject: 'CLI-routed explore goal',
  recommendation: 'Return the requested exploration summary',
  success_condition_alignment: 'The response satisfies the exploratory goal',
  supporting_aspects: [
    {
      aspect: 'routing',
      contribution: 'The explore flow reached the synthesize step',
    },
  ],
});

const EXPLORE_REVIEW_VERDICT_BODY = JSON.stringify({
  verdict: 'accept',
  overall_assessment: 'The exploratory compose is acceptable',
  objections: [],
  missed_angles: [],
});

const BUILD_IMPLEMENTATION_BODY = JSON.stringify({
  verdict: 'accept',
  summary: 'Implemented the requested change',
  changed_files: ['src/example.ts'],
  evidence: ['Stub implementation relay completed'],
});

const BUILD_REVIEW_BODY = JSON.stringify({
  verdict: 'accept',
  summary: 'No blocking issue found',
  findings: [],
});

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function relayerWithBody(body: string): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (input: RelayInput): Promise<RelayResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-receipt-cli-router',
      result_body:
        input.prompt.includes('Step: act-step') && body === '{"verdict":"accept"}'
          ? BUILD_IMPLEMENTATION_BODY
          : input.prompt.includes('Step: review-step') &&
              input.prompt.includes('build.review@v1') &&
              body === '{"verdict":"accept"}'
            ? BUILD_REVIEW_BODY
            : input.prompt.includes('Step: synthesize-step') && body === '{"verdict":"accept"}'
              ? EXPLORE_SYNTHESIS_BODY
              : input.prompt.includes('Step: review-step') && body === '{"verdict":"accept"}'
                ? EXPLORE_REVIEW_VERDICT_BODY
                : body,
      duration_ms: 1,
      cli_version: '0.0.0-stub',
    }),
  };
}

function traceEntryLog(runFolder: string): Array<Record<string, unknown>> {
  return readFileSync(join(runFolder, 'trace.ndjson'), 'utf8')
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function runMainJson(
  argv: readonly string[],
  relayBody: string,
): Promise<Record<string, unknown>> {
  let captured = '';
  const origWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;
  try {
    const exit = await main(argv, {
      relayer: relayerWithBody(relayBody),
      now: deterministicNow(Date.UTC(2026, 3, 24, 15, 0, 0)),
      runId: '84000000-0000-0000-0000-000000000001',
      configHomeDir: join(runFolderBase, 'empty-home'),
      configCwd: process.cwd(),
    });
    expect(exit).toBe(0);
  } finally {
    process.stdout.write = origWrite;
  }

  const parsed: unknown = JSON.parse(captured);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('CLI output was not a JSON object');
  }
  return parsed as Record<string, unknown>;
}

async function runMainExit(argv: readonly string[]): Promise<{ exit: number; stderr: string }> {
  let stderr = '';
  const origWrite = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stderr.write;
  try {
    const exit = await main(argv, {
      relayer: relayerWithBody('{"verdict":"accept"}'),
      now: deterministicNow(Date.UTC(2026, 3, 24, 15, 0, 0)),
      runId: '84000000-0000-0000-0000-000000000099',
      configHomeDir: join(runFolderBase, 'empty-home'),
      configCwd: process.cwd(),
    });
    return { exit, stderr };
  } finally {
    process.stderr.write = origWrite;
  }
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-cli-router-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('CLI router', () => {
  it('omitted flow positional routes review-like goals through the classifier', async () => {
    const output = await runMainJson(
      [
        '--goal',
        'review this patch for safety problems',
        '--run-folder',
        join(runFolderBase, 'review'),
      ],
      '{"verdict":"NO_ISSUES_FOUND","findings":[]}',
    );

    expect(output.flow_id).toBe('review');
    expect(output.selected_flow).toBe('review');
    expect(output.routed_by).toBe('classifier');
    expect(output.router_reason).toMatch(/review/i);
    expect(output.router_signal).toBeDefined();
    expect(output.outcome).toBe('complete');
  });

  it('omitted flow positional keeps exploratory goals on explore', async () => {
    const output = await runMainJson(
      ['--goal', 'map the current project state', '--run-folder', join(runFolderBase, 'explore')],
      '{"verdict":"accept"}',
    );

    expect(output.flow_id).toBe('explore');
    expect(output.selected_flow).toBe('explore');
    expect(output.routed_by).toBe('classifier');
    expect(output.router_signal).toBeUndefined();
    expect(output.outcome).toBe('complete');
  });

  it('omitted flow positional routes build-like goals through the classifier', async () => {
    const output = await runMainJson(
      ['--goal', 'develop: add a focused feature', '--run-folder', join(runFolderBase, 'build')],
      '{"verdict":"accept"}',
    );

    expect(output.flow_id).toBe('build');
    expect(output.selected_flow).toBe('build');
    expect(output.routed_by).toBe('classifier');
    expect(output.router_reason).toMatch(/implementation Build flow/i);
    expect(output.router_signal).toBeDefined();
    expect(output.outcome).toBe('complete');
  });

  it('omitted flow positional preserves router metadata on Build checkpoint_waiting output', async () => {
    const runFolder = join(runFolderBase, 'build-router-checkpoint-waiting');
    const output = await runMainJson(
      [
        '--goal',
        'develop: add a focused feature that waits for framing',
        '--depth',
        'deep',
        '--run-folder',
        runFolder,
      ],
      '{"verdict":"accept"}',
    );

    expect(output.schema_version).toBe(1);
    expect(output.flow_id).toBe('build');
    expect(output.selected_flow).toBe('build');
    expect(output.routed_by).toBe('classifier');
    expect(output.router_reason).toMatch(/implementation Build flow/i);
    expect(output.router_signal).toBeDefined();
    expect(output.outcome).toBe('checkpoint_waiting');
    expect(output).not.toHaveProperty('result_path');
    expect(output.checkpoint).toMatchObject({
      step_id: 'frame-step',
      request_path: join(runFolder, 'reports/checkpoints/frame-step-request.json'),
      allowed_choices: ['continue'],
    });
  });

  it('omitted flow positional keeps develop-prefixed planning goals on explore', async () => {
    const output = await runMainJson(
      [
        '--goal',
        'develop: create a new endpoint RFC',
        '--run-folder',
        join(runFolderBase, 'develop-planning'),
      ],
      '{"verdict":"accept"}',
    );

    expect(output.flow_id).toBe('explore');
    expect(output.selected_flow).toBe('explore');
    expect(output.routed_by).toBe('classifier');
    expect(output.router_signal).toBeUndefined();
    expect(output.outcome).toBe('complete');
  });

  it('explicit flow positional bypasses the classifier', async () => {
    const output = await runMainJson(
      [
        'explore',
        '--goal',
        'review this patch for safety problems',
        '--run-folder',
        join(runFolderBase, 'explicit-explore'),
      ],
      '{"verdict":"accept"}',
    );

    expect(output.flow_id).toBe('explore');
    expect(output.selected_flow).toBe('explore');
    expect(output.routed_by).toBe('explicit');
    expect(output.router_reason).toMatch(/explicit flow/i);
    expect(output.router_signal).toBeUndefined();
  });

  it('run --goal routes through the classifier', async () => {
    const output = await runMainJson(
      [
        'run',
        '--goal',
        'review this patch for safety problems',
        '--run-folder',
        join(runFolderBase, 'run-routed-review'),
      ],
      '{"verdict":"NO_ISSUES_FOUND","findings":[]}',
    );

    expect(output.flow_id).toBe('review');
    expect(output.routed_by).toBe('classifier');
    expect(output.outcome).toBe('complete');
  });

  it('run <flow> --goal bypasses the classifier', async () => {
    const output = await runMainJson(
      [
        'run',
        'explore',
        '--goal',
        'review this patch for safety problems',
        '--run-folder',
        join(runFolderBase, 'run-explicit-explore'),
      ],
      '{"verdict":"accept"}',
    );

    expect(output.flow_id).toBe('explore');
    expect(output.routed_by).toBe('explicit');
  });

  it('accepts --entry-mode and uses that mode depth when --depth is omitted', async () => {
    const runFolder = join(runFolderBase, 'build-lite-entry-mode');
    const output = await runMainJson(
      [
        'build',
        '--goal',
        'Add a tiny Build feature from the CLI',
        '--entry-mode',
        'lite',
        '--run-folder',
        runFolder,
      ],
      '{"verdict":"accept"}',
    );

    const trace_entries = traceEntryLog(runFolder);
    const bootstrap = trace_entries.find((trace_entry) => trace_entry.kind === 'run.bootstrapped');
    const relayStarted = trace_entries.find(
      (trace_entry) => trace_entry.kind === 'relay.started' && trace_entry.step_id === 'act-step',
    );
    expect(output.flow_id).toBe('build');
    expect(output.outcome).toBe('complete');
    expect(bootstrap).toMatchObject({ depth: 'lite' });
    expect(relayStarted?.resolved_selection).toMatchObject({ depth: 'lite' });
  });

  it('lets --depth override the selected --entry-mode default', async () => {
    const runFolder = join(runFolderBase, 'build-entry-mode-depth-override');
    const output = await runMainJson(
      [
        'build',
        '--goal',
        'Add a tiny Build feature from the CLI with an override',
        '--entry-mode',
        'deep',
        '--depth',
        'standard',
        '--run-folder',
        runFolder,
      ],
      '{"verdict":"accept"}',
    );

    const trace_entries = traceEntryLog(runFolder);
    const bootstrap = trace_entries.find((trace_entry) => trace_entry.kind === 'run.bootstrapped');
    const relayStarted = trace_entries.find(
      (trace_entry) => trace_entry.kind === 'relay.started' && trace_entry.step_id === 'act-step',
    );
    expect(output.flow_id).toBe('build');
    expect(output.outcome).toBe('complete');
    expect(bootstrap).toMatchObject({ depth: 'standard' });
    expect(relayStarted?.resolved_selection).toMatchObject({ depth: 'standard' });
  });

  it('lets explicit autonomous --depth override the default --entry-mode through checkpoint policy', async () => {
    const runFolder = join(runFolderBase, 'build-default-entry-autonomous-override');
    const output = await runMainJson(
      [
        'build',
        '--goal',
        'Add a tiny Build feature from the CLI with autonomous override',
        '--entry-mode',
        'default',
        '--depth',
        'autonomous',
        '--run-folder',
        runFolder,
      ],
      '{"verdict":"accept"}',
    );

    const trace_entries = traceEntryLog(runFolder);
    const bootstrap = trace_entries.find((trace_entry) => trace_entry.kind === 'run.bootstrapped');
    const checkpoint = trace_entries.find(
      (trace_entry) =>
        trace_entry.kind === 'checkpoint.resolved' && trace_entry.step_id === 'frame-step',
    );
    const relayStarted = trace_entries.find(
      (trace_entry) => trace_entry.kind === 'relay.started' && trace_entry.step_id === 'act-step',
    );
    expect(output.flow_id).toBe('build');
    expect(output.outcome).toBe('complete');
    expect(bootstrap).toMatchObject({ depth: 'autonomous' });
    expect(checkpoint).toMatchObject({ resolution_source: 'safe-autonomous' });
    expect(relayStarted?.resolved_selection).toMatchObject({ depth: 'autonomous' });
  });

  it('rejects fixture overrides whose flow id does not match the selected flow', async () => {
    await expect(
      main(
        [
          '--goal',
          'review this patch for safety problems',
          '--fixture',
          'generated/flows/explore/circuit.json',
          '--run-folder',
          join(runFolderBase, 'mismatch'),
        ],
        {
          relayer: relayerWithBody('{"verdict":"accept"}'),
          now: deterministicNow(Date.UTC(2026, 3, 24, 15, 0, 0)),
          runId: '84000000-0000-0000-0000-000000000004',
          configHomeDir: join(runFolderBase, 'empty-home'),
          configCwd: join(runFolderBase, 'empty-cwd'),
        },
      ),
    ).rejects.toThrow(/flow fixture id mismatch/i);
  });

  it('rejects an unknown --entry-mode before writing a run trace', async () => {
    const runFolder = join(runFolderBase, 'unknown-build-entry-mode');
    await expect(
      main(
        [
          'build',
          '--goal',
          'Try a missing Build entry mode',
          '--entry-mode',
          'missing',
          '--run-folder',
          runFolder,
        ],
        {
          relayer: relayerWithBody('{"verdict":"accept"}'),
          now: deterministicNow(Date.UTC(2026, 3, 24, 15, 0, 0)),
          runId: '84000000-0000-0000-0000-000000000005',
          configHomeDir: join(runFolderBase, 'empty-home'),
          configCwd: join(runFolderBase, 'empty-cwd'),
        },
      ),
    ).rejects.toThrow(/entry_mode named 'missing'/);
    expect(() => traceEntryLog(runFolder)).toThrow();
  });

  it('prints a versioned checkpoint_waiting envelope without result_path', async () => {
    const fixtureDir = join(runFolderBase, 'fixture');
    mkdirSync(fixtureDir, { recursive: true });
    const fixturePath = join(fixtureDir, 'circuit.json');
    writeFileSync(
      fixturePath,
      JSON.stringify({
        schema_version: '2',
        id: 'build-checkpoint-cli-test',
        version: '0.1.0',
        purpose: 'test CLI checkpoint waiting envelope',
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
          rationale: 'test-only checkpoint waiting envelope.',
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
              prompt: 'Frame',
              choices: [{ id: 'continue' }],
              safe_default_choice: 'continue',
              build_brief: {
                scope: 'CLI envelope test',
                success_criteria: ['Envelope is shaped'],
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
        ],
      }),
    );

    const output = await runMainJson(
      [
        'build-checkpoint-cli-test',
        '--goal',
        'Frame via CLI',
        '--depth',
        'deep',
        '--fixture',
        fixturePath,
        '--run-folder',
        join(runFolderBase, 'checkpoint-waiting'),
      ],
      '{"verdict":"accept"}',
    );

    expect(output.schema_version).toBe(1);
    expect(output.outcome).toBe('checkpoint_waiting');
    expect(output).not.toHaveProperty('result_path');
    expect(output.checkpoint).toMatchObject({
      step_id: 'frame-step',
      allowed_choices: ['continue'],
    });
  });

  it('resumes a checkpoint_waiting run from the saved manifest and operator choice', async () => {
    const fixtureDir = join(runFolderBase, 'resume-fixture');
    mkdirSync(fixtureDir, { recursive: true });
    const fixturePath = join(fixtureDir, 'circuit.json');
    writeFileSync(
      fixturePath,
      JSON.stringify({
        schema_version: '2',
        id: 'build-checkpoint-cli-resume-test',
        version: '0.1.0',
        purpose: 'test CLI checkpoint resume',
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
          rationale: 'test-only checkpoint resume.',
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
              prompt: 'Frame',
              choices: [{ id: 'continue' }, { id: 'revise' }],
              safe_default_choice: 'continue',
              build_brief: {
                scope: 'CLI resume test',
                success_criteria: ['Resume closes the run'],
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
      }),
    );
    const runFolder = join(runFolderBase, 'checkpoint-resume');

    const waiting = await runMainJson(
      [
        'build-checkpoint-cli-resume-test',
        '--goal',
        'Frame and resume via CLI',
        '--depth',
        'deep',
        '--fixture',
        fixturePath,
        '--run-folder',
        runFolder,
      ],
      '{"verdict":"accept"}',
    );
    expect(waiting.outcome).toBe('checkpoint_waiting');

    const resumed = await runMainJson(
      ['resume', '--run-folder', runFolder, '--checkpoint-choice', 'continue'],
      '{"verdict":"accept"}',
    );

    expect(resumed.schema_version).toBe(1);
    expect(resumed.outcome).toBe('complete');
    expect(resumed.run_folder).toBe(runFolder);
    expect(resumed).toHaveProperty('result_path');
  });

  it('rejects resume-only incompatible flags', async () => {
    const withDepth = await runMainExit([
      'resume',
      '--run-folder',
      join(runFolderBase, 'not-needed'),
      '--checkpoint-choice',
      'continue',
      '--depth',
      'deep',
    ]);
    expect(withDepth.exit).toBe(2);
    expect(withDepth.stderr).toMatch(/omit --depth/);

    const withFixture = await runMainExit([
      'resume',
      '--run-folder',
      join(runFolderBase, 'not-needed'),
      '--checkpoint-choice',
      'continue',
      '--fixture',
      join(runFolderBase, 'fixture.json'),
    ]);
    expect(withFixture.exit).toBe(2);
    expect(withFixture.stderr).toMatch(/omit --fixture/);

    const withEntryMode = await runMainExit([
      'resume',
      '--run-folder',
      join(runFolderBase, 'not-needed'),
      '--checkpoint-choice',
      'continue',
      '--entry-mode',
      'lite',
    ]);
    expect(withEntryMode.exit).toBe(2);
    expect(withEntryMode.stderr).toMatch(/omit --mode\/--entry-mode/);
  });

  it('rejects --depth on checkpoint resume', async () => {
    const withDepth = await runMainExit([
      'resume',
      '--run-folder',
      join(runFolderBase, 'not-needed'),
      '--checkpoint-choice',
      'continue',
      '--depth',
      'deep',
    ]);
    expect(withDepth.exit).toBe(2);
    expect(withDepth.stderr).toMatch(/omit --depth/);
  });

  it('accepts --mode as a synonym for --entry-mode', async () => {
    const withMode = await runMainExit([
      'resume',
      '--run-folder',
      join(runFolderBase, 'not-needed'),
      '--checkpoint-choice',
      'continue',
      '--mode',
      'lite',
    ]);
    expect(withMode.exit).toBe(2);
    expect(withMode.stderr).toMatch(/omit --mode\/--entry-mode/);
  });

  it('parses --run-folder before rejecting resume-only --depth', async () => {
    // Resume validates other flags after argv parsing; pairing --run-folder
    // with --depth exercises the downstream "omit --depth" branch. The
    // branch firing proves --run-folder parsed and populated the run-folder slot.
    const result = await runMainExit([
      'resume',
      '--run-folder',
      join(runFolderBase, 'not-needed'),
      '--checkpoint-choice',
      'continue',
      '--depth',
      'deep',
    ]);
    expect(result.exit).toBe(2);
    expect(result.stderr).toMatch(/omit --depth/);
  });

  it('rejects supplying --depth more than once', async () => {
    const conflict = await runMainExit([
      'resume',
      '--run-folder',
      join(runFolderBase, 'not-needed'),
      '--checkpoint-choice',
      'continue',
      '--depth',
      'standard',
      '--depth',
      'deep',
    ]);
    expect(conflict.exit).toBe(2);
    expect(conflict.stderr).toMatch(/supply --depth only once/);
  });

  it('rejects supplying both --mode and --entry-mode', async () => {
    const conflict = await runMainExit([
      'resume',
      '--run-folder',
      join(runFolderBase, 'not-needed'),
      '--checkpoint-choice',
      'continue',
      '--mode',
      'lite',
      '--entry-mode',
      'deep',
    ]);
    expect(conflict.exit).toBe(2);
    expect(conflict.stderr).toMatch(/use either --mode or --entry-mode, not both/);
  });

  it('rejects supplying --run-folder more than once', async () => {
    const conflict = await runMainExit([
      'resume',
      '--run-folder',
      join(runFolderBase, 'a'),
      '--run-folder',
      join(runFolderBase, 'b'),
      '--checkpoint-choice',
      'continue',
    ]);
    expect(conflict.exit).toBe(2);
    expect(conflict.stderr).toMatch(/supply --run-folder only once/);
  });

  it('keeps CLI help text aligned with the router-supported flow set', () => {
    const source = readFileSync(join(process.cwd(), 'src/cli/circuit.ts'), 'utf-8');
    expect(source).toContain('registered explore/review/fix/build flows');
    expect(source).not.toContain('registered explore/review/build flows');
    expect(source).not.toContain('registered explore/review flows');
  });
});
