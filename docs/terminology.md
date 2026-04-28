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

- CompiledFlow: compiled runtime object.
- Connector: low-level connector implementation.
- Report: typed runtime file.
- Check: schema/runtime check scalar, if not yet migrated.
- Relay: serialized runtime step kind, if not yet migrated.
- Compose: legacy/internal compose step kind, if not yet migrated.

## Avoid in product surfaces

Avoid these in README intros, slash command prose, generated command files,
flow command sources, and agent-facing instructions:

- recipe
- scalar, when referring to flow composition
- relay
- compose
- orchestrator-compose
- evidence link
- canonical trace
- run folder
- depth
- change_kind
- stage path
- fixture
- ADR ids
- Slice ids
- P2 labels
- placeholder-parity
- runtime-proof
