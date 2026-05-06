# Circuit v2 public compatibility disposition review

You are reviewing the next deletion-adjacent checkpoint for `circuit-next`.

The generated public fresh-run matrix is already routed through `core-v2` by default for the current catalog. The remaining blocker is not ordinary v2 proof. It is public/operator compatibility around these retained-runtime surfaces:

```text
composeWriter
rollback through CIRCUIT_DISABLE_V2_RUNTIME=1
arbitrary external --fixture inputs
custom --flow-root roots, including roots created by circuit-next create
```

Please review the included files and answer whether the next implementation should keep, change, deprecate, or fail closed any of those public surfaces. This review is required before behavior changes. Do not recommend another oracle-test pass unless you find a specific missing proof that affects this disposition.

## Current verified state

### Generated fresh runs

`src/cli/circuit.ts` contains the current `V2_RUNTIME_SUPPORT_MATRIX`. It routes the current generated public fresh-run matrix through `core-v2` by default:

```text
Review default
Fix default/lite/deep/autonomous
Build default/lite/deep/autonomous
Explore default/lite/deep/autonomous/tournament
Migrate default/deep/autonomous
Sweep default/lite/deep/autonomous
```

### `composeWriter`

Current behavior:

```text
main(..., { composeWriter }) remains accepted.
Normal/default routing with composeWriter stays on retained runtime.
Candidate/runtime diagnostics with composeWriter reports retained runtime and the composeWriter reason.
Rollback plus composeWriter stays retained.
Strict v2 plus composeWriter fails closed.
core-v2 has no composeWriter hook.
Release proof uses v2 executor injection, not public composeWriter.
writeComposeReport remains an old public runtime path for now.
```

Relevant code:

```text
src/cli/circuit.ts
src/cli/runtime-compatibility-policy.ts
src/compat/retained-runtime.ts
src/runtime/runner-types.ts
src/runtime/runner.ts
scripts/release/capture-golden-run-proofs.mjs
```

Relevant tests/docs:

```text
tests/runner/cli-v2-runtime.test.ts
tests/soak/v2-runtime-surface.test.ts
tests/release/release-infrastructure.test.ts
tests/runner/fix-report-writer.test.ts
tests/runner/retained-compat-facade.test.ts
docs/architecture/v2-compose-writer-disposition.md
docs/architecture/v2-retained-fallback-policy.md
```

### Rollback

Current behavior:

```text
CIRCUIT_DISABLE_V2_RUNTIME=1 keeps default fresh-run routing on retained runtime.
Strict v2 opt-in still wins over rollback for supported fresh rows.
Diagnostics report rollback as the runtime reason when rollback controls routing.
Rollback also keeps trusted generated plugin mirrors on retained runtime.
```

Relevant code/tests:

```text
src/cli/circuit.ts
src/cli/runtime-compatibility-policy.ts
tests/runner/cli-v2-runtime.test.ts
tests/soak/v2-runtime-surface.test.ts
```

### Arbitrary external fixtures

Current behavior:

```text
Explicit --fixture files outside generated/flows stay retained by default.
Generated-flow fixtures under generated/flows can follow v2 selector policy.
Trusted installed-plugin generated mirrors can follow v2 selector policy only when wrapper provenance matches the actual --flow-root.
Strict v2 remains the explicit experiment lane and fails closed for unsupported shapes.
```

Relevant code/tests:

```text
src/cli/circuit.ts
src/cli/runtime-compatibility-policy.ts
plugins/circuit/scripts/circuit-next.mjs
tests/runner/cli-v2-runtime.test.ts
tests/soak/v2-runtime-surface.test.ts
tests/contracts/codex-host-plugin.test.ts
```

### Custom flow roots

Current behavior:

```text
Custom --flow-root roots stay retained by default.
circuit-next create emits custom --flow-root invocation text.
The Codex/installed plugin wrapper does not set trusted generated mirror provenance for caller-supplied custom roots.
Strict v2 remains an explicit experiment path only.
```

Relevant code/tests:

