---
name: compiled-recipe-runtime-bridge-codex-challenger-02
description: Second Codex challenger pass for the compiled-recipe-runtime-bridge plan, against revision 02.
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: plan-challenger-review
review_date: 2026-04-25
verdict: REJECT-PENDING-FOLD-INS
authored_by: gpt-5.4 via codex exec
reviewed_plan:
  plan_slug: compiled-recipe-runtime-bridge
  plan_revision: 02
  plan_base_commit: 1dda1c8f9a859e2fd02b4119b4f8afcb6469b063
  plan_content_sha256: 863af067c36768b03e3ae708affd58dd396ab1f7b7f37bb2fbab2e69ffef1597
target: specs/plans/compiled-recipe-runtime-bridge.md
commands_run:
  - "codex exec -C /Users/petepetrash/Code/circuit-next --sandbox read-only --color never -m gpt-5.4 -"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: REJECT-PENDING-FOLD-INS
severity_counts:
  critical: 2
  high: 3
  med: 1
  low: 0
  meta: 0
---

# Compiled Recipe → Runtime Bridge Plan — Codex Challenger Pass 02

Codex returned **REJECT-PENDING-FOLD-INS** against revision 02.

Revision 02 honestly fixes two of pass 01's objections: the live Fix
execution claim is dropped (Slice C removed; Slice B uses a synthetic
fixture), and §6 is aligned to the greenfield authority rows in
`specs/artifacts.json`. The ADR-0013 citation is corrected and the
§5 `default_selection.start_at` mismapping is fixed.

The pass nevertheless rejects on a deeper class of finding: the
"widen the compiler so its output is runtime-ready" reframe assumes
the upstream sources (recipe schema, primitive catalog, fix-specific
tables) carry the data the runtime needs. They do not. So the
widening cannot resolve runtime fields out of authorities that do
not encode them. Two CRITICAL findings make this concrete; three
HIGH findings flag the rigor binding rule, the ARC_CLOSE_GATES
naming convention, and a stale-input failure mode introduced by the
reframe; one MED notes the Fix tables are file-local constants.

## Findings

1. **CRITICAL — The runtime-ready seam still depends on data the cited authorities do not carry.**

   *Failure mode.* `protocol_id` is mentioned in the plan but does
   not appear in the current `WorkflowRecipe`, `WorkflowRecipeItem`,
   or `WorkflowPrimitive` schemas. Recipe items carry no checkpoint
   `prompt`/`choices`/`safe_default_choice` data. The primitive
   catalog's `gate` field is a description string, not a runtime
   `SchemaSectionsGate`/`ResultVerdictGate`/`CheckpointSelectionGate`
   payload. There are no per-item `writes.artifact.{path, schema}`
   sources beyond the workflow-specific `FIX_RESULT_*` tables.
   "Widening the compiler" does not produce protocol ids, gate
   payloads, checkpoint policy data, or concrete write slots out of
   authorities that do not encode them.

   *Fold-in.* Either add authoritative workflow-specific
   protocol/policy/path tables (a multi-slice arc preceding this
   one), or narrow Slice A0 so it does not promise to resolve runtime
   fields the repo does not yet model. The current framing implies
   resolutions that have no source.

   *Pointer.* `specs/plans/compiled-recipe-runtime-bridge.md:86`,
   `:218`, `:358`; `src/schemas/workflow-primitives.ts:107`;
   `src/schemas/workflow-recipe.ts:103`; `src/schemas/gate.ts:49`;
   `src/schemas/step.ts:36`; `specs/workflow-primitives.md:113`.

