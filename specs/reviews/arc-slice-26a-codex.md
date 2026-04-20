---
name: arc-slice-26a-codex
description: Codex challenger pass on the drafted Slice 26a working-tree diff (run.projection / run.snapshot binding split + ADR-0003 Addendum B + audit Check 16).
type: review
reviewer_model: gpt-5-codex
reviewer_model_id: gpt-5-codex
authorship_role: challenger
review_kind: challenger
review_date: 2026-04-20
verdict: ACCEPT-WITH-FOLD-INS → incorporated → ACCEPT
authored_by: gpt-5-codex + claude-opus-4-7
target_kind: arc
target: slice-26a
target_version: a25ac37+working-tree-diff
review_target: arc-slice-26a-binding-split
arc_target: slice-26a
arc_version: a25ac37..HEAD (Slice 26a working tree)
opening_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: ACCEPT (after 4 MED + 3 LOW fold-ins)
commands_run:
  - read specs/artifacts.json (run.projection + run.snapshot diffs)
  - read specs/contracts/run.md (artifact_ids frontmatter)
  - read scripts/audit.mjs (SCHEMA_FILE_ALLOWLIST + WRAPPER_AGGREGATE_EXPORTS + Check 16 wiring)
  - read scripts/audit.d.mts (new type declarations)
  - read tests/contracts/artifact-authority.test.ts (Slice 26a describe blocks)
  - read specs/adrs/ADR-0003-authority-graph-gate.md (Addendum B)
  - read src/schemas/snapshot.ts + src/schemas/run.ts (schema exports)
  - read specs/plans/phase-1-close-revised.md (Slice 26a + Slice 27c scope)
opened_scope:
  - specs/artifacts.json
  - specs/contracts/run.md
  - scripts/audit.mjs
  - scripts/audit.d.mts
  - tests/contracts/artifact-authority.test.ts
  - specs/adrs/ADR-0003-authority-graph-gate.md
