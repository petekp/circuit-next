---
contract: run
status: ratified-v0.1
version: 0.1
schema_source: src/schemas/run.ts
last_updated: 2026-04-19
depends_on: [event, snapshot, ids, lane, rigor, workflow]
closes: []
codex_adversarial_review: specs/reviews/run-md-v0.1-codex.md
artifact_ids:
  - run.log
  - run.projection
---

# Run Contract

A **Run** is an instance of a **Workflow** executing. A Run is not a single
type in the schema; it is the aggregate of three projections:

1. The **Workflow manifest** snapshot taken at bootstrap (identified by
   `manifest_hash`).
2. The **event log** — an append-only sequence of `Event`s beginning with
   exactly one `run.bootstrapped` event, optionally ending with one
   `run.closed` event.
3. The derived **Snapshot** — a pure function of the event log plus the
   manifest.

The contract answers: what must be true of the log and snapshot for the Run
to be well-formed? Individual `Event` variants already validate themselves
(each is `.strict()` with kind-specific required fields; see
`src/schemas/event.ts`). This contract governs the *log-level* and
*projection-level* invariants that no single event can assert alone.

## Ubiquitous language

See `specs/domain.md#core-types` for canonical definitions of **Run**,
**Event**, **Snapshot**, **Workflow**, and **Session**. Note the explicit
Run vs Session distinction: a Session is the human-facing shell; a Run is
the machine-facing execution.

## Invariants

The runtime MUST reject any `RunLog` or `RunProjection` that violates these.
All invariants are enforced via `src/schemas/run.ts` (`RunLog.superRefine`
and `RunProjection.superRefine`) and tested in
`tests/contracts/schema-parity.test.ts`.

- **RUN-I1 — First event is `run.bootstrapped`.** A `RunLog` is a non-empty
  array of events whose index-0 event has `kind: 'run.bootstrapped'`. The
  bootstrap event carries `workflow_id`, `invocation_id`, `rigor`, `lane`,
  and `manifest_hash` — fields that cannot be inferred from any later event
  — so a log that begins with anything else has structurally-undefined
  framing. Enforced at `src/schemas/run.ts` `RunLog.superRefine`.

- **RUN-I2 — Sequence is 0-based, contiguous, monotonic.** For every event
  at index `i`, `event.sequence === i`. Gaps, repeats, and out-of-order
  entries are rejected at parse time. This is the structural guarantee that
  makes `RunLog` a faithful projection of `events.ndjson`: an ingestion bug
  or concurrent-writer race that would produce a non-contiguous sequence
  fails before it can corrupt a Snapshot. **Scope caveat.** `sequence` is
  the *authoritative* ordering key. `recorded_at` is diagnostic metadata
  and may legitimately non-monotone under clock adjustments (NTP step, DST
  transitions, or machine clock skew in distributed dispatch). This
  invariant does NOT check that `recorded_at` is monotonically
  nondecreasing; a log with forward-jumping `sequence` and backward-
  jumping `recorded_at` is accepted. Timestamp-sanity is tracked as Phase
  2 property `run.prop.recorded_at_sanity` (see below) — closes Codex MED
  #4 (scope admission, not enforcement). Enforced at `src/schemas/run.ts`.

