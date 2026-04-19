---
contract_target: run
contract_version: 0.1
reviewer_model: gpt-5.1 via codex exec
review_kind: adversarial property-auditor
review_date: 2026-04-18
verdict: NEEDS ADJUSTMENT → incorporated → ACCEPT (after fold-in)
authored_by: operator + claude-opus-4-7
---

# run.md v0.1 — Codex Adversarial Property-Auditor Review

This record captures the cross-model challenger pass on
`specs/contracts/run.md` v0.1 + `src/schemas/run.ts` + the strict-mode changes
to `src/schemas/event.ts`, `src/schemas/snapshot.ts`, and the new
`RunLog`/`RunProjection` aggregates. The reviewer's task was an **objection
list**, not approval; incorporation decisions were made by the operator per
the narrow-cross-model-challenger protocol (Knight-Leveson Swiss-cheese, not
independent corroboration).

## Objection list (as returned by Codex)

**1. HIGH — RUN-I8 strict surplus-key rejection is false for nested objects.**
Attack: `Event` variants, `Snapshot`, and `StepState` are `.strict()`, but
nested schemas (`LaneDeclaration`, `AdapterRef`, `CustomAdapterDescriptor`,
`ProviderScopedModel`, `SkillOverride`, `SelectionOverride`, `ResolvedSelection`,
`SelectionResolution.applied[]`) are not. Surplus keys inside those nested
objects pass parse and are silently stripped. That contradicts run.md's
claim that surplus keys fail rather than carrying through to Event/Snapshot
consumers.

**2. HIGH — `RunProjection` accepts stale or partial snapshots while calling
them derived projections.** Attack: RUN-I7 only checks `events_consumed <=
log.length`. A snapshot can claim `events_consumed: 0` while still being
accepted as paired with a two-event log. That is not a projection of the log;
it is at best a stale prefix cache. Undercuts the contract's "derived
Snapshot — a pure function of the event log plus manifest" framing.

**3. MED — Required event fields can be inherited from the prototype chain.**
Attack: Zod reads inherited properties; `Object.create({run_id: phantom})`
satisfies `Event` parsing even though the object has no own `run_id`.
`.strict()` operates on own enumerable keys for *unknown*-key rejection but
does not require *declared* keys to be own. Same family as STEP-I3's
prototype-chain attack, now at the Event boundary.

**4. MED — RUN-I2 sequence monotonicity does not make the log ordered in
audit time.** Attack: `sequence` indices can be contiguous while `recorded_at`
goes backward. The contract uses append-only/event-log language and claims
sequence checks catch ingestion bugs and concurrent-writer races, but a
temporally nonsensical log passes.

**5. MED — Close-only `complete` runs pass despite violating the likely
meaning of `complete`.** Attack: `[run.bootstrapped, run.closed(complete)]`
is accepted. No completed step, no route taken, yet the log closes with
`complete`. The label is satisfied but the semantics are not.

**6. MED — RUN-I7's "total by construction" status mapping is not actually
tied to `SnapshotStatus`.** Attack: `SNAPSHOT_STATUS_FOR_OUTCOME` is typed
with duplicated string literals, not via `Exclude<SnapshotStatus,
'in_progress'>`. If `SnapshotStatus` drifts, the compiler is not the source
of truth; tests happen to catch only some drift.

**7. MED — RUN-I8 test coverage does not match the invariant's breadth.**
Tests cover `run.bootstrapped` and `step.completed` surplus-key rejection,
plus `Snapshot` and `StepState`. They do not cover the other nine event
variants, and they do not cover nested strictness at all.

**8. LOW — `invocation_id` asymmetry is only half-tested.** Tests cover the
"snapshot has, bootstrap lacks" direction. They do not cover "bootstrap has,
snapshot omits" — the more likely reducer-drop regression.

**9. LOW — The JSON-stringify lane comparison is not buggy today, but the
contract leaves it too fragile.** Unknown nested lane keys are stripped
before comparison, so a polluted bootstrap lane and clean snapshot lane
could compare equal.

**10. LOW — The contract-test ratchet advanced, but it did not cover the
adversarial surface it claims.** 94 tests is evidence the count moved, not
evidence that RUN-I8 transitive strictness or prefix-snapshot rejection
or prototype-key rejection is actually closed.

**Verdict: NEEDS ADJUSTMENT.**

## Operator response (incorporated vs deferred)

### Incorporated (HIGHs + most MEDs + all LOWs)

- **HIGH #1 (nested strict)** — Applied `.strict()` transitively to every
  nested schema crossing the Event/Snapshot boundary: `LaneDeclaration` (6
  variants), `AdapterRef` (3 variants), `CustomAdapterDescriptor`,
  `ProviderScopedModel`, `SkillOverride` (4 variants), `SelectionOverride`,
  `ResolvedSelection`, `SelectionResolution.applied[]` entries. RUN-I8 prose
  updated with transitive closure and the full enforcement surface list.
  Test coverage: 5 new negative cases covering bootstrap lane, snapshot
  lane, adapter, `resolved_selection`, and `resolved_selection.model`.
