import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AgentDispatchInput } from '../../src/runtime/adapters/agent.js';
import { materializeDispatch } from '../../src/runtime/adapters/dispatch-materializer.js';
import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import { type DispatchFn, runDogfood } from '../../src/runtime/runner.js';
import { RunId, StepId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import type { Workflow } from '../../src/schemas/workflow.js';

const FIXTURE_PATH = resolve('.claude-plugin/skills/dogfood-run-0/circuit.json');

function loadFixture(): { workflow: Workflow; bytes: Buffer } {
  const bytes = readFileSync(FIXTURE_PATH);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  return { workflow: raw as Workflow, bytes };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode: 'workflow-controlled paths could escape the run root',
    acceptance_evidence: 'run-relative path resolver rejects escaping read/write paths',
    alternate_framing:
      'rely only on schema parsing — rejected because runtime call sites also need containment defense if typed data is bypassed',
  };
}

function dispatcherWithCapture(capture: string[]): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async (input: AgentDispatchInput): Promise<DispatchResult> => {
      capture.push(input.prompt);
      return {
        request_payload: input.prompt,
        receipt_id: 'stub-receipt-run-relative',
        result_body: '{"verdict":"ok"}',
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

let runRootBase: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-path-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('STEP-I8 runtime run-relative path containment', () => {
  it('rejects synthesis writes.artifact.path escape or dot segment before writing', async () => {
    const { workflow, bytes } = loadFixture();
    const cases = [
      ['parent', '../escaped.json', join(runRootBase, 'escaped.json')],
      [
        'current',
        'artifacts/./escaped.json',
        join(runRootBase, 'run-current', 'artifacts', 'escaped.json'),
      ],
    ] as const;

    for (const [label, path, forbiddenPath] of cases) {
      const runRoot = join(runRootBase, `run-${label}`);
      const badWorkflow = structuredClone(workflow) as Workflow;
      const first = badWorkflow.steps[0];
      if (first === undefined || first.kind !== 'synthesis') throw new Error('fixture drift');
      first.writes.artifact.path = path as never;

      await expect(
        runDogfood({
          runRoot,
          workflow: badWorkflow,
          workflowBytes: bytes,
          runId: RunId.parse('68000000-0000-0000-0000-000000000101'),
          goal: `prove synthesis artifact path cannot escape: ${label}`,
          rigor: 'standard',
          lane: lane(),
          now: deterministicNow(Date.UTC(2026, 3, 24, 12, 0, 0)),
          dispatcher: dispatcherWithCapture([]),
        }),
      ).rejects.toThrow(/run-relative path/i);

      expect(existsSync(forbiddenPath)).toBe(false);
    }
  });

  it('rejects dispatch reads escape before prompt composition can read outside runRoot', async () => {
    const { workflow, bytes } = loadFixture();
    const runRoot = join(runRootBase, 'run');
    const secret = join(runRootBase, 'secret.txt');
    writeFileSync(secret, 'outside-secret');
    const prompts: string[] = [];
    const badWorkflow = structuredClone(workflow) as Workflow;
    const dispatch = badWorkflow.steps.find((step) => step.kind === 'dispatch');
    if (dispatch === undefined || dispatch.kind !== 'dispatch') throw new Error('fixture drift');
    dispatch.reads = ['../secret.txt' as never];

    await expect(
      runDogfood({
        runRoot,
        workflow: badWorkflow,
        workflowBytes: bytes,
        runId: RunId.parse('68000000-0000-0000-0000-000000000102'),
        goal: 'prove dispatch reads cannot escape',
        rigor: 'standard',
        lane: lane(),
        now: deterministicNow(Date.UTC(2026, 3, 24, 12, 0, 0)),
        dispatcher: dispatcherWithCapture(prompts),
      }),
    ).rejects.toThrow(/run-relative path/i);

    expect(prompts).toEqual([]);
  });

  it('rejects dispatch transcript and artifact path escapes before writing partial files', () => {
    const validWrites = {
      request: 'artifacts/dispatch/request.txt',
      receipt: 'artifacts/dispatch/receipt.txt',
      result: 'artifacts/dispatch/result.txt',
      artifact: {
        path: 'artifacts/dispatch/artifact.json',
        schema: 'dispatch@v1',
      },
    };
    const cases = [
      ['request', { ...validWrites, request: '../request.txt' }],
      ['receipt', { ...validWrites, receipt: '../receipt.txt' }],
      ['result', { ...validWrites, result: '../result.txt' }],
      [
        'artifact',
        { ...validWrites, artifact: { ...validWrites.artifact, path: '../artifact.json' } },
      ],
      ['current', { ...validWrites, request: 'artifacts/./request.txt' }],
    ] as const;

    for (const [field, writes] of cases) {
      const runRoot = join(runRootBase, `run-${field}`);
      expect(() =>
        materializeDispatch({
          runId: RunId.parse('68000000-0000-0000-0000-000000000103'),
          stepId: StepId.parse('dispatch-step'),
          attempt: 1,
          role: 'researcher',
          startingSequence: 1,
          runRoot,
          writes,
          adapterName: 'agent',
          resolvedSelection: { skills: [], invocation_options: {} },
          resolvedFrom: { source: 'explicit' },
          dispatchResult: {
            request_payload: 'request payload',
            receipt_id: 'receipt-id',
            result_body: '{"verdict":"ok"}',
            duration_ms: 1,
            cli_version: '0.0.0-stub',
          },
          verdict: 'ok',
          now: () => new Date(Date.UTC(2026, 3, 24, 12, 0, 0)),
        }),
      ).toThrow(/run-relative path/i);

      expect(existsSync(join(runRootBase, `${field}.txt`))).toBe(false);
      expect(existsSync(join(runRootBase, `${field}.json`))).toBe(false);
      expect(existsSync(join(runRoot, 'artifacts'))).toBe(false);
    }
  });

  it('rejects symlinked synthesis, dispatch read, and dispatch write ancestors inside runRoot', async () => {
    const { workflow, bytes } = loadFixture();

    const synthesisRunRoot = join(runRootBase, 'run-symlink-synthesis');
    const synthesisOutside = join(runRootBase, 'outside-synthesis');
    mkdirSync(synthesisRunRoot, { recursive: true });
    mkdirSync(synthesisOutside, { recursive: true });
    symlinkSync(synthesisOutside, join(synthesisRunRoot, 'artifacts'));
    const synthesisWorkflow = structuredClone(workflow) as Workflow;
    const first = synthesisWorkflow.steps[0];
    if (first === undefined || first.kind !== 'synthesis') throw new Error('fixture drift');
    first.writes.artifact.path = 'artifacts/escaped.json' as never;

    await expect(
      runDogfood({
        runRoot: synthesisRunRoot,
        workflow: synthesisWorkflow,
        workflowBytes: bytes,
        runId: RunId.parse('68000000-0000-0000-0000-000000000104'),
        goal: 'prove synthesis symlink ancestors cannot escape',
        rigor: 'standard',
        lane: lane(),
        now: deterministicNow(Date.UTC(2026, 3, 24, 12, 0, 0)),
        dispatcher: dispatcherWithCapture([]),
      }),
    ).rejects.toThrow(/symlink/i);
    expect(existsSync(join(synthesisOutside, 'escaped.json'))).toBe(false);

    const readRunRoot = join(runRootBase, 'run-symlink-read');
    const readOutside = join(runRootBase, 'outside-read');
    mkdirSync(readRunRoot, { recursive: true });
    mkdirSync(readOutside, { recursive: true });
    symlinkSync(readOutside, join(readRunRoot, 'links'));
    writeFileSync(join(readOutside, 'secret.txt'), 'outside-secret');
    const prompts: string[] = [];
    const readWorkflow = structuredClone(workflow) as Workflow;
    const dispatch = readWorkflow.steps.find((step) => step.kind === 'dispatch');
    if (dispatch === undefined || dispatch.kind !== 'dispatch') throw new Error('fixture drift');
    dispatch.reads = ['links/secret.txt' as never];

    await expect(
      runDogfood({
        runRoot: readRunRoot,
        workflow: readWorkflow,
        workflowBytes: bytes,
        runId: RunId.parse('68000000-0000-0000-0000-000000000105'),
        goal: 'prove dispatch read symlink ancestors cannot escape',
        rigor: 'standard',
        lane: lane(),
        now: deterministicNow(Date.UTC(2026, 3, 24, 12, 0, 0)),
        dispatcher: dispatcherWithCapture(prompts),
      }),
    ).rejects.toThrow(/symlink/i);
    expect(prompts).toEqual([]);

    const writeRunRoot = join(runRootBase, 'run-symlink-write');
    const writeOutside = join(runRootBase, 'outside-write');
    mkdirSync(writeRunRoot, { recursive: true });
    mkdirSync(writeOutside, { recursive: true });
    symlinkSync(writeOutside, join(writeRunRoot, 'artifacts'));

    expect(() =>
      materializeDispatch({
        runId: RunId.parse('68000000-0000-0000-0000-000000000106'),
        stepId: StepId.parse('dispatch-step'),
        attempt: 1,
        role: 'researcher',
        startingSequence: 1,
        runRoot: writeRunRoot,
        writes: {
          request: 'artifacts/request.txt',
          receipt: 'artifacts/receipt.txt',
          result: 'artifacts/result.txt',
          artifact: { path: 'artifacts/artifact.json', schema: 'dispatch@v1' },
        },
        adapterName: 'agent',
        resolvedSelection: { skills: [], invocation_options: {} },
        resolvedFrom: { source: 'explicit' },
        dispatchResult: {
          request_payload: 'request payload',
          receipt_id: 'receipt-id',
          result_body: '{"verdict":"ok"}',
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        },
        verdict: 'ok',
        now: () => new Date(Date.UTC(2026, 3, 24, 12, 0, 0)),
      }),
    ).toThrow(/symlink/i);
    expect(existsSync(join(writeOutside, 'request.txt'))).toBe(false);
  });
});
