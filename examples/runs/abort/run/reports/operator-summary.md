# Circuit Summary

Circuit run aborted.

## What Happened

- Selected flow: `build`
- Outcome: `aborted`
- Routed by: `explicit`
- Router reason: explicit flow positional argument

## Details

- Worker access: This flow may invoke a write-capable Claude Code worker. Circuit will verify and review the result, but the worker can edit files in this checkout.
- Run note: Circuit completed 4 Build steps for this goal.
- Abort reason: route 'retry' for step 'act-step' exhausted max_attempts=2; last recovery reason: relay step 'act-step': connector invocation failed (proof connector failure while implementing the synthetic Build change)

## Evidence Warnings

- None

## Run Files

- Run folder: <repo>/examples/runs/abort/run
- Result path: <repo>/examples/runs/abort/run/reports/result.json

## Reports

- Run result: <repo>/examples/runs/abort/run/reports/result.json
