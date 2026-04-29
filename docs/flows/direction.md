---
name: flow-direction
description: Product direction for Circuit flows after the block/schematic pivot.
type: product-architecture
date: 2026-04-28
status: active
---

# Flow Direction

See [`../terminology.md`](../terminology.md) for the canonical product
vocabulary used throughout this doc (flow, schematic, block, route, relay,
check, trace, report, evidence).

Circuit should not aim for a long list of one-off flows.

The destination is a small set of trustworthy flow blocks that can be
assembled into clear schematics.

## Product Shape

A flow is defined by a schematic.

A schematic is an ordered set of reusable blocks. Each block consumes typed
evidence, does one clear job, writes typed evidence, and returns a small
named outcome.

This keeps Circuit closer to an evidence ledger than a generic flowchart
builder. Users should be able to understand what the flow will do without
reading every prompt or every step output.

## V1 Boundaries

For v1, users can compose built-in blocks only.

That means custom flows can choose and configure known blocks, but they do
not define arbitrary new block code yet. New block creation can come later,
after the built-in catalog has proved itself across several real schematics.

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
schematics into hidden control-flow puzzles.

## First Proving Schematic

The older bug-fix flow name is ambiguous. The clearer v1 product shape is Fix:

> Take a concrete problem, understand it, make the smallest safe change,
> prove the change, and close with evidence.

Older bug-fix evidence should inform Fix. It should not force Circuit to ship
two names for the same kind of work.

Fix should prove the reusable schematic path:

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

Human Decision is a reusable block.

The schematic declares the question, choices, default policy, and what
each answer means. Each host should use its native user-prompting
mechanism where possible:

- Claude Code should use AskUserQuestion or the closest available native
  question surface.
- Codex should use its native interactive question path when available.
- Non-interactive runs should use an explicit safe default, pause, or fail
  clearly.

The answer is recorded as typed evidence so later blocks do not need to
know which host asked the question.

## Immediate Consequence

Do not open more one-off implementation work from the old signed plan for a
second bug-fix flow name. Separate reports, commands, or runtime code for that
name stay out of scope unless a later operator decision explicitly reopens the
public naming model.

The next implementation work should either:

- strengthen the block and schematic contracts needed by Fix; or
- build Fix behavior in a way that leaves behind reusable block machinery
  for later Migrate, Sweep, and custom schematics.
