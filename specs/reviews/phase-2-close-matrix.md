---
name: phase-2-close-matrix
description: Phase 2 close matrix for ADR-0007 CC#P2-8.
type: review
review_kind: phase-close-matrix
target_kind: phase
phase_target: phase-2
phase_version: "authored against HEAD=4dea8cc381a353f0e9e8cfb364433e42169965db plus Slice 101 close package"
review_date: 2026-04-24
phase_close_claim: true
cc_p2_8_state: active — satisfied
codex_close_review: ACCEPT-WITH-FOLD-INS
operator_product_check: supplied-by-operator-delegated-autonomy
authored_by: Codex
---

# Phase 2 Close Matrix

This is the CC#P2-8 evidence matrix for the Phase 2 close claim:
`phase_close_claim` is `true`, the Codex phase-close review is recorded at
`specs/reviews/phase-2-close-codex.md`, and the operator product-direction
note is recorded at `specs/reviews/phase-2-operator-product-check.md`.

## Close Criteria Rows

| criterion | status | evidence path | passing commit / adr | structural evidence type | notes |
|---|---|---|---|---|---|
| P2-1 | active — satisfied | `tests/runner/explore-e2e-parity.test.ts`; `tests/fixtures/golden/explore/result.sha256`; `tests/fixtures/agent-smoke/last-run.json`; `tests/contracts/explore-artifact-composition.test.ts`; `tests/runner/explore-artifact-writer.test.ts`; `tests/contracts/legacy-explore-characterization.test.ts`; `tests/fixtures/reference/legacy-circuit/explore/reference-shape.json`; `specs/reference/legacy-circuit/explore-characterization.md`; `specs/reviews/p2-1-json-successor-operator-decision.md`; `specs/adrs/ADR-0007-phase-2-close-criteria.md` | ADR-0007 at `specs/adrs/ADR-0007-phase-2-close-criteria.md` (Slice 99 structured JSON successor substitution) | test-enforced + audit-enforced + operator-approved external live CLI smoke + reference characterization + operator product decision | Explore has the typed close-result writer and refreshed Claude fingerprint. The reference characterization shows old Circuit's Explore output is Markdown-first, while circuit-next emits structured JSON. ADR-0007 now accepts circuit-next's strict JSON artifacts as the clean-break successor shape for CC#P2-1; this does not claim old Markdown byte-shape compatibility. |
| P2-2 | active — satisfied | `src/runtime/adapters/agent.ts`; `src/runtime/adapters/codex.ts`; `tests/runner/agent-dispatch-roundtrip.test.ts`; `tests/runner/codex-dispatch-roundtrip.test.ts`; `tests/fixtures/agent-smoke/last-run.json`; `tests/fixtures/codex-smoke/last-run.json`; `scripts/audit.mjs::checkAgentSmokeFingerprint`; `scripts/audit.mjs::checkCodexSmokeFingerprint` | `4dea8cc381a353f0e9e8cfb364433e42169965db` | test-enforced + audit-enforced + external live CLI smoke | Both live adapter fingerprints were refreshed against Slice 100 and match the current adapter surfaces. |
| P2-3 | active — satisfied | `.claude-plugin/plugin.json`; `commands/run.md`; `commands/explore.md`; `commands/review.md`; `tests/contracts/plugin-surface.test.ts`; `tests/runner/plugin-command-invocation.test.ts`; `tests/runner/review-runtime-wiring.test.ts`; `specs/reviews/p2-3-live-slash-command-evidence.md`; `specs/reviews/p2-11-invoke-evidence.md`; `specs/reviews/arc-slice-56-codex.md`; `scripts/audit.mjs::checkPluginCommandClosure` | `4dea8cc381a353f0e9e8cfb364433e42169965db` | Claude validator + live Claude Code slash-command transcript + audit-enforced + contract-tested + CLI-surrogate evidence | Claude Code 2.1.119 validates the plugin manifest, loads this repo as inline plugin `circuit`, registers `/circuit:run`, `/circuit:explore`, and `/circuit:review`, and a live `/circuit:review` invocation reaches the project CLI and completes with schema-valid `review-result.json`. |
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
| status_docs_current | green | `scripts/audit.mjs`; `tests/contracts/status-epoch-ratchet-floor.test.ts`; `README.md`; `PROJECT_STATE.md`; `TIER.md` | `4dea8cc381a353f0e9e8cfb364433e42169965db` | audit-enforced + test-enforced | The matrix row names the last audited baseline; the close package advances the markers with the closing slice. |
| tier_claims_current | green | `scripts/audit.mjs`; `tests/contracts/governance-reform.test.ts`; `tests/contracts/inherited-ratchet-bindings.test.ts`; `TIER.md` | `fb3b4f32521b9791c973bfe8194c21b5f706af84` | audit-enforced + test-enforced | TIER rows are enforced and inherited ratchet rows are bound to evidence surfaces. |
| dispatch_realness | green | `tests/runner/explore-e2e-parity.test.ts`; `tests/runner/agent-dispatch-roundtrip.test.ts`; `tests/runner/codex-dispatch-roundtrip.test.ts`; `tests/fixtures/agent-smoke/last-run.json`; `tests/fixtures/codex-smoke/last-run.json` | `4dea8cc381a353f0e9e8cfb364433e42169965db` | test-enforced + external live CLI smoke | The two built-in subprocess adapters have current smoke fingerprints. |
| workflow_parity_fixtures | green | `.claude-plugin/skills/explore/circuit.json`; `tests/runner/explore-e2e-parity.test.ts`; `tests/fixtures/golden/explore/result.sha256`; `tests/contracts/explore-artifact-composition.test.ts` | `fb3b4f32521b9791c973bfe8194c21b5f706af84` | test-enforced + audit-enforced | The target explore workflow has a fixture, golden, and schema-composition proof. |
| plugin_surface_present | green | `.claude-plugin/plugin.json`; `commands/run.md`; `commands/explore.md`; `commands/review.md`; `tests/contracts/plugin-surface.test.ts`; `tests/runner/plugin-command-invocation.test.ts`; `tests/runner/review-runtime-wiring.test.ts`; `specs/reviews/p2-3-live-slash-command-evidence.md`; `specs/reviews/p2-11-invoke-evidence.md`; `scripts/audit.mjs::checkPluginCommandClosure` | `4dea8cc381a353f0e9e8cfb364433e42169965db` | Claude validator + live Claude Code slash-command transcript + audit-enforced + contract-tested | Plugin commands use Claude Code's real root `commands/*.md` layout, validate under `claude plugin validate .`, and a live `/circuit:review` invocation completes through the CLI. |

## CC#P2-8 Close Artifacts

- `specs/reviews/phase-2-close-codex.md` records the required Codex
  phase-close challenger pass.
- `specs/reviews/phase-2-operator-product-check.md` records the operator
  product-direction check under delegated autonomy for retroactive review.
- `checkPhase2CloseMatrix` accepts this matrix only when both artifacts exist,
  every active row is satisfied, the re-deferred isolation row cites accepted
  ADR authority, and every product-ratchet row is green.
