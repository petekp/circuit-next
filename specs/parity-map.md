---
name: parity-map
description: Plain-English map of first-generation Circuit parity gaps after Slice 102.
type: inventory
date: 2026-04-24
reference_repo: /Users/petepetrash/Code/circuit
status: current
---

# Circuit Parity Map

This is a snapshot of how close `circuit-next` is to the first-generation
Circuit feature set. It is an inventory, not an implementation plan. The
reference repo at `/Users/petepetrash/Code/circuit` was read only while this
map was written.

## Plain-English Status

`circuit-next` now has a real command path and working routes for Explore and
Review. It does not yet match the full first-generation Circuit product.

The biggest remaining gap is not one single missing feature. It is the set of
normal work workflows people expect to run every day: Build, Repair, Migrate,
and Sweep. Custom workflow creation and the polished user-facing
configuration experience are also still missing.

## First-Generation Circuit Baseline

The old Circuit repo exposes five core workflows:

| Workflow | What it is for |
|---|---|
| Explore | Investigate, understand, compare options, or shape a plan. |
| Build | Implement features, scoped refactors, docs, tests, or mixed changes. |
| Repair | Fix bugs, regressions, flaky behavior, and incidents. |
| Migrate | Move a codebase through a larger change with inventory, coexistence, batches, and rollback thinking. |
| Sweep | Run systematic cleanup, quality, coverage, or docs-sync passes. |

It also exposes three utility surfaces:

| Utility | What it is for |
|---|---|
| Run | A router that selects one of the core workflows from a free-form task. |
| Create | A guided way to draft, validate, and publish user-global custom workflows. |
| Handoff | A way to persist enough state for a later session to resume cleanly. |

The old router recognizes shortcut phrases such as `fix:`, `repair:`,
`develop:`, `decide:`, `migrate:`, `cleanup:`, and `overnight:`. It also has
workflow-specific rigor profiles and a public Markdown artifact vocabulary:
`brief.md`, `analysis.md`, `plan.md`, `review.md`, `result.md`, plus
specialized files such as `decision.md`, `queue.md`, and `inventory.md`.

## Current Circuit-Next Surface

`circuit-next` currently exposes:

| Surface | Current status |
|---|---|
| `/circuit:run` | Operational, but it only routes to Explore or Review. |
| `/circuit:explore` | Operational as the first working workflow path. |
| `/circuit:review` | Operational as an audit-only review workflow. |
| Direct launcher | Operational through `./bin/circuit-next`. |
| Model and effort config | Runtime plumbing exists for defaults, workflow/phase/step overrides, and adapter argument binding. The user-facing docs and workflow authoring experience are not yet at old Circuit's level. |
| Artifacts | Structured JSON is the accepted successor for step artifacts. This intentionally does not claim byte-for-byte compatibility with old Markdown outputs. |

The current router only knows `explore` and `review`, so phrases like
`develop:`, `fix:`, `migrate:`, `cleanup:`, and `overnight:` are not yet full
workflow entries.

## Gap Table

| Area | Parity status | Notes |
|---|---|---|
| Explore | Partial | The workflow runs and emits strict JSON artifacts. Old Markdown compatibility is intentionally not the target for step artifacts. |
| Review | Partial | The audit-only review path is real. It is narrower than old Circuit's broader review utility and does not replace verification-bearing workflows. |
| Run router | Partial | It reaches the product runtime, but it routes only Explore and Review today. |
| Build | Missing | This is the main everyday implementation workflow from old Circuit. |
| Repair | Missing | This should build on Build, with bug reproduction and regression-proof behavior. |
| Migrate | Missing | This needs inventory, coexistence, batch execution, verification, and rollback-aware closeout. |
| Sweep | Missing | This needs survey, queue/triage, batch execution, deferred review, and broad cleanup behavior. |
| Create/custom workflows | Missing | The old create flow drafts, validates, and publishes user-global workflows. Circuit-next has schema/config foundations, but no matching user flow. |
| Handoff command | Missing as a plugin command | Engine continuity exists in repo tooling, but there is no user-facing `/circuit:handoff` parity surface in the plugin command set. |
| Human-readable workflow config | Partial | Per-step model, effort, skills, and invocation options are represented in the runtime, but the user-facing configuration docs and editing experience still need product work. |

## Recommended Order

1. Build
2. Repair
3. Router expansion for Build and Repair shortcuts
4. Migrate
5. Sweep
6. Custom workflow creation
7. User-facing workflow configuration polish
8. Handoff command parity, if the plugin should expose continuity directly

Build should come next because it is the most common "do real work" path. It
also exercises the basic shape that Repair, Migrate, and Sweep will reuse:
understand the task, plan the work, make changes, verify them, review them,
and close with a result.

Repair should follow because it is Build with tighter bug-fix discipline:
reproduce the problem, isolate the cause, make the smallest fix, and prove the
bug stays fixed.

Migrate and Sweep should come later because they need more orchestration:
inventories, queues, batches, deferred work, and rollback or skip decisions.

Custom workflow creation should wait until the built-in workflow shape feels
stable enough that user-authored workflows are not learning against a moving
target.

## Next Slice Recommendation

Open the Build workflow track next.

The first Build slice should stay small: register Build as a known workflow
shape, add its fixture skeleton, and prove the runtime can recognize the
Build phases without changing the router yet. Later slices can add artifact
schemas, synthesis writers, command wiring, router shortcuts, and live proof.

## Non-Goals For This Map

This map does not implement Build, Repair, Migrate, Sweep, Create, or Handoff.
It also does not decide the final human-readable configuration UX. It only
records the current gap and recommends the next place to work.
