# Circuit v2 Runner And Handler Current Import Inventory

Phase 4.34 records current-only import evidence for old runner and handler
files. It excludes historical inventory output so future review can see the
live dependency graph without sorting through older scan blocks.

No code moved in this phase.

## Commands

```bash
rg -n "from ['\"].*(runtime/runner|runtime/step-handlers)|from ['\"].*src/runtime/runner|from ['\"].*src/runtime/step-handlers" \
  README.md commands plugins .claude-plugin generated docs specs scripts src tests package.json \
  -g "!docs/architecture/v2-runtime-import-inventory.md" \
  -g "!docs/architecture/v2-runner-handler-current-import-inventory.md"
```

```bash
rg -l "from ['\"].*(runtime/runner|runtime/step-handlers)|from ['\"].*src/runtime/runner|from ['\"].*src/runtime/step-handlers|runCompiledFlow|resumeCompiledFlowCheckpoint|runCheckpointStep|runRelayStep|runVerificationStep|runSubRunStep|runFanoutStep" \
  README.md commands plugins .claude-plugin generated docs specs scripts src tests package.json \
  -g "!docs/architecture/v2-runtime-import-inventory.md" \
  -g "!docs/architecture/v2-runner-handler-current-import-inventory.md" | sort
```

## Product Source Imports

| File | Current dependency | Classification |
|---|---|---|
| `src/cli/circuit.ts` | imports `runCompiledFlow` and `resumeCompiledFlowCheckpoint` from `src/runtime/runner.ts` | retained product fallback and checkpoint resume |
| `src/runtime/runner.ts` | imports retained handler dispatcher, trace append/read, reducer snapshot writer, progress projector, result writer, registries | retained execution owner |
| `src/runtime/step-handlers/index.ts` | imports all retained handler implementations | retained handler dispatcher |
| `src/runtime/step-handlers/*.ts` | import `StepHandlerContext`, `StepHandlerResult`, helper types | retained handler cluster |
| `src/runtime/runner-types.ts` | exposes retained invocation/result types plus compatibility relay/progress types | retained type surface |

Decision: these are live product dependencies. Do not delete or move them as
cleanup.

## Release Script Imports

| File | Current dependency | Classification |
|---|---|---|
| `scripts/release/capture-golden-run-proofs.mjs` | imports `writeComposeReport` from `dist/runtime/runner.js` | release evidence compatibility |

Decision: retain or update deliberately if `writeComposeReport` moves. Do not
break release evidence during runner shrink work.

## Direct Handler Test Imports

| File | Current dependency | Classification |
|---|---|---|
| `tests/runner/checkpoint-handler-direct.test.ts` | `runCheckpointStep`, `RunState`, `StepHandlerContext` | checkpoint-resume product coverage |
| `tests/runner/relay-handler-direct.test.ts` | `runRelayStep`, `RunState`, `StepHandlerContext` | old-runtime oracle |
| `tests/runner/verification-handler-direct.test.ts` | `runVerificationStep`, `RunState`, `StepHandlerContext` | old-runtime oracle |
| `tests/runner/sub-run-handler-direct.test.ts` | `runSubRunStep`, `RunState`, `StepHandlerContext` | old-runtime oracle |
| `tests/runner/fanout-handler-direct.test.ts` | `runFanoutStep`, `RunState`, `StepHandlerContext`, runner helper types | old-runtime oracle |
| `tests/properties/visible/fanout-join-policy.test.ts` | fanout join policy helper | old-runtime oracle shared with v2 behavior |
| `tests/helpers/failure-message.ts` and `.test.ts` | `StepHandlerResult` type | compatibility import |

Decision: no direct handler test is deletion-ready.

## Runner Test Imports

These current files import `runCompiledFlow`, `resumeCompiledFlowCheckpoint`,
`bootstrapRun`, `appendAndDerive`, `initRunFolder`, `writeComposeReport`,
`writePrototypeComposeReport`, or old runtime relay/compose types.

