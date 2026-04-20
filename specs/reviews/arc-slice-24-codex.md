---
review_target: slice-24
target_kind: arc
arc_target: phase-1-close-slice-24
arc_version: 0.1
reviewer_model: GPT-5 Codex
review_kind: adversarial slice-level lint (per-slice challenger under arc-review HIGH #1 going-forward rule)
review_date: 2026-04-20
verdict: REJECT → incorporated → ACCEPT (after fold-in)
opening_verdict: REJECT pending HIGH fold-ins
closing_verdict: ACCEPT (after fold-in)
authored_by: Codex
upstream_objection_refs:
  - specs/reviews/arc-phase-1-close-codex.md#HIGH-9
---

# Slice 24 Codex Challenger Review

## Opening verdict

REJECT pending HIGH fold-ins. Slice 24 closes the direct "new basename adds `codex_adversarial_review_grandfathered`" bypass, but the remaining CHALLENGER-I3 surface is still too name- and prose-shaped: forward links are not constrained to `specs/reviews/`, grandfathered identity is keyed by basename rather than contract identity, and the three new fields are presence checks more than renewal machinery.

## Objection list

**1. HIGH — The forward-link path can self-link instead of pointing at a review record.**

- Affected-claim/artifact: CHALLENGER-I3 claim that new contracts must use `codex_adversarial_review` to link an auditable `specs/reviews/<target>-md-v<version>-codex.md` record.
- Reproduction-path: `tests/contracts/cross-model-challenger.test.ts:527-536` only checks that `codex_adversarial_review` resolves to an existing path, and `tests/contracts/cross-model-challenger.test.ts:540-555` only parses that resolved file's `contract_target`. It does not require the path to live under `specs/reviews/`, match the contract-review filename pattern, or be one of `listReviewFiles()`. The track spec requires a review file under `specs/reviews/` at `specs/behavioral/cross-model-challenger.md:55-64`; the Slice 24 failure message repeats that expectation at `tests/contracts/cross-model-challenger.test.ts:479-483`.
- Proposed remediation: require `codex_adversarial_review` to match `^specs/reviews/[a-z0-9-]+-md-v\\d+\\.\\d+-codex\\.md$`, resolve under `REVIEWS_DIR`, classify as a contract review, and carry the full contract-review frontmatter. Add a negative fixture in the test that demonstrates a self-linking contract with `contract_target` in its own frontmatter fails.
- Fold-in discipline label: Incorporable within Slice 24.

**2. HIGH — The grandfather allowlist binds a basename, not the historical contract identity.**

- Affected-claim/artifact: `GRANDFATHERED_CONTRACT_ALLOWLIST` as evidence that no new contract can use the grandfathered escape hatch.
- Reproduction-path: `tests/contracts/cross-model-challenger.test.ts:26` allowlists only `step.md` and `workflow.md`; `tests/contracts/cross-model-challenger.test.ts:469-475` compares only `basename(contractPath)`. The historical identity fields are present but unchecked: `specs/contracts/step.md:2-10` says `contract: step`, `version: 0.1`, `schema_source: src/schemas/step.ts`, and the Slice 2 scope; `specs/contracts/workflow.md:2-10` says `contract: workflow`, `version: 0.1`, `schema_source: src/schemas/workflow.ts`, and the skeleton scope. A future edit can keep the filename `step.md` while changing the contract identity, schema source, or version and still pass the allowlist test.
- Proposed remediation: make the allowlist a typed record keyed by canonical relative path and expected frontmatter, e.g. `{ path, contract, version, schema_source, artifact_ids, grandfathered_source_ref }`. Assert all expected fields exactly, and use `lstatSync`/`realpathSync` or `git ls-files -s` to reject symlink/path-substitution games for allowlisted entries.
- Fold-in discipline label: Incorporable within Slice 24.

**3. MED — `expires_on_contract_change: true` is asserted but never made operative.**

- Affected-claim/artifact: the "expires on material change" part of the HIGH #9 remediation and Slice 24 commit claim.
- Reproduction-path: `tests/contracts/cross-model-challenger.test.ts:487-495` says the field forces renewal, but `tests/contracts/cross-model-challenger.test.ts:501-514` only checks that the string value is exactly `true`. The actual frontmatter at `specs/contracts/step.md:10-11` and `specs/contracts/workflow.md:10-11` names change-triggered exit conditions, but no test compares current contract contents, version, schema source, invariant ids, or schema dependencies against the grandfathered baseline.
- Proposed remediation: either rename the field to `expires_on_contract_change_ack: true` so it is honest prose, or make it enforceable: forbid grandfathering when `version !== 0.1`, when `schema_source` differs from the allowlist record, when numbered invariant ids change, or when the schema files named by the scope have changed without a new review.
- Fold-in discipline label: Incorporable within Slice 24.

**4. MED — `grandfathered_source_ref` is not resolved and includes mutable anchors.**

- Affected-claim/artifact: HIGH #9 requirement that the source ref be concrete review evidence, not another prose assertion.
- Reproduction-path: `specs/reviews/arc-phase-1-close-codex.md:216-219` specifically asks for a resolvable commit/path. Slice 24 checks only non-empty text at `tests/contracts/cross-model-challenger.test.ts:501-512`. The `step.md` ref mixes stable commit `f5a6241` with mutable `PROJECT_STATE.md` prose at `specs/contracts/step.md:9`; `workflow.md` mixes `bootstrap/adversarial-review-codex.md` with mutable `PROJECT_STATE.md` prose at `specs/contracts/workflow.md:9`.
- Proposed remediation: parse `grandfathered_source_ref` into structured refs such as `commit:f5a6241` and `path:bootstrap/adversarial-review-codex.md`; assert commits with `git cat-file -e <sha>^{commit}` and paths with `existsSync`. Treat `PROJECT_STATE.md` anchors as supplemental notes only, or require them to be pinned through a commit-qualified ref.
- Fold-in discipline label: Incorporable within Slice 24.

**5. MED — `grandfathered_scope` is free prose that can silently expand.**

- Affected-claim/artifact: the new scope field as a guard against grandfathering drifting from historical coverage to general exemption.
- Reproduction-path: `tests/contracts/cross-model-challenger.test.ts:501-514` requires only non-empty text for `grandfathered_scope`. The scope bodies at `specs/contracts/step.md:10` and `specs/contracts/workflow.md:10` are currently specific, but a future edit can broaden them to "all future v0.x contract changes" and still pass.
- Proposed remediation: add machine-readable scope tokens alongside prose. For example, `grandfathered_scope_ids: [STEP-I1, STEP-I3, STEP-I4, STEP-I6, step.variant-set:v0.1, gate.source.literal-ref]` and `grandfathered_scope_ids: [WF-I1, WF-I2, WF-I3, WF-I4, WF-I5, WF-I6, WF-I7, workflow.schema_version:2]`; assert exact set membership against known allowlist records or against invariant headings in the contract body.
- Fold-in discipline label: Incorporable within Slice 24.

**6. MED — The exit path permits double-counting instead of clean migration.**

- Affected-claim/artifact: the planned transition from grandfathered record to normal `codex_adversarial_review` record for `step.md` and `workflow.md`.
- Reproduction-path: `tests/contracts/cross-model-challenger.test.ts:433-441` accepts a contract when either field exists, but it does not forbid both. The allowlist comments describe exit at `tests/contracts/cross-model-challenger.test.ts:22-25`; the test at `tests/contracts/cross-model-challenger.test.ts:469-475` still permits the grandfathered field on allowlisted files even after a forward review link is added. HIGH #9's operator response says workflow should remove the grandfathered declaration on close at `specs/reviews/arc-phase-1-close-codex.md:451-452`.
- Proposed remediation: add an XOR invariant: a contract may carry exactly one of `codex_adversarial_review` or `codex_adversarial_review_grandfathered`. If a proper review lands, the grandfathered field and allowlist entry must be removed in the same slice.
- Fold-in discipline label: Incorporable within Slice 24.

**7. MED — The behavioral track spec still documents the old generic grandfather path.**

- Affected-claim/artifact: `specs/behavioral/cross-model-challenger.md` as the durable CHALLENGER-I3 contract.
- Reproduction-path: the frontmatter still says the test was tightened only through Slice 21 at `specs/behavioral/cross-model-challenger.md:14-16`. The planned-test prose still says every contract may use `codex_adversarial_review_grandfathered: <rationale>` with a 20-character prose declaration at `specs/behavioral/cross-model-challenger.md:136-140`, with no allowlist, source-ref, scope, or expiry fields.
- Proposed remediation: update the track spec in the same slice: name the Slice 24 tightening, state the grandfathered path is closed to all contracts except `step.md` and `workflow.md`, and document the required structured fields plus their intended enforcement semantics.
- Fold-in discipline label: Incorporable within Slice 24.

**8. MED — The step scope omits one of the schema files that carries the cited evidence.**

- Affected-claim/artifact: `step.md` grandfathered evidence alignment.
- Reproduction-path: `specs/contracts/step.md:10` says the grandfathered scope includes "the Gate.source typed reference" but the exit condition names changes to `schema_source src/schemas/step.ts`. The typed `Gate.source` evidence actually lives in `src/schemas/gate.ts:3-7` and in the gate variants at `src/schemas/gate.ts:49-79`; `src/schemas/step.ts:86-98` only performs the union-level `gate.source.ref` closure refinement.
- Proposed remediation: make the grandfathered scope name every schema file whose semantics are covered by the historical review, e.g. `schema_sources: [src/schemas/step.ts, src/schemas/gate.ts]`, and fail grandfathering if any listed source changes its relevant exports without a proper review.
- Fold-in discipline label: Incorporable within Slice 24.

**9. MED — Audit remains blind to the grandfathered-review invariant.**

- Affected-claim/artifact: redundant enforcement and Slice 24 acceptance evidence that `npm run audit` is green.
- Reproduction-path: `package.json:12-17` separates `npm run test`/`npm run verify` from `npm run audit`. The audit's contract loop at `scripts/audit.mjs:736-789` checks `artifact_ids` reciprocity, not `codex_adversarial_review`, grandfathered allowlists, source refs, or scope expiry. The track spec explicitly keeps the challenger audit dimension unlanded at `specs/behavioral/cross-model-challenger.md:164-169`.
- Proposed remediation: either stop citing audit as acceptance evidence for this slice, or add a warn/red audit dimension that repeats the Slice 24 grandfather checks and the forward-link `specs/reviews/` path check. At minimum, document that `npm run audit` green says nothing about CHALLENGER-I3 linkage.
- Fold-in discipline label: Scoped to v0.2.

## Operator response (incorporated / scoped — per CHALLENGER-I4)

1. **HIGH #1 — Forward-link path can self-link. Incorporated.** Added
   `CONTRACT_REVIEW_PATH_PATTERN = /^specs\/reviews\/[a-z0-9-]+-md-v\d+\.\d+-codex\.md$/`
   in `tests/contracts/cross-model-challenger.test.ts`, plus a new `it`
   block inside the CHALLENGER-I3 describe — `every
   codex_adversarial_review path matches the canonical contract-review
   filename pattern`. The path must live under `specs/reviews/` and
   match the `<stem>-md-v<major>.<minor>-codex.md` shape. Contract-
   target matching (already present) then closes the loop.

2. **HIGH #2 — Allowlist binds basename, not contract identity.
   Incorporated.** Replaced `GRANDFATHERED_CONTRACT_ALLOWLIST` (Set of
   strings) with a typed `GrandfatheredRecord[]` that binds each entry
   to exact `contract` + `version` + `schema_source` values. New test
   `grandfathered contracts bind to their allowlist record by contract
   + version + schema_source (identity gate, HIGH #2)` fails on any
   mismatch. A future rename that keeps the filename `step.md` but
   mutates the `contract:` or `version:` field now fails the
   allowlist. Basename check retained as a fast first gate.

3. **MED #3 — `expires_on_contract_change: true` is asserted but never
   operative. Incorporated (folded into HIGH #2).** With the identity
   gate in HIGH #2 active, any change to the version or schema_source
   fields re-opens the grandfather mechanically. `expires_on_contract_change:
   true` is now structural, not declarative — the assertion is retained
   as a human-readable tripwire alongside the operative machinery.

4. **MED #4 — `grandfathered_source_ref` is not resolved and includes
   mutable anchors. Incorporated.** Field parses whitespace-separated
   `commit:<7-40 hex sha>` and `path:<relpath>` tokens; each
   allowlist-required token must be present, and each must resolve
   (commits via `git cat-file -e`, paths via `existsSync`).
   Supplemental PROJECT_STATE.md anchors moved out of the operative
   value. Note: the step.md `commit:` anchor is corrected to
   `commit:4b6688e` (the Slice 2 commit that actually added the
   Gate.source discriminated union + STEP-I1..I7); the prior
   `commit f5a6241` reference was the Phase-0 close commit and did
   not carry the MED-#7 evidence — a factual error that Slice 24
   fold-in now corrects.

5. **MED #5 — `grandfathered_scope` is free prose that can silently
   expand. Incorporated.** Added a structured `grandfathered_scope_ids`
   field (whitespace-separated invariant ids). Test asserts the field
   matches the allowlist set exactly AND each id appears as a
   `- **<id> —` heading in the contract body. Prose `grandfathered_scope`
   is retained as human-readable documentation of the same
   boundary. A future edit that broadens the prose to "any change"
   without adding the corresponding scope ids to the allowlist will
   fail the set-equality gate.

6. **MED #6 — Exit path permits double-counting. Incorporated.** New
   XOR test `no contract carries both codex_adversarial_review and
   codex_adversarial_review_grandfathered`. Exit from grandfathering
   is now: land a proper review, add `codex_adversarial_review`,
   remove `codex_adversarial_review_grandfathered` AND the allowlist
   record, all in the same slice.

7. **MED #7 — Behavioral track spec still documents the old generic
   grandfather path. Incorporated.** Updated `specs/behavioral/cross-
   model-challenger.md` §Planned test location to describe the Slice 24
   shape: XOR gate, typed-record allowlist, identity binding, source_ref
   token resolution, scope_ids exact-set equality, forward-link
   pattern, exit path. `planned_tests` frontmatter field also updated
   to reference the Slice 24 tightening.

8. **MED #8 — Step scope omits `src/schemas/gate.ts`. Incorporated.**
   Updated `specs/contracts/step.md` `grandfathered_scope` prose to
   name both `src/schemas/step.ts` AND `src/schemas/gate.ts` as the
   covered schema files. STEP-I3/I4's Gate.source evidence lives
   primarily in `src/schemas/gate.ts`; the grandfather now correctly
   names it.

9. **MED #9 — Audit remains blind to the grandfathered-review
   invariant. Scoped to v0.2.** The audit-side enforcement is a
   separate concern: adding `scripts/audit.mjs` dimensions that
   repeat CHALLENGER-I3 would be constructive but is outside the
   scope of a Phase 1 close fold-in. Logged as v0.2 challenger-track
   work. Slice 24's acceptance evidence does cite `npm run audit
   10/0/0` as part of the general discipline-gate set; the audit does
   NOT enforce CHALLENGER-I3 linkage specifically (that's the vitest
   contract test). PROJECT_STATE.md notes this gap explicitly after
   Slice 24.

## Closing verdict

ACCEPT (after fold-in). 8 of 9 objections incorporated within Slice 24;
1 scoped to v0.2 (MED #9, audit-side repetition of CHALLENGER-I3
invariants). Test count: 29 passed on `cross-model-challenger.test.ts`
(was 24 pre-fold-in; +5 net new assertions: identity gate, source_ref
resolvability, scope_ids + body headings, XOR, forward-link pattern —
with the earlier flat "required fields" test removed and replaced by
the stronger per-record checks).
