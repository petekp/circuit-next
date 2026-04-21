---
name: explore-md-v0.1-codex
description: Codex cross-model challenger pass on specs/contracts/explore.md v0.1 (Phase 2 first-parity workflow contract). Required per CLAUDE.md hard invariant #6 / decision.md challenger protocol (first Phase 2 contract authorship).
type: review
contract_target: explore
contract_version: 0.1
reviewer_model: gpt-5-codex
review_kind: challenger-objection-list
review_date: 2026-04-21
reviewer_role: cross-model-challenger
mode: adversarial-llm-review
opening_verdict: REJECT pending HIGH fold-ins
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts: "HIGH: 4, MED: 7, LOW: 2, META: 1"
verdict: REJECT → incorporated → ACCEPT (after fold-in)
authored_by: gpt-5-codex + claude-opus-4-7
fold_in_disposition: All HIGH + MED + LOW folded into explore.md + fixture + invariants.json + artifacts.json in same authoring session on 2026-04-21; META (isolation posture) is a commit-body requirement recorded in the ceremony commit. See explore.md §Invariant + §Deferred properties + §Artifact reader/writer graph + §schema_sections gate placeholder note + §Reopen conditions for per-objection fold-in locations.
---

# Codex challenger objection list — explore.md v0.1

## Opening verdict: REJECT pending HIGH fold-ins

`specs/contracts/explore.md` is directionally useful, but it is not yet a clean first Phase 2 workflow contract. The largest issue is not taste: the current ledger state already fails `tests/contracts/invariant-ledger.test.ts` because EXPLORE-I2 through EXPLORE-I5 are contract-surface `prose-only` invariants. The rest of the objections are the contract-shape and fixture-closure reasons I would not fold this in as-is.

## Objections

### 1. HIGH — EXPLORE-I2 through EXPLORE-I5 violate the invariant-ledger eligibility rule

`specs/invariants.json` classifies EXPLORE-I2, EXPLORE-I3, EXPLORE-I4, and EXPLORE-I5 as `surface_type: "contract"` plus `enforcement_state: "prose-only"`. The existing ledger ratchet explicitly forbids that combination for contract invariants, and the targeted run confirms the slice is red: `npm test -- tests/contracts/invariant-ledger.test.ts` fails on `contract-surface invariants cannot be prose-only`. This is also semantically right: `explore.md` says "The runtime MUST reject" violations, so those rows cannot be treated as prose-only promises.

**Remediation:** Change deferred EXPLORE invariants to an allowed deferred shape, most likely `enforcement_state: "phase2-property"` with concrete `target_slice` and `reopen_condition`, or weaken the contract prose so only EXPLORE-I1 is a current "MUST reject" invariant and the others are explicitly future obligations. **Disposition:** Rejected pending fold-in.

### 2. HIGH — The fixture writes an unregistered `explore.result@v1` artifact

`explore.md` declares four artifact ids and says Close emits a final aggregate with "no new artifact id in v0.1." The fixture nevertheless has `close-step.writes.artifact.schema = "explore.result@v1"` at `artifacts/result.json`. That creates a fifth artifact-like surface with no `specs/artifacts.json` entry, no contract `artifact_ids` declaration, no reader/writer registry, and no deferred schema row. This is exactly the artifact-registry drift the contract layer is meant to prevent.

**Remediation:** Either remove `close-step.writes.artifact` and model Close as a terminal result outside the artifact registry, or register `explore.result` everywhere: `explore.md` frontmatter, ubiquitous-language section, `specs/artifacts.json`, `specs/invariants.json` property text, and future P2.10 schema commitments. **Disposition:** Rejected pending fold-in.

### 3. HIGH — EXPLORE-I1 claims more than `checkSpineCoverage` enforces

EXPLORE-I1 requires exact canonicals, `spine_policy.mode = partial`, `omits = [plan, verify]`, and "a rationale >=20 characters mentioning investigation or synthesis-in-act semantics." `checkSpineCoverage` only checks the canonical set, mode, and omit set. It does not inspect rationale length or content, does not validate the `id` plus filename heuristic described in the contract, and does not parse each scanned fixture through `Workflow.safeParse`. The temp tests even use `steps: []` fixtures whose phase and entry references would not satisfy the base workflow schema. That means Check 24 can return green for a malformed workflow so long as the label set is correct.

