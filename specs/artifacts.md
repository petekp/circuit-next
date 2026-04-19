---
doc: artifacts
status: active
version: 2
last_updated: 2026-04-19
---

# Artifacts — the Authority Graph

`specs/artifacts.json` is the **authoritative** authority graph for
circuit-next. This file is the human-readable companion. Where the two
disagree, `artifacts.json` wins; this doc lags until updated.

Read ADR-0003 first. It defines the surface classes, the compatibility
policies, and the gate itself. Read ADR-0004 for the `plane` dimension
(control-plane vs data-plane) introduced in Slice 12, and ADR-0005 for
the v2 promotion of `plane` to a structurally required field with no
deferral allowlist.

## Why this exists

Six Phase 1 contract slices authored normative structure (zod schemas +
prose contracts + contract tests) against artifacts whose relationship to
reality — live Circuit surfaces, external protocols, or nothing at all —
was **not** declared anywhere machine-checkable. `npm run audit` passed
8-green while a structural gap (imagined continuity shape, `record_id`
path-traversal, transitive `.strict()` forgotten) was silently accreting.

The authority graph makes that relationship explicit and the audit makes
it enforced. Contract authorship for any artifact that replaces a live
surface now blocks until the artifact is classified and its live surface
is characterized.

## Surface classes

Every artifact carries exactly one `surface_class` from this closed set
(see ADR-0003 §Five surface classes):

- **greenfield** — invented by circuit-next. No prior live or reference
  surface materially informs it.
- **successor-to-live** — designs a new surface that replaces or
  reinterprets a live Circuit surface. May reject legacy records at
  runtime, but must characterize the live surface first.
- **legacy-compatible** — must directly parse/read/write existing Circuit
  artifacts at runtime. Requires sanitized fixtures + fixture-parity
  tests.
- **migration-source** — existing Circuit artifacts are NOT accepted on
  normal runtime paths, but MAY be consumed by a future importer contract.
- **external-protocol** — shape is constrained by an external API, file,
  or third-party protocol. Characterization is against that external spec.
- **unknown-blocking** — discovery marker. Contracts touching an
  unknown-blocking artifact MAY NOT be drafted.

## Compatibility policies

`compatibility_policy` is orthogonal to class but not independent. Allowed
values:

- `n/a` — only valid for `greenfield` and `external-protocol` classes.
- `clean-break` — successor-to-live with no runtime interop.
- `parse-legacy` — legacy-compatible or migration-source with explicit
  legacy parsing.
- `unknown` — **blocks** contract authorship (used with `unknown-blocking`).

## Plane (ADR-0004, v2 per ADR-0005)

`plane` is a coarse classifier, orthogonal to `surface_class` and
`compatibility_policy`. It names **who produces the artifact**, not
where it lives. At schema version 2, `plane` is structurally required
on every artifact. The v1 `PLANE_DEFERRED_IDS` allowlist was removed
when ADR-0005 classified the three mixed-layer artifacts as
`data-plane` on the worst-case-producer rule.

Values:

- **`control-plane`** — plugin-authored static definition. Loaded
  read-only at bootstrap or catalog-compile time. Never model-authored
  during a run. Never mutated by the engine at runtime.
- **`data-plane`** — operator-local, runtime-produced, engine-computed,
  or model-authored. The heavier defenses data-plane aggregates
  typically need — transitive `.strict()`, own-property closure, and
  path-safety primitives on path-derived identity fields — are
  invariants of their **schema files**, enforced by existing contract
  tests under `tests/contracts/` and by the path-safety audit rule.
  The plane audit rules themselves are narrower; see below.

### Plane audit rules (ADR-0004 + Codex fold-in; ADR-0005 v2)

`scripts/audit.mjs` enforces three class-conditional checks:

1. **Required.** Every artifact MUST declare `plane` from the closed
   set `{control-plane, data-plane}`. No deferral allowlist exists at
   v2; missing-plane is a red finding.
