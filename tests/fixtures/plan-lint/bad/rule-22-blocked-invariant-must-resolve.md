---
plan: rule-22-blocked-invariant-must-resolve
status: operator-signoff
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-22-proof
---

# Bad fixture — rule #22

## Why this plan exists

Fixture at `status: operator-signoff` carries a `blocked` invariant with
full escrow terms but no acceptance_evidence proving resolution. Rule #22
must fire: signoff cannot happen while blocked invariants are unresolved.

## §1 — Evidence census

### §1.A Claims

| # | Claim | Status |
|---|---|---|
| E1 | Blocked invariant present at signoff without resolution evidence | verified |

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
substrate_slice: Slice 99
owner: platform-team
expiry_date: 2026-06-01
reopen_condition: substrate slice slips
acceptance_evidence: pending substrate slice

The acceptance_evidence contains the word "pending" rather than a
resolution word (resolved / landed / closed / merged / enforced). Rule
#22 enforces that signoff requires actual resolution.

**Acceptance evidence:** Plan-lint exits non-zero.

**Alternate framing:** *(a) Wait until substrate lands.* Rejected — bad fixture.

**Ratchet:** None.

**Codex challenger:** Not required.
