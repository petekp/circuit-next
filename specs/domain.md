# Domain Glossary - circuit-next Ubiquitous Language

**Status:** Active terminology policy companion.

Use this glossary with `docs/terminology.md`. Product-facing prose should use
the product terms first. Runtime and schema terms are allowed when they name
actual implementation surfaces.

---

## Core types

### Product language

| Term | Definition | Aliases to avoid |
|---|---|---|
| **Flow** | A named kind of work Circuit can run, such as Build, Fix, Explore, Review, Migrate, or Sweep. | CompiledFlow, pipeline |
| **Schematic** | The authored definition of a flow. | Previous authored-definition term |
| **Block** | A reusable kind of work that can appear in a schematic. | Previous low-level work-unit term |
| **Stage** | A grouped part of a flow, such as Frame, Analyze, Act, Verify, Review, or Close. | Stage, stage path position |
| **Step** | One executable use of a block inside a schematic or compiled flow. | Task, job |
| **Route** | A named outcome path from one step to the next. | Edge, branch, transition |
| **Run** | One execution of a flow. | Session, invocation |
| **Checkpoint** | A pause where Circuit needs operator input or a declared safe default. | Prompt, approval check |
| **Check** | Validation that decides whether a step may continue. | Check |
| **Trace** | The ordered record of what happened during a run. | TraceEntry log |
| **Report** | A typed human-readable output from a step or close stage. | Report, output blob |
| **Evidence** | Supporting facts, files, checks, and reports produced or consumed by a run. | Report pointer |
| **Run folder** | The directory where a run stores its trace, reports, and evidence. | Previous run-directory term |
| **Depth** | The requested thoroughness for a run or step. | Depth |
| **Mode** | A named flow variant, such as `lite`, `standard`, or `deep`. | ChangeKind |

### Implementation-layer names

These names may appear in schemas, contracts, tests, and runtime code when
they name concrete implementation surfaces. They should not be the first
language in product prose.

| Term | Definition | Product-facing term |
|---|---|---|
| **CompiledFlow** | The compiled runtime object loaded by the engine. | Compiled flow |
| **Stage** | The runtime grouping field used by compiled flows. | Stage |
| **ComposeStep** | A runtime step where the orchestrator writes a report. | Compose step |
| **RelayStep** | A runtime step where work is relayed to a worker. | Relay step |
| **VerificationStep** | A runtime step where the orchestrator runs verification commands. | Verification step |
| **CheckpointStep** | A runtime step where Circuit pauses for a checkpoint decision. | Checkpoint step |
| **Check** | The runtime schema object that records a check condition. | Check |
| **Report** | A typed runtime file tracked by schema and path. | Report or evidence file |
| **TraceEntry** | One append-only trace record. | Trace entry |
| **Snapshot** | A derived runtime projection from trace entries and the compiled flow. | Run state |

---

## Relay vocabulary

| Term | Definition | Aliases to avoid |
|---|---|---|
| **Relay** | A handoff from Circuit to another worker or host. | Relay, job |
| **Connector** | A backend or host that can run relayed work. | Connector |
| **Role** | The worker responsibility for a relay, such as researcher, implementer, or reviewer. | Executor |
| **Relay resolution** | The procedure that chooses the connector for a relay step. | Relay resolution |
| **Relay transcript** | The request, receipt, result, and completion trace entries for relayed work. | Relay transcript |

Implementation note: the runtime still serializes many relay concepts with
`relay.*` trace_entry names and `Relay*` schema names. Those names describe
compatibility surfaces, not product language.

---

## Configuration vocabulary

| Term | Definition | Aliases to avoid |
|---|---|---|
| **Config layer** | One source of configuration, such as defaults, user-global config, project config, or invocation overrides. | Settings source |
| **Selection layer** | One contributor to model, effort, skill, depth, and invocation-option selection. | Config layer, when flow or step defaults are included |
| **Selection override** | A partial selection record contributed by one layer. | Override blob |
| **Resolved selection** | The effective model, effort, skills, depth, and invocation options used at relay time. | Final config |
| **Selection resolution** | The resolved selection plus provenance for which layers contributed it. | Audit record |
| **Provider-scoped model** | A model named with its provider. | Model string |
| **Effort** | Provider-level reasoning effort, currently using OpenAI's effort vocabulary. | Depth |

