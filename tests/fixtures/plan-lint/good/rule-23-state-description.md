---
plan: rule-23-state-description
status: evidence-draft
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-23-compliant-proof
trigger: |
  Demonstrates the HEAD state-protocol authoring style — plan describes
  states and transitions as a state machine, not as narrative chronology
  of "Slice N does X then Slice N+1 does Y". Rule #23 stays silent.
authority:
  - specs/adrs/ADR-0010-arc-planning-readiness-gate.md (lifecycle definition)
---

# Rule #23 Compliant Plan — state-description form

## Why this plan exists

Arc goal: serve as a known-good fixture for rule #23 — prove that
state-description authoring never triggers the forbidden-chronology
detectors. Phase goal: anchor the rule's test suite with a positive
negative-control. Trajectory: no earlier slice has reshaped this
fixture; it is the first worked example of the cure rule #23 calls
for.

## §1 — Evidence census

### §1.A Claims

| # | Claim | Status |
|---|---|---|
| E1 | State-description prose is not forward chronology | verified |
| E2 | Rule #23 detectors stay silent on this fixture | verified |

### §1.B Hypotheses

*None.*

### §1.C Unknown-blocking

*None.*

## §2 — The arc

Single-slice fixture arc.

### §2.A Slice description

**Lane:** Discovery (authoring a known-good negative-control fixture).

**Failure mode addressed:** Without a positive negative-control, the
test suite cannot distinguish "rule #23 fires" from "rule #23 fires
on everything".

**Deliverable:** This fixture file, describing states rather than
narrating transitions.

**Acceptance evidence:** plan-lint against this fixture carries zero
`plan-lint.prospective-chronology-forbidden` findings.

**Alternate framing:** Express every claim as "Slice N does X then
Slice N+1 does Y". Rejected — that is the failure mode this fixture
is the negative-control for.

**Ratchet:** Known-good fixture count for rule #23 (0 → 1).

**Codex challenger:** Not required for a fixture authoring slice.

## §3 — Acceptance evidence for arc close

1. This file is committed under `tests/fixtures/plan-lint/good/`.
2. plan-lint against the file returns GREEN.
3. The rule #23 negative-control test case in
   `tests/scripts/plan-lint.test.ts` asserts the rule stays silent.
