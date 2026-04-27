# Agent Guide — circuit-next

## What this project is

`circuit-next` is a Claude Code plugin that runs configurable developer
workflows. The product surface is `src/` (TypeScript), `tests/`, the
generated `commands/` and `.claude-plugin/`, the workflow packages
under `src/workflows/`, the engine contracts under `docs/contracts/`,
and the behavioral notes under `specs/behavioral/`.

This file is the agent-facing operating doc. Keep it short. If something
isn't here, it isn't a rule.

## Rules that earned their place

1. **Read before Write.** Always read existing files before overwriting
   them.
2. **Tests for behavior we care about.** When fixing a bug, write a
   failing test first. When changing behavior, the test changes with it.
3. **Plain English with the operator.** Short sentences, one idea each.
   No project-internal jargon — no slice codenames, no ADR ids, no
   verdict-class language. If a name matters, describe what it is.
4. **Task list for multi-step work.** Three or more steps → use the
   task tools.
5. **Root-cause discipline.** Enumerate two or three hypotheses before
   acting on one.
6. **Cross-session handoffs.** When approaching ~200k tokens or wrapping
   for the day, write or update `HANDOFF.md` at the repo root: where we
   are, what's blocked, what's next, in plain English. Two short
   paragraphs. The next session reads it as the first action.
7. **Codex for impactful, hard-to-revert decisions.** Default off. Pull
   Codex in when a choice is hard to re-work later (architecture,
   contracts, migration paths), I'm stuck after a couple of real
   attempts, or you ask. Use `/codex` explicitly so the handoff is
   visible. Don't use Codex for cleanup, mechanical refactors, or
   anything `npm run verify` proves. No challenger passes on plans.

## Verification

```bash
npm run check   # tsc --noEmit
npm run lint    # biome check
npm run test    # vitest
npm run build   # tsc -p tsconfig.build.json
npm run verify  # all of the above
```

These must pass before commit on changes to `src/`, `tests/`, or
`commands/`.

## Where things live

| Artifact | Path |
|---|---|
| Plugin manifest | `.claude-plugin/plugin.json` |
| Slash commands (generated) | `commands/<id>.md` (generated from `src/workflows/<id>/command.md`; `commands/run.md` is the CLI router entry and is hand-authored) |
| Compiled plugin output (generated) | `.claude-plugin/skills/<id>/circuit.json` |
| CLI entrypoint | `bin/circuit-next` |
| Engine source | `src/runtime/`, `src/cli/`, `src/schemas/` |
| Workflow packages | `src/workflows/<id>/` (recipe, command, contract, writers, dispatch hints) |
| Workflow catalog | `src/workflows/catalog.ts` (single source of truth the engine derives from) |
| Tests | `tests/` |
| Engine contracts | `docs/contracts/` |
| Workflow design notes | `docs/workflows/` |
| Behavioral concerns | `specs/behavioral/` |
| Ubiquitous language | `specs/domain.md` |
| Primitive catalog | `docs/workflows/primitive-catalog.json` |
| Cross-session handoff | `HANDOFF.md` (repo root) |
| Reference plugin | `~/Code/circuit` (read-only) |

## Adding a workflow

1. Create `src/workflows/<id>/` with `recipe.json`, optional `command.md`
   and `contract.md`, `index.ts` (the WorkflowPackage), `dispatch-hints.ts`
   (if any dispatch artifacts have shape hints), and `writers/` (one file
   per writer kind your workflow uses: synthesis / close / verification /
   checkpoint).
2. Add the package to `src/workflows/catalog.ts`.
3. `npm run build && node scripts/emit-workflows.mjs` to regenerate
   `commands/<id>.md` and `.claude-plugin/skills/<id>/`.
4. `npm run verify`.

The engine (`src/runtime/`) does not need any edits — registries derive
from the catalog. If you find yourself editing engine files to add a
workflow, the boundary is being violated.

`WorkflowPackage.engineFlags` carries opt-in switches the engine
branches on (currently only `bindsExecutionRigorToDispatchSelection`,
which Build sets). Add a flag entry there if your workflow needs
special engine behavior — never put workflow-specific code into the
engine itself.

## Reference plugin

The previous-generation Circuit lives at `~/Code/circuit`. Read-only
reference. Don't modify it.
