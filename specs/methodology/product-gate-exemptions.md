---
name: product-gate-exemptions
description: Machine-readable ledger of consumed Product Reality Gate exemptions.
type: ledger
date: 2026-04-20
---

# Product Gate Exemptions

`phase_id` is `phase-1.5-alpha-proof` post-Slice-25d. The Slice 25b seed row
below was authored with `phase-1-pre-1.5-reopen` (the pre-reopen planning
identifier); Slice 25d rewrote it to `phase-1.5-alpha-proof` when ADR-0001
Addendum B authorized Phase 1.5 semantics. The rewrite is a rename of the
same phase; the row's substance (Slice 25b consumed a one-time
bootstrap-exception waiver) is unchanged.

Every row must name an `authorization_record` — a path to a review record,
ADR, or operator sign-off file that exists on disk. Rows whose `reason` text
mentions amending D1 or D3 are rejected by audit: D1 is meta-rule and D3 is
graph root, neither is waivable through this ledger. Beyond the one-time
bootstrap-exception seed row, any new row must be tied to a slice commit
declaring `Lane: Break-Glass` (operator discipline; not machine-enforced at
this slice — planned as part of Slice 25c).

| phase_id | slice | reason | consumed | authorization_record |
|---|---|---|---|---|
| phase-1.5-alpha-proof | 25b | bootstrap exception — the slice that changes future acceptance terms cannot itself be proof those terms work | true | `specs/reviews/phase-1-close-reform-human.md` |
