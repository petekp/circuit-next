---
adr: 0005
title: v2 Schema — plane promoted to required; mixed-layer artifacts classified as data-plane
status: Accepted
date: 2026-04-19
author: operator
supersedes: none
related: ADR-0003, ADR-0004
---

# ADR-0005 — v2 Schema: plane required; mixed-layer artifacts are data-plane

## Context

ADR-0004 introduced the `plane` dimension and backfilled 10 of 13
artifacts. Three mixed-layer artifacts were deferred via a
`PLANE_DEFERRED_IDS` allowlist in `scripts/audit.mjs`:

- `selection.override`
- `adapter.registry`
- `adapter.reference`

ADR-0004 §Why not require plane everywhere framed the deferral as a
legitimate v0.2 scoping decision. The reopen conditions named two
alternatives for v2:

1. Promote `plane` to structurally required and land the three deferred
   classifications with explicit evidence.
2. Split the three artifact ids into per-layer ids
   (`selection.override.plugin`, `selection.override.operator`, etc.) so
   the authority graph expresses per-layer planes.

This ADR picks alternative (1). The allowlist is removed; the three
artifacts are classified as `data-plane`.

## Decision

### Bump to schema version 2

`specs/artifacts.json` is promoted to `"version": 2`. The change is
additive-in-strictness: fields existing at v1 retain their meaning; the
new structural requirement is that every artifact MUST declare `plane`
from the closed set `{control-plane, data-plane}`.

### Classify the three deferred artifacts as data-plane

The classifier answers "who produces the artifact". Each of the three
deferred artifacts has **writers** that include operator-layer
principals:

| Artifact | Writers | Operator-layer producers |
|---|---|---|
| `selection.override` | plugin author (defaults), operator (user-global/project/invocation), engine (composition) | user-global, project, invocation |
| `adapter.registry` | plugin author (defaults), operator (user-global/project/invocation) | user-global, project, invocation |
| `adapter.reference` | plugin author (step.adapter), operator (CircuitOverride.adapter) | CircuitOverride layer |

An operator-layer writer is not plugin-author-signed. The layer's input
is read from the operator's filesystem, subject to model-assisted
editing at any time. This disqualifies the artifact from control-plane,
which requires "never model-authored during a run".

The Zod schema for each of the three parses every layer through the
same `.strict()` boundary: the engine does not syntactically
distinguish plugin-authored from operator-authored inputs at parse
time in the current design. Trust differentiation, where it exists
today, is applied at *resolver* layers (e.g. adapter-closure checks,
reserved-name disjointness, registry-key/descriptor-name parity).

The worst-case producer determines the plane. For all three, the
worst-case producer is an operator-layer principal. Therefore
`plane: data-plane`.

### Scope of this decision — what worst-case classification does and does not prove

Classifying by worst-case producer is a **coarse, conservative v2
classifier**. It is not a claim that per-layer provenance is
irrelevant to circuit-next, nor that splitting the three artifact ids
into per-layer variants (`selection.override.plugin` vs
`selection.override.operator`, etc.) was the wrong alternative in the
long run. The narrower claim is:

- `data-plane` captures the required schema hardness (transitive
  `.strict()`, own-property closure, ghost-provenance rejection) for
  each of these artifacts. The hardness is uniform across layers
  because the engine parses every layer uniformly today.
- `control-plane` does not fit any of the three because operator-layer
  writers exist. Choosing `control-plane` would silently weaken
  operator-path enforcement.

The things worst-case classification does **not** settle:

- Whether future resolver rules should distinguish plugin-authored
  defaults from operator-local overrides when deciding trust.
- Whether the authority graph should eventually carry a first-class
  per-layer provenance column or split ids so per-layer invariants can
  be enumerated separately.
