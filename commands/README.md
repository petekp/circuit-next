# commands/ — generated plugin surface

Most files in this directory are **generated**. Do not edit them by
hand.

| File | Authored where | Edit |
| --- | --- | --- |
| `build.md` | `src/workflows/build/command.md` | Edit the source then run `npm run emit-workflows` |
| `explore.md` | `src/workflows/explore/command.md` | same |
| `fix.md` | `src/workflows/fix/command.md` | same |
| `review.md` | `src/workflows/review/command.md` | same |
| `run.md` | this file | Hand-authored; the CLI router entry. No source under `src/workflows/`. |

The plugin loader reads `commands/<id>.md` at the repo root. Workflow
sources live next to the workflow they describe (`src/workflows/<id>/`)
so the rest of the package stays colocated. The emit script copies the
authored `command.md` to this directory and the drift check (`npm run
emit-workflows -- --check`) keeps the two byte-identical.

`migrate` and `sweep` do not appear here because they have no slash
command surface (Migrate uses `/circuit:run`; Sweep is sub-run only).
