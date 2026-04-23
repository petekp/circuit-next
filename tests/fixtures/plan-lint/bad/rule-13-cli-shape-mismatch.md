---
plan: rule-13-cli-shape-mismatch
status: evidence-draft
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-13-proof
---

# Bad fixture — rule #13: CLI invocation shape mismatch

## Why this plan exists

Fixture using a CLI flag that does not exist in `src/cli/dogfood.ts`.
Plan-lint rule #13 (`plan-lint.cli-invocation-shape-matches`) must fire
red.

## §1 — Evidence census

### §1.A Claims

| # | Claim | Status |
|---|---|---|
| E1 | --nonexistent-flag is not in dogfood.ts argv parser | verified |

### §1.B Hypotheses

*None.*

### §1.C Unknown-blocking

*None.*

## §2 — The arc

### Slice 1

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Rule #13 un-exercised.

**Deliverable:** Command body invokes
`npm run circuit:run -- explore --nonexistent-flag foo`.

**Acceptance evidence:** Rule #13 fires red.

**Alternate framing:** *(a) Use --goal.* Rejected — bad fixture.

**Ratchet:** None.

**Codex challenger:** Not required.

## §3 — Acceptance evidence for arc close

1. Rule #13 fires red.
