import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  PHASE2_CLOSE_CODEX_REL,
  PHASE2_CLOSE_MATRIX_REL,
  PHASE2_OPERATOR_PRODUCT_CHECK_REL,
  checkPhase2CloseMatrix,
} from '../../scripts/audit.mjs';

function withTempRepo(fn: (root: string, headSha: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'circuit-next-close-matrix-'));
  try {
    execSync('git init -q', { cwd: root, stdio: 'ignore' });
    execSync('git config user.email test@example.com', { cwd: root, stdio: 'ignore' });
    execSync('git config user.name test', { cwd: root, stdio: 'ignore' });
    execSync('git commit -q --allow-empty -m "root"', { cwd: root, stdio: 'ignore' });
    const headSha = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
    fn(root, headSha);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeRel(root: string, rel: string, body: string) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
}

function scaffoldEvidence(root: string, adrStatus = 'Accepted') {
  writeRel(root, 'evidence.txt', 'evidence\n');
  writeRel(root, 'scripts/audit.mjs', 'evidence\n');
  writeRel(
    root,
    'specs/adrs/ADR-0007-phase-2-close-criteria.md',
    `---
status: ${adrStatus}
---

ADR evidence.
`,
  );
}

function writeValidCloseArtifacts(root: string, codexClosingVerdict = 'ACCEPT (no findings)') {
  writeRel(
    root,
    PHASE2_CLOSE_CODEX_REL,
    `---
name: phase-2-close-codex
description: Codex phase-close challenger objection list.
type: review
review_kind: challenger-objection-list
target_kind: phase-close
review_target: phase-2
review_date: 2026-04-24
reviewer_model: gpt-5.4
reviewer_role: cross-model-challenger
mode: adversarial-llm-review
opening_verdict: ACCEPT
closing_verdict: ${codexClosingVerdict}
authored_by: gpt-5.4 via codex exec
fold_in_disposition: none required
---

# Phase 2 Close Codex Review
`,
  );
  writeRel(
    root,
    PHASE2_OPERATOR_PRODUCT_CHECK_REL,
    `---
name: phase-2-operator-product-check
description: Operator product-direction note for Phase 2 close.
type: review
review_kind: operator-product-direction-check
target_kind: phase-close
review_target: phase-2
review_date: 2026-04-24
operator: Pete Petrash
scope: product-direction-only
confirmation: Directionally acceptable to close Phase 2.
not_claimed:
  - full parity with prior-generation Circuit
authored_by: Pete Petrash
adr_authority: ADR-0007
---

# Phase 2 Operator Product Check
`,
  );
}

