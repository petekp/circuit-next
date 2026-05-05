# Circuit v2 Runner And Handler Test Classification

Phase 4.33 classified old runner and direct handler tests before any checkpoint
resume implementation, retained-resume shrink, or old runtime deletion.
Phase 4.39 refreshes the same map after Phase 4.37 extracted retained
checkpoint resume preparation into `src/runtime/checkpoint-resume.ts` and
Phase 4.38 recommended stopping further runner shrinkage for now.
Phase 4.41 adds a focused helper test for the extracted terminal verdict rule.

No code moves are approved by this document.

## Classification Labels

| Label | Meaning |
|---|---|
| retained product fallback | Tests behavior that the product still routes through retained runtime. Keep until policy changes. |
| checkpoint-resume product coverage | Tests checkpoint waiting/resume behavior. Keep until v2 owns checkpoint pause/resume or retained resume is narrowed with equivalent proof. |
| old-runtime oracle | Tests behavior that v2 has some coverage for, but where the retained runtime remains the comparison oracle or fallback path. |
| migrate to v2 later | Useful behavior to express through core-v2 tests once the target owner is ready. Do not delete yet. |
| compatibility import | Imports old runtime type/helper surfaces but does not primarily test old execution. Migrate imports only when the old surface is intentionally retired. |
| delete only after obsolete | No current file is in this bucket. |

## Direct Checkpoint Resume Coverage

| Test | Classification | Why keep |
|---|---|---|
| `tests/runner/build-checkpoint-exec.test.ts` | checkpoint-resume product coverage | Covers deep checkpoint waiting, operator resume, invalid choices, manifest/trace identity rejection, missing/tampered brief, request hash tampering, original selection/config restoration, original project root restoration, post-checkpoint relay, and post-checkpoint verification. |
| `tests/runner/explore-tournament-runtime.test.ts` | checkpoint-resume product coverage | Covers Explore tournament retained checkpoint behavior and resume paths. |
| `tests/runner/cli-v2-runtime.test.ts` | retained product fallback | Proves default selector keeps checkpoint resume and checkpoint-waiting modes on retained runtime. |
| `tests/runner/run-status-projection.test.ts` | checkpoint-resume product coverage | Proves `runs show` projects waiting checkpoints and validates malformed checkpoint request/report state. |

Decision: these tests are non-negotiable until checkpoint resume ownership
changes. They are the main proof that retained checkpoint behavior is still
safe.

## Direct Handler Tests

| Test | Handler | Classification | Why keep |
|---|---|---|---|
| `tests/runner/checkpoint-handler-direct.test.ts` | checkpoint | checkpoint-resume product coverage | Tests checkpoint resolution lattice, operator resume branch, error handling, and trace sequence invariants below the runner. |
| `tests/runner/relay-handler-direct.test.ts` | relay | old-runtime oracle | Tests retained relay handler verdict mapping, connector failures, and trace sequence invariants. |
| `tests/runner/verification-handler-direct.test.ts` | verification | old-runtime oracle | Tests retained verification error paths and trace sequence invariants. |
| `tests/runner/sub-run-handler-direct.test.ts` | sub-run | old-runtime oracle | Tests retained sub-run pre-execution aborts, child execution failures, verdict evaluation, and trace behavior. |
| `tests/runner/fanout-handler-direct.test.ts` | fanout | old-runtime oracle | Tests retained fanout pre-execution aborts, branch failures, join policies, and trace sequence invariants. |
| `tests/properties/visible/fanout-join-policy.test.ts` | fanout helper | old-runtime oracle | Tests join-policy behavior that both retained and v2 fanout paths should respect. |

Decision: do not delete direct handler tests yet. They are still the clearest
low-level proof for retained fallback and for behaviors v2 must preserve.

## Retained Runner Control-Loop Tests

