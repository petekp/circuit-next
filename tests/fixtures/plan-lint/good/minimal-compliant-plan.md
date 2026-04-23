---
plan: minimal-compliant-plan
status: evidence-draft
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: minimal-compliance-proof
trigger: |
  Purpose-built minimal compliant plan fixture for plan-lint known-good
  testing. Demonstrates every required section + valid status + no
  violations. Plan-lint rule suite must return GREEN on this fixture.
authority:
  - specs/adrs/ADR-0010-arc-planning-readiness-gate.md (gate definition)
---

# Minimal Compliant Plan

Demonstrates the smallest possible plan that passes all plan-lint rules.

## Why this plan exists

Known-good fixture demonstrating the shape of a multi-slice plan that
explains its arc-level trajectory. The "Why this plan exists" section
(or equivalent §Entry-state) names the arc goal, the phase goal, and
whether earlier slices have shifted the terrain. This is now a prose
convention honored at plan-authoring time, not a mechanically-enforced
rule — rule #11 arc-trajectory-check-present was cut in Slice 65 and
the concept folded into the commit-body framing pair.

This fixture's arc goal: produce a known-good lint target. Phase goal:
bootstrap plan-lint's test suite. Trajectory: no earlier slice has
made this fixture smaller or obsolete; fixture authoring is the first
step of landing plan-lint.

## §1 — Evidence census

### §1.A Claims

| # | Claim | Status |
|---|---|---|
| E1 | plan-lint tool will exist at scripts/plan-lint.mjs | inferred |
| E2 | Rules #1-#17 are authored in ADR-0010 §6 | verified |

### §1.B Hypotheses

| # | Hypothesis | Resolution point |
|---|---|---|
| H1 | This fixture returns zero findings under plan-lint | Test run at Slice 58 |

### §1.C Unknown-blocking

*None.*

## §2 — The arc

Single-slice arc.

### Slice 1 — minimal compliance proof

**Lane:** Discovery (research spike — "does the fixture pass?").

**Failure mode addressed:** Without a purpose-built known-good fixture,
plan-lint's test suite grandfathers legacy plans and loses precision.

**Deliverable:**
1. This file, located at `tests/fixtures/plan-lint/good/minimal-
   compliant-plan.md`.

**Acceptance evidence:**
- Plan-lint returns zero findings.
- Test `plan-lint rules fire on bad fixtures but not on this good one`
  passes.

**Alternate framing:**
- Use p2-11-plugin-wiring.md as known-good. Rejected — p2-11 lacks
  §Evidence census + §Why-this-plan-exists and would trigger rules
  #1 and #11. Purpose-built fixture is cleaner.

**Ratchet:** Known-good fixture count (0 → 1).

**Codex challenger:** Not required for a fixture file authoring slice.

## §3 — Acceptance evidence for arc close

1. File committed at the declared path.
2. Plan-lint returns zero findings against this file.
3. Test suite includes this file as known-good fixture.
