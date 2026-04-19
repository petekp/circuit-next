---
contract_target: continuity
contract_version: 0.1
reviewer_model: gpt-5-codex via codex exec
review_kind: adversarial property-auditor
review_date: 2026-04-19
verdict: REJECT → incorporated → ACCEPT (after fold-in + v0.2 scoping)
authored_by: operator + claude-opus-4-7
---

# continuity.md v0.1 — Codex Adversarial Property-Auditor Review

This record captures the cross-model challenger pass on
`specs/contracts/continuity.md` v0.1 + `src/schemas/continuity.ts` +
the continuity portion of `tests/contracts/schema-parity.test.ts`. The
reviewer's task was an **objection list**, not approval; incorporation
decisions were made by the operator per the narrow-cross-model-challenger
protocol (Knight-Leveson Swiss-cheese, not independent corroboration).

## Verdict chain

`REJECT → incorporated → ACCEPT (after fold-in + v0.2 scoping)`

The reviewer's opening verdict was REJECT pending HIGH fold-ins. Two
HIGHs + one MED + one LOW incorporated in v0.1. Two MEDs scoped to v0.2
with rationale (both are resolver-level concerns, not schema concerns).

## Objection list (as returned by Codex)

**1. HIGH — `.strict()` does not close inherited required-field /
prototype-chain smuggling.** Attack: `record_id`, `continuity_kind`, and
other load-bearing fields can be smuggled through the prototype chain
via `Object.create({record_id: 'evil'})`. Zod reads inherited properties
during parse, so `.strict()` (which only rejects surplus OWN keys) does
not defend against this. CONT-I8's "surplus keys rejected at every
depth" framing overstated the safety property. `src/schemas/run.ts` RUN
MED #3 already guards `RunLog` the same way via
`z.custom<unknown[]>` pre-parse check + `Object.hasOwn`. Continuity did
not.

**Incorporated in v0.1.** New invariant CONT-I12 added. Pre-parse
`z.custom<unknown>` guard wrapping both `ContinuityRecord` (via
`recordOwnPropertyGuard.pipe(z.discriminatedUnion(...))`) and
`ContinuityIndex` (via `indexOwnPropertyGuard.pipe(ContinuityIndexBody)`).
Guarded fields: record-side `[schema_version, record_id,
continuity_kind, resume_contract]`; index-side `[schema_version,
project_root, pending_record, current_run]`. Five negative tests added
using `Object.create(...)` to inject inherited values; each rejected.
Recursive defense over every nested required field is deferred to
Phase 2 property `continuity.prop.boundary_own_property_defense`; v0.1
covers the load-bearing identity/discriminator surface per the same
scope-discipline used in run.ts.

**2. HIGH — `continuity.index` authority metadata names a nonexistent
top-level `record_id`.** Attack: `specs/artifacts.json` declared
`continuity.index.identity_fields: ["record_id"]` and
`path_derived_fields: ["record_id"]`, but the index schema has no
top-level `record_id` — the path-derived field is nested at
`pending_record.record_id`, and the index itself is a singleton file
with no in-body identity. The audit passed because its
`path_derived_fields` check only confirms the contract mentions
`ControlPlaneFileStem`; it did not verify the named field actually
exists.

**Incorporated in v0.1.** Three fixes:
- `continuity.index.identity_fields: []` (singleton — no in-body
  identity).
- `continuity.index.path_derived_fields: ["pending_record.record_id"]`
  (dotted notation for nested reference).
- `specs/artifacts.md` updated: `identity_fields` may be empty for
  singleton artifacts; `path_derived_fields` may be a nested dotted
  path, and need not be a subset of `identity_fields` when the
  artifact is a resolver pointing at another artifact's path-derived
  identity.
- New failure-mode entry in the contract:
  `carry-forward:authority-graph-nested-path`.

**3. MED — `PendingRecordPointer.continuity_kind` is an unbound
denormalized discriminator.** Attack: the pointer carries
`continuity_kind` but neither schema nor prose binds it to the pointed
record's actual `continuity_kind`. A future resolver or UI branching
on the index hint before parsing the record could bypass CONT-I5's
coherence guarantees.

**Scoped to v0.2.** Rationale: the hint is denormalized intentionally —
legacy Circuit included it as an index-level disambiguator and keeping
it preserves operator mental model. The record is authoritative; the
hint is non-authoritative. v0.1 folds in two things to prevent silent
drift:
- Contract §Resolver precedence explicitly documents the non-
  authoritativeness.
- Phase 2 property id
  `continuity.prop.index_pointer_kind_matches_record` reserved.
