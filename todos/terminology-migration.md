Below is a guide you can hand directly to a coding agent.

---

# Circuit terminology migration guide

## Mission

Migrate Circuit’s terminology so the codebase feels coherent, product-native, and easier for humans and agents to understand.

The desired language is:

> **Circuit runs flows.**
> Each flow is defined by a **schematic**.
> A schematic wires reusable **blocks** into stages and steps.
> A run follows routes through the schematic, relays specialist work when needed, records a trace, pauses at checkpoints, and closes with a report and evidence.

This migration should improve terminology without changing runtime behavior.

The repo currently mixes product language, runtime language, project-history language, and implementation jargon. Your job is to make the terminology deliberate and layered.

---

# Canonical vocabulary

Use this target vocabulary.

| Current term                          | New preferred term                                           | Scope                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| workflow                              | **flow**                                                     | Product/user-facing language. Keep `Workflow` for compiled runtime objects unless explicitly migrating later. |
| recipe                                | **schematic**                                                | Replace broadly: files, docs, types, comments, tests.                                                         |
| primitive                             | **block**                                                    | Replace for workflow/flow composition. Do **not** blindly rename low-level schema primitives.                 |
| phase                                 | **stage**                                                    | Product/docs. Code/schema migration can happen later if safe.                                                 |
| step                                  | **step**                                                     | Keep.                                                                                                         |
| route                                 | **route**                                                    | Keep.                                                                                                         |
| dispatch                              | **relay**                                                    | Product/docs/comments. Deep runtime/event migration should be separate and compatibility-aware.               |
| adapter                               | **connector**                                                | Product/docs. Internal adapter code can remain if it names an implementation boundary.                        |
| synthesis                             | **compose** / “Circuit writes”                               | Product/docs; consider code rename later.                                                                     |
| gate                                  | **check**                                                    | Product/docs; schema rename should be separate if done.                                                       |
| checkpoint                            | **checkpoint**                                               | Keep.                                                                                                         |
| artifact                              | **output**, **report**, or **evidence file**                 | Product/docs. Internal typed artifact code may remain.                                                        |
| event log                             | **run trace**                                                | Product/docs; code rename optional.                                                                           |
| run root                              | **run folder**                                               | Product/docs; add CLI alias if practical.                                                                     |
| rigor                                 | **depth** or **mode**                                        | Product/docs; add CLI alias if practical.                                                                     |
| lane                                  | **change kind** or **safety mode**                           | Product/docs; code rename optional.                                                                           |
| spine                                 | **path** or **stage path**                                   | Remove from product surfaces.                                                                                 |
| fixture                               | **generated workflow**, **test workflow**, or **sample run** | Avoid in product surfaces.                                                                                    |
| ADR / Slice / P2 / placeholder-parity | No product-facing replacement                                | Remove from product and command surfaces. Keep only in historical/internal specs if needed.                   |

Do not over-theme the repo. Avoid cute electronics words like voltage, current, impedance, resistor, terminal, board, bus, etc. The good thematic terms are enough:

```text
flow
schematic
block
route
relay
signal
trace
checkpoint
check
```

---

# Hard constraints

1. **Do not change behavior unless explicitly required by the terminology migration.**
2. **Do not use blind global search-and-replace.** Many terms have legitimate internal meanings.
3. **Generated files must be regenerated, not hand-edited.**

   * `commands/build.md`, `commands/explore.md`, `commands/fix.md`, and `commands/review.md` are generated from `src/workflows/<id>/command.md`.
   * `commands/run.md` is hand-authored.
   * `.claude-plugin/` outputs should be updated through `npm run emit-workflows`.
4. **Keep compiled workflow JSON semantically identical** unless a deliberate schema migration requires otherwise.
5. **Each phase must end with checks.** Do not stack ten terminology migrations before running TypeScript and tests.
6. **Leave a terminology policy behind** so future agents do not regress the language.

---

# Recommended commit / phase sequence

Do this in deliberate phases. Each phase should be independently understandable and testable.

## Phase 0 — Baseline and inventory

