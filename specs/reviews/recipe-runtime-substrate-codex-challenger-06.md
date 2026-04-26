---
name: recipe-runtime-substrate-codex-challenger-06
description: Sixth Codex challenger pass for the recipe-runtime-substrate plan, revision 06 (post-pass-05 fold-in).
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: plan-challenger-review
review_date: 2026-04-25
verdict: REJECT-PENDING-FOLD-INS
authored_by: gpt-5.4 via codex exec
reviewed_plan:
  plan_slug: recipe-runtime-substrate
  plan_revision: 06
  plan_base_commit: c099739b1cf85b20b96738ef08ec214e4fca5648
  plan_content_sha256: 540b29daaeda64a0adaf2eb48fffb91c7b55bf1d6791968f1bca71a77bbc4020
target: specs/plans/recipe-runtime-substrate.md
commands_run:
  - "codex exec -C /Users/petepetrash/Code/circuit-next --sandbox read-only --color never -m gpt-5.4 -"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: REJECT-PENDING-FOLD-INS
severity_counts:
  critical: 0
  high: 1
  med: 0
  low: 1
  meta: 0
---

Codex returns **REJECT-PENDING-FOLD-INS**. This is a **bound pass**: the on-disk plan SHA matches `540b29daaeda64a0adaf2eb48fffb91c7b55bf1d6791968f1bca71a77bbc4020`, and the plan self-declares `base_commit: c099739b1cf85b20b96738ef08ec214e4fca5648`, matching the reviewed packet. Pass-05 fold-ins (F1 §5 normalization, F2 E4 evidence-row correction) are real. Two remaining issues are mechanical: Slice D's planned review filenames don't match the audit's ceremony filename regex (HIGH); and the Fix recipe execution-kind count is numerically wrong (LOW).

## Findings

1. **HIGH — Slice D's planned review filenames cannot satisfy the current ceremony audit path.**

   *Failure mode.* The plan says Slice D closes with two prong files named `recipe-runtime-substrate-arc-close-...` and only wires `ARC_CLOSE_GATES` to that filename family. But the current audit's arc-subsumption validator accepts ceremony-review evidence only when the basename matches `arc-.+-composition-review-(claude|codex).md`; otherwise it rejects the path as neither a valid arc-close review nor a valid per-slice review. On a Heavy ceremony commit, that means the planned Codex prong cannot honestly satisfy `Codex challenger: REQUIRED`, so §11's claim that `npm run audit` goes green on the closing commit is not reachable from the Slice D work as currently specified.

   *Fold-in.* Rewrite §8.2 to use the repo's ceremony filename shape and an arc-bound subset regex, for example `arc-recipe-runtime-substrate-composition-review-{claude,codex}.md`, and say explicitly that Slice D's audit-test updates cover both `ARC_CLOSE_GATES` and Check 35 / arc-subsumption shape. If the intent is to keep the current filenames, the plan must instead budget the extra audit-pattern/test widening or a separate per-slice Codex review record; as written, it budgets neither.

   *Pointer.* Plan: `specs/plans/recipe-runtime-substrate.md:879-900`, `specs/plans/recipe-runtime-substrate.md:999-1002`. Source: `scripts/audit.mjs:5041-5042`, `scripts/audit.mjs:5124-5145`, `specs/plans/runtime-checkpoint-artifact-widening.md:561-580`.

2. **LOW — Slice A's execution-kind coverage sentence is numerically false against the current Fix recipe.**

   *Failure mode.* The acceptance bullet says the Fix backfill exercises 12 items as "4 synthesis, 4 verification, 3 dispatch, 1 checkpoint." The on-disk Fix recipe is actually 6 synthesis, 4 dispatch, 1 verification, 1 checkpoint. That does not change the seam design, but it does leave the acceptance evidence literally misbound to the cited fixture.

   *Fold-in.* Replace the count sentence with `6 synthesis, 4 dispatch, 1 verification, 1 checkpoint`, or remove the numeric breakdown and say only that the Fix backfill spans all four execution kinds.

   *Pointer.* Plan: `specs/plans/recipe-runtime-substrate.md:754-760`. Source: `specs/workflow-recipes/fix-candidate.recipe.json:54-336` (execution-kind lines at 66, 90, 110, 131, 158, 185, 207, 230, 257, 283, 308, 335).

## Bottom line

Revision 06 really does close pass-05's F1 and F2 fold-ins. But it is not ready for `challenger-cleared` yet, because Slice D's close path is still misbound to the on-disk audit's ceremony filename rules, which makes the claimed green close path structurally incomplete. Once that is fixed, the remaining visible cleanup is the one acceptance-evidence count sentence.