```text
src/cli/circuit.ts
src/cli/create.ts
plugins/circuit/scripts/circuit-next.mjs
tests/runner/cli-v2-runtime.test.ts
tests/contracts/codex-host-plugin.test.ts
```

### Retained/v1 checkpoint folders

Not the focus of this review, but important as a non-change:

```text
core-v2-marked checkpoint folders resume through core-v2.
Unmarked retained/v1 folders resume through retained compatibility.
Fresh-run flags, rollback, and strict opt-in do not rewrite saved run-folder identity.
```

Relevant boundary files:

```text
src/compat/retained-checkpoint-folders.ts
docs/architecture/v2-retained-runtime-boundary.md
docs/architecture/v2-deletion-readiness-inventory.md
```

## Prior review result

The Phase 5.49-5.53 review approved the latest behavior-preserving oracle-twin slice and said the autonomous oracle-twin lane is now at diminishing returns. It recommended this public compatibility disposition checkpoint next.

Reported validation for Phase 5.49-5.53 was strong:

```bash
npx vitest run tests/core-v2/fanout-v2.test.ts
npx vitest run tests/core-v2/sub-run-v2.test.ts
npx vitest run tests/core-v2/control-loop-v2.test.ts
npx vitest run tests/runner/fanout-handler-direct.test.ts
npx vitest run tests/runner/sub-run-handler-direct.test.ts
npx vitest run tests/runner/relay-handler-direct.test.ts
npm run check
npm run lint
npm run build
npm run verify
git diff --check
```

## Review questions

Please answer directly and cite files/lines from the packet.

1. Are there any blocking correctness findings in the current public compatibility policy implementation?

2. What should happen to public `main(..., { composeWriter })` now?
   Choose one:
   - keep retained-only compatibility;
   - deprecate with warning and release plan;
   - remove/fail closed;
   - add a v2-native replacement.

3. What should happen to rollback through `CIRCUIT_DISABLE_V2_RUNTIME=1` now?
   Choose one:
   - keep while retained runtime is bundled;
   - convert to a legacy compatibility package switch;
   - deprecate/remove with release notes;
   - replace with documented “pin previous version” guidance.

4. What should happen to arbitrary external `--fixture` inputs now?
   Choose one:
   - keep retained by default;
   - define and implement a v2 support contract;
   - deprecate/fail closed;
   - route through v2 by default.

5. What should happen to custom `--flow-root` roots, including roots created by `circuit-next create`?
   Choose one:
   - keep retained by default;
   - define and implement a v2 support contract;
   - deprecate/fail closed;
   - route through v2 by default.

6. If any behavior change is approved, what release notes, warnings, tests, or migration path are required before implementation?

7. If the safest decision is to preserve current behavior, what is the next highest-leverage implementation slice?
   Examples:
   - centralize policy code further;
   - add missing tests;
   - shrink retained compatibility behind a smaller module;
   - prepare old public import-path retirement review;
   - proceed to final deletion-readiness planning.

8. Which exact files should be changed in the next implementation slice?

9. What validation commands are required?

10. Does the next implementation require another review after it lands, or can it proceed with normal tests if it follows your approved scope?

## Guardrails

Do not approve any of these unless you explicitly call it out as a behavior change and give a release/test plan:

```text
deprecating/removing composeWriter
adding a v2 composeWriter hook
changing strict-v2 plus composeWriter fail-closed behavior
removing or weakening rollback
routing arbitrary fixtures through v2 by default
routing custom flow roots through v2 by default
failing closed arbitrary fixtures or custom roots
changing retained/v1 checkpoint folder behavior
deleting old runtime wrappers
deleting retained runner/handler oracle tests
starting old runtime deletion
```

## Desired output shape

Please return:

1. Executive verdict.
2. Blocking findings, if any.
3. Disposition table for `composeWriter`, rollback, arbitrary fixtures, and custom roots.
4. Exact next implementation checkpoint.
5. Review requirement for that checkpoint.
6. Updated old-runtime deletion status.

