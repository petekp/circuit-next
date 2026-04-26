---
name: recipe-runtime-substrate-codex-challenger-03
description: Third Codex challenger pass for the recipe-runtime-substrate plan.
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
  plan_revision: '03'
  plan_base_commit: b98c5457b89ae1569c178061fb0805f11166cbfa
  plan_content_sha256: aaa814e92927e53b7508a8281eaeabdb144e38fd9dcbe2c8d38ff21d95b6bac3
target: specs/plans/recipe-runtime-substrate.md
commands_run:
  - "codex exec -C /Users/petepetrash/Code/circuit-next --sandbox read-only --color never -m gpt-5.4 -"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: REJECT-PENDING-FOLD-INS
severity_counts:
  critical: 1
  high: 1
  med: 1
  low: 0
  meta: 0
---

Codex returns **REJECT-PENDING-FOLD-INS**. This is a **bound pass**: the on-disk plan SHA matches `aaa814e92927e53b7508a8281eaeabdb144e38fd9dcbe2c8d38ff21d95b6bac3`, and the plan self-declares `base_commit: b98c5457b89ae1569c178061fb0805f11166cbfa`, matching the reviewed packet. Revision 03 fixes the primitive-vs-item layering mistake, but two structural seams remain at the recipe-item → runtime boundary, and one acceptance-evidence claim is still under-specified.

## Findings

1. **CRITICAL — `write_target` leaves the output-binding seam with multiple unsynchronized authorities, so the bridge still cannot treat it as a mechanical join.**

   *Failure mode.* `WorkflowRecipeItem.output` is still the recipe's typed output authority today: compatibility checks validate it against the primitive output contract, and route-aware availability propagates it through the recipe graph. Revision 03 then adds `runtime_step.write_target.schema` as a second schema authority on the same item, while explicitly keeping the Fix-only `{artifact_id -> path/schema}` tables unchanged as a third parallel surface. The plan never states an equality/parity rule between these three sources, and Slice A's acceptance evidence only requires `write_target.path` / `schema` to be non-empty. So a mismatched item can still parse and compat-check while handing the bridge contradictory write bindings. That is a new drift seam, not a closed seam.

   *Fold-in.* Make schema authority single-source. Either reduce `write_target` to `{path}` and derive schema from `item.output`, or keep `{path, schema}` but add hard invariants `runtime_step.write_target.schema === item.output` and parity against any retained Fix tables, with explicit contract tests.

   *Pointer.* `specs/plans/recipe-runtime-substrate.md:226-235,341-342,453-460,656-662`; `src/schemas/workflow-recipe.ts:112-120,446-447,513-517`; `src/schemas/artifacts/fix.ts:4-22`.

2. **HIGH — The checkpoint write seam is still not honest against the unchanged runtime `Step` contract.**

   *Failure mode.* Revision 03 requires every recipe item to carry `runtime_step.write_target`, and the seam diagram says the bridge reads that directly into `Step.writes.artifact`. But the unchanged runtime `CheckpointStep` only permits artifact writing when the artifact schema is `build.brief@v1` and `policy.build_brief` is present. The one live Fix checkpoint item outputs `fix.no-repro-decision@v1`, not `build.brief@v1`. Because the plan also says the runtime `Gate` / `CheckpointPolicy` / `Step` schemas stay unchanged, the substrate still does not provide a legal runtime sink for the Fix checkpoint without special-casing or another widening.

   *Fold-in.* Either make checkpoint `write_target` non-materializing until runtime support exists, or explicitly budget the checkpoint-artifact runtime widening / bridge lowering rule now and stop describing this seam as already direct.

   *Pointer.* `specs/plans/recipe-runtime-substrate.md:213-235,304-308,341-342,442-460,627-633`; `src/schemas/step.ts:113-125,176-189`; `specs/workflow-recipes/fix-candidate.recipe.json:169-177`.

3. **MED — Slice A's "distinct gate-kind reuse" proof is not reproducible from the named join surface as written.**

   *Failure mode.* The acceptance evidence says the contract test proves that the same primitive (`human-decision`, `batch`) can back distinct items with distinct gate kinds. But the current catalog × Fix-recipe join has exactly one `human-decision` item, zero `batch` recipe items, and the only repeated primitive in the Fix recipe is `close-with-evidence`, twice, with the same execution kind. So the named on-disk authorities do not actually exercise the reuse case the bullet claims unless Slice A also adds an explicit synthetic fixture or in-memory case.

   *Fold-in.* Name the synthetic reuse fixture/test explicitly, or narrow the acceptance bullet to the properties the Fix backfill actually proves.

   *Pointer.* `specs/plans/recipe-runtime-substrate.md:119-128,634-655`; `specs/workflow-recipes/fix-candidate.recipe.json:169-186,269-315`; `specs/workflow-primitive-catalog.json:238-255`.

## Raw Challenger Text

Bottom line: reject this revision. The primitive/item layering reframe is the right direction, but the write seam is still split across `item.output`, `runtime_step.write_target`, and retained Fix tables with no binding rule, and the checkpoint item still has no honest path into the unchanged runtime `CheckpointStep` artifact contract. The batch/human-decision reuse proof also overclaims what the named fixtures can actually demonstrate.
