---
name: circuit-next-tier
description: Claim matrix for enforced, planned, and not-claimed circuit-next capabilities.
type: tier-claim-matrix
date: 2026-04-20
---

<!-- current_slice: 74 -->

# TIER Claim Matrix

Every row below has exactly one claim classification: an existing `file_path`,
a non-empty `planned_slice`, or `status=not claimed` with rationale. `not
claimed` is honest signal, not failure. Orphan claims are the failure mode.

| claim_id | status | file_path | planned_slice | rationale |
|---|---|---|---|---|
| contract_tests | enforced | `tests/contracts/schema-parity.test.ts`; `tests/contracts/artifact-authority.test.ts`; `tests/contracts/cross-model-challenger.test.ts`; `tests/contracts/governance-reform.test.ts`; `tests/contracts/invariant-ledger.test.ts`; `tests/contracts/legacy-continuity-guard.test.ts`; `tests/contracts/primitives.test.ts`; `tests/contracts/prose-yaml-parity.test.ts`; `tests/contracts/session-hygiene.test.ts`; `tests/contracts/specs-portability.test.ts` |  | Current contract-test suite. |
| audit_discipline | enforced | `scripts/audit.mjs` |  | Drift-visibility audit implementation. |
| authority_graph | enforced | `specs/artifacts.json` |  | Authority graph source of truth. |
| invariant_ledger | enforced | `specs/invariants.json` |  | Invariant and property ledger. |
| specs_portability | enforced | `scripts/audit.mjs` |  | Check 11 enforces specs portability. |
| product_reality_gate_visibility | enforced | `scripts/audit.mjs`; `specs/methodology/product-gate-exemptions.md` |  | Slice 25b makes the Product Reality Gate visible to audit through the exemption ledger; executable dogfood semantics land later. |
| tier_orphan_claim_rejection | enforced | `scripts/audit.mjs`; `TIER.md` |  | Slice 25b audit rejects TIER rows with no file path, planned slice, or explicit not-claimed declaration. |
| adversarial_yield_ledger | enforced | `specs/reviews/adversarial-yield-ledger.md` |  | D10 immediate evidence source. |
| human_cold_read_record | enforced | `specs/reviews/phase-1-close-reform-human.md` |  | First exemplar created in Slice 25b; future records remain subject to the review-record discipline. |
| product_surface_inventory_baseline | enforced | `scripts/inventory.mjs`; `reports/product-surface.inventory.json`; `reports/product-surface.inventory.md`; `tests/contracts/product-surface-inventory.test.ts` |  | Slice 27b product-surface inventory; 10 baseline surfaces with placeholder-rejecting detectors. 27c + 27d rerun `npm run inventory` and assert delta against committed baseline. |
| runner_smoke | planned |  | 27d | Will become a product ratchet once dogfood-run-0 runs. |
| workflow_fixture_runs | planned |  | 27d | Dogfood-run-0 fixture execution evidence. |
| event_log_round_trip | planned |  | 27c | Runtime-boundary append-only event writer/reducer proof. |
| snapshot_derived_from_log | planned |  | 27c | Runtime-boundary reducer-derived snapshot proof. |
| manifest_snapshot_byte_match | planned |  | 27c | SHA-256 manifest byte-match proof before dogfood. |
| status_docs_current | enforced | `scripts/audit.mjs`; `README.md`; `PROJECT_STATE.md`; `TIER.md` |  | Slice 26b Check 18 compares the aligned `current_slice` marker against the most recent `slice-<id>:` commit subject in git log; "docs all agree on a stale story" registers as red, not green. |
| pinned_ratchet_floor | enforced | `scripts/audit.mjs`; `specs/ratchet-floor.json` |  | Slice 26b Check 19 enforces HEAD contract-test count ≥ pinned floor in `specs/ratchet-floor.json`; close gates depend on the floor, not on `HEAD~1`. |
| current_slice_status_epoch | enforced | `scripts/audit.mjs`; `README.md`; `PROJECT_STATE.md`; `TIER.md` |  | Slice 26b Check 17 verifies all three files carry `<!-- current_slice: <id> -->` markers and agree on `<id>`. |
| container_isolation | not claimed |  |  | Tier 2+ deferral per ADR-0001. |
| hidden_property_pool | not claimed |  |  | Tier 2+ deferral per ADR-0001. |
| mutation_testing_gate | not claimed |  |  | Tier 2+ deferral per ADR-0001. |
