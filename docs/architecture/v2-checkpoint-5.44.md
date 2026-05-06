# Core-v2 Checkpoint 5.44: Terminal Verdict Parity Hardening

Date: 2026-05-06

## Summary

Phase 5.44 aligns core-v2 final result verdict semantics with the retained
terminal verdict contract.

No public behavior changed outside core-v2 parity hardening. Complete core-v2
runs still expose the latest admitted relay or sub-run verdict. Non-complete
core-v2 runs now omit final `reports/result.json.verdict`, matching the retained
shared helper behavior.

## What Changed

Core-v2 final result writing now calls the latest-admitted verdict lookup only
when the run outcome is `complete`.

`tests/core-v2/control-loop-v2.test.ts` adds a parity regression where a first
relay admits `intermediate`, a second relay rejects and aborts the run, and the
final result omits `verdict`.

`tests/properties/visible/fanout-join-policy.test.ts` now asserts the old
retained join-policy wrapper path directly instead of reaching it indirectly
through the retained fanout handler barrel.

## Proof

```bash
npx vitest run tests/core-v2/control-loop-v2.test.ts
npx vitest run tests/runner/terminal-verdict-helper.test.ts tests/runner/terminal-verdict-derivation.test.ts
npx vitest run tests/properties/visible/fanout-join-policy.test.ts
npx vitest run tests/runner/retained-compat-facade.test.ts
npm run check
npm run lint
npm run build
npm run verify
git diff --check
```

Passed.

## Non-Approvals

Phase 5.44 does not approve:

- changing retained terminal verdict semantics;
- changing relay or sub-run admission semantics;
- deleting old wrappers;
- retiring old public import paths;
- deleting retained oracle tests;
- old runtime deletion.

## Next

Continue behavior-preserving cleanup or v2/shared oracle twins. Stop for review
only before public behavior changes, saved-state semantic changes, wrapper
deletion, old public import-path retirement, or old runtime deletion.
