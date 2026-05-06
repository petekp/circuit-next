# Core-v2 Checkpoint 5.40: JSON Report Shared Helper

Date: 2026-05-06

## Summary

Phase 5.40 moves the generic path-safe JSON report helper to neutral shared
ownership.

No behavior changed. Retained result finalization and retained step handlers now
import the shared helper directly. The old retained step-handler helper path
remains a compatibility re-export.

## What Changed

`src/shared/json-report.ts` now owns `writeJsonReport(...)` and
`isRunRelativePathError(...)`.

`src/runtime/step-handlers/shared.ts` re-exports the shared helper for old
retained import compatibility.

Retained runner and retained compose/checkpoint/verification/fanout/sub-run
handlers now import the helper from `src/shared/json-report.ts`.

`tests/runner/json-report-compat.test.ts` proves the old retained helper path
points at the shared helper, writes formatted JSON reports, and still rejects
escaping report paths.

`tests/runner/retained-compat-facade.test.ts` guards production code against
reintroducing imports from the old retained step-handler helper wrapper path.

## Proof

```bash
npm run check
npm run lint
npm run build
npx vitest run tests/runner/json-report-compat.test.ts tests/runner/run-relative-path.test.ts tests/runner/retained-compat-facade.test.ts tests/runner/checkpoint-handler-direct.test.ts tests/runner/fanout-handler-direct.test.ts tests/runner/verification-handler-direct.test.ts
npm run verify
git diff --check
```

Passed.

## Non-Approvals

Phase 5.40 does not approve:

- deleting `src/runtime/step-handlers/shared.ts`;
- changing report write semantics;
- changing retained checkpoint, fanout, relay, verification, compose, or sub-run
  behavior;
- changing retained/v1 saved-folder behavior;
- changing public compatibility behavior;
- deleting retained runner or handler tests;
- old runtime deletion.

## Next

Continue behavior-preserving cleanup or v2/shared oracle twins. Stop for review
only before public behavior changes, saved-state semantic changes, wrapper
deletion, old public import-path retirement, or old runtime deletion.
