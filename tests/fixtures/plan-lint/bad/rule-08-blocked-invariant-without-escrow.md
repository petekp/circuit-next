---
plan: rule-08-blocked-invariant-without-escrow
status: evidence-draft
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-08-proof
---

# Bad fixture — rule #8

## Why this plan exists

Fixture declaring a `blocked` invariant without full escrow terms.

## §1 — Evidence census

### §1.A Claims

| # | Claim | Status |
|---|---|---|
| E1 | Blocked invariant lacks substrate_slice + expiry_date + reopen_condition + acceptance_evidence | verified |

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

enforcement_layer: blocked
owner: platform-team

Partial escrow: owner is set but substrate_slice, expiry_date, reopen_condition, and acceptance_evidence are all missing. Plan-lint rule #8 rejects partial escrow.

**Acceptance evidence:** Plan-lint exits non-zero.

**Alternate framing:** *(a) Add full escrow.* Rejected — bad fixture.

**Ratchet:** None.

**Codex challenger:** Not required.