### Goal

Understand the current state before renaming anything.

### Run from repo root

```bash
npm ci
npm run check
npm run build
npm run test
npm run check-workflow-drift
npm run lint
```

If lint is already red, record the existing failures. Do not hide unrelated failures. If formatting-only fixes are needed, apply them deliberately with:

```bash
npm run format
npm run lint
```

### Generate a terminology inventory

Run:

```bash
rg -n "\b(recipe|recipes|primitive|primitives|dispatch|dispatches|synthesis|orchestrator-synthesis|artifact|artifact_pointers|event log|run root|run_root|rigor|lane|spine|fixture|ADR|Slice|P2|placeholder-parity|dogfood)\b" \
  README.md AGENTS.md CLAUDE.md HANDOFF.md commands docs specs src tests scripts .claude-plugin \
  --glob '!node_modules' \
  --glob '!dist'
```

Also inspect filenames:

```bash
find . \
  \( -name '*recipe*' -o -name '*primitive*' -o -name '*dispatch*' -o -name '*synthesis*' -o -name '*gate*' -o -name '*event-log*' \) \
  -not -path './node_modules/*' \
  -not -path './dist/*'
```

### Stop condition

You should have a short written inventory of where the old terms appear and which are product-facing vs internal.

---

## Phase 1 — Add a terminology policy

### Goal

Create the source of truth before changing the repo around it.

### Add

```text
docs/terminology.md
```

Suggested contents:

```md
# Circuit terminology

Circuit runs flows.

A flow is a named kind of work, such as Build, Fix, Explore, Review, Migrate,
or Sweep.

Each flow is defined by a schematic. The schematic wires reusable blocks into
stages and steps.

A block is a reusable kind of work. A step is a concrete use of a block inside
a schematic.

A run follows routes through the schematic, relays specialist work to agents,
records a trace, pauses at checkpoints when needed, and closes with a report
and evidence.

## Product terms

- Flow: a named unit users run, such as Build or Fix.
- Schematic: the authored definition of a flow.
- Block: a reusable kind of work.
- Stage: a grouped part of a flow.
- Step: one executable unit.
- Route: the next path after a step.
- Relay: a handoff to a specialist agent.
- Connector: a backend or host used to run a relayed step.
- Check: validation that decides whether a step can continue.
- Checkpoint: a pause for operator input or choice.
- Trace: the ordered record of what happened during a run.
- Report: the final human-readable closeout.
- Evidence: supporting files, facts, checks, and outputs.
- Run folder: the directory where a run records its trace, reports, and evidence.
- Depth: how thorough the run should be.

## Internal terms

These may remain in low-level runtime code when they describe precise
implementation details:

- Workflow: compiled runtime object.
- Adapter: low-level connector implementation.
- Artifact: typed runtime file.
- Gate: schema/runtime check primitive, if not yet migrated.
- Dispatch: serialized runtime step kind, if not yet migrated.
- Synthesis: legacy/internal compose step kind, if not yet migrated.

## Avoid in product surfaces

Avoid these in README intros, slash command prose, generated command files,
workflow command sources, and agent-facing instructions:

- recipe
- primitive, when referring to flow composition
- dispatch
- synthesis
- orchestrator-synthesis
- artifact pointer
- canonical event log
- run root
- rigor
- lane
- spine
- fixture
- ADR ids
- Slice ids
- P2 labels
- placeholder-parity
- dogfood
```

### Update references

Add a short link to this doc from:

```text
README.md
AGENTS.md
docs/workflows/direction.md
```

### Checks

```bash
npm run check
npm run lint
```

---

## Phase 2 — Product surface cleanup

### Goal

Make the user-facing and agent-facing prose sound like Circuit.

### Edit these first

```text
README.md
AGENTS.md
commands/run.md
src/workflows/build/command.md
src/workflows/explore/command.md
src/workflows/fix/command.md
src/workflows/review/command.md
src/workflows/*/contract.md
docs/workflows/*.md
```

Do **not** directly edit generated command files except `commands/run.md`.

