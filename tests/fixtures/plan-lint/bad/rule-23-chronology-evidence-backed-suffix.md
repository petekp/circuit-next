---
plan: rule-23-chronology-evidence-backed-suffix
status: evidence-draft
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-23-evidence-backed-suffix-proof
---

# Bad fixture — rule #23 path-scope / narrow-skip discipline

## Why this plan exists

Section heading `## Evidence-backed rollout` is NOT in the exact
canonical skip list (`## §Evidence census`, `## §Prior pass log`,
`## §Appendix`, `## Example sequence`). The skip is exact-match
(no prefix match), so this plan must still be scanned and rule
#23 must fire.

## §1 — Evidence census

| # | Claim | Status |
|---|---|---|
| E1 | Suffix section is NOT in the exact canonical skip list | verified |

## Evidence-backed rollout

Slice 42 opens the adapter-binding coverage and Slice 43 lands the
AGENT_SMOKE fingerprint. Slice 44 prepares the next challenger
pass; Slice 45 commits the CODEX_SMOKE fixtures.
