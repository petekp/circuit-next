# circuit-next

Claude Code plugin that runs configurable developer workflows.
Successor to the first-generation [Circuit](../circuit) plugin.

## What's wired today

- `/circuit:run` — classifies a free-form task and routes it to the right workflow.
- `/circuit:explore` — investigation and planning workflow.
- `/circuit:review` — audit-only review workflow.
- `/circuit:build` — implementation workflow with checkpoint, dispatch, verification, review, and close.
- `/circuit:fix` — fix workflow with full standard-mode review pass and a `lite` entry mode that skips review (per-mode emit driven by `route_overrides` in `src/workflows/fix/recipe.json`).
- Migrate and Sweep workflows are present as sub-run packages (no slash command yet); Migrate is reachable via `/circuit:run` intent classification.

Per-step configurability of model, reasoning effort, and skills is wired
through the runtime selection resolver. User-global config at
`~/.config/circuit-next/config.yaml` and per-project config at
`./.circuit/config.yaml` are both honored.

Workflow source files live under `src/workflows/<id>/` (recipe, command,
contract, writers, dispatch hints — everything specific to that workflow
in one folder). The catalog at `src/workflows/catalog.ts` aggregates all
packages; the engine derives every per-workflow registry from it.
Recipes are compiled to `.claude-plugin/skills/<id>/circuit.json` (and
per-mode `<mode>.json` siblings when `route_overrides` is non-empty),
and slash commands are copied to `commands/<id>.md`, by
`npm run emit-workflows`. The drift check
(`node scripts/emit-workflows.mjs --check`, also wired into
`npm run verify`) enforces the committed fixtures stay byte-equivalent
with what the recipes and command sources produce.

## Verification

```bash
npm run check    # tsc --noEmit
npm run lint     # biome check
npm run test     # vitest
npm run build    # tsc -p tsconfig.build.json
npm run verify   # all of the above
```

## Layout

```
circuit-next/
├── AGENTS.md                  # Agent operating doc
├── CLAUDE.md                  # Compatibility pointer to AGENTS.md
├── HANDOFF.md                 # Cross-session handoff (where we are, what's next)
├── bin/circuit-next           # CLI entrypoint
├── commands/                  # Generated slash commands (run.md is the CLI router entry)
├── .claude-plugin/            # Plugin manifest + generated skill outputs
├── docs/
│   └── contracts/             # Engine contracts (adapter, config, run, step, workflow, …)
├── specs/
│   ├── domain.md              # Ubiquitous language
│   ├── artifacts.json         # Typed-artifact authority graph
│   ├── invariants.json        # Invariant ledger
│   ├── behavioral/            # Behavioral concerns
│   ├── reference/             # Legacy-surface characterizations
│   ├── workflow-direction.md  # First-principles workflow direction
│   ├── workflow-primitives.md # Reusable workflow moves
│   ├── workflow-primitive-catalog.json
│   ├── workflow-recipe-composition.md
│   └── workflow-research-intake.md
├── src/
│   ├── runtime/               # Engine: registries, runner, step handlers, adapters
│   ├── schemas/               # Zod schemas for all typed surfaces
│   ├── cli/                   # CLI commands (run, dogfood)
│   └── workflows/             # Workflow packages (one folder per workflow)
│       ├── catalog.ts         # Single source of truth the engine derives from
│       ├── types.ts
│       ├── build/             # recipe.json, command.md, contract.md, writers/, dispatch-hints.ts
│       ├── explore/
│       ├── fix/
│       ├── migrate/
│       ├── review/
│       └── sweep/
└── tests/                     # Tests
```

Adding a workflow means creating a folder under `src/workflows/` and
registering it in `catalog.ts`; the engine needs no edits.

## License

TBD
