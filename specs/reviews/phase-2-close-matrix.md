---
name: phase-2-close-matrix
description: Phase 2 close matrix draft for ADR-0007 CC#P2-8.
type: review
review_kind: phase-close-matrix
target_kind: phase
phase_target: phase-2
phase_version: "authored against HEAD=fb3b4f32521b9791c973bfe8194c21b5f706af84"
review_date: 2026-04-24
phase_close_claim: false
cc_p2_8_state: active — red
codex_close_review: pending
operator_product_check: pending
authored_by: Codex
---

# Phase 2 Close Matrix

This is the CC#P2-8 evidence matrix draft. It is not a Phase 2 close claim:
`phase_close_claim` is `false`, the Codex phase-close review is still pending,
and the operator product-direction note is still pending.

## Close Criteria Rows

| criterion | status | evidence path | passing commit / adr | structural evidence type | notes |
|---|---|---|---|---|---|
| P2-1 | active — red | `tests/runner/explore-e2e-parity.test.ts`; `tests/fixtures/golden/explore/result.sha256`; `tests/fixtures/agent-smoke/last-run.json`; `tests/contracts/explore-artifact-composition.test.ts`; `tests/runner/explore-artifact-writer.test.ts`; `specs/adrs/ADR-0007-phase-2-close-criteria.md` | red diagnosis: reference-Circuit parity proof or authoritative substitute remains pending; Slice 97 Codex HIGH 2 | test-enforced + audit-enforced + operator-approved external live CLI smoke | Explore has the typed close-result writer and refreshed Claude fingerprint, but the current proof is circuit-next local golden self-consistency. It does not yet compare against the corresponding prior-generation Circuit artifact or cite an amendment replacing that requirement. |
| P2-2 | active — satisfied | `src/runtime/adapters/agent.ts`; `src/runtime/adapters/codex.ts`; `tests/runner/agent-dispatch-roundtrip.test.ts`; `tests/runner/codex-dispatch-roundtrip.test.ts`; `tests/fixtures/agent-smoke/last-run.json`; `tests/fixtures/codex-smoke/last-run.json`; `scripts/audit.mjs::checkAgentSmokeFingerprint`; `scripts/audit.mjs::checkCodexSmokeFingerprint` | `fb3b4f32521b9791c973bfe8194c21b5f706af84`; Codex refresh `e2667eb` | test-enforced + audit-enforced + external live CLI smoke | Both live adapter fingerprints match current adapter surfaces. |
| P2-3 | active — red | `.claude-plugin/plugin.json`; `.claude-plugin/commands/circuit-run.md`; `.claude-plugin/commands/circuit-explore.md`; `tests/contracts/plugin-surface.test.ts`; `tests/runner/plugin-command-invocation.test.ts`; `specs/reviews/p2-11-invoke-evidence.md`; `specs/reviews/arc-slice-56-codex.md`; `scripts/audit.mjs::checkPluginCommandClosure` | red diagnosis: live Claude Code slash-handler proof or authoritative rebinding remains pending; Slice 97 Codex HIGH 1 | audit-enforced + contract-tested + operator-local CLI-surrogate evidence | The command surface is wired and CLI-surrogate evidence exists, but ADR-0007 still requires the live Claude Code command path. This row is not counted satisfied until that path is proven or formally rebound. |
| P2-4 | active — satisfied | `.claude/hooks/SessionStart.sh`; `.claude/hooks/SessionEnd.sh`; `.claude/settings.json`; `tests/contracts/session-hooks-present.test.ts`; `tests/runner/session-hook-behavior.test.ts`; `tests/runner/session-hook-lifecycle.test.ts`; `tests/runner/hook-engine-contract.test.ts`; `scripts/audit.mjs::checkSessionHooksPresent` | `d02cb4d`; lifecycle close baseline `eed12fa` | test-enforced + audit-enforced | Satisfied for tracked hook scripts plus portable stub coverage. Live clean-clone engine population remains outside the default verify path. |
| P2-5 | active — satisfied | `src/schemas/selection-policy.ts`; `src/runtime/selection-resolver.ts`; `src/runtime/config-loader.ts`; `src/runtime/adapters/agent.ts`; `src/runtime/adapters/codex.ts`; `tests/contracts/workflow-model-effort.test.ts`; `tests/runner/config-loader.test.ts`; `tests/contracts/slice-42-agent-adapter.test.ts`; `tests/contracts/slice-45-codex-adapter.test.ts`; `specs/reviews/arc-p2-model-effort-composition-review-codex.md` | `a5ccb91`; adapter binding baseline `fc6316a` | test-enforced + audit-enforced + composition-reviewed | User-global and project config files reach dispatch selection, and built-in adapters honor compatible model and effort choices. |
| P2-6 | active — satisfied | `specs/contracts/explore.md`; `.claude-plugin/skills/explore/circuit.json`; `tests/contracts/spine-coverage.test.ts`; `tests/runner/explore-e2e-parity.test.ts`; `scripts/audit.mjs::checkSpineCoverage` | `7bc3543` | test-enforced + audit-enforced | Explore declares and exercises the canonical Frame, Analyze, Synthesize, Review, Close spine. |
| P2-7 | re-deferred | `specs/adrs/ADR-0007-phase-2-close-criteria.md`; `scripts/audit.mjs::checkPhase2SliceIsolationCitation` | ADR-0007 at `specs/adrs/ADR-0007-phase-2-close-criteria.md` | ADR-covered re-deferral + audit-enforced citation discipline | Container isolation is not counted green; it remains re-deferred with ADR-0007 trigger conditions. |

