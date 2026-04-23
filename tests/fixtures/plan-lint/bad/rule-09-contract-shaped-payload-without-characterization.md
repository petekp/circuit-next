---
plan: rule-09-contract-shaped-payload-without-characterization
status: evidence-draft
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-09-proof
---

# Bad fixture — rule #9

## Why this plan exists

Fixture declares contract-shaped payload for a successor-to-live surface.

## §1 — Evidence census

### §1.A Claims

| # | Claim | Status |
|---|---|---|
| E1 | Successor-to-live surface declared | verified |

### §1.B Hypotheses

*None.*

### §1.C Unknown-blocking

*None.*

## §2 — The arc

### Slice 1

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Rule coverage gap.

**Deliverable:**
1. Successor-to-live surface contract with:
   - `artifact_ids: [review.scope, review.report]`
   - REVIEW-I1 definition.

**Acceptance evidence:** Plan-lint exits non-zero.

**Alternate framing:** *(a) Land reference classification slice first.* Rejected.

**Ratchet:** None.

**Codex challenger:** Not required.