2. **Data-plane trust-boundary detail.** If `plane: data-plane`, the
   `trust_boundary` prose must name at least one **unnegated** origin
   token from the closed set: `operator-local`, `engine-computed`,
   `model-authored`. (`mixed` is *not* an origin token; it describes
   cardinality of origins, which fails the question "who can lie to
   this reader?" on its own.) The audit rejects origin-token matches
   whose immediate left-context contains `not `, `non-`, `no `, or
   `never `, so a prose like "never operator-local; author-signed only"
   does not pass.
3. **Control-plane path-derivation ban.** A `control-plane` artifact
   may not declare non-empty `path_derived_fields`. Plugin-authored
   static content's identity is plugin-author-determined at build time,
   not derived from filesystem path components.

### Plane coverage (v2)

- **control-plane** (4): `workflow.definition`, `step.definition`,
  `phase.definition`, `skill.descriptor`.
- **data-plane** (9): `run.log`, `run.projection`,
  `selection.override`, `selection.resolution`, `adapter.registry`,
  `adapter.reference`, `adapter.resolved`, `continuity.record`,
  `continuity.index`.

ADR-0005 classified `selection.override`, `adapter.registry`, and
`adapter.reference` as data-plane under the worst-case-producer rule:
each has operator-layer writers (user-global, project, invocation)
whose trust boundary is data-plane, and per-layer classification is not
required because the Zod `.strict()` boundary parses every layer
uniformly.

## Required metadata columns

Every artifact row in `specs/artifacts.json` MUST have these base fields:

| Field | Meaning |
|---|---|
| `id` | Dotted artifact name, e.g. `continuity.record`. Unique across the file. |
| `surface_class` | One of the six classes above. |
| `compatibility_policy` | One of the four policies above. |
| `plane` | *(required, v2)* One of `control-plane` or `data-plane`; see ADR-0004 for the dimension, ADR-0005 for v2 promotion. |
| `description` | One-paragraph human description. |
| `contract` | Path to `specs/contracts/*.md`, or `null` if not yet authored. |
| `schema_file` | Path to the zod schema, or `null` if there is no runtime schema. |
| `schema_exports` | Array of exported zod schema names backing this artifact. |
| `writers` | Array of components that produce/modify the artifact. |
| `readers` | Array of components that consume the artifact. |
| `backing_paths` | Array of on-disk path templates where the artifact lives. |
| `identity_fields` | Fields that identify a specific instance. Empty array for singleton artifacts (one-per-project files). |
| `path_derived_fields` | Fields whose value is joined into a filesystem path at parse time. Usually a subset of `identity_fields`, but MAY reference nested paths (e.g. `pending_record.record_id`) when the artifact is a resolver pointing at another artifact's path-derived identity. Dotted notation denotes nested fields. |
| `dangerous_sinks` | Places this artifact reaches that could mis-route, mis-attribute, or escalate if wrong. |
| `trust_boundary` | One-line description of who trusts what about this artifact. |

### Additional fields required for non-greenfield classes

Required for `successor-to-live`, `legacy-compatible`, and
`migration-source`:

| Field | Meaning |
|---|---|
| `reference_surfaces` | Array of named live/reference surfaces this artifact replaces or supersedes (e.g. `legacy-circuit.continuity.record`). |
| `reference_evidence` | Array of paths to characterization docs under `specs/reference/<source>/`. |
| `migration_policy` | Prose: current plan for handling legacy data (deferred, planned-as-migration-source, never). |
| `legacy_parse_policy` | `reject`, `parse`, or `parse-quarantined`. |
| `dangling_reference_policy` | What the runtime does when a referenced record is absent. Closed enum: `n/a` (artifact has no outgoing references), `unknown-blocking` (discovery marker — blocks authorship), `error-at-resolve` (resolver surfaces mismatch as error), `warn` (resolver logs and continues), `allow` (silently drop the dangling reference). Validated by audit. |

The audit enforces these conditionally on class.

## Binding rule

Every `specs/contracts/*.md` MUST include:

```yaml
artifact_ids:
  - <id-1>
  - <id-2>
```

Every referenced id MUST exist in `specs/artifacts.json`. The audit fails
red on violation (ADR-0003 §Machine enforcement).

## Clean break vs greenfield (worked example)

The motivating distinction is `continuity.record`:

```jsonc
{
  "id": "continuity.record",
  "surface_class": "successor-to-live",   // NOT greenfield
  "compatibility_policy": "clean-break",  // NOT parse-legacy
  "description": "circuit-next continuity handoff record. Carries goal, next, state, and debt narrative across session boundaries; identity derived from record_id which is used as a filename stem.",
  "contract": null,                        // not yet drafted — blocked pre-Slice-7
  "schema_file": "src/schemas/continuity.ts",
  "schema_exports": ["ContinuityRecord", "StandaloneContinuity", "RunBackedContinuity"],
  "writers": ["circuit-next engine (handoff save)"],
  "readers": ["circuit-next resume (explicit resume flow)"],
  "resolvers": ["continuity.index"],
  "backing_paths": [
    "<circuit-next-control-plane>/continuity/records/${record_id}.json"
  ],
  "identity_fields": ["record_id"],
  "path_derived_fields": ["record_id"],    // triggers path-safe primitive requirement
  "dangerous_sinks": [
    "filesystem path join",                 // <- the big one
    "resume selection",
    "cross-session narrative authority"
  ],
  "trust_boundary": "operator-local persisted state; may contain model-authored narrative and path-derived identity",
  "reference_surfaces": ["legacy-circuit.continuity.record"],
  "reference_evidence": [
    "specs/reference/legacy-circuit/continuity-characterization.md"
  ],
  "migration_policy": "deferred; no transparent runtime parse of old Circuit records. If imported later, a separate migration-source contract is required.",
  "legacy_parse_policy": "reject",
  "dangling_reference_policy": "unknown-blocking"
}
```

Read the row top-to-bottom:

1. **surface_class: successor-to-live.** A live on-disk continuity surface
   exists today at `~/Code/circuit/.circuit/control-plane/continuity-records/`.
   We are not greenfield. We are designing a replacement.
2. **compatibility_policy: clean-break.** The live shape is reference
   evidence, not a runtime interop requirement. circuit-next refuses to
   parse old Circuit records through normal runtime paths.
3. **contract: null.** `specs/contracts/continuity.md` is not yet drafted.
   Under the gate, drafting it is *unblocked* only when continuity.record
   and continuity.index appear in `artifacts.json` with non-unknown
   compatibility posture — which is what this slice establishes.
4. **path_derived_fields: [record_id].** `record_id` is used as a
   filename stem. `src/schemas/primitives.ts` introduces
   `ControlPlaneFileStem` so this field resists path traversal at parse
   time, not at the filesystem call site.
5. **reference_evidence: [specs/reference/legacy-circuit/continuity-characterization.md].**
   What we observed about the live surface, when we observed it, and the
   explicit clean-break decision. Characterization is required for
   successor-to-live; fixture parity is not.
6. **dangerous_sinks.** The failure modes this artifact can enable:
   filesystem path join (traversal), resume selection (wrong record
   restored), and cross-session narrative authority (stale or hostile
   goal/next text accepted as current intent).

The row is terse, but it's enough for the audit to enforce:
- that the schema file exists and exports the named symbols,
- that the reference_evidence file exists,
- that a path-safe primitive is used for `record_id` (once the contract is
  drafted, the contract frontmatter cites the primitive).

## The 12 initial artifacts

Slice 7 backfills these 12 ids:

| id | class | contract |
|---|---|---|
| `workflow.definition` | greenfield | `specs/contracts/workflow.md` |
| `step.definition` | greenfield | `specs/contracts/step.md` |
| `phase.definition` | greenfield | `specs/contracts/phase.md` |
| `run.log` | greenfield | `specs/contracts/run.md` |
| `run.projection` | greenfield | `specs/contracts/run.md` |
| `selection.override` | greenfield | `specs/contracts/selection.md` |
| `selection.resolution` | greenfield | `specs/contracts/selection.md` |
| `adapter.registry` | greenfield | `specs/contracts/adapter.md` |
| `adapter.reference` | greenfield | `specs/contracts/adapter.md` |
| `adapter.resolved` | greenfield | `specs/contracts/adapter.md` |
| `continuity.record` | successor-to-live | *(blocked pre-Slice-7; unblocked after)* |
| `continuity.index` | successor-to-live | *(blocked pre-Slice-7; unblocked after)* |

Most existing contracts classify as greenfield because their schemas were
authored with no live reference surface behind them (workflow definitions
are plugin-authored YAML; run log is circuit-next's own event shape;
selection and adapter are control-plane inventions). A future audit may
re-classify some of these if live Circuit traffic is actually producing
equivalent artifacts — see ADR-0003 §Reopen conditions.

## How to add a new artifact

1. Pick an `id`. Use dotted notation: `<module>.<role>`. Ids are unique
   forever — no renames under the same class.
2. Decide the `surface_class`. If unsure, use `unknown-blocking`;
   contract authorship will be refused until you resolve it.
3. Fill in the required base fields. If the class is non-greenfield, fill
   in the additional fields AND write a characterization doc under
   `specs/reference/<source>/`.
4. Bind the new id to a contract via `artifact_ids:` frontmatter.
5. Run `npm run audit`. Green means the graph is internally consistent
   and the contract is allowed to author.

## What the audit enforces

See `scripts/audit.mjs` for the full list. Summary:

- **Shape** — `specs/artifacts.json` present, valid, no duplicate ids,
  all `surface_class` / `compatibility_policy` values from the closed
  set.
- **Base fields** — every artifact has the required metadata columns.
- **Class-conditional fields** — `successor-to-live`, `legacy-compatible`,
  and `migration-source` artifacts have `reference_surfaces`,
  `reference_evidence`, `migration_policy`, `legacy_parse_policy`, and
  `compatibility_policy != unknown`.
- **Binding** — every `specs/contracts/*.md` has `artifact_ids` and every
  referenced id exists in the graph.
- **Path safety** — every `path_derived_fields` entry is documented as
  using a path-safe primitive (e.g. `ControlPlaneFileStem`).
- **Phase drift** — `README.md` and `PROJECT_STATE.md` agree on the
  current phase.
- **Continuity gate** — `specs/contracts/continuity.md` cannot exist
  until `continuity.record` and `continuity.index` are present in the
  graph with non-unknown compatibility posture.
- **Plane required (ADR-0004, v2 per ADR-0005)** — every artifact MUST
  declare `plane` from the closed set `{control-plane, data-plane}`.
  Missing-plane is a red finding with no deferral allowlist.
- **Plane trust-boundary detail (ADR-0004)** — if an artifact declares
  `plane: data-plane`, its `trust_boundary` prose must name at least one
  unnegated origin token from `{operator-local, engine-computed,
  model-authored}`. Control-plane artifacts have no additional
  trust-boundary requirement but cannot declare non-empty
  `path_derived_fields` (path-derivation ban).

`tests/contracts/artifact-authority.test.ts` asserts the same invariants
at `npm run test` time so the feedback loop is fast.

## Evolution

This schema version is 2. Schema-breaking additions (new required
columns, new class values, new policy values) bump the version and
require an ADR. Non-breaking additions (new optional columns, new ids)
do not.

Version history:

- **v1 (ADR-0003)** — authority graph established; surface classes,
  compatibility policies, and binding rule introduced.
- **v1+ slice 12 (ADR-0004)** — `plane` dimension added as optional;
  10 of 13 artifacts backfilled; three mixed-layer artifacts deferred
  via `PLANE_DEFERRED_IDS`.
- **v2 (ADR-0005)** — `plane` promoted to required; the three deferred
  artifacts classified as `data-plane`; `PLANE_DEFERRED_IDS` removed.
