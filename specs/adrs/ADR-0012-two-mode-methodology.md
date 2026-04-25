---
adr: 0012
title: Two-Mode Methodology Overlay
status: Accepted
date: 2026-04-24
author: Codex under operator direction
amends:
  - AGENTS.md §Core methodology
  - AGENTS.md §Lane discipline
  - AGENTS.md §Cross-model challenger protocol
  - AGENTS.md §Hard invariants
  - specs/methodology/decision.md §Decision
  - scripts/audit.mjs Check 35a
related:
  - ADR-0001
  - ADR-0007
  - ADR-0010
---

# ADR-0012 — Two-Mode Methodology Overlay

## Context

The original methodology correctly protected dangerous work: runtime safety,
adapter invocation, public command behavior, plan signoff, and parity-close
claims. It also began to impose the same ceremony on low-risk preparatory work:
schema additions, policy-table rows, authority metadata, focused tests, and
status documentation.

That mismatch became visible during Repair parity. After the Build workflow
proved the product spine, the project still required a fresh per-slice external
challenger for small local changes that did not run commands, touch adapters,
change public routing, or claim operational status.

The goal is not to remove discipline. The goal is to put the heavier discipline
where it actually protects users and let preparatory work move with focused
tests and the existing verify/audit gates.

## Decision

Add a required **Work mode** overlay to future slice commits. Work mode is
orthogonal to `Lane`: a `Ratchet-Advance` slice can be light when it is local,
preparatory, and non-executing.

### Light mode

Use `Work mode: Light` for local, preparatory work that cannot make Circuit
lie, lose work, run unintended commands, or expose a new public promise.

Typical Light work:

- schema additions and schema tests;
- policy-table rows and focused policy tests;
- artifact authority rows;
- straightforward contract tests;
- README / PROJECT_STATE / TIER status updates that do not move phase, signoff,
  live-proof, workflow-close, or parity-close claims;
- internal helper extraction when behavior is unchanged.

Light mode requires clear scope, focused tests when behavior or contracts move,
`npm run verify` before commit, post-commit `npm run audit`, and the plain
operator summary. It does not require a per-slice external Codex challenger.

### Heavy mode

Use `Work mode: Heavy` for any work that can affect what users run, what models
execute, what files are written, what outcomes are reported, or what safety
rules admit.

Heavy work includes:

- runtime execution, event writing, run state, checkpoint/resume, and result
  writing;
- model adapters and dispatch boundaries;
- public command files, plugin surface, and router behavior;
- methodology, audit, and plan-lifecycle gate changes;
- multi-slice plan clearance, operator signoff transitions, and parity-close
  claims;
- any contract, ratchet, or safety-gate relaxation.

Heavy mode requires the Light-mode evidence plus `Codex challenger: REQUIRED`
and the existing committed review record / arc-subsumption evidence path.

### Enforcement

`scripts/audit.mjs` Check 35a enforces this overlay for future slice commits
after the adoption slice:

- exactly one `Work mode: Light` or `Work mode: Heavy` declaration;
- Heavy mode must carry `Codex challenger: REQUIRED`;
- Light mode rejects obvious heavy surfaces:
  - `AGENTS.md`;
  - `bin/**`;
  - `src/cli/**`;
  - runtime evidence and selection files such as event/result/snapshot writers,
    log readers, reducers, config loading, selection resolution, and path-safety
    helpers;
  - `src/runtime/runner.ts`;
  - `src/runtime/router.ts`;
  - `src/runtime/adapters/**`;
  - `commands/**`;
  - `.claude-plugin/**`;
  - `specs/adrs/**`;
  - `specs/methodology/**`;
  - `scripts/audit.mjs`;
  - `scripts/plan-lint.mjs`;
  - `specs/plans/**`.
- Light mode rejects status-doc diffs that move close, signoff, phase, live
  proof, command-surface, or runtime-operation claims.

The check is intentionally narrow. It is a guardrail against obvious misuse,
not a complete risk classifier. If a Light slice discovers runtime, command,
adapter, methodology, or plan-lifecycle risk, the implementer must reclassify
the slice as Heavy.

## Consequences

Repair parity uses the new split immediately:

- Light: Repair schemas, authority rows, policy-only tests, and non-claim status
  docs.
- Heavy: checkpoint/resume widening, verification command execution, Lite
  review-skip behavior, command/router wiring, live proof, and final close.

The ADR-0010 plan lifecycle remains unchanged. Multi-slice plans still need
challenger clearance before operator signoff, and signoff still needs a
predecessor binding.

This loosens the old "challenger for any ratchet change" rule. The new rule is
"challenger for Heavy work." The accepted tradeoff is faster low-risk work in
exchange for relying on focused tests, `npm run verify`, and `npm run audit` for
Light slices.
