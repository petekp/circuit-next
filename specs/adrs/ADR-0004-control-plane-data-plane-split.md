---
adr: 0004
title: Control-Plane / Data-Plane Split on the Authority Graph
status: Accepted
date: 2026-04-19
author: operator
supersedes: none
related: ADR-0001, ADR-0002, ADR-0003
---

# ADR-0004 — Control-Plane / Data-Plane Split on the Authority Graph

## Context

ADR-0003 established the Authority-Graph Gate. Its own self-audit named
three root causes; the third was left unresolved:

> **Control-plane / data-plane confusion** — the existing contracts bind
> runtime schemas to on-disk artifacts without making the authority
> relationship between a contract, its schema file, its on-disk path, its
> writer, its reader, and its resolver explicit or machine-checkable.

`specs/artifacts.json` at v1 records **what** an artifact is (surface
class, compatibility posture, schema file, writers, readers) but not
**who** is trusted to produce it. The `trust_boundary` column is prose,
not a classifier. Two artifacts with very different attack surfaces —
`workflow.definition` (plugin-authored YAML loaded read-only at bootstrap)
and `continuity.record` (operator-local JSON that may contain model-
authored narrative) — share the same enforcement shape even though the
former is author-signed static configuration and the latter is a runtime
byproduct of a possibly-hostile-by-drift session.

The gap manifested during Slices 8–11:

- Slice 8 (`continuity.md`) needed `ControlPlaneFileStem` path-safety and
  prototype-chain own-property guards precisely because the artifact
  crosses a model-authored-narrative seam.
- Slice 6 (`adapter.md`) needed registry-key ↔ descriptor-name parity and
  reserved-name disjointness precisely because some config layers are
  plugin-author-signed and others are operator-local with no such
  guarantee.
- Slice 11's schema-export drift (`AdapterReference` misplaced) was
  contained because it lived in a plugin-authored shape; the equivalent
  drift on a data-plane aggregate would be a data-exfiltration or
  path-traversal surface.

The discipline had the right defenses in the right places — but by
accident, not by graph-level classification. A future contributor adding
a new artifact has no machine-checked prompt to ask: *is this something
plugin authors produce, or something operators (and by extension models)
produce at runtime?*

## Decision

We introduce a **plane** dimension on every artifact in
`specs/artifacts.json`, orthogonal to `surface_class` and
`compatibility_policy`. Values are a closed two-element set:

| Plane | Meaning |
|---|---|
| **control-plane** | Plugin-authored static definition. Loaded read-only at bootstrap or catalog-compile time. Never model-authored during a run. Never mutated by the engine at runtime. |
| **data-plane** | Operator-local, runtime-produced, engine-computed, or model-authored. May carry operator-written text, model-authored narrative, or engine-computed state. Heavier schema-file invariants (transitive `.strict()`, own-property closure, path-safety primitives where identity fields derive filesystem paths) are properties of data-plane **schema files**, enforced by existing contract tests and path-safety audit rules. The class-conditional audit added in this slice focuses on the trust-boundary prose rule; structural-invariant enforcement via the plane classifier (e.g., "every data-plane schema file must compile under a strict-mode checker") is scoped to a future slice. |

The classifier is **about who produces the artifact**, not where it
lives. A `control-plane` artifact may live on operator disk (e.g. the
compiled catalog projection at `<plugin>/catalog/skills.json`) without
becoming `data-plane`, because it is a build-time output of the plugin
author's static inputs. A `data-plane` artifact may live in engine
memory without ceasing to be `data-plane`, because its **origin** is
operator-local or model-authored state.

### Class-conditional enforcement

The `plane` classifier is not cosmetic. `scripts/audit.mjs` applies
three class-conditional checks, hardened during Codex fold-in (see
`specs/reviews/adr-0004-plane-split-codex.md`):

