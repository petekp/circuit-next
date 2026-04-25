---
plan: compiled-recipe-runtime-bridge
status: challenger-pending
revision: 01
opened_at: 2026-04-25
opened_in_session: compiled-recipe-runtime-bridge-arc-open
base_commit: dace8ac39edfb8b2f2059173fd0229733a70b414
target: runtime
authority:
  - specs/methodology/decision.md
  - specs/adrs/ADR-0003-authority-graph-gate.md
  - specs/adrs/ADR-0010-arc-planning-readiness-gate.md
  - specs/adrs/ADR-0012-two-mode-methodology.md
  - specs/adrs/ADR-0013-fix-as-first-recipe.md
  - specs/contracts/workflow.md
  - specs/workflow-recipe-composition.md
  - src/schemas/workflow-recipe.ts
  - src/schemas/workflow.ts
  - src/runtime/runner.ts
  - specs/workflow-recipes/fix-candidate.recipe.json
  - specs/workflow-recipes/fix-candidate.projection.json
artifact_ids:
  - workflow.recipe_definition
  - workflow.definition
  - workflow.primitive_catalog
  - run.projection
  - run.log
prior_challenger_passes: []
---

# Compiled Recipe → Runtime Bridge Plan

A small Heavy effort that connects `compileWorkflowRecipeDraft` to the
runtime workflow shape used today. The compiler emits a planning-only
`WorkflowRecipeDraft`; the runtime parses a hand-authored `Workflow` JSON
manifest and has no compiler entry point. The bridge consists of three
pieces: a typed materializer from `WorkflowRecipeDraft` to `Workflow`, a
round-trip parity test on the Fix recipe fixture, and an opt-in compile
path through the runner so a live run can execute end-to-end from a
compiled recipe. An arc-close composition review covers the privileged
runtime change.

## §Evidence census

Authoritative artifacts touched, in their current shape:

- **verified** — `src/schemas/workflow-recipe.ts:617–644` defines `compileWorkflowRecipeDraft(projection, rigor): WorkflowRecipeDraft`. Output: a flat tree of recipe → phases → items, with each item carrying `id`, `uses`, `phase`, `execution`, `output`, and `edges[]` (outcome → target). Slice 152 introduced rigor-resolved compilation; Slice 153 collapsed derived projection fields.
- **verified** — `src/schemas/workflow.ts` defines `Workflow` as the runtime input shape: `steps[]` (synthesis / dispatch / checkpoint union), canonical `phases[]`, `entry_modes[]`, `default_selection`.
- **verified** — `src/runtime/runner.ts:797` defines `workflowFromManifestBytes(bytes)` parsing `.workflow.json` into `Workflow`. The runner has no compiler entry point.
- **verified** — `specs/workflow-recipes/fix-candidate.recipe.json` and `specs/workflow-recipes/fix-candidate.projection.json` exist as the Fix recipe fixture and its compiler projection input.
- **verified** — `tests/contracts/workflow-recipe.test.ts` covers the recipe schema and compiler. There is no round-trip test against `Workflow`.
- **verified** — `specs/contracts/workflow.md` is the runtime workflow contract.
- **verified** — `specs/workflow-recipe-composition.md` is the design note for recipe composition.
- **verified** — `PROJECT_STATE.md` `current_slice: 153`. Phase 2 implementation status: first working workflow product spine closed; broader parity expansion planning is open.
- **verified** — `specs/parity-map.md` does not yet record the compiler-to-runtime bridge as a parity dimension.
- **inferred** — Mapping from `WorkflowRecipeDraftItem` to `Workflow.steps[number]` is not 1:1 in every case; some items map to checkpoint or dispatch steps depending on `uses`. The materializer needs a primitive-type lookup.
- **inferred** — The `entry_modes` and `default_selection` fields on `Workflow` are not encoded in `WorkflowRecipeDraft`; the materializer needs them as caller-supplied options.
- **unknown-blocking** — none. The seam shape and conventions are clear.

## §2 — Why this plan exists

Slices 149–153 brought the recipe compiler from idea to a planning-grade
artifact. Today nothing executes against its output. Without this bridge
the compiler stays decorative: the runtime keeps consuming hand-authored
manifests, and the recipe pipeline has no proof that its output is a
runnable workflow. The bridge puts the compiler on the executing path so
the recipe-and-primitive direction earns its keep, and so further recipe
work (more recipes, generated overrides, new rigor profiles) can be
validated by the runtime instead of by inspection.

## §3 — Scope

In scope:

- A typed materializer `materializeWorkflowFromCompiledRecipe(draft, opts): Workflow` that converts a compiled recipe draft into a runtime-valid `Workflow`.
- A round-trip contract test driving the Fix recipe fixture through `compileWorkflowRecipeDraft` and the materializer, asserting the result parses through `Workflow.parse` and matches a curated expected fixture.
- An optional compile path in the runner: given a recipe + projection + rigor, materialize a `Workflow` and run it through the existing execution loop instead of reading a static manifest.
- A live execution proof on the Fix recipe through the compile path, ending with a parsed `run.result` and a normal event log.
- A two-prong composition review at arc close before any further privileged runtime slice begins.

