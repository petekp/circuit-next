---
plan: rule-03-test-path-extension
status: evidence-draft
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-03-proof
---

# Bad fixture — rule #3

## Why this plan exists

Fixture declaring a test deliverable path ending in `.md` where the real
surface would be `.test.ts`.

## §1 — Evidence census

### §1.A Claims

| # | Claim | Status |
|---|---|---|
| E1 | Test paths end in .test.ts, not .md | verified |

### §1.B Hypotheses

*None.*

### §1.C Unknown-blocking

*None.*

## §2 — The arc

### Slice 1

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Rule coverage gap.

**Deliverable:**
1. `tests/runner/review.md` — new parity harness.

**Acceptance evidence:**
- Plan-lint exits non-zero.

**Alternate framing:** *(a) Rename to test.ts.* Rejected — bad fixture.

**Ratchet:** None.

**Codex challenger:** Not required.
