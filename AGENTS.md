# Agent Guide — circuit-next

## What this project is

`circuit-next` is a Claude Code plugin that runs configurable developer
flows. The product surface is `src/` (TypeScript), `tests/`, the
generated `commands/` and `.claude-plugin/`, the flow packages
under `src/flows/`, the engine contracts under `docs/contracts/`,
and the behavioral notes under `specs/behavioral/`.

This file is the agent-facing operating doc. Keep it short. If something
isn't here, it isn't a rule.

See [`docs/terminology.md`](docs/terminology.md) for the canonical product
vocabulary (flow, schematic, block, route, relay, check, trace, report,
evidence). Use that vocabulary in product-facing prose.

## Rules that earned their place

1. **Read before Write.** Always read existing files before overwriting
   them.
2. **Tests for behavior we care about.** When fixing a bug, write a
   failing test first. When changing behavior, the test changes with it.
3. **Plain English with the operator.** Short sentences, one idea each.
   No project-internal jargon — no codename ids, no review-result-class
   language. If a name matters, describe what it is.
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
8. **Host hooks use hook input for identity.** Hook scripts must read the
   host's stdin JSON for workspace identity and pass explicit project roots.
   Do not treat `process.cwd()` as the project authority inside hooks.

## Verification

```bash
npm run check        # tsc --noEmit
npm run lint         # biome check
npm run test         # vitest (full suite)
npm run test:fast    # vitest excluding tests/runner/** (subprocess-heavy)
npm run test:coverage # vitest run --coverage (info, no thresholds)
npm run build        # tsc -p tsconfig.build.json
npm run verify       # full canonical check; CI runs this
npm run verify:fast  # check + lint + build + test:fast + drift (~40% faster)
```

`verify` is the canonical check and what CI enforces. Use `verify:fast`
during iterative loops; run full `verify` before claiming a change is
done. Both must pass before commit on changes to `src/`, `tests/`, or
`commands/`.

## Where things live

| File or output | Path |
|---|---|
| Plugin manifest | `.claude-plugin/plugin.json` |
| Slash commands (generated) | `commands/<id>.md` (generated from `src/flows/<id>/command.md`; `commands/run.md` is the CLI router entry and is hand-authored) |
| Compiled plugin output (generated) | `.claude-plugin/skills/<id>/circuit.json` |
| CLI entrypoint | `bin/circuit-next` |
| Engine source | `src/runtime/`, `src/cli/`, `src/schemas/` |
| Flow packages | `src/flows/<id>/` (schematic, output schemas, command, contract, writers, relay hints) |
| Flow catalog | `src/flows/catalog.ts` (single source of truth the engine derives from) |
| Tests | `tests/` |
| Engine contracts | `docs/contracts/` |
| Flow design notes | `docs/flows/` |
| Behavioral concerns | `specs/behavioral/` |
| Ubiquitous language | `specs/domain.md` |
| Block catalog | `docs/flows/block-catalog.json` |
| Cross-session handoff | `HANDOFF.md` (repo root) |

(Internal file names like `relay-hints.ts` are still on their
pre-migration names; the eventual rename to `relay-hints.ts` is part of
the deferred deep `relay → relay` rename — see
`todos/terminology-migration.md` Stage 8.)

## Adding a flow

1. Create `src/flows/<id>/` with `schematic.json`,
   `reports.ts` (the flow's Zod report schemas), optional `command.md`
   and `contract.md`, `index.ts` (the package descriptor),
   `relay-hints.ts` (if any relay steps have shape hints), and
   `writers/` (one file per writer kind your flow uses: `compose` /
   `close` / `verification` / `checkpoint`).
2. Add the package to `src/flows/catalog.ts`.
3. `npm run build && node scripts/emit-flows.mjs` to regenerate
   `commands/<id>.md` and `.claude-plugin/skills/<id>/`.
4. `npm run verify`.

The engine (`src/runtime/`) does not need any edits — registries derive
from the catalog. If you find yourself editing engine files to add a
flow, the boundary is being violated.

`CompiledFlowPackage.engineFlags` carries opt-in switches the engine
branches on (currently only `bindsExecutionDepthToRelaySelection`,
which Build sets). Add a flag entry there if your flow needs special
engine behavior — never put flow-specific code into the engine itself.
