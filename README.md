# circuit-next

Claude Code plugin that runs configurable developer flows.
Successor to the first-generation [Circuit](../circuit) plugin.

See [`docs/terminology.md`](docs/terminology.md) for the canonical product
vocabulary (flow, schematic, block, route, relay, check, trace, report, evidence).

## What's wired today

- `/circuit:run` — classifies a free-form task and routes it to the right flow.
- `/circuit:explore` — investigation and planning flow.
- `/circuit:review` — audit-only review flow.
- `/circuit:build` — implementation flow with checkpoint, relay, verification, review, and close.
- `/circuit:fix` — fix flow with full standard-mode review pass and a `lite` entry mode that skips review (per-mode emit driven by `route_overrides` in `src/flows/fix/schematic.json`).
- Migrate and Sweep flows are present as sub-run packages (no slash command yet); Migrate is reachable via `/circuit:run` intent classification.

Per-step configurability of model, reasoning effort, and skills is wired
through the runtime selection resolver. User-global config at
`~/.config/circuit-next/config.yaml` and per-project config at
`./.circuit/config.yaml` are both honored.

Flow source files live under `src/flows/<id>/` (schematic, command,
contract, writers, relay hints — everything specific to that flow in one
folder). The catalog at `src/flows/catalog.ts` aggrechecks all packages;
the engine derives every per-flow registry from it. Schematics are compiled
to `.claude-plugin/skills/<id>/circuit.json` (and per-mode `<mode>.json`
siblings when `route_overrides` is non-empty), and slash commands are
copied to `commands/<id>.md`, by `npm run emit-flows`. The drift check
(`node scripts/emit-flows.mjs --check`, also wired into
`npm run verify`) enforces the committed compiled flows stay byte-equivalent
with what the schematics and command sources produce.

(Internal file names like `relay-hints.ts` are still on their
pre-migration names; the trace_entryual rename to `relay-hints.ts` is part of
the deferred deep `relay → relay` rename — see
`todos/terminology-migration.md` Stage 8.)

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
│   ├── contracts/             # Engine contracts (connector, config, run, step, flow, …)
│   ├── terminology.md         # Canonical product vocabulary
│   └── flows/             # Flow design notes + block catalog
├── specs/
│   ├── domain.md              # Ubiquitous language
│   ├── reports.json         # Typed-output authority graph
│   ├── invariants.json        # Invariant ledger
│   ├── behavioral/            # Behavioral concerns
│   └── reference/             # Legacy-surface characterizations
├── src/
│   ├── runtime/               # Engine: registries, runner, step handlers, connectors
│   ├── schemas/               # Zod schemas for all typed surfaces
│   ├── cli/circuit.ts         # CLI entry (router + flow launcher)
│   └── flows/             # Flow packages (one folder per flow)
│       ├── catalog.ts         # Single source of truth the engine derives from
│       ├── types.ts
│       ├── build/             # schematic.json, reports.ts, command.md, contract.md, writers/, relay-hints.ts
│       ├── explore/
│       ├── fix/
│       ├── migrate/
│       ├── review/
│       └── sweep/
└── tests/                     # Tests
```

Adding a flow:

1. Create `src/flows/<id>/` with `schematic.json`,
   `reports.ts` (the flow's Zod schemas), optional `command.md` and
   `contract.md`, `index.ts` (the package descriptor),
   `relay-hints.ts` (if any relay steps have shape hints), and
   `writers/`.
2. Add the package to `src/flows/catalog.ts`.
3. `npm run build && node scripts/emit-flows.mjs` to regenerate
   `commands/<id>.md` and `.claude-plugin/skills/<id>/`.
4. `npm run verify`.

The engine (`src/runtime/`) needs no edits — registries derive from the
catalog. See `AGENTS.md` for the full operating doc.

## License

TBD
