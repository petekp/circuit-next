---
plan: runtime-checkpoint-artifact-widening
status: challenger-pending
revision: 03
opened_at: 2026-04-25
opened_in_session: runtime-checkpoint-artifact-widening-arc-open
base_commit: 0307150b9503fbb8d3170f433fa788ff2306e18f
target: runtime-checkpoint-artifact-write
authority:
  - specs/methodology/decision.md
  - specs/adrs/ADR-0003-authority-graph-gate.md
  - specs/adrs/ADR-0010-arc-planning-readiness-gate.md
  - specs/contracts/step.md
  - specs/invariants.json
  - src/schemas/step.ts
  - src/schemas/workflow.ts
  - src/schemas/artifacts/build.ts
  - src/schemas/artifacts/fix.ts
  - tests/contracts/schema-parity.test.ts
  - scripts/audit.mjs
  - specs/ratchet-floor.json
artifact_ids:
  - step.definition
prior_challenger_passes:
  - specs/reviews/runtime-checkpoint-artifact-widening-codex-challenger-01.md
  - specs/reviews/runtime-checkpoint-artifact-widening-codex-challenger-02.md
---

# Runtime Checkpoint Artifact Widening Plan

A prerequisite arc for the recipe-runtime-substrate plan. The substrate
plan as drafted in revision 03 (challenger pass 03, REJECT-PENDING-FOLD-INS,
finding F2 HIGH) cannot land an honest seam between recipe-domain
`runtime_step.write_target` and runtime `Step.writes.artifact` while the
runtime `CheckpointStep` refinement at `src/schemas/step.ts:176-189`
restricts checkpoint artifact writes to schema `build.brief@v1` (with
`policy.build_brief` precondition). The Fix recipe's only checkpoint
item materializes `fix.no-repro-decision@v1`, which the runtime rejects
at `Workflow.parse` time. This arc widens the runtime CheckpointStep
artifact-write refinement so the substrate's per-recipe-item
`runtime_step.write_target.schema` field has a legal runtime sink for
non-`build.brief@v1` schemas — without changing the runtime's gate /
checkpoint-policy / step-base contracts, and without widening the
runner's artifact materializer (that is a separate Fix-runtime concern,
out of scope here).

One Heavy slice lands the widening (refinement update + contract test
update + new contract test cases for non-`build.brief` paths) plus an
arc-close composition review wired into `ARC_CLOSE_GATES`.

## §Evidence census

Authoritative artifacts touched, in their current shape:

