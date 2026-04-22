---
plan: slice-47-hardening-foldins
status: in-progress
opened_at: 2026-04-22
opened_in_session: overnight-autonomy-2026-04-22
trigger: |
  Comprehensive Phase 2-to-date adversarial review (specs/reviews/phase-2-to-date-comprehensive-{claude,codex}.md, authored 2026-04-21 → 2026-04-22) returned a verdict split:
  - Claude fresh-read prong: ACCEPT-WITH-FOLD-INS (3 HIGH / 4 MED / 2 LOW / 2 META)
  - Codex cross-model prong: REJECT-PENDING-FOLD-INS (6 HIGH / 3 MED / 3 LOW / 3 META)
  Two CONVERGENT HIGHs:
  - resolved_selection stub at dispatch-materializer.ts:122-134 (load-bearing audit-trail falsification)
  - P2-MODEL-EFFORT plan-vs-schema drift at phase-1-close-revised.md:612-620 vs selection-policy.ts:70-96
  Codex prong's disposition #1 (REJECT-PENDING-FOLD-INS): block the next privileged runtime slice (P2.8, P2-MODEL-EFFORT) until hardening fold-ins land.
authority:
  - specs/reviews/phase-2-to-date-comprehensive-codex.md (operative verdict)
  - specs/reviews/phase-2-to-date-comprehensive-claude.md (concurring + 2 convergent HIGHs)
  - CLAUDE.md §Cross-slice composition review cadence (this plan IS an arc of ≥3 slices, requires arc-close composition review)
---

# Slice 47 Hardening Fold-In Arc

This plan structures the response to the comprehensive Phase 2-to-date review. The arc is intentionally sequenced so each slice restores audit honesty over a different failure mode and the arc closes with a two-prong composition review per CLAUDE.md cadence rule.

## Continuity decisions baked into this plan

From `continuity-66d08e55-4d6b-4bce-b9f9-873728ba2f32`:

- **Claude HIGH 3 (stdio concurrency) is mis-diagnosed.** Real concern under concurrency is memory budget (16 MiB × N buffered). DEFERRED to Slice 49 (runtime threading). Not in this arc's scope.
- **Claude MED 3 (continuity narrative .min(1)) is FALSE.** `src/schemas/continuity.ts:37-43` already has `.min(1)`. STRIKE from fold-in list.
- **Codex HIGH 5 (challenger-policy drift) requires a genuine policy decision.** Operator must choose: enforce "any ratchet change" literally OR narrow to "ratchet weakening / governance movement." Slice 47c presents the choice; do not silently pick.
- **Codex HIGH 1 (npm run audit red) was confirmed RED in operator's local environment** at session start, but for a different reason than Codex's sandbox: the new untracked review files break `tests/contracts/cross-model-challenger.test.ts` because the classifier doesn't recognize "phase" review kind. The tsx EPERM dependency is also real and is folded into Slice 47b.

## Arc structure

### Slice 47 — META: Phase-review classifier + commit comprehensive review files

**Lane:** Ratchet-Advance (extends test enforcement to recognize a new review kind)
**Failure mode addressed:** Authoring a comprehensive phase-to-date review breaks the cross-model-challenger classifier because no `phase` kind exists. The two review files are unclassifiable + uncommitted, leaving audit RED.
**Acceptance evidence:** `npm run audit` returns to green. New it() test in `cross-model-challenger.test.ts` validates that phase-review records carry `target_kind: phase` + base + phase-specific keys. Both review files committed.
**Alternate framing:** Could rename files to use the `-transcript` suffix dodge (foundation review precedent). Rejected because the comprehensive review is an authored review document, not a Codex CLI transcript; categorizing it methodologically is the right move.
**Trajectory check:** This slice serves the ceremony arc (47-prep through 47d). The arc serves the goal of restoring audit honesty before P2.8 / P2-MODEL-EFFORT. Earlier slices have not made this work obsolete; in fact slice 46b (the last before this) is what triggered the review in the first place.

**Scope:**
1. Add frontmatter to `specs/reviews/phase-2-to-date-comprehensive-{claude,codex}.md` (base required keys + phase-specific extras: review_target, target_kind=phase, phase_target, phase_version, opening_verdict, closing_verdict).
2. Extend `tests/contracts/cross-model-challenger.test.ts`:
   - Add `if (/^phase-/.test(base)) return 'phase';` to `classifyReview`.
   - Add `PHASE_REVIEW_ADDITIONAL_KEYS` constant.
   - Add it() block validating phase reviews (parallel to ADR + arc validators).
