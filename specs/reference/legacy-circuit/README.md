# Legacy Circuit — Reference Characterization

This directory holds **reference characterizations** of live first-generation
Circuit artifacts (`~/Code/circuit/`). They exist to prevent blind design of
circuit-next surfaces that replace existing live surfaces.

**This is not runtime compatibility.** Files here describe what the live
surface *looks like*, at the date of capture. They are **not** parsed by
circuit-next's runtime, they are **not** fixtures, and they are **not** a
compatibility requirement.

## Why this exists

Per ADR-0003 (Authority-Graph Gate), any artifact classified
`successor-to-live` must include:

- `reference_surfaces` — the named live surface it supersedes.
- `reference_evidence` — a characterization document in this directory.
- `migration_policy` — how legacy data is handled (default: deferred).
- `legacy_parse_policy` — whether legacy records parse at runtime (default
  for successor-to-live: `reject`).

The characterization is required; fixture parity is not.

## Relationship to old Circuit

Old Circuit (at `~/Code/circuit/`) is read-only reference per
`CLAUDE.md` hard-invariants and ADR-0002 (bootstrap discipline). Nothing in
this directory modifies old Circuit. Nothing in circuit-next's runtime
parses old Circuit artifacts. If that ever changes, a new `migration-source`
artifact and a separate importer contract must be authored.

## Files

- `continuity-characterization.md` — observed shape of live continuity
  records and index, captured 2026-04-19.
- `explore-characterization.md` — observed shape of the live `explore`
  workflow (command, steps, Markdown artifacts, and one incomplete run
  record), captured 2026-04-24. Evidence base for CC#P2-1 close cleanup.
- `review-characterization.md` — observed shape of the live `review` skill
  (phases, artifacts, invariant candidates, CLI, runtime-capability
  requirements), captured 2026-04-24. Evidence base for P2.9 plan restart.

Future characterizations would go here if circuit-next adds more
`successor-to-live` or `legacy-compatible` surfaces.