## Product Ratchet Rows

| ratchet | status | evidence path | passing commit | structural evidence type | notes |
|---|---|---|---|---|---|
| runner_smoke_present | green | `tests/runner/dogfood-smoke.test.ts`; `TIER.md` | `fb3b4f32521b9791c973bfe8194c21b5f706af84` | test-enforced + audit-bound TIER evidence | Bound through `checkInheritedProductRatchetBindings`. |
| workflow_fixture_runs | green | `tests/contracts/slice-27d-dogfood-run-0.test.ts`; `tests/runner/explore-e2e-parity.test.ts`; `TIER.md` | `fb3b4f32521b9791c973bfe8194c21b5f706af84` | test-enforced + audit-bound TIER evidence | Dogfood and explore fixture execution evidence are both tracked. |
| event_log_round_trip | green | `tests/contracts/slice-27c-runtime-boundary.test.ts`; `tests/unit/runtime/event-log-round-trip.test.ts`; `TIER.md` | `fb3b4f32521b9791c973bfe8194c21b5f706af84` | test-enforced + audit-bound TIER evidence | Event-log round trip has explicit evidence bindings. |
| snapshot_derived_from_log | green | `tests/unit/runtime/event-log-round-trip.test.ts`; `TIER.md` | `fb3b4f32521b9791c973bfe8194c21b5f706af84` | test-enforced + audit-bound TIER evidence | Snapshot derivation remains reducer-based. |
| manifest_snapshot_byte_match | green | `tests/unit/runtime/event-log-round-trip.test.ts`; `tests/runner/dogfood-smoke.test.ts`; `TIER.md` | `fb3b4f32521b9791c973bfe8194c21b5f706af84` | test-enforced + audit-bound TIER evidence | Manifest byte-match evidence has explicit paths. |
| status_docs_current | green | `scripts/audit.mjs`; `tests/contracts/status-epoch-ratchet-floor.test.ts`; `README.md`; `PROJECT_STATE.md`; `TIER.md` | `fb3b4f32521b9791c973bfe8194c21b5f706af84` | audit-enforced + test-enforced | The matrix row names the last audited baseline; each later slice must keep the status markers current. |
| tier_claims_current | green | `scripts/audit.mjs`; `tests/contracts/governance-reform.test.ts`; `tests/contracts/inherited-ratchet-bindings.test.ts`; `TIER.md` | `fb3b4f32521b9791c973bfe8194c21b5f706af84` | audit-enforced + test-enforced | TIER rows are enforced and inherited ratchet rows are bound to evidence surfaces. |
| dispatch_realness | green | `tests/runner/explore-e2e-parity.test.ts`; `tests/runner/agent-dispatch-roundtrip.test.ts`; `tests/runner/codex-dispatch-roundtrip.test.ts`; `tests/fixtures/agent-smoke/last-run.json`; `tests/fixtures/codex-smoke/last-run.json` | `fb3b4f32521b9791c973bfe8194c21b5f706af84` | test-enforced + external live CLI smoke | The two built-in subprocess adapters have current smoke fingerprints. |
| workflow_parity_fixtures | green | `.claude-plugin/skills/explore/circuit.json`; `tests/runner/explore-e2e-parity.test.ts`; `tests/fixtures/golden/explore/result.sha256`; `tests/contracts/explore-artifact-composition.test.ts` | `fb3b4f32521b9791c973bfe8194c21b5f706af84` | test-enforced + audit-enforced | The target explore workflow has a fixture, golden, and schema-composition proof. |
| plugin_surface_present | green | `.claude-plugin/plugin.json`; `.claude-plugin/commands/circuit-run.md`; `.claude-plugin/commands/circuit-explore.md`; `tests/contracts/plugin-surface.test.ts`; `tests/runner/plugin-command-invocation.test.ts`; `specs/reviews/p2-11-invoke-evidence.md`; `scripts/audit.mjs::checkPluginCommandClosure` | `a4de1d5` | audit-enforced + contract-tested + operator-local CLI-surrogate evidence | Plugin commands are wired to the CLI surrogate path and no longer return placeholders. |

## Pending CC#P2-8 Artifacts

- `specs/reviews/phase-2-close-codex.md` must still be produced by the
  required Codex phase-close challenger pass.
- `specs/reviews/phase-2-operator-product-check.md` must still be supplied
  as the operator product-direction note.
- `phase_close_claim` must stay `false` until both artifacts exist and the
  close-matrix audit check accepts them.
