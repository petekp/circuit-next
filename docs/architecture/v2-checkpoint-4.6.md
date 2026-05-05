# Circuit v2 Checkpoint 4.6

## Summary

Phase 4.6 prepares the actual default-switch proposal for matrix-supported
fresh-run modes.

This slice changes normal fresh-run routing to use the same support matrix that
the candidate selector already proved. It is still a selector, not
unconditional v2 routing. Old runtime deletion is still not approved or
attempted.

## Default Selector

The proposed default behavior is now implemented:

```text
matrix-supported fresh run -> core-v2
checkpoint resume -> retained runtime
checkpoint-waiting mode -> retained runtime
unsupported flow/mode/depth -> retained runtime
arbitrary explicit fixture -> retained runtime unless strict opt-in is set
```

The supported matrix remains:

- `review` default at standard depth;
- `fix` lite at lite depth;
- `build` default at standard depth;
- `build` lite at lite depth;
- `explore` default at standard depth;
- `migrate` default at standard depth;
- `sweep` default at standard depth.

All other public entry modes stay on the retained runtime.

## Rollback And Opt-In Precedence

The emergency rollback switch is:

```text
CIRCUIT_DISABLE_V2_RUNTIME=1
```

When set, normal default routing uses the retained runtime for all fresh runs.

Precedence is explicit:

```text
CIRCUIT_V2_RUNTIME=1 -> force v2 or fail closed
CIRCUIT_DISABLE_V2_RUNTIME=1 -> retained runtime for normal routing
normal default selector -> matrix-supported v2, otherwise retained
```

Strict opt-in wins over the rollback switch because it is an explicit request to
force-test v2 behavior.

`CIRCUIT_V2_RUNTIME_CANDIDATE=1` is retained for one slice as a diagnostic mode.
After the default selector lands, it no longer changes routing for supported
fresh runs; it only includes runtime/runtime_reason fields in CLI JSON output.
The intended lifecycle is to remove or rename it after one release soak; it is
not meant to become a permanent runtime mode.

## Fixture Policy

The default selector keeps arbitrary explicit `--fixture` and `--flow-root`
inputs on the retained runtime.

Generated fixtures under `generated/flows` remain eligible when the matrix
matches. Arbitrary fixture experiments must use strict opt-in:

```text
CIRCUIT_V2_RUNTIME=1
```

This eligibility check is path-based. A fixture physically under
`generated/flows` is treated as a generated-flow fixture for routing purposes;
fixtures outside that tree remain retained-runtime-owned unless strict opt-in
is set.

## Programmatic Hooks

`main(..., { composeWriter })` remains retained-runtime-owned. The old runtime
supports that exported testing/integration hook, while core-v2 does not yet
expose an equivalent compose writer hook.

Normal and candidate routing therefore fall back to the retained runtime when
`composeWriter` is supplied. Strict v2 opt-in fails closed instead of silently
ignoring the hook.

## Output Compatibility

Normal default-routed output remains product-compatible and omits:

```text
runtime
runtime_reason
```

Strict and candidate modes include those fields as diagnostics. Rollback mode
also includes them so the operator can see that default v2 routing was disabled.

Tests assert runtime selection through the run folder trace marker for normal
default runs:

```json
"engine": "core-v2"
```

## Retained Runtime Ownership

The retained runtime still owns:

- checkpoint resume;
- checkpoint-waiting depths;
- unsupported public entry modes;
- arbitrary fixture default routing;
- old runtime comparison tests and rollback behavior.

## Validation

The Phase 4.6 packet should be reviewed with:

- no-env default-routing tests for every supported matrix row;
- exhaustive unsupported public entry-mode fallback tests;
- rollback tests for supported rows;
- strict opt-in precedence tests;
- status/progress tests from Phase 4.5;
- full repository validation.

Validation run for this packet:

- `npx vitest run tests/runner/cli-v2-runtime.test.ts`: passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/run-status-projection.test.ts tests/contracts/progress-event-schema.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Old runtime deletion remains explicitly out of scope.
