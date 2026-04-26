---
name: recipe-runtime-substrate-codex-challenger-01
description: First Codex challenger pass for the recipe-runtime-substrate plan.
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
  plan_revision: '01'
  plan_base_commit: dcfeb517ee2e7d2ae44efc66d96b27e5fee2f0f2
  plan_content_sha256: not-bound-rejecting-pass
target: specs/plans/recipe-runtime-substrate.md
commands_run:
  - "codex exec -C /Users/petepetrash/Code/circuit-next --sandbox read-only --color never -m gpt-5.4 -"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: REJECT-PENDING-FOLD-INS
severity_counts:
  critical: 3
  high: 1
  med: 1
  low: 0
  meta: 0
---

# Recipe Runtime Substrate Plan — Codex Challenger Pass 01

Codex returns **REJECT-PENDING-FOLD-INS**. I am recording this as a **not-bound rejecting pass**: the file on disk matches the supplied content SHA, but the plan text currently self-declares `base_commit: 25359fd30fede146ee4302a867a848d77e3b5e74`, not the requested `dcfeb517ee2e7d2ae44efc66d96b27e5fee2f0f2`, so this pass is an objection list against the current text rather than a bound clearance.

## Findings

1. **CRITICAL — `protocol_id` is shaped as a coarse family label, not as the runtime `ProtocolId` the bridge says it will feed.**

   *Failure mode.* The plan's new `WorkflowProtocolId` is a five-value enum (`orchestrator`, `fix`, `build`, `explore`, `review`). But the runtime `Step.protocol` field is already typed as `ProtocolId`, which must match the versioned `name@vN` format, and live workflow fixtures use values like `explore-frame@v1` and `review-intake@v1`. The bridge plan's runtime-ready seam explicitly says compiled step `protocol` is resolved from `primitive.protocol_id`. As written, this arc still does not supply a runtime-valid protocol source, so the claimed upstream-data repair is incomplete at the protocol seam.

   *Fold-in.* Either make `protocol_id` a real `ProtocolId`-shaped authority that the runtime can consume directly, or rename this field to something like `protocol_family` and budget a second, explicit lowering table instead of calling the bridge a mechanical join.

   *Pointer.* `specs/plans/recipe-runtime-substrate.md:111-114`, `specs/plans/recipe-runtime-substrate.md:215-221`, `specs/plans/recipe-runtime-substrate.md:261-266`, `specs/plans/compiled-recipe-runtime-bridge.md:218-220`, `src/schemas/ids.ts:26-29`, `src/schemas/step.ts:17-20`, `.claude-plugin/skills/explore/circuit.json:60-63`, `.claude-plugin/skills/review/circuit.json:48-50`.

2. **CRITICAL — Slice B is budgeted around a second Fix checkpoint that does not exist in the current recipe, so its acceptance evidence is impossible without scope creep.**

   *Failure mode.* The plan says Fix calls `human-decision` twice, for separate verification and review decisions, and then requires the Fix recipe's "two checkpoint items" to carry distinct prompts. The current Fix recipe has one checkpoint item, `fix-no-repro-decision`; multiple `ask` routes target that same item, but there is no second checkpoint node. Because the same plan also says "No new primitive ids or new recipe shapes" and scopes existing-recipe migration to adding `checkpoint_overrides` to existing checkpoint items, Slice B cannot satisfy its own proof without adding a new recipe node it said was out of scope.

   *Fold-in.* Either narrow Slice B to the single existing Fix checkpoint item, or explicitly reopen recipe-shape change as scope and stop claiming this is just additive per-item customization.

   *Pointer.* `specs/plans/recipe-runtime-substrate.md:73`, `specs/plans/recipe-runtime-substrate.md:153-156`, `specs/plans/recipe-runtime-substrate.md:175-178`, `specs/plans/recipe-runtime-substrate.md:401-405`, `specs/plans/recipe-runtime-substrate.md:418-430`, `specs/workflow-recipes/fix-candidate.recipe.json:164-165`, `specs/workflow-recipes/fix-candidate.recipe.json:169-193`, `specs/workflow-recipes/fix-candidate.recipe.json:213-213`, `specs/workflow-recipes/fix-candidate.recipe.json:235-235`, `specs/workflow-recipes/fix-candidate.recipe.json:264-264`.