| Id | Statement | Status | Citation |
|---|---|---|---|
| E1 | `CheckpointStep` at `src/schemas/step.ts:113-125` extends `StepBase` with `executor: 'orchestrator'`, `kind: 'checkpoint'`, `policy: CheckpointPolicy`, `writes: {request: RunRelativePath, response: RunRelativePath, artifact: ArtifactRef.optional()}.strict()`, and `gate: CheckpointSelectionGate`. The `writes.artifact` slot is optional; when present, additional refinement applies at the `Step` discriminated-union level. | verified | `src/schemas/step.ts:113-125` |
| E2 | The `Step` discriminated-union superRefine at `src/schemas/step.ts:154-193` enforces (a) `gate.source.ref` resolves to a real `writes` slot for any step kind (`writes` slot existence check), (b) for checkpoint kind only, `gate.allow` exactly equals `policy.choices.id` (joined-by-NUL string equality), and (c) for checkpoint kind only, when `step.writes.artifact !== undefined`: `step.writes.artifact.schema` MUST equal the literal string `'build.brief@v1'` AND `step.policy.build_brief` MUST be defined. The build-brief-only restriction is implemented at `src/schemas/step.ts:176-191`. | verified | `src/schemas/step.ts:154-193` (specifically lines 176-191 for the artifact refinement) |
| E3 | `CheckpointPolicy` at `src/schemas/step.ts:60-110` carries `prompt`, `choices`, optional `safe_default_choice`, optional `safe_autonomous_choice`, and an optional `build_brief: {scope, success_criteria, verification_command_candidates}.strict()`. The `build_brief` payload is the only schema-specific precondition currently encoded in the policy. No other artifact-schema-specific preconditions exist. | verified | `src/schemas/step.ts:60-110` |
| E4 | `src/schemas/artifacts/build.ts:4-9` defines `BUILD_RESULT_SCHEMA_BY_ARTIFACT_ID` mapping `'build.brief'` to `'build.brief@v1'` (plus four other Build artifact rows). The `build.brief@v1` schema is registered in the artifact registry as a Build-workflow artifact. | verified | `src/schemas/artifacts/build.ts:4-9` |
| E5 | `src/schemas/artifacts/fix.ts:4-22` defines `FIX_RESULT_SCHEMA_BY_ARTIFACT_ID` mapping `'fix.no-repro-decision'` to `'fix.no-repro-decision@v1'` and `FIX_RESULT_PATH_BY_ARTIFACT_ID` mapping `'fix.no-repro-decision'` to `'artifacts/fix/no-repro-decision.json'`. The schema is registered in the Fix artifact registry. The corresponding Zod type `FixNoReproDecision` is defined at `src/schemas/artifacts/fix.ts:174-192`. | verified | `src/schemas/artifacts/fix.ts:4-22,154-192` |
| E6 | `tests/contracts/schema-parity.test.ts:560-610` carries a single negative test titled `'STEP-I9 — checkpoint artifact writing is restricted to typed Build brief policy'` that asserts (a) a checkpoint with `writes.artifact = {schema: 'build.brief@v1'}` and no `policy.build_brief` fails parse, AND (b) a checkpoint with `writes.artifact = {schema: 'other@v1'}` plus a populated `policy.build_brief` fails parse. The `'other@v1'` rejection is the artifact-schema allowlist gate; the `build_brief`-missing rejection is the precondition gate. | verified | `tests/contracts/schema-parity.test.ts:560-610` |
| E7 | `specs/contracts/step.md:121-126` defines STEP-I9 as `'Checkpoint policy and gate agreement'` — covering only the `gate.allow === policy.choices.id` invariant and the `safe_default_choice`/`safe_autonomous_choice` membership rule. The artifact-schema restriction at `src/schemas/step.ts:176-191` is NOT covered by any named invariant in `specs/contracts/step.md` or `specs/invariants.json`; the existing test title `'STEP-I9 — checkpoint artifact writing is restricted to typed Build brief policy'` mis-references STEP-I9. The artifact-schema gate is contract-implicit, not contract-explicit. | verified | `specs/contracts/step.md:121-126`, `specs/invariants.json:600-606`, `tests/contracts/schema-parity.test.ts:560` |
| E8 | The Fix recipe checkpoint item (`specs/workflow-recipes/fix-candidate.recipe.json:169-186`) declares `output: 'fix.no-repro-decision@v1'`. Substrate plan revision 03's seam diagram (`specs/plans/recipe-runtime-substrate.md:341-342`) binds recipe-item `runtime_step.write_target` directly into runtime `Step.writes.artifact`. After the substrate widening lands, the bridge would compose a `CheckpointStep` whose `writes.artifact = {path: 'artifacts/fix/no-repro-decision.json', schema: 'fix.no-repro-decision@v1'}`. The runtime refinement at `src/schemas/step.ts:177-181` rejects that shape today, blocking substrate revision 04 close. | verified | `specs/workflow-recipes/fix-candidate.recipe.json:169-186`, `specs/plans/recipe-runtime-substrate.md:341-342`, `src/schemas/step.ts:177-181` |
| E9 | Substrate plan challenger pass 03 (`specs/reviews/recipe-runtime-substrate-codex-challenger-03.md`, BOUND, `plan_content_sha256 = aaa814e9…`) finding F2 HIGH names this gap directly: `'Runtime CheckpointStep at src/schemas/step.ts:113-125,176-189 only permits artifact writing when the artifact schema is build.brief@v1 and policy.build_brief is present. The one live Fix checkpoint item outputs fix.no-repro-decision@v1, not build.brief@v1. Because the plan also says the runtime Gate / CheckpointPolicy / Step schemas stay unchanged, the substrate still does not provide a legal runtime sink for the Fix checkpoint without special-casing or another widening.'` Pass-03 also explicitly calls out the substrate plan's §4 non-goal that runtime schemas stay unchanged — meaning the widening must move into a separate prerequisite arc. | verified | `specs/reviews/recipe-runtime-substrate-codex-challenger-03.md:42-48` |
| E10 | The runner-side artifact materializer for `build.brief@v1` lives at `src/runtime/runner.ts:1166-1206` and gates on `artifact.schema !== 'build.brief@v1'` then synthesizes a `BuildBrief` from `policy.build_brief`. Other runner sites at `src/runtime/runner.ts:861, 888, 980, 995, 1604` also gate on `'build.brief@v1'`. These materializer paths are out of scope for this arc — widening the schema-level refinement does not require widening the runner-level materializer, because substrate plan §3 declares Live Fix execution out of scope. The runner gap is a downstream concern owned by a future Fix-runtime arc. | verified | `src/runtime/runner.ts:1166-1206,861,888,980,995,1604`, `specs/plans/recipe-runtime-substrate.md:286-287` |
| E11 | `step.definition` is row at `specs/artifacts.json:124-150` with `surface_class: greenfield`, `compatibility_policy: n/a`, `plane: control-plane`, `schema_file: src/schemas/step.ts`, and `schema_exports` covering `Step, SynthesisStep, VerificationStep, CheckpointPolicy, CheckpointStep, DispatchStep, DispatchRole, ArtifactRef, RouteMap`. Greenfield class permits widening the schema's runtime acceptance without successor-to-live characterization, since there is no prior live consumer to characterize against. | verified | `specs/artifacts.json:124-150` |
| E12 | The substrate plan's pass-03 record commit (slice-156c, HEAD `a364454a`) parks the substrate plan at revision 03 challenger-pending pending this prerequisite arc. The substrate plan's revision 04 close-criterion of `'F2 demonstrably resolves'` requires this arc to land first. | verified | git log HEAD; `specs/reviews/recipe-runtime-substrate-codex-challenger-03.md` |
| E13 | `ARC_CLOSE_GATES` in `scripts/audit.mjs` is the frozen array enforcing arc-close composition reviews; entries are `{arc_id, description, ceremony_slice, plan_path, review_file_regex}`. Slice 40 fold-in requires the two-prong gate to distinguish a Claude-prong file (name-match `*Claude*` / `*claude*`) from a Codex-prong file (name-match `*Codex*` / `*codex*`); a single-prong satisfaction is rejected. | verified | `scripts/audit.mjs` (ARC_CLOSE_GATES array; Slice 40 prong-distinction block) |
| E14 | Unknown-blocking: none. The widening shape (drop the `build.brief@v1` equality check; keep the `build.brief@v1 → policy.build_brief` precondition coupling; allow other registered schemas without precondition) is concrete and fits the existing `Step` superRefine block at `src/schemas/step.ts:154-193` with a small targeted edit. The acceptance test surface (the existing test at `tests/contracts/schema-parity.test.ts:560-610`) already exercises both the precondition-missing case and the unsupported-schema case; the second assertion changes from rejection-to-acceptance for `'fix.no-repro-decision@v1'`, while the precondition gate stays for `'build.brief@v1'`. | unknown-blocking | §5 design decisions are revision-01-final |

