import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { main } from '../../src/cli/dogfood.js';
import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import {
  discoverConfigLayers,
  projectConfigPath,
  userGlobalConfigPath,
} from '../../src/runtime/config-loader.js';
import type { DispatchFn, DispatchInput } from '../../src/runtime/runner.js';
import { SkillId, WorkflowId } from '../../src/schemas/ids.js';
import type { ResolvedSelection } from '../../src/schemas/selection-policy.js';

let root: string;
let homeDir: string;
let cwdDir: string;

const EXPLORE_SYNTHESIS_BODY = JSON.stringify({
  verdict: 'accept',
  subject: 'Config-loaded explore goal',
  recommendation: 'Use the resolved config while synthesizing the result',
  success_condition_alignment: 'The run proves config reaches dispatch selection evidence',
  supporting_aspects: [
    {
      aspect: 'config-selection',
      contribution: 'The synthesize step received the resolved selection inputs',
    },
  ],
});

function writeUserConfig(text: string): void {
  const path = userGlobalConfigPath(homeDir);
  mkdirSync(join(homeDir, '.config', 'circuit-next'), { recursive: true });
  writeFileSync(path, text);
}

function writeProjectConfig(text: string): void {
  const path = projectConfigPath(cwdDir);
  mkdirSync(join(cwdDir, '.circuit'), { recursive: true });
  writeFileSync(path, text);
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function captureStdout(): { restore: () => void; text: () => string } {
  let captured = '';
  const origWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;
  return {
    restore: () => {
      process.stdout.write = origWrite;
    },
    text: () => captured,
  };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'circuit-next-config-loader-'));
  homeDir = join(root, 'home');
  cwdDir = join(root, 'cwd');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('config loader', () => {
  it('loads canonical user-global and project YAML files as LayeredConfig records', () => {
    writeUserConfig(`
schema_version: 1
defaults:
  selection:
    effort: low
    skills:
      mode: replace
      skills: [tdd]
`);
    writeProjectConfig(`
schema_version: 1
circuits:
  explore:
    selection:
      model:
        provider: openai
        model: gpt-5.4
`);

    const layers = discoverConfigLayers({ homeDir, cwd: cwdDir });

    expect(layers.map((layer) => layer.layer)).toEqual(['user-global', 'project']);
    expect(layers[0]?.source_path).toBe(userGlobalConfigPath(homeDir));
    expect(layers[1]?.source_path).toBe(projectConfigPath(cwdDir));
    expect(layers[0]?.config.defaults.selection?.effort).toBe('low');
    const exploreId = WorkflowId.parse('explore');
    expect(layers[1]?.config.circuits[exploreId]?.selection?.model).toEqual({
      provider: 'openai',
      model: 'gpt-5.4',
    });
  });

  it('skips missing config files and fails loudly on invalid config payloads', () => {
    expect(discoverConfigLayers({ homeDir, cwd: cwdDir })).toEqual([]);

    writeProjectConfig(`
schema_version: 1
defuults: {}
`);
    expect(() => discoverConfigLayers({ homeDir, cwd: cwdDir })).toThrow(
      /config validation failed for project/i,
    );
  });

  it('fails loudly on malformed YAML before schema validation', () => {
    writeProjectConfig('schema_version: 1\nbad: [unterminated\n');

    expect(() => discoverConfigLayers({ homeDir, cwd: cwdDir })).toThrow(
      /config YAML parse failed/i,
    );
  });
});

describe('CLI config discovery', () => {
  it('passes loaded user-global and project config layers into dispatch selection evidence', async () => {
    writeUserConfig(`
schema_version: 1
defaults:
  selection:
    model:
      provider: anthropic
      model: claude-opus-4-7
    effort: low
    skills:
      mode: replace
      skills: [tdd]
    invocation_options:
      shared: user
      userOnly: true
`);
    writeProjectConfig(`
schema_version: 1
defaults:
  selection:
    effort: high
    skills:
      mode: append
      skills: [api-design-patterns]
    invocation_options:
      shared: project-default
      projectDefault: true
circuits:
  explore:
    selection:
      model:
        provider: openai
        model: gpt-5.4
      skills:
        mode: append
        skills: [react-doctor]
      invocation_options:
        shared: project-circuit
        projectCircuit: true
`);

    const dispatchInputs: DispatchInput[] = [];
    const dispatcher: DispatchFn = {
      adapterName: 'agent',
      dispatch: async (input: DispatchInput): Promise<DispatchResult> => {
        dispatchInputs.push(input);
        return {
          request_payload: input.prompt,
          receipt_id: 'config-loader-receipt',
          result_body: input.prompt.includes('Step: synthesize-step')
            ? EXPLORE_SYNTHESIS_BODY
            : '{"verdict":"accept"}',
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        };
      },
    };
    const runRoot = join(root, 'run');
    const stdout = captureStdout();
    try {
      const exit = await main(
        ['explore', '--goal', 'prove config reaches selection evidence', '--run-root', runRoot],
        {
          dispatcher,
          now: deterministicNow(Date.UTC(2026, 3, 24, 23, 0, 0)),
          runId: '86868686-8686-4686-8686-868686868686',
          configHomeDir: homeDir,
          configCwd: cwdDir,
        },
      );
      expect(exit).toBe(0);
    } finally {
      stdout.restore();
    }

    const expected: ResolvedSelection = {
      model: { provider: 'openai', model: 'gpt-5.4' },
      effort: 'high',
      skills: [
        SkillId.parse('tdd'),
        SkillId.parse('api-design-patterns'),
        SkillId.parse('react-doctor'),
      ],
      invocation_options: {
        shared: 'project-circuit',
        userOnly: true,
        projectDefault: true,
        projectCircuit: true,
      },
    };
    expect(dispatchInputs[0]?.resolvedSelection).toEqual(expected);

    const events = readFileSync(join(runRoot, 'events.ndjson'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const started = events.find((event) => event.kind === 'dispatch.started');
    expect(started?.resolved_selection).toEqual(expected);

    const output = JSON.parse(stdout.text()) as Record<string, unknown>;
    expect(output.workflow_id).toBe('explore');
    expect(output.outcome).toBe('complete');
  });

  it('rejects invalid discovered config before dispatch', async () => {
    writeProjectConfig('schema_version: 1\nbad: [unterminated\n');

    let dispatchCalls = 0;
    const dispatcher: DispatchFn = {
      adapterName: 'agent',
      dispatch: async (input: DispatchInput): Promise<DispatchResult> => {
        dispatchCalls += 1;
        return {
          request_payload: input.prompt,
          receipt_id: 'should-not-dispatch',
          result_body: '{"verdict":"accept"}',
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        };
      },
    };

    await expect(
      main(['explore', '--goal', 'invalid config must stop before dispatch'], {
        dispatcher,
        now: deterministicNow(Date.UTC(2026, 3, 24, 23, 30, 0)),
        runId: '86868686-8686-4686-8686-868686868687',
        configHomeDir: homeDir,
        configCwd: cwdDir,
      }),
    ).rejects.toThrow(/config YAML parse failed/i);
    expect(dispatchCalls).toBe(0);
  });
});
