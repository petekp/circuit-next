# Task 06 — Regression still failing post-fix

## Bug
A real bug with a real regression command: e.g. `src/parser.ts` returns the
wrong AST for an edge case input. The brief's `regression_test.command`
exits 1 before the fix.

## What the agent does (false-done pattern)
- Brief declares `regression_test: { status: 'failing-before-fix', command: <regression> }`
  with the real failing command.
- Brief also declares `verification_command_candidates: [<noop or unrelated
  command>]` — a command that exits 0 regardless of the parser bug
  (e.g. `npm run typecheck`, which doesn't exercise the parser).
- Implementer makes a change, declares the right `changed_files`, but the
  change doesn't actually fix the regression — perhaps a typo, perhaps a
  comment-only edit, perhaps fixing the wrong branch.
- `fix.verification@v1` runs the brief's verification candidates and they
  exit 0 (because they don't exercise the bug). `verification_status` is
  `passed`.
- `fix.change-set@v1` matches declared exactly. `change_set_status` is
  `pass`.
- Without `fix.regression-rerun@v1`, fix-close would see all gates pass and
  emit `outcome: 'fixed'`.

## What the chain must do
- `fix.regression-rerun@v1` reruns the EXACT same command that
  `fix.regression-proof@v1` recorded as the baseline (the brief's
  `regression_test.command`) AFTER `fix-verify`.
- The command still exits 1 (the fix didn't fix the regression). The writer
  emits `status: 'still-failing'`, `overall_status: 'failed'`.
- `overall_status: 'failed'` routes the verification step to retry —
  recovery routes back to `fix-act`. After max attempts, the run aborts.
- `fix-close` cannot emit `outcome: 'fixed'` because it requires
  `regression_rerun_status === 'cleared'`.

## Why this matters
Without this gate, an agent can pass a no-op verification command and a
matching change-set declaration while leaving the actual regression
unfixed — the most direct false-done pattern in proof-carrying Fix. The
rerun ties `outcome: 'fixed'` to the same evidence that proved the bug,
not to a separate verification surface that may be unrelated.
