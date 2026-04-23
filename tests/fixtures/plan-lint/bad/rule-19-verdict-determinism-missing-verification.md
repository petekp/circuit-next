---
plan: rule-19-verdict-determinism-missing-verification
status: evidence-draft
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-19-proof
---

# Bad fixture — rule #19: verdict determinism missing verification-passes

## Why this plan exists

Fixture declaring a verdict rule for a successor-to-live surface where
the rule omits a verification-passes clause. Plan-lint rule #19
(`plan-lint.verdict-determinism-includes-verification-passes-for-
successor-to-live`) must fire red.

## §1 — Evidence census

### §1.A Claims

| # | Claim | Status |
|---|---|---|
| E1 | Verdict rule below omits verification clause | verified |

### §1.B Hypotheses

*None.*

### §1.C Unknown-blocking

*None.*

## §2 — The arc

### Slice 1

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Rule #19 un-exercised.

**Deliverable:** The successor-to-live review-workflow verdict is
deterministic: CLEAN iff the Critical finding count is 0 AND the High
finding count is 0. Reference cardinality: one artifact per rerun.

**Acceptance evidence:** Rule #19 fires red.

**Alternate framing:** *(a) Add verification clause.* Rejected — bad
fixture.

**Ratchet:** None.

**Codex challenger:** Not required.

## §3 — Acceptance evidence for arc close

1. Rule #19 fires red.
