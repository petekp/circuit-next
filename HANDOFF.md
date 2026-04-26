# HANDOFF

Last updated: 2026-04-26 (Path #2 complete: build-time recipe compile + runtime substrate retired).

## Where we are

Recipes are now an authoring layer that compiles at build time to the
committed `.claude-plugin/skills/<id>/circuit.json` fixtures. The runner at
`src/runtime/runner.ts` is the single engine end-to-end. The parallel
`src/runtime/recipe-runtime/` substrate that the previous session bridged
in is gone.

Concretely:

1. `src/schemas/workflow-recipe.ts` carries everything the compiler needs:
   per-item `protocol` (ProtocolId), `writes` (typed-artifact path plus
   dispatch slots or checkpoint slots), `gate` (required/allow/pass), and
   optional `checkpoint_policy`. Recipe-level fields cover `version`,
   `entry`, `entry_modes`, `spine_policy`, and per-canonical-phase
   metadata (`phases`). Cross-field shape rules — kind ↔ writes, kind ↔
   gate, checkpoint_policy only on checkpoint kind — are enforced in the
   item superRefine.
2. The catalog's `action_surface` widened from a hard constraint to a
   recommendation: worker primitives can be done inline as synthesis,
   orchestrator primitives can be checkpoints. This matched what the live
   committed Workflows already did. Review primitive can also be in the
   `analyze` phase (audit-only Review pattern).
3. `src/runtime/compile-recipe-to-workflow.ts` is the pure compiler.
   Failure modes are loud: missing required fields, kind/artifact pairs
   the runner can't handle (e.g., verification step writing anything
   other than build.verification@v1), or items with no `pass` route.
4. `scripts/emit-workflows.mjs` regenerates the committed fixtures from
   the recipes (`npm run emit-workflows`) and `--check` mode runs the
   drift check (also wired into `npm run verify`).
5. The recipes for Build, Explore, and Review now compile to byte-equal
   output with the committed `circuit.json` fixtures. The CLI was already
   loading those committed files and handing them to `executeDogfood`, so
   the cutover was a no-op.
6. `src/runtime/recipe-runtime/`, `tests/unit/recipe-runtime/`, and
   `tests/fixtures/recipe-runtime/` are deleted entirely.

`npm run verify` passes: 802 tests (6 skipped), tsc clean, biome clean,
build clean, drift check clean.

## What's next

Open follow-ups, by priority:

1. **Fix recipe (status: candidate)** still uses `route_overrides` to
   send Lite-rigor verifications straight to a no-review close. The
   compiler currently has no support for per-rigor route overrides. When
   we want Fix to ship, decide whether to split it into two recipes
   (fix-lite + fix-standard, no overrides) or teach the compiler to emit
   one Workflow per entry mode for any recipe that uses route_overrides.
   The schema retains `route_overrides` as documentation either way.
2. **Recipe authoring docs.** `specs/workflow-recipe-composition.md`
   predates the new schema. Update to describe the new fields
   (writes/gate/protocol/checkpoint_policy, plus recipe-level entry/
   entry_modes/spine_policy/phases) and the build-time compile flow.
3. **Drift check coverage.** The CI drift check today only covers
   build/explore/review. If new recipes (fix, sweep, migrate, etc.) get
   compiled, add them to `RECIPES` in `scripts/emit-workflows.mjs`.
4. **`projectWorkflowRecipeForCompiler` and `compileWorkflowRecipeDraft`
   helpers** in `src/schemas/workflow-recipe.ts` are now only consumed
   by their own contract tests (the Fix-candidate projection snapshot).
   Decide whether to keep them as recipe-introspection helpers or retire
   them when Fix moves off `route_overrides`.

No Codex pass was needed this session — the work was largely mechanical
once the schema design was settled, and `npm run verify` provided strong
evidence at every step.
