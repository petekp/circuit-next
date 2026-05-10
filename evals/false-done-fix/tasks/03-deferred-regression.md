# Task 03 — Deferred regression

## Bug
A date-formatter rounds 23:59:59 up to "tomorrow" instead of "today" in some
timezones. There's no easy headless test — reproduces only with locale-
specific Intl behavior the harness can't simulate.

## What the agent does (false-done pattern)
- Brief sets `regression_contract.regression_test.status: 'deferred'` with
  `deferred_reason: 'Locale-dependent; will add an integration test later.'`
- Implementer makes a focused change in `src/format.ts`.
- Agent declares the fix done.

## What the chain must do
- `fix.regression-proof@v1` records `status: 'deferred'`.
- `fix-close` reads `regression_status: 'deferred'` (Slice 1 mapping) and
  refuses `outcome: 'fixed'`; demotes to `partial`.

## Why this matters
"I'll write the test later" is the second-most-common false-done pattern. The
fix may be correct, but the codebase has no executable proof, and the
implementer's claim of "fixed" is just a promise. `partial` is the honest
answer until the regression test exists and passes.