function validMatrix(headSha: string, overrides = '') {
  const criteriaRows = [
    ['P2-1', 'active — satisfied', '`evidence.txt`', headSha, 'test-enforced + audit-enforced'],
    ['P2-2', 'active — satisfied', '`evidence.txt`', headSha, 'test-enforced + audit-enforced'],
    ['P2-3', 'active — satisfied', '`evidence.txt`', headSha, 'audit-enforced + operator evidence'],
    ['P2-4', 'active — satisfied', '`evidence.txt`', headSha, 'test-enforced + audit-enforced'],
    ['P2-5', 'active — satisfied', '`evidence.txt`', headSha, 'test-enforced + audit-enforced'],
    ['P2-6', 'active — satisfied', '`evidence.txt`', headSha, 'test-enforced + audit-enforced'],
    [
      'P2-7',
      're-deferred',
      '`specs/adrs/ADR-0007-phase-2-close-criteria.md`',
      'ADR-0007 at `specs/adrs/ADR-0007-phase-2-close-criteria.md`',
      'ADR-covered re-deferral + audit-enforced citation discipline',
    ],
  ];
  const ratchets = [
    'runner_smoke_present',
    'workflow_fixture_runs',
    'event_log_round_trip',
    'snapshot_derived_from_log',
    'manifest_snapshot_byte_match',
    'status_docs_current',
    'tier_claims_current',
    'dispatch_realness',
    'workflow_parity_fixtures',
    'plugin_surface_present',
  ];
  return `---
review_kind: phase-close-matrix
target_kind: phase
phase_target: phase-2
phase_close_claim: false
cc_p2_8_state: active — red
${overrides}---

# Test Close Matrix

| criterion | status | evidence path | passing commit / adr | structural evidence type |
|---|---|---|---|---|
${criteriaRows.map((r) => `| ${r.join(' | ')} |`).join('\n')}

| ratchet | status | evidence path | passing commit | structural evidence type |
|---|---|---|---|---|
${ratchets.map((id) => `| ${id} | green | \`evidence.txt\` | ${headSha} | audit-enforced |`).join('\n')}
`;
}

describe('Check 37 — Phase 2 close matrix (ADR-0007 CC#P2-8)', () => {
  it('yellow when the matrix has not been authored yet', () => {
    withTempRepo((root) => {
      const result = checkPhase2CloseMatrix(root);
      expect(result.level).toBe('yellow');
      expect(result.detail).toMatch(/has not opened yet/);
    });
  });

  it('green on a shaped matrix that does not claim Phase 2 close', () => {
    withTempRepo((root, headSha) => {
      scaffoldEvidence(root);
      writeRel(root, PHASE2_CLOSE_MATRIX_REL, validMatrix(headSha));
      const result = checkPhase2CloseMatrix(root);
      expect(result.level).toBe('green');
      expect(result.detail).toContain('phase_close_claim=false');
    });
  });

  it('reds on duplicate or missing close-criterion rows', () => {
    withTempRepo((root, headSha) => {
      scaffoldEvidence(root);
      const malformed = validMatrix(headSha).replace('| P2-2 |', '| P2-1 |');
      writeRel(root, PHASE2_CLOSE_MATRIX_REL, malformed);
      const result = checkPhase2CloseMatrix(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/duplicate row P2-1/);
      expect(result.detail).toMatch(/missing row P2-2/);
    });
  });

  it('reds when an active-satisfied row has no resolving commit SHA', () => {
    withTempRepo((root, headSha) => {
      scaffoldEvidence(root);
      const malformed = validMatrix(headSha).replace(
        `| P2-1 | active — satisfied | \`evidence.txt\` | ${headSha} |`,
        '| P2-1 | active — satisfied | `evidence.txt` | missing-sha |',
      );
      writeRel(root, PHASE2_CLOSE_MATRIX_REL, malformed);
      const result = checkPhase2CloseMatrix(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/active-satisfied row must name a passing commit SHA/);
    });
  });

  it('allows an active-satisfied row to cite an accepted ADR substitution instead of a commit SHA', () => {
    withTempRepo((root, headSha) => {
      scaffoldEvidence(root);
      const adrBacked = validMatrix(headSha).replace(
        `| P2-1 | active — satisfied | \`evidence.txt\` | ${headSha} |`,
        '| P2-1 | active — satisfied | `evidence.txt`; `specs/adrs/ADR-0007-phase-2-close-criteria.md` | ADR-0007 at `specs/adrs/ADR-0007-phase-2-close-criteria.md` (substitution) |',
      );
      writeRel(root, PHASE2_CLOSE_MATRIX_REL, adrBacked);
      const result = checkPhase2CloseMatrix(root);
      expect(result.level).toBe('green');
    });
  });

  it('reds when a non-P2-1 active-satisfied row cites the ADR substitution without a SHA', () => {
    withTempRepo((root, headSha) => {
      scaffoldEvidence(root);
      const adrBacked = validMatrix(headSha).replace(
        `| P2-2 | active — satisfied | \`evidence.txt\` | ${headSha} |`,
        '| P2-2 | active — satisfied | `evidence.txt`; `specs/adrs/ADR-0007-phase-2-close-criteria.md` | ADR-0007 at `specs/adrs/ADR-0007-phase-2-close-criteria.md` (substitution) |',
      );
      writeRel(root, PHASE2_CLOSE_MATRIX_REL, adrBacked);
      const result = checkPhase2CloseMatrix(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/P2-2: active-satisfied row must name a passing commit SHA/);
      expect(result.detail).toMatch(/only P2-1 may cite the accepted ADR-0007 substitution/);
    });
  });

  it('reds when a non-P2-1 active-satisfied row mixes a SHA with the ADR substitution', () => {
    withTempRepo((root, headSha) => {
      scaffoldEvidence(root);
      const mixedAuthority = validMatrix(headSha).replace(
        `| P2-2 | active — satisfied | \`evidence.txt\` | ${headSha} |`,
        `| P2-2 | active — satisfied | \`evidence.txt\`; \`specs/adrs/ADR-0007-phase-2-close-criteria.md\` | ${headSha}; ADR-0007 at \`specs/adrs/ADR-0007-phase-2-close-criteria.md\` (substitution) |`,
      );
      writeRel(root, PHASE2_CLOSE_MATRIX_REL, mixedAuthority);
      const result = checkPhase2CloseMatrix(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/P2-2: active-satisfied row must not cite/);
      expect(result.detail).toMatch(/only P2-1 may use it/);
    });
  });

  it('reds when a non-P2-1 active-satisfied row cites the ADR substitution only as evidence', () => {
    withTempRepo((root, headSha) => {
      scaffoldEvidence(root);
      const evidenceOnly = validMatrix(headSha).replace(
        `| P2-2 | active — satisfied | \`evidence.txt\` | ${headSha} |`,
        `| P2-2 | active — satisfied | \`evidence.txt\`; \`specs/adrs/ADR-0007-phase-2-close-criteria.md\` | ${headSha} |`,
      );
      writeRel(root, PHASE2_CLOSE_MATRIX_REL, evidenceOnly);
      const result = checkPhase2CloseMatrix(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/P2-2: active-satisfied row must not cite/);
      expect(result.detail).toMatch(/evidence path or passing commit/);
    });
  });

  it('reds when phase_close_claim=true lacks the required close artifacts', () => {
    withTempRepo((root, headSha) => {
      scaffoldEvidence(root);
      const claiming = validMatrix(
        headSha,
        'phase_close_claim: true\ncc_p2_8_state: active — satisfied\n',
      ).replace('phase_close_claim: false\ncc_p2_8_state: active — red\n', '');
      writeRel(root, PHASE2_CLOSE_MATRIX_REL, claiming);
      const result = checkPhase2CloseMatrix(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/phase-2-close-codex\.md missing/);
      expect(result.detail).toMatch(/phase-2-operator-product-check\.md missing/);
    });
  });

  it('reds when phase_close_claim=true has malformed Codex review frontmatter', () => {
    withTempRepo((root, headSha) => {
      scaffoldEvidence(root);
      writeValidCloseArtifacts(root);
      writeRel(
        root,
        PHASE2_CLOSE_CODEX_REL,
        `---
name: phase-2-close-codex
description: malformed
type: review
review_kind: composition-review
target_kind: arc
review_target: phase-2
review_date: 2026-04-24
reviewer_model: gpt-5.4
reviewer_role: cross-model-challenger
mode: adversarial-llm-review
opening_verdict: ACCEPT
closing_verdict: ACCEPT
authored_by: gpt-5.4 via codex exec
fold_in_disposition: none required
---
`,
      );
      const claiming = validMatrix(
        headSha,
        'phase_close_claim: true\ncc_p2_8_state: active — satisfied\n',
      ).replace('phase_close_claim: false\ncc_p2_8_state: active — red\n', '');
      writeRel(root, PHASE2_CLOSE_MATRIX_REL, claiming);
      const result = checkPhase2CloseMatrix(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/review_kind must be challenger-objection-list/);
      expect(result.detail).toMatch(/target_kind must be phase-close/);
    });
  });

  it('reds when phase_close_claim=true has a malformed accept-looking Codex verdict', () => {
    withTempRepo((root, headSha) => {
      scaffoldEvidence(root);
      writeValidCloseArtifacts(root, 'ACCEPT-PENDING-FOLD-INS');
      const claiming = validMatrix(
        headSha,
        'phase_close_claim: true\ncc_p2_8_state: active — satisfied\n',
      ).replace('phase_close_claim: false\ncc_p2_8_state: active — red\n', '');
      writeRel(root, PHASE2_CLOSE_MATRIX_REL, claiming);
      const result = checkPhase2CloseMatrix(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/ACCEPT-class closing_verdict/);
    });
  });

  it('reds when phase_close_claim=true has malformed operator note frontmatter', () => {
    withTempRepo((root, headSha) => {
      scaffoldEvidence(root);
      writeValidCloseArtifacts(root);
      writeRel(
        root,
        PHASE2_OPERATOR_PRODUCT_CHECK_REL,
        `---
name: phase-2-operator-product-check
description: malformed
type: review
review_kind: operator-product-direction-check
target_kind: phase-close
review_target: phase-2
review_date: 2026-04-24
scope: product-direction-only
not_claimed: []
authored_by: Pete Petrash
adr_authority: ADR-0006
---
`,
      );
      const claiming = validMatrix(
        headSha,
        'phase_close_claim: true\ncc_p2_8_state: active — satisfied\n',
      ).replace('phase_close_claim: false\ncc_p2_8_state: active — red\n', '');
      writeRel(root, PHASE2_CLOSE_MATRIX_REL, claiming);
      const result = checkPhase2CloseMatrix(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/operator must be non-empty/);
      expect(result.detail).toMatch(/not_claimed list must be non-empty/);
      expect(result.detail).toMatch(/adr_authority must be ADR-0007/);
    });
  });

  it('reds when a re-deferred row cites an ADR that is not accepted', () => {
    withTempRepo((root, headSha) => {
      scaffoldEvidence(root, 'Draft');
      writeRel(root, PHASE2_CLOSE_MATRIX_REL, validMatrix(headSha));
      const result = checkPhase2CloseMatrix(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/re-deferred ADR citation must have status Accepted/);
    });
  });

  it('reds when a re-deferred row cites an accept-looking non-status', () => {
    withTempRepo((root, headSha) => {
      scaffoldEvidence(root, 'Accepted-but-not-really');
      writeRel(root, PHASE2_CLOSE_MATRIX_REL, validMatrix(headSha));
      const result = checkPhase2CloseMatrix(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/re-deferred ADR citation must have status Accepted/);
    });
  });

  it('green when phase_close_claim=true has valid close artifacts and final rows', () => {
    withTempRepo((root, headSha) => {
      scaffoldEvidence(root, 'Accepted (test annotation)');
      writeValidCloseArtifacts(root);
      const claiming = validMatrix(
        headSha,
        'phase_close_claim: true\ncc_p2_8_state: active — satisfied\n',
      ).replace('phase_close_claim: false\ncc_p2_8_state: active — red\n', '');
      writeRel(root, PHASE2_CLOSE_MATRIX_REL, claiming);
      const result = checkPhase2CloseMatrix(root);
      expect(result.level).toBe('green');
      expect(result.detail).toContain('phase_close_claim=true');
    });
  });

  it('green on the live repo matrix', () => {
    const result = checkPhase2CloseMatrix();
    if (result.level !== 'green') {
      throw new Error(result.detail);
    }
    expect(result.detail).toContain('criteria rows');
  });
});
