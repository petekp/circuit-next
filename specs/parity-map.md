---
name: parity-map
description: Plain-English map of first-generation Circuit parity gaps after Slice 127.
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

Feature parity is reference evidence, not the only product goal. The
first-principles workflow direction is canonicalized by
`specs/adrs/ADR-0013-primitive-backed-workflow-recipes.md`: built-in workflows
should be recipes over reusable moves rather than one-off clones of old Circuit
shapes.

## Plain-English Status

`circuit-next` now has a real command path and working routes for Explore,
Review, and Build. It does not yet match the full first-generation Circuit
product.

The biggest remaining gap is not one single missing feature. It is the set of
normal work workflows people expect to run every day. The old repo called one
of these Repair; `circuit-next` now treats that evidence as input for a clearer
Fix recipe. Migrate and Sweep remain missing too. Custom workflow creation and
the polished user-facing configuration experience are also still missing.

## First-Generation Circuit Baseline

The old Circuit repo exposes five core workflows:

| Workflow | What it is for |
|---|---|
| Explore | Investigate, understand, compare options, or shape a plan. |
| Build | Implement features, scoped refactors, docs, tests, or mixed changes. |
| Repair | Fix bugs, regressions, flaky behavior, and incidents. In `circuit-next`, this is reference evidence for the clearer Fix recipe direction. |
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
| `/circuit:run` | Operational. It routes Explore, Review, and clear Build prompts; Fix, Migrate, Sweep, and overnight shortcuts are still missing. |
| `/circuit:explore` | Operational as the first working workflow path. |
| `/circuit:review` | Operational as an audit-only review workflow. |
| `/circuit:build` | Operational as the first mutating workflow path. |
| Direct launcher | Operational through `./bin/circuit-next`. |
| Model and effort config | Runtime plumbing exists for defaults, workflow/phase/step overrides, and adapter argument binding. The user-facing docs and workflow authoring experience are not yet at old Circuit's level. |
| Artifacts | Structured JSON is the accepted successor for step artifacts. This intentionally does not claim byte-for-byte compatibility with old Markdown outputs. |

The current router knows Explore, Review, and Build. Clear implementation
prompts can route to Build, while planning/document prompts stay on Explore.
Phrases like `fix:`, `repair:`, `migrate:`, `cleanup:`, and `overnight:` are
not yet full workflow entries.

## Gap Table

| Area | Parity status | Notes |
|---|---|---|
| Explore | Partial | The workflow runs and emits strict JSON artifacts. Old Markdown compatibility is intentionally not the target for step artifacts. |
| Review | Partial | The audit-only review path is real. It is narrower than old Circuit's broader review utility and does not replace verification-bearing workflows. |
| Run router | Partial | It reaches the product runtime and routes clear Build prompts, but Fix, Migrate, Sweep, and overnight shortcuts are still missing. |
| Build | Partial | The direct command, router path, entry modes, checkpoint substrate, verification command execution, implementation/review dispatch, and typed JSON artifacts are operational. It is a clean-break JSON successor, not old Markdown byte compatibility. |
| Fix | Missing | This should build on Build, with problem diagnosis, smallest-safe-change behavior, verification, and honest close evidence. Old Repair evidence informs it. |
| Migrate | Missing | This needs inventory, coexistence, batch execution, verification, and rollback-aware closeout. |
| Sweep | Missing | This needs survey, queue/triage, batch execution, deferred review, and broad cleanup behavior. |
| Create/custom workflows | Missing | The old create flow drafts, validates, and publishes user-global workflows. Circuit-next has schema/config foundations, but no matching user flow. |
| Handoff command | Missing as a plugin command | Engine continuity exists in repo tooling, but there is no user-facing `/circuit:handoff` parity surface in the plugin command set. |
| Human-readable workflow config | Partial | Per-step model, effort, skills, and invocation options are represented in the runtime, but the user-facing configuration docs and editing experience still need product work. |

## Recommended Order

1. Fix recipe over reusable primitives
2. Router expansion for `fix:` and likely `repair:` as a compatibility alias
3. Migrate
4. Sweep
5. Custom workflow creation
6. User-facing workflow configuration polish
7. Handoff command parity, if the plugin should expose continuity directly

Build is now closed as the first mutating workflow path. Fix should come next
because it reuses Build's checkpoint, dispatch, verification, review, and close
substrate while adding the problem-solving discipline users expect: understand
the issue, isolate the cause when possible, make the smallest safe change, and
prove the problem stays fixed.

The old Repair surface has now been characterized in
`specs/reference/legacy-circuit/repair-characterization.md`. That file is
evidence, not a requirement to ship a workflow named Repair.

Migrate and Sweep should come later because they need more orchestration:
inventories, queues, batches, deferred work, and rollback or skip decisions.

Custom workflow creation should wait until the primitive catalog feels stable
enough that user-authored workflows are not learning against a moving target.

## Next Slice Recommendation

Open the Fix recipe track next.

The first implementation slice should stay small: strengthen the recipe and
artifact contracts needed by Fix, then build behavior in a way that leaves
behind reusable move machinery for later Migrate, Sweep, and custom recipes.

## Non-Goals For This Map

This map does not implement Fix, Migrate, Sweep, Create, or Handoff. It also
does not decide the final human-readable configuration UX. It only records the
current gap and recommends the next place to work.