2. **CRITICAL — The route fold-in is still incomplete; recipe outcomes do not satisfy `Workflow.parse`'s `routes.pass` invariant.**

   *Failure mode.* Revision 02 says the materializer preserves the
   compiled draft's edges as `Workflow.steps[*].routes`. Recipe
   outcomes are `continue`, `retry`, `ask`, `revise`, `complete`,
   `stop`, `handoff`, `escalate` (per `WorkflowPrimitiveRoute` and
   `WorkflowRecipeTerminalTarget`). But `Workflow` invariant WF-I10
   requires every step's `routes` to contain a `pass` key, and the
   runner's outcome enum is `{pass, fail}` (`src/schemas/event.ts`).
   The runner only advances through `step.routes.pass`. A
   materialized step with `routes.continue` but no `routes.pass`
   either fails parse or stalls at runtime.

   *Fold-in.* Define an explicit lowering from recipe outcomes to
   runtime `pass`/`fail` semantics. Make Slice A's field-level
   assertions cover the lowered runtime contract, not the compiled
   edge equality. The lowering rule itself is a design decision (is
   `continue` always `pass`? what does `retry` lower to?) and should
   be named in §5 before Slice A0 opens.

   *Pointer.* `specs/plans/compiled-recipe-runtime-bridge.md:241`,
   `:418`; `src/schemas/workflow.ts:115` (WF-I10);
   `src/runtime/runner.ts:2023`;
   `tests/runner/build-checkpoint-exec.test.ts:76`;
   `tests/contracts/workflow-kind-policy.test.ts:23`.

3. **HIGH — The single-rigor binding rule is not actually consistent across the plan.**

   *Failure mode.* §5 says the materialized workflow has exactly one
   `EntryMode` whose `rigor` matches `compiled.rigor`. But
   `opts.default_selection: SelectionOverride` is passed through
   unchanged, and `SelectionOverride.rigor` is itself optional. A
   caller can pass `default_selection: {rigor: 'lite'}` against a
   `compiled.rigor === 'standard'`, producing a workflow whose entry
   mode and default selection disagree on rigor. §3 also mentions
   "optional per-phase/per-step selection" as in scope, which
   reopens the same contradiction at lower precedence layers.

   *Fold-in.* For this arc, either ban `rigor` on all
   caller-supplied selection overrides (refuse `default_selection`
   that carries `rigor`; refuse per-phase/per-step `selection` that
   carries `rigor`), or require `override.rigor ===
   compiled.rigor` everywhere before materialization. The current
   "single-rigor at entry, free-form rigor everywhere else" hybrid
   is what pass 01 finding 4 already flagged.

   *Pointer.* `specs/plans/compiled-recipe-runtime-bridge.md:115`,
   `:203`, `:245`, `:265`; `src/schemas/selection-policy.ts:70`.

4. **HIGH — The `ARC_CLOSE_GATES` wiring is mechanically wrong: both proposed prong files are codex-labeled.**

   *Failure mode.* Slice D names two prong files:
   `compiled-recipe-runtime-bridge-arc-close-codex-composition-adversary.md`
   and `compiled-recipe-runtime-bridge-arc-close-codex-cross-model-challenger.md`.
   Both contain `codex` in the name. AGENTS.md §Cross-slice
   composition review cadence (Slice 40 fold-in) requires the
   two-prong gate to distinguish the **Claude prong**
   (name-match `*Claude*` / `*claude*`) from the **Codex prong**
   (name-match `*Codex*` / `*codex*`); single-prong satisfaction is
   rejected. Two codex-labeled files would not satisfy the gate
   even if both exist.

   *Fold-in.* Rename the composition-adversary file to the
   claude-labeled arc-close convention used by prior closed arcs
   (e.g., `compiled-recipe-runtime-bridge-arc-close-claude-composition-adversary.md`).
   Update the proposed `review_file_regex` to match the real
   two-prong naming. Bind the audit-test assertion to that exact
   split (one match for `claude`, one match for `codex`).

   *Pointer.* `specs/plans/compiled-recipe-runtime-bridge.md:496`,
   `:501`; `scripts/audit.mjs:4285` (Slice 40 prong-distinction
   block); `tests/contracts/artifact-backing-path-integrity.test.ts:750`.

