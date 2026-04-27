---
doc: continuity-characterization
status: active
capture_date: 2026-04-19
characterized_by: operator + claude-opus-4-7
source: live old-Circuit state on disk at ~/Code/circuit
authority: reference only; NOT runtime compatibility
---

# Legacy Circuit — Continuity Characterization

This document characterizes the live on-disk continuity surface of
first-generation Circuit as observed on **2026-04-19**. It exists to
prevent blind design of the circuit-next continuity surface (per ADR-0003
`successor-to-live` classification).

It is **reference evidence**, not a compatibility requirement.
circuit-next will **not** parse old Circuit continuity records through
normal runtime paths (`legacy_parse_policy: reject` in
`specs/artifacts.json`).

## Source path patterns inspected

```
~/Code/circuit/.circuit/control-plane/continuity-records/*.json
~/Code/circuit/.circuit/control-plane/continuity-index.json
```

Five record files were inspected (sizes ~3.5kB–5.2kB each). The index was
observed in both the null-filled idle state and (historically) attached
state; we reference the null-filled state as the canonical empty shape.

## Sanitized fixtures committed?

**No.** Fixtures under `tests/fixtures/reference/legacy-circuit/` are **not**
committed in this slice. Reason: the live records contain model-authored
operator narrative (goals, decisions, constraints, blocked items) that is
project-specific to old Circuit's development and was not reviewed for
sanitization. Characterization is sufficient for `successor-to-live` per
ADR-0003; fixture parity is only required for `legacy-compatible`.

If fixture-level evidence is needed later, they would land under:

```
tests/fixtures/reference/legacy-circuit/continuity/
```

…with a separate sanitization pass.

## Redactions applied

None (nothing committed). In-text, the `record_id` values and `run_slug`
values below are **live** ids from the observed files; they are not
sensitive but are preserved verbatim for accuracy.

## Observed top-level keys — continuity record

The old Circuit continuity record is a flat JSON object with these
top-level keys:

| Key | Type | Observed values / notes |
|---|---|---|
| `created_at` | ISO 8601 string | e.g. `"2026-04-16T19:57:52.564Z"` |
| `git` | object | `{cwd, branch, head, base_commit}`; `branch` and `head` optional; `base_commit` optional |
| `narrative` | object | `{goal, next, state_markdown, debt_markdown}`; all four are required non-empty strings |
| `project_root` | string | absolute path, e.g. `"/Users/petepetrash/Code/circuit"` |
| `record_id` | string | UUID-suffixed: `"continuity-{uuid}"` (e.g. `"continuity-19ee6b12-e0f6-4a67-a225-9cb93c6fa5b1"`) |
| `resume_contract` | object | `{auto_resume: boolean, mode: "resume_run" \| "resume_standalone", requires_explicit_resume: boolean}` |
| `run_ref` | object \| null | present with shape below when `mode="resume_run"`; null when `mode="resume_standalone"` |
| `schema_version` | **string** `"1"` | **NOT a number**; old Circuit uses string literal `"1"` |

### `run_ref` shape (when present)

| Key | Type | Notes |
|---|---|---|
| `current_step_at_save` | string | e.g. `"frame"`, `"fix"`, `"review"` |
| `manifest_present` | boolean | whether a circuit.manifest.yaml was present at save time |
| `run_root_rel` | string | path relative to project root, e.g. `".circuit/circuit-runs/<slug>"` |
| `run_slug` | string | kebab-case task slug, derived from task prose |
| `runtime_status_at_save` | string | e.g. `"in_progress"` |
| `runtime_updated_at_at_save` | ISO 8601 string | last update timestamp for the attached run |

## Observed top-level keys — continuity index

The old Circuit continuity index (`continuity-index.json`) is a flat
JSON object with these top-level keys:

| Key | Type | Notes |
|---|---|---|
| `current_run` | object \| null | present when a run is attached; null when idle |
| `pending_record` | object \| null | present when a continuity record is pending resume; null when clean |
| `project_root` | string | absolute path |
| `schema_version` | **string** `"1"` | same string-literal as the record |

### `current_run` shape (when present)

| Key | Type | Notes |
|---|---|---|
| `attached_at` | ISO 8601 string | |
| `current_step` | string | |
| `last_validated_at` | ISO 8601 string | |
| `manifest_present` | boolean | |
| `run_root_rel` | string | |
| `run_slug` | string | |
| `runtime_status` | string | |

### `pending_record` shape (when present)

| Key | Type | Notes |
|---|---|---|
| `continuity_kind` | string | e.g. `"run_ref"`, `"standalone"` |
| `created_at` | ISO 8601 string | |
| `payload_rel` | string | path relative to project root, e.g. `".circuit/control-plane/continuity-records/<id>.json"` |
| `record_id` | string | UUID-suffixed filename stem (WITHOUT `.json`) |
| `run_slug` | string | redundant copy of slug from record for idx-only discriminator |

## Observed identity model