1. **Required-or-deferred.** Every artifact must either declare `plane`
   **or** appear in the `PLANE_DEFERRED_IDS` allowlist in
   `scripts/audit.mjs`. The allowlist currently names the three
   genuinely-mixed-layer artifacts (`selection.override`,
   `adapter.registry`, `adapter.reference`). Any other artifact missing
   `plane` fails the audit red. This closes the "optional field as
   silent escape hatch" failure mode.
2. **Data-plane trust-boundary detail.** A `data-plane` artifact's
   `trust_boundary` prose must name at least one **unnegated** origin
   token from the closed set: `operator-local`, `engine-computed`,
   `model-authored`. `mixed` is *not* in the set: it is a cardinality
   descriptor, not an origin, and cannot satisfy "who can lie to this
   reader?" on its own. The rule rejects origin-token matches whose
   immediate left-context contains `not `, `non-`, `no `, or `never ` —
   this prevents "never operator-local" from passing substring match.
3. **Control-plane path-derivation ban.** A `control-plane` artifact
   may not declare non-empty `path_derived_fields`. Plugin-authored
   static content's identity is plugin-author-determined at build
   time; deriving identity from filesystem path components is a
   data-plane concern.

`tests/contracts/artifact-authority.test.ts` asserts the same invariants
locally so the feedback loop is fast, and includes adversarial-negative
cases for each rule (negation patterns, mixed-alone, constructed
control-plane-with-path-derivation violation).

### Scoping: broad unambiguous backfills + explicit deferral for the
### three mixed-layer artifacts

ADR-0003 backfilled 12 artifacts in one slice. That was workable because
the classification (six `greenfield`, two `successor-to-live`) was
determined by presence vs. absence of a live reference surface — a binary
observation, not a judgment call.

