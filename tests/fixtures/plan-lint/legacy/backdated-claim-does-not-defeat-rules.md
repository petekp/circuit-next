---
plan: backdated-claim-does-not-defeat-rules
status: in-progress
revision: 01
opened_at: 2026-04-20
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: backdating-evasion-proof
---

# Legacy fixture — backdated frontmatter does NOT exempt from rules

## Why this plan exists

Fixture whose frontmatter claims `opened_at: 2026-04-20` (pre-effective
per ADR-0010 §Migration) BUT whose first-committed SHA is post-
META_ARC_FIRST_COMMIT (since this fixture is being added at Slice 58 or
later). Per ADR-0010 §Migration, legacy determination uses git
ancestry, not frontmatter claims — so this fixture is NOT legacy and
must go through the full 22-rule gate. The invalid `status: in-progress`
field must still cause rule #15 to fire red.

## §1 — Evidence census

### §1.A Claims

| # | Claim | Status |
|---|---|---|
| E1 | Git ancestry overrides frontmatter opened_at | verified |

### §1.B Hypotheses

*None.*

### §1.C Unknown-blocking

*None.*

## §2 — The arc

### Slice 1

**Lane:** Discovery.

**Failure mode addressed:** Backdating-evasion-impossible promise
un-tested.

**Deliverable:** Frontmatter above plus invalid status value.

**Acceptance evidence:** Plan-lint fires rule #15 red. Legacy-exemption
does NOT apply because git ancestry shows this file is post-
META_ARC_FIRST_COMMIT regardless of frontmatter claim.

**Alternate framing:** *(a) Skip this test.* Rejected — the explicit
promise of ADR-0010 is that backdating cannot defeat rules; testing
requires a fixture that backdates.

**Ratchet:** None.

**Codex challenger:** Not required.

## §3 — Acceptance evidence for arc close

1. Rule #15 fires red on this fixture.
