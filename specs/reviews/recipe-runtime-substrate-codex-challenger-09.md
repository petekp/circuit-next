---
name: recipe-runtime-substrate-codex-challenger-09
description: Ninth Codex challenger pass for the recipe-runtime-substrate plan, revision 09 (post-pass-08 fold-in).
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: plan-challenger-review
review_date: 2026-04-25
verdict: ACCEPT-WITH-FOLD-INS
authored_by: gpt-5.4 via codex exec
reviewed_plan:
  plan_slug: recipe-runtime-substrate
  plan_revision: 09
  plan_base_commit: a7ecb2f85a9a9b0ff502acfc227d5863ac442798
  plan_content_sha256: 5e82bf9cb5adc53914b043550a8b43bcebddeed9d1e636d900b704d6319096a3
target: specs/plans/recipe-runtime-substrate.md
commands_run:
  - "codex exec -C /Users/petepetrash/Code/circuit-next --sandbox read-only --color never -m gpt-5.4 -"
opening_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  critical: 0
  high: 0
  med: 0
  low: 1
  meta: 0
---

Codex returns **ACCEPT-WITH-FOLD-INS**. This is a **bound pass**: the on-disk plan SHA matches `5e82bf9cb5adc53914b043550a8b43bcebddeed9d1e636d900b704d6319096a3`, and the plan self-declares `base_commit: a7ecb2f85a9a9b0ff502acfc227d5863ac442798`, matching the reviewed packet. Pass-08 F1/F2 fold-ins are real. One remaining LOW finding: §11 criterion 6 prose overstates the prerequisite-arc-widening's current on-disk state.

## Findings

1. **LOW — §11 criterion 6 still speaks as though the prerequisite widening is already live, but the cited on-disk sources are still pre-widening.**

   *Failure mode.* Criterion 6 is the safety catch that prevents this arc from being closed before the checkpoint-artifact widening exists. But the text at §11 currently says the prerequisite plan "has had its Slice A landed in code" and names `src/schemas/step.ts:176-191` plus a Workflow-level proof in `tests/contracts/schema-parity.test.ts` as if those are already present. On disk, they are not: `step.ts` still rejects any checkpoint artifact schema other than `build.brief@v1`, the contract test still contains only the old negative Step-level restriction test, and the prerequisite plan itself is still only at `status: challenger-cleared`. A reader following the close criterion literally could misread the prerequisite as already satisfied, which weakens the exact false-close defense this section is supposed to provide.

   *Fold-in.* Rewrite criterion 6 so it is explicitly future-state, not present-state. Keep the same prerequisite and same evidence surfaces, but change the prose from "has had its Slice A landed in code" / "reflects the widened shape" / "is on disk and green" to wording like "must have landed before this arc closes," then describe the expected code/test state to verify at close time. No design change is needed; this is a wording correction so the close criterion does not overclaim current on-disk state.

   *Pointer.* Plan: `specs/plans/recipe-runtime-substrate.md:1049-1074`. Source artifacts: `src/schemas/step.ts:176-191`; `tests/contracts/schema-parity.test.ts:560-610`; `specs/plans/runtime-checkpoint-artifact-widening.md:1-7`; `specs/adrs/ADR-0010-arc-planning-readiness-gate.md:146-150`.

## Bottom line

The packet is bound, the pass-08 carry-over fold-ins are real, and `npm run plan:lint -- --context=committed specs/plans/recipe-runtime-substrate.md` is green. I do not see a structural blocker in the recipe-item/runtime-step shape, the anti-drift split, or the revision-09 ownership cleanup. But §11 criterion 6 still overstates the current prerequisite state in present tense. Fold that wording back to an explicit future close-time check, and this plan is ready to advance to `challenger-cleared` on the next commit.