v0.2 decision: remove the hint OR keep it with the property test, once
evidence indicates whether a real resolver uses it.

**4. MED — Attached-run and pending-record conflict semantics are not
specified.** Attack: when `pending_record` points at a run-backed
record whose `run_ref.run_id` differs from `current_run.run_id`, the
contract does not say what happens. Split-brain state is representable
but unadjudicated.

**Scoped to v0.2.** Rationale: this is resolver-level behavior, not
schema. The schema's job is shape; the resolver's job is adjudication.
Adding a cross-pointer `run_id` refinement at the schema level would
require the schema to reach into a sibling artifact (the record file),
which breaks purity — the schema would no longer be safely runnable on
a single parsed JSON blob. v0.1 folds in:
- Contract §Resolver precedence documents the split-brain case and
  enumerates the three candidate rules (pending-record-wins,
  current-run-wins, error-on-conflict).
- Phase 2 property id
  `continuity.prop.index_pointer_run_id_coherence` reserved.
v0.2 decision: pick the precedence rule once the resume flow lands or
a real incident dictates the policy.

**5. MED — Dangling-reference policy value is used but not admitted by
authority docs/tests.** Attack: `continuity.index` uses
`dangling_reference_policy: "error-at-resolve"`, but
`specs/artifacts.md` only listed `unknown-blocking`, `warn`, `allow`,
and neither audit nor `artifact-authority.test.ts` validated the enum.
A future artifact could invent a second spelling and still pass the
gate.

**Incorporated in v0.1.**
- `scripts/audit.mjs` adds `DANGLING_REFERENCE_POLICIES` closed enum:
  `['n/a', 'unknown-blocking', 'error-at-resolve', 'warn', 'allow']`.
  Audit fails red on any artifact carrying an unknown value.
- `specs/artifacts.md` documents the enum and the semantics of each
  value.
- `continuity.record` set to `n/a` (no outgoing references);
  `continuity.index` set to `error-at-resolve`.

**6. LOW — "All invariants are tested" overclaims current parity
coverage.** Attack: the contract said "all invariants are enforced via
schema and tested in schema-parity" but the continuity block lacked
negative tests for record/index string `schema_version: "1"`,
`AttachedRunPointer` surplus keys, and
`pending_record.record_id` with path separator / `..`.

**Incorporated in v0.1.** Five additional tests added:
- record with string `schema_version: "1"` (legacy shape) — rejected.
- index with string `schema_version: "1"` — rejected.
- `AttachedRunPointer` with surplus `manifest_present` key — rejected.
- `PendingRecordPointer.record_id` with `/` separator — rejected.
- `PendingRecordPointer.record_id` with `..` parent-traversal —
  rejected.

## Missing negative tests identified by review

All LOW #6 gaps closed (see above). Additional gaps the reviewer did not
flag but were plausibly open:

- `RunBackedContinuity.run_ref` with inherited `run_id` via prototype —
  the v0.1 CONT-I12 guard currently covers only `run_ref` presence at
  the top level; inherited `run_id` inside a well-formed `run_ref`
  would still be accepted. Deferred to Phase 2 recursive own-property
  defense (`continuity.prop.boundary_own_property_defense`).
- `ContinuityIndex` with inherited `pending_record` whose OWN-
  prototype-smuggled `record_id` — same recursive scope.

## Fold-in discipline

Each incorporated fix is cross-referenced in the contract's
`Codex adversarial review (v0.1)` + `Evolution` sections.

New invariants landed: CONT-I12 (HIGH #1).

Schema-level fold-ins: own-property guard pipelines on
`ContinuityRecord` + `ContinuityIndex`.

Authority-graph fold-ins: `continuity.index.identity_fields = []`;
`path_derived_fields = ["pending_record.record_id"]`;
`specs/artifacts.md` relaxation of "path_derived_fields ⊆
identity_fields"; `DANGLING_REFERENCE_POLICIES` audit enum.

Prose fold-ins: §Resolver precedence (MED #3 + MED #4 documentation +
v0.2 scope); §Dangling reference policy cites the audit enum;
§Codex adversarial review summary block.

v0.2-scoped objections (MED #3 + MED #4) have explicit rationale tied
to resolver-vs-schema separation and named Phase 2 property ids. No
HIGH defers to v0.2. No fold-in silently changes a post-condition
without updating the prose.

## Verification

Post-fold-in: `npm run verify` green (tsc --strict + biome + vitest).
Total schema-parity tests: 288 (baseline 227 → +61 by audit regex
count). `npm run audit` 10 green / 0 yellow / 0 red.
