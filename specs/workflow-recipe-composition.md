---
name: workflow-recipe-composition
description: Plain-English composition model for building workflow recipes from primitives.
type: product-architecture
date: 2026-04-25
status: active
---

# Workflow Recipe Composition

This note describes how Circuit should compose reusable workflow primitives into
recipes. It does not define runtime behavior yet.

The companion machine-readable primitive list lives at
`specs/workflow-primitive-catalog.json`, with the schema in
`src/schemas/workflow-primitives.ts`.

The active Fix recipe lives at `specs/workflow-recipes/fix.recipe.json`, with
the recipe schema in `src/schemas/workflow-recipe.ts` and the recipe → Workflow
compiler at `src/runtime/compile-recipe-to-workflow.ts`. Compiled fixtures are
emitted to `.claude-plugin/skills/fix/circuit.json` and (because Fix uses
`route_overrides`) `.claude-plugin/skills/fix/lite.json`. The product direction
note at `specs/workflow-direction.md` reframes old Repair evidence into the
clearer Fix recipe.

## The Short Version

A recipe is an ordered, named use of primitives.

It should say:

- which primitive runs;
- what typed input it needs;
- what typed output it produces;
- which named outcomes are allowed;
- what model, effort, skills, and tools are preferred for that use;
- what evidence must exist before the recipe can move on.

This is deliberately not a freeform graph builder. Users should not need to draw
arbitrary boxes and edges to get useful workflows. They should mostly choose or
edit recipes made from known moves.

## Composition Layers

Circuit should keep four layers separate.

| Layer | Plain meaning | Example |
|---|---|---|
| Primitive | The reusable move. | Diagnose, Act, Review. |
| Recipe item | One use of a primitive in a workflow. | "Diagnose the bug using the repro notes." |
| Evidence contract | The typed fact passed to the next item. | `diagnosis.result@v1`. |
| Route policy | The named outcomes allowed from that item. | continue, retry, ask, stop. |

The primitive is the reusable part. The recipe item is the workflow-specific
use of it.

## Primitive Interface

Every primitive should have this shape:

```json
{
  "id": "diagnose",
  "input_contracts": ["workflow.brief@v1", "context.packet@v1"],
  "alternative_input_contracts": [],
  "output_contract": "diagnosis.result@v1",
  "allowed_routes": ["continue", "retry", "ask", "stop"]
}
```

The important point is that later steps consume named facts, not whatever text
happened to come back from a model.

Some primitives can accept more than one input shape. For example, Act can use
a brief plus a plan, a brief plus a diagnosis, or all three. The catalog should
model that with `alternative_input_contracts`, and recipe validation should
accept a recipe item only when its declared inputs satisfy at least one of the
primitive's input sets.

## Recipe Item Interface

A recipe item should bind a primitive to a specific workflow purpose.

Sketch:

```json
{
  "id": "fix-diagnose",
  "uses": "diagnose",
  "phase": "analyze",
  "input": {
    "brief": "fix.brief@v1",
    "context": "context.packet@v1"
  },
  "output": "fix.diagnosis@v1",
  "evidence_requirements": [
    "cause hypothesis",
    "confidence",
    "reproduction status",
    "diagnostic path"
  ],
  "execution": {
    "kind": "dispatch",
    "role": "researcher"
  },
  "selection": {
    "provider": "claude",
    "effort": "medium"
  },
  "routes": {
    "continue": "fix-act",
    "retry": "fix-gather-more-context",
    "ask": "fix-no-repro-decision",
    "stop": "@stop"
  },
  "route_overrides": {
    "continue": {
      "lite": "fix-close-lite"
    }
  }
}
```

This is still only a design sketch. It is here so the deep research can stress
the shape before we build it.

`evidence_requirements` names the proof a recipe item promises to produce.
Recipe validation checks those requirements against the primitive catalog so a
workflow cannot quietly use Diagnose, Verify, Review, or Close while omitting
the evidence that move is supposed to leave behind.

`execution` names how the recipe item would run when recipes become executable.
It is still design-time only. For now it keeps the future compiler honest:
worker moves bind to dispatch roles, Human Decision binds to checkpoint,
Run Verification binds to verification, and simple orchestrator moves bind to
synthesis.

`phase` names where the item fits in the existing workflow shape. It gives a
future compiler enough information to group recipe items into Frame, Analyze,
Plan, Act, Verify, Review, and Close phases without guessing from item ids.

`route_overrides` lets a recipe choose a different target for a named outcome
under a specific rigor. The default route still exists, so the recipe remains
readable; the override only says that one mode takes a different path. The
recipe → Workflow compiler honors `route_overrides` by emitting one Workflow
per entry mode (with reachability + dead-step elimination per mode); the
emit script groups modes by graph identity so modes that share a graph share
a single `circuit.json` file.

## Compatibility

Recipe assembly should fail early when an item cannot consume what came before
it.

Basic rule:

> A recipe item can run only when its required input contracts are available.

Availability is route-aware. A later recipe item does not make its output
magically available to an earlier branch just because it appears earlier in the
JSON file. If one branch can reach Close without passing through Review, Close
cannot require a Review artifact unless the recipe has a separate close path
for the skipped-review case.

Examples:

- Act can consume a plan or diagnosis.
- Run Verification can consume a verification plan and change evidence.
- Review can consume the brief, change evidence, and verification result.
- Close With Evidence can consume the final evidence bundle.
- Act should not consume only an idea list.

