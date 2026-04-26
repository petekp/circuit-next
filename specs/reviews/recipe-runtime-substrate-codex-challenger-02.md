---
name: recipe-runtime-substrate-codex-challenger-02
description: Second Codex challenger pass for the recipe-runtime-substrate plan.
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
  plan_revision: '02'
  plan_base_commit: b98c5457b89ae1569c178061fb0805f11166cbfa
  plan_content_sha256: not-bound-rejecting-pass
target: specs/plans/recipe-runtime-substrate.md
commands_run:
  - "codex exec -C /Users/petepetrash/Code/circuit-next --sandbox read-only --color never -m gpt-5.4 -"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: REJECT-PENDING-FOLD-INS
severity_counts:
  critical: 2
  high: 1
  med: 1
  low: 0
  meta: 0
---

Codex returns **REJECT-PENDING-FOLD-INS**. This is a **not-bound rejecting pass**: the file on disk matches the supplied SHA `0921b2923819dc45d82a03579a6958790457645e772e9633f02959e3b0854975`, but the plan text still self-declares `base_commit: dcfeb517ee2e7d2ae44efc66d96b27e5fee2f0f2`, not the reviewed packet's `b98c5457b89ae1569c178061fb0805f11166cbfa` (`specs/plans/recipe-runtime-substrate.md:7`). The reject is not about Slice D; keeping a conservative 2-slice ceremony is defensible. The blockers are still the substrate authorities themselves.

## Findings

1. **CRITICAL — `protocol_role` and `checkpoint_template` are still bound at the wrong layer, so the shared `human-decision` primitive would become workflow-shaped rather than primitive-shaped.**

   *Failure mode.* Revision 02 moves the protocol seam from a coarse enum to `WorkflowPrimitive.protocol_role`, and it removes per-item checkpoint customization in favor of one primitive-scoped `checkpoint_template`. That still misplaces the authority. The same generic primitive, `human-decision`, is intentionally reusable as a checkpoint in any canonical phase: the compatibility layer admits host primitives as `checkpoint` executions and admits `human-decision` in all phases. But the live Build workflow already uses a checkpoint with protocol `build-frame@v1` and a Build-brief-specific checkpoint policy, while the Fix recipe uses the same primitive for an analyze-phase no-repro decision with a different prompt/choice set. One primitive-level `protocol_role` and one primitive-level `checkpoint_template` cannot represent both without turning the catalog into a Build-specific or Fix-specific catalog.

   *Fold-in.* Move the workflow-role half of the protocol seam, and the concrete checkpoint prompt/choice policy, to the recipe-item or recipe-side binding layer keyed by use-site. Keep only truly reusable defaults on the primitive if they are genuinely invariant across recipes.

   *Pointer.* `specs/plans/recipe-runtime-substrate.md:156-190`, `specs/plans/recipe-runtime-substrate.md:233-238`, `specs/plans/recipe-runtime-substrate.md:274-279`, `specs/plans/recipe-runtime-substrate.md:411-425`; `specs/workflow-primitive-catalog.json:69-87`; `src/schemas/workflow-recipe.ts:364-377`, `src/schemas/workflow-recipe.ts:380-406`; `specs/workflow-recipes/fix-candidate.recipe.json:169-186`; `.claude-plugin/skills/build/circuit.json:84-137`; `specs/workflow-primitives.md:113-150`.