**`run_slug`, not `RunId`.** Old Circuit identifies attached runs by a
kebab-case slug derived from the original task text, e.g.
`"dispatch-adapter-fallback-i5"`,
`"review-circuit-usage-across-recent-sessions"`. There is no branded
`RunId` type; the slug doubles as both path component and identity.

**`record_id` is a path-derived filename stem.** Every record carries
`record_id` of the form `"continuity-{uuid-v4}"`. The record is stored at
`<control-plane>/continuity-records/<record_id>.json`. The index's
`pending_record.payload_rel` is a derived path that must round-trip with
the record's own `record_id` to be resolvable. The `record_id` is used as
a filesystem path component at lookup and delete time.

**Implication for circuit-next.** `continuity.record.record_id` is a
`path_derived_field`. circuit-next must use a path-safe primitive at
parse time, not at the filesystem call site. See
`src/schemas/primitives.ts::ControlPlaneFileStem` and ADR-0003 §Machine
enforcement.

## Observed `schema_version` type

**String literal `"1"`**, not number `1`. This is worth noting because
circuit-next's current (pre-Slice-7) `src/schemas/continuity.ts` uses
`z.literal(1)` (number). If circuit-next ever needs to *parse* legacy
records (which it will not under the clean-break posture), the migration
contract would need to accept the string form and normalize it — one more
reason to keep the migration logic out of the normal runtime schema.

## Observed null-vs-optional behavior

Old Circuit consistently uses **explicit `null`**, not omission, for:

- `current_run: null` when the index is idle.
- `pending_record: null` when no record is pending.
- `run_ref: null` on standalone records.

Optional fields (omitted when absent) include:

- `git.branch`, `git.head`, `git.base_commit` — omitted when not known or
  not relevant (e.g. the record may carry `cwd` only).

**Implication for circuit-next.** The `null` vs omitted distinction is
load-bearing for old Circuit. circuit-next's replacement schema doesn't
need to inherit this, but if migration is ever added, the importer must
preserve this distinction rather than collapse both to `undefined`.

## Observed resolver / index discriminants

The old Circuit index resolves to one of two attached states:

1. **Attached run, no pending record.** `current_run` is populated,
   `pending_record` is null. Session-start banner nudges
   `/circuit:handoff done` or explicit resume.
2. **Pending record, optional attached run.** `pending_record` is
   populated; `current_run` may or may not be populated depending on
   whether the run is still live or has been detached.

Resolution relies on `pending_record.record_id` matching the on-disk
filename stem at `<control-plane>/continuity-records/{record_id}.json`.
This is the **dangling reference** failure mode: if the payload file is
missing but the index still points at it, old Circuit treats it as an
error (observed behavior: the resume flow surfaces the mismatch).

**Implication for circuit-next.** The `dangling_reference_policy` for
`continuity.index` is `unknown-blocking` in `specs/artifacts.json` — we
have not yet decided whether circuit-next should refuse to resume, warn,
or silently drop when the index points at an absent record. That
decision belongs in the forthcoming `docs/contracts/continuity.md`,
not in this characterization.

## Explicit clean-break decision

circuit-next **will not** parse these artifacts through normal runtime
paths. This is an operator-owned decision recorded in:

- `specs/adrs/ADR-0003-authority-graph-gate.md` (Context, Decision)
- `specs/artifacts.json` (`continuity.record.compatibility_policy:
  clean-break`, `legacy_parse_policy: reject`)
- `PROJECT_STATE.md` (Slice 7 decision block)

If an operator later declares that circuit-next must import old Circuit
continuity, the path is:

1. Introduce a new artifact id in `specs/artifacts.json` (e.g.
   `continuity.legacy-import`) with `surface_class: migration-source`.
2. Commit sanitized fixtures under
   `tests/fixtures/reference/legacy-circuit/continuity/`.
3. Author a new importer contract (`specs/contracts/continuity-import.md`).
4. The importer reads legacy records; the runtime `ContinuityRecord`
   schema is never relaxed to accept them.

## Future migration / import note

If old Circuit continuity is ever imported:

- The importer is a **separate contract** from
  `docs/contracts/continuity.md`.
- The runtime `ContinuityRecord` schema MUST NOT accept old Circuit shape
  directly. An importer normalizes or rejects; the runtime schema stays
  strict.
- The old `schema_version: "1"` (string) MUST be normalized to whatever
  circuit-next uses (currently `z.literal(1)` number) by the importer, not
  by a looser runtime primitive.
- The `record_id` must be re-validated against
  `ControlPlaneFileStem`; old UUID-suffixed records would need stem
  translation because of the `-` characters (allowed) and UUID
  format (not rejected by the primitive — but the importer should still
  make migration identity explicit, e.g. prefix with `legacy-`).

## What this document does NOT do

- It does not make old Circuit's shape normative for circuit-next.
- It does not commit fixtures.
- It does not promise forward compatibility.
- It does not drive tests under `tests/contracts/`.

It exists solely to satisfy ADR-0003's `successor-to-live` requirement that
the live surface be **characterized** before a new contract is drafted,
thereby preventing the imagine-and-draft failure mode that triggered
Slice 7.