## §2 — Why this plan exists

With substrate plan revision 03 in place, the recipe-domain
authorities now carry enough for the bridge to compose
`Step.writes.artifact` from recipe-item `runtime_step.write_target`
(substrate §5 seam diagram).
For three of four execution kinds — synthesis, verification, dispatch —
the runtime `Step` discriminated union accepts arbitrary artifact
schemas via `ArtifactRef` (`src/schemas/step.ts:11-15`). Only the
checkpoint variant restricts the artifact schema, and only via the
`Step` superRefine block at lines 176-189 (E2).

That restriction was authored when the only live consumer of
checkpoint artifact writing was Build's frame-step brief flow. The
restriction encodes Build's specific shape — `build.brief@v1` plus a
`policy.build_brief` payload that the runner uses to synthesize the
brief artifact (E10). For Build alone, that is honest. The substrate
plan widens the recipe domain so the same checkpoint primitive
(`human-decision`) can back distinct recipe items across Build, Fix,
and any future workflow with their own schemas (substrate §3 in-scope
"Per-recipe-item runtime payload widening"; E22 in substrate plan).
The Fix recipe's `fix-no-repro-decision` item is the first live case:
it materializes `fix.no-repro-decision@v1` (E5, E8). The runtime
refinement rejects this at `Workflow.parse` time (E2, E8, E9), making
the substrate's seam claim — that the bridge reads `runtime_step.write_target`
directly into `Step.writes.artifact` — false for any non-`build.brief`
checkpoint.

Two prior arcs cannot resolve this gap from where they sit. The
substrate plan §4 non-goal explicitly states that runtime
`Gate / CheckpointPolicy / Step / Workflow` schemas stay unchanged
(`specs/plans/recipe-runtime-substrate.md:302-308`); folding the
widening into substrate would violate that non-goal and would conflate
a recipe-domain change with a runtime-domain change. The bridge plan
sits below the substrate and reads from it; the bridge cannot widen
its source authorities.

This arc carries the runtime-domain widening alone. Its scope is
narrow: change one refinement block in `src/schemas/step.ts` plus its
contract test surface; do not touch `Gate`, `CheckpointPolicy.choices`,
`CheckpointPolicy.safe_default_choice`, the policy `build_brief`
payload shape, or the runner-side artifact materializer. Once this arc
closes, substrate plan revision 04 can fold in the F1 (CRITICAL,
mechanical) and F3 (MED, mechanical) findings from substrate pass 03
and dispatch challenger pass 04 with the F2 gap closed upstream.

This is a planning-readiness arc by ADR-0010: a Heavy implementation
arc (substrate) requires its substrate (this widening) to encode the
structural sink its acceptance evidence depends on. The substrate plan
stays at challenger-pending revision 03 until this arc closes;
substrate revision 04 follows this arc's closing HEAD as its
`base_commit`.

## §3 — Scope

In scope:

- **Refinement update** (Slice A). Modify the `Step` discriminated-union
  superRefine block at `src/schemas/step.ts:154-193`, specifically the
  artifact-schema check at lines 176-191:
  - Drop the equality check `step.writes.artifact.schema !== 'build.brief@v1'`
    that currently rejects all non-`build.brief` artifact schemas.
  - Keep the precondition coupling: when
    `step.writes.artifact.schema === 'build.brief@v1'`,
    `step.policy.build_brief` MUST be present (otherwise issue:
    `'checkpoint artifact writing build.brief@v1 requires policy.build_brief'`).
  - For all other schema values: parse succeeds. No precondition is
    enforced at the schema level for non-`build.brief` schemas, because
    no other artifact schema currently encodes a policy-payload
    precondition (E3). Future schemas that need a precondition would
    add their own coupling rule in a future arc.
  - Preserve all other Step refinement rules unchanged: the
    `gate.source.ref` writes-slot existence check, the
    `gate.allow === policy.choices.id` invariant for checkpoint kind,
    every other variant's parse rules.

