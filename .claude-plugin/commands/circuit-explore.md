---
name: circuit:explore
description: Investigate, understand, choose among options, or shape an execution plan. Phase 2 first-parity target (ADR-0007 CC#P2-1); contract to be authored at slice P2.3 under specs/contracts/explore.md. This is a P2.2 scaffold entry — invocation returns a not-implemented notice pointing at P2.3 + P2.5.
---

# /circuit:explore — investigation workflow (P2.2 scaffold)

## Status

**Not implemented yet.** This command file is a Phase 2 plan slice
P2.2 scaffold entry. The `explore` workflow is the first-parity
target for Phase 2 close (per ADR-0007 CC#P2-1, operator decision
2026-04-21 adopting Codex challenger recommendation over in-session
Claude methodology recommendation of `review`).

Invoking this command in Claude Code surfaces the placeholder below.
Real workflow behavior lands across:

- **P2.3** — `specs/contracts/explore.md` + fixture at
  `.claude-plugin/skills/explore/circuit.json` with full-spine
  phases {Frame, Analyze, Synthesize, Review, Close} per ADR-0007
  CC#P2-6 (resolved plan Open Question #5).
- **P2.4** — real-agent adapter (`agent` in-process Anthropic
  subagent) under `src/runtime/adapters/agent.ts`, per ADR-0007
  CC#P2-2.
- **P2.5** — end-to-end `explore` fixture run with golden artifacts
  at `tests/fixtures/golden/explore/` and smoke test
  `tests/runner/explore-e2e-parity.test.ts`, per ADR-0007 CC#P2-1.

## Plan pointer

See `specs/plans/phase-2-implementation.md`:

- §Target workflow for first parity — DECIDED: `explore` (operator
  decision 2026-04-21 at commit 3bf4868; Codex rationale preserved
  verbatim in §Target workflow for first parity).
- §Near-term slices — P2.2 (this scaffold), P2.3 (contract), P2.4
  (adapter), P2.5 (end-to-end run).

Fallback: if adapter/routing scope balloons during P2.3 or P2.4, plan
§Target workflow §Fallback permits a scope-reducing pivot to
`review`. Pivoting requires amending ADR-0007 per §4b retarget
checklist — silent rename is rejected on ADR-0007 §6 grounds.

## Scope of this placeholder

- Provides the canonical `.claude-plugin/commands/circuit-explore.md`
  path that the plugin manifest references.
- Carries YAML frontmatter with `name` + `description` per plugin
  conventions.
- Carries a non-empty body so the plugin-command-closure audit check
  passes on non-empty-body validation.
- Binds visibly to ADR-0007 CC#P2-1, CC#P2-3, CC#P2-6 so future
  slice authors editing this file have the authority surface close
  to hand.

## Out of scope for P2.2

- Workflow contract authoring — P2.3.
- Adapter dispatch wiring — P2.4.
- Fixture spine + golden artifacts — P2.3 + P2.5.
- Manual-invokability evidence at
  `specs/reviews/p2-11-invoke-evidence.md` — P2.11.

## Authority

- `specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1
  CC#P2-1` (one-workflow parity — this command's target workflow)
- `specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1
  CC#P2-3` (plugin command registration — this file's role)
- `specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1
  CC#P2-6` (spine policy coverage — full-spine explore per
  resolved Open Question #5)
- `specs/plans/phase-2-implementation.md §P2.2` (this slice's
  plan framing)
