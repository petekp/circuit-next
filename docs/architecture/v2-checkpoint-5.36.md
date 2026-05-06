# Core-v2 Checkpoint 5.36: Terminal Verdict Derivation Twin

Date: 2026-05-06

## Summary

Phase 5.36 adds a focused core-v2 twin for a retained terminal verdict oracle:
when a run admits multiple relay verdicts before closing, the final
`reports/result.json` verdict comes from the later admitted relay.

No production behavior changed.

## What Changed

`tests/core-v2/control-loop-v2.test.ts` now includes a production compiled-flow
case with two relay steps:

1. `first-relay` admits `intermediate` and routes to `second-relay`;
2. `second-relay` admits `final` and routes to `@complete`;
3. the core-v2 final result reports `verdict: "final"`.

The test also asserts both `relay.completed` entries carry
`data: { admitted: true }`.

## Oracle Covered

This mirrors retained terminal verdict derivation coverage in
`tests/runner/terminal-verdict-derivation.test.ts`, where retained execution
walks backward through admitted verdict-bearing steps and uses the latest
admitted verdict for complete runs.

## Proof

```bash
npx vitest run tests/core-v2/control-loop-v2.test.ts
```

Passed.

## Non-Approvals

Phase 5.36 does not approve:

- deleting retained terminal verdict tests;
- changing retained result finalization;
- changing core-v2 result finalization behavior;
- changing public compatibility behavior;
- old runtime deletion.

## Next

Continue behavior-preserving cleanup or v2/shared oracle twins. Stop for review
before public behavior changes, saved-state semantic changes, wrapper deletion,
or old runtime deletion.