- **Contract test update** (Slice A). Update
  `tests/contracts/schema-parity.test.ts:560-610` (the existing
  `'STEP-I9 — checkpoint artifact writing is restricted to typed Build
  brief policy'` test) to reflect the widened semantics, AND add a new
  `it(...)` declaration so the repo's static contract-test count
  (`scripts/audit.mjs::countTests`, matching `/^\s*(it|test)\(/gm`)
  rises by exactly 1 — supporting the §9 Ratchet-Advance claim against
  the actual measurement surface, not assertion counts:
  - Rename the existing test (since STEP-I9 is actually the
    `gate.allow === policy.choices.id` invariant per
    `specs/contracts/step.md:121-126`, not the artifact-schema rule
    per E7) to
    `'CheckpointStep — build.brief@v1 artifact write requires policy.build_brief'`.
  - Keep the first assertion in the renamed test: a checkpoint with
    `writes.artifact = {schema: 'build.brief@v1'}` and no
    `policy.build_brief` still fails parse (the precondition gate
    holds for `build.brief@v1`).
  - Replace the second assertion in the renamed test: a checkpoint
    with `writes.artifact = {schema: 'other@v1'}` plus a populated
    `policy.build_brief` now PARSES (was rejected; the unsupported-
    schema gate is removed for non-`build.brief` schemas).
  - Add a NEW `it(...)` declaration immediately after the renamed
    test, titled
    `'CheckpointStep — fix.no-repro-decision@v1 artifact write parses without policy.build_brief at the Workflow layer'`.
    The assertion MUST exercise `Workflow.safeParse(...)` (NOT
    `Step.safeParse(...)`) on a minimal Workflow whose `steps[]`
    contains a checkpoint step with
    `writes.artifact = {schema: 'fix.no-repro-decision@v1', path: 'artifacts/fix/no-repro-decision.json'}`
    and NO `policy.build_brief`. This makes the §11 close criterion 5
    proof surface (Workflow-level parse acceptance, the actual gate
    substrate revision 04 needs to clear F2) directly executable
    rather than only claimed in prose. Use the existing `okWorkflow()`
    helper pattern already used by Workflow-level tests in this file
    (e.g. `tests/contracts/schema-parity.test.ts:875,891,911,921` and
    surrounding) to keep the harness minimal. Splitting this into its
    own `it(...)` rather than a third assertion in the renamed test
    is the mechanism that makes the static-count ratchet rise by 1.

- **Atomic schema + test landing** (Slice A). The refinement update
  and the contract test update land in the same commit. The repository
  must be Tier-0-green at every commit (npm run check, lint, test,
  verify all pass). Splitting refinement and test into separate slices
  would either leave the test asserting the old behavior (failing) or
  leave the refinement uncovered (audit ratchet regression).

- **Arc-close composition review** (Slice D). Two prong reviews under
  `specs/reviews/` named per the audit's arc-close composition-review
  filename convention (`arc-.+-composition-review-(claude|codex).md`,
  per `scripts/audit.mjs:5041-5042`
  `ARC_CLOSE_COMPOSITION_REVIEW_FILENAME_PATTERN`): one Claude-labeled
  and one Codex-labeled, satisfying both the Slice-40 fold-in two-prong
  convention and audit Check 35's arc-subsumption shape (i). Plus
  `ARC_CLOSE_GATES` wiring in `scripts/audit.mjs` and matching
  audit-test assertions.

Out of scope:

- **Runner-side artifact materializer widening.** `src/runtime/runner.ts`
  carries hardcoded `'build.brief@v1'` paths at lines 861, 888, 980,
  995, 1166-1206, 1604 (E10). Widening these to materialize
  `fix.no-repro-decision@v1` or other schemas is a Fix-runtime
  concern, owned by a separate future arc once Live Fix execution
  enters scope. The substrate plan's §3 explicitly declares Live Fix
  execution out of scope (`specs/plans/recipe-runtime-substrate.md:286-287`),
  so the substrate plan's close criteria do NOT depend on the runner
  materializer being widened — only on `Workflow.parse` accepting the
  bridged Fix-checkpoint shape.

- **Per-schema precondition machinery.** The current rule
  (`build.brief@v1` requires `policy.build_brief`) is preserved
  verbatim. No new generic per-schema precondition table is
  introduced. Future artifact schemas that need a policy precondition
  can encode their own coupling separately; this arc keeps the shape
  minimal.

- **`CheckpointPolicy.build_brief` payload shape changes.** The
  `build_brief` object's structure (`scope`, `success_criteria`,
  `verification_command_candidates`) stays unchanged. This arc
  preserves the Build-specific policy payload and only widens the
  artifact-schema acceptance.

- **`CheckpointPolicy.choices` / `gate.allow` widening.** The STEP-I9
  invariant proper (`gate.allow === policy.choices.id`) is preserved
  verbatim. This arc does not touch the choice-id surface or the
  `safe_default_choice` / `safe_autonomous_choice` rules.

- **Synthesis / verification / dispatch step widening.** Those step
  variants already accept arbitrary artifact schemas via `ArtifactRef`
  (`src/schemas/step.ts:11-15`); they are not restricted today. This
  arc only touches the checkpoint refinement block.

- **Adding new artifact schemas to `src/schemas/artifacts/`.**
  `fix.no-repro-decision@v1` already exists in
  `src/schemas/artifacts/fix.ts:8` (E5). Other future schemas will be
  added by their owning arcs.

- **Naming the surviving `build.brief@v1` ↔ `policy.build_brief`
  precondition coupling as a contract-surface invariant.** Per E7,
  the existing artifact-schema rule at `src/schemas/step.ts:176-191`
  is not represented by any named invariant in
  `specs/contracts/step.md` or `specs/invariants.json`. After this
  arc's widening, the surviving rule (the `build.brief@v1` precondition
  coupling) is still split-authority: it lives only in the runtime
  schema and an unbound test title. The plan explicitly preserves
  this drift rather than dispose it — promoting the coupling to a
  named Step invariant (e.g., a STEP-I-something entry in
  `specs/contracts/step.md` plus a matching row in
  `specs/invariants.json`) is deferred to a future contract-authority
  bookkeeping arc. This arc closes the runtime parse sink only; it
  does NOT close the contract-authority surface around checkpoint
  artifact preconditions.

## §4 — Non-goals

- The recipe domain (`WorkflowPrimitive`, `WorkflowRecipe`,
  `WorkflowRecipeItem`) is not touched. That widening is the substrate
  plan's job; this arc strictly precedes substrate revision 04.

