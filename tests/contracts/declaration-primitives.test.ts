// Declaration-layer primitive schemas — `Rigor`, `Role`, and
// `LaneDeclaration` exports from `src/index.ts`. No invariant ID
// family is bound to these primitives directly; the tests cover the
// closed-enum + structural shape contracts that the larger family
// suites build on top of.
//
// Split from the original `schema-parity.test.ts` mega-file as part
// of FU-T09.

import { describe, expect, it } from 'vitest';
import { LaneDeclaration, Rigor, Role, isConsequentialRigor } from '../../src/index.js';

describe('rigor', () => {
  it('accepts known tiers and rejects unknown', () => {
    expect(Rigor.safeParse('standard').success).toBe(true);
    expect(Rigor.safeParse('tournament').success).toBe(true);
    expect(Rigor.safeParse('max').success).toBe(false);
  });

  it('consequential rigor includes autonomous', () => {
    expect(isConsequentialRigor('deep')).toBe(true);
    expect(isConsequentialRigor('tournament')).toBe(true);
    expect(isConsequentialRigor('autonomous')).toBe(true);
    expect(isConsequentialRigor('lite')).toBe(false);
    expect(isConsequentialRigor('standard')).toBe(false);
  });
});

describe('role', () => {
  it('only includes dispatch roles; orchestrator is an executor, not a role', () => {
    expect(Role.safeParse('researcher').success).toBe(true);
    expect(Role.safeParse('implementer').success).toBe(true);
    expect(Role.safeParse('reviewer').success).toBe(true);
    expect(Role.safeParse('orchestrator').success).toBe(false);
  });
});

describe('LaneDeclaration', () => {
  it('standard lanes require failure_mode + acceptance_evidence + alternate_framing', () => {
    const ok = LaneDeclaration.safeParse({
      lane: 'ratchet-advance',
      failure_mode: 'regression on X',
      acceptance_evidence: 'test Y passes',
      alternate_framing: 'could frame as discovery',
    });
    expect(ok.success).toBe(true);
  });

  it('migration-escrow requires expires_at + restoration_plan', () => {
    const missingExpiry = LaneDeclaration.safeParse({
      lane: 'migration-escrow',
      failure_mode: 'mid-migration state',
      acceptance_evidence: 'all old call sites removed',
      alternate_framing: 'could do it in one slice',
    });
    expect(missingExpiry.success).toBe(false);

    const ok = LaneDeclaration.safeParse({
      lane: 'migration-escrow',
      failure_mode: 'mid-migration',
      acceptance_evidence: 'all old call sites removed',
      alternate_framing: 'one slice',
      expires_at: '2026-05-01T00:00:00.000Z',
      restoration_plan: 'revert commit X + re-run legacy test suite',
    });
    expect(ok.success).toBe(true);
  });

  it('break-glass requires post_hoc_adr_deadline_at', () => {
    const noDeadline = LaneDeclaration.safeParse({
      lane: 'break-glass',
      failure_mode: 'prod down',
      acceptance_evidence: 'pager cleared',
      alternate_framing: 'triage then normal repair',
    });
    expect(noDeadline.success).toBe(false);
  });
});
