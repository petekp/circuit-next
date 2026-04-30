# First Run

Start with doctor before the first useful run:

```bash
node plugins/circuit/scripts/circuit-next.mjs doctor
```

Doctor checks the packaged plugin files, command wrapper, generated flows, and
basic Review/checkpoint behavior. A passing doctor means the supported host path
is installed well enough to try a real flow.

For the safest first real run, use Review. Review is read-only:

```bash
./bin/circuit-next run review --goal 'review this checkout for obvious release blockers'
```

Build, Fix, Migrate, and Sweep may invoke a write-capable Claude Code worker:

> This flow may invoke a write-capable Claude Code worker. Circuit will verify
> and review the result, but the worker can edit files in this checkout.

Use `codex` only for read-only Codex relays. Use `claude-code` for trusted
same-workspace writes. `codex-isolated` is planned, not current.
