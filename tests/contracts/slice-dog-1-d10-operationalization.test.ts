import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { checkAdversarialYieldLedger } from '../../scripts/audit.mjs';

// Slice DOG+1 — `circuit:review` D10 Operationalization.
//
// Contract oracle for the rigor-profile budget binding, review-execution
// alternation, Tournament non-LLM gate, "Why continue?" checkpoint, and
// grandfather cutoff installed by
// `specs/methodology/decision.md` §D10 Extension and
// ADR-0001 Addendum B §Phase 1.5 Close Criteria #10.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

function withTempRepo(fn: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'circuit-next-dog1-'));
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function withTempGitRepo(fn: (root: string, execSha: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'circuit-next-dog1-git-'));
  try {
    execSync(`git -C "${root}" init --quiet`);
    execSync(`git -C "${root}" config user.email "test@example.com"`);
    execSync(`git -C "${root}" config user.name "Test"`);
    // Execution commit touches a non-specs/reviews/ path.
    writeFileSync(join(root, 'src-fake.ts'), 'export const x = 1;\n');
    execSync(`git -C "${root}" add src-fake.ts`);
    execSync(`git -C "${root}" commit --quiet -m "exec commit"`);
    const sha = execSync(`git -C "${root}" rev-parse HEAD`, { encoding: 'utf-8' }).trim();
    fn(root, sha);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeRel(root: string, rel: string, body: string) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
}

const LEDGER_HEADER = `---
name: adversarial-yield-ledger
description: Test fixture.
type: ledger
date: 2026-04-20
---

# Fixture

| pass_date | artifact_path | artifact_class | pass_number_for_artifact | reviewer_id | mode | HIGH_count | MED_count | LOW_count | verdict | operator_justification_if_past_cap | rigor_profile | why_continue_failure_class | prior_execution_commit_sha |
|---|---|---|---:|---|---|---:|---:|---:|---|---|---|---|---|
`;

function ledger(rows: string[]): string {
  return `${LEDGER_HEADER}${rows.join('\n')}\n`;
}

const SUBSTANTIVE_WHY =
  'reducer callback-shape drift masked by prior pass LLM echo — hunted by replaying with alternative goal';

describe('Slice DOG+1 — D10 extension on current ledger', () => {
  it('current adversarial-yield-ledger.md passes green under extended audit', () => {
    const result = checkAdversarialYieldLedger(REPO_ROOT);
    expect(result.level).toBe('green');
    expect(result.detail).toMatch(/rigor-binding clean/);
  });
});

describe('Slice DOG+1 — rigor-profile budget binding', () => {
  it('reds when a lite-rigor row records an adversarial pass (budget 0)', () => {
    withTempRepo((root) => {
      const row =
        '| 2026-05-01 | `artifact.md` | reversible | 1 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | n/a | lite | n/a | n/a |';
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger([row]));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/lite.*budget 0/);
    });
  });

  it('reds when a standard-rigor row has pass_number 2 with placeholder justification', () => {
    withTempRepo((root) => {
      const rows = [
        '| 2026-05-01 | `artifact.md` | governance | 1 | gpt-5-codex | llm-review | 2 | 2 | 1 | REJECT | n/a | standard | n/a | n/a |',
        `| 2026-05-01 | \`artifact.md\` | governance | 2 | gpt-5-codex | llm-review | 0 | 1 | 0 | ACCEPT | n/a | standard | ${SUBSTANTIVE_WHY} | n/a |`,
      ];
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger(rows));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/exceeds rigor "standard" budget 1/);
    });
  });

  it('reds on unknown rigor_profile value', () => {
    withTempRepo((root) => {
      const row =
        '| 2026-05-01 | `artifact.md` | governance | 1 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | n/a | ultra | n/a | n/a |';
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger([row]));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/rigor_profile "ultra"/);
    });
  });
});

describe('Slice DOG+1 — why_continue checkpoint', () => {
  it('reds when pass 2 deep row omits why_continue_failure_class', () => {
    withTempGitRepo((root, sha) => {
      const rows = [
        '| 2026-05-01 | `artifact.md` | governance | 1 | gpt-5-codex | llm-review | 2 | 2 | 0 | REJECT | n/a | deep | n/a | n/a |',
        `| 2026-05-01 | \`artifact.md\` | governance | 2 | gpt-5-codex | llm-review | 0 | 1 | 0 | ACCEPT | n/a | deep | n/a | ${sha} |`,
      ];
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger(rows));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/why_continue_failure_class/);
    });
  });

  it('reds when pass 2 why_continue is a vague placeholder', () => {
    withTempGitRepo((root, sha) => {
      const rows = [
        '| 2026-05-01 | `artifact.md` | governance | 1 | gpt-5-codex | llm-review | 2 | 2 | 0 | REJECT | n/a | deep | n/a | n/a |',
        `| 2026-05-01 | \`artifact.md\` | governance | 2 | gpt-5-codex | llm-review | 0 | 1 | 0 | ACCEPT | n/a | deep | more review | ${sha} |`,
      ];
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger(rows));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/specific failure class/);
    });
  });
});

