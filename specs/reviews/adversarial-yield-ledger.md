---
name: adversarial-yield-ledger
description: Ledger of adversarial review pass yield used to tune D10 review-discipline priors.
type: ledger
date: 2026-04-20
---

# Adversarial Yield Ledger

One row per adversarial pass. `operator_justification_if_past_cap` is `n/a`
until a pass exceeds the D10 cap for its artifact class.

| pass_date | artifact_path | pass_number_for_artifact | reviewer_id | mode | HIGH_count | MED_count | LOW_count | verdict | operator_justification_if_past_cap |
|---|---|---:|---|---|---:|---:|---:|---|---|
| 2026-04-20 | `specs/plans/phase-1-close-revised.md` | 1 | gpt-5-codex | llm-review | 7 | 5 | 3 | ACCEPT-WITH-FOLD-INS | n/a |
| 2026-04-20 | `specs/plans/phase-1-close-revised.md` | 2 | claude-opus-4-7+gpt-5-codex | llm-cold-read-standin-for-human | 0 | 8 | 8 | ACCEPT-WITH-FOLD-INS | n/a |

**Pass 2 context.** Pass 2 is an L3 non-LLM cold-read, delegated to Claude + Codex as LLM stand-ins under operator authorization while the operator was asleep. The delegation is recorded as reviewer_role `LLM-standin-for-human-cold-read` in `specs/reviews/phase-1-close-reform-human.md`. Counts are 0 HIGH / 8 MED / 8 LOW; all MED and LOW findings were folded back into the plan in this planning pass. Pass 2 did not violate D10 artifact-size signal (pass count 2 < governance cap 3). A genuine operator cold-read on pickup may append a third evaluator section to the review record; that addition does not count as a new adversarial pass unless it raises defects.