Generated:

```text
commands/build.md
commands/explore.md
commands/fix.md
commands/review.md
```

Source of truth:

```text
src/workflows/<id>/command.md
```

### Rewrite style

Prefer this:

```text
Use Build for a focused code change.

Circuit runs the Build flow: it confirms the brief, makes a plan, relays the
implementation to a worker, runs checks, asks for review when required, and
closes with a report and evidence.
```

Avoid this:

```text
Run the Build workflow. It performs orchestrator-synthesis, dispatches through
adapters, evaluates gates, and writes artifacts under the run root.
```

### Specific replacements for product prose

| Old                               | New                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `workflow`                        | `flow`, unless referring to compiled runtime objects                          |
| `recipe`                          | `schematic`                                                                   |
| `primitive`                       | `block`                                                                       |
| `dispatch to subprocess adapters` | `relay to specialist agents`                                                  |
| `orchestrator-synthesis`          | `Circuit writes`, `Circuit composes`, or the concrete action                  |
| `gate`                            | `check`                                                                       |
| `event log`                       | `run trace`                                                                   |
| `run root`                        | `run folder`                                                                  |
| `artifact`                        | `report`, `output`, or `evidence file`                                        |
| `artifact_pointers`               | `evidence links`                                                              |
| `verdict`                         | `decision` or `review result`, unless the schema field is literally `verdict` |
| `rigor`                           | `depth` or `mode`                                                             |
| `spine`                           | `path` or `stage path`                                                        |
| `fixture`                         | `generated workflow`, `sample`, or `test workflow`                            |

### Regenerate generated outputs

```bash
npm run emit-workflows
npm run check-workflow-drift
```

### Checks

```bash
npm run check
npm run build
npm run test -- tests/contracts
npm run lint
```

### Stop condition

Product-facing prose should no longer read like a runtime manual.

---

## Phase 3 — Add a terminology regression test

### Goal

Make the language policy enforceable so future agents do not regress it.

### Add a test

Create:

```text
tests/contracts/terminology-product-surface.test.ts
```

The test should scan product-facing files and fail on banned terms.

Suggested product-facing file set:

```text
README.md
AGENTS.md
commands/run.md
src/workflows/*/command.md
src/workflows/*/contract.md
docs/workflows/*.md
```

Optionally include generated command files after `emit-workflows`:

```text
commands/*.md
.claude-plugin/README.md
.claude-plugin/skills/**/*.md
```

Suggested banned-term list:

```ts
const banned = [
  /\brecipe(s)?\b/i,
  /\bprimitive(s)?\b/i,
  /\bdispatch(?:es|ed|ing)?\b/i,
  /\bsynthesis\b/i,
  /\borchestrator-synthesis\b/i,
  /\bartifact pointer(s)?\b/i,
  /\bcanonical event log\b/i,
  /\brun root\b/i,
  /\brigor\b/i,
  /\blane\b/i,
  /\bspine\b/i,
  /\bfixture(s)?\b/i,
  /\bADR-[0-9]+\b/i,
  /\bSlice\b/i,
  /\bCC#P[0-9]/i,
  /\bplaceholder-parity\b/i,
  /\bdogfood\b/i,
];
```

Important: allow exceptions only in `docs/terminology.md` and only inside a “deprecated/internal terms” section. Do not allow broad ignore lists.

### Checks

```bash
npm run test -- tests/contracts/terminology-product-surface.test.ts
npm run test -- tests/contracts
```

---

## Phase 4 — Rename `recipe` to `schematic`

### Goal

Migrate the authoring concept from recipe to schematic across files, types, scripts, tests, and docs.

This is the highest-value structural rename.

### Files to rename

Use `git mv`.