describe('Slice DOG+1 — review-execution alternation (Deep / Tournament)', () => {
  it('reds when deep-rigor pass 2 omits prior_execution_commit_sha', () => {
    withTempRepo((root) => {
      const rows = [
        '| 2026-05-01 | `artifact.md` | governance | 1 | gpt-5-codex | llm-review | 2 | 2 | 0 | REJECT | n/a | deep | n/a | n/a |',
        `| 2026-05-01 | \`artifact.md\` | governance | 2 | gpt-5-codex | llm-review | 0 | 1 | 0 | ACCEPT | n/a | deep | ${SUBSTANTIVE_WHY} | n/a |`,
      ];
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger(rows));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/prior_execution_commit_sha required/);
    });
  });

  it('reds when prior_execution_commit_sha does not resolve as a git commit', () => {
    withTempRepo((root) => {
      const rows = [
        '| 2026-05-01 | `artifact.md` | governance | 1 | gpt-5-codex | llm-review | 2 | 2 | 0 | REJECT | n/a | deep | n/a | n/a |',
        `| 2026-05-01 | \`artifact.md\` | governance | 2 | gpt-5-codex | llm-review | 0 | 1 | 0 | ACCEPT | n/a | deep | ${SUBSTANTIVE_WHY} | deadbeef0000000000000000000000000000dead |`,
      ];
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger(rows));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/invalid/);
    });
  });

  it('passes deep-rigor pass 2 with valid SHA and substantive why_continue', () => {
    withTempGitRepo((root, sha) => {
      const rows = [
        '| 2026-05-01 | `artifact.md` | governance | 1 | gpt-5-codex | llm-review | 2 | 2 | 0 | REJECT | n/a | deep | n/a | n/a |',
        `| 2026-05-01 | \`artifact.md\` | governance | 2 | gpt-5-codex | llm-review | 0 | 1 | 0 | ACCEPT | n/a | deep | ${SUBSTANTIVE_WHY} | ${sha} |`,
      ];
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger(rows));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('green');
    });
  });
});

describe('Slice DOG+1 — Tournament non-LLM before pass 3', () => {
  it('reds when tournament pass 3 has only llm- prior rows', () => {
    withTempGitRepo((root, sha) => {
      const rows = [
        '| 2026-05-01 | `artifact.md` | governance | 1 | gpt-5-codex | llm-review | 2 | 2 | 0 | REJECT | n/a | tournament | n/a | n/a |',
        `| 2026-05-01 | \`artifact.md\` | governance | 2 | claude-opus-4-7 | llm-cold-read | 1 | 1 | 0 | REJECT | n/a | tournament | ${SUBSTANTIVE_WHY} | ${sha} |`,
        `| 2026-05-01 | \`artifact.md\` | governance | 3 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | n/a | tournament | ${SUBSTANTIVE_WHY} | ${sha} |`,
      ];
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger(rows));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/non-LLM mode required before pass 3/);
    });
  });

  it('passes tournament pass 3 with at least one non-LLM prior row', () => {
    withTempGitRepo((root, sha) => {
      const rows = [
        '| 2026-05-01 | `artifact.md` | governance | 1 | gpt-5-codex | llm-review | 2 | 2 | 0 | REJECT | n/a | tournament | n/a | n/a |',
        `| 2026-05-01 | \`artifact.md\` | governance | 2 | human | human-cold-read | 1 | 1 | 0 | REJECT | n/a | tournament | ${SUBSTANTIVE_WHY} | ${sha} |`,
        `| 2026-05-01 | \`artifact.md\` | governance | 3 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | n/a | tournament | ${SUBSTANTIVE_WHY} | ${sha} |`,
      ];
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger(rows));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('green');
    });
  });
});

describe('Slice DOG+1 — grandfather cutoff', () => {
  it('reds when pre-dog-1-grandfather row is dated after the cutoff', () => {
    withTempRepo((root) => {
      const row =
        '| 2026-05-01 | `artifact.md` | governance | 1 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | n/a | pre-dog-1-grandfather | n/a | n/a |';
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger([row]));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/grandfather.*not permitted/);
    });
  });

  it('passes pre-dog-1-grandfather rows dated on or before cutoff', () => {
    withTempRepo((root) => {
      const row =
        '| 2026-04-20 | `artifact.md` | governance | 1 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | n/a | pre-dog-1-grandfather | n/a | n/a |';
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger([row]));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('green');
    });
  });
});

describe('Slice DOG+1 — autonomous is yellow-but-not-red', () => {
  it('warns (yellow) on autonomous rigor_profile — operator should record resolved profile', () => {
    withTempRepo((root) => {
      const row =
        '| 2026-05-01 | `artifact.md` | governance | 1 | gpt-5-codex | llm-review | 0 | 0 | 0 | ACCEPT | n/a | autonomous | n/a | n/a |';
      writeRel(root, 'specs/reviews/adversarial-yield-ledger.md', ledger([row]));
      const result = checkAdversarialYieldLedger(root);
      expect(result.level).toBe('yellow');
      expect(result.detail).toMatch(/autonomous.*unbound/);
    });
  });
});
