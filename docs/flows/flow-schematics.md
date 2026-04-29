---
name: flow-schematic-composition
description: Plain-English composition model for building flow schematics from blocks.
type: product-architecture
date: 2026-04-28
status: active
---

# Flow Schematic Composition

This note describes how Circuit should compose reusable flow blocks into
schematics. It does not define runtime behavior yet.

The companion machine-readable block list lives at
`docs/flows/block-catalog.json`, with the schema in
`src/schemas/flow-blocks.ts`.

The active Fix schematic lives at `src/flows/fix/schematic.json`, with
the schematic schema in `src/schemas/flow-schematic.ts` and the schematic →
compiled-flow compiler at `src/runtime/compile-schematic-to-flow.ts`.
Compiled flows are emitted to `generated/flows/fix/circuit.json` and
(because Fix uses `route_overrides`) `generated/flows/fix/lite.json`.
The product direction note at `docs/flows/direction.md` reframes older bug-fix
evidence into the clearer Fix schematic.

## The Short Version

A schematic is an ordered, named use of blocks.

It should say:

- which block runs;
- what typed input it needs;
- what typed output it produces;
- which named outcomes are allowed;
- what model, effort, skills, and tools are preferred for that use;
- what evidence must exist before the schematic can move on.

This is deliberately not a freeform graph builder. Users should not need to
draw arbitrary boxes and edges to get useful flows. They should mostly
choose or edit schematics made from known blocks.

## Composition Layers

Circuit should keep four layers separate.

| Layer | Plain meaning | Example |
|---|---|---|
| Block | The reusable building piece. | Diagnose, Act, Review. |
| Schematic step | One use of a block in a flow. | "Diagnose the bug using the repro notes." |
| Evidence contract | The typed fact passed to the next step. | `diagnosis.result@v1`. |
| Route policy | The named outcomes allowed from that step. | continue, retry, ask, stop. |

The block is the reusable part. The schematic step is the flow-specific use
of it.

## Block Interface

Every block should have this shape:

```json
{
  "id": "diagnose",
  "input_contracts": ["flow.brief@v1", "context.packet@v1"],
  "alternative_input_contracts": [],
  "output_contract": "diagnosis.result@v1",
  "allowed_routes": ["continue", "retry", "ask", "stop"]
}
```

The important point is that later steps consume named facts, not whatever
text happened to come back from a model.

Some blocks can accept more than one input shape. For example, Act can use
a brief plus a plan, a brief plus a diagnosis, or all three. The catalog
should model that with `alternative_input_contracts`, and schematic
validation should accept a step only when its declared inputs satisfy at
least one of the block's input sets.

## Schematic Step Interface

A schematic step should bind a block to a specific flow purpose.

Sketch:

```json
{
  "id": "fix-diagnose",
  "uses": "diagnose",
  "stage": "analyze",
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
    "kind": "relay",
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

This is still only a design sketch. It is here so the deep research can
stress the shape before we build it.

`evidence_requirements` names the proof a schematic step promises to
produce. Schematic validation checks those requirements against the block
catalog so a flow cannot quietly use Diagnose, Verify, Review, or Close
while omitting the evidence that block is supposed to leave behind.

`execution` names how the schematic step would run when schematics become
executable. It is still design-time only. For now it keeps the future
compiler honest: worker blocks bind to relay roles, Human Decision binds
to checkpoint, Run Verification binds to verification, and simple
orchestrator blocks bind to compose steps.

`stage` names where the step fits in the existing flow shape. It gives a
future compiler enough information to group schematic steps into Frame,
Analyze, Plan, Act, Verify, Review, and Close stages without guessing
from step ids.

`route_overrides` lets a schematic choose a different target for a named
outcome under a specific depth. The default route still exists, so the
schematic remains readable; the override only says that one mode takes a
different path. The schematic → compiled-flow compiler honors
`route_overrides` by emitting one compiled flow per entry mode (with
reachability + dead-step elimination per mode); the emit script groups
modes by graph identity so modes that share a graph share a single
`circuit.json` file.

## Compatibility

Schematic assembly should fail early when a step cannot consume what came
before it.

Basic rule:

> A schematic step can run only when its required input contracts are
> available.

Availability is route-aware. A later schematic step does not make its
output magically available to an earlier branch just because it appears
earlier in the JSON file. If one branch can reach Close without passing
through Review, Close cannot require a Review report unless the schematic
has a separate close path for the skipped-review case.

Examples:

- Act can consume a plan or diagnosis.
- Run Verification can consume a verification plan and change evidence.
- Review can consume the brief, change evidence, and verification result.
- Close With Evidence can consume the final evidence bundle.
- Act should not consume only an idea list.

Mode-specific routes are part of compatibility. If Lite skips Review, it
should route to a separate close step whose inputs do not require a Review
report. That keeps the reviewed and unreviewed close paths honest instead
of pretending one close step has evidence that only some routes produce.

This lets custom flows be flexible without letting impossible combinations
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

These outcomes are broad enough for real flows but small enough to reason
about. A schematic can map them to the next step, but the block controls
which outcomes are valid.

## Where Branches Help

Branches are useful when they represent a real product choice:

- the bug reproduced or did not reproduce;
- verification passed or failed;
- review accepted or requested fixes;
- the operator chose continue, stop, or handoff;
- the queue has more work or is empty;
- the risk check says split the work before continuing.

Branches are less useful when they are just a clever way to encode arbitrary
control flow. If a flow needs many tiny branches, that may mean we are
missing a better block.

## Human Decisions

Human Decision is a block, not a special case in one host.

The schematic should declare the question, options, default policy, and
unattended behavior. The connector should map that structured request to
the host:

- Claude can use its user-question surface when available.
- Codex can use its host question surface when available.
- Non-interactive runs can use the declared default, pause, or fail
  clearly.

The output is just another typed evidence object. Later schematic steps
should not care which host collected it.

## Model And Effort Settings

Model and effort settings should attach to schematic steps, with defaults
inherited from flow and user config.

That means the block says what kind of work it is, while the schematic
says how hard to run it for this flow.

Example:

- a Lite Fix schematic might skip independent review after strong
  verification;
- a Deep Fix schematic might run a separate Review step with higher
  effort;
- both schematics still use the same Act, Run Verification, and Close
  blocks.

## Evidence Shape

Each step should produce two useful surfaces:

1. A typed report for the next step.
2. A short human summary for the final report.

The typed report keeps the flow reliable. The summary keeps the operator
from having to read raw step logs.

## What This Means For Fix

The older bug-fix flow should be treated as reference evidence. The active Fix
schematic takes intake and route as initial contracts (the runner produces them
before the flow starts) and follows this shape:

1. Frame — confirm Fix brief
2. Gather Context (relayed to a researcher)
3. Diagnose (relayed to a researcher)
4. Human Decision — when reproduction is uncertain (authoring intent today;
   unreachable at compile until the runtime grows the corresponding
   outcome)
5. Act (relayed to an implementer)
6. Run Verification
7. Review — relayed to a reviewer when mode requires it; lite mode skips it
8. Close With Evidence, with a separate Lite close path when Review is
   skipped
9. Handoff — when work is paused (also authoring intent; unreachable at
   compile)

If that shape feels too rigid after the deep research lands, the research
should tell us exactly which block or route policy needs to change.

Do not add more one-off behavior from the old signed plan for a second bug-fix
flow name. Separate reports, commands, or runtime code for that name stay out
of scope unless a later operator decision explicitly reopens the public naming
model.

## V1 Custom Flow Boundary

Custom flows should compose built-in blocks first.

Users should not be able to define arbitrary new block code in v1. That
keeps the first custom-flow surface understandable and lets the built-in
catalog stabilize before Circuit grows an extension system for new block
definitions.

## Schema Layers

Two layers, both load-bearing:

**Block contracts** are nominal. They live in
`docs/flows/block-catalog.json` as named identifiers
(`flow.brief@v1`, `verification.result@v1`, `change.evidence@v1`,
etc.). Blocks declare them as inputs and outputs. They express the
abstract claim "this block needs a brief" without binding to a specific
shape.

**Per-flow schemas** are structural. They live in
`src/flows/<flow>/reports.ts` as concrete Zod types with
flow-specific fields. `BuildBrief.objective` is not the same field as
`FixBrief.problem_statement`, even though both satisfy the
`flow.brief@v1` block contract.

**Contract aliases bridge the two.** Each schematic declares a
`contract_aliases` array, e.g.
`{ generic: 'flow.brief@v1', actual: 'fix.brief@v1' }`. The schematic
compiler uses aliases to validate that a schematic step satisfies its
block's input contract via the flow-specific schema the schematic chose.
The runtime uses the flow-specific schema for actual parsing and field
access.

Why both layers exist together:

- Blocks compose without binding to specific schemas (a `frame` block can
  be used by any flow that has a brief).
- Per-flow schemas give type safety on flow-specific fields (Fix's
  `regression_contract`, Explore's `verdict_snapshot`).
- Aliases let schematic authors declare exactly what shape they expect.

Adding a new flow:

1. Define per-flow schemas in `src/flows/<wf>/reports.ts`.
2. Declare aliases in the schematic's `contract_aliases`.
3. Wire schematic steps to the schemas via `output` and `input` fields.

The runtime trusts the schematic's alias declarations — there is no
runtime registry of "which generic ↔ which actual" beyond what each
schematic says.

## Open Design Questions

Keep these open until the research is reviewed:

1. Should schematics be authored directly as JSON, YAML, or a friendlier
   format that compiles to JSON?
2. Should schematic steps use block ids directly, or user-facing aliases?
3. How do we show users the schematic clearly without exposing every raw
   prompt and step report?
