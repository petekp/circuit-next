# Core-v2 Checkpoint 5.52: Relay Transcript Sequence Twins

Date: 2026-05-06

## Summary

Phase 5.52 adds test-only core-v2 twins for production relay transcript
sequence behavior:

- admitted relay checks write request, receipt, result, completion,
  `check.evaluated` pass, `step.completed`, and `run.closed` in order;
- failed relay checks keep request, receipt, result, completion, and
  `check.evaluated` failure evidence before aborting;
- connector throws keep request and `relay.failed` evidence, without writing
  receipt/result files or `relay.completed`.

No production code changed.

## What Changed

`tests/core-v2/control-loop-v2.test.ts` now pins ordered relay trace evidence
for pass, check-fail, and connector-fail paths. The tests also assert durable
transcript files exist only when the relay callback reached the relevant stage.

## Proof

```bash
npx vitest run tests/core-v2/control-loop-v2.test.ts
npx vitest run tests/runner/relay-handler-direct.test.ts tests/runner/check-evaluation.test.ts tests/runner/relay-invocation-failure.test.ts
npm run check
npm run lint
npm run build
npm run verify
git diff --check
```

Passed.

## Non-Approvals

Phase 5.52 does not approve:

- changing relay connector behavior;
- changing relay recovery semantics;
- changing retained relay behavior;
- deleting retained relay/check oracle tests;
- deleting old wrappers;
- retiring old public import paths;
- old runtime deletion.

## Next

Continue behavior-preserving cleanup or v2/shared oracle twins. Stop for review
only before public behavior changes, saved-state semantic changes, wrapper
deletion, old public import-path retirement, retained trace/checkpoint ownership
moves, or old runtime deletion.
