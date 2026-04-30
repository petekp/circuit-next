import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { main } from '../../src/cli/circuit.js';
import { CompiledFlow, ContinuityIndex, ContinuityRecord } from '../../src/index.js';

const tempRoots: string[] = [];

function tempRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

async function captureMain(
  argv: readonly string[],
  options: Parameters<typeof main>[1] = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  let stdout = '';
  let stderr = '';
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stderr.write;
  try {
    const code = await main(argv, options);
    return { code, stdout, stderr };
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
  }
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('utility CLI commands', () => {
  it('creates, validates, and publishes a custom flow package', async () => {
    const home = tempRoot('circuit-create-');
    const result = await captureMain(
      [
        'create',
        '--name',
        'release-note-flow',
        '--description',
        'Draft release notes from a change summary',
        '--home',
        home,
        '--template-flow-root',
        resolve('generated/flows'),
        '--publish',
        '--yes',
        '--created-at',
        '2026-04-29T23:00:00.000Z',
      ],
      { now: () => new Date('2026-04-29T23:00:00.000Z') },
    );

    expect(result.code, result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as {
      status: string;
      slug: string;
      flow_path: string;
      manifest_path: string;
      operator_summary_markdown_path: string;
    };
    expect(output).toMatchObject({ status: 'published', slug: 'release-note-flow' });
    expect(existsSync(output.operator_summary_markdown_path)).toBe(true);
    expect(existsSync(join(home, 'skills/release-note-flow/SKILL.md'))).toBe(true);
    expect(existsSync(join(home, 'skills/release-note-flow/circuit.yaml'))).toBe(true);
    expect(existsSync(join(home, 'commands/release-note-flow.md'))).toBe(true);
    expect(CompiledFlow.parse(JSON.parse(readFileSync(output.flow_path, 'utf8'))).id).toBe(
      'release-note-flow',
    );
    const manifest = JSON.parse(readFileSync(output.manifest_path, 'utf8')) as {
      custom_flows: Array<{ id: string }>;
    };
    expect(manifest.custom_flows.map((flow) => flow.id)).toEqual(['release-note-flow']);
  });

  it('publishes reviewed draft contents without regenerating the draft', async () => {
    const home = tempRoot('circuit-create-reviewed-draft-');
    const draft = await captureMain([
      'create',
      '--name',
      'release-note-flow',
      '--description',
      'Draft release notes from a change summary',
      '--home',
      home,
      '--template-flow-root',
      resolve('generated/flows'),
    ]);

    expect(draft.code, draft.stderr).toBe(0);
    const drafted = JSON.parse(draft.stdout) as { draft_path: string };
    const draftFlowPath = join(drafted.draft_path, 'circuit.json');
    const draftFlow = JSON.parse(readFileSync(draftFlowPath, 'utf8'));
    draftFlow.purpose = 'Operator-reviewed release note flow';
    writeFileSync(draftFlowPath, `${JSON.stringify(draftFlow, null, 2)}\n`);
    writeFileSync(
      join(drafted.draft_path, 'command.md'),
      '# Reviewed command\n\ncustom draft command\n',
    );

    const publish = await captureMain([
      'create',
      '--name',
      'release-note-flow',
      '--description',
      'Publish-time description that should not override the reviewed draft',
      '--home',
      home,
      '--publish',
      '--yes',
      '--created-at',
      '2026-04-29T23:00:00.000Z',
    ]);

    expect(publish.code, publish.stderr).toBe(0);
    const published = JSON.parse(publish.stdout) as {
      flow_path: string;
      command_path: string;
      manifest_path: string;
      operator_summary_markdown_path: string;
    };
    expect(CompiledFlow.parse(JSON.parse(readFileSync(published.flow_path, 'utf8'))).purpose).toBe(
      'Operator-reviewed release note flow',
    );
    expect(readFileSync(published.command_path, 'utf8')).toContain('custom draft command');
    expect(
      (
        JSON.parse(readFileSync(published.manifest_path, 'utf8')) as {
          custom_flows: Array<{ id: string; description: string }>;
        }
      ).custom_flows[0],
    ).toMatchObject({
      id: 'release-note-flow',
      description: 'Operator-reviewed release note flow',
    });
    expect(readFileSync(published.operator_summary_markdown_path, 'utf8')).toContain(
      'Operator-reviewed release note flow',
    );
    expect(readFileSync(published.operator_summary_markdown_path, 'utf8')).not.toContain(
      'Publish-time description',
    );
    expect(
      JSON.parse(readFileSync(join(drafted.draft_path, 'validation-result.json'), 'utf8')),
    ).toMatchObject({ source: 'draft' });
  });

  it('requires explicit confirmation before publishing a custom flow', async () => {
    const home = tempRoot('circuit-create-no-yes-');
    const result = await captureMain([
      'create',
      '--name',
      'release-note-flow',
      '--description',
      'Draft release notes',
      '--home',
      home,
      '--template-flow-root',
      resolve('generated/flows'),
      '--publish',
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('--publish requires --yes');
  });

  it('saves, resumes, and clears standalone continuity', async () => {
    const controlPlane = tempRoot('circuit-handoff-');
    const save = await captureMain([
      'handoff',
      'save',
      '--goal',
      'Resume release work',
      '--next',
      'DO: continue the parity matrix',
      '--state-markdown',
      '- release truth is current',
      '--debt-markdown',
      '- CONSTRAINT: keep claims generated',
      '--control-plane',
      controlPlane,
      '--record-id',
      'continuity-11111111-1111-4111-8111-111111111111',
      '--created-at',
      '2026-04-29T23:10:00.000Z',
    ]);

    expect(save.code, save.stderr).toBe(0);
    const saved = JSON.parse(save.stdout) as { continuity_path: string; index_path: string };
    expect(
      ContinuityRecord.parse(JSON.parse(readFileSync(saved.continuity_path, 'utf8'))),
    ).toMatchObject({
      continuity_kind: 'standalone',
      narrative: { next: 'DO: continue the parity matrix' },
    });
    expect(
      ContinuityIndex.parse(JSON.parse(readFileSync(saved.index_path, 'utf8'))).pending_record
        ?.record_id,
    ).toBe('continuity-11111111-1111-4111-8111-111111111111');

    const resume = await captureMain(['handoff', 'resume', '--control-plane', controlPlane]);
    expect(resume.code, resume.stderr).toBe(0);
    expect(JSON.parse(resume.stdout)).toMatchObject({
      status: 'resumed',
      source: 'pending_record',
    });

    const done = await captureMain(['handoff', 'done', '--control-plane', controlPlane]);
    expect(done.code, done.stderr).toBe(0);
    expect(
      ContinuityIndex.parse(JSON.parse(readFileSync(saved.index_path, 'utf8'))).pending_record,
    ).toBeNull();
  });

  it('can bind handoff continuity to a waiting run and write active-run output', async () => {
    const root = tempRoot('circuit-handoff-run-');
    const runFolder = join(root, 'run');
    const controlPlane = join(root, 'control-plane');
    const run = await captureMain(
      [
        'run',
        'build',
        '--goal',
        'deep change that asks for scope',
        '--entry-mode',
        'deep',
        '--run-folder',
        runFolder,
      ],
      {
        runId: '55555555-5555-4555-8555-555555555555',
        now: () => new Date('2026-04-29T23:20:00.000Z'),
      },
    );
    expect(run.code, run.stderr).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ outcome: 'checkpoint_waiting' });

    const save = await captureMain([
      'handoff',
      'save',
      '--goal',
      'Resume waiting Build run',
      '--next',
      'DO: resolve the Build checkpoint',
      '--state-markdown',
      '- checkpoint is waiting',
      '--debt-markdown',
      '- BLOCKED: needs checkpoint choice',
      '--run-folder',
      runFolder,
      '--control-plane',
      controlPlane,
      '--record-id',
      'continuity-22222222-2222-4222-8222-222222222222',
      '--created-at',
      '2026-04-29T23:21:00.000Z',
    ]);

    expect(save.code, save.stderr).toBe(0);
    const output = JSON.parse(save.stdout) as { continuity_path: string; active_run_path: string };
    const record = ContinuityRecord.parse(JSON.parse(readFileSync(output.continuity_path, 'utf8')));
    expect(record).toMatchObject({
      continuity_kind: 'run-backed',
      run_ref: { runtime_status: 'in_progress', current_step: 'frame-step' },
    });
    expect(readFileSync(output.active_run_path, 'utf8')).toContain(
      'DO: resolve the Build checkpoint',
    );
  });
});
