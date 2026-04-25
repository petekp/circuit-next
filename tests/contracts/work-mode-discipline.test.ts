import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  TWO_MODE_HARDENING_SLICE,
  TWO_MODE_METHODOLOGY_ADOPTION_SLICE,
  checkCodexChallengerRequiredDeclaration,
  checkFramingDiscipline,
  checkWorkModeDiscipline,
} from '../../scripts/audit.mjs';

type AuditCommit = {
  hash: string;
  short: string;
  subject: string;
  body: string;
};

function writeRel(root: string, rel: string, content: string): void {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function withTempRepo(fn: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'work-mode-audit-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
    execFileSync('git', ['commit', '--allow-empty', '-q', '-m', 'root'], { cwd: root });
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function commitFiles(
  root: string,
  subject: string,
  body: string,
  files: Readonly<Record<string, string>>,
): AuditCommit {
  for (const [rel, content] of Object.entries(files)) {
    writeRel(root, rel, content);
  }
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-q', '-m', subject, '-m', body], { cwd: root });
  const hash = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim();
  return { hash, short: hash.slice(0, 7), subject, body };
}

describe('ADR-0012 work mode discipline audit', () => {
  it('does not apply before or at the methodology adoption slice', () => {
    withTempRepo((root) => {
      const commit = commitFiles(
        root,
        `slice-${TWO_MODE_METHODOLOGY_ADOPTION_SLICE}: adopt two-mode methodology`,
        'Lane: Ratchet-Advance',
        { 'scripts/audit.mjs': 'adoption change\n' },
      );
      const result = checkWorkModeDiscipline([commit], root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/not yet applicable/);
    });
  });

  it('reds on a future slice without exactly one Work mode declaration', () => {
    withTempRepo((root) => {
      const missing = commitFiles(root, 'slice-133: missing mode', 'Lane: Ratchet-Advance', {
        'src/schemas/repair.ts': 'export const marker = true;\n',
      });
      const duplicate = commitFiles(
        root,
        'slice-134: duplicate mode',
        ['Lane: Ratchet-Advance', 'Work mode: Light', 'Work mode: Heavy'].join('\n'),
        { 'src/schemas/repair-2.ts': 'export const marker = true;\n' },
      );
      const result = checkWorkModeDiscipline([missing, duplicate], root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/slice-133: missing mode/);
      expect(result.detail).toMatch(/found 0/);
      expect(result.detail).toMatch(/slice-134: duplicate mode/);
      expect(result.detail).toMatch(/found 2/);
    });
  });

  it('passes Light mode for schema, policy, tests, and non-claim status docs', () => {
    withTempRepo((root) => {
      const commit = commitFiles(
        root,
        'slice-133: light prep',
        ['Lane: Ratchet-Advance', 'Work mode: Light'].join('\n'),
        {
          'src/schemas/artifacts/repair.ts': 'export const marker = true;\n',
          'scripts/policy/workflow-kind-policy.mjs': 'export const marker = true;\n',
          'tests/contracts/repair-artifact-schemas.test.ts': 'export const marker = true;\n',
          'PROJECT_STATE.md': '<!-- current_slice: 133 -->\n',
        },
      );
      const result = checkWorkModeDiscipline([commit], root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/1 post-ADR-0012 slice/);
    });
  });

  it('reds when Light mode changes close, signoff, or live-proof claim text in status docs', () => {
    withTempRepo((root) => {
      const commit = commitFiles(
        root,
        'slice-133: light claim docs',
        ['Lane: Ratchet-Advance', 'Work mode: Light'].join('\n'),
        {
          README: 'This name is intentionally not audited.\n',
          'README.md': 'The Repair workflow is operator-signed with live proof.\n',
          'PROJECT_STATE.md': 'The plan was signed off; current_phase moved.\n',
          'PROJECT_STATE-chronicle.md':
            'Workflow close claim: Repair sign-off is complete and operational.\n',
          'TIER.md': 'closed_in_slice: 133\n',
        },
      );
      const result = checkWorkModeDiscipline([commit], root);
      expect(result.level).toBe('red');
      expect(result.detail).toContain('close/signoff/live-proof claim text');
      expect(result.detail).toContain('README.md');
      expect(result.detail).toContain('PROJECT_STATE.md');
      expect(result.detail).toContain('PROJECT_STATE-chronicle.md');
      expect(result.detail).toContain('TIER.md');
    });
  });

  it('reds when Light mode touches obvious heavy surfaces', () => {
    withTempRepo((root) => {
      const commit = commitFiles(
        root,
        'slice-133: light but heavy files',
        ['Lane: Ratchet-Advance', 'Work mode: Light'].join('\n'),
        {
          AGENTS: 'This name is intentionally not audited.\n',
          'AGENTS.md': 'methodology guidance change\n',
          'CLAUDE.md': 'compatibility guidance change\n',
          'bin/circuit-next': '#!/usr/bin/env node\n',
          'src/cli/dogfood.ts': 'cli change\n',
          'src/runtime/runner.ts': 'runtime change\n',
          'src/runtime/router.ts': 'router change\n',
          'src/runtime/event-log-reader.ts': 'reader change\n',
          'src/runtime/event-writer.ts': 'writer change\n',
          'src/runtime/result-writer.ts': 'result change\n',
          'src/runtime/snapshot-writer.ts': 'snapshot change\n',
          'src/runtime/adapters/agent.ts': 'adapter change\n',
          'commands/repair.md': '# command\n',
          '.claude-plugin/plugin.json': '{}\n',
          'specs/adrs/ADR-9999-test.md': '# adr\n',
          'specs/methodology/decision.md': '# decision\n',
          'scripts/audit.mjs': 'audit change\n',
          'scripts/plan-lint.mjs': 'plan lint change\n',
          'specs/plans/repair-workflow-parity.md': '# plan\n',
        },
      );
      const result = checkWorkModeDiscipline([commit], root);
      expect(result.level).toBe('red');
      expect(result.detail).toContain('AGENTS.md');
      expect(result.detail).toContain('CLAUDE.md');
      expect(result.detail).toContain('bin/circuit-next');
      expect(result.detail).toContain('src/cli/dogfood.ts');
      expect(result.detail).toContain('src/runtime/runner.ts');
      expect(result.detail).toContain('src/runtime/router.ts');
      expect(result.detail).toContain('src/runtime/event-log-reader.ts');
      expect(result.detail).toContain('src/runtime/event-writer.ts');
      expect(result.detail).toContain('src/runtime/result-writer.ts');
      expect(result.detail).toContain('src/runtime/snapshot-writer.ts');
      expect(result.detail).toContain('src/runtime/adapters/agent.ts');
      expect(result.detail).toContain('commands/repair.md');
      expect(result.detail).toContain('.claude-plugin/plugin.json');
      expect(result.detail).toContain('specs/adrs/ADR-9999-test.md');
      expect(result.detail).toContain('specs/methodology/decision.md');
      expect(result.detail).toContain('scripts/audit.mjs');
      expect(result.detail).toContain('scripts/plan-lint.mjs');
      expect(result.detail).toContain('specs/plans/repair-workflow-parity.md');
    });
  });

  it('reds when Heavy mode omits the Codex challenger trigger', () => {
    withTempRepo((root) => {
      const commit = commitFiles(
        root,
        'slice-133: heavy missing challenger',
        ['Lane: Ratchet-Advance', 'Work mode: Heavy'].join('\n'),
        { 'src/runtime/runner.ts': 'runtime change\n' },
      );
      const result = checkWorkModeDiscipline([commit], root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/Work mode Heavy requires/);
    });
  });

  it('passes Heavy mode when the Codex challenger trigger and existing evidence rule are satisfied', () => {
    withTempRepo((root) => {
      const body = ['Lane: Ratchet-Advance', 'Work mode: Heavy', 'Codex challenger: REQUIRED'].join(
        '\n',
      );
      const commit = commitFiles(root, 'slice-133: heavy with challenger', body, {
        'src/runtime/runner.ts': 'runtime change\n',
      });
      writeRel(
        root,
        'specs/reviews/arc-slice-133-codex.md',
        '---\nname: arc-slice-133-codex\nclosing_verdict: ACCEPT\n---\n',
      );

      const modeResult = checkWorkModeDiscipline([commit], root);
      expect(modeResult.level).toBe('green');
      const challengerResult = checkCodexChallengerRequiredDeclaration(root);
      expect(challengerResult.level).toBe('green');
      expect(challengerResult.detail).toContain('per-slice review');
    });
  });

  it('accepts pair-only Light framing after the hardening slice', () => {
    withTempRepo((root) => {
      const commit = commitFiles(
        root,
        `slice-${TWO_MODE_HARDENING_SLICE}: light pair framing`,
        [
          'Lane: Ratchet-Advance',
          'Work mode: Light',
          'Failure mode: Small schema prep lacked a typed contract target.',
          'Acceptance evidence: focused schema tests pass.',
        ].join('\n'),
        { 'src/schemas/fix.ts': 'export const marker = true;\n' },
      );
      const result = checkFramingDiscipline([commit], root);
      expect(result.level).toBe('green');
      expect(result.detail).toContain('ambiguous Light');
    });
  });

  it('still rejects Heavy framing that omits why-this-not-adjacent after hardening', () => {
    withTempRepo((root) => {
      const commit = commitFiles(
        root,
        `slice-${TWO_MODE_HARDENING_SLICE}: heavy pair framing`,
        [
          'Lane: Ratchet-Advance',
          'Work mode: Heavy',
          'Failure mode: Runtime routing could falsely report completion.',
          'Acceptance evidence: verify and audit pass.',
        ].join('\n'),
        { 'src/runtime/router.ts': 'router change\n' },
      );
      const result = checkFramingDiscipline([commit], root);
      expect(result.level).toBe('yellow');
      expect(result.detail).toContain('missing: why this not adjacent');
    });
  });

  it('still rejects pre-hardening Light framing that omits why-this-not-adjacent', () => {
    withTempRepo((root) => {
      const commit = commitFiles(
        root,
        'slice-142: pre-hardening light pair framing',
        [
          'Lane: Ratchet-Advance',
          'Work mode: Light',
          'Failure mode: Prep work lacked a small framing pair.',
          'Acceptance evidence: focused tests pass.',
        ].join('\n'),
        { 'src/schemas/pre-hardening.ts': 'export const marker = true;\n' },
      );
      const result = checkFramingDiscipline([commit], root);
      expect(result.level).toBe('yellow');
      expect(result.detail).toContain('missing: why this not adjacent');
    });
  });

  it('treats duplicate Work mode declarations as ambiguous framing', () => {
    withTempRepo((root) => {
      const commit = commitFiles(
        root,
        `slice-${TWO_MODE_HARDENING_SLICE}: ambiguous pair framing`,
        [
          'Lane: Ratchet-Advance',
          'Work mode: Light',
          'Work mode: Heavy',
          'Failure mode: Conflicting work-mode labels hide the risk class.',
          'Acceptance evidence: audit reports the duplicate.',
        ].join('\n'),
        { 'src/schemas/ambiguous.ts': 'export const marker = true;\n' },
      );
      const result = checkFramingDiscipline([commit], root);
      expect(result.level).toBe('yellow');
      expect(result.detail).toContain('missing: why this not adjacent');
    });
  });
});