```text
src/workflows/build/recipe.json      → src/workflows/build/schematic.json
src/workflows/explore/recipe.json    → src/workflows/explore/schematic.json
src/workflows/fix/recipe.json        → src/workflows/fix/schematic.json
src/workflows/migrate/recipe.json    → src/workflows/migrate/schematic.json
src/workflows/review/recipe.json     → src/workflows/review/schematic.json
src/workflows/sweep/recipe.json      → src/workflows/sweep/schematic.json

src/schemas/workflow-recipe.ts       → src/schemas/flow-schematic.ts
src/runtime/compile-recipe-to-workflow.ts
                                     → src/runtime/compile-schematic-to-workflow.ts

docs/workflows/recipe-composition.md → docs/workflows/flow-schematics.md

tests/contracts/compile-recipe-to-workflow.test.ts
                                     → tests/contracts/compile-schematic-to-workflow.test.ts
tests/contracts/workflow-recipe.test.ts
                                     → tests/contracts/flow-schematic.test.ts
tests/unit/compile-recipe-per-mode.test.ts
                                     → tests/unit/compile-schematic-per-mode.test.ts
```

### Type and identifier rename map

| Old                           | New                               |
| ----------------------------- | --------------------------------- |
| `WorkflowRecipe`              | `FlowSchematic`                   |
| `WorkflowRecipeStatus`        | `FlowSchematicStatus`             |
| `WorkflowRecipeItem`          | `FlowStepSpec` or `SchematicStep` |
| `WorkflowRecipeEntryMode`     | `FlowEntryMode`                   |
| `WorkflowRecipeWrites`        | `StepWrites`                      |
| `WorkflowRecipeGate`          | `StepCheck`                       |
| `WorkflowRecipeExecution`     | `StepExecution`                   |
| `WorkflowRecipeExecutionKind` | `StepExecutionKind`               |
| `WorkflowRecipeRouteTarget`   | `StepRouteTarget`                 |
| `WorkflowRecipeCompileError`  | `FlowSchematicCompileError`       |
| `compileRecipeToWorkflow`     | `compileSchematicToWorkflow`      |
| `compile-recipe-to-workflow`  | `compile-schematic-to-workflow`   |
| `recipePath`                  | `schematicPath`                   |
| `pkg.paths.recipe`            | `pkg.paths.schematic`             |

I prefer `SchematicStep` over `FlowStepSpec` if you want the term to stay close to the new model. Either is fine; choose one and use it consistently.

### Update `src/workflows/types.ts`

Change:

```ts
readonly recipe: string;
```

to:

```ts
readonly schematic: string;
```

Update comments:

```ts
// Schematic path is required — every flow has a schematic.
readonly schematic: string;
```

During the migration, you may temporarily support both:

```ts
readonly schematic?: string;
readonly recipe?: string;
```

but the final state should require `schematic` and remove `recipe`.

### Update each workflow package index

Example:

```ts
paths: {
  schematic: 'src/workflows/build/schematic.json',
  command: 'src/workflows/build/command.md',
  contract: 'src/workflows/build/contract.md',
}
```

### Update `scripts/emit-workflows.mjs`

Rename internal variables and messages:

```text
recipePath     → schematicPath
compileOne     → compileOneSchematic
recipe compiles → schematic compiles
```

Update imports from dist:

```text
dist/runtime/compile-schematic-to-workflow.js
dist/schemas/flow-schematic.js
```

Use:

```js
const [{ compileSchematicToWorkflow }, { FlowSchematic }] = await Promise.all([...]);
```

### Preserve behavior

After this phase, generated workflow JSON should be unchanged except for generated prose changes already made in earlier phases.

Check with:

```bash
npm run build
npm run emit-workflows
npm run check-workflow-drift
npm run test -- tests/contracts/compile-schematic-to-workflow.test.ts
npm run test -- tests/unit/compile-schematic-per-mode.test.ts
npm run test -- tests/contracts
npm run check
npm run lint
```

### Stop condition

The repo should contain no authoring-level `recipe` terminology except in explicit deprecated-term docs or compatibility comments.

Run:

```bash
rg -n "\b(recipe|recipes|WorkflowRecipe|compileRecipe|recipePath|recipe\.json|workflow-recipe)\b" \
  src tests docs README.md AGENTS.md commands scripts specs \
  --glob '!dist' \
  --glob '!node_modules'
```