Out of scope:

- Replacement of static manifests in production for any workflow other than Fix. Build, Explore, and Review keep their hand-authored manifests for now; the bridge is purely additive.
- Generation of new recipes or primitives. The bridge consumes the existing Fix recipe fixture.
- Per-rigor selection logic at runtime beyond what the compiler resolves.
- Adapter registry rework for compiled paths.
- Persistent caching of compiled workflows.

## §4 — Non-goals

- The static-manifest path is preserved unchanged. The materializer is purely additive.
- Compile-on-bootstrap is not the default; the compile path is opt-in throughout this work. A follow-up effort can revisit defaults.
- The compiler itself is not extended. If a gap surfaces during the bridge, the relevant slice halts rather than absorb compiler scope.
- The CLI surface (`/circuit:fix`, `--entry-mode`, etc.) is untouched. CLI selectors for compiled recipes are a follow-up question once the runtime path is proven.

## §5 — Target seam shape

The materializer is a pure function on the compiled draft plus a small
options bag:

```
materializeWorkflowFromCompiledRecipe(
  draft: WorkflowRecipeDraft,
  opts: { workflow_id: WorkflowId; entry_modes: WorkflowEntryMode[]; default_selection: DefaultSelection }
): Workflow
```

Mapping rules (informative; refined in Slice A):

- `draft.recipe_id` is a recipe-domain id, not a workflow-domain id; the workflow id comes from `opts.workflow_id`.
- `draft.items[]` maps to `Workflow.steps[]`. Each item resolves to a synthesis, dispatch, or checkpoint step based on `uses` + `execution` and the primitive-catalog kind.
- `draft.phases[]` expands to canonical `Workflow.phases[]` per `specs/contracts/workflow.md`.
- `draft.items[].edges[]` maps to step routing (`on_outcome` / next-step references) on the resulting step.
- `draft.starts_at` becomes `Workflow.default_selection.start_at`.
- `draft.rigor` is informational on the draft; rigor flows through `entry_modes` at runtime selection time and is not re-recorded on `Workflow`.
- `draft.omitted_phases[]` is preserved on the workflow as a metadata field if the runtime contract permits, otherwise dropped (Slice A confirms).

Failure modes the materializer rejects:

- `uses` references with no resolved primitive entry.
- Edges naming an outcome that the primitive does not declare.
- Phase references outside the canonical phase set.
- Missing `entry_modes` covering `draft.starts_at`.

## §6 — Authority graph classification (ADR-0003)

Per ADR-0003, every touched artifact is classified before contract
authorship moves further:

- `workflow.recipe_definition` — greenfield. Slices 135–136 originated it; no successor obligations.
- `workflow.definition` — successor-to-live. The runtime workflow is the live shape. The materializer must produce a workflow that round-trips through `Workflow.parse` without any schema change.
- `workflow.primitive_catalog` — greenfield. Slice 135 originated it. The materializer reads the catalog through the compiler; no schema change.
- `run.projection` — successor-to-live. Existing reducer-derived projection is honored unchanged.
- `run.log` — successor-to-live. Existing event-log shape is honored unchanged.

Clean break is not invoked. The bridge is purely additive over the
existing `Workflow` schema.

## §7 — Verification substrate

The bridge rides the existing Tier-0 verification commands. No new
substrate slice is required:

- `npm run check` — `tsc --noEmit` enforces the materializer signature and `Workflow` shape at the boundary.
- `npm run lint` — `biome check`.
- `npm run test` — `vitest`. The new round-trip test joins `tests/contracts/`.
- `npm run verify` — composite gate.
- `npm run audit` — drift visibility.

Per AGENTS.md Tier-0, `check`, `lint`, `test`, `verify` must all be green
before any commit in a Ratchet-Advance or Equivalence Refactor lane. Each
slice in the bridge honors that gate.

## §8 — Slices

### 8.1 Slice A — Materializer + round-trip test (Heavy, Ratchet-Advance)

**Failure mode addressed.** The compiler emits a structure that no
runtime can parse; the recipe direction has no executable proof.

**Acceptance evidence.**

- A new module exporting `materializeWorkflowFromCompiledRecipe` exists; `tsc --strict` is green.
- A new contract test under `tests/contracts/` drives the Fix recipe projection through `compileWorkflowRecipeDraft` and then through the materializer, asserts the result parses through `Workflow.parse`, and structurally matches a curated expected fixture (committed under `specs/workflow-recipes/fix-candidate.workflow.json` or equivalent).
- `npm run verify` green.

**Why this not adjacent.** A pure round-trip test without a real
materializer is a tautology over the compiler's output. A bootstrap-path
slice ahead of a tested mapping function changes runtime behavior with
no tested target. This slice is the smallest unit that gives later
slices a typed dependency to depend on.

**Lane.** Ratchet-Advance. Contract-test ratchet strictly advances by
one new file or test case.

### 8.2 Slice B — Runner compile path (Heavy, Ratchet-Advance, privileged runtime)

**Failure mode addressed.** Even with a working materializer, the runner
has no entry point that takes a recipe instead of a manifest, so the
materializer remains untested against the live execution loop.

