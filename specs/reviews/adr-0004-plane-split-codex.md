---
doc: review
subject: ADR-0004 control-plane/data-plane split (Slice 12)
reviewer: Codex
opening_verdict: NEEDS ADJUSTMENT
closing_verdict: ACCEPT (after fold-in)
date: 2026-04-19
---

# Codex adversarial review — ADR-0004 (Slice 12)

## Framing

Narrow cross-model challenger pass per CLAUDE.md pillar 4 and ADR-0001.
Knight & Leveson 1986 framing: Codex and Claude share training
distribution, so this is **adversarial lint**, not independent
corroboration. Objections are recorded; each is either folded in or
scoped to v0.2 with rationale.

## Objections and disposition

### HIGH

**HIGH #1 — Optional `plane` is an escape hatch, not a ratchet.**
Codex evidence: `scripts/audit.mjs` checks `plane` only inside
`Object.hasOwn(artifact, 'plane')`; tests have the same gate. A new
artifact can avoid all Slice 12 enforcement by omitting `plane`.

**Disposition: FOLD IN.** Added a `PLANE_DEFERRED_IDS` allowlist in
`scripts/audit.mjs` naming the three genuinely-mixed-layer artifacts
(`selection.override`, `adapter.registry`, `adapter.reference`).
Audit fails red if an artifact is missing `plane` AND not in the
allowlist. Un-classified rows are no longer a silent escape; they are
either classified or explicitly deferred with rationale. Contract tests
assert the allowlist semantics.

**HIGH #2 — Origin-token rule accepts semantically false trust
boundaries.** Codex evidence: lowercase substring match is naive; a
prose like `"never operator-local; author-signed only"` passes because
`operator-local` is a substring, even though the prose says the opposite.

**Disposition: FOLD IN.** `trustBoundaryHasOriginToken` now rejects
tokens whose immediate left-context contains a negation marker (`not `,
`non-`, `no `, `never `) within a small window. Contract tests add
adversarial negatives covering all four negation patterns, plus a
positive-after-negative case (`"never reads from local; operator-local
writes"` — should pass because the second clause affirms).

**HIGH #3 — `mixed` is not an origin.** Codex evidence: the token set
includes `mixed`, which means "I don't know or won't say," not a
producer. A data-plane artifact can pass the rule with
`trust_boundary: "mixed"` alone.

**Disposition: FOLD IN.** Removed `mixed` from
`DATA_PLANE_ORIGIN_TOKENS`. The closed set is now three concrete origin
kinds: `operator-local`, `engine-computed`, `model-authored`. Artifacts
that genuinely have mixed trust (the three deferred mixed-layer ones)
go in `PLANE_DEFERRED_IDS` until the sweep slice decides how to
represent per-layer planes. Tests and contract tests updated.

**HIGH #4 — Per-artifact `plane` cannot represent the known hard cases.**
Codex evidence: `selection.override`, `adapter.registry`, and
`adapter.reference` carry plugin-authored and operator-local layers in
one artifact id.

**Disposition: FOLD IN (ADR + allowlist).** ADR-0004 already named this
as a known limitation. Hardened: the three artifacts are explicitly
listed in `PLANE_DEFERRED_IDS` in code, in ADR-0004 §Non-goals, and in
`PROJECT_STATE.md`. Per-layer plane representation is a v0.2 schema
evolution item; adding a `plane: 'per-layer'` marker or splitting these
artifact ids into per-layer ids is reopen-condition work for ADR-0004.

**HIGH #5 — ADR prose claims data-plane triggers protections (`.strict()`,
own-property closure, path-safety) that the implemented audit does not
check.** Codex evidence: ADR-0004 §Decision and `specs/artifacts.md`
§Plane claim these protections as plane-triggered requirements; the
Slice 12 audit only checks trust-boundary prose.

**Disposition: FOLD IN (prose walkback).** ADR-0004 §Decision and
`specs/artifacts.md` §Plane rewritten to frame `.strict()`,
own-property closure, and path-safety as **invariants of data-plane
artifacts at the schema level**, enforced by existing contract tests
and `src/schemas/*.ts` — not by new class-conditional audit rules in
this slice. The Slice 12 audit rule is limited to the trust-boundary
origin-token check. A future v0.2 may add structural audit rules that
directly inspect schema-file strictness; those are not in this slice.

