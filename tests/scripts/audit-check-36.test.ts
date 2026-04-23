/**
 * Audit Check 36 regression coverage (Slice-58a — Codex MED-2 fold-in).
 *
 * Minimal green-path integration test: the current repo's committed plan
 * corpus passes Check 36 end-to-end. Full synthetic-history coverage
 * (missing binding, non-ancestor SHA, predecessor status != challenger-
 * cleared, rename after signoff, etc.) is deferred — those cases require
 * a temp git repo harness which belongs in a follow-up slice alongside
 * plan-lint test refactoring.
 */

import { describe, expect, it } from 'vitest';
// @ts-expect-error — audit.mjs is an ESM .mjs file with no .d.ts; this
// test imports the exported helper directly.
import { checkPlanLintCommittedPlans } from '../../scripts/audit.mjs';

describe('audit Check 36 — plan-lint on committed plans', () => {
  it('returns green against the current repo (all 9 plans pass + operator-signoff binding valid)', () => {
    const result = checkPlanLintCommittedPlans();
    expect(result.level).toBe('green');
    expect(result.detail).toMatch(/All \d+ committed plans pass plan-lint/);
  });
});