Every hit must be either removed, intentionally deprecated, or in historical reference material.

---

## Phase 5 — Rename workflow composition `primitive` to `block`

### Goal

Migrate reusable workflow/flow composition units from `primitive` to `block`.

Do not rename `src/schemas/primitives.ts` if it is truly about low-level schema primitives like path-safe strings. That is a valid use of “primitive.”

### Files to rename

```text
docs/workflows/primitive-catalog.json → docs/workflows/block-catalog.json
docs/workflows/primitives.md          → docs/workflows/blocks.md
src/schemas/workflow-primitives.ts    → src/schemas/flow-blocks.ts
```

Tests:

```text
tests/contracts/primitives.test.ts
  → tests/contracts/blocks.test.ts

tests/contracts/orphan-primitives.test.ts
  → tests/contracts/orphan-blocks.test.ts

tests/contracts/workflow-primitive-catalog.test.ts
  → tests/contracts/flow-block-catalog.test.ts
```

### Type and identifier rename map

| Old                                 | New                         |
| ----------------------------------- | --------------------------- |
| `WORKFLOW_PRIMITIVE_IDS`            | `FLOW_BLOCK_IDS`            |
| `WorkflowPrimitiveId`               | `FlowBlockId`               |
| `WorkflowPrimitiveRoute`            | `FlowRoute`                 |
| `WorkflowPrimitiveActionSurface`    | `FlowBlockActionSurface`    |
| `WorkflowPrimitiveGateKind`         | `FlowBlockCheckKind`        |
| `WorkflowPrimitiveHumanInteraction` | `FlowBlockHumanInteraction` |
| `WorkflowPrimitiveContractRef`      | `FlowContractRef`           |
| `WorkflowPrimitiveInputContractSet` | `FlowInputContractSet`      |
| `WorkflowPrimitive`                 | `FlowBlock`                 |
| `WorkflowPrimitiveCatalog`          | `FlowBlockCatalog`          |
| `PrimitiveCatalog`                  | `BlockCatalog`              |
| `primitiveAcceptedInputSets`        | `blockAcceptedInputSets`    |
| `primitive` variable names          | `block`                     |
| `uses` field in schematic item      | `block`                     |

### JSON schema migration

In the block catalog, change:

```json
{
  "schema_version": "1",
  "primitives": [...]
}
```

to:

```json
{
  "schema_version": "1",
  "blocks": [...]
}
```

Inside each block, consider changing:

```json
"gate": {
  "kind": "...",
  "description": "..."
}
```

to:

```json
"check": {
  "kind": "...",
  "description": "..."
}
```

Only do this if you update the schema and tests in the same phase.

### Schematic item migration

Change schematic items from:

```json
{
  "id": "plan",
  "uses": "plan",
  ...
}
```

to:

```json
{
  "id": "plan",
  "block": "plan",
  ...
}
```

Update the schema accordingly.

During migration you may temporarily parse both `uses` and `block`, but the final committed schematics should use only `block`.

### Checks

```bash
npm run check
npm run build
npm run test -- tests/contracts/flow-block-catalog.test.ts
npm run test -- tests/contracts/blocks.test.ts
npm run test -- tests/contracts/orphan-blocks.test.ts
npm run test -- tests/contracts/flow-schematic.test.ts
npm run test -- tests/contracts
npm run emit-workflows
npm run check-workflow-drift
npm run lint
```

### Stop condition

Run:

```bash
rg -n "\bprimitive|primitives|WorkflowPrimitive|PrimitiveCatalog|primitive-catalog|workflow-primitives\b" \
  src tests docs README.md AGENTS.md commands scripts specs \
  --glob '!dist' \
  --glob '!node_modules'
```

Allowed hits:

```text
src/schemas/primitives.ts
docs/terminology.md deprecated/internal terms section
historical reference specs, if intentionally preserved
```

Everything else should be migrated.

---

## Phase 6 — Normalize product result language

### Goal

Reduce ambiguity around result, outcome, status, verdict, artifact, report, and evidence.

Use this taxonomy:

