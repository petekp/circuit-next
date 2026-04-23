---
name: arc-slice-54-codex
description: Cross-model challenger pass over Slice 54 (materializer schema-parse — Codex H15 fold-in; Clean-Clone Reality Tranche slice 3 of 4). Per-slice review per CLAUDE.md §Hard invariants #6 — ratchet change + privileged runtime (new artifact-schema registry module; runner-level schema-parse wiring around Slice 53's gate-evaluation boundary; new test surface). Returns OBJECTION LIST per CHALLENGER-I1. Satisfies scripts/audit.mjs Check 35 (checkCodexChallengerRequiredDeclaration) for the Slice 54 commit.
type: review
reviewer_model: gpt-5.4
reviewer_model_id: gpt-5-codex
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-23
verdict: ACCEPT-WITH-FOLD-INS
authored_by: gpt-5-codex
review_target: slice-54-materializer-schema-parse
target_kind: arc
target: slice-54
target_version: "HEAD=f12c6c2 (Slice 53 landed) → <new-SHA-at-Slice-54-landing>"
arc_target: clean-clone-reality-tranche
arc_version: "third execution slice in the tranche (52 + 53 done, 54 in this commit, 55 remaining); arc closes at Slice 55 arc-close composition review"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  high: 1
  med: 2
  low: 1
  meta: 1
commands_run:
  - read staged diff via `git diff --cached` (pre-fold-in and post-fold-in passes)
  - read src/runtime/artifact-schemas.ts (new module — registry + parseArtifact)
  - read src/runtime/runner.ts (dispatch branch — parseArtifact wiring after Slice 53 gate-eval)
  - read src/runtime/adapters/dispatch-materializer.ts (header comment change only)
  - read tests/runner/materializer-schema-parse.test.ts (new test surface — pre-fold-in 4 cases, post-fold-in case (c) expanded)
  - read tests/runner/gate-evaluation.test.ts (Slice 53 surface this slice must compose with without drift)
  - read tests/runner/agent-dispatch-roundtrip.test.ts + tests/runner/codex-dispatch-roundtrip.test.ts (direct materializeDispatch callers — must continue to pass)
  - read scripts/audit.mjs §AGENT_ADAPTER_SOURCE_PATHS + §CODEX_ADAPTER_SOURCE_PATHS (HIGH 1 fingerprint surface binding)
  - read specs/contracts/explore.md §Dispatch artifact schema-parse (new subsection) + §Dispatch gate-evaluation semantics (Slice 53 binding)
  - read specs/plans/clean-clone-reality-tranche.md §Slice 54 (pre-fold-in and post-fold-in passes) + §Slice 55 + §Arc close criterion
  - read specs/reviews/phase-project-holistic-2026-04-22-codex.md §HIGH 15 (originating finding)
  - read specs/reviews/arc-slice-53-codex.md (prior-slice review shape)
  - read specs/adrs/ADR-0008-dispatch-granularity-modeling.md §Decision.3a (materialization rule)
  - ran targeted Vitest cluster — materializer-schema-parse + gate-evaluation + agent/codex direct materializer roundtrips — all green
  - ran npm run check (tsc --strict) — green
  - ran git diff --cached --check — green
  - ran npm run audit — 32 green / 2 yellow / 0 red (expected fingerprint-drift yellows per tranche compounding pattern)
