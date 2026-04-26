---
name: workflow-direction
description: Product direction for Circuit workflows after the primitive/recipe pivot.
type: product-architecture
date: 2026-04-25
status: active
---

# Workflow Direction

Circuit should not rebuild every first-generation workflow one by one.

The old implementation is reference evidence. It shows useful patterns and
operator needs, but it is not the destination. The destination is a small set of
trustworthy workflow moves that can be assembled into clear recipes.

## Product Shape

A workflow is a recipe.

A recipe is an ordered set of reusable moves. Each move consumes typed evidence,
does one clear job, writes typed evidence, and returns a small named outcome.

This keeps Circuit closer to an evidence ledger than a generic flowchart
builder. Users should be able to understand what the workflow will do without
reading every prompt or every step output.

## V1 Boundaries

For v1, users can compose built-in moves only.

That means custom workflows can choose and configure known moves, but they do
not define arbitrary new move code yet. New move creation can come later, after
the built-in catalog has proved itself across several real recipes.

Branches should stay limited and named:

- continue
- retry
- revise
- ask
- split
- stop
- handoff
- escalate
- complete

Those outcomes are enough to express real product choices without turning
recipes into hidden control-flow puzzles.

## First Proving Recipe

The old Repair workflow name is ambiguous. The clearer v1 product shape is
Fix:

> Take a concrete problem, understand it, make the smallest safe change, prove
> the change, and close with evidence.

Old Repair evidence should inform Fix. It should not force Circuit to ship a
workflow named Repair if Fix is clearer to users.

Fix should prove the reusable recipe path:

1. Intake
2. Route
3. Frame
4. Gather Context
5. Diagnose
6. Human Decision when evidence is uncertain
7. Act
8. Run Verification
9. Review when the mode requires it
10. Close With Evidence
11. Handoff when work is paused

## Human Decisions

Human Decision is a reusable move.

The recipe declares the question, choices, default policy, and what each answer
means. Each host should use its native user-prompting mechanism where possible:

- Claude Code should use AskUserQuestion or the closest available native
  question surface.
- Codex should use its native interactive question path when available.
- Non-interactive runs should use an explicit safe default, pause, or fail
  clearly.

The answer is recorded as typed evidence so later moves do not need to know
which host asked the question.

## Immediate Consequence

Do not open more one-off Repair implementation work from the old signed plan.
Repair-only artifacts, `/circuit:repair`, and Repair-only runtime code stay out
of scope unless a later operator decision explicitly reopens Repair as a
first-class product recipe.

The next implementation work should either:

- strengthen the primitive and recipe contracts needed by Fix; or
- build Fix behavior in a way that leaves behind reusable move machinery for
  later Migrate, Sweep, and custom recipes.
