import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Slice 46b (P2.7b) — continuity-lifecycle integration test. Closes the
// second half of ADR-0007 §Decision.1 CC#P2-4 (the first half — the
// `.claude/hooks/SessionStart.sh` + `.claude/hooks/SessionEnd.sh` +
// `scripts/audit.mjs` Check 33 `checkSessionHooksPresent` triple — landed
// at Slice 46). With this test green, ADR-0007 CC#P2-4 (session hooks +
// continuity lifecycle) advances to active — satisfied per the
// per-criterion ledger convention.
// (Slice 47d Claude HIGH 1 fold-in: prior comment used a scalar close-
// count phrasing that ADR-0007 §3 forbids; replaced with per-criterion
// wording.)
//
// Failure mode addressed: the continuity engine has unit-level coverage
// for the index reader and the record writer, but no integration proof
// that the public CLI surface (`save` / `status` / `resume` / `clear`)
// composes correctly across a real lifecycle. A regression that broke
// the index-record round-trip — e.g. `save` writing a record to disk
// without updating `pending_record`, or `clear` clearing the index
// entry without deleting the underlying record file, or `resume`
// silently consuming the record instead of leaving it pending — would
// land green on the unit suite. Subprocess-driven lifecycle assertions
// over ephemeral project roots are the only way to catch these.
//
// Test surface: spawn `.circuit/bin/circuit-engine continuity {save,
// status,resume,clear}` as real subprocesses, each scoped to a fresh
// `mkdtempSync` project root via `--project-root <tmpdir>`. The engine
// honors `--project-root` as the resolution authority for both the
// index path (`.circuit/control-plane/continuity-index.json`) and the
// records dir (`.circuit/control-plane/continuity-records/`), so the
// live repo's continuity record is untouched by these tests.
//
// Notes on what these tests do NOT bind:
//   - `current_run` selection priority is asserted only at the
//     `selection`/`source`-field level. Setting up an attached
//     `current_run` requires a full run bootstrap; that path is
//     covered by `tests/runner/dogfood-smoke.test.ts` and the
//     `current_run` > `none` priority is wired into the engine's
//     resolver, not the CLI surface this test exercises. The
//     priority-ordering claim landed in this slice's narrative is
//     supported here by binding the `pending_record` > `none` half
//     of the priority and asserting that `selection` and `source`
//     are the discriminant fields the CLI reports.
//   - Save-replaces-prior semantics: `save` updates the index
//     `pending_record` pointer but does NOT delete the prior record
//     file from disk. This is by-design (record files are
//     append-only by id; the index is the consultable authority).
//     The "twice-save" test below pins this behavior so a later
//     refactor that flips to delete-on-save would surface.

const ENGINE_BIN = resolve('.circuit/bin/circuit-engine');
const INDEX_REL = '.circuit/control-plane/continuity-index.json';
const RECORDS_DIR_REL = '.circuit/control-plane/continuity-records';

interface EngineJsonOutput {
  readonly selection?: string;
  readonly source?: string;
  readonly current_run: unknown;
  readonly pending_record: PendingRecordEntry | null;
  readonly record: ContinuityRecord | null;
  readonly project_root: string;
  readonly warnings?: readonly string[];
  readonly message?: string;
  readonly cleared_pending_record?: boolean;
  readonly cleared_current_run?: boolean;
  readonly deleted_record_id?: string | null;
  readonly deleted_record_path?: string | null;
  readonly record_path?: string;
}

interface PendingRecordEntry {
  readonly continuity_kind: string;
  readonly created_at: string;
  readonly payload_rel: string;
  readonly record_id: string;
  readonly run_slug: string | null;
}

interface ContinuityRecord {
  readonly created_at: string;
  readonly narrative: {
    readonly debt_markdown: string;
    readonly goal: string;
    readonly next: string;
    readonly state_markdown: string;
  };
  readonly project_root: string;
  readonly record_id: string;
  readonly resume_contract: {
    readonly auto_resume: boolean;
    readonly mode: string;
    readonly requires_explicit_resume: boolean;
  };
  readonly schema_version: string;
}

