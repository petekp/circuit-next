---
doc: build-characterization
status: active
capture_date: 2026-04-24
characterized_by: codex
source: live old-Circuit state on disk at ~/Code/circuit
authority: reference only; NOT runtime compatibility
---

# Legacy Circuit - Build Workflow Characterization

This document characterizes the live on-disk `build` workflow in
first-generation Circuit as observed on **2026-04-24**. It exists to keep
circuit-next's Build workflow work tied to the reference product shape
without treating old Markdown files as a byte-for-byte compatibility target.

It is reference evidence, not a compatibility layer. circuit-next will author
its own structured JSON successor artifacts.

## Source paths inspected

```
~/Code/circuit/commands/build.md
~/Code/circuit/skills/build/SKILL.md
~/Code/circuit/skills/build/circuit.yaml
```

## Source fingerprints

| Source | SHA-256 |
|---|---|
| `skills/build/circuit.yaml` | `6723ffbd6402b2996fe59432405698929e73eaa4d1e4b79889db0cfc93d487b2` |
| `skills/build/SKILL.md` | `44f1bb8bbe9e81a12988bfda60fb9e0256ee5282b94d026e821fdaa04ea8129f` |
| `commands/build.md` | `62057ddc1e79492095ef922228859afc29a1a88a1100699839299b38a7ff15be` |

## Observed command surface

The old slash command at `~/Code/circuit/commands/build.md` is a direct
workflow invocation for `/circuit:build`.

The command describes Build as the workflow for features, scoped refactors,
docs, tests, and mixed changes. It also has a smoke/bootstrap mode that checks
real run state, not generic repo status.

## Declared workflow shape

The old workflow definition at `~/Code/circuit/skills/build/circuit.yaml`
declares six steps:

| Step | Executor / kind | Writes |
|---|---|---|
| `frame` | orchestrator / checkpoint | `artifacts/brief.md` |
| `plan` | orchestrator / synthesis | `artifacts/plan.md` |
| `act` | worker / dispatch | `artifacts/implementation-handoff.md`, plus implementation job files |
| `verify` | orchestrator / synthesis | `artifacts/verification.md` |
| `review` | worker / dispatch | `artifacts/review.md`, plus review job files |
| `close` | orchestrator / synthesis | `artifacts/result.md` |

The declared phase order is:

```
Frame -> Plan -> Act -> Verify -> Review -> Close
```

Build omits an Analyze phase. Planning is explicit, implementation is a worker
dispatch, verification is an orchestrator-owned phase, and review is a fresh
reviewer dispatch before close.

## Observed entry modes

The old workflow declares four entry modes:

| Entry mode | Rigor | Notes |
|---|---|---|
| `default` | Standard | Fixed graph, pauses only on ambiguity or irreversibility. |
| `lite` | Lite | Faster rigor, review still runs. |
| `deep` | Deep | Deeper rigor inside Frame and Plan. |
| `autonomous` | Autonomous | Fixed graph with auto-resolved checkpoints. |

## Observed artifacts

The reference Build surface has six workflow artifact outputs:

| Reference artifact | Shape | Role |
|---|---|---|
| `artifacts/brief.md` | Markdown | Objective, scope, output types, success criteria, constraints, commands, and out-of-scope notes. |
| `artifacts/plan.md` | Markdown | Approach, slices, verification commands, rollback triggers, and adjacent-output checklist. |
| `artifacts/implementation-handoff.md` | Markdown | Mission for the implementation worker and expected evidence. |
| `artifacts/verification.md` | Markdown | Verification command results and regression check. |
| `artifacts/review.md` | Markdown | Independent review result. |
| `artifacts/result.md` | Markdown | Final change summary, verification, residual risk, follow-ups, and PR summary. |

## Observed runtime capability requirements

Build needs two runtime capabilities that were not required for the first
Explore path:

1. A mutating implementation dispatch (`act`) that can make code changes and
   return a structured result.
2. A verification phase that can run the commands named in the plan and
   capture pass/fail evidence before review and close.

The current circuit-next runtime has synthesis and dispatch steps. It does not
yet have a dedicated step kind for running verification commands itself.

## circuit-next implication

Build should be treated as a clean-break structured JSON successor to old
Circuit's Markdown Build artifacts. The reference shape still matters:
circuit-next should preserve the six-phase workflow shape, the six artifact
roles, the fact that Lite still reviews, and the expectation that verification
happens before the independent review.

The first Build plan must therefore budget a small runtime-widening step for
verification command execution instead of pretending the current synthesis
step already proves commands ran.
