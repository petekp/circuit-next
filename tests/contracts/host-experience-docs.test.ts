import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EnabledConnector } from '../../src/schemas/connector.js';

const REPO_ROOT = resolve(__dirname, '..', '..');

function readDoc(path: string): string {
  return readFileSync(resolve(REPO_ROOT, path), 'utf8');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function section(doc: string, heading: string): string {
  const match = new RegExp(`^#{2,3} ${escapeRegExp(heading)}$`, 'm').exec(doc);
  if (match?.index === undefined) throw new Error(`missing section ${heading}`);
  const marker = match[0];
  const rest = doc.slice(match.index + marker.length);
  const next = rest.search(marker.startsWith('###') ? /\n#{2,3} / : /\n## /);
  return next < 0 ? rest : rest.slice(0, next);
}

function frontmatterValue(doc: string, key: string): string | undefined {
  const match = doc.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return match?.[1]?.trim();
}

describe('host experience docs', () => {
  it('keeps host contract documents machine-identifiable', () => {
    expect(frontmatterValue(readDoc('docs/contracts/host-capabilities.md'), 'contract')).toBe(
      'host-capabilities',
    );
    expect(frontmatterValue(readDoc('docs/contracts/native-host-adapters.md'), 'contract')).toBe(
      'native-host-adapters',
    );
  });

  it('defines each shared host capability in the slot list and host mappings', () => {
    const doc = readDoc('docs/contracts/host-capabilities.md');
    const slots = ['progress', 'task_list', 'ask_user', 'final_summary', 'deep_links', 'debug'];

    for (const slot of slots) {
      expect(section(doc, 'Capability Slots')).toMatch(new RegExp(`- \`${slot}\`:`));
    }

    for (const host of [
      'Generic Shell',
      'Codex Plugin',
      'Codex App Server',
      'Claude Code Command',
      'Claude Agent SDK',
    ]) {
      const hostSection = section(doc, host);
      for (const slot of slots) expect(hostSection).toContain(`\`${slot}\``);
    }
  });

  it('keeps native adapter docs tied to the host-neutral event stream', () => {
    const doc = readDoc('docs/contracts/native-host-adapters.md');
    const sharedEvents = section(doc, 'Shared Events');
    expect(sharedEvents).toContain('task_list.updated');
    expect(sharedEvents).toContain('user_input.requested');
    expect(sharedEvents).toContain('operator_summary_markdown_path');
    expect(section(doc, 'Claude Agent SDK Track')).toContain('AskUserQuestion');
    expect(section(doc, 'Codex App Server Track')).toContain('tool/requestUserInput');
    expect(section(doc, 'Non-Goals For This Slice')).toContain(
      'does not implement either native bridge',
    );
  });

  it('keeps Claude presentation acceptance checks as visible transcript constraints', () => {
    const doc = readDoc('docs/specs/narration-display-profiles.md');
    const acceptance = section(doc, 'Transcript Acceptance');
    for (const rule of [
      'no raw JSONL',
      'no final stdout JSON',
      'no report section by default',
      'max 4-6 visible final bullets',
      'max 3 visible reviewer cautions',
    ]) {
      expect(acceptance).toContain(`- ${rule}`);
    }
  });

  it('keeps a repeatable Codex and Claude Code host trial checklist', () => {
    const doc = readDoc('docs/host-trial-checklist.md');
    const codex = section(doc, 'Codex Scenarios');
    const claude = section(doc, 'Claude Code Scenarios');
    expect(codex).toContain(
      '@Circuit the checkout total is wrong when discounts and tax both apply',
    );
    expect(codex).toContain('@Circuit please review my current diff');
    expect(codex).toContain('@Circuit add billing settings to the account page');
    expect(codex).toContain('Explicit Build');
    expect(claude).toContain('/circuit:run <natural task>');
    expect(claude).toContain('Explicit Build');
    expect(section(doc, 'What To Grade')).toContain('Did verification and review actually run?');
  });

  it('keeps /circuit:run host guidance aligned with model-mediated selection', () => {
    const doc = readDoc('plugins/claude/commands/run.md');
    expect(doc).toContain('/circuit:run — flow selector');
    expect(doc).toContain('Select the flow before invoking the CLI');
    expect(doc).toContain('Let the presentation wrapper render output');
    expect(doc).not.toContain('Do not classify the task yourself');
    expect(doc).not.toContain('selected_flow === "sweep"');
    expect(doc).not.toContain('reports/sweep-result.json');
  });

  it('keeps README connector names and custom protocol aligned with schemas and runtime', () => {
    const doc = readDoc('README.md');
    const advancedIndex = doc.indexOf('**Advanced compatibility:**');

    expect(doc).toContain(
      '/circuit:run the checkout total is wrong when discounts and tax both apply',
    );
    expect(doc).toContain('@Circuit the checkout total is wrong when discounts and tax both apply');
    expect(advancedIndex).toBeGreaterThan(0);
    for (const prefix of ['fix:', 'develop:', 'cleanup:', 'overnight:', 'decide:']) {
      expect(doc.indexOf(prefix)).toBeGreaterThan(advancedIndex);
    }
    for (const connector of EnabledConnector.options) {
      expect(doc).toContain(`**\`${connector}\`**`);
    }
    expect(doc).not.toContain('**`agent`**');
    expect(doc).toContain('stdin is ignored');
    expect(doc).toContain('inherits the Circuit process environment');
    expect(doc).toContain('not an OS sandbox');
  });
});
