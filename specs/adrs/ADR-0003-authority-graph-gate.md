---
adr: 0003
title: Authority-Graph Gate and Compatibility Posture
status: Accepted
date: 2026-04-19
author: operator
supersedes: none
related: ADR-0001, ADR-0002
---

# ADR-0003 — Authority-Graph Gate and Compatibility Posture

## Context

The methodology (ADR-0001, `specs/methodology/decision.md`, `CLAUDE.md` pillar
1) treats **Contract-First** as its core: "truth lives in executable specs +
property tests authored before implementation." Six Phase 1 contract slices
consumed this absolutely. They produced 252 passing tests, `tsc --strict`
clean, biome clean, and an 8-green drift audit. Quality signals looked high.

A pre-authoring adversarial review on the then-upcoming continuity contract
surfaced a structural failure mode the existing discipline did not catch:

> Contract authorship proceeded from imagined shapes. Several existing
> schemas (continuity, `record_id`, transitive `.strict()` on aggregates) had
> structural gaps that would have shipped as normative contracts if the
> continuity slice had executed on the published plan.

Self-audit identified six recurring themes; a narrow cross-model challenger
(Codex) collapsed them to three root causes:

1. **Invention-before-extraction** — the agent drafted normative structure
   without first characterizing the live reference surface or declaring that
   no such reference existed.
2. **Ceremony-without-enforcement** — lane declarations, framing triplets,
   and citation rules are markdown discipline; nothing **fails the build**
   when they are applied to an artifact that has no grounding in live or
   reference evidence.
3. **Control-plane / data-plane confusion** — the existing contracts bind
   runtime schemas to on-disk artifacts without making the authority
   relationship between a contract, its schema file, its on-disk path, its
   writer, its reader, and its resolver explicit or machine-checkable.

The naive fix — "always extract live behavior first" — fails on a rewrite.
`circuit-next` is from-scratch (CLAUDE.md: "previous-generation Circuit is
read-only reference"; `specs/risks.md` records the reference-contamination
risk). Forcing fixture parity with live old Circuit artifacts would re-admit
accidental shape as normative and violate ADR-0002's citation rule.

The opposite reaction — "mark everything greenfield because the rewrite is
clean-break" — is exactly what allowed the original failure. Continuity is
not greenfield. There is a live on-disk surface today at
`~/Code/circuit/.circuit/control-plane/` that circuit-next will replace.
Pretending the live surface does not exist re-enables the imagine-and-draft
pattern.

The correct category is neither. This ADR introduces it.

## Decision

We adopt an **Authority-Graph Gate** as a first-class pre-condition for
contract authorship in circuit-next. The gate machine-enforces classification
of every artifact a contract governs **before** the contract can be
authored.

### Five surface classes + one discovery marker

Every artifact declared in `specs/artifacts.json` MUST carry exactly one
`surface_class` from the following closed set:

| Class | When to use |
|---|---|
| **greenfield** | No existing live or reference runtime surface materially informs this artifact. The artifact is invented by circuit-next. |
| **successor-to-live** | circuit-next is designing a new surface that replaces or reinterprets a live Circuit surface, but direct runtime compatibility is not required. The live surface must be characterized; the new surface may reject legacy records at runtime. |
| **legacy-compatible** | circuit-next must directly parse, read, or write existing Circuit artifacts at runtime. Fixture parity and differential tests are required. |
| **migration-source** | Existing Circuit artifacts are NOT accepted by normal runtime paths, but MAY be consumed by a future explicit migration/import tool. The importer is a separate contract; it does not live inside the runtime schema. |
| **external-protocol** | Shape is constrained by an external API, file format, or third-party protocol. Characterization is against the external spec, not live Circuit. |
| **unknown-blocking** | (Discovery marker) The relationship to prior, live, or external reality is unknown. Contracts touching this artifact MAY NOT be drafted until the class is resolved. |

### Clean break is not greenfield

We explicitly reject the false binary "clean break = greenfield".

