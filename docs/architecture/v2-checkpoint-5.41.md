# Core-v2 Checkpoint 5.41: Fanout Aggregate Shared Helper

Date: 2026-05-06

## Summary

Phase 5.41 moves fanout aggregate report body construction to neutral shared
ownership.

No behavior changed. Retained fanout and core-v2 fanout still write the same
durable aggregate report shape. The old retained fanout aggregate helper path
remains a compatibility re-export.

## What Changed

`src/shared/fanout-aggregate-report.ts` now owns
`buildFanoutAggregate(...)`.

`src/runtime/step-handlers/fanout/aggregate.ts` re-exports the shared helper as
the old retained `buildAggregate(...)` function.

Retained fanout imports the shared helper directly. Core-v2 fanout keeps its
existing `buildFanoutAggregateV2(...)` adapter, but that adapter now delegates
to the shared helper.

`tests/runner/fanout-aggregate-compat.test.ts` proves the old retained helper
path points at the shared helper, the aggregate body shape is unchanged, and
core-v2 aggregate output matches the shared helper.

`tests/runner/retained-compat-facade.test.ts` guards production code against
reintroducing imports from the old retained fanout aggregate wrapper path.

## Proof

```bash
npm run check
npm run lint
npm run build
npx vitest run tests/runner/fanout-aggregate-compat.test.ts tests/runner/fanout-handler-direct.test.ts tests/runner/fanout-runtime.test.ts tests/core-v2/fanout-v2.test.ts tests/runner/retained-compat-facade.test.ts
npm run verify
git diff --check
```

Passed.

## Non-Approvals

Phase 5.41 does not approve:

- deleting `src/runtime/step-handlers/fanout/aggregate.ts`;
- changing fanout aggregate report shape;
- changing retained fanout behavior;
- changing core-v2 fanout behavior;
- changing public compatibility behavior;
- deleting retained fanout tests;
- old runtime deletion.

## Next

Continue behavior-preserving cleanup or v2/shared oracle twins. Stop for review
only before public behavior changes, saved-state semantic changes, wrapper
deletion, old public import-path retirement, or old runtime deletion.