**Acceptance evidence.**

- The runner exposes an alternate bootstrap that accepts `(recipe, projection, rigor, opts)` and feeds the materializer's output through the same dispatch loop the manifest path uses.
- A new runtime test drives a synthesis-only end-to-end fake through the compile path, asserts the same event sequence as the manifest path on an equivalent fixture, and asserts no schema-parse failures.
- The static-manifest path remains the default; the compile path is opt-in via an explicit constructor parameter or factory.
- `npm run verify` green.

**Why this not adjacent.** Folding this work into Slice A mixes a pure
mapping function with runtime-loop changes; the materializer earns its
own slice as a tested unit. Folding it into Slice C combines a new
runtime entry point with a real workflow execution — and any regression
hides between the two.

**Lane.** Ratchet-Advance.

**Privileged runtime note.** The runner's bootstrap contract is modified
here. Per AGENTS.md cross-slice composition review cadence, the bridge
includes an arc-close composition review before any further privileged
runtime work.

### 8.3 Slice C — Live Fix execution via compile path (Heavy, Ratchet-Advance, privileged runtime)

**Failure mode addressed.** A green test suite is not the same as a real
run. Without a live invocation the bridge cannot claim parity.

**Acceptance evidence.**

- A live invocation of the Fix workflow through the compile path completes, writes the expected `fix.brief` / `fix.context` / `fix.diagnosis` / etc. artifacts (the subset declared by the current Fix recipe), and produces a parseable `run.result`.
- The event-log shape from the compile path matches the manifest path on the same recipe; any divergence is named in the slice close note.
- The slice-closing commit binds the proof artifacts under `.circuit/circuit-runs/<this-slice>/artifacts/` and links them from the slice close note.
- `npm run verify` green; `npm run audit` green.

**Why this not adjacent.** A tested-but-uninvoked compile path leaves
the bridge as paper claim. A simulated run masks any adapter-layer
surprise. A live invocation is the smallest evidence that the bridge
actually runs.

**Lane.** Ratchet-Advance.

**Privileged runtime note.** Same as Slice B.

### 8.4 Slice D — Arc-close composition review (ceremony)

**Failure mode addressed.** Per-slice challenger passes do not surface
boundary-seam drift across an arc; the bridge spans three slices and
modifies the runtime bootstrap, so AGENTS.md cross-slice composition
review cadence applies.

**Acceptance evidence.**

- Two prong reviews land under `specs/reviews/`:
  - `compiled-recipe-runtime-bridge-arc-close-codex-composition-adversary.md`
  - `compiled-recipe-runtime-bridge-arc-close-codex-cross-model-challenger.md`
- Both prongs return ACCEPT or ACCEPT-WITH-FOLD-INS; any fold-ins are merged before the next privileged runtime slice begins.
- Same-commit staging discipline holds: this ceremony slice stages both prong files AND advances `current_slice` in `PROJECT_STATE.md` in the same commit.
- `npm run audit` green against the staged tree.

**Why this not adjacent.** Skipping the composition review and relying
on per-slice challenger passes alone is exactly the failure mode AGENTS.md
calls out (Phase 2 foundation arc, 5 HIGH boundary seams unowned by any
single slice). Deferring it to a later arc is rejected: the next
privileged runtime slice cannot begin until this review is in.

**Lane.** Discovery (review only; no contract or runtime change in the
ceremony commit beyond `PROJECT_STATE.md`).

## §9 — Ratchets

- **Contract test count.** Strictly advances by ≥1 new test file or test case in Slice A; same in Slice B.
- **Runtime workflow surface area.** Strictly advances: the runner gains a second supported workflow source (compiled recipe). The static manifest path is preserved unchanged.
- **Recipe pipeline reach.** Strictly advances from "compiled draft is decorative" to "compiled draft drives a live run."
- No ratchet regresses. AGENTS.md hard invariant 8 (no aggregate scoring across ratchets) is honored: each dimension tracked independently in slice closes.

## §10 — Rollback

- Slice A is rollback-safe by `git revert` of the slice commit; the materializer module is new and has no callers outside its own test.
- Slice B is rollback-safe by `git revert`; the runner change is gated by an explicit constructor parameter and the manifest path is unchanged.
- Slice C's live-run artifacts live under `.circuit/circuit-runs/`; they are evidence, not load-bearing on any other code path. Reverting Slice B reverts the live path automatically.
- The bridge never modifies the static-manifest contract. Reverting any slice does not require schema or contract changes.

## §11 — Close criteria

The bridge is closed when:

1. Slices A, B, and C have each closed under Tier-0 gates.
2. Slice D's two-prong composition review is committed with ACCEPT or ACCEPT-WITH-FOLD-INS verdicts on both prongs and any fold-ins are merged.
3. `current_slice` in `PROJECT_STATE.md` is advanced in the same commit as the two prong review files (Check 26 staging discipline applies if the privileged-runtime variant of Check 26 is in force; otherwise the generalized arc-ledger gate applies).
4. `npm run audit` is green on the closing commit.
5. The plan's `status:` is updated to `closed` with `closed_at` and `closed_in_slice` set.