3. **CRITICAL — `write_slots` is keyed against the wrong contract layer; it would force recipe-local aliases back into the shared primitive catalog.**

   *Failure mode.* The plan defines `write_slots` as a record keyed by contract refs and then says Slice A should reject any primitive whose `write_slots` lacks a key for a recipe item's concrete `output`. But the current recipe model already makes output compatibility recipe-local through `contract_aliases`: `frame` generically outputs `workflow.brief@v1` while the Fix recipe emits `fix.brief@v1`; `close-with-evidence` generically outputs `workflow.result@v1` while Fix emits `fix.result@v1`. Requiring primitive-level `write_slots` keys for `fix.*` outputs would bake recipe-specific aliases into the reusable primitive catalog, which is the opposite of ADR-0013's primitive-backed separation.

   *Fold-in.* Key `write_slots` against the primitive's generic contract surface and make the bridge apply recipe alias resolution when selecting the concrete artifact slot. Do not make shared primitives carry workflow-specific alias keys just to satisfy one recipe.

   *Pointer.* `specs/plans/recipe-runtime-substrate.md:127-132`, `specs/plans/recipe-runtime-substrate.md:257-260`, `specs/plans/recipe-runtime-substrate.md:296-297`, `src/schemas/workflow-recipe.ts:39-44`, `src/schemas/workflow-recipe.ts:513-517`, `specs/workflow-recipes/fix-candidate.recipe.json:16-19`, `specs/workflow-recipes/fix-candidate.recipe.json:50-51`, `specs/workflow-recipes/fix-candidate.recipe.json:107-107`, `specs/workflow-recipes/fix-candidate.recipe.json:280-280`, `specs/workflow-recipes/fix-candidate.recipe.json:305-305`, `specs/workflow-primitive-catalog.json:49-53`, `specs/workflow-primitive-catalog.json:278-283`.

4. **HIGH — The plan gives checkpoint choice ownership to two different authorities even though the runtime requires them to be one value.**

   *Failure mode.* `runtime_gate_template` carries checkpoint `allow`, while `checkpoint_template` plus `checkpoint_overrides` carry the effective checkpoint choice set. Slice B explicitly allows per-item `choices` overrides, but runtime `CheckpointStep` parsing requires `gate.allow` to exactly match `policy.choices` ids. The plan never states whether an item-level choice override rewrites the gate allow-list, or whether checkpoint `allow` should actually be derived from the effective policy instead of stored primitive-side. Without that binding rule, the substrate still does not determine a valid runtime checkpoint step.

   *Fold-in.* Pick one source of truth for checkpoint choices. Either derive `gate.allow` from the effective checkpoint policy at bridge time and stop storing a separate primitive-level allow-list for checkpoint gates, or require any choice override to rewrite the gate-side choice set in the same authority layer and add equality tests for it.

   *Pointer.* `specs/plans/recipe-runtime-substrate.md:115-126`, `specs/plans/recipe-runtime-substrate.md:139-146`, `specs/plans/recipe-runtime-substrate.md:223-233`, `specs/plans/recipe-runtime-substrate.md:271-288`, `src/schemas/step.ts:60-84`, `src/schemas/step.ts:166-174`.

5. **MED — Even if the dual-authority bug is fixed, `checkpoint_template` is still narrower than the documented and runtime checkpoint surface.**

   *Failure mode.* The new template carries only `prompt_template`, string `choices`, and `safe_default_choice`. But the Human Decision authority models structured options with labels/effects plus mode policy, and the runtime checkpoint policy already supports structured choice objects, `safe_autonomous_choice`, and build-brief-backed checkpoints. So the plan still does not actually produce a complete checkpoint authority surface; the bridge would have to invent missing fields from somewhere else whenever a checkpoint needs more than bare string ids.

   *Fold-in.* Either explicitly narrow this arc to the current Fix no-repro checkpoint and say richer checkpoint semantics remain out of scope, or widen the authority shape so it can round-trip the documented/runtime checkpoint surface honestly.

   *Pointer.* `specs/plans/recipe-runtime-substrate.md:123-126`, `specs/plans/recipe-runtime-substrate.md:229-233`, `specs/plans/recipe-runtime-substrate.md:271-275`, `specs/workflow-primitives.md:113-150`, `src/schemas/step.ts:60-84`, `src/schemas/step.ts:98-109`, `src/schemas/step.ts:176-188`.

## Raw Challenger Text

Bottom line: reject this revision. It still mis-binds protocol ids, keys primitive write slots against recipe-local aliases, and builds Slice B around a second Fix checkpoint that is not actually in the recipe. Even after those are fixed, checkpoint choice ownership is still split enough that bridge revision 03 would not be a mechanical join.
