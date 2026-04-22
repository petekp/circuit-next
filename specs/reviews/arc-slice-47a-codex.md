---
name: arc-slice-47a-codex
description: Cross-model challenger pass over Slice 47a (dispatch-event provenance + AGENT_SMOKE schema v2 + P2-MODEL-EFFORT plan amendment). Per-slice review per CLAUDE.md §Hard invariants #6 — privileged runtime change + audit gate advancement + governance plan amendment. Returns OBJECTION LIST per CHALLENGER-I1.
type: review
reviewer_model: gpt-5-codex
reviewer_model_id: gpt-5-codex
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-22
verdict: REJECT-PENDING-FOLD-INS -> incorporated -> ACCEPT-WITH-FOLD-INS
authored_by: gpt-5-codex
review_target: slice-47a-dispatch-event-provenance
target_kind: arc
target: slice-47a
target_version: "HEAD=db5253d (slice-47a)"
arc_target: slice-47a-single-slice
arc_version: "HEAD=db5253d (slice-47a)"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  high: 3
  med: 2
  low: 2
  meta: 1
commands_run:
  - git log --oneline -5
  - git diff db5253d..7a08938 -- src/runtime/adapters/dispatch-materializer.ts
  - cat src/runtime/runner.ts
  - cat scripts/audit.mjs
  - cat tests/runner/runner-dispatch-provenance.test.ts
  - cat tests/contracts/slice-43c-agent-smoke-fingerprint.test.ts
  - cat tests/runner/explore-e2e-parity.test.ts
  - cat specs/contracts/selection.md
  - cat specs/plans/phase-1-close-revised.md
  - npm run verify
opened_scope:
  - src/runtime/adapters/dispatch-materializer.ts
  - src/runtime/runner.ts
  - src/runtime/adapters/agent.ts
  - src/runtime/adapters/codex.ts
  - src/schemas/selection-policy.ts
  - scripts/audit.mjs
  - tests/runner/runner-dispatch-provenance.test.ts
  - tests/contracts/slice-43c-agent-smoke-fingerprint.test.ts
  - tests/runner/explore-e2e-parity.test.ts
  - tests/runner/runner-dispatch-adapter-identity.test.ts
  - specs/contracts/selection.md
  - specs/plans/phase-1-close-revised.md
  - specs/plans/slice-47-hardening-foldins.md
  - tests/fixtures/agent-smoke/last-run.json