**Remediation:** Either narrow EXPLORE-I1 to the three facts Check 24 actually enforces, or extend `checkSpineCoverage` to parse the fixture with `Workflow.safeParse`, reject malformed `spine_policy.rationale`, and add negative tests for missing/garbage rationale plus an `explore/` path whose `id` disagrees with the directory. **Disposition:** Rejected pending fold-in.

### 4. HIGH — `Synthesize` mapped to canonical `act` is an undeclared amendment to CC#P2-6

ADR-0007 CC#P2-6 binds the first workflow's canonical set in human phase terms as Frame -> Analyze -> Synthesize -> Review -> Close. The contract silently translates Synthesize to canonical `act`, while omitting canonical `plan`. That may be the right final answer, but the contract does not prove it. In an investigation workflow, synthesis often means building candidate conclusions, tradeoffs, or a plan of attack; mapping it to `act` instead of `plan` changes what `plan` omission means under PHASE-I4 partial-spine semantics.

**Remediation:** Add an explicit "title-to-canonical translation" subsection that cites ADR-0007 as accepting `Synthesize -> act`, or amend ADR-0007 / the Phase 2 plan to state the canonical id set `{frame, analyze, act, review, close}` rather than only title labels. Also add a short rejected-alternative note explaining why `Synthesize -> plan` was not chosen. **Disposition:** Rejected pending fold-in.

### 5. MED — Artifact readers disagree across the contract, registry, and fixture

The contract post-condition says Close reads prior artifacts. The fixture Close step reads only `artifacts/synthesis.json` and `artifacts/review-verdict.json`. `specs/artifacts.json` lists `explore.brief` as read by close-step even though the fixture does not read it, and does not list `explore.analysis` as read by close-step even though "prior artifacts" would include it. This leaves no single source of truth for whether Close is allowed to re-check the original success condition and evidence chain.

**Remediation:** Decide whether Close reads all prior artifacts or only the synthesis and review verdict. Then make `explore.md`, `.claude-plugin/skills/explore/circuit.json`, and every `specs/artifacts.json` reader list match exactly. **Disposition:** Rejected pending fold-in.

### 6. MED — The test-enforced property id is not present in a test title

`explore.prop.canonical_phase_set_is_correct` is marked `test-enforced` with a `binding_refs` kind of `test_title`, but no `describe(...)` or `it(...)` title in `tests/contracts/spine-coverage.test.ts` contains that property id. The tests do mention EXPLORE-I1 in a describe title, so the invariant row is anchored, but the property row is not. If property ids are supposed to be ledger-addressable evidence, this is a false binding.

**Remediation:** Put `explore.prop.canonical_phase_set_is_correct` in a `describe` or `it` title, or downgrade the property to `phase2-property` until the property harness owns property-id bindings. **Disposition:** Rejected pending fold-in.

### 7. MED — Deferral bookkeeping points in two directions at once

`explore.md` says EXPLORE-I2 through EXPLORE-I5 land at P2.5, while the property rows in `specs/invariants.json` use `target_slice: 29` and a fallback "property harness lands" reopen condition. This slice is described as likely git slice id 34, so `target_slice: 29` looks stale or at least dimensionally different from the P2.5 roadmap. The result is that a future maintainer cannot tell whether the obligation expires at P2.5, Slice 29, Slice 34+n, or whenever the property harness appears.

**Remediation:** Normalize the deferral vocabulary: use the real target slice ids if the ledger is slice-numbered, and mention the P2.5 milestone only as prose context. Each deferred EXPLORE invariant/property should have a concrete reopening condition if that exact target passes without enforcement. **Disposition:** Rejected pending fold-in.

### 8. MED — Workflow kind is still an implicit `id` convention

The contract calls this an `explore`-kinded workflow, but the base schema has no `kind` field and the audit hardcodes `WORKFLOW_KIND_CANONICAL_SETS[fixture.id]`. Unknown fixture ids pass through information-only, duplicate ids across skill directories are not rejected here, and a future `explore-mini` or `research` fixture has no typed relationship to the `explore` contract. That is acceptable as a temporary adapter seam only if the contract says it is temporary and names the migration trigger sharply.

**Remediation:** Add a current-state limitation saying P2.3 uses `id` as a stopgap workflow-kind signal, then add a reopen condition for duplicate workflow ids, renamed explore variants, or the first fixture whose catalog kind differs from its id. Longer term, move this into the Workflow schema or catalog compiler as `kind`. **Disposition:** Rejected pending fold-in.

