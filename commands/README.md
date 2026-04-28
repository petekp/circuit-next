# commands/ — generated plugin surface

Most files in this directory are **generated**. Do not edit them by
hand.

| File | Authored where | Edit |
| --- | --- | --- |
| `build.md` | `src/flows/build/command.md` | Edit the source then run `npm run emit-flows` |
| `explore.md` | `src/flows/explore/command.md` | same |
| `fix.md` | `src/flows/fix/command.md` | same |
| `review.md` | `src/flows/review/command.md` | same |
| `run.md` | this file | Hand-authored; the CLI router entry. No source under `src/flows/`. |

The plugin loader reads `commands/<id>.md` at the repo root. CompiledFlow
sources live next to the flow they describe (`src/flows/<id>/`)
so the rest of the package stays colocated. The emit script copies the
authored `command.md` to this directory and the drift check (`npm run
emit-flows -- --check`) keeps the two byte-identical.

`migrate` and `sweep` do not appear here because they have no slash
command surface (Migrate uses `/circuit:run`; Sweep is sub-run only).
