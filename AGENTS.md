# Agent Guide — circuit-next

## What this project is

`circuit-next` is a Claude Code plugin that runs configurable developer
workflows. The product surface is `src/` (TypeScript), `tests/`,
`commands/`, `.claude-plugin/plugin.json`, the workflow recipes and
primitive catalog under `specs/workflow-*`, and the typed contracts under
`specs/contracts/` and `specs/behavioral/`.

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
| Slash commands | `commands/` |
| CLI entrypoint | `bin/circuit-next` |
| Source | `src/` |
| Tests | `tests/` |
| Module contracts | `specs/contracts/` |
| Behavioral concerns | `specs/behavioral/` |
| Ubiquitous language | `specs/domain.md` |
| Workflow design | `specs/workflow-direction.md`, `specs/workflow-primitives.md`, `specs/workflow-recipe-composition.md`, `specs/workflow-research-intake.md` |
| Workflow recipes | `specs/workflow-recipes/` |
| Primitive catalog | `specs/workflow-primitive-catalog.json` |
| Cross-session handoff | `HANDOFF.md` (repo root) |
| Reference plugin | `~/Code/circuit` (read-only) |

## Reference plugin

The previous-generation Circuit lives at `~/Code/circuit`. Read-only
reference. Don't modify it.
