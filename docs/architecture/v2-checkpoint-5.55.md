# Core-v2 Checkpoint 5.55: Public Runtime Path Manifest

Date: 2026-05-06

## Summary

Phase 5.55 adds a machine-checkable manifest for old `src/runtime/**` import
paths without deleting, deprecating, or changing any public behavior.

The manifest makes the current compatibility surface explicit. It distinguishes
tiny wrapper paths from retained-owned implementation paths so later deletion
reviews can talk about exact files instead of hand-built lists.

## What Changed

`src/compat/public-runtime-paths.ts` now records every `src/runtime/**/*.ts`
file with:

- old path;
- category;
- current owner path when the file is a wrapper;
- current disposition;
- compatibility test paths;
- `requiresReviewBeforeDeletion: true`.

`tests/runner/public-runtime-paths.test.ts` proves:

- the manifest covers every `src/runtime/**/*.ts` file;
- every manifest old path exists;
- every wrapper path re-exports its declared owner;
- retained-owned files are not presented as wrapper retirement candidates;
- wrapper categories are explicit;
- build/package visibility assumptions remain explicit;
- production import guards are wired to the manifest.

`tests/runner/retained-compat-facade.test.ts` now uses the manifest for the
connector, flow-authoring, registry, and shared-helper wrapper guard allowlists.

## Proof

```bash
npx vitest run tests/runner/public-runtime-paths.test.ts tests/runner/retained-compat-facade.test.ts
npx vitest run tests/runner/shared-helper-compat.test.ts tests/runner/connector-shared-compat.test.ts tests/runner/catalog-derivations.test.ts tests/runner/run-status-facade.test.ts
npx vitest run tests/runner/fanout-aggregate-compat.test.ts tests/runner/json-report-compat.test.ts tests/runner/recovery-route-compat.test.ts tests/runner/terminal-verdict-helper.test.ts tests/properties/visible/fanout-join-policy.test.ts tests/runner/fix-report-writer.test.ts
npm run check
npm run lint
npm run build
npm run verify
git diff --check
```

Passed.

## Non-Approvals

Phase 5.55 does not approve:

- deleting old `src/runtime/**` wrappers;
- retiring old public import paths;
- changing package exports;
- adding deprecation warnings;
- removing old-path compatibility tests;
- changing `composeWriter`;
- changing rollback;
- routing arbitrary fixtures or custom roots through v2 by default;
- changing retained/v1 checkpoint folder behavior;
- moving retained trace/reducer/snapshot/progress/checkpoint implementations;
- deleting retained runner/handler oracle tests;
- old runtime deletion.

## Next

The next review-worthy checkpoint can use the manifest to decide whether a
first category of old wrapper paths should get a staged deprecation plan. If no
behavior/import-path retirement is being changed, continue autonomously with
guard consolidation and retained compatibility packaging work.
