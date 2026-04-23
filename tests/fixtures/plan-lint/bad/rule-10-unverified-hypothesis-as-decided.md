---
plan: rule-10-unverified-hypothesis-as-decided
status: evidence-draft
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: review
---

# Bad fixture — rule #10: unverified hypothesis presented as decided

## Why this plan exists

Fixture declaring `target: review` (a workflow name) in frontmatter but
providing no §Evidence census row justifying that selection and no
`hypothesis:` marking. Plan-lint rule #10
(`plan-lint.unverified-hypothesis-presented-as-decided`) must fire red.

## §1 — Evidence census

### §1.A Claims

| # | Claim | Status |
|---|---|---|
| E1 | Frontmatter target `review` has no evidence-census backing | verified |

### §1.B Hypotheses

*None.*

### §1.C Unknown-blocking

*None.*

## §2 — The arc

### Slice 1

**Lane:** Discovery.

**Failure mode addressed:** Rule #10 un-exercised.

**Deliverable:** Frontmatter target claim without justification.

**Acceptance evidence:** Rule #10 fires red.

**Alternate framing:** *(a) Add target-selection evidence row.* Rejected.

**Ratchet:** None.

**Codex challenger:** Not required.

## §3 — Acceptance evidence for arc close

1. Rule #10 fires red.
