import { z } from 'zod';
import {
  Event,
  type RunBootstrappedEvent,
  type RunClosedEvent,
  type RunClosedOutcome,
} from './event.js';
import { Snapshot, type SnapshotStatus } from './snapshot.js';

// RUN-I1..I5 live on `RunLog`: a typed projection of `events.ndjson` parsed into
// an ordered array. The individual Event variants are already strict-mode and
// individually validated; this aggregate encodes the log-level invariants that
// no single event can assert on its own.

const RunLogBody = z.array(Event).min(1);

const issueAt = (ctx: z.RefinementCtx, path: (string | number)[], message: string) => {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
};

// Own-property guard for identity fields on raw input. Zod normally reads
// inherited properties during parse, which lets `Object.create({run_id:
// other})` smuggle a phantom run_id past the discriminated union. We run the
// check as a preprocess on the raw array so that the guard sees the original
// objects (with their prototype chains) before Zod copies properties into
// fresh plain objects. Full recursive own-property defense for every required
// field on every event is a Phase 2 property; the guarded fields here are the
// identity fields whose spoofing is load-bearing for RUN-I1/I3.
const GUARDED_OWN_FIELDS = ['run_id', 'kind', 'sequence'] as const;

const ownPropertyGuardedArray = z.custom<unknown[]>((raw) => {
  if (!Array.isArray(raw)) return true;
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') continue;
    for (const field of GUARDED_OWN_FIELDS) {
      if (!Object.hasOwn(entry, field)) return false;
    }
  }
  return true;
}, 'event has inherited (not own) identity field; prototype-chain smuggle rejected');

export const RunLog = ownPropertyGuardedArray.pipe(
  RunLogBody.superRefine((events, ctx) => {
    // RUN-I1 — first event is `run.bootstrapped`. A RunLog with any other
    // leading event is structurally invalid: bootstrap carries lane, rigor,
    // manifest_hash, and workflow_id, none of which can be inferred later.
    const first = events[0];
    if (first === undefined || first.kind !== 'run.bootstrapped') {
      issueAt(
        ctx,
        [0, 'kind'],
        `first event must be 'run.bootstrapped', got '${first?.kind ?? '<empty>'}'`,
      );
    }

    // RUN-I4 — bootstrap singleton. Multiple bootstraps within one log would
    // make lane/rigor/manifest_hash ambiguous at replay time.
    let bootstrapCount = 0;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e?.kind === 'run.bootstrapped') {
        bootstrapCount += 1;
        if (bootstrapCount > 1) {
          issueAt(
            ctx,
            [i, 'kind'],
            `second 'run.bootstrapped' at index ${i}; a RunLog must bootstrap exactly once`,
          );
        }
      }
    }

    // RUN-I2 — sequence is 0-based, contiguous, monotonic. Gaps or repeats
    // indicate an ingestion bug or a concurrent-writer race and make replay
    // non-deterministic. Note: `sequence` is the authoritative ordering key;
    // `recorded_at` is diagnostic metadata and may legitimately non-monotone
    // under clock adjustments. Timestamp-sanity is a Phase 2 property.
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e === undefined) continue;
      if (e.sequence !== i) {
        issueAt(
          ctx,
          [i, 'sequence'],
          `event at index ${i} has sequence=${e.sequence}; expected contiguous 0-based sequence (should be ${i})`,
        );
      }
    }

    // RUN-I3 — run_id consistency. Cross-run event smuggling is the single
    // most dangerous corruption mode for event-sourced state.
    const canonical = first?.run_id;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e === undefined || canonical === undefined) continue;
      if (e.run_id !== canonical) {
        issueAt(
          ctx,
          [i, 'run_id'],
          `event at index ${i} has run_id='${e.run_id as unknown as string}' but RunLog is for run_id='${canonical as unknown as string}'`,
        );
      }
    }

    // RUN-I5 — at-most-one close; no events after close. A closed run whose
    // log grows again silently re-opens it; PHASE-I4-style discipline says the
    // transition must be explicit and is therefore rejected.
    let closedAt = -1;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e?.kind !== 'run.closed') continue;
      if (closedAt >= 0) {
        issueAt(
          ctx,
          [i, 'kind'],
          `second 'run.closed' at index ${i}; a RunLog closes at most once`,
        );
      } else {
        closedAt = i;
      }
    }
    if (closedAt >= 0 && closedAt !== events.length - 1) {
      issueAt(
        ctx,
        [closedAt + 1, 'kind'],
        `events after 'run.closed' at index ${closedAt}; nothing may be appended after closure`,
      );
    }
  }),
);
export type RunLog = z.infer<typeof RunLog>;

// The outcome-to-status mapping is pinned as a compile-time total function.
// By typing the record as `Record<RunClosedOutcome, Exclude<SnapshotStatus,
// 'in_progress'>>`, any future drift between the two enums breaks the
// compile, not just this file's tests. See RUN-I7.
type ClosedSnapshotStatus = Exclude<SnapshotStatus, 'in_progress'>;
const SNAPSHOT_STATUS_FOR_OUTCOME: Record<RunClosedOutcome, ClosedSnapshotStatus> = {
  complete: 'complete',
  aborted: 'aborted',
  handoff: 'handoff',
  stopped: 'stopped',
  escalated: 'escalated',
};

// Compile-time bidirectional guard: `ClosedSnapshotStatus` and `RunClosedOutcome`
// must be the same string-literal set. If one drifts, `OutcomeStatusEquality`
// collapses to `never` and the `_compileTimeOutcomeStatusParity` marker rejects
// the build before the runtime ever sees an unmapped outcome. This is the
// "total by construction" claim in RUN-I7 becoming a compile-time property,
// not a test-time one.
type IsExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type OutcomeStatusEquality = IsExact<ClosedSnapshotStatus, RunClosedOutcome> extends true
  ? true
  : never;
