---
plan: rule-14-artifact-cardinality-no-reference
status: evidence-draft
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-14-proof
---

# Bad fixture — rule #14: artifact cardinality without reference

## Why this plan exists

Fixture declaring "4 new artifact rows" for a successor-to-live surface
without recording reference-surface cardinality. Plan-lint rule #14
(`plan-lint.artifact-cardinality-mapped-to-reference`) must fire red.

## §1 — Evidence census

### §1.A Claims

| # | Claim | Status |
|---|---|---|
| E1 | Declares 4 artifacts for successor-to-live surface | verified |

### §1.B Hypotheses

*None.*

### §1.C Unknown-blocking

*None.*

## §2 — The arc

### Slice 1

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Rule #14 un-exercised.

**Deliverable:**
1. Successor-to-live review surface adds 4 new artifact rows: scope,
   report, verification, result.

**Acceptance evidence:** Rule #14 fires red.

**Alternate framing:** *(a) Record reference cardinality.* Rejected —
bad fixture.

**Ratchet:** None.

**Codex challenger:** Not required.

## §3 — Acceptance evidence for arc close

1. Rule #14 fires red.
