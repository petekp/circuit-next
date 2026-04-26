# circuit-next

Claude Code plugin that runs configurable developer workflows.
Successor to the first-generation [Circuit](../circuit) plugin.

## What's wired today

- `/circuit:run` — classifies a free-form task and routes it to the right workflow.
- `/circuit:explore` — investigation and planning workflow.
- `/circuit:review` — audit-only review workflow.
- `/circuit:build` — implementation workflow with checkpoint, dispatch, verification, review, and close.
- `/circuit:fix` — fix workflow with full standard-mode review pass and a `lite` entry mode that skips review (per-mode emit driven by `route_overrides` in `specs/workflow-recipes/fix.recipe.json`).

Per-step configurability of model, reasoning effort, and skills is wired
through the runtime selection resolver. User-global config at
`~/.config/circuit-next/config.yaml` and per-project config at
`./.circuit/config.yaml` are both honored.

Workflow recipes live under `specs/workflow-recipes/` and are compiled to
`.claude-plugin/skills/<id>/circuit.json` (and per-mode `<mode>.json` siblings
when `route_overrides` is non-empty) by `npm run emit-workflows`. The drift
check (`npm run check-workflow-drift`, also wired into `npm run verify`)
enforces the committed fixtures stay byte-equivalent with what the recipes
compile to.

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
├── commands/                  # Slash command definitions
├── .claude-plugin/            # Plugin manifest
├── specs/
│   ├── domain.md              # Ubiquitous language
│   ├── artifacts.json         # Typed-artifact authority graph
│   ├── invariants.json        # Invariant ledger
│   ├── contracts/             # Per-module contracts
│   ├── behavioral/            # Behavioral concerns
│   ├── reference/             # Legacy-surface characterizations
│   ├── workflow-direction.md  # First-principles workflow direction
│   ├── workflow-primitives.md # Reusable workflow moves
│   ├── workflow-primitive-catalog.json
│   ├── workflow-recipe-composition.md
│   ├── workflow-research-intake.md
│   └── workflow-recipes/      # Recipe fixtures
├── src/                       # Source
└── tests/                     # Tests
```

## License

TBD