A **successor-to-live** surface may reject legacy runtime compatibility
outright, but it must still record:

- which live or reference surface it supersedes,
- when that surface was characterized,
- the observed top-level shape of the live surface at that date,
- the explicit decision that direct runtime compatibility is out of scope,
- the migration policy (deferred, planned-as-migration-source, or never).

This keeps the discipline honest. It prevents the agent from pretending a
surface is greenfield in order to skip extraction work.

### Contract-First is conditional

The Contract-First pillar (ADR-0001, CLAUDE.md pillar 1) previously read as
absolute: truth lives in specs authored before implementation. This slice
narrows it:

- **Greenfield surfaces.** Contract-First applies as written. Authorship
  proceeds against the absent prior art.
- **successor-to-live, legacy-compatible, migration-source,
  external-protocol surfaces.** Contract authorship is **blocked** until the
  artifact authority graph is enumerated in `specs/artifacts.json` and any
  class-specific preconditions are met:
  - **legacy-compatible:** representative sanitized fixtures committed under
    `tests/fixtures/reference/legacy-circuit/` AND fixture-parity tests
    registered.
  - **successor-to-live:** compatibility posture declared
    (`compatibility_policy`, `legacy_parse_policy`, `migration_policy`) AND
    reference characterization committed under
    `specs/reference/legacy-circuit/`.
  - **migration-source:** importer/migration contract drafted separately;
    runtime admission paths MUST NOT accept these artifacts without
    explicit discrimination.
  - **external-protocol:** the external spec is cited; observed divergence
    between the spec and real traffic is recorded before contract
    authorship.

### Machine enforcement, not markdown discipline

Authority-graph classification is **not** a new piece of prose in each
contract's frontmatter that a careful reviewer is supposed to notice. It is:

1. A machine-readable `specs/artifacts.json` file defining the artifact
   authority graph (schema in `specs/artifacts.md`).
2. An `artifact_ids: []` frontmatter key on every contract in
   `specs/contracts/` binding the contract to one or more artifacts in the
   graph.
3. `scripts/audit.mjs` **fails red** on:
   - missing or invalid `specs/artifacts.json`,
   - duplicate artifact ids,
   - unknown `surface_class` or `compatibility_policy`,
   - any contract lacking `artifact_ids` frontmatter,
   - any contract citing an artifact not in the graph,
   - any referenced artifact missing required base fields,
   - any `successor-to-live` artifact missing `reference_surfaces`,
     `reference_evidence`, `migration_policy`, or `legacy_parse_policy`, or
     having `compatibility_policy=unknown`,
   - any `legacy-compatible` artifact without committed fixture paths and
     fixture-parity test registration,
   - any artifact with `path_derived_fields` where those fields are not
     documented as using a path-safe primitive,
   - any disagreement between `README.md` and `PROJECT_STATE.md` on current
     phase,
   - any `specs/contracts/continuity.md` appearing before `continuity.record`
     and `continuity.index` are present in `specs/artifacts.json` with
     non-unknown compatibility posture.

4. `tests/contracts/artifact-authority.test.ts` asserts the same invariants
   locally, so a developer sees the failure at `npm run test` rather than at
   `npm run audit`.

This is intentionally redundant. Tests give local proof; the audit gives
workflow enforcement at commit boundaries.

### Challenger downgrade

ADR-0001 and CLAUDE.md previously framed the narrow cross-model challenger
as "one Swiss-cheese layer (Knight & Leveson 1986 correlation applies)".
That framing quietly implies some diversity-of-failure protection. It
should not.

Claude and Codex share training distribution, training recipe family, and
post-training alignment pressure. Knight & Leveson's 1986 result shows that
independently-developed implementations of the same specification produce
**correlated** failures — not independent ones. Applying that result to
two LLMs with shared provenance is a strong *negative* signal, not a Swiss
cheese layer.

The honest framing is:

