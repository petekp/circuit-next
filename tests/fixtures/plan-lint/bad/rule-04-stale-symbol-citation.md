---
plan: rule-04-stale-symbol-citation
status: evidence-draft
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-04-proof
---

# Bad fixture — rule #4: stale symbol citation

## Why this plan exists

Fixture citing a symbol that does not exist in the cited file. Plan-lint
rule #4 (`plan-lint.stale-symbol-citation`) must fire red.

## §1 — Evidence census

### §1.A Claims

| # | Claim | Status |
|---|---|---|
| E1 | Cited symbol will be nonexistent | verified |

### §1.B Hypotheses

*None.*

### §1.C Unknown-blocking

*None.*

## §2 — The arc

### Slice 1

**Lane:** Discovery.

**Failure mode addressed:** Rule #4 un-exercised.

**Deliverable:** Reference `scripts/audit.mjs:DEFINITELY_NOT_A_REAL_SYMBOL_XYZ`.

**Acceptance evidence:**
- Rule #4 fires red on the stale citation above.

**Alternate framing:** *(a) Use a real symbol.* Rejected — bad fixture.

**Ratchet:** None.

**Codex challenger:** Not required.

## §3 — Acceptance evidence for arc close

1. Rule #4 fires red.
