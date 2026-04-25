---
name: workflow-primitives
description: Canonical first-principles inventory of reusable workflow moves for circuit-next.
type: product-architecture
date: 2026-04-24
status: active
authority: guidance
---

# Workflow Primitives

This document names the reusable workflow moves circuit-next should build
toward. It is intentionally not a list of old Circuit workflows to clone.

Old Circuit remains useful reference evidence: it shows real operator needs and
good workflow instincts. But circuit-next should not recreate every old workflow
one by one if a smaller set of reusable primitives gives users a better system.

Deep prior-art research should be evaluated through
`specs/workflow-research-intake.md` before it changes this inventory.

## Core Idea

A workflow should be assembled from moves.

Each move has:

- a clear purpose;
- structured inputs;
- a prompt or tool call rendered from those inputs;
- a typed output;
- gates that decide whether the output can be trusted;
- routes that decide what can happen next.

The prompt is a delivery format, not the source of truth. The runtime should
pass structured state between moves whenever possible, and only render prompts
at the adapter boundary.

## Compatibility Rule

Not every move works after every other move.

A move can run only when previous outputs satisfy its input contract. This lets
the runtime reject impossible workflow assemblies early.

Example:

- a Fix move can consume a diagnosis;
- a Verify move can consume implementation evidence plus proof commands;
- a Close move can consume the required evidence for that workflow;
- a Fix move should not consume only a vague idea list.

## Canonical Primitive List

| Primitive | Purpose | Typical inputs | Typed output | Common next routes |
|---|---|---|---|---|
| Intake | Capture the user's goal and requested mode. | Goal text, explicit workflow, entry mode, project context. | Normalized task intake. | Route, Frame, Human Decision. |
| Route | Choose the workflow or move sequence. | Intake, known workflow catalog, shortcut rules. | Route decision with reason. | Frame, Human Decision, Stop. |
| Frame | Define the work boundary and proof needed. | Intake, selected workflow, constraints, known context. | Brief with scope, constraints, proof plan. | Human Decision, Plan, Diagnose, Act. |
| Human Decision | Pause for an operator choice and record it. | Question, options, default policy, mode policy, current evidence. | Decision artifact with selected option and source. | Continue, revise, stop, hand off, escalate. |
| Gather Context | Collect facts before deciding or acting. | Brief, target paths, search instructions, allowed tools. | Context packet with sources and confidence. | Plan, Diagnose, Review, Human Decision. |
| Diagnose | Explain what is wrong or unknown. | Brief, context packet, repro instructions, observed behavior. | Diagnosis with cause, confidence, repro status, diagnostic path. | Act, Gather Context, Human Decision, Stop. |
| Plan | Choose an implementation or investigation path. | Brief, context, diagnosis, constraints. | Plan with steps, risk notes, proof strategy. | Human Decision, Act, Batch. |
| Act | Make or delegate the change. | Brief or plan, diagnosis when relevant, allowed scope, model/tool policy. | Implementation evidence with changed files and rationale. | Verify, Review, Human Decision. |
| Run Verification | Execute declared proof commands and capture results. | Proof plan, command list, timeout/output policy, current work evidence. | Verification result with commands, exit status, and evidence. | Review, Act retry, Human Decision, Close. |
| Review | Independently judge the result. | Brief, plan/diagnosis, implementation evidence, verification result. | Review verdict with findings, confidence, and required fixes. | Act retry, Verify retry, Close, Human Decision. |
| Queue | Turn broad work into ordered items. | Survey/context, safety criteria, prioritization rule. | Work queue with item state and risk class. | Batch, Human Decision, Close. |
| Batch | Process a bounded set of queue items. | Queue, batch size, safety policy, proof policy. | Batch result with completed, skipped, blocked, and failed items. | Verify, Queue, Human Decision, Close. |
| Risk/Rollback Check | Decide whether continuing is safe. | Current diff/evidence, risk policy, rollback or recovery options. | Risk decision with allowed next action. | Continue, split, revert plan, Human Decision, Stop. |
| Close With Evidence | End honestly. | Required artifacts, verification, review when required, residual risks. | Workflow result with outcome, evidence pointers, follow-ups. | Complete, stop, hand off, escalate. |
| Handoff | Persist enough state to resume later. | Current goal, completed moves, pending evidence, next action, debt. | Continuity record or handoff artifact. | Stop, Resume later. |

## Repair-Derived Reusable Moves

Repair is the right place to extract the first new set of primitives after
Build because it adds bug-fix discipline without requiring a completely new
runtime story.

Repair should contribute these reusable moves:

| Move | Why it is reusable |
|---|---|
| Regression Contract | Many change workflows need expected behavior, actual behavior, and proof target. |
| Diagnose Problem | Repair needs it directly; Migrate and Sweep also need "why this is risky or broken" analysis. |
| No-Repro Decision | Any workflow can hit uncertain evidence and need operator choice. |
| Optional Review Branch | Lite-style paths can skip review only when mode and evidence allow it. |
| Conditional Close | Some workflows close as fixed, not reproduced, partially complete, skipped, or handed off. |

## Human Decision Primitive

Human Decision should be a first-class primitive, not a Claude-specific
instruction.

The workflow-level input is structured:

```json
{
  "decision_id": "repair.no_repro_next_step",
  "question": "The bug did not reproduce. What should Circuit do next?",
  "options": [
    {
      "id": "instrument",
      "label": "Add diagnostics",
      "effect": "Continue with probes or logging"
    },
    {
      "id": "stop",
      "label": "Stop here",
      "effect": "Close as not reproduced"
    },
    {
      "id": "handoff",
      "label": "Hand off",
      "effect": "Record state for later"
    }
  ],
  "default": "instrument",
  "mode_policy": {
    "lite": "use_default",
    "standard": "ask",
    "deep": "ask",
    "autonomous": "use_default_or_escalate"
  }
}
```

The adapter maps that request to the host's native mechanism:

- Claude Code can use its user-question tool.
- Codex can use the interactive question mechanism exposed by its host.
- A non-interactive host can use the declared default, pause the run, or fail
  clearly, depending on the mode policy.

The output is structured:

```json
{
  "decision_id": "repair.no_repro_next_step",
  "selected": "instrument",
  "answered_by": "operator",
  "source": "host_user_question",
  "rationale": "Try one diagnostic pass before closing no-repro."
}
```

## How This Changes Workflow Planning

Future work should start by asking:

1. Which primitives does this workflow compose?
2. Which inputs and outputs are already available?
3. Which evidence is workflow-specific?
4. Which routes are allowed by mode?
5. Which primitive is missing and should be built generically?

This means Repair, Migrate, Sweep, and custom workflows are not necessarily
separate implementation towers. They should be different recipes over a shared
set of moves.

## Product Direction

Do not treat feature parity as the only goal.

The better opportunity is to make Circuit a workflow assembly system: a small
catalog of trustworthy moves that can be composed into built-in workflows and,
eventually, user-authored workflows. Old Circuit's workflow list is a source of
examples, not a ceiling.
