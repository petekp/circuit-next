import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '..', '..');

describe('host experience docs', () => {
  it('defines shared host capability slots for Codex and Claude Code', () => {
    const doc = readFileSync(resolve(REPO_ROOT, 'docs/contracts/host-capabilities.md'), 'utf8');

    for (const capability of [
      'progress',
      'task_list',
      'ask_user',
      'final_summary',
      'deep_links',
      'debug',
    ]) {
      expect(doc).toContain(`\`${capability}\``);
    }

    expect(doc).toContain('Codex');
    expect(doc).toContain('Claude Code');
    expect(doc).toContain('native');
    expect(doc).toContain('model-mediated');
    expect(doc).toContain('fallback');
    expect(doc).toContain('AskUserQuestion');
    expect(doc).toContain('TodoWrite');
    expect(doc).toContain('tool/requestUserInput');
    expect(doc).toContain('operator_summary_markdown_path');
  });

  it('documents the native bridge tracks without implementing them in this slice', () => {
    const doc = readFileSync(resolve(REPO_ROOT, 'docs/contracts/native-host-adapters.md'), 'utf8');

    expect(doc).toContain('contract: native-host-adapters');
    expect(doc).toContain('task_list.updated');
    expect(doc).toContain('user_input.requested');
    expect(doc).toContain('Claude Agent SDK');
    expect(doc).toContain('AskUserQuestion');
    expect(doc).toContain('TodoWrite');
    expect(doc).toContain('Codex App Server');
    expect(doc).toContain('tool/requestUserInput');
    expect(doc).toContain('does not implement either native bridge');
  });

  it('keeps a repeatable Codex and Claude Code host trial checklist', () => {
    const doc = readFileSync(resolve(REPO_ROOT, 'docs/host-trial-checklist.md'), 'utf8');

    expect(doc).toContain('Routed Build');
    expect(doc).toContain('Explicit Build');
    expect(doc).toContain('Review');
    expect(doc).toContain('Explore');
    expect(doc).toContain('Checkpoint');
    expect(doc).toContain('Failure');
    expect(doc).toContain('Codex Scenarios');
    expect(doc).toContain('Claude Code Scenarios');
  });
});
