---
name: recipe-runtime-substrate-codex-challenger-07
description: Seventh Codex challenger pass for the recipe-runtime-substrate plan, revision 07 (post-pass-06 fold-in).
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
  plan_revision: 07
  plan_base_commit: e741a6709f704d518c343a9f71be9b1a17ffed32
  plan_content_sha256: c3008b3df4c535c67463ec34c9fe1b82812eda144b41952f86677515d1519f7f
target: specs/plans/recipe-runtime-substrate.md
commands_run:
  - "codex exec -C /Users/petepetrash/Code/circuit-next --sandbox read-only --color never -m gpt-5.4 -"
opening_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  critical: 0
  high: 0
  med: 0
  low: 4
  meta: 0
---

Codex returns **ACCEPT-WITH-FOLD-INS**. This is a **bound pass**: the on-disk plan SHA matches `c3008b3df4c535c67463ec34c9fe1b82812eda144b41952f86677515d1519f7f`, and the plan self-declares `base_commit: e741a6709f704d518c343a9f71be9b1a17ffed32`, matching the reviewed packet. Pass-06 fold-ins (F1 audit-canonical filenames, F2 count correction) are real. Four remaining LOW findings are mechanical text fixes; no structural blocker.

## Findings

1. **LOW — §8.2's Check 35 citation points at the wrong audit branch.**

   *Failure mode.* The revision-07 prose now describes the right naming convention, but its supporting pointer still cites `validateArcSubsumptionEvidence` at `scripts/audit.mjs:5124-5145`. Those lines are the per-slice / no-match branch, not the arc-close shape-(i) branch the sentence is relying on. A later reader checking the cited source will land on code that does not prove the claim being made.

   *Fold-in.* In §8.2, replace the `validateArcSubsumptionEvidence` citation with the arc-close validation branch at `scripts/audit.mjs:5080-5117`. If you want the Check 35 call site too, append `scripts/audit.mjs:5235-5259`, which is where the commit-body `arc-subsumption:` path is actually consumed.

   *Pointer.* Plan: `specs/plans/recipe-runtime-substrate.md:894-900`. Source: `scripts/audit.mjs:5080-5117`, `scripts/audit.mjs:5235-5259`. Current mis-cited range: `scripts/audit.mjs:5124-5145`.

2. **LOW — Slice A says the Fix result tables stay unchanged, then later requires changing them to named exports.**

   *Failure mode.* §8.1 first says `FIX_RESULT_PATH_BY_ARTIFACT_ID` and `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID` "remain ... unchanged," but the same acceptance evidence later requires Slice A to promote those file-local `const`s into named exports so the Fix-table parity test can import them. That is an internal contradiction in the acceptance evidence: an implementer following the first sentence literally would fail the later test-import requirement.

   *Fold-in.* Rewrite the earlier sentence so it distinguishes semantic stability from module-surface change. Example: the tables' contents remain unchanged as Fix-only authority, but Slice A promotes them to named readonly exports for the contract-test import path.

   *Pointer.* Plan: `specs/plans/recipe-runtime-substrate.md:790-806`, `specs/plans/recipe-runtime-substrate.md:822-830`. Source: `src/schemas/artifacts/fix.ts:4-22`.

3. **LOW — §11 uses `status` language for a state that ADR-0010 does not permit as a plan lifecycle value.**

   *Failure mode.* Close criterion 6/7 says "this arc is `blocked pending prerequisite close`" and "this arc's status is `blocked pending prerequisite close`." ADR-0010 and `plan-lint` allow committed plans to be only `challenger-pending`, `challenger-cleared`, `operator-signoff`, or `closed`. Because §11 uses the word `status` explicitly, a future editor could literalize that prose into frontmatter and create a needless lint/audit failure.

   *Fold-in.* Reword those two sentences to describe execution state, not plan lifecycle state. For example: "this arc cannot be honestly closed until criterion 6 holds" and "the bridge-unblock claim remains deferred until criterion 6 holds." Keep frontmatter lifecycle states unchanged.

   *Pointer.* Plan: `specs/plans/recipe-runtime-substrate.md:1024-1052`. Source: `specs/adrs/ADR-0010-arc-planning-readiness-gate.md:85-95`, `specs/adrs/ADR-0010-arc-planning-readiness-gate.md:101-107`, `scripts/plan-lint.mjs:127-132`, `scripts/plan-lint.mjs:923-929`.

4. **LOW — §5's parser-only failure list still includes two failures that the plan itself defines as contract-test drift checks.**

   *Failure mode.* The subsection is titled "Failure modes the parsers reject," and it correctly carves Fix-table parity out as test-only. But it then includes `WorkflowKind` enum-vs-policy equality and workflow-kind slug-shape drift, both of which §8.1 defines as contract-test assertions, not parser rejections. That blurs the parser-vs-test boundary the rest of revision 07 is trying to keep precise.

   *Fold-in.* Either retitle the subsection to something like "Failure modes the schema or contract surface catches," or move the two `WorkflowKind` drift bullets into a separate contract-test-only note beside the §8.1 parity/drift assertions.

   *Pointer.* Plan: `specs/plans/recipe-runtime-substrate.md:597-633`, `specs/plans/recipe-runtime-substrate.md:778-789`. Source: `src/schemas/workflow-recipe.ts:160-232`, `scripts/policy/workflow-kind-policy.mjs:37-62`, `src/schemas/ids.ts:26-29`.

## Bottom line

The plan is bound, the pass-06 carry-over fixes are materially present, and I did not find a new structural blocker. `npm run plan:lint -- --context=committed specs/plans/recipe-runtime-substrate.md` is green. But the remaining citation and wording drift is not zero: revision 07 is not yet a clean `challenger-cleared` candidate. Apply the four mechanical fold-ins above and then re-dispatch; absent new drift, this should be ready to clear.