| Test | Classification | Why keep |
|---|---|---|
| `tests/runner/runtime-smoke.test.ts` | retained product fallback | Proves retained `runCompiledFlow` can still bootstrap, execute, and close. |
| `tests/runner/fresh-run-root.test.ts` | retained product fallback | Proves fresh run-folder claim and reuse behavior. |
| `tests/runner/handler-throw-recovery.test.ts` | retained product fallback | Proves handler throws become clean abort/result state instead of corrupting run folders. |
| `tests/runner/pass-route-cycle-guard.test.ts` | retained product fallback | Proves retained route-cycle abort behavior. |
| `tests/runner/push-sequence-authority.test.ts` | retained product fallback | Proves retained push sequencing is the trace sequence authority. |
| `tests/runner/terminal-outcome-mapping.test.ts` | retained product fallback | Proves terminal route mapping for retained runs. |
| `tests/runner/terminal-verdict-derivation.test.ts` | retained product fallback | Proves retained result verdict derivation. |
| `tests/runner/terminal-verdict-helper.test.ts` | retained product fallback | Proves the pure terminal admitted verdict helper now called by the retained close tail. |
| `tests/runner/check-evaluation.test.ts` | retained product fallback | Proves retained check evaluation and route behavior through the full runner loop. |
| `tests/runner/relay-invocation-failure.test.ts` | retained product fallback | Proves retained relay invocation failures close safely. |
| `tests/runner/run-relative-path.test.ts` | retained product fallback | Proves retained runner rejects unsafe run-relative reads/writes. |

Decision: keep until unsupported modes, rollback, arbitrary fixtures,
`composeWriter`, and checkpoint resume either move to v2 or are intentionally
kept behind a smaller retained module.

## Flow Runtime Wiring Tests

| Test | Classification | Why keep |
|---|---|---|
| `tests/runner/review-runtime-wiring.test.ts` | old-runtime oracle | Retained Review execution remains a comparison oracle for generated Review behavior. |
| `tests/runner/fix-runtime-wiring.test.ts` | old-runtime oracle | Retained Fix lite/default wiring remains fallback/oracle coverage. |
| `tests/runner/build-runtime-wiring.test.ts` | checkpoint-resume product coverage | Build wiring includes checkpoint-depth policy, entry-mode depth behavior, and retained checkpoint behavior. |
| `tests/runner/build-report-writer.test.ts` | old-runtime oracle | Proves retained Build report writer integration. |
| `tests/runner/build-verification-exec.test.ts` | old-runtime oracle | Proves retained verification execution and project-root safety behavior. |
| `tests/runner/explore-report-writer.test.ts` | old-runtime oracle | Proves retained Explore report writer integration. |
| `tests/runner/explore-e2e-parity.test.ts` | old-runtime oracle | Proves retained Explore connector/report behavior and smoke fingerprints. |
| `tests/runner/migrate-runtime-wiring.test.ts` | old-runtime oracle | Proves retained Migrate full flow behavior. |
| `tests/runner/sweep-runtime-wiring.test.ts` | old-runtime oracle | Proves retained Sweep full flow behavior. |
| `tests/runner/fix-report-writer.test.ts` | compatibility import | Uses retained compose writer helper directly; not a runner deletion blocker by itself. |

Decision: these are not deletion candidates. Some can gain v2 equivalents over
time, but old tests remain useful while retained fallback is product policy.

## Sub-Run And Fanout Retained Runtime Tests

| Test | Classification | Why keep |
|---|---|---|
| `tests/runner/sub-run-runtime.test.ts` | old-runtime oracle | Proves retained sub-run execution through old runner. |
| `tests/runner/sub-run-real-recursion.test.ts` | old-runtime oracle | Proves retained real recursive child execution. |
| `tests/runner/fanout-runtime.test.ts` | old-runtime oracle | Proves retained fanout execution through old runner. |
| `tests/runner/fanout-real-recursion.test.ts` | old-runtime oracle | Proves retained fanout branches can recurse through real `runCompiledFlow`. |

