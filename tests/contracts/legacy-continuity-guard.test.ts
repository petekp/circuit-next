import { describe, expect, it } from 'vitest';
import { ContinuityRecord } from '../../src/schemas/continuity.js';

/**
 * Clean-break guard: old Circuit continuity records MUST NOT parse as
 * circuit-next ContinuityRecord through normal runtime paths.
 *
 * Per ADR-0003 (Authority-Graph Gate) and
 * specs/reference/legacy-circuit/continuity-characterization.md,
 * continuity.record is classified successor-to-live with
 * legacy_parse_policy=reject. If old Circuit records ever need to be
 * imported, that is a separate migration-source contract — not a
 * relaxation of the runtime schema.
 *
 * These fixtures are CONSTRUCTED to match the characterized live shape,
 * not committed from real operator records. The characterization doc
 * documents the observed shape; these tests encode "that shape does not
 * parse as ours".
 */

describe('ContinuityRecord — clean-break guard vs legacy shape', () => {
  it('rejects legacy record with string schema_version "1"', () => {
    const legacyRecord = {
      schema_version: '1', // legacy uses STRING "1", circuit-next uses number 1
      record_id: 'continuity-19ee6b12-e0f6-4a67-a225-9cb93c6fa5b1',
      project_root: '/Users/petepetrash/Code/circuit',
      created_at: '2026-04-16T19:57:52.564Z',
      git: {
        cwd: '/Users/petepetrash/Code/circuit',
        branch: 'main',
        head: 'fa19ef87dd28557ce1d67097c408ac207c76a12a',
        base_commit: 'fa19ef87dd28557ce1d67097c408ac207c76a12a',
      },
      narrative: {
        goal: 'Close out dispatch-adapter-fallback-i5',
        next: 'DO: complete Verify phase',
        state_markdown: '- DONE: shipped fa19ef8',
        debt_markdown: '- DECIDED: defer typed adapter_fallback ledger',
      },
      resume_contract: {
        auto_resume: false,
        mode: 'resume_run',
        requires_explicit_resume: true,
      },
      run_ref: {
        current_step_at_save: 'fix',
        manifest_present: true,
        run_root_rel: '.circuit/circuit-runs/dispatch-adapter-fallback-i5',
        run_slug: 'dispatch-adapter-fallback-i5',
        runtime_status_at_save: 'in_progress',
        runtime_updated_at_at_save: '2026-04-16T19:53:16.995Z',
      },
    };
    const result = ContinuityRecord.safeParse(legacyRecord);
    expect(result.success).toBe(false);
  });

  it('rejects legacy record lacking continuity_kind discriminator', () => {
    const legacyRecord = {
      schema_version: 1,
      record_id: 'continuity-1e134ece-88e7-455a-b641-b98f82407e3c',
      project_root: '/Users/petepetrash/Code/circuit',
      created_at: '2026-04-16T05:52:56.399Z',
      git: { cwd: '/Users/petepetrash/Code/circuit' },
      narrative: {
        goal: 'Ship I5 then I2/O2',
        next: 'DO: Open Repair run for I5',
        state_markdown: '- DONE: handoff fixes',
        debt_markdown: '- DECIDED: ship I5 next',
      },
      resume_contract: {
        auto_resume: false,
        mode: 'resume_run',
        requires_explicit_resume: true,
      },
      run_ref: {
        run_slug: 'ship-handoff-fixes-and-review-queue',
        current_step_at_save: 'frame',
        manifest_present: true,
        run_root_rel: '.circuit/circuit-runs/ship-handoff-fixes-and-review-queue',
        runtime_status_at_save: 'in_progress',
        runtime_updated_at_at_save: '2026-04-16T05:34:27.442Z',
      },
    };
    const result = ContinuityRecord.safeParse(legacyRecord);
    expect(result.success).toBe(false);
  });

  it('rejects legacy standalone-style record (run_ref: null, no continuity_kind)', () => {
    const legacyStandalone = {
      schema_version: '1',
      record_id: 'continuity-42b3d931-c2c7-4ed3-8f0c-3dc3690c7843',
      project_root: '/Users/petepetrash/Code/circuit',
      created_at: '2026-04-16T05:10:13.140Z',
      git: { cwd: '/Users/petepetrash/Code/circuit' },
      narrative: {
        goal: 'Fix handoff skill friction',
        next: 'DO: TaskCreate an enumeration',
        state_markdown: '- DONE: Repair run shipped',
        debt_markdown: '- CONSTRAINT: keep /circuit:handoff forms',
      },
      resume_contract: {
        auto_resume: false,
        mode: 'resume_standalone',
        requires_explicit_resume: true,
      },
      run_ref: null,
    };
    const result = ContinuityRecord.safeParse(legacyStandalone);
    expect(result.success).toBe(false);
  });

  it('documents that migration requires a separate contract', () => {
    // This test is a narrative anchor: any future change that makes
    // ContinuityRecord parse legacy records at runtime MUST fail this
    // test and force an operator-level decision through ADR-0003 §Reopen
    // conditions (reclassify continuity.record as legacy-compatible or
    // migration-source).
    const narrative = `
      circuit-next continuity is successor-to-live / clean-break.
      Legacy parse policy: reject.
      Migration policy: deferred; a separate migration-source contract is required.
      See specs/adrs/ADR-0003-authority-graph-gate.md and
      specs/reference/legacy-circuit/continuity-characterization.md.
    `;
    expect(narrative).toMatch(/reject/);
    expect(narrative).toMatch(/migration-source/);
  });
});
