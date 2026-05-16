# Fix-vs-Vanilla Model Matrix

The matrix is the outer loop for Fix evidence. It runs the same task set across
provider/model rows so we can later ask whether Circuit helps cheaper models or
still matters as stronger models improve.

V1 has one enabled row:

- `haiku-medium`: Claude Code, `claude-haiku-4-5-20251001`, `medium`

That row proves matrix plumbing and repeats the current pilot setup. It does
not support a cheaper-model or model-gradient claim by itself. Matrix-level
claims require at least two actually-run provider/model rows.

Dry-run:

```bash
npm run evals:fix:matrix:dry-run
```

Real runs should be explicit and are not part of default verification because
they invoke live models.
