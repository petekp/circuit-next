// Declaration-layer scalar schemas — `Depth`, `Role`, and
// `ChangeKindDeclaration` exports from `src/index.ts`. Covers closed-enum
// and structural-shape contracts that the larger family suites build on.

import { describe, expect, it } from 'vitest';
import { ChangeKindDeclaration, Depth, Role, isConsequentialDepth } from '../../src/index.js';

describe('depth', () => {
  it('accepts known tiers and rejects unknown', () => {
    expect(Depth.safeParse('standard').success).toBe(true);
    expect(Depth.safeParse('tournament').success).toBe(true);
    expect(Depth.safeParse('max').success).toBe(false);
  });

  it('consequential depth includes autonomous', () => {
    expect(isConsequentialDepth('deep')).toBe(true);
    expect(isConsequentialDepth('tournament')).toBe(true);
    expect(isConsequentialDepth('autonomous')).toBe(true);
    expect(isConsequentialDepth('lite')).toBe(false);
    expect(isConsequentialDepth('standard')).toBe(false);
  });
});

describe('role', () => {
  it('only includes relay roles; orchestrator is an executor, not a role', () => {
    expect(Role.safeParse('researcher').success).toBe(true);
    expect(Role.safeParse('implementer').success).toBe(true);
    expect(Role.safeParse('reviewer').success).toBe(true);
    expect(Role.safeParse('orchestrator').success).toBe(false);
  });
});

describe('ChangeKindDeclaration', () => {
  it('standard change_kinds require failure_mode + acceptance_evidence + alternate_framing', () => {
    const ok = ChangeKindDeclaration.safeParse({
      change_kind: 'ratchet-advance',
      failure_mode: 'regression on X',
      acceptance_evidence: 'test Y passes',
      alternate_framing: 'could frame as discovery',
    });
    expect(ok.success).toBe(true);
  });

  it('migration-escrow requires expires_at + restoration_plan', () => {
    const missingExpiry = ChangeKindDeclaration.safeParse({
      change_kind: 'migration-escrow',
      failure_mode: 'mid-migration state',
      acceptance_evidence: 'all old call sites removed',
      alternate_framing: 'could do it in one slice',
    });
    expect(missingExpiry.success).toBe(false);

    const ok = ChangeKindDeclaration.safeParse({
      change_kind: 'migration-escrow',
      failure_mode: 'mid-migration',
      acceptance_evidence: 'all old call sites removed',
      alternate_framing: 'one slice',
      expires_at: '2026-05-01T00:00:00.000Z',
      restoration_plan: 'revert commit X + re-run legacy test suite',
    });
    expect(ok.success).toBe(true);
  });

  it('break-glass requires post_hoc_adr_deadline_at', () => {
    const noDeadline = ChangeKindDeclaration.safeParse({
      change_kind: 'break-glass',
      failure_mode: 'prod down',
      acceptance_evidence: 'pager cleared',
      alternate_framing: 'triage then normal repair',
    });
    expect(noDeadline.success).toBe(false);
  });
});