> The cross-model challenger is **adversarial lint**, not independent
> corroboration. It catches a subset of local reasoning errors the primary
> model would have missed under its default sampling, but it cannot
> substitute for authority mapping, live or reference evidence, fixture
> parity where compatibility is required, differential tests, state-machine
> tests, or migration rehearsal.

CLAUDE.md pillar 4 is updated to match in this slice.

### Continuity is successor-to-live, clean-break

The motivating artifact — continuity — resolves to:

- `continuity.record` → `surface_class: successor-to-live`,
  `compatibility_policy: clean-break`,
  `legacy_parse_policy: reject`,
  `migration_policy: deferred; no transparent runtime parse of old Circuit
  records`.
- `continuity.index` → same posture.

circuit-next will **not** directly parse old Circuit continuity records
through normal runtime paths. Old Circuit continuity is reference evidence
and a possible future migration-source input, not a runtime compatibility
requirement. The reference characterization lives at
`specs/reference/legacy-circuit/continuity-characterization.md`.

This slice does **not** draft `specs/contracts/continuity.md`. That is
deferred to the next slice, now unblocked under the gate.

## Consequences

### Immediate (this slice)

- `specs/adrs/ADR-0003-authority-graph-gate.md` (this file).
- `specs/artifacts.json` + `specs/artifacts.md` with 12 artifact ids
  backfilled for existing contracts and the two continuity surfaces.
- `src/schemas/primitives.ts` introducing `ControlPlaneFileStem` for
  path-derived identity fields.
- `artifact_ids: []` frontmatter on all six existing Phase 1 contracts.
- `scripts/audit.mjs` authority-graph dimension + README/PROJECT_STATE
  phase-drift check.
- `specs/reference/legacy-circuit/` with `continuity-characterization.md`
  based on live inspection.
- `tests/contracts/primitives.test.ts` and
  `tests/contracts/artifact-authority.test.ts`.
- `CLAUDE.md` methodology patch (Contract-First conditional, challenger as
  adversarial lint).
- `README.md` + `PROJECT_STATE.md` phase-consistency fix + 252-test
  rigor qualification.

### Going forward

- No contract may be drafted for an artifact classified `unknown-blocking`.
- No `specs/contracts/continuity.md` may be committed until both
  `continuity.record` and `continuity.index` carry non-unknown
  `compatibility_policy` in `specs/artifacts.json` (enforced by audit).
- The Phase 2 property harness, when landed, cites `property_ids` that bind
  to `artifact_ids` through the authority graph. The graph is the canonical
  join key between normative prose (contract), executable schema (zod), and
  runtime artifact (on-disk shape).
- Future `ObservedContinuityRecord` / `ObservedContinuityIndex` style
  schemas are **not** authored in this slice. They are only appropriate
  under `legacy-compatible` or `migration-source`, which are operator
  decisions, not agent defaults.

### Relationship to prior ADRs

- **ADR-0001** (methodology adoption). This ADR narrows pillar 1
  (Contract-First) and rewords pillar 4 (challenger). It does not reopen
  the tournament decision or the stress-test survival record.
- **ADR-0002** (bootstrap discipline). This ADR is compatible with ADR-0002
  and reinforces it: the authority-graph gate is the machine-enforced
  counterpart to ADR-0002's markdown-level citation rule and
  Circuit-as-justification smell audit. Neither ADR admits live Circuit
  behavior as a justification for circuit-next design; the gate adds
  mandatory explicit classification instead.

### Reopen conditions

- A slice executes under `unknown-blocking` and the class resolution
  reveals an artifact whose authority graph cannot be expressed in the
  current schema (missing metadata columns).
- Evidence emerges that two independently-trained models (different
  training distribution, post-training process, and alignment regime)
  DO produce usefully diverse failures on circuit-next contracts,
  requiring the challenger to be re-promoted.
- A future operator decision reclassifies continuity to `legacy-compatible`
  or `migration-source`, at which point fixture parity tests and a split
  Observed/Normalized schema become required.

