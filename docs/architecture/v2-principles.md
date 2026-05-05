# Circuit v2 Principles

## 1. v2 Mission

Circuit v2 is an in-place reconstruction. The goal is to preserve product
behavior while making the runtime smaller, clearer, and easier to reason about.
The current implementation is the behavior oracle, not the target shape.

Success means a future agent can answer these questions quickly:

- What is the flow that will run?
- What manifest did the runtime execute?
- What happened in the run?
- Which trace entry proves it?
- Which file did a step read or write?
- Which connector was allowed to act?

## 2. What v2 Must Preserve

v2 must preserve the product protections that prevent real failures:

- Catalog-driven flow installation.
- Executable manifests validated before runtime execution.
- Closed graph validation for steps, routes, stages, and terminal targets.
- One trace sequence authority.
- Run bootstrap and close rules.
- Checkpoint pause and resume safety.
- Connector capability checks and subprocess boundaries.
- Selection and config precedence with provenance.
- Report schema validation owned by flow packages.
- Path-safe run-relative writes.
- Fanout, sub-run, and aggregate report behavior.
- Generated surfaces as outputs, not source.

## 3. What v2 Should Simplify

v2 should reduce cross-file reasoning where the current implementation carries
history or duplicated proof work:

- Split the broad runner into graph, trace, projection, connector, and fanout
  modules.
- Move flow-specific checkpoint and report policy back into flow packages.
- Keep route aliases centralized and visible.
- Prefer discriminated authoring steps over flat optional bags.
- Keep stage safety, but make the policy explicit and smaller.
- Replace methodology labels with product concepts where no runtime consumer
  remains.
- Treat generated-surface ownership as a source map, not tribal knowledge.

## 4. Load-Bearing Rigor Definition

Load-bearing rigor is a rule with a plausible product failure, a real consumer,
a clear enforcement point, and useful test or contract coverage.

Examples include route closure, trace sequence ordering, connector capability
checks, path traversal rejection, checkpoint resume matching, and generated
surface drift checks.

## 5. Rigor Theater Definition

Rigor theater is strictness that mostly preserves construction history, old
method names, duplicate assertions, or labels with no active runtime consumer.

These rules may still be useful as notes, but they should not make the runtime
harder to read unless they prevent a real product failure.

## 6. Source-of-Truth Hierarchy

The v2 source-of-truth order should be:

1. Flow package authoring source under `src/flows/<id>/`.
2. Compiler or adapter output as an executable manifest.
3. Validated executable manifest used by runtime.
4. Append-only trace and run files for run truth.
5. Projections derived from trace and run files.
6. Generated command, plugin, and flow surfaces.

Generated files must stay downstream from source files and generators.

## 7. v2 Module Boundaries

The v2 core should live beside the current runtime:

- `domain/`: plain TypeScript types only.
- `manifest/`: executable manifest shape, validation, and v1 adapter.
- `trace/`: trace store and sequence assignment.
- `run-files/`: path-safe JSON reads and writes.
- `run/`: graph runner, run context, result writing, resume.
- `executors/`: compose, verification, checkpoint, relay, sub-run, fanout.
- `projections/`: progress, status, evidence, task state, user input.
- `connectors/`: connector resolution and subprocess execution.
- `fanout/`: branch expansion, execution, worktree handling, join, aggregate,
  cleanup.

The domain layer should not import runtime handlers, flow packages, filesystem
modules, or CLI code.

## 8. Migration Strategy

Build v2 beside v1. First prove a small runtime slice. Then adapt current
compiled flows into the v2 executable manifest. Use parity tests against the
current runtime before changing authoring schemas or generated outputs.

Only after parity is proven should the old runtime be deleted or retired.

## 9. Effect Evaluation Policy

Effect is allowed only as a focused runtime spike. It is not approved for global
adoption, flow authoring, generated manifests, command docs, or broad schema
replacement.

The spike should compare plain TypeScript against Effect for cleanup safety,
fanout cancellation, typed services, runtime errors, connector resources, and
testability. If Effect makes simple control flow harder to explain, v2 should
stay plain TypeScript.

## 10. Deletion as Success Criterion

The reconstruction is not complete while both runtimes remain fully alive.

The final proof is deletion or clear retirement of old runtime paths after v2
passes product-relevant parity and connector safety checks.