- The bridge (`compileRuntimeReadyRecipe`, materialization functions)
  is not touched. The bridge plan owns the lowering rule from
  `runtime_step.write_target` to `Step.writes.artifact`; this arc only
  ensures the runtime accepts the bridged shape.

- A central `CHECKPOINT_ARTIFACT_REGISTRY` indirection (mapping schema
  strings to per-schema preconditions or materializer references) is
  NOT introduced. The two-line refinement edit is sufficient for the
  current consumer set; introducing a registry would be premature
  abstraction without a third concrete consumer to validate the shape.

- Aggregate ratchet scoring or single-knob composition is not
  introduced. AGENTS.md hard invariant 8 is preserved: each ratchet
  in §9 is tracked independently.

- No Workflow-level superRefine changes. `src/schemas/workflow.ts`
  invariants (WF-I1 through whatever the latest is) stay verbatim.

## §5 — Target seam shape

### Seam diagram

The widening is a single refinement block change. Before:

```
Step superRefine (src/schemas/step.ts:154-193)
└── for kind === 'checkpoint':
    ├── gate.allow === policy.choices.id (invariant — preserved)
    └── if step.writes.artifact !== undefined:
        ├── REJECT if artifact.schema !== 'build.brief@v1'    ← REMOVED
        └── REJECT if policy.build_brief === undefined         ← KEPT but coupled to schema
```

After:

```
Step superRefine (src/schemas/step.ts:154-193)
└── for kind === 'checkpoint':
    ├── gate.allow === policy.choices.id (invariant — preserved)
    └── if step.writes.artifact !== undefined:
        └── if artifact.schema === 'build.brief@v1':
            └── REJECT if policy.build_brief === undefined   (precondition coupling preserved)
        // any other schema: parse succeeds, no precondition enforced
```

### Refinement code shape

The current block at `src/schemas/step.ts:176-191` (verbatim):

```typescript
if (step.writes.artifact !== undefined) {
  if (step.writes.artifact.schema !== 'build.brief@v1') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['writes', 'artifact', 'schema'],
      message: 'checkpoint artifact writing currently supports only build.brief@v1',
    });
  }
  if (step.policy.build_brief === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['policy', 'build_brief'],
      message: 'checkpoint artifact writing build.brief@v1 requires policy.build_brief',
    });
  }
}
```

The widened block:

```typescript
if (step.writes.artifact !== undefined) {
  if (step.writes.artifact.schema === 'build.brief@v1' && step.policy.build_brief === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['policy', 'build_brief'],
      message: 'checkpoint artifact writing build.brief@v1 requires policy.build_brief',
    });
  }
  // Non-build.brief@v1 schemas parse without a schema-level precondition.
}
```

### Behavioral matrix

| Input shape (artifact.schema; policy.build_brief) | Before widening | After widening |
|---|---|---|
| `'build.brief@v1'`; present | parses | parses |
| `'build.brief@v1'`; absent | rejects (precondition gate) | rejects (precondition gate, preserved) |
| `'fix.no-repro-decision@v1'`; absent | rejects (allowlist gate) | parses (allowlist gate removed) |
| `'fix.no-repro-decision@v1'`; present | rejects (allowlist gate) | parses (no precondition coupling for non-build.brief) |
| `'arbitrary@v1'`; absent | rejects (allowlist gate) | parses (no precondition coupling for non-build.brief) |
| no artifact at all (undefined) | parses | parses |

### Failure modes the parser still rejects

- Checkpoint with `writes.artifact.schema === 'build.brief@v1'` and
  no `policy.build_brief` (preserved precondition).
- Checkpoint with `gate.allow !== policy.choices.id` (STEP-I9
  invariant proper, preserved).
- Checkpoint with `gate.source.ref` not pointing to a real `writes`
  slot (existing rule, preserved).
- Checkpoint with `safe_default_choice` or `safe_autonomous_choice`
  not in `policy.choices.id` (existing rule, preserved).
- Any non-checkpoint step kind shape mismatch (preserved).

## §6 — Authority graph classification (ADR-0003)

Per ADR-0003, every touched authority artifact is classified before
contract authorship begins. The single touched row is `step.definition`
(E11):

| Artifact id | Path | Surface class | Compatibility policy | Successor-to-live characterization |
|---|---|---|---|---|
| `step.definition` | `src/schemas/step.ts` | greenfield | n/a | not required (greenfield class permits widening without prior-shape characterization) |

The `step.definition` row is `surface_class: greenfield` — it has no
prior live consumer at the **parse layer** requiring characterization
preservation. The widening relaxes the runtime's parse-time
acceptance set; it does not narrow any existing-passing parse input.
Behavioral matrix in §5 confirms every previously-passing parse input
still passes.

The behavioral promotion is a **parse-layer strict relaxation** of
acceptance, NOT an end-to-end runtime relaxation:
- At `Step` / `Workflow.parse` time: every previously-passing input
  still passes; one previously-failing class of inputs
  (non-`build.brief@v1` artifact schemas at checkpoint) now passes.
- At runner execution time: the runner's artifact materializer at
  `src/runtime/runner.ts:861,888,980,995,1166-1206,1604` still
  hardcodes `'build.brief@v1'` paths and throws on any other
  checkpoint artifact schema. The newly admitted parse shapes
  (`fix.no-repro-decision@v1`, etc.) parse but do not yet execute
  end-to-end; that gap is fenced off in §3 out-of-scope and §11
  close criterion 5 as a deferred Fix-runtime concern.

