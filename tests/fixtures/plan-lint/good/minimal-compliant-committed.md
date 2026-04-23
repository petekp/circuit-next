---
plan: minimal-compliant-committed
status: challenger-pending
revision: 01
opened_at: 2026-04-23
base_commit: 00f6e662b8b511aad1545f1858f39c7f43a86293
target: minimal-committed-compliance-proof
trigger: |
  Purpose-built minimal compliant plan fixture for the COMMITTED
  context. Sibling of minimal-compliant-plan.md (which covers the
  AUTHORING context at status: evidence-draft). Plan-lint rule
  suite returns GREEN on this fixture under both
  --context=authoring (default) and --context=committed, because
  challenger-pending is the overlap state between AUTHORING_STATUSES
  and COMMITTED_STATUSES per ADR-0010 §1 two-set overlay.
authority:
  - specs/adrs/ADR-0010-arc-planning-readiness-gate.md (gate definition)
---

# Minimal Compliant Plan — Committed Context

Demonstrates the smallest possible plan that passes all plan-lint rules
under `--context=committed` (the audit Check 36 invocation mode).

## Why this plan exists

Known-good fixture for the COMMITTED context. Sibling of
`minimal-compliant-plan.md` (AUTHORING context). This fixture carries
`status: challenger-pending` — the overlap state between
`AUTHORING_STATUSES` = {evidence-draft, challenger-pending} and
`COMMITTED_STATUSES` = {challenger-pending, challenger-cleared,
operator-signoff, closed} per ADR-0010 §1 two-set overlay. As the
overlap state, challenger-pending is VALID in both contexts; this
fixture therefore passes `plan-lint` under both
`--context=authoring` and `--context=committed`.

Arc goal: provide a green committed-context lint target so tests can
exercise the Check-36 invocation path without relying on real plan
artifacts. Phase goal: close the context-divergence risk (pass-05 F1).
Trajectory: the prior fixture (minimal-compliant-plan.md) only covers
the authoring context; this one fills the committed-context gap.

## §1 — Evidence census

### §1.A Claims

| # | Claim | Status |
|---|---|---|
| E1 | challenger-pending is in both AUTHORING_STATUSES and COMMITTED_STATUSES | verified |
| E2 | plan-lint rule #15 is parameterized by context per ADR-0010 | verified |

### §1.B Hypotheses

| # | Hypothesis | Resolution point |
|---|---|---|
| H1 | This fixture returns zero findings under both contexts | Test run |

### §1.C Unknown-blocking

*None.*

## §2 — The arc

Single-fixture authoring scope.

### §2.A — Scope

**Lane:** Discovery (research spike — "does the fixture pass in both contexts?").

**Failure mode addressed:** Without a purpose-built committed-context
known-good fixture, the Check-36 invocation path stays unexercised in
the lint test suite and silent drift can hide the two-set boundary.

**Deliverable:**
1. This file, at `tests/fixtures/plan-lint/good/minimal-
   compliant-committed.md`.

**Acceptance evidence:**
- Plan-lint returns zero findings under `--context=authoring`.
- Plan-lint returns zero findings under `--context=committed`.
- Test suite exercises both contexts on this fixture.

**Why this not adjacent:**
- Reuse `minimal-compliant-plan.md` for both contexts. Rejected —
  that fixture is at `evidence-draft` and fires rule #15 under
  committed context by design (evidence-draft ∉ COMMITTED_STATUSES).
  A dedicated overlap-state fixture is cleaner.

**Ratchet:** Known-good fixture count (1 → 2).

**Codex challenger:** Not required for a fixture file.

## §3 — Acceptance evidence for arc close

1. File committed at the declared path.
2. Plan-lint returns zero findings under both `--context=authoring`
   and `--context=committed`.
3. Test suite includes this file as a known-good fixture for both
   contexts.
