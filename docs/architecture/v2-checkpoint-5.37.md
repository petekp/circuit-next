# Core-v2 Checkpoint 5.37: Terminal Verdict Neutral Ownership

Date: 2026-05-06

## Summary

Phase 5.37 moves the pure terminal verdict derivation helper to neutral shared
ownership.

No behavior changed. The old runtime path remains a compatibility re-export,
and retained result finalization now imports the neutral helper directly.

## What Changed

`src/shared/terminal-verdict.ts` now owns `deriveTerminalVerdict(...)`.

`src/runtime/terminal-verdict.ts` re-exports the shared helper for old import
compatibility.

`src/runtime/runner.ts` imports `deriveTerminalVerdict(...)` from the shared
owner when writing the retained final result.

`tests/runner/terminal-verdict-helper.test.ts` keeps the primary helper proof
on the shared path and adds an explicit old-runtime compatibility assertion.

`tests/runner/retained-compat-facade.test.ts` now guards production code
against reintroducing imports from the old terminal verdict wrapper path.

## Proof

```bash
npm run check
npm run lint
npm run build
npx vitest run tests/runner/terminal-verdict-helper.test.ts
npx vitest run tests/runner/terminal-verdict-derivation.test.ts
npx vitest run tests/core-v2/control-loop-v2.test.ts
npx vitest run tests/runner/retained-compat-facade.test.ts
npx vitest run tests/runner/runtime-smoke.test.ts tests/runner/check-evaluation.test.ts tests/runner/terminal-outcome-mapping.test.ts
npm run verify
git diff --check
```

Passed.

## Non-Approvals

Phase 5.37 does not approve:

- deleting `src/runtime/terminal-verdict.ts`;
- deleting any old runtime wrapper;
- changing retained result finalization semantics;
- changing core-v2 result finalization semantics;
- changing public compatibility behavior;
- changing retained/v1 saved-folder behavior;
- deleting retained runner or handler tests;
- old runtime deletion.

## Next

Continue behavior-preserving cleanup or v2/shared oracle twins. Stop for review
only before public behavior changes, saved-state semantic changes, wrapper
deletion, old public import-path retirement, or old runtime deletion.
