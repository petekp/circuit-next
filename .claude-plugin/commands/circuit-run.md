---
name: circuit:run
description: Classify a task and dispatch to the appropriate circuit-next workflow (explore/build/repair/migrate/sweep). Router not yet implemented — this command is a P2.2 scaffold entry returning a not-implemented notice pointing at plan slice P2.8 for router implementation.
---

# /circuit:run — classifier (P2.2 scaffold)

## Status

**Not implemented yet.** This command file is a Phase 2 plan slice
P2.2 scaffold entry. Its job in this slice is to hold a canonical path
under `.claude-plugin/commands/` so the plugin manifest can register
the command and the plugin-command-closure audit check can pass.

Invoking this command in Claude Code will surface the placeholder
behavior defined in this file body. The router logic itself —
classifier heuristics, workflow selection, rigor profile resolution —
is deferred to plan slice **P2.8** (`/circuit:run` classifier in
`specs/plans/phase-2-implementation.md §Mid-term slices`).

## Plan pointer

See `specs/plans/phase-2-implementation.md`:

- §Near-term slices — P2.2 (this scaffold)
- §Mid-term slices — P2.8 (router implementation — first-class
  workflow classifier: given task text + entry signals, selects among
  registered workflows)

Phase 2 close binds `plugin_surface_present` as a product ratchet
that advances to `active — partial` after this slice (P2.2) lands
and to `active — satisfied` after slice P2.11 (plugin-level skill
wiring) lands.

## Scope of this placeholder

- Provides the canonical `.claude-plugin/commands/circuit-run.md`
  path that the plugin manifest references.
- Carries YAML frontmatter with `name` + `description` per plugin
  conventions.
- Carries a non-empty body so the plugin-command-closure audit check
  passes on non-empty-body validation.

## Out of scope for P2.2

- Real router behavior (classifier, rigor resolution, workflow
  dispatch, continuation handling) — deferred to P2.8.
- Invoke-evidence file at `specs/reviews/p2-11-invoke-evidence.md` —
  deferred to P2.11.
- Fixture binding — deferred to P2.8 or later.

## Authority

- `specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1 CC#P2-3`
  (plugin command registration close criterion)
- `specs/plans/phase-2-implementation.md §P2.2` (this slice's plan
  framing)