| Concept                            | Use                           |
| ---------------------------------- | ----------------------------- |
| How the whole run ended            | `outcome`                     |
| Whether a check or command passed  | `status`                      |
| A reviewer/worker judgment         | `decision` or `review result` |
| Human-readable closeout            | `report`                      |
| Supporting files/facts/checks      | `evidence`                    |
| Typed runtime file                 | `artifact`, internal only     |
| Final machine-readable run summary | `RunResult`, internal/runtime |

### Product prose changes

Replace:

```text
typed verdict artifact
close artifact
artifact pointers
result artifact
canonical result artifact
```

with:

```text
review result
final report
evidence links
result file
run summary
```

When raw schema fields are still named `artifact_pointers` or `verdict`, explain them as implementation details:

```text
Read the final report and use its evidence links. Internally these may appear
as `artifact_pointers` in the JSON.
```

Do not force schema renames in this phase unless tests make it easy.

### Checks

```bash
npm run test -- tests/contracts/terminology-product-surface.test.ts
npm run check
npm run lint
```

---

## Phase 7 — Add friendly CLI aliases

### Goal

Let the product language show up in actual usage without breaking old commands.

Add aliases, do not remove existing flags yet.

| Existing       | Add alias      |
| -------------- | -------------- |
| `--run-root`   | `--run-folder` |
| `--rigor`      | `--depth`      |
| `--entry-mode` | `--mode`       |

Behavior:

```text
--run-folder should populate the same internal value as --run-root.
--depth should populate the same internal value as --rigor.
--mode should populate the same internal value as --entry-mode.
```

If both old and new aliases are supplied, fail clearly:

```text
Use either --depth or --rigor, not both.
```

Update command docs to teach the friendly alias first while mentioning the old flag as a compatibility alias.

Example:

```bash
./bin/circuit-next build --goal 'make the focused change' --mode deep --depth standard
```

### Tests

Add or update CLI parser tests in:

```text
tests/runner/cli-router.test.ts
```

Cover:

```text
--run-folder accepted
--run-root still accepted
--depth accepted
--rigor still accepted
--mode accepted
--entry-mode still accepted
conflicting alias pairs fail clearly
```

### Checks

```bash
npm run test -- tests/runner/cli-router.test.ts
npm run check
npm run build
npm run lint
```

---

## Phase 8 — Product-facing `dispatch` → `relay`

### Goal

Use “relay” in product/agent-facing language without breaking serialized runtime contracts.

### Required changes

Product prose and comments should say:

```text
relay
worker relay
relayed step
relay result
specialist agent
agent connector
```

Instead of:

```text
dispatch
adapter-bound dispatch
subprocess adapter
dispatch result
```

### Be careful with runtime contracts

The repo likely has serialized step kinds, event names, schema fields, and tests containing `dispatch`.

Do **not** rename these casually:

```text
execution.kind: "dispatch"
dispatch.started
dispatch.result
DispatchRole
src/runtime/step-handlers/dispatch.ts
dispatch-hints.ts
```

If you choose to do a deep runtime rename, do it as a separate compatibility migration:

1. Introduce new serialized name `relay`.
2. Parse both `relay` and legacy `dispatch`.
3. Emit only `relay` for new schematics.
4. Keep legacy tests proving old fixtures still parse.
5. Only then rename files/types.

Suggested deep rename map, if pursued:

| Old                                     | New                                  |
| --------------------------------------- | ------------------------------------ |
| `DispatchRole`                          | `RelayRole` or `WorkerRole`          |
| `DispatchStep`                          | `RelayStep`                          |
| `dispatch-hints.ts`                     | `relay-hints.ts`                     |
| `WorkflowDispatchArtifact`              | `WorkflowRelayArtifact`              |
| `dispatchArtifacts`                     | `relayArtifacts`                     |
| `dispatchHint`                          | `relayHint`                          |
| `src/runtime/step-handlers/dispatch.ts` | `src/runtime/step-handlers/relay.ts` |
| `dispatch-selection.ts`                 | `relay-selection.ts`                 |
| `dispatch-materializer.ts`              | `relay-materializer.ts`              |