function engine(projectRoot: string, args: readonly string[]): EngineJsonOutput {
  // The `.circuit/bin/circuit-engine` shim resolves the engine via the
  // local `.circuit/plugin-root` file (populated by any `/circuit:*`
  // session-start in this checkout). Passing `--project-root <tmpdir>`
  // overrides where the engine reads/writes continuity state without
  // requiring a parallel shim or plugin-root file in the temp dir.
  const stdout = execFileSync(
    ENGINE_BIN,
    ['continuity', ...args, '--project-root', projectRoot, '--json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return JSON.parse(stdout) as EngineJsonOutput;
}

function save(
  projectRoot: string,
  fields: { goal: string; next: string; state: string; debt: string },
): EngineJsonOutput {
  return engine(projectRoot, [
    'save',
    '--goal',
    fields.goal,
    '--next',
    fields.next,
    '--state-markdown',
    fields.state,
    '--debt-markdown',
    fields.debt,
  ]);
}

describe('Slice 46b — continuity lifecycle (CC#P2-4 second-half binding)', () => {
  let projectRoot: string;

  beforeEach(() => {
    // realpath collapses macOS's `/var/folders/...` vs `/private/var/folders/...`
    // alias so absolute-path assertions against engine output match — the
    // engine resolves the symlink before reporting `deleted_record_path`.
    projectRoot = realpathSync(mkdtempSync(join(tmpdir(), 'circuit-next-46b-')));
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('status on a fresh empty project root reports selection=none with no record and no index file', () => {
    const result = engine(projectRoot, ['status']);
    expect(result.selection).toBe('none');
    expect(result.record).toBe(null);
    expect(result.pending_record).toBe(null);
    expect(result.current_run).toBe(null);
    expect(result.warnings).toEqual([]);
    expect(existsSync(join(projectRoot, INDEX_REL))).toBe(false);
  });

  it('save writes the index file with a populated pending_record entry', () => {
    const result = save(projectRoot, {
      goal: 'g',
      next: 'n',
      state: '- DONE: x',
      debt: 'none',
    });
    expect(result.pending_record).not.toBe(null);
    expect(result.pending_record?.continuity_kind).toBe('standalone');
    expect(result.pending_record?.record_id).toMatch(/^continuity-[0-9a-f-]{36}$/);
    expect(result.pending_record?.payload_rel.startsWith(RECORDS_DIR_REL)).toBe(true);
    expect(existsSync(join(projectRoot, INDEX_REL))).toBe(true);
    const indexRaw = readFileSync(join(projectRoot, INDEX_REL), 'utf8');
    const index = JSON.parse(indexRaw) as {
      pending_record: PendingRecordEntry | null;
      current_run: unknown;
    };
    expect(index.pending_record?.record_id).toBe(result.pending_record?.record_id);
    expect(index.current_run).toBe(null);
  });

  it('save writes the record file at the payload_rel path with the round-tripped narrative', () => {
    const result = save(projectRoot, {
      goal: 'integration-goal',
      next: 'integration-next',
      state: '- DONE: integration-state',
      debt: 'none',
    });
    const recordRel = result.pending_record?.payload_rel;
    expect(recordRel).toBeDefined();
    if (!recordRel) throw new Error('payload_rel missing');
    const recordAbs = join(projectRoot, recordRel);
    expect(existsSync(recordAbs)).toBe(true);
    const recordRaw = readFileSync(recordAbs, 'utf8');
    const record = JSON.parse(recordRaw) as ContinuityRecord;
    expect(record.narrative.goal).toBe('integration-goal');
    expect(record.narrative.next).toBe('integration-next');
    expect(record.narrative.state_markdown).toBe('- DONE: integration-state');
    expect(record.record_id).toBe(result.pending_record?.record_id);
    expect(record.resume_contract.requires_explicit_resume).toBe(true);
    expect(record.resume_contract.mode).toBe('resume_standalone');
  });

  it('status after save reports selection=pending_record and surfaces the saved narrative', () => {
    const saveResult = save(projectRoot, {
      goal: 'status-goal',
      next: 'status-next',
      state: 'status-state',
      debt: 'none',
    });
    const statusResult = engine(projectRoot, ['status']);
    expect(statusResult.selection).toBe('pending_record');
    expect(statusResult.record?.record_id).toBe(saveResult.pending_record?.record_id);
    expect(statusResult.record?.narrative.goal).toBe('status-goal');
    expect(statusResult.record?.narrative.next).toBe('status-next');
    expect(statusResult.pending_record?.record_id).toBe(saveResult.pending_record?.record_id);
  });

  it('resume after save returns source=pending_record with the same record id', () => {
    const saveResult = save(projectRoot, {
      goal: 'resume-goal',
      next: 'resume-next',
      state: 'resume-state',
      debt: 'none',
    });
    const resumeResult = engine(projectRoot, ['resume']);
    expect(resumeResult.source).toBe('pending_record');
    expect(resumeResult.record?.record_id).toBe(saveResult.pending_record?.record_id);
    expect(resumeResult.record?.narrative.goal).toBe('resume-goal');
  });

  it('resume is non-destructive — status after resume still reports the pending record', () => {
    save(projectRoot, { goal: 'g', next: 'n', state: 's', debt: 'none' });
    engine(projectRoot, ['resume']);
    const statusAfterResume = engine(projectRoot, ['status']);
    expect(statusAfterResume.selection).toBe('pending_record');
    expect(statusAfterResume.record).not.toBe(null);
  });

  it('resume on an empty project root returns source=none with a "nothing to resume" message', () => {
    const result = engine(projectRoot, ['resume']);
    expect(result.source).toBe('none');
    expect(result.record).toBe(null);
    expect(result.pending_record).toBe(null);
    expect(result.message ?? '').toMatch(/nothing to resume/i);
  });

  it('clear after save deletes the record file from disk and clears the index pending_record', () => {
    const saveResult = save(projectRoot, {
      goal: 'g',
      next: 'n',
      state: 's',
      debt: 'none',
    });
    const recordRel = saveResult.pending_record?.payload_rel;
    if (!recordRel) throw new Error('payload_rel missing');
    const recordAbs = join(projectRoot, recordRel);
    expect(existsSync(recordAbs)).toBe(true);

    const clearResult = engine(projectRoot, ['clear']);
    expect(clearResult.cleared_pending_record).toBe(true);
    expect(clearResult.cleared_current_run).toBe(true);
    expect(clearResult.deleted_record_id).toBe(saveResult.pending_record?.record_id);
    expect(clearResult.deleted_record_path).toBe(recordAbs);

    expect(existsSync(recordAbs)).toBe(false);
    const indexRaw = readFileSync(join(projectRoot, INDEX_REL), 'utf8');
    const index = JSON.parse(indexRaw) as {
      pending_record: unknown;
      current_run: unknown;
    };
    expect(index.pending_record).toBe(null);
    expect(index.current_run).toBe(null);
  });

  it('status after clear reports selection=none and an empty record', () => {
    save(projectRoot, { goal: 'g', next: 'n', state: 's', debt: 'none' });
    engine(projectRoot, ['clear']);
    const statusResult = engine(projectRoot, ['status']);
    expect(statusResult.selection).toBe('none');
    expect(statusResult.record).toBe(null);
    expect(statusResult.pending_record).toBe(null);
  });

  it('clear is idempotent — running clear on a project with no record reports cleared=true with deleted_record_id=null', () => {
    const result = engine(projectRoot, ['clear']);
    expect(result.cleared_pending_record).toBe(true);
    expect(result.cleared_current_run).toBe(true);
    expect(result.deleted_record_id).toBe(null);
    expect(result.deleted_record_path).toBe(null);
  });

  it('save twice replaces the pending_record pointer in the index without deleting the prior record file', () => {
    // Save-replace semantics: the engine updates the index `pending_record`
    // pointer to the new record_id, but the prior record file remains on
    // disk. Pinning this behavior so a refactor that flips to
    // delete-on-save (or one that fails to update the index pointer) is
    // caught immediately. The records dir grows monotonically across
    // saves; clear is the only command that reaps record files.
    const first = save(projectRoot, { goal: 'g1', next: 'n1', state: 's1', debt: 'none' });
    const second = save(projectRoot, { goal: 'g2', next: 'n2', state: 's2', debt: 'none' });
    expect(first.pending_record?.record_id).not.toBe(second.pending_record?.record_id);

    const firstAbs = join(projectRoot, first.pending_record?.payload_rel ?? '');
    const secondAbs = join(projectRoot, second.pending_record?.payload_rel ?? '');
    expect(existsSync(firstAbs)).toBe(true);
    expect(existsSync(secondAbs)).toBe(true);

    const indexRaw = readFileSync(join(projectRoot, INDEX_REL), 'utf8');
    const index = JSON.parse(indexRaw) as { pending_record: PendingRecordEntry | null };
    expect(index.pending_record?.record_id).toBe(second.pending_record?.record_id);

    const statusResult = engine(projectRoot, ['status']);
    expect(statusResult.selection).toBe('pending_record');
    expect(statusResult.record?.narrative.goal).toBe('g2');
  });

  it('the engine reports the selection / source discriminant fields the SessionStart and SessionEnd hooks read', () => {
    // Slice 46's hook scripts (`.claude/hooks/SessionStart.sh` and
    // `.claude/hooks/SessionEnd.sh`) read `.selection` from the
    // `continuity status --json` output to choose between the
    // pending-record / current-run-attached / nothing branches. This
    // test pins the discriminant-field name surface so a hidden rename
    // (selection → state, source → kind, etc.) breaks here loud and
    // visible instead of silently downgrading the SessionStart banner
    // to the no-record branch.
    save(projectRoot, { goal: 'g', next: 'n', state: 's', debt: 'none' });
    const statusResult = engine(projectRoot, ['status']);
    expect(Object.keys(statusResult)).toContain('selection');
    expect(statusResult.selection).toBe('pending_record');

    const resumeResult = engine(projectRoot, ['resume']);
    expect(Object.keys(resumeResult)).toContain('source');
    expect(resumeResult.source).toBe('pending_record');
  });
});