2. **CRITICAL — F3 survives in disguised form: `write_slots` no longer uses recipe-specific keys, but it still requires recipe-specific slot values on the shared primitive.**

   *Failure mode.* The plan now keys `write_slots` by generic contract refs, but the slot payload is still a concrete `{path, schema}` pair. That does not preserve ADR-0013 separation. The primitive `frame` generically outputs `workflow.brief@v1`; Explore materializes that as `artifacts/brief.json` + `explore.brief@v1`, Build as `artifacts/build/brief.json` + `build.brief@v1`, and Fix aliases it to `fix.brief@v1` with Fix-specific tables at `artifacts/fix/brief.json`. `contract_aliases` only translates generic contract refs to recipe-local contract refs; it does not rewrite artifact paths. So a primitive-scoped `write_slots['workflow.brief@v1'] = {path, schema}` still forces one concrete workflow's artifact location into the shared catalog. The recipe-specificity moved from the map key to the map value.

   *Fold-in.* Either move concrete `{path, schema}` binding to a recipe-side or workflow-side authority after alias resolution, or make the primitive expose only abstract slot ids/templates and let the recipe bind them to concrete artifact paths and schemas.

   *Pointer.* `specs/plans/recipe-runtime-substrate.md:191-199`, `specs/plans/recipe-runtime-substrate.md:245-250`, `specs/plans/recipe-runtime-substrate.md:270-273`, `specs/plans/recipe-runtime-substrate.md:296-297`, `specs/plans/recipe-runtime-substrate.md:398-410`, `specs/plans/recipe-runtime-substrate.md:556-560`; `src/schemas/workflow-recipe.ts:39-44`; `specs/workflow-primitive-catalog.json:49-53`; `specs/workflow-recipes/fix-candidate.recipe.json:16-20`; `src/schemas/artifacts/fix.ts:4-22`; `.claude-plugin/skills/explore/circuit.json:60-73`; `.claude-plugin/skills/build/circuit.json:122-128`.

3. **HIGH — `runtime_gate_template.kind` is defined as one value per primitive, but the existing catalog already includes primitives whose declared surface is intentionally multi-kind.**

   *Failure mode.* Revision 02 says one `runtime_gate_template.kind` lives on each primitive and that its value is inferred from how recipes currently use that primitive. That overfits the shared catalog to the current Fix recipe. The catalog already has `batch` with `action_surface: "mixed"`, and the compatibility layer explicitly treats mixed primitives as legal for `synthesis`, `dispatch`, `verification`, or `checkpoint`. A singular primitive-level gate template chosen from current recipe usage cannot honestly model that generic capability. The first later recipe that uses a mixed primitive in a different execution kind would look like a schema contradiction instead of normal reuse.

   *Fold-in.* Either move gate-kind binding to the recipe item / compiled-step seam, or make primitive-side runtime templates keyed by execution kind rather than singular per primitive.

   *Pointer.* `specs/plans/recipe-runtime-substrate.md:169-178`, `specs/plans/recipe-runtime-substrate.md:380-387`, `specs/plans/recipe-runtime-substrate.md:534-537`; `specs/workflow-primitive-catalog.json:238-255`; `src/schemas/workflow-recipe.ts:364-377`.

4. **MED — The `WorkflowKind` drift check is not strong enough for the protocol-id guarantee the plan claims.**

   *Failure mode.* The plan's proposed guard is "enum members exactly equal `Object.keys(WORKFLOW_KIND_CANONICAL_SETS)`" plus a smoke test that only composes `'fix-' + protocol_role + '@v' + protocol_version'`. That catches membership drift, but it does not prove every actual workflow-kind key remains `ProtocolId`-safe. `WORKFLOW_KIND_CANONICAL_SETS` lives in plain `.mjs` object keys, not a regex-validated type, so a future key with an underscore, uppercase letter, or other non-slug character would satisfy the equality test and still break `${workflow_kind}-${protocol_role}@v${version}`.

   *Fold-in.* Add a contract test that every policy key satisfies the workflow-kind slug shape, or directly test the full `${workflowKind}-${protocol_role}@v${protocol_version}` composition against `ProtocolId` for every `WorkflowKind` value, not just `fix`.

   *Pointer.* `specs/plans/recipe-runtime-substrate.md:203-205`, `specs/plans/recipe-runtime-substrate.md:375`, `specs/plans/recipe-runtime-substrate.md:416-419`, `specs/plans/recipe-runtime-substrate.md:548-553`; `scripts/policy/workflow-kind-policy.mjs:36-62`; `src/schemas/ids.ts:26-29`.

## Raw Challenger Text

Bottom line: reject this revision. The headline fold-ins look cleaner, but the plan still binds workflow-item semantics at the primitive layer: `human-decision` cannot carry one protocol role and one checkpoint policy across Build and Fix, and `frame` cannot carry one concrete `{path, schema}` slot across Explore, Build, and Fix. I do not object to keeping Slice D as a stricter-than-minimum ceremony for a 2-slice arc; the blockers are the misplaced authorities in Slice A.
