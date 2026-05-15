import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const RUNNER = resolve('evals/circuit-vs-vanilla/run-comparison.mjs');

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'circuit-vs-vanilla-runner-'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function writePrompt(): string {
  const promptPath = join(workDir, 'prompt.md');
  writeFileSync(promptPath, 'Comparison runner dry-run prompt fixture.\n');
  return promptPath;
}

function dryRun(args: string[]): string {
  const outDir = join(workDir, 'results');
  mkdirSync(outDir, { recursive: true });
  return execFileSync(
    'node',
    [
      RUNNER,
      '--task-id',
      'dry-run-test',
      '--prompt-file',
      writePrompt(),
      '--out-dir',
      outDir,
      '--dry-run',
      '--skip-build',
      ...args,
    ],
    { encoding: 'utf8' },
  );
}

type DryRunMetadata = {
  readonly provider: string;
  readonly flow: string;
  readonly effort: string;
  readonly arms: Record<string, { readonly command: string[]; readonly run_folder?: string }>;
};

function dryRunMetadata(args: string[]): DryRunMetadata {
  const stdout = dryRun(args);
  return JSON.parse(stdout.split('\nDry run only.')[0] ?? stdout) as DryRunMetadata;
}

describe('comparison runner dry-run', () => {
  it.each([
    { provider: 'codex', vanillaExecutable: 'codex', vanillaMode: 'exec' },
    { provider: 'claude-code', vanillaExecutable: 'claude', vanillaMode: '-p' },
  ])(
    'prints matching circuit and vanilla dry-run commands for $provider',
    ({ provider, vanillaExecutable, vanillaMode }) => {
      const metadata = dryRunMetadata([
        '--provider',
        provider,
        '--flow',
        'review',
        '--model',
        provider === 'codex' ? 'gpt-5.4-mini' : 'claude-haiku-4-5-20251001',
        '--effort',
        'low',
      ]);

      const circuitArm = metadata.arms[`circuit-${provider}`];
      const vanillaArm = metadata.arms[`vanilla-${provider}`];
      if (circuitArm === undefined || vanillaArm === undefined) {
        throw new Error(`missing dry-run arms for ${provider}`);
      }

      expect(metadata).toMatchObject({ provider, flow: 'review', effort: 'low' });
      expect(circuitArm.command).toEqual(
        expect.arrayContaining(['node', 'bin/circuit-next', 'run', 'review']),
      );
      expect(circuitArm.run_folder).toContain(`circuit-${provider}/run`);
      expect(vanillaArm.command[0]).toBe(vanillaExecutable);
      expect(vanillaArm.command).toContain(vanillaMode);
      expect(vanillaArm.command).not.toContain(provider === 'codex' ? 'claude' : 'exec');
    },
  );
});
