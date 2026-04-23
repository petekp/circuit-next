---
plan: rule-23-chronology-violating
status: evidence-draft
revision: 01
opened_at: 2026-04-23
base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
target: rule-23-proof
---

# Bad fixture — rule #23 P1 + P2 + P3

## Why this plan exists

Demonstrates the forward-chronology pattern at `defe76e:830-885` —
the exact shape rule #23 was introduced to prevent.

## §1 — Evidence census

| # | Claim | Status |
|---|---|---|
| E1 | Fixture carries violating chronology | verified |

## Next steps (revision 07)

1. Commit revision 07 + pass 06 review (Slice 57e).
2. Dispatch Codex pass 07 against committed revision 07.
3. If ACCEPT: pass 07 artifact commits; status transitions
   `challenger-pending → challenger-cleared` (Slice 57f); operator
   sign-off inferred from autonomy directive + explicitly disclosed
   in the commit body (Slice 57g); Slice 57 proper (ADRs) opens.
4. If REJECT again: pause and await explicit operator input — 7
   passes is the hard bound.

Slice 58 lands the plan-lint rule harness and Slice 59 introduces
the invariant vocab JSON. Slice 60 advances the stale-symbol
citation and Slice 61 dispatches the CLAUDE.md discipline update.
