---
adr: 0013
title: Primitive-Backed Workflow Recipes
status: Accepted
date: 2026-04-25
author: Codex under operator direction
supersedes:
  - specs/plans/repair-workflow-parity.md as active implementation direction
amends:
  - AGENTS.md §The one-paragraph mental model
  - README.md §Current phase
  - PROJECT_STATE.md §0 Live state
  - specs/workflow-direction.md
  - specs/workflow-primitives.md
  - specs/workflow-recipe-composition.md
related:
  - ADR-0007
  - ADR-0010
  - ADR-0012
  - specs/parity-map.md
  - specs/reference/legacy-circuit/repair-characterization.md
  - specs/workflow-primitive-catalog.json
  - specs/workflow-recipes/fix-candidate.recipe.json
---

# ADR-0013 — Primitive-Backed Workflow Recipes

## Decision

Circuit workflows are **primitive-backed recipes**, not one-off clones of the
first-generation Circuit workflow list.

The previous implementation remains read-only reference evidence. It can show
operator needs, useful workflow shapes, and missing product surfaces. It is not
the product constitution. Where legacy parity conflicts with a clearer
primitive-backed design, the primitive-backed design wins unless a later ADR
reopens this decision.

A workflow is a recipe: an ordered set of reusable moves. Each move consumes
typed evidence, does one clear job, writes typed evidence, and returns a small
named outcome. The runtime and adapters may render prompts from that typed state,
but prompt text is delivery format, not the source of truth.

For v1, custom workflows compose built-in moves only. Users may choose,
configure, and order known moves inside guardrails. They may not define
arbitrary new move code until the built-in primitive catalog has proved itself
across several real recipes.

Circuit is deliberately not a generic flowchart builder. Branches are allowed
only as limited named outcomes such as `continue`, `retry`, `revise`, `ask`,
`split`, `stop`, `handoff`, `escalate`, and `complete`. A recipe can map those
outcomes to the next item; a primitive controls which outcomes it may emit.

Human Decision is a first-class reusable move. The recipe declares the question,
choices, default policy, and unattended behavior. Each host should use its
native user-prompting surface where possible, such as Claude Code's
AskUserQuestion-style path or Codex's native interactive question path. The
answer is recorded as typed evidence.

The old Repair plan is superseded as active implementation direction. It stays
in the repo as reference evidence and historical signed-plan context. Future
bug-fix work must proceed through the clearer **Fix** recipe over reusable
primitives, not through new one-off `repair.*` artifacts, `/circuit:repair`
command wiring, or Repair-only runtime code.

Fix is the first proving recipe: take a concrete problem, understand it, make
the smallest safe change, prove it, and close with evidence. Fix work should
leave behind reusable machinery for later Migrate, Sweep, and custom recipes.

## Appendix

### Context

After Explore, Review, and Build became operational, the next obvious parity
target appeared to be Repair. A signed Repair plan existed, and the legacy
Circuit reference gave a concrete six-step shape. During planning, the operator
and agent re-evaluated whether old workflow parity should remain the
destination.

The stronger product direction is a small set of trustworthy workflow moves
that can be assembled into recipes. This keeps Circuit closer to an evidence
ledger than a visual or generic workflow builder. It also makes custom
workflows more plausible: users can compose known moves instead of copying and
mutating entire workflow implementations.

### Consequences

- `specs/workflow-direction.md` becomes the short product-direction note under
  this ADR.
- `specs/workflow-primitives.md` and `specs/workflow-primitive-catalog.json`
  carry the initial reusable move catalog.
- `specs/workflow-recipe-composition.md`, `src/schemas/workflow-recipe.ts`,
  and `specs/workflow-recipes/fix-candidate.recipe.json` carry the first recipe
  composition shape.
- `specs/contracts/fix.md`, `src/schemas/artifacts/fix.ts`, and the `fix.*`
  authority rows are the first concrete Fix evidence contracts.
- `specs/plans/repair-workflow-parity.md` is closed by supersession and
  retained as historical evidence. It must not be used to open new Repair
  implementation slices unless a later ADR explicitly reopens Repair as a
  first-class product recipe.

### What Future Work Should Do

Future workflow work should start by asking:

1. Which primitives does this workflow compose?
2. Which typed evidence is already available?
3. Which new evidence contract is genuinely workflow-specific?
4. Which route outcomes are allowed by mode?
5. Which missing primitive should be built generically?

This applies to Fix first, then Migrate, Sweep, custom workflow creation, and
any future workflow family.

### Reopen Conditions

Reopen this ADR if:

- Fix cannot be implemented without excessive contortion through primitives;
- two or more later workflows require the same kind of custom move code that v1
  forbids;
- user research shows that users need a generic graph builder more than an
  opinionated recipe system;
- host-native human prompting cannot be represented cleanly as typed evidence;
- legacy Repair semantics become product-critical enough to justify a separate
  first-class Repair recipe.
