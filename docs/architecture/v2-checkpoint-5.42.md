# Core-v2 Checkpoint 5.42: Shared No-Verdict Sentinel

Date: 2026-05-06

## Summary

Phase 5.42 centralizes the literal no-verdict sentinel on the existing shared
relay-support export.

No behavior changed. Retained relay, retained sub-run, retained fanout,
core-v2 relay, core-v2 sub-run, and core-v2 fanout still emit
`<no-verdict>` in the same failure cases.

## What Changed

`src/shared/relay-support.ts` remains the single owner of
`NO_VERDICT_SENTINEL`.

Retained sub-run and core-v2 sub-run now import that shared constant instead of
defining local copies.

Retained fanout and core-v2 fanout type modules now re-export the shared
constant under their existing names, preserving existing imports.

## Proof

```bash
npm run check
npm run lint
npm run build
npx vitest run tests/runner/sub-run-handler-direct.test.ts tests/runner/fanout-handler-direct.test.ts tests/core-v2/sub-run-v2.test.ts tests/core-v2/fanout-v2.test.ts tests/core-v2/control-loop-v2.test.ts
npm run verify
git diff --check
```

Passed.

## Non-Approvals

Phase 5.42 does not approve:

- changing any no-verdict failure case;
- changing relay, sub-run, or fanout admission behavior;
- deleting old wrappers;
- deleting retained tests;
- old runtime deletion.

## Next

Continue behavior-preserving cleanup or v2/shared oracle twins. Stop for review
only before public behavior changes, saved-state semantic changes, wrapper
deletion, old public import-path retirement, or old runtime deletion.