3. Amend `specs/behavioral/cross-model-challenger.md` v0.1 prose to mention the phase review kind in §Planned test location.
4. Commit Slice 47 with both review files + classifier extension.

**Ratchet:** This slice adds new it() declarations. Floor does NOT advance (per Codex HIGH 5 ambiguity — defer floor decisions until 47c policy ruling). New tests bump count above pinned floor of 988; audit still passes.

**Codex challenger:** NOT required under either reading of HIGH 5. No floor advance, no governance-surface movement, no contract version bump. The classifier extension is mechanical (extends existing closed enum by one).

### Slice 47a — Convergent HIGH A (provenance) + HIGH 4 (AGENT_SMOKE schema v2) + Convergent HIGH B (plan amendment)

**Lane:** Ratchet-Advance (real audit-trail data + tightened smoke fingerprint; advances correctness)
**Failure mode addressed:** `dispatch-materializer.ts:122-134` writes hardcoded empty selection + 'default' provenance on every `dispatch.started` event, falsifying the audit trail consumed by P2.8 and P2-MODEL-EFFORT. AGENT_SMOKE fingerprint cannot detect adapter-source drift the way CODEX_SMOKE can.
**Acceptance evidence:** `materializeDispatch` requires `resolvedSelection` + `resolvedFrom` parameters; callers pass real values. New tests verify non-empty selection on dispatch.started events. AGENT_SMOKE schema v1→v2 with `adapter_source_sha256` + `cli_version` + symmetric Check 30 drift detection. `phase-1-close-revised.md:612-620` text amended to first-class `selection.model` / `selection.effort`.
**Alternate framing:** Could split AGENT_SMOKE v2 into a separate slice (47a-2). Rejected: the surface is identical to Slice 45's CODEX_SMOKE work, and bundling keeps the symmetric closure visible in one commit.
**Trajectory check:** This slice serves the ceremony arc. The arc serves restoring audit honesty before P2.8 / P2-MODEL-EFFORT. Slice 45's Codex work mapped this exact remediation; HIGH 4 is the symmetric gap left open at that time.

**Scope:**
1. Extend `DispatchMaterializeInput` interface with `resolvedSelection: ResolvedSelection` + `resolvedFrom: DispatchResolutionSource`.
2. Update both caller sites (`agent.ts`, `codex.ts`) to pass real values from selection resolver. Fail closed if caller can't provide them.
3. Add tests asserting non-empty `resolved_selection` when override applied; non-default `resolved_from` when explicit.
4. Promote AGENT_SMOKE fingerprint v1 → v2: add `adapter_source_sha256` (covering `agent.ts`, `shared.ts`, `dispatch-materializer.ts`, `runner.ts`) + `cli_version`.
5. Update Check 30 (`checkAgentSmokeFingerprint`) to detect adapter-source drift, parallel to Check 32 (`checkCodexSmokeFingerprint`).
6. Refresh `tests/fixtures/agent-smoke/last-run.json` via `AGENT_SMOKE=1 UPDATE_AGENT_FINGERPRINT=1` — **operator-local action**. v2 SUPPORT (writer + audit gate) lands in this slice; the live fixture is intentionally stale (audit reports yellow with explicit remediation) until the operator runs the gated promotion in an environment with the live `claude` CLI available. Slice 47a Codex challenger MED 1 disposition: language amended to acknowledge SUPPORT vs PROMOTED-EVIDENCE distinction.
7. Amend `specs/plans/phase-1-close-revised.md:612-620` (Convergent HIGH B): replace `invocation_options.model` / `invocation_options.effort` text with first-class `selection.model` / `selection.effort` per current `SelectionOverride` schema.

**Ratchet:** Adds tests + advances AGENT_SMOKE schema. Floor advance candidate; defer to 47c to align with policy decision.

**Codex challenger:** REQUIRED. This slice modifies a runtime adapter and adds enforcement on dispatch event provenance. It is a privileged runtime change. Per CLAUDE.md current literal text, dispatch through `/codex`.

### Slice 47b — Hook-script behavioral tests + portable engine helper + tsx EPERM fix (Codex HIGH 2 + HIGH 1)

