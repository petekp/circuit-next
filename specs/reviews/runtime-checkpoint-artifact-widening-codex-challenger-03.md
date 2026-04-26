---
name: runtime-checkpoint-artifact-widening-codex-challenger-03
description: Third Codex challenger pass for the runtime-checkpoint-artifact-widening prerequisite arc plan, revision 03 (post-pass-02 fold-in).
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: plan-challenger-review
review_date: 2026-04-25
verdict: ACCEPT-WITH-FOLD-INS
authored_by: gpt-5.4 via codex exec
reviewed_plan:
  plan_slug: runtime-checkpoint-artifact-widening
  plan_revision: '03'
  plan_base_commit: 0307150b9503fbb8d3170f433fa788ff2306e18f
  plan_content_sha256: e83a6a97465d23d17eba56738e86b47c99dc9da940bf48c3a988c3fcbcde53f2
target: specs/plans/runtime-checkpoint-artifact-widening.md
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

Codex returns **ACCEPT-WITH-FOLD-INS**. This is a **bound pass**: the on-disk plan SHA matches `e83a6a97465d23d17eba56738e86b47c99dc9da940bf48c3a988c3fcbcde53f2`, and the plan self-declares `base_commit: 0307150b9503fbb8d3170f433fa788ff2306e18f`, matching the reviewed packet. The pass-02 fold-ins are real: §6 strict-relaxation language is now parse-layer-only, §7 cleanly separates the three audit mechanisms, and the new it(...) is upgraded to Workflow.safeParse. Two remaining issues are mechanical: §11.1 / Slice A's "both modes" plan-lint requirement is impossible after operator-signoff, and E14 text is stale against the current §3 / §5 shape.

## Findings

1. **MED — Slice A requires an impossible default `plan:lint` green once the plan has reached slice-open status.**

   *Failure mode.* Under the repo's own plan lifecycle, slices may open only after `status: operator-signoff`. But the default `npm run plan:lint` context is `authoring`, which accepts only `evidence-draft` and `challenger-pending`. This plan correctly says plan-lint is a draft / challenger-pending tool in §7, then later requires Slice A and close criterion 1 to pass plan-lint in "both modes." Once the plan is `operator-signoff` or `closed`, that default authoring-mode lint is supposed to fail. So the acceptance checklist becomes self-contradictory: a correct slice can never satisfy it literally after signoff.

   *Fold-in.* In Slice A and §11, replace the "both modes" requirement with the committed-context check only: `npm run plan:lint -- --context=committed specs/plans/runtime-checkpoint-artifact-widening.md`. If you want to preserve draft-time authoring lint, say that explicitly as a pre-slice prerequisite while the plan is still `challenger-pending`, not as slice acceptance evidence.

   *Pointer.* Plan: `specs/plans/runtime-checkpoint-artifact-widening.md:430-431,505-506,639-641`. Source: `specs/adrs/ADR-0010-arc-planning-readiness-gate.md:94-109,146-150,239-240`; `scripts/plan-lint.mjs:15-22,127-133`.

2. **LOW — E14 still describes the widening and proof surface in a way that no longer matches §3 / §5.**

   *Failure mode.* For a checkpoint input like `writes.artifact.schema = 'arbitrary@v1'`, §5's proposed code shape and behavioral matrix say parse succeeds after the widening, because `ArtifactRef.schema` is any non-empty string and the new refinement only special-cases `build.brief@v1`. But E14 still says the arc will "allow other registered schemas," which is narrower than the actual code shape, and it says the existing second assertion flips to `fix.no-repro-decision@v1`, while §3 keeps the renamed Step-level assertion on `'other@v1'` and moves the Fix-specific proof into a new Workflow-level `it(...)`. That leaves the evidence census internally stale on both the admitted input set and the proving test.

   *Fold-in.* Rewrite E14 to mirror §3 / §5 exactly: the parse-layer widening admits any non-`build.brief@v1` schema string accepted by `ArtifactRef`; the renamed Step-level test keeps the generic `'other@v1'` acceptance case; the new Workflow-level `it(...)` carries the `fix.no-repro-decision@v1` proof that substrate F2 needs.

   *Pointer.* Plan: `specs/plans/runtime-checkpoint-artifact-widening.md:70-70,138-142,165-183,355-357`. Source: `src/schemas/step.ts:11-14,176-191`; `tests/contracts/schema-parity.test.ts:560-610`.

## Bottom line

The revision is structurally honest now: the parse-layer-only boundary is clear, the audit mechanisms are separated correctly, and the Workflow-level sink proof is properly budgeted. The remaining work is mechanical. After removing the impossible default `plan:lint` requirement from slice acceptance and aligning E14's stale wording with the actual §3 / §5 shape, this plan is ready to advance to `challenger-cleared`.