### 9. MED — `Review covers verify` overclaims semantic adequacy

The verify omission rationale says adversarial review covers the correctness-signal function of verification, but the fixture's review step is still `executor: "orchestrator"` and `kind: "synthesis"`. There is no reviewer dispatch, no separate model, no human checkpoint, and no result-verdict gate. This drifts toward Knight-Leveson-style independent-validation language while the implementation is only a labeled synthesis step in the same workflow.

**Remediation:** Rephrase the rationale to say `verify` is omitted because no mechanical verification artifact exists in v0.1, while adversarial review is a weaker substitute to be strengthened later. If real adversarial dispatch is required for `explore`, make EXPLORE-I4 depend on the P2.4 adapter or add a future semantic-adequacy property for the Review phase. **Disposition:** Rejected pending fold-in.

### 10. MED — `schema_sections` gates are placeholders without a schema contract

The fixture gates require strings like `subject`, `success_condition`, `recommendation`, and `maps_to_success_condition`, but those fields are not tied to any schema file until P2.10. As a result, the gate names look schema-like without a schema source, and a future artifact schema could rename a field while the fixture gate remains stale. This is tolerable as scaffolding, but the contract currently presents the gates as meaningful acceptance discipline.

**Remediation:** Add an explicit P2.3 limitation that `schema_sections` gates are provisional field-name guards, not real artifact schemas. Add a P2.10 reopen condition requiring the gate `required` arrays, artifact schemas, and `specs/artifacts.json` `schema_exports` to be reconciled in one slice. **Disposition:** Rejected pending fold-in.

### 11. MED — Spine coverage tests miss rationale and semantic-mapping mutations

`tests/contracts/spine-coverage.test.ts` covers missing canonical, extra canonical, strict mode, missing omit, and extra omit. It does not test empty rationale, garbage rationale, a rationale that omits investigation/synthesis semantics, directory/id mismatch, duplicate `explore` fixtures, or the contentious `Synthesize -> act` mapping beyond the happy fixture. For EXPLORE-I1 as written, this is not enough mutation coverage.

**Remediation:** Add negative tests for rationale quality and id/path mismatch. Add either a fixture-title assertion proving `Synthesize` is the phase mapped to `act`, or explicitly state that titles are non-semantic and only canonical ids matter. **Disposition:** Rejected pending fold-in.

### 12. LOW — Reopen conditions omit the most likely drift cases

The reopen list covers retargeting, canonical-set changes, artifact schemas, and a future `kind` field. It does not cover P2.5 passing without EXPLORE-I2/I3/I4/I5 enforcement, artifact-reader graph changes, provisional gate fields diverging from P2.10 schemas, or discovery that `explore.result` must be a registered artifact. Those are the realistic ways this v0.1 contract will rot.

**Remediation:** Add reopen bullets for deferred invariant non-delivery, artifact graph drift, gate/schema reconciliation, and the result-artifact decision. **Disposition:** Rejected pending fold-in.

### 13. LOW — The Phase 2 plan still names the wrong challenger-review path

`specs/plans/phase-2-implementation.md §P2.3` says the deliverable includes `specs/contracts/explore-md-codex.md`, but the repository's review convention and this contract use `specs/reviews/explore-md-v0.1-codex.md`. The contract file is right; the plan text is stale. For the first Phase 2 contract, stale evidence paths are unnecessary friction.

**Remediation:** Amend the P2.3 plan deliverable line to the canonical `specs/reviews/explore-md-v0.1-codex.md` path, or phrase it generically as `specs/reviews/<contract>-md-v<version>-codex.md`. **Disposition:** Rejected pending fold-in.

### 14. META — Isolation posture is not reviewable from the files

ADR-0007 CC#P2-7 requires the commit body for this slice to contain `Isolation: policy-compliant (no implementer separation required)` or an allowed alternative. That cannot be validated from the working tree review files alone. If this review is folded into the same slice, the final commit still needs the exact isolation citation or Check 22 will red the slice regardless of the contract content.

**Remediation:** Include `Isolation: policy-compliant (no implementer separation required)` in the slice commit body unless the operator intentionally invokes the ADR-0007 re-deferred wording or Break-Glass lane. **Disposition:** Rejected pending fold-in.
