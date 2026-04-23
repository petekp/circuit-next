---
plan: rule-17-cleared-without-challenger-artifact
status: challenger-cleared
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-17-proof
---

# Bad fixture — rule #17: challenger-cleared without matching artifact

## Why this plan exists

Fixture claiming `status: challenger-cleared` in frontmatter but no
matching committed `specs/reviews/rule-17-cleared-without-challenger-
artifact-codex-challenger-NN.md` exists. Plan-lint rule #17
(`plan-lint.status-challenger-cleared-requires-fresh-committed-
challenger-artifact`) must fire red.

## §1 — Evidence census

### §1.A Claims

| # | Claim | Status |
|---|---|---|
| E1 | No challenger file exists for this fixture slug | verified |

### §1.B Hypotheses

*None.*

### §1.C Unknown-blocking

*None.*

## §2 — The arc

### Slice 1

**Lane:** Discovery.

**Failure mode addressed:** Rule #17 un-exercised.

**Deliverable:** Frontmatter claim above.

**Acceptance evidence:** Rule #17 fires red (no matching challenger file).

**Alternate framing:** *(a) Commit a matching challenger.* Rejected —
bad fixture.

**Ratchet:** None.

**Codex challenger:** Not required.

## §3 — Acceptance evidence for arc close

1. Rule #17 fires red.