The "no live consumer relied on the rejection" claim is bounded to
the parse layer: no live consumer code path successfully passed a
non-`build.brief@v1` checkpoint artifact through `Workflow.parse`
before this arc, so widening parse acceptance does not break any
prior parse-passing input. The runner-side rejection at execution
time is unchanged — it remains as a downstream gate that future
Fix-runtime arcs will widen separately. The Build flow's parse-time
AND execution-time behavior is preserved verbatim by this arc; only
non-Build parse acceptance changes.

There is no successor-to-live characterization slice required at the
parse layer because no live consumer relied on parse-time rejection
of non-`build.brief@v1` schemas. Successor-to-live characterization
at the runner execution layer is out of scope here (§3) and is the
concern of the future Fix-runtime arc whose bounded surface that
work would touch.

## §7 — Verification substrate

This arc uses the existing verification surface unchanged. Three
distinct audit mechanisms apply across Slices A and D, and they are
separate concerns:

- **Tier-0 gates** (npm run check, lint, test, verify) all run at
  every commit on the slice. The contract test update lives in
  `tests/contracts/schema-parity.test.ts`, an existing file already
  in the test suite. The new `it(...)` for the
  `fix.no-repro-decision@v1` positive case lands in the same file.
- **Plan-lint** runs at draft and challenger-pending lifecycle steps.
- **Audit** (`npm run audit`) runs after the slice lands. Three
  named checks bear on this arc:
  - `Contract test ratchet` (`scripts/audit.mjs:6297-6315`,
    backed by `countTests` at `scripts/audit.mjs:507-518` matching
    `/^\s*(it|test)\(/gm`): the HEAD-vs-HEAD~1 static
    test-declaration delta. Slice A advances this by +1 via the new
    `it(...)` declaration.
  - `Pinned ratchet floor (specs/ratchet-floor.json)`
    (`checkPinnedRatchetFloor` at `scripts/audit.mjs:6457`): the
    pinned floor `floors.contract_test_count` must not regress.
    Slice A advances the floor explicitly: 1062 → 1063, with
    `last_advanced_in_slice` and `last_advanced_at` updated in the
    same commit so the audit pinned-floor check stays green and the
    floor reflects the new authored count. (Floor advancement is an
    explicit commit action; the floor is not auto-derived from
    HEAD~1.)
  - `Arc-close composition review` (`scripts/audit.mjs:6556`,
    iterates `ARC_CLOSE_GATES`): Slice D's two prong review files
    plus the new `ARC_CLOSE_GATES` entry satisfy this check for the
    `runtime-checkpoint-artifact-widening` arc id.
  These are three independent checks; they are not a single
  composite gate. None of them requires the others to fire.
- **This arc requires no new verification capability.** The schema
  refinement edit covers all behavioral changes; existing test
  infrastructure (`countTests`, `checkPinnedRatchetFloor`, the
  `ARC_CLOSE_GATES` iterator, and
  `ARC_CLOSE_COMPOSITION_REVIEW_FILENAME_PATTERN` at
  `scripts/audit.mjs:5041-5042`) suffices.

## §8 — Slices

### 8.1 Slice A — Widen CheckpointStep artifact-schema refinement (Heavy, Ratchet-Advance)

**Failure mode addressed.** The substrate plan's revision-03 seam
binding (recipe-item `runtime_step.write_target` → runtime
`Step.writes.artifact`, per `specs/plans/recipe-runtime-substrate.md:341-342`)
is rejected at `Workflow.parse` time when the schema is anything
other than `build.brief@v1` (E2, E8). Without this widening, the
substrate plan cannot land an honest seam for the Fix recipe's
`fix-no-repro-decision` checkpoint item or for any future workflow's
non-Build checkpoint artifact.

**Acceptance evidence.**

- The block at `src/schemas/step.ts:176-191` is rewritten per §5 to
  drop the `schema !== 'build.brief@v1'` rejection while preserving
  the `build.brief@v1 → policy.build_brief` precondition coupling.
- `tests/contracts/schema-parity.test.ts` is updated:
  - The existing test at line 560 is renamed to
    `'CheckpointStep — build.brief@v1 artifact write requires policy.build_brief'`.
  - Assertion 1 in the renamed test (build.brief@v1 with no
    policy.build_brief → fails) is preserved.
  - Assertion 2 in the renamed test changes shape: `'other@v1'`
    schema with populated `policy.build_brief` now PARSES (was
    rejected by the dropped allowlist gate).
  - A NEW `it(...)` declaration lands immediately after the renamed
    test, titled
    `'CheckpointStep — fix.no-repro-decision@v1 artifact write parses without policy.build_brief at the Workflow layer'`,
    asserting via `Workflow.safeParse(...)` (NOT `Step.safeParse(...)`)
    against a minimal `okWorkflow({steps: [...]})` shape that
    `'fix.no-repro-decision@v1'` with NO `policy.build_brief` parses
    at the Workflow level (the live consumer pattern from E5, E8).
    Workflow-level acceptance is the surface substrate revision 04's
    F2 close-criterion needs to clear, so this proof matches §11
    close criterion 5 directly.
- Test count delta: 2 tests after change in the affected block
  (1 renamed existing + 1 new `it(...)` for the
  `fix.no-repro-decision@v1` positive case). Net +1 static
  declaration counted by `scripts/audit.mjs::countTests`, advancing
  `specs/ratchet-floor.json` `floors.contract_test_count` from
  current 1062 to 1063 in the same commit (Slice A advances
  `last_advanced_in_slice` and `last_advanced_at` accordingly per the
  ratchet-floor advancement discipline). All other contract tests
  remain green.