export const _compileTimeOutcomeStatusParity: OutcomeStatusEquality = true;

const RunProjectionBody = z
  .object({
    log: RunLog,
    snapshot: Snapshot,
  })
  .strict();

// RUN-I6..I7 bind the event log and its derived snapshot. `RunProjection` is
// the schema-level statement of "snapshot is a pure function of log": if the
// two disagree on run_id, workflow_id, lane, rigor, manifest_hash, or
// invocation_id, or if `events_consumed` is not equal to `log.length`, or if
// snapshot.status contradicts the log's closure state, the projection is
// rejected. This does not prove the reducer is correct (that's a Phase 2
// property test); it proves that a RunProjection a caller hands us is
// internally consistent.
export const RunProjection = RunProjectionBody.superRefine(({ log, snapshot }, ctx) => {
  // Find the bootstrap event — RUN-I1 guarantees it exists and is at index 0,
  // but we guard anyway so narrowing is explicit.
  const bootstrapEvent = log[0];
  if (bootstrapEvent === undefined || bootstrapEvent.kind !== 'run.bootstrapped') {
    // RunLog parsing will have already complained; bail without duplicating.
    return;
  }
  const bootstrap: RunBootstrappedEvent = bootstrapEvent;

  // RUN-I6 — binding fields that are frozen at bootstrap and must survive
  // into the snapshot unchanged.
  if (snapshot.run_id !== bootstrap.run_id) {
    issueAt(ctx, ['snapshot', 'run_id'], 'snapshot.run_id differs from bootstrap.run_id');
  }
  if (snapshot.workflow_id !== bootstrap.workflow_id) {
    issueAt(
      ctx,
      ['snapshot', 'workflow_id'],
      'snapshot.workflow_id differs from bootstrap.workflow_id',
    );
  }
  if (snapshot.manifest_hash !== bootstrap.manifest_hash) {
    issueAt(
      ctx,
      ['snapshot', 'manifest_hash'],
      'snapshot.manifest_hash differs from bootstrap.manifest_hash; manifest is immutable per run',
    );
  }
  if (snapshot.rigor !== bootstrap.rigor) {
    issueAt(ctx, ['snapshot', 'rigor'], 'snapshot.rigor differs from bootstrap.rigor');
  }
  // Deep-compare lane: LaneDeclaration is `.strict()` in every variant, so
  // surplus keys are already rejected at Event/Snapshot parse time. Remaining
  // work here is structural equality; we compare field-by-field against the
  // union's declared fields to avoid JSON.stringify ordering assumptions.
  if (!laneEquals(snapshot.lane, bootstrap.lane)) {
    issueAt(
      ctx,
      ['snapshot', 'lane'],
      'snapshot.lane differs from bootstrap.lane; lane is frozen at bootstrap',
    );
  }
  // InvocationId: both absent, or both present and equal. The direct `!==`
  // covers both (undefined === undefined is true; string === string is value
  // equality; one-side-undefined is rejected).
  if (snapshot.invocation_id !== bootstrap.invocation_id) {
    issueAt(
      ctx,
      ['snapshot', 'invocation_id'],
      'snapshot.invocation_id differs from bootstrap.invocation_id',
    );
  }

  // RUN-I7 — events_consumed is bound to log length exactly. A snapshot that
  // claims fewer events than exist is a stale prefix cache, not "the" current
  // projection; prefix-snapshot semantics are Phase 2 scope (see
  // `run.prop.projection_is_a_function`). Equality is the stronger bar.
  if (snapshot.events_consumed !== log.length) {
    issueAt(
      ctx,
      ['snapshot', 'events_consumed'],
      `snapshot.events_consumed=${snapshot.events_consumed} must equal log length=${log.length}; prefix snapshots are rejected`,
    );
  }

  const closed = log.find((e): e is RunClosedEvent => e.kind === 'run.closed');
  if (closed === undefined) {
    if (snapshot.status !== 'in_progress') {
      issueAt(
        ctx,
        ['snapshot', 'status'],
        `log has no 'run.closed' event so snapshot.status must be 'in_progress', got '${snapshot.status}'`,
      );
    }
  } else {
    const expected = SNAPSHOT_STATUS_FOR_OUTCOME[closed.outcome];
    if (snapshot.status !== expected) {
      issueAt(
        ctx,
        ['snapshot', 'status'],
        `run.closed.outcome='${closed.outcome}' requires snapshot.status='${expected}', got '${snapshot.status}'`,
      );
    }
  }
});
export type RunProjection = z.infer<typeof RunProjection>;

// Structural lane equality without relying on key-order stability. Every
// LaneDeclaration variant is `.strict()`, so surplus keys cannot smuggle
// through; here we compare the declared fields by value.
function laneEquals(a: RunBootstrappedEvent['lane'], b: RunBootstrappedEvent['lane']): boolean {
  if (a.lane !== b.lane) return false;
  if (a.failure_mode !== b.failure_mode) return false;
  if (a.acceptance_evidence !== b.acceptance_evidence) return false;
  if (a.alternate_framing !== b.alternate_framing) return false;
  if (a.lane === 'migration-escrow' && b.lane === 'migration-escrow') {
    return a.expires_at === b.expires_at && a.restoration_plan === b.restoration_plan;
  }
  if (a.lane === 'break-glass' && b.lane === 'break-glass') {
    return a.post_hoc_adr_deadline_at === b.post_hoc_adr_deadline_at;
  }
  return true;
}