5. **HIGH — The reframe introduces a new stale-input failure mode in the compiler signature.**

   *Failure mode.* `compileRuntimeReadyRecipe(projection, recipe,
   catalog, rigor)` takes both a `projection` and a `recipe`. The
   projection is derived from a recipe via
   `projectWorkflowRecipeForCompiler(recipe)`, but the new compiler
   signature does not enforce that the `projection` argument was
   derived from the same `recipe` argument. A caller can mix phases
   and edges from one recipe's projection with titles, inputs, and
   `purpose` from a different recipe, producing a plausibly-typed
   but semantically incoherent `RuntimeReadyRecipeCompilation`. The
   acceptance evidence never requires those two inputs to match.

   *Fold-in.* Either accept `recipe` only and derive the projection
   internally inside `compileRuntimeReadyRecipe`, or require
   `projectWorkflowRecipeForCompiler(recipe)` byte-equal /
   structural-equal parity as a checked precondition. The
   single-source variant is preferred.

   *Pointer.* `specs/plans/compiled-recipe-runtime-bridge.md:188`,
   `:358`; `src/schemas/workflow-recipe.ts:569`.

6. **MED — Slice A's "independent authority" check over the Fix path/schema tables is not executable as written.**

   *Failure mode.* Slice A asserts step `writes.artifact.{path,
   schema}` against `FIX_RESULT_PATH_BY_ARTIFACT_ID` and
   `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID`. These are file-local
   constants in `src/schemas/artifacts/fix.ts` (not exported), so
   a new test under `tests/contracts/` cannot import them. The
   "independent authority" framing collapses to "self-referential"
   if the test re-declares them, which is exactly the failure mode
   pass 01 finding 6 named.

   *Fold-in.* Either export those tables deliberately (with a
   commit body explaining the binding-test exposure), or bind the
   assertion through an already-exported surface such as
   `FixResultArtifactPointer` (or whichever exported surface
   carries the canonical path/schema mapping at slice-author time).

   *Pointer.* `specs/plans/compiled-recipe-runtime-bridge.md:81`,
   `:412`; `src/schemas/artifacts/fix.ts:4`, `:328`.

## Closing verdict

**REJECT-PENDING-FOLD-INS.**

The two CRITICAL findings together imply the bridge cannot land as
revised. Finding 1 says the upstream authorities (recipe schema +
primitive catalog) do not carry the runtime data the widened
compiler needs to resolve. Finding 2 says the compiler→runtime
route mapping cannot pass `Workflow.parse` without an explicit
lowering layer that revision 02 does not specify.

This is a deeper version of pass 01's finding 1: pass 01 said "the
compiler dropped data the runtime needs"; pass 02 says "the recipe
and catalog never had that data in the first place." Revision 02's
"widen the compiler" reframe is therefore not actually achievable
without first widening the upstream — which would be a
multi-slice prerequisite arc.

Three honest revision-03 paths exist; each is operator-direction
territory:

- **(a-2) Narrow scope.** Restrict the bridge to step kinds and
  data the current recipe + catalog can already support — e.g.,
  synthesis-only steps with a deterministic protocol/writes
  derivation rule that does not require new authority tables.
  Drop dispatch / checkpoint / verification from this arc's scope.
  Smallest path; loses generality but preserves momentum.

- **(a-3) Open a prerequisite arc to widen the recipe schema and
  primitive catalog** to carry `protocol_id`, runtime gate payloads,
  checkpoint policy data, and write-slot tables. Then revisit this
  bridge plan. Larger arc; preserves the original ambition.

- **(b) Reopen the Fix-runtime-substrate-first reframe** that pass
  01 listed as the second option. Build Fix protocol naming,
  writers, checkpoint behavior, verification execution, and close
  artifact generation. Then bridge. Largest arc; lands a real Fix
  run.

Pass 02's HIGH and MED findings are mechanical and would fold into
any revision-03 path: the rigor binding rule, the
`ARC_CLOSE_GATES` claude/codex prong naming, the stale-input
single-source signature, and the Fix-table export. None require a
reframe to fix.

Plan-lint stays green at revision 02 (`npm run plan:lint --
specs/plans/compiled-recipe-runtime-bridge.md` reports no
findings), so the reject is about semantic / runtime binding gaps,
not plan-lint hygiene.