Do not attempt this in the same commit as `recipe → schematic` or `primitive → block`.

### Checks

Run targeted tests around dispatch/relay behavior:

```bash
npm run test -- tests/contracts/dispatch-transcript-schema.test.ts
npm run test -- tests/contracts/review-dispatch-shape.test.ts
npm run test -- tests/runner/dispatch-invocation-failure.test.ts
npm run test -- tests/runner/runner-dispatch-adapter-identity.test.ts
npm run test -- tests/runner/runner-dispatch-provenance.test.ts
npm run test -- tests/runner/agent-dispatch-roundtrip.test.ts
npm run test -- tests/runner/codex-dispatch-roundtrip.test.ts
```

If those test files are renamed, keep the same behavioral coverage.

---

## Phase 9 — Product-facing `synthesis` → `compose`

### Goal

Use clearer language for Circuit-authored steps.

Product language should say:

```text
Circuit writes the brief.
Circuit composes the report.
Circuit summarizes the findings.
```

Avoid:

```text
orchestrator-synthesis
synthesis phase
synthesis writer
```

### Optional code rename

If pursuing code-level rename, do it separately:

| Old                                      | New                                    |
| ---------------------------------------- | -------------------------------------- |
| `synthesis` execution kind               | `compose`                              |
| `SynthesisBuilder`                       | `ComposeBuilder`                       |
| `synthesis-writers`                      | `compose-writers`                      |
| `findSynthesisBuilder`                   | `findComposeBuilder`                   |
| `src/runtime/step-handlers/synthesis.ts` | `src/runtime/step-handlers/compose.ts` |

Compatibility rule:

```text
Parse old `synthesis`; emit new `compose`.
```

Update tests accordingly.

### Checks

```bash
npm run test -- tests/runner/synthesis-builder-registry.test.ts
npm run test -- tests/runner/handler-throw-recovery.test.ts
npm run test -- tests/contracts/schema-parity.test.ts
npm run check
npm run build
npm run lint
```

Rename test files if doing the code-level rename.

---

## Phase 10 — Product-facing `gate` → `check`

### Goal

Make validation language plain.

Product/docs should say:

```text
check
required-fields check
review-result check
checkpoint-choice check
```

Avoid:

```text
gate
gate evaluation
result-verdict gate
schema-sections gate
```

### Optional code/schema rename

If migrating schema names:

| Old                               | New                    |
| --------------------------------- | ---------------------- |
| `src/schemas/gate.ts`             | `src/schemas/check.ts` |
| `Gate`                            | `Check`                |
| `WorkflowRecipeGate` / `StepGate` | `StepCheck`            |
| `gate-evaluation`                 | `check-evaluation`     |
| `gate` schematic field            | `check`                |

Compatibility rule:

```text
Parse old `gate`; emit/write new `check`.
```

This migration touches many tests. Keep it separate.

### Checks

```bash
npm run test -- tests/runner/gate-evaluation.test.ts
npm run test -- tests/contracts/schema-parity.test.ts
npm run test -- tests/contracts/flow-schematic.test.ts
npm run check
npm run build
npm run lint
```

Rename tests if migrating filenames.

---

## Phase 11 — Trace language

### Goal

Use `trace` as the product name for the run’s ordered record.

Product/docs:

```text
run trace
trace file
trace events
```

Instead of:

```text
canonical event log
event log
```

Optional internal rename:

| Old                                               | New                                               |
| ------------------------------------------------- | ------------------------------------------------- |
| `event-log-reader.ts`                             | `run-trace-reader.ts`                             |
| `readRunLog`                                      | `readRunTrace`                                    |
| `eventLogPath`                                    | `tracePath`                                       |
| `tests/unit/runtime/event-log-round-trip.test.ts` | `tests/unit/runtime/run-trace-round-trip.test.ts` |

Be careful with the actual file name:

```text
events.ndjson
```

Keep it if changing the filename would break compatibility. You can call it the “trace event file” in prose even if the physical filename remains `events.ndjson`.

