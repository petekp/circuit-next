---
plan: rule-18-non-canonical-phase-set
status: evidence-draft
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-18-proof
---

# Bad fixture — rule #18

## Why this plan exists

Fixture declares a non-canonical phase set for a successor-to-live surface.

## §1 — Evidence census

### §1.A Claims

| # | Claim | Status |
|---|---|---|
| E1 | Declared phase titles are not canonical ids | verified |

### §1.B Hypotheses

*None.*

### §1.C Unknown-blocking

*None.*

## §2 — The arc

### Slice 1

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Rule coverage gap.

**Deliverable:** Successor-to-live workflow uses canonical phase set {Intake, IndependentAudit, VerificationRerun, Verdict} — four-phase spine without a title translation.

**Acceptance evidence:** Plan-lint exits non-zero.

**Alternate framing:** *(a) Use canonical ids.* Rejected — bad fixture.

**Ratchet:** None.

**Codex challenger:** Not required.
