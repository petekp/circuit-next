---
plan: rule-15-invalid-status
status: in-progress
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-15-proof
---

# Bad fixture — rule #15: invalid status vocabulary

## Why this plan exists

Fixture with `status: in-progress`, which is not in the canonical
plan-lifecycle vocabulary. Plan-lint rule #15
(`plan-lint.status-field-valid`) must fire red.

## §1 — Evidence census

### §1.A Claims

| # | Claim | Status |
|---|---|---|
| E1 | "in-progress" is not a canonical status value | verified |

### §1.B Hypotheses

*None.*

### §1.C Unknown-blocking

*None.*

## §2 — The arc

### Slice 1

**Lane:** Discovery.

**Failure mode addressed:** Rule #15 un-exercised.

**Deliverable:** Frontmatter above.

**Acceptance evidence:** Rule #15 fires red.

**Alternate framing:** *(a) Use evidence-draft.* Rejected — bad fixture.

**Ratchet:** None.

**Codex challenger:** Not required.

## §3 — Acceptance evidence for arc close

1. Rule #15 fires red.
