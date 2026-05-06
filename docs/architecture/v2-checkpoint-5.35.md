# Core-v2 Checkpoint 5.35: Shared Helper Wrapper Import Cleanup

Date: 2026-05-06

## Summary

Phase 5.35 is a behavior-preserving import cleanup for helper modules whose
implementations already live under `src/shared/**`.

No runtime behavior changed. Old runtime helper paths remain compatibility
wrappers.

## What Changed

Retained runtime implementation files now import already-neutral helpers
directly instead of reaching them through old `src/runtime/**` wrapper paths:

- manifest snapshot helpers from `src/shared/manifest-snapshot.ts`;
- run-relative path helpers from `src/shared/run-relative-path.ts`;
- relay support helpers from `src/shared/relay-support.ts`;
- write-capable worker disclosure helpers from
  `src/shared/write-capable-worker-disclosure.ts`.

The old wrapper files remain:

- `src/runtime/config-loader.ts`;
- `src/runtime/manifest-snapshot-writer.ts`;
- `src/runtime/operator-summary-writer.ts`;
- `src/runtime/policy/flow-kind-policy.ts`;
- `src/runtime/relay-support.ts`;
- `src/runtime/run-relative-path.ts`;
- `src/runtime/selection-resolver.ts`;
- `src/runtime/write-capable-worker-disclosure.ts`.

These wrappers still exist for old imports and compatibility tests. They are not
deleted.

## Guardrails

`tests/runner/retained-compat-facade.test.ts` now guards against production and
release scripts importing the old helper wrapper paths when the neutral shared
owners should be used.

The same facade test also guards registry and catalog derivation imports so
production code and release scripts keep using `src/flows/**` owner paths rather
than old `src/runtime/registries/**` or `src/runtime/catalog-derivations.ts`
wrappers.

The guard intentionally still allows the wrapper files themselves and explicit
old-path compatibility tests.

## Release Evidence

The write-capable worker capability evidence now points at the neutral shared
owners plus the retained runner that consumes the shared disclosure. It no
longer lists the old runtime wrapper files as implementation evidence.

## Proof

Focused validation:

```bash
npx vitest run tests/runner/retained-compat-facade.test.ts
npx vitest run tests/runner/fresh-run-root.test.ts tests/runner/retained-compat-facade.test.ts
npx vitest run tests/runner/runtime-smoke.test.ts tests/runner/build-checkpoint-exec.test.ts tests/runner/checkpoint-handler-direct.test.ts tests/runner/relay-handler-direct.test.ts tests/runner/fanout-runtime.test.ts tests/runner/sub-run-runtime.test.ts tests/runner/fresh-run-root.test.ts tests/unit/runtime/progress-projector.test.ts tests/unit/runtime/event-log-round-trip.test.ts tests/runner/retained-compat-facade.test.ts
npx vitest run tests/release/release-infrastructure.test.ts tests/runner/operator-summary-writer.test.ts tests/runner/retained-compat-facade.test.ts
npx vitest run tests/runner/retained-compat-facade.test.ts
npm run check-release-infra
```

Additional gates:

```bash
npm run check
npm run lint
```

## Non-Approvals

Phase 5.35 does not approve:

- deleting old runtime helper wrappers;
- changing retained runtime behavior;
- changing manifest snapshot, relay prompt, run-relative path, or operator
  summary semantics;
- changing public `composeWriter`, rollback, arbitrary fixture, custom-root, or
  retained/v1 checkpoint behavior;
- moving retained trace/status/checkpoint implementations;
- old runtime deletion.

## Next

Continue behavior-preserving cleanup or v2/shared oracle twins. Stop for review
before wrapper deletion, public behavior changes, saved-state semantic changes,
or old runtime deletion.