- **HIGH #2 (prefix-snapshot)** — Tightened `RunProjection` superRefine
  from `events_consumed <= log.length` to `events_consumed === log.length`.
  Prefix-bound projections (stale caches) are now rejected at parse time.
  RUN-I7 prose updated. Prefix-snapshot semantics are explicitly deferred
  to Phase 2 property `run.prop.projection_is_a_function`. Test coverage:
  new negative case (`events_consumed=1` against length-2 log).
- **MED #3 (prototype-chain)** — Added identity-field own-property guard
  (`run_id`, `kind`, `sequence`) as a `z.custom` pre-check on the RunLog
  pipe. Prototype-chain smuggle via `Object.create({run_id: ...})` is
  rejected before the discriminated union parses. RUN-I3 prose updated
  with defense-in-depth section. Full recursive own-property defense is
  honestly deferred to Phase 2 property
  `run.prop.boundary_own_property_defense`. Test coverage: 3 new negative
  cases (inherited `run_id`, `kind`, `sequence`).
- **MED #4 (recorded_at monotonicity)** — Scope admission only: RUN-I2
  prose now explicitly states `sequence` is authoritative and
  `recorded_at` is diagnostic metadata that may non-monotone under clock
  adjustments. Full timestamp-sanity enforcement (within a clock-skew
  tolerance) is deferred to Phase 2 property `run.prop.recorded_at_sanity`.
  Rationale: clock rollback is a legitimate scenario in distributed
  dispatch; a schema-level monotonicity rule would reject correct logs.
- **MED #5 (close semantic adequacy)** — Scope admission only: RUN-I7
  prose now states the invariant binds labels, not semantics. Reserved
  Phase 2 property `run.prop.close_outcome_semantic_adequacy`. Rationale:
  checking whether a `complete` close is consistent with the step-
  completion pattern requires log-wide reasoning the reducer is
  responsible for; schema-level rejection of short logs would conflate
  zero-work workflows with invalid ones.
- **MED #6 (typed mapping)** — Introduced `type ClosedSnapshotStatus =
  Exclude<SnapshotStatus, 'in_progress'>` and typed
  `SNAPSHOT_STATUS_FOR_OUTCOME` as `Record<RunClosedOutcome,
  ClosedSnapshotStatus>`. Added bidirectional compile-time equality
  guard `OutcomeStatusEquality` using `IsExact<A, B>` that collapses to
  `never` if the two sets drift. RUN-I7 prose updated to reflect the
  compile-time (not test-time) totality guarantee. Test coverage: 5 new
  positive cases (one per outcome: complete, aborted, handoff, stopped,
  escalated).
- **MED #7 (breadth)** — Table-driven strict-mode negative tests across
  all 11 event variants (22 new tests: 11 negative + 11 positive
  fixtures).
- **LOW #8 (invocation_id asymmetry)** — Added missing negative ("bootstrap
  has, snapshot lacks") + new positive ("both present and equal").
- **LOW #9 (lane comparison fragility)** — Replaced `JSON.stringify` deep
  compare with a structural field-by-field `laneEquals` function that
  handles the 6 lane variants explicitly. Added positive test case that
  two lanes with identical values but different field-insertion orders
  compare equal.
- **LOW #10 (ratchet vs discipline)** — Addressed implicitly by the
  test-coverage deltas above: the ratchet advance (65 → 134) is now
  backed by targeted adversarial-surface coverage, not just count
  inflation.

### Deferred (documented with rationale)

None. Every objection was either incorporated or converted to a Phase 2
property id with explicit rationale in the contract prose. The Phase 2
properties are:

- `run.prop.recorded_at_sanity` (from MED #4)
- `run.prop.close_outcome_semantic_adequacy` (from MED #5)
- `run.prop.boundary_own_property_defense` (from MED #3 full scope)
- `run.prop.projection_is_a_function` (from HIGH #2 prefix-snapshot scope)

## Invariants tightened in this fold-in

- RUN-I2: scope caveat added for `recorded_at`
- RUN-I3: defense-in-depth identity-field own-property guard added
- RUN-I7: tightened to `events_consumed === log.length`; compile-time
  `OutcomeStatusEquality` guard added; semantic-adequacy scope caveat
  added
- RUN-I8: transitive-strict closure across all nested schemas

## Test count delta

Before Codex pass: 94 tests (46 prior + 28 Run-slice v0).
After fold-in: 134 tests (+40: 5 nested surplus, 1 prefix, 5 outcome
positive, 2 invocation_id direction/positive, 1 lane key-order, 22 event-
variant strict coverage, 3 prototype-chain, 1 SelectionOverride surplus).

## Methodology note

This review is one Swiss-cheese layer, not statistical independence with
the authoring model (Knight & Leveson 1986). A future Phase 1 v0.2 pass
should run a third-model challenger (e.g., Gemini or a different Claude
generation) if the closure gates warrant it — specifically on the four
"Reserved for Phase 2" property ids listed above, where semantic adequacy
and log-wide reasoning cannot yet be asserted at the schema layer.