opened_scope:
  - src/runtime/artifact-schemas.ts (new module under review)
  - src/runtime/runner.ts (dispatch branch — parseArtifact wiring around Slice 53's evaluateDispatchGate)
  - src/runtime/adapters/dispatch-materializer.ts (header comment change; body unchanged)
  - tests/runner/materializer-schema-parse.test.ts (new test surface; post-fold-in case (c) expanded to match case (b) depth for MED 2)
  - tests/runner/explore-e2e-parity.test.ts (post-fold-in — AGENT_ADAPTER_SOURCE_PATHS extension for HIGH 1)
  - tests/runner/codex-dispatch-roundtrip.test.ts (post-fold-in — ADAPTER_SOURCE_PATHS extension for HIGH 1)
  - scripts/audit.mjs §AGENT_ADAPTER_SOURCE_PATHS + §CODEX_ADAPTER_SOURCE_PATHS (post-fold-in — registry added for HIGH 1)
  - specs/contracts/explore.md (new §Dispatch artifact schema-parse subsection + narrowed pre-Slice-53 disclosure)
  - specs/plans/clean-clone-reality-tranche.md §Slice 54 (post-fold-in — scope rewrite + alternate-framing rewrite + arc-close criterion fix for MED 1)
  - PROJECT_STATE.md (new Slice 54 entry + post-fold-in finding-count disambiguation for LOW 1)
skipped_scope:
  - bootstrap/** (Phase 0 evidence loop, frozen)
  - prior-gen circuit at ~/Code/circuit (read-only reference per CLAUDE.md)
  - src/runtime/adapters/agent.ts + codex.ts (Slice 54 did not modify adapters; agent/codex adapter surface SHAs change only because runner.ts + dispatch-materializer.ts + artifact-schemas.ts are in the fingerprint-binding source-path lists)
  - tests/properties/** (Tier 2+ deferred per CLAUDE.md hard invariants)
  - tests/runner/continuity-lifecycle.test.ts (env-gated to CIRCUIT_HOOK_ENGINE_LIVE=1 per Slice 52; Slice 54 unrelated to that surface)
---

# Slice 54 — materializer schema-parse (Codex H15 fold-in) — Cross-Model Challenger Pass

## Scope

Staged diff at the pre-commit state for Slice 54 of the Clean-Clone Reality Tranche. The slice claims to close the artifact-shape half of the ADR-0008 §Decision.3a materialization rule (symmetric to Slice 53's closure of the verdict-admissibility half). Concretely: a new artifact-schema registry at `src/runtime/artifact-schemas.ts`, runner-layer wiring that calls `parseArtifact` after Slice 53's `evaluateDispatchGate` admits a verdict, conditional artifact-slot inclusion on the `materializeDispatch` call site, a new test file exercising 4 cases through `runDogfood` end-to-end, a new contract subsection in `specs/contracts/explore.md`, and a narrowing of the pre-Slice-53 dishonesty disclosure.

## Opening verdict

**REJECT-PENDING-FOLD-INS.** The runtime behavior largely matches the Slice 54 contract, but one evidence-binding blocker and two documentation/test-surface objections prevent a clean ACCEPT at the first pass.

## Findings

### HIGH

**HIGH 1 — `artifact-schemas.ts` missing from agent/codex fingerprint surface (FOLDED IN).**

File pointers: `scripts/audit.mjs` §AGENT_ADAPTER_SOURCE_PATHS (line 4146), `scripts/audit.mjs` §CODEX_ADAPTER_SOURCE_PATHS (line 4334), `tests/runner/explore-e2e-parity.test.ts:53`, `tests/runner/codex-dispatch-roundtrip.test.ts:70`.

`src/runtime/artifact-schemas.ts` is now a dispatch-outcome source file: a registry edit that tightens a schema or registers/removes a schema name can flip whether `runDogfood` writes the canonical artifact or aborts. But the staged diff does not add it to either adapter smoke fingerprint surface. A future registry change would NOT trip AGENT_SMOKE / CODEX_SMOKE drift, undercutting the exact adapter-source binding Slice 47a added for `runner.ts` (Codex Slice 47a HIGH 3). This is the class of asymmetry the fingerprint surface was generalized to prevent.

Fix: add `src/runtime/artifact-schemas.ts` to `AGENT_ADAPTER_SOURCE_PATHS` and `CODEX_ADAPTER_SOURCE_PATHS` in `scripts/audit.mjs`, plus the mirrored inline lists in `tests/runner/explore-e2e-parity.test.ts` and `tests/runner/codex-dispatch-roundtrip.test.ts`. Update nearby comments to disclose the Slice 54 rationale. Update PROJECT_STATE audit-yellow disclosure to name all 3 runtime files (not 2).

**Disposition: FOLDED IN** at post-fold-in pass. All four locations updated; Slice 47a-class rationale comment added to `audit.mjs`. Post-fold-in `npm run audit` yellows now correctly reference all 3 runtime source files (runner + dispatch-materializer + artifact-schemas).

### MED

**MED 1 — authoritative plan-file §Slice 54 still names rejected-approach scope (FOLDED IN).**

File pointers: `specs/plans/clean-clone-reality-tranche.md:116`, `:119`, `:150`.

The authoritative tranche plan at Slice 54 still says: "(a) Schema-parse at the runner level before calling materializeDispatch. Rejected — duplicates schema logic; the materializer is the right layer." AND: "1. Amend `src/runtime/adapters/dispatch-materializer.ts` to schema-parse result_body against `writes.artifact.schema`. 2. Emit `dispatch.failed` event on parse failure; do not write artifact." The staged implementation and contract deliberately do the opposite: runner-level parse (not materializer-level), no `dispatch.failed` event type (Slice 53 gate-fail event surface instead). The plan's arc close criterion #4 ("failure emits `dispatch.failed`") also disagrees with what the slice actually ships. This leaves Slice 55 with a stale arc-close criterion and future readers with a contradiction between plan authority and landed implementation.

Fix: amend the Slice 54 scope + alternate framing + arc close criterion to say (a) schema-parse lives in the runner before passing `writes.artifact` into `materializeDispatch`, and (b) parse failure emits `gate.evaluated outcome=fail` → `step.aborted` → `run.closed outcome=aborted`, with no `dispatch.failed` event type.

**Disposition: FOLDED IN.** Plan §Slice 54 scope rewritten to 7 explicit steps (new module; runner wiring; materializer header-only change; new test file; contract amendment; Codex HIGH 1 fingerprint surface binding; placeholder-flow verification). Alternate framing rewritten to state (a) "accepted at plan authoring; reversed at landing to runner-layer parse" with rationale + direct-callers-preservation argument, and (b) "accepted as the landed shape — parseArtifact IS that helper." Arc close criterion #4 updated to the gate.evaluated-fail event surface.

**MED 2 — case (c) schema-missing test missed the full uniform failure surface (FOLDED IN).**

File pointer: `tests/runner/materializer-schema-parse.test.ts:244` (pre-fold-in).

Case (c) (unknown schema name → fail-closed) asserted outcome=aborted, absent artifact, and partial reason identity (ge.reason === aborted.reason), but did NOT lock the full uniform failure surface case (b) locks: no step.completed for the dispatch step, run.closed reason byte-identity, on-disk result.json reason, dispatch.completed.verdict === "ok" (observed verdict, not sentinel), transcript slots present. Since unknown-schema is the fail-closed branch most likely to regress independently (a future edit could silently widen the registry to accept unknown names), case (c) should lock as much of the failure-shape surface as case (b) does.

Fix: mirror the case (b) assertions for case (c).

**Disposition: FOLDED IN.** Case (c) expanded to match case (b)'s full assertion surface: transcript slots present; no step.completed for dispatch-step; run.closed outcome=aborted + byte-identical reason; result.json reason mirror; dispatch.completed.verdict === "ok". Locking comment added naming the Codex MED 2 fold-in.

### LOW

**LOW 1 — finding-count inconsistency in PROJECT_STATE Slice 54 entry (FOLDED IN).**

File pointer: `PROJECT_STATE.md:7` (Slice 54 entry).

Trajectory check sentence says "the 39-finding disposition ledger," but the plain-English summary's "What's next" section says "remaining 36 findings" (correct per the continuity banner's 36 project-holistic + 3 session-surfaced = 39 total breakdown). Same entry contradicts itself.

Fix: change both references to the disambiguated phrasing — "39-entry disposition ledger (36 findings from the project-holistic review not folded into Slices 52-54 + 3 session-surfaced items from the Slices 52-54 Codex challenger passes)."

**Disposition: FOLDED IN.** Both the trajectory check sentence and the plain-English "how much is left" beat updated to the 39-entry disambiguated phrasing. Session-surfaced items enumerated (no-verdict sentinel provenance, reason-string length cap, AGENT_SMOKE/CODEX_SMOKE fingerprint yellows).

### META

**META 1 — status-doc red until commit lands; Codex review file must be staged in the same commit (ADDRESSED).**

`npm run audit` currently reports one red because the status-doc `current_slice` markers say 54 while the most recent committed slice in git log is still 53. This clears automatically when the Slice 54 commit with the matching `slice-54:` subject lands. However, the PROJECT_STATE entry claims `specs/reviews/arc-slice-54-codex.md` exists; if it is not staged in the same commit, audit Check 35 (Codex challenger REQUIRED declaration) will fail on the post-commit pass because the commit body declares "Codex challenger: REQUIRED" without a per-slice review record present.

Fix: stage this review file alongside the other Slice 54 artifacts before the commit.

**Disposition: ADDRESSED.** This review file is staged alongside the other Slice 54 artifacts in the same commit. The commit body carries the literal "Codex challenger: REQUIRED" required by Check 35.

## Closing verdict

**ACCEPT-WITH-FOLD-INS.** All 1 HIGH + 2 MED + 1 LOW + 1 META folded into this commit. Verify is green (1125 passed + 19 skipped; +4 new tests from the slice). Audit is 32 green / 2 yellow / 0 red — both yellows are the compounded AGENT_SMOKE/CODEX_SMOKE fingerprint drift yellows from the tranche's runner-surface edits, deferred-with-named-trigger to Slice 55 arc-close or operator-local re-promotion (same Codex META 1 disposition Slice 53 landed). No deferred-with-named-trigger fold-ins beyond the fingerprint yellow pair.

The Slice 54 arc position is now consistent: the contract MUST is closed (artifact write requires both Slice 53 verdict gate pass AND Slice 54 schema-parse pass; unknown schemas fail-closed; failure-path event surface uniform with Slice 53; no new event type), the plan file reflects what actually shipped, the test surface locks both cases (b) and (c) at the same depth, and the fingerprint binding catches future artifact-schema-registry edits.

Slice 55 arc-close composition review is the next slice: two-prong review (fresh-read Claude + Codex cross-model challenger via `/codex`) over Slices 52-54 with explicit disposition of the 36 project-holistic findings + 3 session-surfaced items in the ledger body (per Check 26 same-commit-staging discipline). Both privileged-runtime HIGHs in the arc are now closed (H14 verdict at Slice 53 + H15 materializer at Slice 54).
