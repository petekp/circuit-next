# Review Request: Phase 5.33 Router And Compiler Neutral Ownership

We need a focused architecture review before moving the next high-risk shared infrastructure boundary in `circuit-next`.

## Current State

Generated public fresh runs are already core-v2-owned for the current catalog. Recent phases moved several old-runtime-adjacent infrastructure surfaces out of `src/runtime/**` while preserving compatibility re-exports:

- Phase 5.13 moved registries and catalog derivations to `src/flows/**`.
- Phase 5.21 split retained/v1 checkpoint folder support behind `src/compat/retained-checkpoint-folders.ts`.
- Phase 5.27 formalized public `composeWriter` as retained-runtime-only compatibility.
- Phase 5.32 moved connector subprocess modules and relay materialization to neutral `src/connectors/**`, leaving old `src/runtime/connectors/**` wrappers.

Remaining deletion blockers still include public compatibility behavior, retained/v1 folders, old runner/handler oracle tests, retained trace/progress/checkpoint/status behavior, router/compiler ownership, and old compatibility wrappers.

This review is only about router/compiler ownership. It is not asking for public behavior changes or old runtime deletion.

## Proposed Next Slice

Make a behavior-preserving neutral ownership move:

```text
src/runtime/router.ts
  -> src/flows/router.ts
  -> old src/runtime/router.ts becomes compatibility re-export

src/runtime/compile-schematic-to-flow.ts
  -> src/flows/compile-schematic-to-flow.ts
  -> old src/runtime/compile-schematic-to-flow.ts becomes compatibility re-export
```

Keep `src/flows/catalog-derivations.ts` as the already-neutral catalog derivation owner.

Update production imports to neutral paths:

- `src/cli/circuit.ts` should import router from `src/flows/router.ts`.
- `scripts/emit-flows.mjs` should load `dist/flows/compile-schematic-to-flow.js`.
- `scripts/release/lib.mjs` should load `dist/flows/router.js`.
- release capability evidence paths should point to neutral files, with old paths preserved only where compatibility is being asserted.

Update tests:

- primary router/compiler tests import neutral paths;
- add explicit old-path compatibility proof for `src/runtime/router.ts` and `src/runtime/compile-schematic-to-flow.ts`;
- add import guard preventing core-v2/CLI/scripts from adding new direct `src/runtime/router` or `src/runtime/compile-schematic-to-flow` imports where neutral paths should be used;
- generated surface drift and release public-claim checks remain green.

## Non-Goals

Do not change:

- routing behavior or classifier signals;
- generated flow JSON shape;
- `circuit-next run` selector behavior;
- public compatibility policy for `composeWriter`, rollback, arbitrary fixtures, or custom roots;
- retained/v1 checkpoint folder behavior;
- connector/materializer behavior;
- old runtime deletion status;
- old oracle test retention.

Do not delete the old runtime router/compiler paths in this slice.

## Files Included

Key source:

```text
src/runtime/router.ts
src/runtime/compile-schematic-to-flow.ts
src/runtime/catalog-derivations.ts
src/flows/catalog-derivations.ts
src/flows/catalog.ts
src/flows/types.ts
src/cli/circuit.ts
scripts/emit-flows.mjs
scripts/release/lib.mjs
scripts/release/emit-current-capabilities.mjs
```

Key tests:

```text
tests/contracts/flow-router.test.ts
tests/runner/router-routing-invariants.test.ts
tests/properties/visible/flow-router-tiebreak.test.ts
tests/contracts/compile-schematic-to-flow.test.ts
tests/contracts/orphan-blocks.test.ts
tests/unit/compile-schematic-per-mode.test.ts
tests/runner/catalog-derivations.test.ts
tests/runner/retained-compat-facade.test.ts
tests/unit/emit-flows-drift.test.ts
tests/release/release-infrastructure.test.ts
```

Context docs:

```text
HANDOFF.md
docs/architecture/v2-deletion-readiness-inventory.md
docs/architecture/v2-deletion-plan.md
docs/architecture/v2-heavy-boundary-plan.md
docs/architecture/v2-registry-ownership-plan.md
docs/architecture/v2-checkpoint-5.32.md
docs/contracts/connector.md
docs/contracts/selection.md
```

## Review Questions

1. Is this behavior-preserving router/compiler ownership move approved?
2. Are `src/flows/router.ts` and `src/flows/compile-schematic-to-flow.ts` the right neutral homes, or should the move use a different namespace?
3. Are old `src/runtime/router.ts` and `src/runtime/compile-schematic-to-flow.ts` compatibility re-exports the right public compatibility posture?
4. What exact tests or guards must be added before/with the move?
5. Should release evidence paths move to neutral files now, and should old runtime paths remain in any release/public-claim evidence?
6. Does this slice require any product/release note? My assumption: no, because old import paths remain and behavior is unchanged.
7. What must not be changed in the implementation?
8. If approved, what is the next highest-leverage checkpoint after this move?

Please answer with blocking findings first. If approved, provide a concise implementation checklist and validation command list.