Mode-specific routes are part of compatibility. If Lite skips Review, it
should route to a separate close item whose inputs do not require a Review
artifact. That keeps the reviewed and unreviewed close paths honest instead of
pretending one close item has evidence that only some routes produce.

This lets custom workflows be flexible without letting impossible combinations
parse.

## Named Outcomes Instead Of Arbitrary Branches

Branches should usually be named outcomes, not arbitrary edges.

Good outcomes:

- continue
- retry
- revise
- ask
- split
- stop
- handoff
- escalate
- complete

These outcomes are broad enough for real workflows but small enough to reason
about. A recipe can map them to the next item, but the primitive controls which
outcomes are valid.

## Where Branches Help

Branches are useful when they represent a real product choice:

- the bug reproduced or did not reproduce;
- verification passed or failed;
- review accepted or requested fixes;
- the operator chose continue, stop, or handoff;
- the queue has more work or is empty;
- the risk check says split the work before continuing.

Branches are less useful when they are just a clever way to encode arbitrary
control flow. If a workflow needs many tiny branches, that may mean we are
missing a better primitive.

## Human Decisions

Human Decision is a primitive, not a special case in one host.

The recipe should declare the question, options, default policy, and unattended
behavior. The adapter should map that structured request to the host:

- Claude can use its user-question surface when available.
- Codex can use its host question surface when available.
- Non-interactive runs can use the declared default, pause, or fail clearly.

The output is just another typed evidence object. Later recipe items should not
care which host collected it.

## Model And Effort Settings

Model and effort settings should attach to recipe items, with defaults inherited
from workflow and user config.

That means the primitive says what kind of move it is, while the recipe says how
hard to run it for this workflow.

Example:

- a Lite Fix recipe might skip independent review after strong verification;
- a Deep Fix recipe might run a separate Review item with higher effort;
- both recipes still use the same Act, Run Verification, and Close primitives.

## Evidence Shape

Each item should produce two useful surfaces:

1. A typed artifact for the next item.
2. A short human summary for the final report.

The typed artifact keeps the workflow reliable. The summary keeps the operator
from having to read raw step logs.

## What This Means For Fix

The old Repair workflow should be treated as reference evidence. The active
Fix recipe takes intake and route as initial contracts (the runner produces
them before the workflow starts) and follows this shape:

1. Frame — confirm Fix brief
2. Gather Context (dispatched to a researcher)
3. Diagnose (dispatched to a researcher)
4. Human Decision — when reproduction is uncertain (authoring intent today;
   unreachable at compile until the runtime grows the corresponding outcome)
5. Act (dispatched to an implementer)
6. Run Verification
7. Review — dispatched to a reviewer when mode requires it; lite mode skips it
8. Close With Evidence, with a separate Lite close path when Review is skipped
9. Handoff — when work is paused (also authoring intent; unreachable at compile)

If that shape feels too rigid after the deep research lands, the research should
tell us exactly which primitive or route policy needs to change.

Do not add more one-off Repair behavior from the old signed plan. Repair-only
artifacts, `/circuit:repair`, and Repair-only runtime code stay out of scope
unless a later operator decision explicitly reopens Repair as a first-class
product recipe.

## V1 Custom Workflow Boundary

Custom workflows should compose built-in primitives first.

Users should not be able to define arbitrary new move code in v1. That keeps the
first custom-workflow surface understandable and lets the built-in catalog
stabilize before Circuit grows an extension system for new move definitions.

## Schema Layers

Two layers, both load-bearing:

**Primitive contracts** are nominal. They live in
`specs/workflow-primitive-catalog.json` as named identifiers
(`workflow.brief@v1`, `verification.result@v1`, `change.evidence@v1`,
etc.). Primitives declare them as inputs and outputs. They express the
abstract claim "this primitive needs a brief" without binding to a
specific shape.

**Per-workflow schemas** are structural. They live in
`src/schemas/artifacts/<workflow>.ts` as concrete Zod types with
workflow-specific fields. `BuildBrief.objective` is not the same field
as `FixBrief.problem_statement`, even though both satisfy the
`workflow.brief@v1` primitive contract.

**Contract aliases bridge the two.** Each recipe declares an
`contract_aliases` array, e.g.
`{ generic: 'workflow.brief@v1', actual: 'fix.brief@v1' }`. The recipe
compiler uses aliases to validate that a recipe item satisfies its
primitive's input contract via the workflow-specific schema the recipe
chose. The runtime uses the workflow-specific schema for actual parsing
and field access.

Why both layers exist together:

- Primitives compose without binding to specific schemas (a `frame`
  primitive can be used by any workflow that has a brief).
- Per-workflow schemas give type safety on workflow-specific fields
  (Fix's `regression_contract`, Explore's `verdict_snapshot`).
- Aliases let recipe authors declare exactly what shape they expect.

Adding a new workflow:

1. Define per-workflow schemas in `src/schemas/artifacts/<wf>.ts`.
2. Declare aliases in the recipe's `contract_aliases`.
3. Wire recipe items to the schemas via `output` and `input` fields.

The runtime trusts the recipe's alias declarations — there is no
runtime registry of "which generic ↔ which actual" beyond what each
recipe says.

## Open Design Questions

Keep these open until the research is reviewed:

1. Should recipes be authored directly as JSON, YAML, or a friendlier format
   that compiles to JSON?
2. Should recipe items use primitive ids directly, or user-facing aliases?
3. How do we show users the recipe clearly without exposing every raw prompt and
   step artifact?