- **RUN-I3 — `run_id` is consistent across the log.** Every event in a
  `RunLog` shares the `run_id` of the bootstrap event. Cross-run event
  smuggling is the single most dangerous corruption mode for event-sourced
  state (it silently merges two runs' histories), so the `RunLog` aggregate
  enforces it even though no individual event can. **Defense-in-depth
  (closes Codex MED #3 at the identity-field layer).** Zod normally reads
  inherited properties during parse, which lets `Object.create({run_id:
  phantom})` smuggle a phantom `run_id` past the discriminated union. A
  `z.custom` own-property guard on the RunLog pipe rejects any event whose
  `run_id`, `kind`, or `sequence` is inherited rather than own. Full
  recursive own-property defense for every required field on every event
  (nested objects, transitively) is a Phase 2 property
  (`run.prop.boundary_own_property_defense`); the three fields guarded
  here are the identity fields whose spoofing is load-bearing for the
  log-level invariants RUN-I1, RUN-I3, and RUN-I4. Enforced at
  `src/schemas/run.ts`.

- **RUN-I4 — Bootstrap singleton.** Exactly one `run.bootstrapped` event per
  `RunLog`. A second bootstrap would make `lane`, `rigor`, `manifest_hash`,
  and `workflow_id` ambiguous at replay time; circuit-next rejects the
  ambiguity at parse time rather than pick a silent convention (earliest-
  wins, latest-wins, last-bootstrap-for-each-field, etc.). Enforced at
  `src/schemas/run.ts`.

- **RUN-I5 — Closure singleton; no events after close.** At most one
  `run.closed` event per `RunLog`, and if present it MUST be the final
  event. A closed run whose log grows again has silently re-opened — a
  transition that is never legal, because "closed" is the terminal state.
  The log must explicitly record closure; anything appended afterward is
  rejected. Enforced at `src/schemas/run.ts`.

- **RUN-I6 — Projection binding: bootstrap-frozen fields survive into the
  Snapshot unchanged.** A `RunProjection` pairs a `RunLog` with a
  `Snapshot`. The Snapshot's `run_id`, `workflow_id`, `manifest_hash`,
  `rigor`, `lane`, and `invocation_id` MUST match the bootstrap event's.
  These are the *frozen* fields — set once at bootstrap and never overwritten
  by any later event. A Snapshot that disagrees with the bootstrap event on
  any of them is derived from a different Run or has been corrupted; the
  projection is rejected either way. Enforced at
  `src/schemas/run.ts` `RunProjection.superRefine`. Note: this establishes
  projection consistency, not reducer correctness; the reducer's total
  correctness is a Phase 2 property test (see `run.prop.deterministic_replay`
  below).

- **RUN-I7 — Projection binding: `events_consumed` equals `log.length`;
  `status` reflects closure.** `Snapshot.events_consumed === log.length`.
  A snapshot claiming fewer consumed events than the log contains is a
  **stale prefix cache**, not *the* current projection of this log; the
  contract rejects prefix-bound projections at parse time rather than
  accepting them with ambiguity. Prefix-snapshot semantics are Phase 2
  scope (see `run.prop.projection_is_a_function` below). Closes Codex
  HIGH #2.

  `Snapshot.status` reflects the log's closure state: if no `run.closed`
  event is present, `status === 'in_progress'`; if a `run.closed` event
  with `outcome: X` is present, `status === X` under the fixed mapping
  (complete→complete, aborted→aborted, handoff→handoff, stopped→stopped,
  escalated→escalated). **Total by construction (compile-time).** The
  mapping `SNAPSHOT_STATUS_FOR_OUTCOME` is typed as `Record<RunClosedOutcome,
  Exclude<SnapshotStatus, 'in_progress'>>`, and a bidirectional
  compile-time equality guard `OutcomeStatusEquality` rejects any future
  drift between the two enum sets at `tsc --strict` time (not test time).
  Closes Codex MED #6. **Semantic-adequacy caveat.** This invariant binds
  *labels*, not *semantics*: a log `[run.bootstrapped, run.closed(complete)]`
  with zero completed steps is accepted here, because assessing whether
  "complete" semantically requires any particular step-completion pattern
  is a Phase 2 property (`run.prop.close_outcome_semantic_adequacy`, see
  below). Closes Codex MED #5 (scope admission, not enforcement).
  Enforced at `src/schemas/run.ts`.

- **RUN-I8 — Strict surplus-key rejection, transitively, across every
  schema that crosses the Event/Snapshot boundary.** Every event variant
  in `src/schemas/event.ts` is `.strict()`; `src/schemas/snapshot.ts`
  declares `Snapshot` and `StepState` with `.strict()`. Surplus keys
  (typos, smuggled fields, injected tracing, etc.) fail parse rather than
  silently carrying through to a consumer. **Transitive closure (closes
  Codex HIGH #1 + LOW #9).** The `.strict()` discipline is applied
  transitively to every nested schema that can appear in an event or
  snapshot payload: `LaneDeclaration` (all 6 variants), `AdapterRef` (all
  3 variants), `CustomAdapterDescriptor`, `ProviderScopedModel`,
  `SkillOverride` (all 4 variants), `SelectionOverride`, `ResolvedSelection`,
  `SelectionResolution.applied[]` entries. A surplus key anywhere in the
  tree is rejected, not stripped. This extends `PHASE-I2`/`PHASE-I6`
  discipline from workflow+phase to the event log and its derived
  snapshot. Enforced at `src/schemas/event.ts`, `src/schemas/snapshot.ts`,
  `src/schemas/lane.ts`, `src/schemas/adapter.ts`,
  `src/schemas/selection-policy.ts`.

## Pre-conditions

- A `RunLog` is produced by parsing `events.ndjson` into an ordered array
  and passing the array to `RunLog.safeParse`.
- A `RunProjection` is produced by pairing a parsed `RunLog` with a parsed
  `Snapshot` and passing the pair to `RunProjection.safeParse`.
- Individual `Event` variants must already parse under
  `Event.safeParse` before being assembled into a `RunLog`; the log-level
  parse assumes per-event validity.
- The referenced `WorkflowId` must exist in the workflow catalog at the
  manifest_hash named by the bootstrap event (validated by the runtime, not
  the Zod schema).

## Post-conditions

After a `RunLog` is accepted:

- `log[0].kind === 'run.bootstrapped'` (RUN-I1).
- For every `i`, `log[i].sequence === i` (RUN-I2).
- For every `i`, `log[i].run_id === log[0].run_id` (RUN-I3).
- Exactly one bootstrap event (RUN-I4); at most one close event, and if
  present at the tail (RUN-I5).

After a `RunProjection` is accepted:

- The Snapshot's bootstrap-frozen fields agree with the log's bootstrap
  event (RUN-I6).
- `Snapshot.events_consumed ≤ log.length` (RUN-I7).
- `Snapshot.status` is consistent with the log's closure state under the
  fixed outcome-to-status mapping (RUN-I7).

## Property ids (reserved for Phase 2 testing)

These are the invariants that govern `Event` *sequences* within a log —
things `RunLog` cannot enforce with a single-pass `superRefine` without
introducing full reducer semantics into the schema layer. They land when the
property-test harness + reducer exist in Phase 2.

### Sequencing and semantics (deferred from RUN-I2/I7 scope caveats)

- `run.prop.recorded_at_sanity` — For any valid `RunLog`, `recorded_at`
  is weakly monotonic across `sequence` under a defined clock-skew
  tolerance (e.g., ≤ 5 minutes). This is diagnostic, not authoritative
  (see RUN-I2 scope caveat); the property detects ingestion bugs that
  `sequence` alone cannot catch (e.g., a writer with a wall-clock
  discontinuity). Closes Codex MED #4.

- `run.prop.close_outcome_semantic_adequacy` — For any valid `RunLog`
  with a terminal `run.closed` event, the outcome is semantically
  consistent with the step-completion pattern in the log: `outcome:
  'complete'` requires at least one `step.completed` on a step routed to
  `@complete`; `outcome: 'aborted'` requires at least one `step.aborted`
  or a `run.bootstrapped`-followed-immediately-by-`run.closed` with an
  explicit early-abort rationale. Closes Codex MED #5. RUN-I7's
  semantic-adequacy caveat scopes this out of v0.1 because the log-wide
  reachability check belongs with the reducer, not the schema.

- `run.prop.boundary_own_property_defense` — For every event in a
  `RunLog`, every required field (not just `run_id`, `kind`, `sequence`)
  is an *own* property, transitively through nested objects. RUN-I3
  guards only the three identity fields (as defense-in-depth against
  inherited-key cross-run smuggle); the full transitive defense belongs
  at the Phase 2 property harness because the recursion needed to check
  every nested object's own-property set is reducer-adjacent, not
  schema-level. Closes Codex MED #3 (full scope; the schema-level
  defense-in-depth in RUN-I3 addresses the load-bearing identity subset).

### Reducer-level (Phase 2 scope)

- `run.prop.deterministic_replay` — For any valid `RunLog` plus its
  corresponding `Workflow` manifest, two independent reducer runs produce
  bit-identical `Snapshot`s. This is the load-bearing property of the
  event-sourced architecture (`specs/evidence.md` hard invariant 1).

- `run.prop.attempt_monotonicity_per_step` — For every step_id that appears
  in the log, the sequence of `attempt` values observed on that step_id's
  events is weakly monotonic (each attempt value is ≥ the previous, strictly
  greater when a retry is observed, never decreasing).

- `run.prop.step_event_causal_ordering` — For every `(step_id, attempt)`
  pair in the log, the event kinds on that pair follow a legal protocol:
  `step.entered` precedes any sub-event on that pair, which precedes exactly
  one of `step.completed` or `step.aborted`. No sub-event may appear without
  a matching `step.entered`; no second terminal event may appear on the
  same pair.

- `run.prop.checkpoint_event_pairing` — For every `checkpoint.requested`
  event on a `(step_id, attempt)` pair, there is exactly one subsequent
  `checkpoint.resolved` event on the same pair before any terminal step
  event. Unresolved checkpoints are a runtime stall, not a log invariant,
  but a log that contains an unresolved `checkpoint.requested` followed by
  a `step.completed` represents an impossible state.

- `run.prop.dispatch_event_pairing` — For every `dispatch.started` event on
  a `(step_id, attempt)` pair, there is exactly one subsequent
  `dispatch.completed` event on the same pair before any terminal step
  event. A `dispatch.started` with no matching `dispatch.completed` is
  a reducer inconsistency.

- `run.prop.artifact_written_before_gate` — For any synthesis step, every
  `gate.evaluated` event with `outcome: 'pass'` on that step is preceded by
  at least one `step.artifact_written` event on the same `(step_id,
  attempt)` pair. (Failing gates can precede any write.)

- `run.prop.projection_is_a_function` — For any valid `RunLog`, `reducer(log,
  manifest)` is a total function: it produces exactly one `Snapshot`, and
  that Snapshot satisfies the `RunProjection` binding. Combined with
  `deterministic_replay`, this is the full event-sourcing contract.

## Cross-contract dependencies

- **event** (`src/schemas/event.ts`) — `RunLog` embeds `Event[]`. Every
  event variant is already `.strict()` (RUN-I8) and declares its own
  per-kind required fields; `RunLog` adds log-level structural invariants
  on top.
- **snapshot** (`src/schemas/snapshot.ts`) — `RunProjection` pairs
  `RunLog` with `Snapshot`. `Snapshot` and `StepState` are both `.strict()`
  (RUN-I8). The `SnapshotStatus` enum is intentionally a superset of
  `RunClosedOutcome` by exactly one value (`'in_progress'`), which is how
  RUN-I7's mapping from log-closure to snapshot-status is total without
  information loss.
- **workflow** (`src/schemas/workflow.ts`) — `RunBootstrappedEvent.workflow_id`
  must refer to a known `Workflow.id` at the given `manifest_hash`. Not
  enforced at the schema layer; enforced at runtime by the workflow
  catalog.
- **lane** (`src/schemas/lane.ts`) — `RunBootstrappedEvent.lane` is a
  required `LaneDeclaration`. RUN-I6 binds it into the Snapshot; evidence
  invariant 3 (every Run carries lane) is load-bearing.
- **rigor** (`src/schemas/rigor.ts`) — frozen at bootstrap (RUN-I6).
- **ids** (`src/schemas/ids.ts`) — `RunId`, `WorkflowId`, `InvocationId`,
  `StepId` branded slugs.

## Failure modes (carried from evidence)

- `carry-forward:event-log-insufficient-to-replay` — Existing Circuit's
  `RunBootstrappedEvent` was missing lane; `Snapshot` did not carry
  `manifest_hash`; richer `step.completed`/`step.aborted` events were
  missing (adversarial-review HIGH #3 — `specs/evidence.md` §Adversarial).
  **Closed in Tier 0 skeleton** (`lane` + `manifest_hash` on both;
  `step.*_completed`/`step.aborted` added). Re-ratified here: `RunLog`
  enforces the log-level invariants those changes were meant to support.

- `carry-forward:snapshot-divergence` — A reducer bug that produces a
  Snapshot inconsistent with its source log was historically silent; the
  Snapshot would simply disagree and nobody would notice until a downstream
  consumer saw wrong data. Closed by RUN-I6/I7: any projection that
  disagrees on bootstrap-frozen fields or closure state is rejected at
  `RunProjection.safeParse`. This is a *consistency* check, not a reducer-
  correctness proof (see `run.prop.deterministic_replay`).

- `carry-forward:surplus-key-silent-strip` — Prior to this contract,
  `Event` variants and `Snapshot` were not `.strict()`, so a typo in an
  event writer (`artifact_pahh` instead of `artifact_path`) parsed as a
  legal event with the misspelled key silently stripped. Closed by RUN-I8.

- `carry-forward:cross-run-smuggle` — A log produced by concatenating two
  runs' events would parse under the flat `Event` schema — individual
  events are valid; only the `run_id` inconsistency reveals the error.
  Closed by RUN-I3, with defense-in-depth via the identity-field own-
  property guard (prototype-chain attack class).

- `carry-forward:nested-surplus-key-silent-strip` — Prior to this slice,
  `.strict()` was applied only at the top level of `Event`/`Snapshot`.
  Surplus keys inside `lane`, `adapter`, `resolved_selection`, or
  `resolved_selection.model` were silently stripped, which meant a
  snapshot-vs-bootstrap lane comparison could wrongly accept a polluted
  payload. Closed by RUN-I8's transitive-strict discipline across
  `LaneDeclaration`, `AdapterRef`, `ProviderScopedModel`, `SkillOverride`,
  `SelectionOverride`, `ResolvedSelection`, `SelectionResolution.applied[]`.

## Evolution

- **v0.1 (this draft)** — RUN-I1..I8 enforced at the schema layer:
  `RunLog` aggregate with bootstrap/first-event, sequence monotonicity,
  run_id consistency, bootstrap singleton, closure singleton with
  no-post-closure-events. `RunProjection` aggregate binding log and
  snapshot with bootstrap-frozen field parity, exact `events_consumed`
  equality (no stale prefix), and closure-to-status mapping as a
  compile-time total function (`OutcomeStatusEquality`). `.strict()`
  extended transitively from every event variant + `Snapshot`/`StepState`
  through `LaneDeclaration`, `AdapterRef`, `ProviderScopedModel`,
  `SkillOverride`, `SelectionOverride`, `ResolvedSelection`, and
  `SelectionResolution.applied[]` entries. Identity-field own-property
  guard (`run_id`/`kind`/`sequence`) rejects prototype-chain smuggle at
  the RunLog pipe boundary. Lane equality uses a structural field-by-
  field comparator rather than `JSON.stringify` to stay robust under
  future key-order changes.

  Codex adversarial property-auditor pass completed (2026-04-18); full
  record at `specs/reviews/run-md-v0.1-codex.md`. Verdict chain:
  `NEEDS ADJUSTMENT → incorporated → ACCEPT (after fold-in)`. 2 HIGH
  (#1 nested surplus, #2 prefix-snapshot) incorporated; 5 MED (#3
  prototype identity, #4 timestamp scope, #5 close semantic, #6
  compile-time mapping, #7 test breadth) incorporated or honestly scoped
  to Phase 2 property ids; 3 LOW (#8 invocation_id asymmetry, #9 lane
  comparison, #10 ratchet-vs-discipline) incorporated. The HIGH
  adversarial claims are closed at the schema layer; the deferred
  semantic/reachability/timestamp claims are tracked as
  `run.prop.close_outcome_semantic_adequacy`,
  `run.prop.boundary_own_property_defense`, and
  `run.prop.recorded_at_sanity` — NOT claimed closed by this draft.

- **v0.2 (Phase 1)** — Absorb Codex adversarial property-auditor pass
  findings. Ratify `property_ids` above by landing the corresponding
  property-test harness. Consider whether a typed `ReducerOutput` (log,
  snapshot, derived diagnostics) adds enough value over `RunProjection` to
  justify the cost. If evidence shows a class of `SnapshotStatus` drift
  that RUN-I7 doesn't catch, upgrade the mapping from an enum-valued
  record to a typed discriminated union.

- **v1.0 (Phase 2)** — Ratified invariants + property tests + mutation-
  score floor contribution + operator-facing error-message catalog. The
  six `run.prop.*` properties above become the acceptance gate for any
  reducer implementation.