Relationship: **Depth** is product language for run thoroughness.
**Effort** is provider language for model reasoning allocation. A deep flow can
still use medium effort on a specific step if the schematic or config says so.

---

## Continuity vocabulary

| Term | Definition | Aliases to avoid |
|---|---|---|
| **Continuity record** | A cross-session handoff record for resuming work. | Handoff note |
| **Continuity index** | The resolver file that chooses the active continuity record and attached run. | Resume index |
| **Resume contract** | The declared posture for how the next session should resume. | Resume mode |
| **Run-attached provenance** | The saved run state embedded in a run-backed continuity record. | Run pointer |
| **Pending-record pointer** | The index entry naming the continuity record to read next. | Pending handoff |
| **Attached-run pointer** | The index entry naming the currently live run. | Active run |
| **Dangling reference** | A pointer to a missing continuity record. | Missing handoff |

Relationship: A **Continuity index** may name both a **Pending-record pointer**
and an **Attached-run pointer**. The record is the narrative handoff; the run
pointer is the live execution anchor.

---

## Skill + plugin vocabulary

| Term | Definition | Aliases to avoid |
|---|---|---|
| **Skill** | A discoverable capability with trigger metadata and optional supporting files. | Tool, command |
| **Plugin** | The Claude Code plugin surface Circuit installs into. | Package |
| **Catalog compiler** | The build-time tool that regenerates command and skill outputs from source-of-truth files. | Generator, sync script |

Relationship: A **Plugin** can include slash commands, skills, hooks, MCP
servers, and generated compiled-flow outputs. A **Skill** is one capability
inside that plugin surface.

---

## Relationships

- A **Flow** has exactly one active **Schematic** per authored version.
- A **Schematic** wires one or more **Blocks** into ordered **Steps**.
- A **Step** belongs to one **Stage**.
- A **Step** may produce one **Report** and any amount of supporting
  **Evidence**.
- A **Run** follows **Routes** through a compiled flow.
- A **Run** records a **Trace** in its **Run folder**.
- A **Relay** uses one **Connector** and one **Role**.
- A **Checkpoint** is a step-level pause, not a separate flow.

---

## Example dialogue

> **Dev:** "For Fix, should I add another flow?"
>
> **Domain expert:** "No. Add or adjust a **Block** only if the reusable kind
> of work is missing. Otherwise update the Fix **Schematic**."
>
> **Dev:** "The worker needs to gather context before diagnosing. Is that a
> relay?"
>
> **Domain expert:** "Yes. The schematic has a **Step** in the Analyze
> **Stage** that uses the Gather Context **Block** and relays work through a
> researcher **Role**."
>
> **Dev:** "Where does the result go?"
>
> **Domain expert:** "Into a typed **Report** in the **Run folder**, with
> supporting **Evidence** linked from the final close report."

---

## Flagged ambiguities

- "CompiledFlow" can mean a product flow or the compiled runtime object. Use
  **Flow** for the product and **CompiledFlow** only for the runtime schema.
- "Report" can mean any file, a typed runtime surface, or operator-facing
  proof. Use **Report** for typed outputs and **Evidence** for supporting
  proof.
- "Relay" can mean a runtime trace_entry kind or the product act of handing work
  to another worker. Use **Relay** in product prose and keep `relay.*` only
  for serialized runtime names.
- "Depth" and "depth" both describe thoroughness. Use **Depth** in prose;
  keep `depth` only where the current schema or CLI flag requires it.
- "Stage" and "stage" both describe grouped flow sections. Use **Stage** in
  product prose; keep **Stage** for the current runtime field.

---

## Anti-patterns

- **Prose/YAML drift** - when generated or human-authored prose disagrees with
  the schematic or compiled flow it describes.
- **Hidden runtime** - when product prose quietly carries execution policy that
  is not represented in schemas, schematics, or runtime code.
- **Synonym creep** - when new terms are introduced without adding a glossary
  entry or explicitly mapping them to existing terms.
- **Product/internal collapse** - when product prose teaches runtime names
  before the operator-facing concept.
