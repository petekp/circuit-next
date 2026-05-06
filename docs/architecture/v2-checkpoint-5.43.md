# Core-v2 Checkpoint 5.43: Fanout Branch Template Shared Helper

Date: 2026-05-06

## Summary

Phase 5.43 moves pure fanout branch-template helpers to neutral shared
ownership.

No behavior changed. Retained fanout branch resolution and core-v2 fanout branch
expansion still own their own branch output shapes. They now share only the
dotted-path lookup and `$item` template substitution helpers.

## What Changed

`src/shared/fanout-branch-template.ts` now owns:

- `resolveDottedPath(...)`;
- `substituteItemPlaceholders(...)`;
- `expandTemplate(...)`.

Retained fanout branch resolution and core-v2 fanout branch expansion import
those helpers from the shared module.

`tests/runner/fanout-branch-template.test.ts` pins the shared helper behavior
for dotted-path failures, exact placeholder substitution, inline placeholder
substitution, and nested template expansion.

## Proof

```bash
npm run check
npm run lint
npm run build
npx vitest run tests/runner/fanout-branch-template.test.ts tests/runner/fanout-handler-direct.test.ts tests/runner/fanout-runtime.test.ts tests/core-v2/fanout-v2.test.ts
npm run verify
git diff --check
```

Passed.

## Non-Approvals

Phase 5.43 does not approve:

- changing branch expansion semantics;
- unifying retained and core-v2 branch output types;
- deleting retained fanout branch resolution;
- deleting retained fanout tests;
- old runtime deletion.

## Next

Continue behavior-preserving cleanup or v2/shared oracle twins. Stop for review
only before public behavior changes, saved-state semantic changes, wrapper
deletion, old public import-path retirement, or old runtime deletion.
