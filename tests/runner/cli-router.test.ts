import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { main } from '../../src/cli/dogfood.js';
import type { AgentDispatchInput } from '../../src/runtime/adapters/agent.js';
import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import type { DispatchFn } from '../../src/runtime/runner.js';

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function dispatcherWithBody(body: string): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async (input: AgentDispatchInput): Promise<DispatchResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-receipt-cli-router',
      result_body: body,
      duration_ms: 1,
      cli_version: '0.0.0-stub',
    }),
  };
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
        },
      ),
    ).rejects.toThrow(/workflow fixture id mismatch/i);
  });
});
