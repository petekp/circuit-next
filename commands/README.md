# commands/ — generated plugin surface

Most files in this directory are **generated**. Do not edit them by
hand.

| File | Authored where | Owner | Edit |
| --- | --- | --- | --- |
| `build.md` | `src/flows/build/command.md` | flow package | Edit the source then run `npm run emit-flows` |
| `explore.md` | `src/flows/explore/command.md` | flow package | same |
| `fix.md` | `src/flows/fix/command.md` | flow package | same |
| `review.md` | `src/flows/review/command.md` | flow package | same |
| `create.md` | `commands/create.md` | root command | Edit this file, then run `npm run emit-flows` |
| `handoff.md` | `commands/handoff.md` | root command | same |
| `migrate.md` | `commands/migrate.md` | root command | same |
| `run.md` | `commands/run.md` | root command | same |
| `sweep.md` | `commands/sweep.md` | root command | same |

The plugin loader reads `commands/<id>.md` at the repo root. CompiledFlow
sources live next to the flow they describe (`src/flows/<id>/`)
so the rest of the package stays colocated. The emit script copies the
authored `command.md` to this directory and the drift check (`npm run
emit-flows -- --check`) keeps the two byte-identical.

Root command files are maintained here and mirrored into the Codex plugin
surfaces by the same emit script. A flow can therefore have a direct command
surface even when it does not declare `paths.command`; in that case this
directory is the source.