- Whether any audit / emit surface needs to report the exact
  producing layer (as distinct from "one of the operator layers
  did it").

If any of those design pressures materialize, splitting or adding a
provenance column becomes the correct response; this ADR does not
foreclose that path. The reopen conditions below enumerate the
specific pressures.

### Trust-boundary prose rewrite

v1 prose began with `"mixed; ..."`. `mixed` is explicitly not in the
data-plane origin-token set (see ADR-0004 and Codex HIGH #3) because it
describes cardinality of origins, not an origin. The existing
`trustBoundaryHasOriginToken` rule already passed for these three
because the prose also contains `operator-local`, but the leading
`mixed;` was misleading and now reads as documentation of an
intermediate state that no longer exists.

v2 prose separates **origin** (who writes) from **validation** (what
the engine enforces at parse/resolve). The Codex fold-in on this slice
(MED #3) observed that the original draft blurred the two by describing
composition/closure as "engine-computed origins" — engine actions are
validators or downstream products, not producer origins.

Final v2 strings (as committed to `specs/artifacts.json`):

| Artifact | v2 trust_boundary |
|---|---|
| `selection.override` | `operator-local at user-global/project/invocation layers; plugin-author-signed at the defaults layer; engine validates .strict() key closure and ghost-provenance rejection at parse time. Composition produces selection.resolution (separate artifact).` |
| `adapter.registry` | `operator-local at user-global/project/invocation layers; plugin-author-signed at the defaults layer; engine validates reserved-name disjointness, own-property closure, and registry-key/descriptor-name parity at parse time.` |
| `adapter.reference` | `operator-local at user-global/project/invocation layers; plugin-author-signed at the defaults layer; engine validates named-ref registry closure during resolution. MUST NOT appear in run.log (resolved-form-only per ADAPTER-I10).` |

Each string names at least one unnegated origin token from the closed
set, passing the Slice 12 data-plane trust-boundary-detail rule. The
`adapter.reference` producer surfaces are `DispatchConfig.roles` and
`DispatchConfig.circuits` entries (not the non-existent `step.adapter`
or `CircuitOverride.adapter` fields named in the v1 prose — see Codex
HIGH #2 fold-in in the review record).

### Remove the deferral allowlist

`scripts/audit.mjs` drops `PLANE_DEFERRED_IDS`. The
required-or-deferred rule becomes a plain required rule: every
artifact MUST declare `plane`, full stop. The error message simplifies
to "classify as control-plane or data-plane".

### Remove the "deferred" test block; add positive classifications

`tests/contracts/artifact-authority.test.ts` drops the
"plane deferral allowlist" describe block and replaces it with
positive plane assertions for the three newly-classified artifacts.
The version parse check bumps from `toBe(1)` to `toBe(2)`.

## Consequences

### Immediate (this slice)

- `specs/adrs/ADR-0005-v2-plane-required.md` (this file).
- `specs/artifacts.json` bumped to `"version": 2`; three `plane` values
  added; three `trust_boundary` strings rewritten.
- `specs/artifacts.md` documentation updated: §Plane section describes
  the v2 structural requirement; §What Slice 12 classifies renamed to
  describe the v2 plane coverage; §Evolution notes the v2 bump.
- `scripts/audit.mjs` drops `PLANE_DEFERRED_IDS`; the
  required-or-deferred check becomes required.
- `tests/contracts/artifact-authority.test.ts` version expectation
  bumped to 2; deferred block replaced with positive classifications;
  `every artifact declares plane` positive assertion added.
- `PROJECT_STATE.md` notes the v2 bump.

### Authority-graph state after this slice

- 13 artifacts, all plane-classified.
  - control-plane (4): `workflow.definition`, `step.definition`,
    `phase.definition`, `skill.descriptor`.
  - data-plane (9): `run.log`, `run.projection`,
    `selection.override`, `selection.resolution`, `adapter.registry`,
    `adapter.reference`, `adapter.resolved`, `continuity.record`,
    `continuity.index`.
- 0 deferred; `PLANE_DEFERRED_IDS` removed.
- Audit summary reports `13/13 plane-classified`, no deferral tail.

### Going forward

- Any new artifact added to `specs/artifacts.json` MUST declare
  `plane`. The audit now fails red on absence with no escape hatch.
  New mixed-layer artifacts classify by worst-case producer — the
  precedent is established by this slice.
- Future ADRs may add a third plane (e.g. `protocol-plane` for
  external-protocol artifacts whose trust model is
  "whatever the external protocol says"); such an ADR would enumerate
  the new closed set and re-classify existing artifacts accordingly.
  This is a v3 concern.
- The Phase 2 property harness can now cite `plane` as a total
  classifier (no deferred tail) — e.g. "every data-plane aggregate
  with a path-derived field has a path-traversal property test".

### Non-goals

- This slice does not add a Zod schema for `specs/artifacts.json`
  itself. "Structurally required" at v2 means the audit rule
  structurally requires it (required, not required-or-deferred). A
  Zod-schema-for-authority-graph slice is orthogonal and scoped
  separately if needed.
- This slice does not add `validation_surface` or other new columns.
- This slice does not modify any `surface_class` or
  `compatibility_policy` values.
- This slice does not modify Zod schemas under `src/schemas/`. The
  domain semantics of `SelectionOverride`, `DispatchConfig`, and
  `AdapterReference` are unchanged — only the authority graph's
  classification of them changes.

### Reopen conditions

Per Codex fold-in MED #6, reopen conditions name both
**damage-signal** triggers (the gap is already exposed) and
**design-pressure** triggers (the gap is likely and should be
addressed before it exposes). A future contributor encountering any of
these should treat this ADR as reopened.

**Damage-signal triggers** (after-the-fact):

- A resolver is shown to inadvertently trust operator-layer input when
  it should have enforced plugin-layer provenance for one of the three
  worst-case-classified artifacts. Splitting into per-layer ids
  becomes the correct response; this ADR is superseded by one that
  re-IDs the artifact.

**Design-pressure triggers** (before-the-fact):

- A new mixed-layer artifact is proposed. Classifying it under this
  ADR's worst-case rule is legitimate but the addition itself reopens
  the question of whether the authority graph should carry a
  first-class per-layer provenance column.
- Any field-level or layer-level authorization rule appears in a
  contract or resolver (e.g. "this override field is only honorable
  from the plugin-defaults layer"). Field-level authorization cannot
  be expressed on a single per-artifact plane and forces either a
  split or a new column.
- A resolver or audit output needs to emit the *exact* producing
  layer (not just "operator"). That level of provenance cannot be
  reconstructed from `plane: data-plane` alone.
- A mismatch is discovered between an artifact's `writers` prose in
  `artifacts.json` and the actual schema-file surfaces the writer
  names (the class of bug Codex HIGH #2 caught on this slice). The
  mismatch itself is correctable in-place, but a recurring pattern
  suggests the authority graph needs a machine-checkable binding
  between `writers` and concrete schema-file locations.

**Plane-set expansion triggers**:

- A third plane value (e.g. `protocol-plane` for external-protocol
  artifacts whose trust model is "whatever the external protocol
  says") earns its keep. The closed set of `{control-plane, data-plane}`
  in v2 is not a forever decision; a future ADR may widen it.

## Citations

- ADR-0003 (authority-graph gate) — original structural enforcement.
- ADR-0004 (control-plane / data-plane split) — §Why not require plane
  everywhere and §Reopen conditions named v2 as the decision point.
- `specs/artifacts.md` — updated to document the v2 structural
  requirement.
- `scripts/audit.mjs` — updated to drop `PLANE_DEFERRED_IDS`.
- `CLAUDE.md` — methodology pillar 3 (Architecture-First) drives the
  preference for total classifiers over partial-with-allowlist.
