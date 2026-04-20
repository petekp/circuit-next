---
name: adversarial-yield-ledger
description: Ledger of adversarial review pass yield used to tune D10 review-discipline priors.
type: ledger
date: 2026-04-20
---

# Adversarial Yield Ledger

One row per adversarial pass. `artifact_class` values are `reversible`,
`governance`, or `irreversible` and map to D10 caps 2 / 3 / 4.
`operator_justification_if_past_cap` is `n/a` until a pass exceeds the D10
cap for its artifact class; when past-cap, it must be substantive
(≥ 30 characters, not a placeholder like `tbd` / `none` / `see body`).
Mode-cycle rule: three consecutive passes on the same artifact in the same
`mode` without an intervening structurally different mode is rejected by
audit (D10 clause 3, K=2).

| pass_date | artifact_path | artifact_class | pass_number_for_artifact | reviewer_id | mode | HIGH_count | MED_count | LOW_count | verdict | operator_justification_if_past_cap |
|---|---|---|---:|---|---|---:|---:|---:|---|---|
| 2026-04-20 | `specs/plans/phase-1-close-revised.md` | governance | 1 | gpt-5-codex | llm-review | 7 | 5 | 3 | ACCEPT-WITH-FOLD-INS | n/a |
| 2026-04-20 | `specs/plans/phase-1-close-revised.md` | governance | 2 | claude-opus-4-7+gpt-5-codex | llm-cold-read-standin-for-human | 0 | 8 | 8 | ACCEPT-WITH-FOLD-INS | n/a |
| 2026-04-20 | `specs/reviews/arc-slice-25b-drafted-docs-codex.md` | governance | 1 | gpt-5-codex | llm-review | 2 | 2 | 1 | REJECT pending HIGH fold-ins | n/a |

**Pass 2 context.** Pass 2 is an L3 non-LLM cold-read, delegated to Claude + Codex as LLM stand-ins under operator authorization while the operator was asleep. The delegation is recorded as reviewer_role `LLM-standin-for-human-cold-read` in `specs/reviews/phase-1-close-reform-human.md`. Counts are 0 HIGH / 8 MED / 8 LOW; all MED and LOW findings were folded back into the plan in this planning pass. Pass 2 did not violate D10 artifact-size signal (pass count 2 < governance cap 3). A genuine operator cold-read on pickup may append a third evaluator section to the review record; that addition does not count as a new adversarial pass unless it raises defects.

**Slice 25b drafted-doc-set pass context.** Codex challenger pass on the
Slice 25b implementation (HEAD 870f040, impl commit c673a7b) surfaced 2 HIGH
findings: (1) exemption ledger integrity was seed-only (no rejection on
second-row insertion, no per-row authorization, no amend-D1/D3 detection);
(2) D10 pass budgets were prose-only (audit did not parse pass_number vs
cap, did not reject placeholder justifications, did not enforce mode-cycle).
Both HIGH folded in by the current hotfix slice (adds `authorization_record`
column to exemption ledger, `artifact_class` column to this ledger, and
three strengthened audit checks). MED 1 (TIER status semantics) also folded
in same slice. MED 2 (load-bearing dependency classification) and LOW 1
(prompt-target-SHA ambiguity) deferred to later work — dispositions recorded
in `specs/reviews/slice-25b-drafted-docs-codex.md`.