```text
tests/contracts/codex-host-plugin.test.ts
tests/contracts/flow-model-effort.test.ts
tests/contracts/orphan-blocks.test.ts
tests/runner/agent-relay-roundtrip.test.ts
tests/runner/build-checkpoint-exec.test.ts
tests/runner/build-report-writer.test.ts
tests/runner/build-runtime-wiring.test.ts
tests/runner/build-verification-exec.test.ts
tests/runner/check-evaluation.test.ts
tests/runner/cli-router.test.ts
tests/runner/cli-v2-runtime.test.ts
tests/runner/close-builder-registry.test.ts
tests/runner/codex-relay-roundtrip.test.ts
tests/runner/compose-builder-registry.test.ts
tests/runner/config-loader.test.ts
tests/runner/explore-e2e-parity.test.ts
tests/runner/explore-report-writer.test.ts
tests/runner/explore-tournament-runtime.test.ts
tests/runner/fanout-real-recursion.test.ts
tests/runner/fanout-runtime.test.ts
tests/runner/fix-report-writer.test.ts
tests/runner/fix-runtime-wiring.test.ts
tests/runner/fresh-run-root.test.ts
tests/runner/handler-throw-recovery.test.ts
tests/runner/materializer-schema-parse.test.ts
tests/runner/migrate-runtime-wiring.test.ts
tests/runner/pass-route-cycle-guard.test.ts
tests/runner/push-sequence-authority.test.ts
tests/runner/relay-invocation-failure.test.ts
tests/runner/review-runtime-wiring.test.ts
tests/runner/run-relative-path.test.ts
tests/runner/runner-relay-connector-identity.test.ts
tests/runner/runner-relay-provenance.test.ts
tests/runner/runtime-smoke.test.ts
tests/runner/sub-run-real-recursion.test.ts
tests/runner/sub-run-runtime.test.ts
tests/runner/sweep-runtime-wiring.test.ts
tests/runner/terminal-outcome-mapping.test.ts
tests/runner/terminal-verdict-derivation.test.ts
tests/unit/runtime/event-log-round-trip.test.ts
```

Decision: these files are live evidence. Use
`docs/architecture/v2-runner-handler-test-classification.md` for exact
disposition before changing any import.

## Documentation References

Current docs still reference old runner and handler surfaces in architecture
history and migration planning:

```text
docs/architecture/v2-checkpoint-4.md
docs/architecture/v2-checkpoint-4.1.1.md
docs/architecture/v2-checkpoint-4.2.md
docs/architecture/v2-checkpoint-4.8.md
docs/architecture/v2-checkpoint-resume-ownership-plan.md
docs/architecture/v2-deletion-plan.md
docs/architecture/v2-phase-4-notes.md
docs/architecture/v2-runner-handler-test-classification.md
docs/architecture/v2-worklog.md
```

Decision: historical references are not product imports, but deletion review
must update or intentionally retain them.

## Current Disposition

| Surface | Disposition |
|---|---|
| `src/runtime/runner.ts` | retain product fallback and checkpoint resume |
| `src/runtime/runner-types.ts` | retain compatibility and retained invocation/result types |
| `src/runtime/step-handlers/checkpoint.ts` | retain checkpoint pause/resume behavior |
| `src/runtime/step-handlers/compose.ts` | retain fallback and `composeWriter` behavior |
| `src/runtime/step-handlers/relay.ts` | retain fallback, connector bridge, and oracle coverage |
| `src/runtime/step-handlers/verification.ts` | retain fallback and oracle coverage |
| `src/runtime/step-handlers/sub-run.ts` | retain fallback and oracle coverage |
| `src/runtime/step-handlers/fanout.ts` and helpers | retain fallback and oracle coverage |
| `src/runtime/step-handlers/index.ts` | retain handler dispatcher |
| `src/runtime/step-handlers/types.ts` | retain until handler cluster shrinks or moves |
| `src/runtime/step-handlers/shared.ts` | retain until handler cluster shrinks or moves |
| `src/runtime/step-handlers/recovery-route.ts` | retain route recovery behavior |

No old runner or handler file is deletion-ready.

## Recommended Next Action

Do not move code yet.

The next useful planning slice is retained progress contract classification:

```text
Should src/runtime/progress-projector.ts remain retained-only,
move behind a neutral v1 progress facade,
or wait until checkpoint resume ownership changes?
```

That decision is lower risk than moving checkpoint resume, and it can be made
without changing runtime behavior.
