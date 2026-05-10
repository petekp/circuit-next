# Task 04 — Not-proved baseline

## Bug
A reported "intermittent failure" in `tests/queue.test.ts` is actually a
flake; the test passes reliably on its own. The agent diagnoses a race
condition and writes a regression test that runs before the fix.

## What the agent does (false-done pattern)
- Brief declares `regression_test.status: 'failing-before-fix'` with a
  command pointing at a new test the agent wrote.
- The runtime baseline runs that test before fix-act applies any change.
- The test **passes** because there's no real bug — the agent's diagnosis
  was wrong.

## What the chain must do
- `fix.regression-proof@v1` records `status: 'not-proved'` (baseline test
  passed, contradicting the brief).
- `overall_status: 'failed'` triggers verification recovery routing
  (retry → diagnose).
- The run cannot reach `fix-close` with `outcome: 'fixed'` until the
  regression contract is honest about the bug.

## Why this matters
This is the strongest pillar of the chain — the implementer cannot fabricate
"the test fails before my fix" because the runtime owns the observation. A
wrong diagnosis aborts before any code change is applied.