skipped_scope:
  - src/schemas/* (no runtime-shape changes in Slice 26a; Slice 27c lands the reducer-derived writer)
  - .claude-plugin/skills/dogfood-run-0/ (authored by Slice 27d; does not exist yet)
---

# Codex Challenger Pass — Slice 26a Run-Snapshot Binding Split

## Target

Slice 26a closes HIGH #1 from `specs/reviews/arc-progress-codex.md`: the
`run.projection` artifact row at `specs/artifacts.json` previously bound
the persisted backing path `<circuit-next-run-root>/state.json` to the
wrapper schema `RunProjection = { log, snapshot }` instead of the
standalone `Snapshot` shape. The slice splits the artifact
(`run.projection` becomes an in-memory aggregate with no persisted
backing; a new `run.snapshot` artifact row owns `state.json`), removes
`src/schemas/snapshot.ts` from the shared-primitive allowlist in
`scripts/audit.mjs`, adds a named-allowlist guard
(`WRAPPER_AGGREGATE_EXPORTS` + Check 16) against recurrence, and records
the structural rule as ADR-0003 Addendum B. Lane: Ratchet-Advance.

## Opening verdict

`ACCEPT-WITH-FOLD-INS`

## Closing verdict

`ACCEPT (after 4 MED + 3 LOW fold-ins)`

## Findings

### MED

**1. MED — `run.log.resolvers` did not name the new `run.snapshot` artifact.**

`run.snapshot` states that `state.json` is always recomputable from
`run.log` by replaying events, but `run.log.resolvers` still listed only
`run.projection`. ADR-0003 Addendum A's manual checklist requires source
artifacts to list derivers in `resolvers`; the binding split closes the
shape mismatch but under-describes the derivation edge.

**Disposition:** FOLDED IN. `run.log.resolvers` extended to
`["run.projection", "run.snapshot"]`. `run.snapshot.resolvers` stays
empty: `run.snapshot` is a leaf derivation of `run.log`, not a resolver
source for anything else in the current graph.

**2. MED — `WRAPPER_AGGREGATE_EXPORTS` completeness claim was false: `LayeredConfig` is a wrapper-like aggregate outside the allowlist.**

`LayeredConfig = { layer, config, source_path }` wraps `Config` with
layer metadata and declares a prose-sentinel `backing_paths`
("in-memory wrapper around config.root (no standalone on-disk form)"), a
literal reading of Addendum B could flag it. Not the same persisted-
shape bug as `state.json`, but close enough to falsify the "every
wrapper aggregate" phrasing.

**Disposition:** FOLDED IN (combined with MED 3). Allowlist scope narrowed
to **multi-leaf persisted-shape wrapper aggregates** — fields that are
themselves artifact-bound schema exports AND persist as separate files.
`LayeredConfig` is explicitly out of scope (one leaf `Config` plus
metadata, not two artifact-bound leaves); recorded as a candidacy note in
Addendum B so the absence is a decision, not an oversight. Slice 26a does
not add `LayeredConfig` to the allowlist.

**3. MED — Addendum B trigger prose was broader than the named-allowlist enforcement.**

Addendum B's trigger described "whose body is `z.object({...})` or
equivalent" — an under-specified structural test given the actual
`RunProjectionBody.superRefine(...)` pattern at `src/schemas/run.ts:158`,
and overbroad against benign multi-field schemas like `Workflow`.

**Disposition:** FOLDED IN. Addendum B rewritten to (a) define multi-leaf
persisted-shape wrapper aggregates semantically, (b) state that Slice 26a
enforcement is a named allowlist (`WRAPPER_AGGREGATE_EXPORTS`) NOT a
body/AST detector, (c) list `Workflow` and `LayeredConfig` as out-of-
scope cases, (d) require future qualifying aggregates to extend the
allowlist in the same slice that authors them.

**4. MED — `checkPersistedWrapperBinding` had no full-file red fixture.**

The constructed helper tests cover `detectWrapperAggregateBinding`. The
full-file test only asserted green on the current graph. A regression
that inerts the check (stops loading, stops iterating, always returns
green) would pass silently.

**Disposition:** FOLDED IN. Added a red-fixture test that constructs a
temp-root `specs/artifacts.json` with a bad `run.projection` row
(`RunProjection` + persisted `state.json`) and asserts
`checkPersistedWrapperBinding(tempRoot).level === 'red'`, plus detail-
content checks on the artifact id + export name.

### LOW

**5. LOW — `run.snapshot.trust_boundary` overclaimed Slice-27c enforcement in present tense.**

`writers` correctly said "authored by Slice 27c"; `trust_boundary` used
present-tense "is enforced at re-entry by Slice 27c's manifest-snapshot
gate" despite the slice not having landed.

**Disposition:** FOLDED IN. Reworded to "no runtime writer exists before
Slice 27c; when Slice 27c lands, state.json will be written only by the
reducer, and a byte-match against a fresh reducer pass over run.log will
be enforced at re-entry."

**6. LOW — `specs/contracts/run.md` still had a stale `events_consumed ≤ log.length` postcondition.**

RUN-I7 and the schema both enforce exact equality;
`specs/contracts/run.md:188` still used `≤`.

**Disposition:** FOLDED IN. Changed `≤` to `===` at the indicated line.

**7. LOW — `specs/artifacts.md` stale against 17-artifact graph.**

The live graph now includes `run.snapshot` and the Slice 26 `config.*`
rows (17 total); `specs/artifacts.md` still described data-plane = 9
under the Slice 7 / 12-artifact framing.

**Disposition:** FOLDED IN. Plane-coverage summary updated to control-
plane = 4 / data-plane = 13 / total = 17. "12 initial artifacts" section
retitled as historical Slice 7 context with pointer to
`specs/artifacts.json` as the live source of truth.

### META

**Tripwire adjudication and non-findings.** Reviewer confirmed: tripwire
not hit. One new row (`run.snapshot`), zero runtime-shape changes in
`src/schemas/*`. `run.snapshot.schema_exports` matches the current
`src/schemas/snapshot.ts` exactly. Existing schema-export coverage ledger
catches future unlisted exports in that file. No reviewer execution of
the repo. No action required.

## Summary

**0 HIGH / 4 MED / 3 LOW + 1 META.** All 7 findings folded in before
commit. Opening verdict `ACCEPT-WITH-FOLD-INS`; closing verdict `ACCEPT`.

## Authorship role

`challenger` authorship role on the opening verdict + findings body
(`gpt-5-codex`); operator + `claude-opus-4-7` produced the fold-in diffs
and this record. Not a cold-read human review; the L3 human-cold-read
gate remains open per `specs/methodology/product-gate-exemptions.md` D1
bootstrap posture.