## Citations

- Knight, J. C., & Leveson, N. G. (1986). An experimental evaluation of the
  assumption of independence in multiversion programming. IEEE TSE.
- `specs/methodology/decision.md` — tournament methodology.
- `specs/risks.md` — reference-contamination risk, pre-recorded.
- `specs/evidence.md` — Phase 0 synthesis.
- `CLAUDE.md` — methodology pillars (patched in this slice).
- ADR-0001, ADR-0002.

## Addendum A — Omitted-artifact reopen trigger (Slice 23, 2026-04-19)

### Context

The Phase 1 close retrospective (`specs/reviews/arc-phase-1-close-codex.md`,
MED #15) found that the original Reopen conditions above miss a class of
drift: a schema export, backing path, or runtime writer/reader can land in
`src/schemas/` (or in runtime code) **without** a corresponding artifact id
in `specs/artifacts.json`, and the gate stays green because every artifact
that *does* exist is classified. The named instance is `config.ts`: the
`Config / ConfigLayer / LayeredConfig / CircuitOverride` schemas were
absorbed into `adapter.registry.schema_exports` during Slice 7, and no
`config.*` artifact row was ever added. Both Claude and Codex missed this
during the full-arc review — a Knight-Leveson correlated miss under shared
training distribution, exactly the failure mode ADR-0003's challenger
downgrade section warned about.

The forward-only gate (artifact → classified → reference/migration fields →
schema-export existence) cannot catch this class because it only validates
artifacts that are present. The omission is invisible until someone reads
the authority graph and notices a schema file, a backing path, or a
reader/writer invocation with no artifact attached.

### Addendum

The Reopen conditions of this ADR are extended with one additional
trigger:

> **An unbound surface appears.** Any of the following, observed in the
> working tree or in a commit diff:
> - a file in `src/schemas/` (excluding `index.ts`) that is neither
>   referenced as some artifact's `schema_file` nor present in the
>   `SCHEMA_FILE_ALLOWLIST` declared in `scripts/audit.mjs`;
> - an `export const <Name>` in a schema file bound to an artifact, where
>   `<Name>` is not claimed by any artifact's `schema_exports`;
> - an on-disk `backing_paths` entry, a writer, or a reader named by
>   runtime code or documentation that does not resolve to an existing
>   artifact id.
>
> When any of these surfaces, the authority graph gate reopens: the slice
> touching the surface MUST classify it (new artifact row, extension of an
> existing artifact's `schema_exports`/`writers`/`readers`/`backing_paths`,
> or explicit addition to `SCHEMA_FILE_ALLOWLIST` with a category and
> reason) before the slice may commit in a Ratchet-Advance lane.

### Enforcement

Machine enforcement lands in Slice 23 and is redundant with the per-test
local proof already in place (ADR-0003 "Machine enforcement, not markdown
discipline"):

1. `scripts/audit.mjs` authority-graph dimension now runs:
   - **Reverse reciprocation check.** For every artifact with a non-null
     `contract`, the contract file must exist and its frontmatter
     `artifact_ids` list must include the artifact's id.
   - **Schema-export coverage ledger.** Every non-`index.ts` file in
     `src/schemas/` must be either referenced by an artifact's
     `schema_file` or allowlisted. Every `export const <Name>` in an
     artifact-bound file must be claimed by that artifact's
     `schema_exports` (with `_`-prefixed compile-time parity guards
     excluded, since they are not runtime schema surfaces).

2. `tests/contracts/artifact-authority.test.ts` asserts the same invariants
   locally so failures surface at `npm run test` before `npm run audit`.

Backing-paths / writers / readers are not yet machine-enforced at Slice 23.
The addendum reopen trigger still applies to them as a prose rule; a future
slice may lift them to audit checks once a canonical "runtime surface
inventory" source of truth lands (tracked: Slice 30, event-writer boundary
contract — HIGH #7 in the arc review).

### Manual recognition checklist (v0.1, pre-Slice-30)

Until Slice 30 lands a machine-enforced runtime surface inventory, any
slice that touches runtime writers, readers, or backing paths MUST run
through this checklist in the commit body or slice review record. The
checklist is a temporary v0.1 compensating control for the prose-only
scope of the reopen trigger (Codex MED #10 fold-in, Slice 23):

- [ ] **Backing paths.** For every on-disk path the slice writes, reads,
      or creates (events.ndjson, state.json, continuity records, config
      files, etc.), confirm that the path appears in some artifact's
      `backing_paths` list. New path → new artifact row or extended
      existing one.
- [ ] **Writers.** For every function, module, or command introduced
      that appends, mutates, or emits to a backing path, confirm that
      the writer is named in some artifact's `writers` list.
- [ ] **Readers.** For every parser, projector, or consumer that reads
      a backing path, confirm that the reader is named in some
      artifact's `readers` list.
- [ ] **Cross-artifact resolvers.** For every module that derives a
      resolved form of one artifact from another (e.g. resolving
      `selection.override` to `selection.resolution`), confirm the
      source artifact lists the resolver in its `resolvers` array and
      the target resolver artifact exists.
- [ ] **Plane consistency.** For every new or extended backing path,
      confirm the owning artifact's `plane` classification matches the
      path's origin (control-plane for plugin-authored static content;
      data-plane for engine-written, operator-written, or
      model-authored state).

Slice 30's scope (HIGH #7, event-writer boundary contract) includes
promoting each of the above from manual checklist to audit rule; the
checklist is explicitly expected to be retired when that slice lands.
Continued prose-only status after Slice 30 would itself reopen this
addendum.

### Relationship to the Slice 26 (HIGH #3) fold-in

Addendum A is the general rule; Slice 26 is the specific remediation for
the named miss. Landing Addendum A in Slice 23 means Slice 26 begins with
the reopen trigger already active: when Slice 26 adds `config.*` artifact
row(s) and `specs/contracts/config.md`, the enforcement machinery catches
any regression (e.g. a future refactor that re-absorbs config schemas
under a non-config artifact). Removing `src/schemas/config.ts` from
`SCHEMA_FILE_ALLOWLIST` is an expected byproduct of Slice 26.

### Scope not widened

The addendum does not change the five surface classes, the gate semantics,
the challenger framing, or the migration posture of any existing artifact.
It only extends what counts as a reopen event. A full reclassification of
continuity, adapter, or any other artifact is out of scope; that requires
a superseding ADR.

## Addendum B — Persisted-shape binding integrity (Slice 26a, 2026-04-20)

### Context

A rotating arc-progress adversarial pass (`specs/reviews/arc-progress-codex.md`,
HIGH #1) surfaced a new correlated-miss class that neither the forward-only
gate nor Addendum A's unbound-surface trigger catches:

> `specs/artifacts.json:run.projection` was correctly classified
> (`surface_class: greenfield`), reciprocated by `specs/contracts/run.md`,
> bound to `src/schemas/run.ts` as its schema file, and claimed
> `RunProjection` in `schema_exports`. It also declared
> `backing_paths: ["<circuit-next-run-root>/state.json (derived snapshot)"]`.
> Every authority-graph dimension the gate checks was satisfied. Yet the
> binding was structurally wrong: `RunProjection = z.object({ log, snapshot })`
> is an in-memory aggregate; the bytes actually written to `state.json` carry
> only the `Snapshot` leaf, not the aggregate. `src/schemas/snapshot.ts` was
> allowlisted as a `shared-primitive` with the reason "snapshot shape
> embedded in run.projection" — which encoded the incorrect binding into the
> audit allowlist itself.

This is distinct from Addendum A's failure mode. Addendum A catches the
case where a schema export, file, backing path, writer, or reader has **no**
artifact attached. Addendum B catches the case where the artifact **exists
and is green** but names the wrong persisted shape because the claimed
`schema_exports` entry is a wrapper aggregate whose leaves live in distinct
artifacts.

Both Claude and Codex missed this during the Phase 1 close review — a
second Knight-Leveson correlated miss in the same class the ADR-0003 Decision
warned about, one step deeper than Addendum A.

### Addendum

The Reopen conditions of this ADR are extended with one additional
trigger, defined semantically and enforced by a named allowlist.

**Definition.** A **multi-leaf persisted-shape wrapper aggregate** is a
schema export that (a) has two or more fields that are themselves bound
to distinct, non-trivial schema exports in `src/schemas/`, AND (b) whose
fields persist as separate files governed by separate artifact rows in
`specs/artifacts.json`. The paradigm case is
`RunProjection = { log: RunLog, snapshot: Snapshot }`: the two fields
persist to distinct paths (`events.ndjson`, `state.json`) governed by
distinct artifacts (`run.log`, `run.snapshot`).

Multi-field schemas whose fields are structural parts of a single
manifest or carrier — e.g. `Workflow` (phases/steps are not independent
artifact-bound persisted files), `LayeredConfig` (one `Config` leaf plus
layer metadata; not a multi-leaf aggregate by this definition) — do NOT
qualify and are out of scope.

**Trigger.** When an artifact row in `specs/artifacts.json` declares a
non-empty `backing_paths` AND its `schema_exports` list includes a schema
export that meets the definition above, the binding is structurally
unsound: the bytes on disk can carry at most one leaf, not the aggregate.
The authority-graph gate reopens; the slice touching the binding MUST
split the artifact so that each persisted path binds to the exact schema
that describes its bytes, leaving the aggregate as an in-memory derivation
with an empty `backing_paths`.

**Enforcement model.** Slice 26a does NOT ship a structural body/AST
detector. It ships a **named allowlist** (`WRAPPER_AGGREGATE_EXPORTS` in
`scripts/audit.mjs`) that enumerates the wrapper aggregates known today
(currently just `RunProjection`). The audit check flags any artifact that
claims an allowlisted export while declaring a non-empty `backing_paths`.
A structural detector is out of scope until a future slice demonstrates
it is worth the fragility cost (AST parsing of Zod `const Body =
z.object(...); export const X = Body.superRefine(...)` patterns is
non-trivial and brittle). Until then, drift is prevented by discipline
on the allowlist, not by traversal of schema bodies.

### Enforcement

Slice 26a lands the following enforcement surfaces:

1. `scripts/audit.mjs` exports `WRAPPER_AGGREGATE_EXPORTS` (the
   authoritative allowlist of known multi-leaf persisted-shape wrapper
   aggregates, currently `{ RunProjection }`),
   `detectWrapperAggregateBinding(artifact)` (pure per-artifact helper),
   and `checkPersistedWrapperBinding()` (full-file audit check, wired in
   as Check 16).
2. `tests/contracts/artifact-authority.test.ts` asserts (a) the specific
   split for the named miss — `run.snapshot` exists, binds `Snapshot` to
   `state.json`, owns `src/schemas/snapshot.ts`, and `run.projection`
   carries an empty `backing_paths`; (b) `src/schemas/snapshot.ts` is no
   longer in `SCHEMA_FILE_ALLOWLIST`; (c) `specs/contracts/run.md` binds
   `run.snapshot` in its `artifact_ids` frontmatter; (d) the general
   guard accepts/rejects constructed fixtures; (e) the full-file check is
   green on the current authority graph; and (f) a constructed red-fixture
   artifacts.json (bad `RunProjection` + persisted path) drives the full-
   file check to `level === 'red'`, so a regression that inerts the check
   cannot pass silently.

When a new schema that meets the definition above is introduced in
`src/schemas/`, the slice that introduces it MUST extend
`WRAPPER_AGGREGATE_EXPORTS` with a reason that references this addendum.
Landing a qualifying aggregate with a persisted `backing_paths` and
without an allowlist entry is itself a reopen event for this addendum.

### `LayeredConfig` candidacy note (recorded, out-of-scope)

`LayeredConfig` wraps one `Config` with layer metadata and declares a
prose-sentinel `backing_paths` ("in-memory wrapper around config.root (no
standalone on-disk form)"). A literal reading of the Addendum B trigger
could be tempted to flag this row, but `LayeredConfig` does NOT meet the
multi-leaf definition above: its only artifact-bound leaf is `Config`
(itself the `config.root` artifact's schema); `layer` and `source_path`
are metadata fields, not independent persisted artifacts. Slice 26a does
not add `LayeredConfig` to `WRAPPER_AGGREGATE_EXPORTS`. If a future slice
normalizes the prose-sentinel `backing_paths` to an empty array (aligned
with the Slice 26a treatment of `run.projection`), the question can be
revisited then. Recorded here so the absence is an explicit decision, not
an oversight.

### Relationship to the Slice 27c runtime-boundary slice

Addendum B is the structural rule at the authority-graph layer. Slice 27c
(Runtime Boundary Before Dogfood, per
`specs/plans/phase-1-close-revised.md`) lands the complementary runtime
enforcement: the reducer-derived snapshot writer, the byte-match manifest
gate, and the acceptance that `state.json` parses as `Snapshot`, not
`RunProjection`. Together they close the class: Addendum B prevents the
authority graph from lying about where the bytes live; Slice 27c prevents
the runtime from writing bytes that disagree with the authority graph.

### Scope not widened

Addendum B does not change the five surface classes, the gate semantics,
the challenger framing, or the migration posture of any existing artifact.
It only extends what counts as a reopen event. Full reclassification of
any other artifact is out of scope and requires a superseding ADR.

## Addendum C — Contract-shaped plan payload (Slice 57, 2026-04-23)

### Context

On 2026-04-23, Claude drafted `specs/plans/p2-9-second-workflow.md`
(700 lines, untracked) under operator direction. The plan's Slice 57-58
block proposed normative declarations that ADR-0003 §Decision.Contract-
First-is-conditional would have blocked at `specs/contracts/review.md`
authorship time: artifact ids (`review.scope`, `review.report`,
`review.verification`, `review.result`), REVIEW-I1 invariant text,
4-phase canonical spine, CLI invocation shape (`--scope`), and runtime
compatibility posture — all declared in the plan payload, none yet in
a `specs/contracts/*.md` file.

The plan was caught by a Codex challenger pass (13 findings, persisted
at `specs/reviews/p2-9-plan-draft-content-challenger.md`), but only
after the operator manually requested the pass. The per-slice
challenger protocol (CLAUDE.md §Hard-invariants #6) fires at slice
execution time; the arc-close composition review (CLAUDE.md §Cross-
slice-composition-review-cadence) fires after arc closes. Neither
fires at **plan-authoring time** — the moment when operator is asked
to sign off on a multi-slice scope carrying contract-shaped payload.

ADR-0003 §Decision.Contract-First-is-conditional blocks
`specs/contracts/*.md` authorship for `successor-to-live`,
`legacy-compatible`, `migration-source`, or `external-protocol`
surfaces until classification + characterization land. The P2.9 draft
evaded this intent by staying in the plan layer — no
`specs/contracts/review.md` file, but a plan body declaring the exact
normative payload the contract would carry. The gate's invention-
before-extraction prohibition did not reach into plan authorship.

### Addendum

The Authority-Graph Gate's §Contract-First-is-conditional scope is
extended to cover **contract-shaped plan payload**. A plan
(`specs/plans/*.md`) authoring a multi-slice arc touching a
`successor-to-live`, `legacy-compatible`, `migration-source`, or
`external-protocol` surface MAY NOT declare as normative deliverables
any of the following, until a characterization slice has landed first
(either in the same arc or in a prior committed state):

- Artifact ids for the target surface's runtime artifacts.
- Invariant text (`FOO-I1`, `BAR-I2`, etc.) for the target surface.
- Verdict vocabulary or state machines specific to the target surface.
- CLI invocation shape (specific flag names, argument positions).
- Runtime compatibility posture (clean-break vs legacy-compatible
  claims on the new surface).

Before characterization lands, these details MAY appear in plan
payload only when:

- marked `hypothesis:` in the plan's YAML frontmatter or body, AND
- flagged `inferred` or `unknown-blocking` in the plan's §Evidence
  census (per ADR-0010 §Decision.3).

A plan schedules a characterization slice as the arc's first
execution slice, producing:

- `specs/reference/<source>/<target>-characterization.md` (the live
  read of the reference surface).
- `specs/artifacts.json` rows for the target's artifacts with full
  surface_class + compatibility_policy + reference_evidence fields.

Only after the characterization slice commits may subsequent slices
draft normative payload. Prior to that commit, normative payload in
the plan itself is gate-blocked — the same way
`specs/contracts/<target>.md` authorship is gate-blocked under the
main Decision block.

### Enforcement

Machine enforcement is distributed across multiple plan-lint rules,
each catching a different slice of the contract-shaped-payload
pattern:

1. **Rule #9 (`plan-lint.contract-shaped-payload-without-
   characterization`)** — primary gate. Scans plan body for
   successor-to-live indicators (`successor-to-live` literal,
   `~/Code/circuit/` references, `specs/reference/` citations)
   combined with contract-shaped payload indicators (`artifact_ids:`
   lists, `[A-Z]+-I\d+` invariant definitions, CLI flag invocations).
   Fires red if both present AND no characterization slice scheduled
   first. Current rule text focuses on `successor-to-live`; future
   tightening (per Reopen conditions) may extend to the full
   surface-class set (`legacy-compatible`, `migration-source`,
   `external-protocol`).
2. **Companion rules**:
   - Rule #18 (`plan-lint.canonical-phase-set-maps-to-schema-vocabulary`)
     catches phase-set declarations that don't map to schema-valid
     canonicals.
   - Rule #14 (`plan-lint.artifact-cardinality-mapped-to-reference`)
     catches artifact count overreach for successor-to-live surfaces.
   - Rule #13 (`plan-lint.cli-invocation-shape-matches`) catches CLI
     flag invention.
   - Rule #21 (`plan-lint.artifact-materialization-uses-registered-
     schema`) catches materialization-shape assumptions beyond
     current schema registry.
3. If contract-shaped payload is present AND successor-to-live
   indicator is present AND no §Characterization section /
   `specs/reference/` output is scheduled as the arc's first slice,
   rule #9 fires red; companion rules fire on additional facets
   of the same failure class.

Audit Check 36 (landed at Slice 58) runs plan-lint on all committed
`specs/plans/*.md` so the gate enforces at commit boundary.

### Reopen conditions

- A plan authored under this Addendum demonstrates a class of
  contract-shaped payload the rule's scanner misses (e.g., a new
  form of invariant declaration not matching `[A-Z]+-I\d+`, or a
  CLI invocation pattern not using `npm run circuit:run`). The
  reopen is an audit of the rule's patterns against the new form.
- A plan correctly declares hypothesis-flagged payload and the
  hypothesis becomes load-bearing (operator signs off on a plan with
  hypothetical declarations without challenger-clearing the
  hypothesis). The reopen tightens hypothesis-vs-decided distinction
  per plan-lint rule #10.

### Scope not widened

Addendum C does not change the five surface classes, the gate's
classification vocabulary, the challenger framing, or the migration
posture of any existing artifact. It only extends the gate's scope
from `specs/contracts/*.md` authorship to include `specs/plans/*.md`
contract-shaped payload. Legacy plans (those whose first-committed
SHA is a strict ancestor of `META_ARC_FIRST_COMMIT` per ADR-0010
§Migration) are fully exempt from all 22 plan-lint rules; normative
payload already in legacy plans is not retroactively invalidated.