An earlier draft of this ADR proposed backfilling only four exemplars.
The Codex adversarial pass (MED #7) observed that this biased the sample
toward "easy" rows while deferring unambiguous rows alongside the
genuinely-hard ones, producing a bias-by-omission. Fold-in: Slice 12 now
backfills every artifact whose plane is unambiguous from its trust
prose:

- **control-plane** (4): `workflow.definition`, `step.definition`,
  `phase.definition`, `skill.descriptor`.
- **data-plane** (6): `run.log`, `run.projection`,
  `selection.resolution`, `adapter.resolved`, `continuity.record`,
  `continuity.index`.

Only three artifacts remain deferred (listed in `PLANE_DEFERRED_IDS`):

- **selection.override** — contributed per config layer; plugin-layer
  defaults are author-signed, operator layers are operator-local. The
  artifact is one shape — but it carries different trust per layer.
- **adapter.registry** — same shape (per-layer mixed).
- **adapter.reference** — a pointer into the registry; its trust
  inherits whichever layer produced the reference.

Forcing a same-slice choice on these three risks either mis-classifying
as `control-plane` (silently weakening operator-path enforcement) or
over-classifying as `data-plane` without an evidence trail.

Schema version 2 will either promote `plane` to structurally required
(and land the three deferred classifications with explicit evidence) or
split these three artifact ids into per-layer ids (`selection.override.plugin`
vs `selection.override.operator`, etc.) with per-id planes. The v2
decision is scoped to a dedicated slice.

This is a **Ratchet-Advance** slice: a new dimension is added, 10 of 13
artifacts now see enforcement, the deferred 3 are explicitly listed
(not silently omitted), and no previously-green check regresses.

### Relationship to `trust_boundary`

`plane` does not replace `trust_boundary`. The prose column keeps its
role — it describes the per-artifact semantics of "who trusts what". The
`plane` column is the machine-checkable coarse classifier that triggers
class-conditional rules.

The rule introduced in this slice (data-plane → `trust_boundary` must
name an origin token) is the first; future rules may require data-plane
artifacts to carry a `validation_surface` column or prohibit
`path_derived_fields` on control-plane artifacts. These are not included
in this slice.

## Consequences

### Immediate (this slice)

- `specs/adrs/ADR-0004-control-plane-data-plane-split.md` (this file).
- `specs/reviews/adr-0004-plane-split-codex.md` — Codex adversarial
  review record (opening verdict NEEDS ADJUSTMENT → closing verdict
  ACCEPT after fold-in of 5 HIGH + 3 MED + 2 LOW).
- `specs/artifacts.json` at version 1 with ten `plane` backfills (4
  control-plane, 6 data-plane); three genuinely-mixed-layer artifacts
  listed in `PLANE_DEFERRED_IDS`.
- `specs/artifacts.md` documenting the new column and the Slice 12
  audit rule.
- `scripts/audit.mjs` extended with:
  - `PLANES` closed set (`control-plane`, `data-plane`).
  - `DATA_PLANE_ORIGIN_TOKENS` three-element set (`mixed` removed per
    Codex HIGH #3).
  - `NEGATION_MARKERS` + `NEGATION_WINDOW` for negation-aware origin
    matching (Codex HIGH #2).
  - `PLANE_DEFERRED_IDS` allowlist enumerating the three deferred
    artifacts (Codex HIGH #1).
  - Three new class-conditional rules: required-or-deferred,
    data-plane trust-boundary-detail, control-plane path-derivation
    ban.
  - Summary split: surface-class count distinct from plane count
    (Codex LOW #10).
- `tests/contracts/artifact-authority.test.ts` extended with:
  - positive parity for all ten backfills,
  - closed-set membership for `plane`,
  - adversarial-negative cases for all four negation markers,
  - `mixed`-alone rejection,
  - positive-after-negative case,
  - deferral allowlist parity (non-deferred → plane required; deferred
    → plane absent),
  - control-plane path-derivation ban tests.
- `scripts/audit.d.mts` exports for the two new helpers
  (`planeIsValid`, `trustBoundaryHasOriginToken`).
- `PROJECT_STATE.md` noting the v2 schema evolution scope and the
  three deferred ids.

### Going forward

- Any new artifact added to `specs/artifacts.json` SHOULD declare a
  `plane` unless the decision is explicitly deferred. The v1 schema
  leaves `plane` optional so the audit does not red on absent classifier;
  a future v2 bump promotes to required once the 9 backfills land.
- The sweep slice covering the 9 remaining backfills is a
  **Ratchet-Advance** slice in its own right. Each of the three
  mixed-layer config artifacts (`selection.override`, `adapter.registry`,
  `adapter.reference`) earns an individual judgment call with rationale
  in the commit body or ADR-0004 addendum.
- The Phase 2 property harness, when landed, can cite `plane` as an
  index dimension for property coverage (e.g. "every data-plane
  aggregate with a path-derived field has a path-traversal property
  test").

### Non-goals

- This slice does **not** add a `validation_surface` column. Whether the
  data-plane rule is strong enough or needs additional enforcement is a
  question for after the sweep lands and all artifacts are classified.
- This slice does **not** modify `surface_class` or
  `compatibility_policy` semantics. `plane` is orthogonal.
- This slice does **not** retrofit existing contracts. Contract
  frontmatter does not need to cite `plane`; the plane is an attribute
  of the artifact, not of the contract.

### Reopen conditions

- Evidence emerges that two-element plane is insufficient (e.g. a third
  `protocol-plane` for external-protocol artifacts whose trust model is
  "whatever the external protocol says").
- A mixed-layer artifact's plane cannot be chosen without splitting the
  artifact into two ids (e.g. `selection.override.plugin` vs
  `selection.override.operator`). At that point the authority graph
  needs to express per-layer planes rather than per-artifact planes.
- A data-plane artifact that legitimately has no meaningful origin token
  in its `trust_boundary` prose (hypothetical; none known at the time of
  writing). If found, the class-conditional rule needs a third option or
  an escape hatch.

## Citations

- ADR-0003 (authority-graph gate) — §Context root cause #3 named this
  gap explicitly.
- `specs/artifacts.md` — authority-graph schema, updated in this slice.
- `scripts/audit.mjs` — audit enforcement, updated in this slice.
- `CLAUDE.md` — methodology pillars; pillar 3 (Architecture-First) drives
  the preference for machine-checkable classifiers over prose.
