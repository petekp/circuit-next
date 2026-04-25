---
doc: repair-characterization
status: active
capture_date: 2026-04-24
characterized_by: codex
source: live old-Circuit state on disk at ~/Code/circuit
authority: reference only; NOT runtime compatibility
---

# Legacy Circuit - Repair Workflow Characterization

This document characterizes the live on-disk `repair` workflow in
first-generation Circuit as observed on **2026-04-24**. It exists to keep
circuit-next's Repair workflow work tied to the reference product shape without
treating old Markdown files as a byte-for-byte compatibility target.

It is reference evidence, not a compatibility layer. circuit-next will author
its own structured JSON successor artifacts.

## Source paths inspected

```
~/Code/circuit/commands/repair.md
~/Code/circuit/skills/repair/SKILL.md
~/Code/circuit/skills/repair/circuit.yaml
~/Code/circuit/CIRCUITS.md
~/Code/circuit/docs/workflow-matrix.md
```

## Source fingerprints

| Source | SHA-256 |
|---|---|
| `skills/repair/circuit.yaml` | `bb95ddbbfc4cdaf6f3ca46c1e9e3663715b90c6b3b58543cfbb39f65e1e3ad99` |
| `skills/repair/SKILL.md` | `c4edabd124d09338b3975fc695598b959ae4274fa9ad2d12ac357558fdefe811` |
| `commands/repair.md` | `3b0e03c90a5a222ff88db508bdfb30de3201ee26f19e5b6bd18625003044c36d` |

## Observed command surface

The old slash command at `~/Code/circuit/commands/repair.md` is a direct
workflow invocation for `/circuit:repair`.

The old router also exposes prefix shortcuts:

| Prefix | Workflow | Rigor |
|---|---|---|
| `fix:` | Repair | Lite |
| `repair:` | Repair | Deep |

The command describes Repair as the workflow for bugs, regressions, flaky
behavior, and incidents. Smoke/bootstrap mode validates real run state rather
than generic repo status.

## Declared workflow shape

The old workflow definition at `~/Code/circuit/skills/repair/circuit.yaml`
declares six steps:

| Step | Executor / kind | Writes |
|---|---|---|
| `frame` | orchestrator / checkpoint | `artifacts/brief.md`, plus checkpoint request/response files |
| `analyze` | orchestrator / synthesis | `artifacts/analysis.md` |
| `fix` | worker / dispatch | `artifacts/implementation-handoff.md`, plus fix job files |
| `verify` | orchestrator / synthesis | `artifacts/verification.md` |
| `review` | worker / dispatch | `artifacts/review.md`, plus review job files |
| `close` | orchestrator / synthesis | `artifacts/result.md` |

The declared phase order is:

```
Frame -> Analyze (reproduce + isolate) -> Fix -> Verify -> Review -> Close
```

Repair omits a dedicated Plan phase. Its planning discipline is the regression
contract plus the reproduction/root-cause analysis.

## Observed entry modes

The old workflow declares four entry modes:

| Entry mode | Rigor | Notes |
|---|---|---|
| `default` | Standard | Standard repair with independent review. |
| `lite` | Lite | Quick fix, test-first, no independent review. |
| `deep` | Deep | Broad investigation with evidence probes. |
| `autonomous` | Autonomous | Standard with auto-resolved checkpoints; escalates on no-repro. |

## Observed artifacts

The reference Repair surface has five gated workflow artifacts plus an
implementation handoff:

| Reference artifact | Shape | Role |
|---|---|---|
| `artifacts/brief.md` | Markdown | Objective, scope, verification commands, and a mandatory regression contract. |
| `artifacts/analysis.md` | Markdown | Repro results, repro confidence, hypotheses, eliminated hypotheses, root cause, and implications. |
| `artifacts/implementation-handoff.md` | Markdown | Mission and evidence contract for the fix worker. |
| `artifacts/verification.md` | Markdown | Regression test result, verification command results, and collateral regression check. |
| `artifacts/review.md` | Markdown | Independent review of the root-cause fix and regression test adequacy. |
| `artifacts/result.md` | Markdown | Root cause, fix summary, regression test, verification, residual risk, follow-ups, and PR summary. |

## Regression contract behavior

Repair's Frame phase requires a regression contract:

- expected behavior
- actual behavior
- repro command or recipe
- regression test, unless the bug is not yet reproducible

When the bug is reproducible, the regression test is Slice 0 and must fail
before the fix. When the bug is flaky or not yet reproducible, Repair uses a
diagnostic path inside Analyze: contain, instrument, defer the regression test
with a trigger, and continue root-cause work from the available signal.

## Review and close behavior

The old Repair workflow skips independent review at Lite rigor. Standard,
Deep, and Autonomous include a reviewer dispatch that checks whether the fix
actually addresses the root cause, whether the regression test is adequate, and
whether new failure modes were introduced.

Close requires the result artifact to carry:

- root cause
- fix
- regression test
- verification
- PR summary

## circuit-next implication

Repair should be treated as a clean-break structured JSON successor to old
Circuit's Markdown Repair artifacts. The reference shape still matters:
circuit-next should preserve the six-step workflow, the regression-contract
discipline, the reproduce-and-isolate Analyze phase, the test-first fix path
when reproducible, the diagnostic path for no-repro bugs, verification before
review, and Lite's review skip.

Because Build already landed checkpoint, dispatch, verification-command, entry
mode, and close-artifact substrate, the first Repair plan should reuse those
pieces. The main new work is Repair-specific artifact schemas and gates:
regression contract, repro/root-cause analysis, fix evidence, verification,
review, and result.
