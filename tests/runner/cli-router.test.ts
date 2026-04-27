import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { main } from '../../src/cli/circuit.js';
import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import type { DispatchFn, DispatchInput } from '../../src/runtime/runner.js';

const EXPLORE_SYNTHESIS_BODY = JSON.stringify({
  verdict: 'accept',
  subject: 'CLI-routed explore goal',
  recommendation: 'Return the requested exploration summary',
  success_condition_alignment: 'The response satisfies the exploratory goal',
  supporting_aspects: [
    {
      aspect: 'routing',
      contribution: 'The explore workflow reached the synthesize step',
    },
  ],
});

const EXPLORE_REVIEW_VERDICT_BODY = JSON.stringify({
  verdict: 'accept',
  overall_assessment: 'The exploratory synthesis is acceptable',
  objections: [],
  missed_angles: [],
});

const BUILD_IMPLEMENTATION_BODY = JSON.stringify({
  verdict: 'accept',
  summary: 'Implemented the requested change',
  changed_files: ['src/example.ts'],
  evidence: ['Stub implementation dispatch completed'],
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

function dispatcherWithBody(body: string): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async (input: DispatchInput): Promise<DispatchResult> => ({
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

function eventLog(runRoot: string): Array<Record<string, unknown>> {
  return readFileSync(join(runRoot, 'events.ndjson'), 'utf8')
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function runMainJson(
  argv: readonly string[],
  dispatchBody: string,
): Promise<Record<string, unknown>> {
  let captured = '';
  const origWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;
  try {
    const exit = await main(argv, {
      dispatcher: dispatcherWithBody(dispatchBody),
      now: deterministicNow(Date.UTC(2026, 3, 24, 15, 0, 0)),
      runId: '84000000-0000-0000-0000-000000000001',
      configHomeDir: join(runRootBase, 'empty-home'),
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
      dispatcher: dispatcherWithBody('{"verdict":"accept"}'),
      now: deterministicNow(Date.UTC(2026, 3, 24, 15, 0, 0)),
      runId: '84000000-0000-0000-0000-000000000099',
      configHomeDir: join(runRootBase, 'empty-home'),
      configCwd: process.cwd(),
    });
    return { exit, stderr };
  } finally {
    process.stderr.write = origWrite;
  }
}

let runRootBase: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-cli-router-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('P2.8 CLI router', () => {
  it('omitted workflow positional routes review-like goals through the classifier', async () => {
    const output = await runMainJson(
      [
        '--goal',
        'review this patch for safety problems',
        '--run-root',
        join(runRootBase, 'review'),
      ],
      '{"verdict":"NO_ISSUES_FOUND","findings":[]}',
    );

    expect(output.workflow_id).toBe('review');
    expect(output.selected_workflow).toBe('review');
    expect(output.routed_by).toBe('classifier');
    expect(output.router_reason).toMatch(/review/i);
    expect(output.router_signal).toBeDefined();
    expect(output.outcome).toBe('complete');
  });

  it('omitted workflow positional keeps exploratory goals on explore', async () => {
    const output = await runMainJson(
      ['--goal', 'map the current project state', '--run-root', join(runRootBase, 'explore')],
      '{"verdict":"accept"}',
    );

    expect(output.workflow_id).toBe('explore');
    expect(output.selected_workflow).toBe('explore');
    expect(output.routed_by).toBe('classifier');
    expect(output.router_signal).toBeUndefined();
    expect(output.outcome).toBe('complete');
  });

  it('omitted workflow positional routes build-like goals through the classifier', async () => {
    const output = await runMainJson(
      ['--goal', 'develop: add a focused feature', '--run-root', join(runRootBase, 'build')],
      '{"verdict":"accept"}',
    );

    expect(output.workflow_id).toBe('build');
    expect(output.selected_workflow).toBe('build');
    expect(output.routed_by).toBe('classifier');
    expect(output.router_reason).toMatch(/implementation Build workflow/i);
    expect(output.router_signal).toBeDefined();
    expect(output.outcome).toBe('complete');
  });

  it('omitted workflow positional preserves router metadata on Build checkpoint_waiting output', async () => {
    const runRoot = join(runRootBase, 'build-router-checkpoint-waiting');
    const output = await runMainJson(
      [
        '--goal',
        'develop: add a focused feature that waits for framing',
        '--rigor',
        'deep',
        '--run-root',
        runRoot,
      ],
      '{"verdict":"accept"}',
    );

    expect(output.schema_version).toBe(1);
    expect(output.workflow_id).toBe('build');
    expect(output.selected_workflow).toBe('build');
    expect(output.routed_by).toBe('classifier');
    expect(output.router_reason).toMatch(/implementation Build workflow/i);
    expect(output.router_signal).toBeDefined();
    expect(output.outcome).toBe('checkpoint_waiting');
    expect(output).not.toHaveProperty('result_path');
    expect(output.checkpoint).toMatchObject({
      step_id: 'frame-step',
      request_path: join(runRoot, 'artifacts/checkpoints/frame-step-request.json'),
      allowed_choices: ['continue'],
    });
  });

  it('omitted workflow positional keeps develop-prefixed planning goals on explore', async () => {
    const output = await runMainJson(
      [
        '--goal',
        'develop: create a new endpoint RFC',
        '--run-root',
        join(runRootBase, 'develop-planning'),
      ],
      '{"verdict":"accept"}',
    );

    expect(output.workflow_id).toBe('explore');
    expect(output.selected_workflow).toBe('explore');
    expect(output.routed_by).toBe('classifier');
    expect(output.router_signal).toBeUndefined();
    expect(output.outcome).toBe('complete');
  });

  it('explicit workflow positional bypasses the classifier', async () => {
    const output = await runMainJson(
      [
        'explore',
        '--goal',
        'review this patch for safety problems',
        '--run-root',
        join(runRootBase, 'explicit-explore'),
      ],
      '{"verdict":"accept"}',
    );

    expect(output.workflow_id).toBe('explore');
    expect(output.selected_workflow).toBe('explore');
    expect(output.routed_by).toBe('explicit');
    expect(output.router_reason).toMatch(/explicit workflow/i);
    expect(output.router_signal).toBeUndefined();
  });

  it('accepts --entry-mode and uses that mode rigor when --rigor is omitted', async () => {
    const runRoot = join(runRootBase, 'build-lite-entry-mode');
    const output = await runMainJson(
      [
        'build',
        '--goal',
        'Add a tiny Build feature from the CLI',
        '--entry-mode',
        'lite',
        '--run-root',
        runRoot,
      ],
      '{"verdict":"accept"}',
    );

    const events = eventLog(runRoot);
    const bootstrap = events.find((event) => event.kind === 'run.bootstrapped');
    const dispatchStarted = events.find(
      (event) => event.kind === 'dispatch.started' && event.step_id === 'act-step',
    );
    expect(output.workflow_id).toBe('build');
    expect(output.outcome).toBe('complete');
    expect(bootstrap).toMatchObject({ rigor: 'lite' });
    expect(dispatchStarted?.resolved_selection).toMatchObject({ rigor: 'lite' });
  });

  it('lets --rigor override the selected --entry-mode default', async () => {
    const runRoot = join(runRootBase, 'build-entry-mode-rigor-override');
    const output = await runMainJson(
      [
        'build',
        '--goal',
        'Add a tiny Build feature from the CLI with an override',
        '--entry-mode',
        'deep',
        '--rigor',
        'standard',
        '--run-root',
        runRoot,
      ],
      '{"verdict":"accept"}',
    );

    const events = eventLog(runRoot);
    const bootstrap = events.find((event) => event.kind === 'run.bootstrapped');
    const dispatchStarted = events.find(
      (event) => event.kind === 'dispatch.started' && event.step_id === 'act-step',
    );
    expect(output.workflow_id).toBe('build');
    expect(output.outcome).toBe('complete');
    expect(bootstrap).toMatchObject({ rigor: 'standard' });
    expect(dispatchStarted?.resolved_selection).toMatchObject({ rigor: 'standard' });
  });

  it('lets explicit autonomous --rigor override the default --entry-mode through checkpoint policy', async () => {
    const runRoot = join(runRootBase, 'build-default-entry-autonomous-override');
    const output = await runMainJson(
      [
        'build',
        '--goal',
        'Add a tiny Build feature from the CLI with autonomous override',
        '--entry-mode',
        'default',
        '--rigor',
        'autonomous',
        '--run-root',
        runRoot,
      ],
      '{"verdict":"accept"}',
    );

    const events = eventLog(runRoot);
    const bootstrap = events.find((event) => event.kind === 'run.bootstrapped');
    const checkpoint = events.find(
      (event) => event.kind === 'checkpoint.resolved' && event.step_id === 'frame-step',
    );
    const dispatchStarted = events.find(
      (event) => event.kind === 'dispatch.started' && event.step_id === 'act-step',
    );
    expect(output.workflow_id).toBe('build');
    expect(output.outcome).toBe('complete');
    expect(bootstrap).toMatchObject({ rigor: 'autonomous' });
    expect(checkpoint).toMatchObject({ resolution_source: 'safe-autonomous' });
    expect(dispatchStarted?.resolved_selection).toMatchObject({ rigor: 'autonomous' });
  });

  it('rejects fixture overrides whose workflow id does not match the selected workflow', async () => {
    await expect(
      main(
        [
          '--goal',
          'review this patch for safety problems',
          '--fixture',
          '.claude-plugin/skills/explore/circuit.json',
          '--run-root',
          join(runRootBase, 'mismatch'),
        ],
        {
          dispatcher: dispatcherWithBody('{"verdict":"accept"}'),
          now: deterministicNow(Date.UTC(2026, 3, 24, 15, 0, 0)),
          runId: '84000000-0000-0000-0000-000000000004',
          configHomeDir: join(runRootBase, 'empty-home'),
          configCwd: join(runRootBase, 'empty-cwd'),
        },
      ),
    ).rejects.toThrow(/workflow fixture id mismatch/i);
  });

  it('rejects an unknown --entry-mode before writing a run log', async () => {
    const runRoot = join(runRootBase, 'unknown-build-entry-mode');
    await expect(
      main(
        [
          'build',
          '--goal',
          'Try a missing Build entry mode',
          '--entry-mode',
          'missing',
          '--run-root',
          runRoot,
        ],
        {
          dispatcher: dispatcherWithBody('{"verdict":"accept"}'),
          now: deterministicNow(Date.UTC(2026, 3, 24, 15, 0, 0)),
          runId: '84000000-0000-0000-0000-000000000005',
          configHomeDir: join(runRootBase, 'empty-home'),
          configCwd: join(runRootBase, 'empty-cwd'),
        },
      ),
    ).rejects.toThrow(/entry_mode named 'missing'/);
    expect(() => eventLog(runRoot)).toThrow();
  });

  it('prints a versioned checkpoint_waiting envelope without result_path', async () => {
    const fixtureDir = join(runRootBase, 'fixture');
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
        ],
      }),
    );

    const output = await runMainJson(
      [
        'build-checkpoint-cli-test',
        '--goal',
        'Frame via CLI',
        '--rigor',
        'deep',
        '--fixture',
        fixturePath,
        '--run-root',
        join(runRootBase, 'checkpoint-waiting'),
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
    const fixtureDir = join(runRootBase, 'resume-fixture');
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
      }),
    );
    const runRoot = join(runRootBase, 'checkpoint-resume');

    const waiting = await runMainJson(
      [
        'build-checkpoint-cli-resume-test',
        '--goal',
        'Frame and resume via CLI',
        '--rigor',
        'deep',
        '--fixture',
        fixturePath,
        '--run-root',
        runRoot,
      ],
      '{"verdict":"accept"}',
    );
    expect(waiting.outcome).toBe('checkpoint_waiting');

    const resumed = await runMainJson(
      ['resume', '--run-root', runRoot, '--checkpoint-choice', 'continue'],
      '{"verdict":"accept"}',
    );

    expect(resumed.schema_version).toBe(1);
    expect(resumed.outcome).toBe('complete');
    expect(resumed.run_root).toBe(runRoot);
    expect(resumed).toHaveProperty('result_path');
  });

  it('rejects resume-only incompatible flags', async () => {
    const withRigor = await runMainExit([
      'resume',
      '--run-root',
      join(runRootBase, 'not-needed'),
      '--checkpoint-choice',
      'continue',
      '--rigor',
      'deep',
    ]);
    expect(withRigor.exit).toBe(2);
    expect(withRigor.stderr).toMatch(/omit --rigor/);

    const withFixture = await runMainExit([
      'resume',
      '--run-root',
      join(runRootBase, 'not-needed'),
      '--checkpoint-choice',
      'continue',
      '--fixture',
      join(runRootBase, 'fixture.json'),
    ]);
    expect(withFixture.exit).toBe(2);
    expect(withFixture.stderr).toMatch(/omit --fixture/);

    const withEntryMode = await runMainExit([
      'resume',
      '--run-root',
      join(runRootBase, 'not-needed'),
      '--checkpoint-choice',
      'continue',
      '--entry-mode',
      'lite',
    ]);
    expect(withEntryMode.exit).toBe(2);
    expect(withEntryMode.stderr).toMatch(/omit --entry-mode/);
  });

  it('keeps CLI help text aligned with the router-supported workflow set', () => {
    const source = readFileSync(join(process.cwd(), 'src/cli/circuit.ts'), 'utf-8');
    expect(source).toContain('registered explore/review/fix/build workflows');
    expect(source).not.toContain('registered explore/review/build workflows');
    expect(source).not.toContain('registered explore/review workflows');
  });
});