### MED

**MED #6 — Control-plane can declare `path_derived_fields`.** Codex
evidence: no audit rule forbids `path_derived_fields` on
`control-plane` artifacts; plugin-authored static content should not be
path-derived because its identity is plugin-author-determined at
build time.

**Disposition: FOLD IN.** New audit rule: a `control-plane` artifact
with a non-empty `path_derived_fields` array is red. Contract test
covers constructed violation.

**MED #7 — Backfill set is biased toward easy exemplars and leaves
easy-but-unclassified rows too.** Codex evidence: `run.projection`,
`selection.resolution`, `adapter.resolved`, and `skill.descriptor` have
prose that already names a concrete origin but are left deferred
alongside the genuinely-hard mixed-layer rows.

**Disposition: FOLD IN.** Expanded backfills from 4 to 10:
- control-plane: `workflow.definition`, `step.definition`,
  `phase.definition`, `skill.descriptor`
- data-plane: `run.log`, `run.projection`, `selection.resolution`,
  `adapter.resolved`, `continuity.record`, `continuity.index`

Only the three genuinely-mixed-layer artifacts remain in
`PLANE_DEFERRED_IDS`. The sweep slice now has a well-scoped task:
decide how to represent per-layer planes for three specific ids,
rather than triage 9 rows of mixed difficulty.

**MED #8 — Tests import the same predicate they verify (not
defense-in-depth).** Codex evidence: `artifact-authority.test.ts`
imports `trustBoundaryHasOriginToken` from the audit implementation;
tests prove the function returns what it returns, not that the rule
catches semantic violations.

**Disposition: FOLD IN.** Added adversarial-negative cases that assert
the rule rejects semantically wrong prose: negation patterns, `mixed`
alone, empty prose. These are independent expected behaviors, not
restatements of the implementation. Tests now cover the
negation-rejection logic added for HIGH #2.

**MED #9 — Binary plane has no external-protocol story before v2.**
Codex evidence: `surface_class: external-protocol` exists in ADR-0003
but no corresponding plane value. No current artifact uses
external-protocol.

**Disposition: SCOPE TO v0.2.** No external-protocol artifacts exist
today; adding `protocol-plane` or forcing external-protocol into one
of the existing two bins before we have a concrete external artifact
is premature. ADR-0004 §Reopen conditions already names this.
PROJECT_STATE.md notes the v0.2 schema evolution owes a decision here
before any external-protocol artifact lands.

### LOW

**LOW #10 — Audit summary overclaims classification.** Codex evidence:
`checkAuthorityGraph` reports `"N artifacts, all classified"` while
`plane` is partial; the summary conflates `surface_class` classification
with `plane` classification.

**Disposition: FOLD IN.** Summary split into two counts:
`${N} artifacts, all surface_class-classified; ${P}/${N} plane-
classified (${D} explicitly deferred)`. Tests cover the count accuracy.

**LOW #11 — v2 promotion path is named but not operationalized.** Codex
evidence: docs say schema v2 promotes `plane` to required, but no
machine-readable ratchet ages or counts the deferral.

**Disposition: PARTIAL FOLD IN.** The `PLANE_DEFERRED_IDS` allowlist
+ red audit on missing-and-not-deferred is the operational ratchet:
new artifacts cannot land without `plane` unless the author explicitly
adds an id to the deferred list (visible in code, reviewable in diffs).
The v2 promotion itself remains an explicit future commit; no
machine-readable target date is added in v0.1 because we have no
forcing function for that (out of scope for audit tooling).

## Summary

| Severity | Count | Incorporated | Scoped v0.2 |
|---|---|---|---|
| HIGH | 5 | 5 | 0 |
| MED | 4 | 3 | 1 |
| LOW | 2 | 2 | 0 |

All HIGH objections closed at v0.1. One MED deferred to v0.2
(external-protocol plane, no forcing artifact exists). Closing verdict:
ACCEPT after fold-in.
