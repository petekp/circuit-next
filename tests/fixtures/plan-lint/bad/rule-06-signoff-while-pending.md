---
plan: rule-06-signoff-while-pending
status: evidence-draft
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-06-proof
operator_signoff: ready
challenger_status: pending
---

# Bad fixture — rule #6: operator_signoff ready while challenger pending

## Why this plan exists

Fixture with frontmatter `operator_signoff: ready` AND
`challenger_status: pending`. Plan-lint rule #6
(`plan-lint.signoff-while-pending`) must fire red.

## §1 — Evidence census

### §1.A Claims

| # | Claim | Status |
|---|---|---|
| E1 | Frontmatter combination triggers rule #6 | verified |

### §1.B Hypotheses

*None.*

### §1.C Unknown-blocking

*None.*

## §2 — The arc

### Slice 1

**Lane:** Discovery.

**Failure mode addressed:** Rule #6 un-exercised.

**Deliverable:** Frontmatter above.

**Acceptance evidence:** Rule #6 fires red.

**Alternate framing:** *(a) Set operator_signoff: blocked.* Rejected.

**Ratchet:** None.

**Codex challenger:** Not required.

## §3 — Acceptance evidence for arc close

1. Rule #6 fires red.
