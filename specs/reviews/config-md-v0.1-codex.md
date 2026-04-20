---
contract_target: config
contract_version: 0.1
reviewer_model: gpt-5-codex via codex exec
reviewer_model_id: gpt-5-codex
review_kind: adversarial property-auditor
review_date: 2026-04-20
verdict: REJECT → incorporated → ACCEPT
authored_by: operator + claude-opus-4-7
authorship_role: operator+agent
---

# config.md v0.1 — Codex Adversarial Property-Auditor Review

This record captures the cross-model challenger pass on
`specs/contracts/config.md` v0.1 + `src/schemas/config.ts` (.strict()
tightening) + `specs/artifacts.json` (config.* rehome) +
`tests/contracts/schema-parity.test.ts` (CONFIG-I1..I7 tests) +
`tests/contracts/artifact-authority.test.ts` (pinned rehome
landing assertion). The reviewer's task was an **objection list**,
not approval; incorporation decisions were made by the operator per
the narrow-cross-model-challenger protocol (Knight-Leveson
Swiss-cheese, not independent corroboration).

## Verdict chain

`REJECT → incorporated → ACCEPT (after fold-in)`

The reviewer's opening verdict was REJECT on "contract-review
linkage gate": even on a correct schema + strict() implementation,
the drafting did not satisfy the challenger-linkage frontmatter
requirement, and the proposed reviewing filename shape would still
fail `CONTRACT_REVIEW_PATH_PATTERN` at
`tests/contracts/cross-model-challenger.test.ts:93`. Four MEDs and
one LOW landed alongside on precision/honesty grounds.

All 1 HIGH + 4 MED + 1 LOW objections folded in before commit
(schema-parity tests added, prose tightened, property renamed,
CONFIG-I8 added, exact schema_exports pinning on the rehome test,
LayeredConfig default-layer ergonomic test, this review record
created at the canonical filename, `codex_adversarial_review`
frontmatter link added to `config.md`).

## Objection list (as returned by Codex)

### 1. HIGH — Contract-review linkage gate fails on current working tree; proposed `slice-26-config-codex.md` filename is also wrong shape.

**Evidence:** `specs/contracts/config.md:1-14` has no
`codex_adversarial_review`;
`tests/contracts/cross-model-challenger.test.ts:632-649` requires
every contract to link a review or carry grandfathering;
`tests/contracts/cross-model-challenger.test.ts:86-94` requires
`specs/reviews/<stem>-md-v<major>.<minor>-codex.md`; targeted test
run failed exactly on `config.md`.

**Proposed remediation:** create
`specs/reviews/config-md-v0.1-codex.md` (not
`slice-26-config-codex.md`); give it contract-review frontmatter
with `contract_target: config`, `contract_version: 0.1`,
`reviewer_model`, `review_kind`, `review_date`, `verdict`,
`authored_by`; add
`codex_adversarial_review: specs/reviews/config-md-v0.1-codex.md`
to `config.md`.

**Fold-in discipline:** Incorporable within Slice 26.

**Disposition:** INCORPORATED. This file is the landing of the
remediation; the `codex_adversarial_review` frontmatter field was
added to `specs/contracts/config.md` at the same commit.

### 2. MED — Post-rehome pinned test does not pin exact `config.*.schema_exports`; config artifacts could be semantically reshuffled while the new positive assertion stays green.

**Evidence:** `tests/contracts/artifact-authority.test.ts:968-980`
checks only existence, `contract`, and `schema_file`; the intended
split lives in `specs/artifacts.json:328-399` as
`config.root -> ["Config"]`,
`config.layered -> ["LayeredConfig", "ConfigLayer"]`,
`config.circuit-override -> ["CircuitOverride"]`.

**Proposed remediation:** extend the Slice 26 landing test to
assert exact schema export arrays for all three config rows,
alongside the existing exact `adapter.registry.schema_exports`
assertion at `tests/contracts/artifact-authority.test.ts:953-965`.

**Fold-in discipline:** Incorporable within Slice 26.

**Disposition:** INCORPORATED. The landing test now asserts exact
`schema_exports` equality for `config.root`, `config.layered`, and
`config.circuit-override`.

### 3. MED — The contract claims layer composition is out of scope while simultaneously registering `config.prop.layered_merge_right_biased_preserves_strictness`, which presupposes right-biased config merge semantics.

**Evidence:** `specs/contracts/config.md:42-46` says non-selection
config-file composition is reserved for v0.2 with an ADR;
`specs/contracts/config.md:211-216` defines
`config.prop.layered_merge_right_biased_preserves_strictness`;
`specs/invariants.json:840-846` registers that property as Phase 2.

**Proposed remediation:** either rename the property to avoid
committing to bias, e.g.
`config.prop.layered_composition_preserves_strictness`, or
explicitly state that right bias is already accepted for
selection-layer projection while non-selection dispatch/config
merge bias remains ADR-pending.

**Fold-in discipline:** Incorporable within Slice 26.

**Disposition:** INCORPORATED via rename. The property is now
`config.prop.layered_composition_preserves_strictness`; a later
property (`config.prop.selection_layer_projection_right_biased`)
can be added in Slice 27/v0.2 if selection-layer projection needs
its own proof handle.

### 4. MED — Strictness-transitivity prose overstates "any path" because `invocation_options` is intentionally an open JSON map.

**Evidence:** `specs/contracts/config.md:179-182` and `203-207`
describe surplus-key rejection across nested config paths;
`specs/contracts/selection.md:91-98` explicitly allows arbitrary
string-keyed JSON under `invocation_options`;
`src/schemas/selection-policy.ts:36-39` and `70-78` implement that
open record under a strict `SelectionOverride`.