Decision: keep until v2 sub-run/fanout behavior is considered the sole owner
for supported paths and retained fallback policy is narrowed.

## Registry, Materializer, And Connector-Adjacent Tests

| Test | Classification | Why keep |
|---|---|---|
| `tests/runner/materializer-schema-parse.test.ts` | retained product fallback | Exercises relay materialization through retained runner; materializer remains production safety infrastructure. |
| `tests/runner/agent-relay-roundtrip.test.ts` | retained product fallback | Uses retained bootstrap/append helpers for relay roundtrip proof. |
| `tests/runner/codex-relay-roundtrip.test.ts` | retained product fallback | Uses retained bootstrap/append helpers and fingerprints `src/runtime/runner.ts`. |
| `tests/runner/runner-relay-provenance.test.ts` | retained product fallback | Proves retained relay provenance through `runCompiledFlow`. |
| `tests/runner/runner-relay-connector-identity.test.ts` | retained product fallback | Proves retained connector identity plumbing through `runCompiledFlow`. |
| `tests/runner/compose-builder-registry.test.ts` | old-runtime oracle | Proves registry writer integration through retained runner. |
| `tests/runner/close-builder-registry.test.ts` | old-runtime oracle | Proves close writer registry integration through retained runner. |

Decision: do not use these as a reason to move connector subprocess modules or
registries. They prove those boundaries remain live.

## Compatibility Import Tests

These tests import `RelayFn`, `RelayInput`, `ComposeWriterFn`, or helper exports
from `src/runtime/runner.ts`, but they are not primarily old execution tests:

```text
tests/contracts/codex-host-plugin.test.ts
tests/contracts/flow-model-effort.test.ts
tests/contracts/orphan-blocks.test.ts
tests/runner/cli-router.test.ts
tests/runner/config-loader.test.ts
tests/runner/cli-v2-runtime.test.ts
```

Decision: migrate imports to neutral type/helper modules only when the old
runtime compatibility surface is intentionally retired. Do not combine that
with checkpoint resume or handler moves.

## Trace And Snapshot Tests

| Test | Classification | Why keep |
|---|---|---|
| `tests/unit/runtime/event-log-round-trip.test.ts` | retained product fallback | Proves v1 trace append/read/reduce/snapshot behavior. Required while checkpoint resume uses v1 trace/state. |
| `tests/unit/runtime/progress-projector.test.ts` | retained product fallback | Proves retained trace-to-progress projection. Required while retained runtime can emit progress. |

Decision: these tests block moving trace reader/writer, reducer, snapshot
writer, append-and-derive, or progress projector without a separate ownership
plan.

## Migration Candidates

Useful future v2 test targets:

- checkpoint waiting and resume parity, if Option A is selected later;
- retained route-cycle and terminal-outcome behavior, if old fallback narrows;
- relay provenance and connector identity, if retained relay behavior narrows;
- direct handler invariants that become v2 executor invariants.

Not migration candidates yet:

- checkpoint resume tests;
- trace/snapshot round-trip tests;
- progress projector tests;
- connector subprocess/materializer tests;
- registry integration tests.

Those still prove retained product behavior.

## Recommended Next Action

Do not delete old runner or handler tests.

Do not move old runner or handler code.

The earlier next-step options have now landed:

- Phase 4.34 produced a current-only old runner/handler import inventory.
- Phase 4.35 classified retained progress projection ownership.
- Phase 4.37 extracted retained checkpoint resume preparation behind
  `src/runtime/checkpoint-resume.ts`.
- Phase 4.38 mapped the remaining runner boundary and recommended stopping
  runner shrinkage for now.
- Phase 4.41 extracted only pure terminal verdict derivation to
  `src/runtime/terminal-verdict.ts`; close/result finalization remains in
  `src/runtime/runner.ts`.

Current recommendation: keep these tests as live product and oracle evidence.
Any future close/result finalization move still needs focused review first. Do
not start by deleting or migrating tests.
