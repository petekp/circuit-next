---
plan: rule-07-invariant-without-enforcement-layer
status: evidence-draft
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-07-proof
---

# Bad fixture — rule #7

## Why this plan exists

Fixture declaring an invariant without the enforcement_layer field.

## §1 — Evidence census

### §1.A Claims

| # | Claim | Status |
|---|---|---|
| E1 | Invariant declared without enforcement_layer field | verified |

### §1.B Hypotheses

*None.*

### §1.C Unknown-blocking

*None.*

## §2 — The arc

### Slice 1

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Rule coverage gap.

**Deliverable:**

### REVIEW-I1

A new review-workflow invariant: verdict must be deterministic under fixed inputs. No enforcement_layer field accompanies this declaration. The property_id ledger cites REVIEW-I1 from specs/contracts/review.md §Invariants.

**Acceptance evidence:** Plan-lint exits non-zero.

**Alternate framing:** *(a) Add enforcement_layer field.* Rejected — bad fixture.

**Ratchet:** None.

**Codex challenger:** Not required.
