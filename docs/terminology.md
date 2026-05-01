# Circuit terminology

Circuit runs flows.

A flow is a named kind of developer work, such as Build, Fix, Explore, Review,
Migrate, or Sweep.

Each flow is defined by a schematic. The schematic wires reusable blocks into
stages and steps.

A run follows routes through the schematic, relays specialist work when needed,
records a trace, pauses at checkpoints, and closes with reports and evidence.

## Public and Operator Terms

These terms are valid in README prose, command help, operator docs, and
agent-facing instructions when they describe the product honestly.

- Flow: a named unit users run, such as Build or Fix.
- Schematic: the authored definition of a flow.
- Block: a reusable kind of work inside a schematic.
- Stage: a grouped part of a flow.
- Step: one executable unit.
- Route: the next path after a step.
- Relay: delegated specialist work inside a run.
- Connector: a backend or host used to execute relayed work.
- Check: validation that decides whether a step can continue.
- Checkpoint: a pause for operator input or choice.
- Trace: the ordered record of what happened during a run.
- Report: structured output written by a run.
- Evidence: supporting files, facts, checks, and outputs.
- Run folder: the directory where a run records trace, reports, evidence, and
  resume state.
- Depth: how thorough the run should be.
- Mode: an entry option for a flow, often paired with depth.

## Internal and Runtime Terms

These names are fine in code, schemas, contracts, tests, low-level docs, and
operator troubleshooting. They should be introduced plainly if they appear in
user-visible instructions.

- CompiledFlow: the runtime graph compiled from a schematic.
- Compiled manifest: a serialized CompiledFlow file under `generated/flows`.
- pass: the runtime success route key. Schematic success aliases compile to it.
- compose: a runtime step kind that writes orchestrator-owned reports.
- sub-run: a runtime step kind that executes a child flow.
- fanout: a runtime step kind that runs multiple branches and joins them.
- fixture: acceptable for tests and saved examples, not product positioning.
- runtime-proof: an internal flow used as a runtime proof/test surface.

## Deprecated or Methodology Terms

Avoid these in user-facing product prose and command help. They may still appear
inside historical specs, tests, migrations, or compatibility shims when the
context is explicit.

- change_kind
- runtime-proof as a visible user flow
- recipe
- scalar when describing flow composition
- primitive when describing flow concepts
- dispatch when describing flow routing
- synthesis when describing closeout output
- artifact when report or evidence is meant
- event log when trace is meant
- run root or `--run-root` when run folder is meant
- construction-methodology labels such as Slice ids, ADR ids, and P2 labels
- placeholder-parity