- `npm run plan:lint -- specs/plans/runtime-checkpoint-artifact-widening.md`
  GREEN both modes (default + `--context=committed`).
- `npm run verify` GREEN: `npm run check` (tsc), `npm run lint`
  (biome), `npm run test` (vitest) all pass with the widened
  refinement and updated test.
- `npm run audit` GREEN against the slice ceremony (lane declaration,
  framing pair, citation rule, contract test ratchet).

**Why this not adjacent.** Splitting the refinement update from the
test update would either leave the suite asserting the old behavior
(test fails after refinement edit) or leave the refinement uncovered
(audit ratchet regression — every behavioral change requires a
covering test). Atomic landing keeps Tier-0 green at every commit.

**Lane.** Ratchet-Advance: the static contract-test declaration count
(`scripts/audit.mjs::countTests`, pinned at `specs/ratchet-floor.json`
`floors.contract_test_count`) advances by one via the new `it(...)`
declaration for the `fix.no-repro-decision@v1` positive case. The
renamed existing test is a rename, not a count change; the ratchet
floor moves 1062 → 1063 in the same commit.

**Work mode.** Heavy: this slice modifies a runtime contract surface
(`src/schemas/step.ts` Step superRefine), which AGENTS.md §Work modes
classifies as Heavy ("runtime behavior, adapters, dispatch,
event/result writing, gates, safety relaxations, and workflow close
claims"). External Codex challenger required.

**Authority.** ADR-0003; ADR-0010; specs/contracts/step.md;
specs/invariants.json; src/schemas/step.ts; src/schemas/workflow.ts
(the new it(...) exercises `Workflow.safeParse(...)` per §3 in-scope
F3 fold-in); src/schemas/artifacts/build.ts; src/schemas/artifacts/fix.ts;
tests/contracts/schema-parity.test.ts; specs/ratchet-floor.json.

### 8.2 Slice D — Arc-close composition review (Heavy, Ratchet-Advance, ceremony + gate wiring)

**Failure mode addressed.** Without an explicit composition review and
arc-close gate wiring, this prerequisite arc could close without an
external prong-reviewed verdict that the runtime widening is honestly
narrow (does not silently widen anything beyond the artifact-schema
acceptance set). The substrate plan revision 04 then takes this arc's
close as a basis for its own F2 close-criterion; an unreviewed close
would leave that downstream claim under-evidenced.

**Acceptance evidence.**

- Two prong reviews land in `specs/reviews/` per the Slice-40 fold-in
  two-prong convention (E13) AND the audit's
  `ARC_CLOSE_COMPOSITION_REVIEW_FILENAME_PATTERN`
  (`scripts/audit.mjs:5041-5042`,
  `/^arc-.+-composition-review-(?:claude|codex)\.md$/i`):
  - `specs/reviews/arc-runtime-checkpoint-artifact-widening-composition-review-claude.md`
    (Claude-prong; surveys the widened refinement against the Step
    superRefine surface area, the runner-side build.brief paths, and
    the substrate plan's seam diagram).
  - `specs/reviews/arc-runtime-checkpoint-artifact-widening-composition-review-codex.md`
    (Codex-prong; independent external review of the same surface).
- `ARC_CLOSE_GATES` in `scripts/audit.mjs` gains a new entry:
  - `arc_id: 'runtime-checkpoint-artifact-widening'`
  - `description: 'Runtime CheckpointStep artifact-schema widening — arc-close composition review'`
  - `ceremony_slice: <Slice D's slice number>`
  - `plan_path: 'specs/plans/runtime-checkpoint-artifact-widening.md'`
  - `review_file_regex: /^arc-runtime-checkpoint-artifact-widening-composition-review-(?:claude|codex)\.md$/i`
    (arc-bound subset of `ARC_CLOSE_COMPOSITION_REVIEW_FILENAME_PATTERN`,
    matching both prong files; conforms to Check 35's arc-subsumption
    shape (i) so ceremony commits can satisfy both Check 26 and Check 35
    via the same review pair, no separate per-slice review file needed).
- Audit-test assertions in the contract tests that bind
  `ARC_CLOSE_GATES` (currently
  `tests/contracts/artifact-backing-path-integrity.test.ts` for
  per-gate isolation behavior and
  `tests/contracts/slice-47d-audit-extensions.test.ts` for
  arc-close gate iteration / Check 35 arc-subsumption shape) gain
  matching cases exercising the new arc id.
- Plan frontmatter advances: `status: closed`, `closed_at: <YYYY-MM-DD>`,
  `closed_in_slice: <Slice D's slice number>`, `closed_with: <one-line summary>`.
- `npm run audit` GREEN against the closed arc.

**Why this not adjacent.** An arc-close composition review and gate
wiring is the standard close ceremony for a Heavy arc per AGENTS.md
§Cross-slice composition review cadence. Skipping it would leave the
arc unaudited and the substrate plan's revision-04 dependency on a
closed prerequisite under-grounded.

**Lane.** Ratchet-Advance: arc-close gate ratchet advances by one
new entry; arc-close test ratchet advances by matching test cases.

**Work mode.** Heavy: arc-close ceremony with external prong review.

**Authority.** ADR-0010; specs/methodology/decision.md;
scripts/audit.mjs; tests/contracts/artifact-backing-path-integrity.test.ts
(current `ARC_CLOSE_GATES` coverage); tests/contracts/slice-47d-audit-extensions.test.ts
(arc-close gate behavior); specs/plans/runtime-checkpoint-artifact-widening.md.

## §9 — Ratchets

| Ratchet | Direction | Slice |
|---|---|---|
| `specs/ratchet-floor.json` `floors.contract_test_count` (the static `/^\s*(it|test)\(/gm` count produced by `scripts/audit.mjs::countTests`, currently 1062 per `specs/ratchet-floor.json:4`) | Strictly advance: +1 declaration via the new `it(...)` for `fix.no-repro-decision@v1`; floor moves 1062 → 1063, with `last_advanced_in_slice` and `last_advanced_at` updated in the same Slice A commit. The renamed existing test is a rename, not a count change; only the new `it(...)` advances the count. | Slice A |
| `ARC_CLOSE_GATES` entries in `scripts/audit.mjs` | Strictly advance: +1 entry for `runtime-checkpoint-artifact-widening`. | Slice D |
| Arc-close composition review prong count under `specs/reviews/` matching `arc-runtime-checkpoint-artifact-widening-composition-review-(claude|codex).md` | Strictly advance: +2 prong files (Claude + Codex). | Slice D |

Each ratchet is tracked independently per AGENTS.md hard invariant 8.
No aggregate scoring is introduced.

## §10 — Rollback

The widening is a strict relaxation of acceptance (§6 behavioral
matrix). Rollback to the pre-arc state requires:

1. Revert the `src/schemas/step.ts:176-191` block to the
   pre-Slice-A shape (re-introducing the `schema !== 'build.brief@v1'`
   rejection).
2. Revert the `tests/contracts/schema-parity.test.ts:560-610` block
   to the pre-Slice-A test shape: rename the existing test back;
   restore the `'other@v1'` rejection assertion; delete the new
   `it(...)` for the `fix.no-repro-decision@v1` positive case.
3. Revert `specs/ratchet-floor.json` `floors.contract_test_count`
   from 1063 back to 1062, and revert `last_advanced_in_slice` /
   `last_advanced_at` to their pre-Slice-A values.
4. Revert the `scripts/audit.mjs` `ARC_CLOSE_GATES` array to remove
   the new arc entry; revert the matching audit-test assertions;
   delete the two arc-close composition-review prong files at
   `specs/reviews/arc-runtime-checkpoint-artifact-widening-composition-review-{claude,codex}.md`.
5. Set plan frontmatter `status` back from `closed` to whatever
   pre-close state is appropriate.

After rollback, the substrate plan's revision-04 fold-in is again
blocked on F2 from substrate pass 03; rollback is a recoverable but
not free operation.

## §11 — Close criteria

This arc closes when ALL of the following hold:

1. Slice A landed: `src/schemas/step.ts` widened per §5; contract
   tests updated per §3; `npm run verify` GREEN; `npm run plan:lint`
   GREEN both modes; `npm run audit` GREEN.

2. Slice D landed: two prong composition reviews under `specs/reviews/`;
   `ARC_CLOSE_GATES` wired in `scripts/audit.mjs`; matching audit-test
   assertions land; `npm run audit` GREEN against the closed arc.

3. Codex challenger pass against the plan returns ACCEPT or
   ACCEPT-WITH-FOLD-INS, recorded under
   `specs/reviews/runtime-checkpoint-artifact-widening-codex-challenger-NN.md`
   with binding `reviewed_plan` frontmatter (slug + revision +
   base_commit + content sha256 all matching the on-disk plan at
   close time).

4. Plan frontmatter `status: closed`, `closed_at`, `closed_in_slice`,
   `closed_with` populated.

5. **Downstream readiness check — Workflow-layer parse sink only.**
   The substrate plan revision 04 precondition gate clears at the
   Workflow-layer parse sink: a freshly drafted
   `Workflow.safeParse(...)` call against a minimal Workflow whose
   `steps[]` contains a checkpoint step with
   `writes.artifact = {path: 'artifacts/fix/no-repro-decision.json',
   schema: 'fix.no-repro-decision@v1'}` and no `policy.build_brief`
   succeeds. This proves substrate pass 03 finding F2 is resolvable
   at the runtime Workflow-parse layer upstream of substrate
   revision 04. (The check itself is in-process via the new
   `it(...)` for the `fix.no-repro-decision@v1` positive case landed
   in Slice A, which exercises `Workflow.safeParse(...)` directly
   per §3 in-scope contract test bullet; this close criterion is
   documentary.)

   This criterion is explicitly bounded to the **runtime parse
   layer**. Two surfaces remain UNCLOSED at arc close and are
   intentionally deferred to follow-up arcs:
   - The runner-side artifact materializer at
     `src/runtime/runner.ts:861,888,980,995,1166-1206,1604` still
     hardcodes `'build.brief@v1'` paths. Live Fix execution end-to-end
     does not work after this arc; the substrate plan §3 explicitly
     declares Live Fix execution out of scope, so substrate
     revision 04's close criteria do not depend on the runner being
     widened — only on `Workflow.parse` accepting the bridged Fix
     shape, which this arc delivers.
   - The contract-authority surface for the surviving
     `build.brief@v1` ↔ `policy.build_brief` coupling (E7 split-
     authority drift) is not promoted to a named invariant in
     `specs/contracts/step.md` or `specs/invariants.json`. This is
     deferred to a future contract-authority bookkeeping arc per §3
     out-of-scope. Substrate revision 04's F2 close-criterion is
     about the runtime sink existing for non-`build.brief` schemas,
     not about the surviving build-brief coupling having an explicit
     contract-surface name; this arc satisfies the former and
     explicitly defers the latter.