**Lane:** Ratchet-Advance (closes hollow CC#P2-4 with real behavioral coverage)
**Failure mode addressed:** CC#P2-4 closed at Slice 46b but the lifecycle test invokes `.circuit/bin/circuit-engine` directly (not the `.claude/hooks/SessionStart.sh` / `SessionEnd.sh` scripts the criterion names), AND `.gitignore:16-21` ignores `.circuit/` so the engine shim is untracked — clean clone fails. The hook-audit tests only check presence/executable/text-wiring, not behavior.
**Acceptance evidence:** New tests EXECUTE the `.sh` hook scripts against ephemeral project roots and assert banner/summary text content (snapshot or substring assertion). Portable tracked test helper provides `circuit-engine` for the test suite (or documents the gate). `npm run audit` portable across operator-local + sandboxed environments (tsx IPC EPERM resolved or gated explicitly).
**Alternate framing:** Could leave engine dependency as-is and add `.circuit/bin/circuit-engine` to repo. Rejected: that pollutes the repo with build artifacts. Better: a deliberate portable test helper (e.g., `tests/helpers/spawn-engine.ts`) that the CI environment can use.
**Trajectory check:** This slice REOPENS CC#P2-4 because the prior close was hollow. The arc serves restoring audit honesty before P2.8 / P2-MODEL-EFFORT. The reopen is the unavoidable cost of the overclaim per continuity record.

**Scope:**
1. REOPEN CC#P2-4 in PROJECT_STATE / ADR-0007 close-criterion ledger. (Done as a state-flip; no ADR amendment required because the criterion text never changed.)
2. Author portable test helper for `circuit-engine` invocation (or commit a tracked test-only stub).
3. Add `tests/runner/session-hook-behavior.test.ts` (or extend existing) executing both hook scripts with controlled inputs and asserting:
   - SessionStart on empty continuity → banner shows "no pending continuity" semantic
   - SessionStart on saved continuity → banner shows pending narrative
   - SessionEnd → summary line emitted
4. Fix `tests/runner/dogfood-smoke.test.ts:236-262` tsx IPC EPERM dependency (Codex HIGH 1).
5. Re-close CC#P2-4 with the behavioral coverage in place.

**Ratchet:** Adds tests, modifies existing CC close ledger.

**Codex challenger:** REQUIRED. Touches CC close criterion + audit gate; governance surface.

### Slice 47c — ADR-0007 firewall: scrub 'N/8' wording + audit check + CLAUDE.md challenger-policy decision (Codex HIGH 5 + HIGH 6)

**Lane:** Ratchet-Advance (audit check rejecting forbidden ADR-0007 phrases) + Governance-surface movement (CLAUDE.md amendment)
**Failure mode addressed:** ADR-0007:621-649 explicitly forbids "N-of-8 complete" / "N/8" / scalar close-progress wording, but PROJECT_STATE.md, phase-2-implementation.md, and ratchet-floor.json all use "Phase 2 close count 2/8 → 3/8" and similar. Direct ADR violation on operator-facing surfaces. Separately, CLAUDE.md says Codex required for "any ratchet change" but multiple recent slices skipped Codex — policy-vs-practice mismatch.
**Acceptance evidence:** Forbidden phrases removed from PROJECT_STATE.md, plan files, ratchet-floor.json notes, README. New audit Check 34 (or extension to Check 22) rejects forbidden phrases in tracked files. CLAUDE.md amended to either enforce "any ratchet change" literally OR narrow to "ratchet weakening / governance movement" — operator picks; both options written into the slice's framing for operator review BEFORE commit.
**Alternate framing:** Could leave the forbidden phrases as-is and just add the audit check (which would land RED). Rejected: that creates a known-broken state until a follow-up scrub. Doing both in one slice is cleaner.
**Trajectory check:** This slice serves the ceremony arc. The arc serves restoring audit honesty before P2.8 / P2-MODEL-EFFORT. The challenger-policy amendment is load-bearing for ALL future ratchet decisions.

**Scope:**
1. Scrub forbidden ADR-0007 scalar progress phrases from:
   - `PROJECT_STATE.md` (multiple sites)
   - `specs/plans/phase-2-implementation.md`
   - `specs/ratchet-floor.json` notes field
   - `README.md`
   - any other tracked file containing the forbidden patterns
2. Replace with per-criterion list wording per ADR-0007 §Decision.3.
3. Add audit check (extend Check 22 or new Check 34) that rejects forbidden phrases in tracked files.
4. Present operator with the challenger-policy choice. Land the chosen amendment in CLAUDE.md and update `specs/behavioral/cross-model-challenger.md` track to match.
5. Reopen CC#P2-4 sticker — already done in 47b but re-document under per-criterion list wording.

**Ratchet:** Adds audit check, amends governance surface (CLAUDE.md).

**Codex challenger:** REQUIRED under either reading of HIGH 5 (governance surface movement is unambiguous).

### Slice 47d — Arc-close composition review + ratchet floor advance

**Lane:** Equivalence Refactor (arc close + per-criterion ledger reorganization) + Discovery (composition review)
**Failure mode addressed:** Arc spans ≥3 slices touching privileged runtime (47a) + governance surface (47c). Per CLAUDE.md §Cross-slice composition review cadence, requires two-prong arc-close composition review BEFORE next privileged runtime slice (P2.8 / P2-MODEL-EFFORT) opens.
**Acceptance evidence:** Both `specs/reviews/arc-slice-47-{claude,codex}.md` prong files committed in same commit as `current_slice` advance per Check 26. Arc-close verdicts ACCEPT or ACCEPT-WITH-FOLD-INS. Ratchet floor advanced for all test additions across 47-prep / 47a / 47b / 47c if policy decision (47c) authorizes.
**Alternate framing:** Could split arc-close into separate composition-review slice (47d-1) and floor-advance slice (47d-2). Rejected: same-commit staging discipline (Check 26) requires the prong files + slice marker advance in one commit; splitting breaks that.

**Scope:**
1. Author Claude composition-adversary prong over Slices 47-prep / 47a / 47b / 47c.
2. Dispatch Codex cross-model challenger over the same arc via `/codex` skill.
3. Stage prong files + advance `current_slice` to 47d in single commit.
4. Advance ratchet floor per accumulated test additions across the arc (subject to 47c policy decision).

**Ratchet:** Floor advance candidate.

**Codex challenger:** Arc-close composition review IS the Codex challenger pass.

## Out of arc scope (reserved for follow-up slices)

| Finding | Disposition |
|---------|-------------|
| Claude HIGH 3 (stdio boundary) | Slice 49 (runtime threading) — mis-diagnosed; real concern is memory budget, not parse corruption |
| Claude MED 1 (domain.md stale) | Fold into next slice touching dispatch/roles |
| Claude MED 2 (explore phase-level goals) | P2.5 e2e parity gate work |
| Claude MED 3 (continuity .min(1)) | STRIKE — schema already enforces |
| Claude MED 4 (ratchet floor narrative) | Fold into next floor-advance slice |
| Claude LOW 1 (CLAUDE.md §Where things live) | Fold into 47c |
| Claude LOW 2 (backing-path normalization) | 2-min code comment, fold into 47b |
| Claude META 1 (composition review trigger manual) | Post-Phase-2 |
| Claude META 2 (framing triplet yellow) | Investigate + decide in this arc — fold into 47-prep or 47c |
| Codex MED 1 (P2-MODEL-EFFORT plan drift) | Folded into 47a |
| Codex MED 2 (P2.10 reopen-trigger audit) | Reserve for P2.10 work |
| Codex MED 3 (circuit-explore.md "subprocess") | Fold into 47c |
| Codex LOW 1 (artifacts.md count stale) | Fold into 47-prep or 47c |
| Codex LOW 2 (audit Check-N numbering) | 2-min cleanup, fold into 47c |
| Codex LOW 3 (banner shape pinning) | Fold into 47b |
| Codex META 1-3 | Documentation hardening — fold into 47d arc-close commit |

## Close criterion

This arc closes when:
1. `npm run audit` is GREEN in the operator's local environment AND the sandboxed agent environment.
2. The five-event dispatch transcript carries real selection + provenance data (47a).
3. CC#P2-4 is honestly closed via behavioral coverage of hook scripts (47b).
4. ADR-0007 firewall is enforced + CLAUDE.md challenger-policy is unambiguous (47c).
5. Arc-close composition review accepts (47d).
6. Two convergent HIGHs from the comprehensive review are folded in.
7. All 6 Codex HIGHs + 3 Claude HIGHs (HIGH 3 deferred per continuity decision) are folded in or explicitly deferred with rationale.

After arc close, the next session can open P2-MODEL-EFFORT or P2.8 router work against an honest audit baseline.
