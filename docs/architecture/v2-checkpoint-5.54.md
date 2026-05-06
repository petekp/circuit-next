# Core-v2 Checkpoint 5.54: Runtime Compatibility Policy Centralization

Date: 2026-05-06

## Summary

Phase 5.54 centralizes the live public compatibility routing helpers in
`src/cli/runtime-compatibility-policy.ts`.

This is behavior-preserving. `composeWriter`, rollback, arbitrary explicit
fixtures, custom flow roots, trusted generated mirrors, strict v2 opt-in, and
runtime diagnostics keep the same routing semantics.

## What Changed

`src/cli/runtime-compatibility-policy.ts` now owns the policy helpers that were
previously private to `src/cli/circuit.ts`:

- fixture/custom-root v2 eligibility;
- retained fallback for arbitrary fixtures and custom roots;
- retained fallback for programmatic `composeWriter`;
- strict v2 fail-closed assertions;
- rollback override decisions;
- runtime diagnostics output fields;
- runtime environment switch readers.

`src/cli/circuit.ts` now imports those helpers instead of defining them inline.

`tests/runner/runtime-compatibility-policy.test.ts` adds direct policy-level
coverage for those helpers. `tests/runner/cli-v2-runtime.test.ts` adds the
missing three-way regression for strict v2 plus rollback plus `composeWriter`,
which must fail closed for the `composeWriter` reason.

## Proof

```bash
npx vitest run tests/runner/runtime-compatibility-policy.test.ts tests/runner/cli-v2-runtime.test.ts
npx vitest run tests/soak/v2-runtime-surface.test.ts
npx vitest run tests/contracts/codex-host-plugin.test.ts tests/release/release-infrastructure.test.ts tests/runner/fix-report-writer.test.ts tests/runner/retained-compat-facade.test.ts
npm run check
npm run lint
npm run build
npm run verify
git diff --check
```

Passed.

## Non-Approvals

Phase 5.54 does not approve:

- deprecating or removing `composeWriter`;
- adding a v2 `composeWriter` hook;
- changing strict-v2 plus `composeWriter` fail-closed behavior;
- removing or weakening rollback;
- routing arbitrary fixtures through v2 by default;
- routing custom flow roots through v2 by default;
- failing closed arbitrary fixtures or custom roots;
- changing retained/v1 checkpoint folder behavior;
- deleting old runtime wrappers;
- deleting retained runner/handler oracle tests;
- old runtime deletion.

## Next

The next meaningful review checkpoint should be old public import-path/wrapper
retirement or retained compatibility packaging. Do not stop for more oracle-only
review packets unless a specific behavior gap is found.
