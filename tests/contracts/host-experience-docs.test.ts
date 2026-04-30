import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EnabledConnector } from '../../src/schemas/connector.js';

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

  it('keeps /circuit:run host guidance aligned with routed Sweep support', () => {
    const doc = readFileSync(resolve(REPO_ROOT, 'commands/run.md'), 'utf8');

    expect(doc).toContain('cleanup/overnight tasks route to `sweep`');
    expect(doc).toContain("./bin/circuit-next run --goal 'cleanup: remove safe dead code'");
    expect(doc).toContain("./bin/circuit-next run --goal 'overnight: improve repo quality'");
    expect(doc).toContain('selected_flow === "sweep"');
    expect(doc).toContain('reports/sweep-result.json');
  });

  it('keeps README connector names and custom protocol aligned with schemas and runtime', () => {
    const doc = readFileSync(resolve(REPO_ROOT, 'README.md'), 'utf8');

    for (const connector of EnabledConnector.options) {
      expect(doc).toContain(`**\`${connector}\`**`);
    }
    expect(doc).not.toContain('**`agent`**');
    expect(doc).toContain('stdin is ignored');
    expect(doc).toContain('inherits the Circuit process environment');
    expect(doc).toContain('not an OS sandbox');
  });
});