### Checks

```bash
npm run test -- tests/unit/runtime/event-log-round-trip.test.ts
npm run test -- tests/runner/runtime-smoke.test.ts
npm run check
npm run build
npm run lint
```

---

# Final acceptance criteria

The migration is complete when all of the following are true.

## Product language

These files teach the new language:

```text
README.md
AGENTS.md
docs/terminology.md
docs/workflows/*.md
src/workflows/*/command.md
commands/run.md
commands/*.md
.claude-plugin/README.md
.claude-plugin/skills/**
```

They should use:

```text
flow
schematic
block
stage
step
route
relay
check
checkpoint
trace
report
evidence
run folder
depth/mode
```

They should avoid:

```text
recipe
primitive
dispatch
synthesis
orchestrator-synthesis
artifact pointer
canonical event log
run root
rigor
lane
spine
fixture
ADR
Slice
P2
placeholder-parity
dogfood
```

except in `docs/terminology.md` where deprecated/internal terms are explicitly explained.

## Structural migration

These should no longer exist, unless kept as explicit temporary compatibility shims:

```text
src/workflows/*/recipe.json
src/schemas/workflow-recipe.ts
src/runtime/compile-recipe-to-workflow.ts
docs/workflows/recipe-composition.md
docs/workflows/primitive-catalog.json
docs/workflows/primitives.md
src/schemas/workflow-primitives.ts
```

Expected new files:

```text
src/workflows/*/schematic.json
src/schemas/flow-schematic.ts
src/runtime/compile-schematic-to-workflow.ts
docs/workflows/flow-schematics.md
docs/workflows/block-catalog.json
docs/workflows/blocks.md
src/schemas/flow-blocks.ts
docs/terminology.md
tests/contracts/terminology-product-surface.test.ts
```

## Search checks

Run:

```bash
rg -n "\b(recipe|recipes|WorkflowRecipe|compileRecipe|recipePath|recipe\.json|workflow-recipe)\b" \
  src tests docs README.md AGENTS.md commands scripts specs \
  --glob '!dist' \
  --glob '!node_modules'
```

Run:

```bash
rg -n "\bprimitive|primitives|WorkflowPrimitive|PrimitiveCatalog|primitive-catalog|workflow-primitives\b" \
  src tests docs README.md AGENTS.md commands scripts specs \
  --glob '!dist' \
  --glob '!node_modules'
```

Every remaining hit must be justified.

## Verification

Run the full local gate:

```bash
npm run check
npm run lint
npm run build
npm run test
npm run check-workflow-drift
```

Then run:

```bash
npm run verify
```

If `verify` is red because of a known pre-existing issue, document that clearly. Otherwise the final state must be green.

---

# Guidance on what not to rename yet

Do not rename these unless you deliberately choose a larger runtime compatibility migration:

```text
Workflow
RunResult
Artifact schemas
events.ndjson
dispatch serialized event kinds
synthesis serialized execution kinds
gate serialized schema fields
run_root JSON output field
```

The goal is thematic clarity, not churn for its own sake.

A clean layered model is acceptable:

```text
Product language:  flow, schematic, block, relay, check, trace
Runtime language:  Workflow, artifact, adapter, event, gate, dispatch
```

The important thing is that runtime language should not leak into product-facing and agent-facing surfaces unless it is being explained as an internal implementation detail.

---

# Final handoff summary the agent should produce

At the end, write a summary with:

```text
1. Files renamed.
2. Major identifier changes.
3. Product surfaces updated.
4. Compatibility shims added or removed.
5. Tests added.
6. Commands run and results.
7. Remaining old terminology hits and why they are allowed.
8. Any intentionally deferred migrations, especially dispatch/relay, synthesis/compose, gate/check, event-log/trace.
```

The migration should leave the repo feeling like this:

> Circuit runs flows.
> Flows are defined by schematics.
> Schematics wire blocks into stages and steps.
> Runs follow routes, relay specialist work, record a trace, and close with a report and evidence.
