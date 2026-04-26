---
name: recipe-runtime-substrate-codex-challenger-08
description: Eighth Codex challenger pass for the recipe-runtime-substrate plan, revision 08 (post-pass-07 fold-in).
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
  plan_revision: 08
  plan_base_commit: 3888d8dd8519e66621c4754974aba7db17c93fd1
  plan_content_sha256: a172830fe1add54e89624fb09077c0804996dcb59e5a59aff40e1df88979f079
target: specs/plans/recipe-runtime-substrate.md
commands_run:
  - "codex exec -C /Users/petepetrash/Code/circuit-next --sandbox read-only --color never -m gpt-5.4 -"
opening_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  critical: 0
  high: 0
  med: 0
  low: 2
  meta: 0
---

Codex returns **ACCEPT-WITH-FOLD-INS**. This is a **bound pass**: the on-disk plan SHA matches `a172830fe1add54e89624fb09077c0804996dcb59e5a59aff40e1df88979f079`, and the plan self-declares `base_commit: 3888d8dd8519e66621c4754974aba7db17c93fd1`, matching the reviewed packet. Pass-07 F1/F2/F3 fold-ins are real; F4 is partially complete (subsection retitled but inline parenthetical still uses old framing). Two LOW findings are mechanical text fixes.

## Findings

1. **LOW — F4 is not fully closed; §5 still contains a stale parser-only sentence that contradicts the retitled subsection.**

   *Failure mode.* The subsection is now correctly titled `Failure modes the schema or contract surface catches`, and it explicitly includes contract-test-only drift assertions. But the parenthetical at lines 624-627 still refers to the old parser-only framing and says the list is parser-only by definition. Under literal reading, that downgrades the test-surface assertions from declared enforcement to commentary, which is exactly the wording drift pass-07 said to remove.

   *Fold-in.* Replace the sentence at `624-627` so it matches the new heading and the actual enforcement split: the list is mostly parser-enforced, with explicitly labeled contract-test assertions, and Fix-table parity remains a separate test-surface rule under Rule 2. No scope change; this is a wording cleanup only.

   *Pointer.* Plan: `specs/plans/recipe-runtime-substrate.md:598-640`, especially `624-627`. Source artifacts for the non-parser surfaces named there: `scripts/policy/workflow-kind-policy.mjs:37-62`, `src/schemas/ids.ts:26-29`, `src/schemas/artifacts/fix.ts:4-22`.

2. **LOW — §8.1 assigns one checkpoint-policy refinement to the wrong enforcement surface.**

   *Failure mode.* In §5, the plan authors `CheckpointPolicyTemplate` with its own `superRefine` for duplicate `choices.id` and safe-choice membership. But §8.1 says `WorkflowRecipeItem` superRefine enforces those same checks. An implementer following §8.1 literally could move a template-local invariant up to the parent item schema, which muddies the plan's otherwise careful ownership split between item-level bindings and template-local validation.

   *Fold-in.* In §8.1, split the acceptance evidence so `WorkflowRecipeItem` superRefine owns only the item-level rules `(i)` and `(ii)`, while `CheckpointPolicyTemplate` superRefine owns `(iii)` duplicate-choice and safe-choice membership checks mirroring runtime `CheckpointPolicy`. This is a one-line ownership correction, not a design change.

   *Pointer.* Plan: `specs/plans/recipe-runtime-substrate.md:435-455`, `719-730`. Source artifact: `src/schemas/step.ts:60-110`.

## Bottom line

Revision 08 is bound, the SHA and `base_commit` both match, the pass-07 F1/F2/F3 fold-ins are on disk, and I do not see a structural contradiction across §3, §4, §5, §8.1, and §11. But the remaining mechanical fold-ins are not zero: F4 still has one stale parser-only sentence, and §8.1 still misstates one refinement's ownership. Fold those two lines in, and the plan is ready to advance to `challenger-cleared` on the next commit.
