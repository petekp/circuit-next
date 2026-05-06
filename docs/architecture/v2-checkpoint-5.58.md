# Core-v2 Checkpoint 5.58: Soft Deprecation Metadata

Date: 2026-05-06

## Summary

Phase 5.58 adds soft-deprecation metadata for the first approved low-risk old
`src/runtime/**` import paths.

This is not removal. The old paths still work, the wrapper files remain in
place, and no import-time warnings are emitted.

## What Changed

`src/compat/public-runtime-paths.ts` now records a `deprecationStage` for every
old runtime path:

- `soft-deprecated` for the approved shared-helper and flow-authoring wrapper
  paths;
- `none` for connector, registry, run-status, result-writer, public runner,
  retained handler, retained trace, retained checkpoint, and saved-state paths.

`tests/runner/public-runtime-paths.test.ts` proves:

- the exact approved soft-deprecated path list;
- every soft-deprecated path has a replacement owner and compatibility tests;
- sensitive categories stay non-deprecated;
- soft-deprecated wrappers do not add import-time warning scaffolding;
- package/build visibility assumptions remain unchanged;
- the policy note lists every soft-deprecated path and replacement owner.

`docs/architecture/v2-public-runtime-import-path-policy.md` records the public
import-path policy and includes draft release-note wording.

## Soft-Deprecated Scope

Only these categories entered soft deprecation:

- shared-helper wrappers with neutral `src/shared/**` owners;
- flow-authoring wrappers with neutral `src/flows/**` owners.

No connector, registry, run-status, result-writer, public runner, retained
handler, retained trace, retained checkpoint, or saved-state path entered soft
deprecation.

## Proof

```bash
npx vitest run tests/runner/public-runtime-paths.test.ts
npx vitest run tests/runner/retained-compat-facade.test.ts
npx vitest run tests/runner/shared-helper-compat.test.ts
npx vitest run tests/runner/catalog-derivations.test.ts
npx vitest run tests/runner/connector-shared-compat.test.ts
npx vitest run tests/runner/run-status-facade.test.ts
npx vitest run tests/runner/result-path-compat.test.ts
npx vitest run tests/runner/fanout-aggregate-compat.test.ts
npx vitest run tests/runner/json-report-compat.test.ts
npx vitest run tests/runner/recovery-route-compat.test.ts
npx vitest run tests/runner/terminal-verdict-helper.test.ts
npx vitest run tests/properties/visible/fanout-join-policy.test.ts
npm run check
npm run lint
npm run build
npx vitest run tests/runner/public-runtime-paths.test.ts
npm run verify
git diff --check
```

Passed.

## Non-Approvals

Phase 5.58 does not approve:

- deleting old `src/runtime/**` wrappers;
- retiring old public import paths;
- changing package exports;
- adding import-time or runtime deprecation warnings;
- soft-deprecating connector, registry, run-status, result-writer, public
  runner, retained handler, retained trace, retained checkpoint, or saved-state
  paths;
- changing `composeWriter`;
- changing rollback;
- routing arbitrary fixtures or custom roots through v2 by default;
- changing retained/v1 checkpoint folder behavior;
- moving retained trace/reducer/snapshot/progress/checkpoint implementations;
- deleting retained runner/handler oracle tests;
- old runtime deletion.

## Next

Continue only with behavior-preserving compatibility packaging or proof work.
Review is required before any wrapper deletion, old import-path retirement,
package export change, import-time warning, broader deprecation category,
public compatibility behavior change, saved-folder policy change, or old
runtime deletion.