**Proposed remediation:** qualify the config postcondition/property:
strictness applies to declared object shapes; record maps and
`invocation_options` are key/value validated data maps, not
surplus-key surfaces. Add a small regression pair: reject
`defaults.selection.rigr`, accept
`defaults.selection.invocation_options.some_adapter_key`.

**Fold-in discipline:** Incorporable within Slice 26.

**Disposition:** INCORPORATED. Contract prose amended to
distinguish **declared object shapes** (transitively strict) from
**record/open-map values** (`Config.circuits`, `DispatchConfig.roles`,
`DispatchConfig.circuits`, `DispatchConfig.adapters`,
`SelectionOverride.invocation_options`). The regression pair
landed in `tests/contracts/schema-parity.test.ts` CONFIG-I4 block.

### 5. MED — `Config.circuits` WorkflowId key closure is schema-enforced but not bound by a named CONFIG test; it is cheap schema parity, not true Phase 2 property work.

**Evidence:** `specs/contracts/config.md:175-176` claims `circuits`
keys are `WorkflowId`s;
`specs/contracts/config.md:218-225` defers
`config.prop.circuit_override_record_closed_under_workflow_id`;
`src/schemas/config.ts:130` uses
`z.record(WorkflowId, CircuitOverride)`; the new config tests at
`tests/contracts/schema-parity.test.ts:3340-3488` never reject an
invalid `circuits` key.

**Proposed remediation:** add a Slice 26 schema-parity test
rejecting
`Config.safeParse({schema_version: 1, circuits: {"Bad Id": {}}})`
and accepting a valid slug key. Either make this CONFIG-I8 or bind
the property with a concrete Phase 1 regression test while leaving
fuzzing to Phase 2.

**Fold-in discipline:** Incorporable within Slice 26.

**Disposition:** INCORPORATED as CONFIG-I8. Promoted `Config.circuits`
WorkflowId key-shape closure from a reserved Phase-2 property to a
Phase-1 contract invariant with positive + negative schema-parity
tests. The fuzzing version remains deferred as
`config.prop.circuit_override_record_closed_under_workflow_id`.

### 6. LOW — CONFIG-I7 works in the schema, but the exact DEFAULT-layer ergonomic probe is not asserted.

**Evidence:** `src/schemas/config.ts:121-138` defaults the nested
config fields;
`tests/contracts/schema-parity.test.ts:3341-3348` asserts bare
`Config`;
`tests/contracts/schema-parity.test.ts:3432-3438` asserts minimal
`LayeredConfig` only with `layer: "user-global"` and does not
inspect parsed defaults.

**Proposed remediation:** add a regression asserting
`LayeredConfig.safeParse({layer: "default", config: {schema_version: 1}})`
succeeds and returns
`config.dispatch.default === "auto"`,
`config.dispatch.roles === {}`, `config.dispatch.circuits === {}`,
`config.dispatch.adapters === {}`, `config.circuits === {}`, and
`config.defaults === {}`.

**Fold-in discipline:** Incorporable within Slice 26.

**Disposition:** INCORPORATED. A deep-defaults regression test
landed in the CONFIG-I7/CONFIG-I2 section of
`tests/contracts/schema-parity.test.ts`.

## Reciprocation record

Codex confirmed reciprocation on CONFIG-I1..I7:

| Invariant | Prose anchor | Schema enforcement | Test anchor | Mismatch |
|---|---|---|---|---|
| CONFIG-I1 | config.md:82-91 | config.ts:121-138 | schema-parity.test.ts:3351-3365 + 3468-3474 | none |
| CONFIG-I2 | config.md:93-98 | config.ts:147-153 | schema-parity.test.ts:3431-3466 | none |
| CONFIG-I3 | config.md:100-107 | config.ts:108-112 | schema-parity.test.ts:3409-3428 | none |
| CONFIG-I4 | config.md:109-118 | config.ts:131-136 | schema-parity.test.ts:3378-3406 | none |
| CONFIG-I5 | config.md:120-127 | config.ts:141 | schema-parity.test.ts:3477-3488 | none — `rg` found no src consumer bypassing the enum |
| CONFIG-I6 | config.md:129-137 | config.ts:123 | schema-parity.test.ts:3367-3375 | none |
| CONFIG-I7 | config.md:139-152 | config.ts:124-136 | schema-parity.test.ts:3341-3348 | only coverage-precision gap — LOW #6 above |

CONFIG-I8 (added during fold-in) binds prose at config.md's new
CONFIG-I8 section to `z.record(WorkflowId, CircuitOverride)` at
`src/schemas/config.ts` + positive/negative tests in
`tests/contracts/schema-parity.test.ts`.

## Meta disposition

> The drafter is using Phase 2 property IDs as a parking lot for
> some facts that are already schema-level and cheap to test now.
> Separate "needs a reducer/property harness" from "one negative
> parse fixture would pin the contract today."

**Disposition:** Acknowledged and acted on. CONFIG-I8 is the concrete
instance in this slice (promoted from property to contract invariant).
Future contract drafting passes should apply this heuristic before
reaching for a Phase-2 deferral.

## Evolution

- **v0.1 (this review)** — 1 HIGH + 4 MED + 1 LOW landed; all
  incorporated in Slice 26 before commit. No deferrals to v0.2.
  Contract status flipped `REJECT → ACCEPT` after fold-in.
