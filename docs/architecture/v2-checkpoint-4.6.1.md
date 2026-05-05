# Circuit v2 Checkpoint 4.6.1

## Summary

Phase 4.6.1 stabilizes the default selector after review.

The selector remains enabled only for matrix-supported fresh-run modes. Old
runtime deletion, checkpoint resume routing, and unconditional v2 routing remain
out of scope.

## composeWriter Policy

`main(..., { composeWriter })` is an exported programmatic hook. The retained
runtime honors it, but core-v2 does not yet expose an equivalent hook.

The default selector now preserves that behavior:

```text
composeWriter supplied + normal routing -> retained runtime
composeWriter supplied + candidate diagnostics -> retained runtime
composeWriter supplied + strict v2 opt-in -> fail closed
```

This prevents the default v2 path from silently ignoring a supplied writer.

## Fixture Policy Note

Generated-flow fixture eligibility is path-based. Fixtures under
`generated/flows` can route through v2 when the matrix matches. Arbitrary
fixtures outside that tree remain on the retained runtime unless strict opt-in
is set.

## Candidate Flag Lifecycle

`CIRCUIT_V2_RUNTIME_CANDIDATE=1` is kept as a diagnostic mode for one release
soak. It no longer changes default routing; it only includes
`runtime`/`runtime_reason` fields in CLI JSON output.

After the default selector has soaked, remove it or replace it with a clearer
diagnostic flag.

## Validation

- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Old runtime deletion remains explicitly out of scope.
