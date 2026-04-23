---
plan: rule-05-arc-close-claim-without-gate
status: evidence-draft
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-05-proof
---

# Bad fixture — rule #5

## Why this plan exists

Fixture makes an arc-close satisfaction claim without naming the
enforcing ratchet.

## §1 — Evidence census

### §1.A Claims

| # | Claim | Status |
|---|---|---|
| E1 | Unbound arc-close claim | verified |

### §1.B Hypotheses

*None.*

### §1.C Unknown-blocking

*None.*

## §2 — The arc

### Slice 1

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Rule coverage gap.

**Deliverable:** Arc close is satisfied when all tests pass green.

**Acceptance evidence:** Plan-lint exits non-zero.

**Alternate framing:** *(a) Name the ratchet.* Rejected — bad fixture.

**Ratchet:** None.

**Codex challenger:** Not required.
