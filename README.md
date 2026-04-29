# circuit-next

**Automate your Claude Code flows with a single command.**

Circuit is an orchestration layer for structured, resumable, multi-stage
flows inside Claude Code. Enter `/circuit:run` and describe your task.
Circuit picks the most suitable flow from the core set and executes it,
checking each step's output against a contract before moving on to the next.

- **Configurable per step.** Pick the model, reasoning effort, and skills for
  each step in a flow.
- **Resumable.** If a session dies mid-run, you can pick up where it left off.
- **Adjustable autonomy.** Steer at checkpoints or run unattended.
- **Mode-driven depth.** Use the default mode, or pick Lite for a faster pass
  and Deep for a more thorough one.

## Get Started

Circuit is currently a pre-release alpha. Install it directly from a checkout:

```bash
git clone https://github.com/petekp/circuit-next.git
cd circuit-next
npm install
npm run build
```

Then run a flow through the local launcher:

```bash
./bin/circuit-next run --goal '<your task>'
```

The router classifies your task and runs the right flow. To use the
slash commands inside Claude Code, point your plugin loader at this checkout
and reload — the generated `commands/` directory is the user-facing surface.

Optional but recommended: drop a personal config at
`~/.config/circuit-next/config.yaml` to set defaults (model, reasoning effort,
skills, connector routing) across every project. A repo-local
`./.circuit/config.yaml` overrides those defaults per project. See
[User-Space Configuration](#user-space-configuration) for details.

## How It Works

Circuit replaces ad-hoc skill invocation and copy-pasted instructions. Use
`/circuit:run` to let the router pick a flow, or call a flow directly when
you already know what you want.

**Core Flows:**

These flows ship with the plugin. Build, Fix, Explore, and Review have direct
slash commands. Migrate and Sweep are reachable through the router.

| Flow | Purpose |
|----------|-------------|
| **Explore** | Investigate, understand, choose among options, shape a plan |
| **Build** | Features, refactors, docs, tests, mixed changes |
| **Fix** | Bugs, regressions, flaky behavior |
| **Review** | Audit-only review, no implementation |
| **Migrate** | Framework swaps, dependency replacements, architecture transitions |
| **Sweep** | Cleanup, quality passes, coverage improvements |

**Modes:**

Each flow accepts a mode at run time that scales how thorough the run is
and which review steps fire.

| Mode | Behavior |
|-------|--------|
| **Default** | Plan, act, verify, independent review where the flow includes one. |
| **Lite** | Skips the review relay where the flow allows it. Use for small, low-risk changes. |
| **Deep** | More thorough analysis and review. Pauses for input at architecture-class checkpoints. |
| **Tournament** | Competing proposals with adversarial evaluation. Available on Explore and Review. |
| **Autonomous** | Checkpoints auto-resolve to safe defaults. Useful for unattended runs. |

Pass a mode with `--entry-mode <lite|deep|autonomous>` (or `--mode`, the
shorter alias). Tournament is a depth-level option exposed through
`--depth tournament` on the flows that support it. Mode availability varies
by flow; see each flow's `src/flows/<id>/schematic.json` for the
authoritative list.

Every flow is built from a fixed set of stages: **Frame, Analyze, Plan, Act,
Verify, Review, Close**. Not every flow runs every stage, but the order
holds.

1. **The router classifies your task.** Circuit matches free-form text to a
   flow. The classifier is deliberately small and deterministic — it routes,
   then the flow itself takes over.

2. **Steps run in the right order.** Research before decisions. Decisions
   before implementation. Implementation gets an independent review from a
   separate worker. Every step writes a typed report and an entry in the run
   trace.

3. **Progress survives session crashes.** Each run gets its own folder with a
   trace, reports, and evidence. If a session dies, resume against that
   folder and Circuit picks up at the last completed step.

4. **Stay in the loop.** Flows pause at checkpoints when they need scope
   confirmation or a tradeoff decision. Everything else runs autonomously.
   Autonomous mode resolves checkpoints to their safe default and keeps
   going.

## Commands

**Using the router:**

| You type | What happens |
|----------|-------------|
| `/circuit:run <task>` | Router picks the best flow and mode |
| `/circuit:run fix: <bug>` | Routes to Fix |
| `/circuit:run review: <scope>` | Routes to Review |
| `/circuit:run develop: <feature>` | Routes to Build |
| `/circuit:run migrate: <target>` | Routes to Migrate |
| `/circuit:run cleanup: <target>` | Routes to Sweep |
| `/circuit:run overnight: <scope>` | Routes to Sweep autonomous mode |

**Direct flows:**

| You type | What happens |
|----------|-------------|
| `/circuit:explore` | Investigation, decisions, planning |
| `/circuit:build` | Features, refactors, docs, tests |
| `/circuit:fix` | Bug fixes with test-first verification |
| `/circuit:review` | Audit-only review of an existing change |

The slash commands wrap the underlying CLI. Each one accepts a `--goal`, an
`--entry-mode` (lite, deep, autonomous), and an explicit `--depth` flag if
you want to override the mode's depth pairing.

Review collects untracked file paths and sizes by default, but not untracked
file contents. If you explicitly want Review to send untracked file contents
to the configured worker, add `--include-untracked-content` after confirming
those files are safe to relay.

## Key Features

**Automatic flow selection.** Describe your task. The router picks a flow
based on a small deterministic classifier, not an LLM call.

**Independent review.** For default and deep modes, implementation and review
run in separate workers. The reviewer starts fresh with no knowledge of the
implementation choices. Lite mode skips the review where the flow allows it.

**Typed reports and evidence.** Every step writes a Zod-validated report. A
flow's final report links the reports the run produced — the implementation,
the verification result, the review verdict — so you can audit a run end to
end without re-reading the trace.

**Per-step configuration.** Pick the model, reasoning effort, and skills for
each step. Configuration layers from defaults to user-global to project to
invocation, and the resolver enforces a single ordering at run time.

**Schematic-driven flows.** Each flow is one folder under `src/flows/<id>/`:
schematic, report schemas, command, contract, writers, relay hints. The
engine derives every per-flow registry from the catalog. Adding a flow does
not require editing the engine.

**Run folders.** Each run gets its own directory with the trace, every typed
report, evidence, and a checkpoint inbox. Resuming, debugging, and audits
all read from the same place.

## Recommended Skills

Circuit composes well with Claude Code skills. Map any installed skill to a
specific step or stage of a flow through configuration; Circuit will inject
it at the right point.

| Skill | Used For |
|-------|----------|
| `tdd` | Test-first discipline in Fix and Build implementation |
| `clean-architecture` | Architecture decisions and quality passes |
| `deep-research` | Evidence gathering during Explore |
| `dead-code-sweep` | Sweep surveys |
| `architecture-exploration` | Evaluating competing design options |

Install whichever skills are relevant to your stack. Circuit runs without any
of them; each one adds depth to the steps where it applies.

## User-Space Configuration

Circuit reads configuration from two layered files:

1. `~/.config/circuit-next/config.yaml` for your personal defaults across
   projects.
2. `./.circuit/config.yaml` at a repo root for project-specific overrides.

Both files share the same schema. The project file's keys win when the same
key is set in both. The default selection ordering is: defaults < user-global
< project < invocation flags.

Configuration controls:

- Per-step **model** (which Claude model to use)
- Per-step **reasoning effort**
- Per-step **skills** to inject
- Per-step **connector** (which backend executes a relayed step)
- Per-flow overrides under `circuits.<flow_id>`

Config is read at run time, so editing either file does not require a
plugin rebuild.

## Optional: Codex CLI

Circuit can relay worker steps through Codex CLI as well as through Claude
Code's built-in Agent transport. Both are synchronous and work out of the
box. Codex is optional.

```bash
npm install -g @openai/codex
```

When Codex is the connector for a step, Circuit launches it inside an
isolated `CODEX_HOME` and `TMPDIR` for the run, so it does not inherit your
ambient Codex MCP servers, plugins, skills, or project-local Codex config.

## Connector Routing

Circuit keeps flow schematics connector-agnostic. Routing lives in
`config.yaml`, so the same flow can pick the right execution transport
without baking transport choices into the schematic.

Connector resolution at relay time follows a fixed order:

1. `relay.roles.<role>` mapping (matches the role of the step being relayed)
2. `relay.circuits.<flow_id>` mapping (matches the active flow)
3. `relay.default`
4. Auto-detect (Codex if installed, else the in-process Agent transport)

Built-in connectors:

- **`agent`** — Claude Code Agent transport with worktree isolation. The
  default when Codex is not installed, and a first-class option even when
  it is.
- **`codex`** — Codex CLI launched inside Circuit's isolated runtime home.

Custom connectors are wrapper executables. Define them under
`relay.connectors.<name>.command` as a YAML argv array. Circuit appends
`PROMPT_FILE OUTPUT_FILE` as the final two arguments; the wrapper reads the
prompt file and writes a JSON response object to the output file. This keeps
wrapper contracts small and avoids shell interpolation. See
[`docs/contracts/connector.md`](docs/contracts/connector.md) for the full
contract.

## Prerequisites

- **Claude Code**
- **Node.js 20+**

## Troubleshooting

**Verify your install.** From a checkout, run the full check suite:

```bash
npm run verify
```

This runs `tsc --noEmit`, the linter, the build, the test suite, and the
flow-emit drift check. If any step fails, that is the issue to fix first.

**Changes to flow source not showing up.** Slash commands and compiled flows
are generated from `src/flows/<id>/`. Regenerate them with:

```bash
npm run emit-flows
```

Verify there is no drift with `npm run check-flow-drift`. CI runs the same
check on every push.

**"codex not found" warning.** Codex CLI is optional. The `agent` connector
runs through Claude Code's built-in Agent transport and works without Codex.
Install Codex only if you want a separate worker process per relay.

**A run resumed from the wrong step.** Each run's state lives in its run
folder under `.circuit-next/runs/`. To resume a specific run with an explicit
checkpoint choice:

```bash
./bin/circuit-next resume \
  --run-folder '<run_folder>' \
  --checkpoint-choice '<choice>'
```

If a run is irrecoverably stuck, the simplest recovery is to delete its run
folder and start the task again from scratch.

## Further Reading

- **[`AGENTS.md`](AGENTS.md):** The agent-facing operating doc for this
  repo.
- **[`docs/terminology.md`](docs/terminology.md):** Canonical product
  vocabulary (flow, schematic, block, route, relay, check, trace, report,
  evidence).
- **[`docs/contracts/`](docs/contracts/):** Engine contracts (config,
  connector, run, step, flow, selection, continuity, skill, stage).
- **[`docs/flows/`](docs/flows/):** Flow design notes and the block catalog.
- **[`specs/domain.md`](specs/domain.md):** Ubiquitous language for the
  domain model.
- **[`HANDOFF.md`](HANDOFF.md):** Cross-session handoff — where we are and
  what's next.

## License

TBD
