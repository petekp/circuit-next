---
name: recipe-runtime-substrate-codex-challenger-05
description: Fifth Codex challenger pass for the recipe-runtime-substrate plan, revision 05 (post-pass-04 fold-in).
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
  plan_revision: 05
  plan_base_commit: 04ddb2f88b7408cd1f01ac663cf739083ad2f65c
  plan_content_sha256: f1ebca717d6522dee8e2e30418d8e3ecb0a1687e4322385367cd6a00402f1f3e
target: specs/plans/recipe-runtime-substrate.md
commands_run:
  - "codex exec -C /Users/petepetrash/Code/circuit-next --sandbox read-only --color never -m gpt-5.4 -"
opening_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  critical: 0
  high: 0
  med: 1
  low: 1
  meta: 0
---

Codex returns **ACCEPT-WITH-FOLD-INS**. This is a **bound pass**: the on-disk plan SHA matches `f1ebca717d6522dee8e2e30418d8e3ecb0a1687e4322385367cd6a00402f1f3e`, and the plan self-declares `base_commit: 04ddb2f88b7408cd1f01ac663cf739083ad2f65c`, matching the reviewed packet. The pass-04 blockers are substantively closed: the prerequisite-arc close dependency is now explicit, the prerequisite `base_commit` is correctly rebound to `190122d`, and §8.1 definitively names parser-side Rule 1, test-side Rule 2, and the Fix-table export promotion. Two remaining issues are mechanical wording cleanups.

## Findings

1. **MED — §5 still contradicts itself on where F1's two anti-drift rules are enforced.**

   *Failure mode.* Revision 05 does close pass-04 F3 in §8.1: Rule 1 is parser-side at `WorkflowRecipe` level, Rule 2 is Fix-only contract-test enforcement, and the Fix tables are promoted for direct test import. But §5 still says the two binding rules are "enforced at parse time," calls Rule 1 a `WorkflowRecipeItem` superRefine even while explaining it must run at recipe level, and then lists Fix-table parity under "Failure modes the parsers reject" even though the same section says Fix-table parity is test-only. That leaves one stale path back to the parser-vs-test ambiguity that pass-04 explicitly required this revision to remove.

   *Fold-in.* Normalize §5 to the same split already stated in §8.1: change the parent sentence at the anti-drift rule block to say the rules use split enforcement surfaces, rename Rule 1's hook to `WorkflowRecipe` superRefine, and either retitle `### Failure modes the parsers reject` to a slice-wide heading or remove the Fix-table-parity bullet from that parser-only list. No design change is needed; this is a wording-honesty cleanup.

   *Pointer.* Plan: `specs/plans/recipe-runtime-substrate.md:501-537`, `specs/plans/recipe-runtime-substrate.md:589-614`, `specs/plans/recipe-runtime-substrate.md:801-833`. Source: `src/schemas/workflow-recipe.ts:160-233`, `src/schemas/artifacts/fix.ts:4-22`, `specs/reviews/recipe-runtime-substrate-codex-challenger-04.md:50-56`.

2. **LOW — E4 is marked verified against a `WorkflowRecipeItem` shape that is not the current on-disk schema.**

   *Failure mode.* E4 says `WorkflowRecipeItem` exposes `output, edges, selection?` and implies an older item shape, but the cited schema currently exposes `routes` and `route_overrides`, with `evidence_requirements` required and `edges` belonging only to the later draft shape. Because the evidence census is the plan's claimed current-state basis, this stale row can misdirect a later fold-in or review toward the wrong surface.

   *Fold-in.* Rewrite E4 to match `src/schemas/workflow-recipe.ts:103-158` literally: `input` defaulted, `evidence_requirements` required, `routes` plus `route_overrides`, no `runtime_step` yet, and no `edges` on `WorkflowRecipeItem`. If `edges` matters, point it at `WorkflowRecipeDraft` / `compileWorkflowRecipeDraft`, where that field actually exists.

   *Pointer.* Plan: `specs/plans/recipe-runtime-substrate.md:112-113`. Source: `src/schemas/workflow-recipe.ts:103-120`, `src/schemas/workflow-recipe.ts:293-315`, `specs/workflow-recipe-composition.md:113-123`, `specs/workflow-recipe-composition.md:160-167`.

## Bottom line

Revision 05 is bound, and the pass-04 blockers are substantively closed: the prerequisite-arc close dependency is now explicit, the prerequisite `base_commit` is correctly rebound to `190122d`, and §8.1 definitively names parser-side Rule 1, test-side Rule 2, and the Fix-table export promotion. The remaining work is mechanical text cleanup: make §5 match that same enforcement split, and correct the stale E4 evidence row. After those fold-ins, I do not see a structural reason to hold back `challenger-cleared`.
