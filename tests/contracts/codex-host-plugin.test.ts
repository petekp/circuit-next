import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { main } from '../../src/cli/circuit.js';
import type { RelayResult } from '../../src/runtime/connectors/shared.js';
import type { RelayInput } from '../../src/runtime/runner.js';

const REPO_ROOT = resolve('.');
const PLUGIN_ROOT = resolve(REPO_ROOT, 'plugins/circuit');

const PluginManifest = z
  .object({
    name: z.literal('circuit'),
    version: z.string().min(1),
    description: z.string().min(1),
    skills: z.literal('./skills/'),
    interface: z.object({
      displayName: z.literal('Circuit'),
      category: z.literal('Coding'),
      capabilities: z.array(z.string()).min(1),
      defaultPrompt: z.array(z.string().max(128)).max(3),
    }),
  })
  .passthrough();

describe('Codex host plugin package', () => {
  it('declares an installable Codex plugin manifest', () => {
    const manifestPath = resolve(PLUGIN_ROOT, '.codex-plugin/plugin.json');
    const manifest = PluginManifest.parse(JSON.parse(readFileSync(manifestPath, 'utf8')));

    expect(manifest.interface.capabilities).toContain('Interactive');
    expect(manifest.interface.capabilities).toContain('Write');
  });

  it('ships a repo-local marketplace entry for Codex plugin discovery', () => {
    const marketplace = JSON.parse(
      readFileSync(resolve(REPO_ROOT, '.agents/plugins/marketplace.json'), 'utf8'),
    ) as {
      plugins: Array<{
        name: string;
        source: { source: string; path: string };
        policy: { installation: string; authentication: string };
        category: string;
      }>;
    };

    expect(marketplace.plugins).toContainEqual({
      name: 'circuit',
      source: { source: 'local', path: './plugins/circuit' },
      policy: { installation: 'INSTALLED_BY_DEFAULT', authentication: 'ON_INSTALL' },
      category: 'Coding',
    });
  });

  it('documents the host adapter contract', () => {
    const contract = readFileSync(resolve(REPO_ROOT, 'docs/contracts/host-adapter.md'), 'utf8');
    const rendering = readFileSync(resolve(REPO_ROOT, 'docs/contracts/host-rendering.md'), 'utf8');

    expect(contract).toContain('contract: host-adapter');
    expect(contract).toContain('Routed runs');
    expect(contract).toContain('--progress jsonl');
    expect(contract).toContain("node '<plugin root>/scripts/circuit-next.mjs' doctor");
    expect(contract).toContain('Host summaries should surface');
    expect(rendering).toContain('contract: host-rendering');
    expect(rendering).toContain('render `display.text` exactly');
    expect(rendering).toContain('operator_summary_markdown_path');
  });

  it('exposes Codex skill and command surfaces backed by the Circuit CLI protocol', () => {
    expect(existsSync(resolve(PLUGIN_ROOT, 'skills/run/SKILL.md'))).toBe(true);
    expect(existsSync(resolve(PLUGIN_ROOT, 'scripts/circuit-next.mjs'))).toBe(true);

    const skill = readFileSync(resolve(PLUGIN_ROOT, 'skills/run/SKILL.md'), 'utf8');
    expect(skill).toContain('name: run');
    expect(skill).not.toContain('name: circuit-run');
    expect(skill).toContain("node '<plugin root>/scripts/circuit-next.mjs' run --goal '<task>'");
    expect(skill).toContain('--progress jsonl');
    expect(skill).toContain('render `display.text` exactly');
    expect(skill).toContain('task_list.updated');
    expect(skill).toContain('user_input.requested');
    expect(skill).toContain('operator_summary_markdown_path');
    expect(skill).toMatch(
      /Valid explicit flows are `explore`, `review`, `migrate`, `fix`, `build`, and\s+`sweep`/,
    );
    expect(skill).toContain('Do not use a path relative to the user');
    expect(skill).not.toContain('node plugins/circuit/scripts/circuit-next.mjs');
    expect(skill).toContain(
      "node '<plugin root>/scripts/circuit-next.mjs' resume --run-folder '<run_folder>' --checkpoint-choice '<choice>'",
    );
  });

  it('uses plugin-local skill names so Codex resolves Circuit:<skill>', () => {
    const skillsRoot = resolve(PLUGIN_ROOT, 'skills');
    const skillDirs = readdirSync(skillsRoot, { withFileTypes: true }).filter((entry) =>
      entry.isDirectory(),
    );

    expect(skillDirs.length).toBeGreaterThan(0);

    for (const entry of skillDirs) {
      const skillPath = resolve(skillsRoot, entry.name, 'SKILL.md');
      const skill = readFileSync(skillPath, 'utf8');
      const name = /^name:\s*(\S+)\s*$/m.exec(skill)?.[1];

      expect(name).toBe(entry.name);
      expect(name).not.toMatch(/^circuit[:-]/);
    }
  });

  it('wrapper runs from a target repo and injects the packaged flow root for routed runs', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'circuit-codex-host-'));
    try {
      const binDir = join(tempDir, 'bin');
      mkdirSync(binDir, { recursive: true });
      const argvPath = join(tempDir, 'argv.json');
      const fakeBin = join(binDir, 'circuit-next');
      writeFileSync(
        fakeBin,
        `#!/usr/bin/env node\nconst { writeFileSync } = require('node:fs');\nwriteFileSync(${JSON.stringify(
          argvPath,
        )}, JSON.stringify(process.argv.slice(2)));\n`,
      );
      chmodSync(fakeBin, 0o755);

      const result = spawnSync(
        process.execPath,
        [
          resolve(PLUGIN_ROOT, 'scripts/circuit-next.mjs'),
          'run',
          'review',
          '--goal',
          'outside repo',
        ],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
          },
        },
      );

      expect(result.status, result.stderr).toBe(0);
      const argv = JSON.parse(readFileSync(argvPath, 'utf8')) as string[];
      expect(argv).toEqual([
        'run',
        'review',
        '--goal',
        'outside repo',
        '--flow-root',
        resolve(PLUGIN_ROOT, 'flows'),
      ]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('wrapper does not inject a flow root for checkpoint resume', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'circuit-codex-host-resume-'));
    try {
      const binDir = join(tempDir, 'bin');
      mkdirSync(binDir, { recursive: true });
      const argvPath = join(tempDir, 'argv.json');
      const fakeBin = join(binDir, 'circuit-next');
      writeFileSync(
        fakeBin,
        `#!/usr/bin/env node\nconst { writeFileSync } = require('node:fs');\nwriteFileSync(${JSON.stringify(
          argvPath,
        )}, JSON.stringify(process.argv.slice(2)));\n`,
      );
      chmodSync(fakeBin, 0o755);

      const result = spawnSync(
        process.execPath,
        [
          resolve(PLUGIN_ROOT, 'scripts/circuit-next.mjs'),
          'resume',
          '--run-folder',
          '/tmp/run',
          '--checkpoint-choice',
          'continue',
        ],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
          },
        },
      );

      expect(result.status, result.stderr).toBe(0);
      const argv = JSON.parse(readFileSync(argvPath, 'utf8')) as string[];
      expect(argv).toEqual([
        'resume',
        '--run-folder',
        '/tmp/run',
        '--checkpoint-choice',
        'continue',
      ]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('doctor verifies the installed Codex host package from a target repo', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'circuit-codex-host-doctor-'));
    try {
      const result = spawnSync(
        process.execPath,
        [resolve(PLUGIN_ROOT, 'scripts/circuit-next.mjs'), 'doctor'],
        {
          cwd: tempDir,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${resolve(REPO_ROOT, 'bin')}${delimiter}${process.env.PATH ?? ''}`,
          },
        },
      );

      expect(result.status, result.stderr).toBe(0);
      const output = JSON.parse(result.stdout) as {
        status: string;
        checks: Array<{ name: string; ok: boolean }>;
      };
      expect(output.status).toBe('ok');
      expect(output.checks).toContainEqual(
        expect.objectContaining({ name: 'temp_repo_review_smoke', ok: true }),
      );
      expect(output.checks).toContainEqual(
        expect.objectContaining({ name: 'temp_repo_review_progress', ok: true }),
      );
      expect(output.checks).toContainEqual(
        expect.objectContaining({ name: 'temp_repo_review_progress_display', ok: true }),
      );
      expect(output.checks).toContainEqual(
        expect.objectContaining({ name: 'temp_repo_review_operator_summary', ok: true }),
      );
      expect(output.checks).toContainEqual(
        expect.objectContaining({ name: 'temp_repo_checkpoint_user_input_requested', ok: true }),
      );
      expect(output.checks).toContainEqual(
        expect.objectContaining({ name: 'circuit_next_binary_available', ok: true }),
      );
      expect(output.checks).toContainEqual(
        expect.objectContaining({ name: 'packaged_flow_migrate', ok: true }),
      );
      expect(output.checks).toContainEqual(
        expect.objectContaining({ name: 'packaged_flow_sweep', ok: true }),
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('Circuit CLI can load routed flows from the packaged Codex flow root outside this checkout', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'circuit-codex-cli-root-'));
    const runFolder = join(tempDir, 'run');
    let captured = '';
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array): boolean => {
      captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
      return true;
    }) as typeof process.stdout.write;
    try {
      const exit = await main(
        [
          'run',
          '--goal',
          'review this patch',
          '--flow-root',
          resolve(PLUGIN_ROOT, 'flows'),
          '--run-folder',
          runFolder,
        ],
        {
          configCwd: tempDir,
          configHomeDir: join(tempDir, 'home'),
          runId: '85000000-0000-0000-0000-000000000001',
          now: () => new Date(Date.UTC(2026, 3, 28, 12, 0, 0)),
          relayer: {
            connectorName: 'claude-code',
            relay: async (_input: RelayInput): Promise<RelayResult> => ({
              request_payload: 'stub-request',
              receipt_id: 'stub-receipt',
              result_body: '{"verdict":"NO_ISSUES_FOUND","findings":[]}',
              duration_ms: 1,
              cli_version: '0.0.0-stub',
            }),
          },
        },
      );

      expect(exit).toBe(0);
      const output = JSON.parse(captured) as { flow_id: string; selected_flow: string };
      expect(output.flow_id).toBe('review');
      expect(output.selected_flow).toBe('review');
      expect(existsSync(join(runFolder, 'reports/review-result.json'))).toBe(true);
    } finally {
      process.stdout.write = originalWrite;
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('mirrors canonical flow files into the Codex host output tree', () => {
    for (const flow of ['build', 'explore', 'fix', 'migrate', 'review', 'sweep']) {
      const canonical = readFileSync(resolve(REPO_ROOT, `generated/flows/${flow}/circuit.json`));
      const codex = readFileSync(resolve(PLUGIN_ROOT, `flows/${flow}/circuit.json`));
      expect(codex).toEqual(canonical);
    }
  });

  it('generates Codex host command files that invoke the installed plugin wrapper', () => {
    for (const command of [
      'build',
      'create',
      'explore',
      'fix',
      'handoff',
      'migrate',
      'review',
      'run',
      'sweep',
    ]) {
      const source = readFileSync(resolve(REPO_ROOT, `commands/${command}.md`), 'utf8');
      const codex = readFileSync(resolve(PLUGIN_ROOT, `commands/${command}.md`), 'utf8');
      expect(source).toContain('./bin/circuit-next');
      expect(source).toContain('--progress jsonl');
      expect(source).toContain('display.text');
      expect(source).toContain('task_list.updated');
      expect(source).toContain('user_input.requested');
      expect(source).toContain('operator_summary_markdown_path');
      expect(source).not.toContain("node '<plugin root>/scripts/circuit-next.mjs'");
      expect(codex).toContain("node '<plugin root>/scripts/circuit-next.mjs'");
      expect(codex).toContain('--progress jsonl');
      expect(codex).toContain('display.text');
      expect(codex).toContain('task_list.updated');
      expect(codex).toContain('user_input.requested');
      expect(codex).toContain('operator_summary_markdown_path');
      expect(codex).not.toContain('./bin/circuit-next');
      expect(codex).not.toContain('repo-local launcher');
    }
  });
});