skipped_scope:
  - bootstrap/** (Phase 0 evidence loop, frozen)
  - prior-gen circuit (read-only reference per CLAUDE.md)
---

# Cross-model challenger review — Slice 47a

**Verdict (opening):** REJECT-PENDING-FOLD-INS
**Verdict (closing):** ACCEPT-WITH-FOLD-INS *(after this slice's fold-in commit)*

## HIGH

### HIGH 1 — `deriveResolvedSelection` still emits silently wrong `ResolvedSelection.skills` for legal `append` / `remove` overrides

**Finding:** `deriveResolvedSelection` collapses any non-`inherit` `SkillOverride` to its raw `skills` payload, then chooses `stSkills ?? wfSkills`. The selection contract defines real composition as `inherit` no-op, `replace` set, `append` union, and `remove` difference.

**Evidence:** `src/runtime/runner.ts:237` (skillsFor helper) + `src/runtime/runner.ts:244` (`stSkills ?? wfSkills`). Composition spec at `specs/contracts/selection.md:288`. New tests cover replace/field collision, NOT append/remove.

**Impact:** A valid workflow with `workflow.default_selection.skills = replace ['tdd', 'react-doctor']` and a step `skills = remove ['tdd']` records `['tdd']`, not `['react-doctor']`. That preserves the exact class of false audit-trail data this slice is meant to eliminate.

**Remediation:** Implement the two-layer skill fold for `inherit` / `replace` / `append` / `remove` now (it is small), and add runner tests for append, remove, empty append/remove no-op, and replace-clear.

**Disposition:** Incorporated. `applySkillOp` helper added; full 4-mode composition (inherit/replace/append/remove); 4 new tests cover the previously-untested modes.

### HIGH 2 — AGENT_SMOKE v2 does not actually bind `cli_version`

**Finding:** The agent adapter captures the real CLI version in `DispatchResult` from `init.claude_code_version`, but the AGENT fingerprint writer reads `process.env.AGENT_CLI_VERSION ?? 'claude (unknown)'`. The audit check treats `cli_version` as an optional display suffix — a schema v2 fingerprint with no/unknown `cli_version` can still go green.

**Evidence:** Adapter capture at `src/runtime/adapters/agent.ts:333` (parseAgentStdout extracts `cli_version = initEvent.claude_code_version`). Fingerprint writer at `tests/runner/explore-e2e-parity.test.ts:337`. Audit treatment at `scripts/audit.mjs:3853` (cli_version is suffix-only).

**Impact:** The claimed "adapter_source_sha256 + cli_version binding" is only half-enforced. A missing, stale, or operator-invented agent CLI version is not detected.

**Remediation:** Propagate `dispatchResult.cli_version` onto an explicit runner return field (or a dispatch event) and have the fingerprint writer read that. Check 30 should reject schema v2 fingerprints with missing/empty/unknown `cli_version`.

**Disposition:** Incorporated. `DogfoodRunResult` gains `dispatchResults: { stepId, adapterName, cli_version }[]` populated by the runner. Test reads cli_version from `outcome.dispatchResults[0]?.cli_version`. Audit Check 30 rejects v2 fingerprints with missing/empty/`(unknown)` cli_version.

### HIGH 3 — CODEX_SMOKE drift detection remains asymmetric after `runner.ts` became a shared dispatch-event provenance surface

**Finding:** `CODEX_ADAPTER_SOURCE_PATHS` still includes only codex/shared/materializer. Slice 47a moved resolved selection/provenance derivation into `runner.ts` at the dispatch call site. A codex-shaped dispatcher through `runDogfood` is already a supported regression surface (`tests/runner/runner-dispatch-adapter-identity.test.ts:83`).

**Evidence:** `scripts/audit.mjs:3877` (`CODEX_ADAPTER_SOURCE_PATHS` = `[codex.ts, shared.ts, dispatch-materializer.ts]`, no runner.ts). Runner provenance derivation at `src/runtime/runner.ts:430` (`materializeDispatch` call site).

**Impact:** A future edit to `runner.ts` can falsify codex `dispatch.started` provenance without tripping CODEX_SMOKE drift, while the same class of agent transcript edit now trips AGENT_SMOKE. That is the governance asymmetry this slice was supposed to remove.

**Remediation:** Either explicitly narrow CODEX_SMOKE to the direct `dispatchCodex → materializeDispatch` surface, or add `src/runtime/runner.ts` to `CODEX_ADAPTER_SOURCE_PATHS` and the codex fingerprint writer path list, with a contract test pinning the list.

**Disposition:** Incorporated. Added `src/runtime/runner.ts` to `CODEX_ADAPTER_SOURCE_PATHS`. Updated `tests/runner/codex-dispatch-roundtrip.test.ts` adapter source path list. Added contract test pinning the symmetric source-path list.

## MED

### MED 1 — The slice plan says to refresh the AGENT_SMOKE fixture, but the committed fixture is still v1

**Finding:** The 47a plan scope says "Refresh `tests/fixtures/agent-smoke/last-run.json` via `AGENT_SMOKE=1 UPDATE_AGENT_FINGERPRINT=1`." The fixture still has `"schema_version": 1`.

**Evidence:** `specs/plans/slice-47-hardening-foldins.md:70`. Fixture at `tests/fixtures/agent-smoke/last-run.json:2`.

**Impact:** The audit yellow is honest, but the slice overstates "promotion" as completed. It landed a writer/check path, not the promoted evidence artifact.

**Remediation:** Either run the gated promotion and commit v2, or revise the status/plan language to say v2 support is landed and the live fixture remains intentionally stale until re-promoted.

**Disposition:** Incorporated. Plan + status language amended to acknowledge v2 SUPPORT landed; live fixture intentionally stale until operator runs `AGENT_SMOKE=1 UPDATE_AGENT_FINGERPRINT=1`. Cannot run AGENT_SMOKE in this environment (would require live `claude` CLI invocation which Codex sandbox forbids; deferring to operator-local refresh).

### MED 2 — Verification evidence is not reproducible in this environment

**Finding:** `npm run verify` fails in `tests/runner/dogfood-smoke.test.ts` at the `tsx` subprocess call with `listen EPERM` on the tsx IPC pipe. `PROJECT_STATE.md` claims `npm run verify` green.

**Evidence:** `tests/runner/dogfood-smoke.test.ts:262` (tsx subprocess). `PROJECT_STATE.md:7` ("npm run verify green" claim).

**Impact:** The slice's acceptance evidence is false for this challenger environment. May be the already-planned 47b EPERM fix.

**Remediation:** Fix the CLI test portability now or mark the verification claim as environment-contingent and keep the red/yellow state explicit.

**Disposition:** Incorporated (language only). PROJECT_STATE narrative + plan language amended to acknowledge environment-contingency. EPERM fix proper scoped to Slice 47b per the plan.

## LOW

### LOW 1 — P2-MODEL-EFFORT text still overclaims model allowlist validation

**Finding:** The amended plan says `selection.model` is "schema-validated against an allowlist." Current `ProviderScopedModel` deliberately uses an open model string.

**Evidence:** `specs/plans/phase-1-close-revised.md:613`. Schema at `src/schemas/selection-policy.ts:5`.

**Impact:** Smaller future-plan drift: schema allowlist vs adapter-owned model validation.

**Remediation:** Rephrase to "provider enum schema-validated; model id adapter-validated" unless P2-MODEL-EFFORT intentionally changes `ProviderScopedModel`.

**Disposition:** Incorporated. Plan text rephrased to "provider enum schema-validated; model id adapter-validated."

### LOW 2 — Adapter-source hashes include absolute paths

**Finding:** AGENT hash updates with `abs` (absolute path); the AGENT writer mirrors absolute `resolve()` paths.

**Evidence:** `scripts/audit.mjs:3726` (`AGENT_ADAPTER_SOURCE_PATHS` hash). `tests/runner/explore-e2e-parity.test.ts:63` (test helper).

**Impact:** Moving the repo or cloning to a different absolute path can create false drift even with identical source bytes.

**Remediation:** Hash relative path labels plus file bytes, not absolute host paths.

**Disposition:** Deferred. Same surface in CODEX hash since Slice 45; fixing both for symmetry requires re-fingerprinting. Captured as a known follow-up; documented but not folded in this slice.

## META

### META 1 — Ratchet-floor wording vs deferral

**Finding:** Calling Slice 47a a "ratchet advance" while leaving the pinned floor unchanged is methodologically tense. Codex HIGH 5 from the comprehensive review named this exact pattern as policy-vs-practice drift. The deferral to 47c/47d is defensible as a STAGED policy decision, but the wording should be resolved cleanly.

**Disposition:** Acknowledged. The slice's PROJECT_STATE narrative names floor-deferral explicitly. Slice 47c will land the policy decision per the plan.

## Trajectory check

The slice is pointed in the right direction: it tries to make dispatch events honest before router/model-effort work builds on them. Drift has crept in at the edges in the original landing — legal skill composition is still false, cli_version binding is not real, and the CODEX/AGENT fingerprint surfaces are now inconsistent. **Post-fold-in (this commit), all three HIGHs are closed and the closing verdict moves to ACCEPT-WITH-FOLD-INS** (LOW 2 + MED-deferred items remain as documented follow-ups).
