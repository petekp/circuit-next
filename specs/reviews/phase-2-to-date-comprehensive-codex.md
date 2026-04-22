---
name: phase-2-to-date-comprehensive-codex
description: Cross-model challenger comprehensive review over Phase 0 → Phase 2 through Slice 46b. Fresh-context audit independent of arc-close ceremony. Looks for accumulated drift between the Phase 2 close-criteria claims, the audit gate's enforcement, the runtime's actual behavior, and the methodology's stated rules. Paired with the Claude fresh-read prong.
type: review
reviewer_model: gpt-5-codex
reviewer_model_id: gpt-5-codex
authorship_role: challenger
review_kind: phase-comprehensive-review
review_date: 2026-04-22
verdict: REJECT-PENDING-FOLD-INS
authored_by: gpt-5-codex
review_target: phase-2-to-date-comprehensive
target_kind: phase
target: phase-2-to-date-through-slice-46b
target_version: "HEAD=ee23c3c (Slice 46b, 2026-04-22)"
phase_target: phase-2
phase_version: "HEAD=ee23c3c (Slice 46b, 2026-04-22)"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: pending-arc-slice-47d
severity_counts:
  high: 6
  med: 3
  low: 3
  meta: 3
commands_run:
  - git log --oneline -60
  - git status --short
  - git diff --name-only 48bcab8..HEAD -- src/runtime/adapters/agent.ts src/runtime/adapters/dispatch-materializer.ts src/runtime/adapters/shared.ts src/runtime/runner.ts
  - npm run audit
  - npm run test -- --run --reporter=default
  - git ls-files --error-unmatch .circuit/bin/circuit-engine
  - git cat-file -e 48bcab8^{commit}
opened_scope:
  - src/runtime/adapters/dispatch-materializer.ts
  - src/runtime/adapters/agent.ts
  - src/runtime/adapters/codex.ts
  - src/runtime/adapters/shared.ts
  - src/runtime/runner.ts
  - src/schemas/selection-policy.ts
  - src/schemas/step.ts
  - src/schemas/workflow.ts
  - tests/runner/dogfood-smoke.test.ts
  - tests/runner/continuity-lifecycle.test.ts
  - tests/runner/explore-e2e-parity.test.ts
  - tests/contracts/session-hooks-present.test.ts
  - tests/fixtures/agent-smoke/last-run.json
  - tests/fixtures/codex-smoke/last-run.json
  - scripts/audit.mjs
  - .claude/hooks/SessionStart.sh
  - .claude/hooks/SessionEnd.sh
  - .claude/settings.json
  - .gitignore
  - CLAUDE.md
  - PROJECT_STATE.md
  - specs/adrs/ADR-0007-phase-2-close-criteria.md
  - specs/adrs/ADR-0009-adapter-invocation-pattern.md
  - specs/contracts/adapter.md
  - specs/contracts/selection.md
  - specs/contracts/explore.md
  - specs/plans/phase-1-close-revised.md
  - specs/plans/phase-2-implementation.md
  - specs/artifacts.md
  - specs/artifacts.json
  - .claude-plugin/commands/circuit-explore.md
skipped_scope:
  - specs/methodology/** (out of scope for Phase 2-to-date drift detection)
  - bootstrap/** (Phase 0 evidence loop, frozen)
  - prior-gen circuit at ~/Code/circuit (read-only reference per CLAUDE.md)
---

# Phase 2-to-date comprehensive composition review — Codex cross-model challenger prong

**Reviewer role:** cross-model challenger (GPT-5 Codex, independent training distribution)  
**Scope:** Phase 0 → Phase 2 through Slice 46b (HEAD: ee23c3c)  
**Date:** 2026-04-22 (overnight autonomy session)  
**Verdict:** REJECT-PENDING-FOLD-INS

## Summary

Phase 2-to-date is not ready to keep scaling privileged runtime work. The strongest rails are doing real work, but several close claims are now ahead of the evidence: `npm run audit` is red in this review environment, CC#P2-4 depends on an ignored local engine shim and does not exercise the hook scripts it claims to prove, dispatch events carry fake selection/provenance, and the methodology has normalized exactly the scalar close-count and skipped-challenger drift ADR-0007/CLAUDE.md tried to forbid.

## HIGH findings

### HIGH 1 — HEAD is mechanically red under the requested verification gate

**Finding:** `npm run audit` does not pass at HEAD in this review environment; it exits red because the Verify gate fails.

**Evidence:** `tests/runner/dogfood-smoke.test.ts:236-262` shells the CLI test through `node_modules/.bin/tsx`. `npm run test -- --run --reporter=default` fails that test with `listen EPERM ... /tmp/tsx-501/*.pipe`; `npm run audit` reports `30 green / 1 yellow / 1 red`, red at Verify gate.

**Impact:** The current state cannot honestly claim "`npm run audit` green" as a fresh, portable gate. PROJECT_STATE claims Slice 46b had `npm run audit` green, but a fresh run here says otherwise.

**Remediation:** Replace the CLI smoke invocation with a path that does not require `tsx` IPC listening under restricted agent/sandbox environments, or document and gate the environment dependency. Re-run `npm run verify` and `npm run audit` after the fix.

### HIGH 2 — CC#P2-4 closes without testing the SessionStart/SessionEnd hook scripts, and its engine dependency is ignored local state

**Finding:** The CC#P2-4 close is structurally hollow. ADR-0007 requires hook scripts plus lifecycle proof including the SessionStart resume path and banner content, but the landed test only invokes `.circuit/bin/circuit-engine` directly.

**Evidence:** ADR-0007 says CC#P2-4 enforcement includes `.claude/hooks/SessionStart.sh`, `.claude/hooks/SessionEnd.sh`, and a lifecycle test that must assert banner content (`specs/adrs/ADR-0007-phase-2-close-criteria.md:335-346`). The test hardcodes `ENGINE_BIN = resolve('.circuit/bin/circuit-engine')` and calls it with `execFileSync` (`tests/runner/continuity-lifecycle.test.ts:51`, `tests/runner/continuity-lifecycle.test.ts:97-108`). The hook-audit tests only check file presence/executable/text wiring, not behavior (`tests/contracts/session-hooks-present.test.ts:80-87`). `.gitignore` ignores `.circuit/` except an old historical run (`.gitignore:16-21`), and `git ls-files --error-unmatch .circuit/bin/circuit-engine .circuit/plugin-root` returns no tracked files.

**Impact:** A clean clone can lack the engine shim and fail the lifecycle test. More importantly, SessionStart could fail to render the promised banner and CC#P2-4 would still pass, because the hook scripts are never executed by the lifecycle test.

**Remediation:** Add a portable, tracked test helper or package script for `circuit-engine`, then add tests that execute `.claude/hooks/SessionStart.sh` and `.claude/hooks/SessionEnd.sh` against an ephemeral project root and assert the pending-continuity banner/summary text. Do not count CC#P2-4 closed until that lands.

### HIGH 3 — Dispatch logs write fake `resolved_selection` and fake `resolved_from`

**Finding:** Every dispatch materialized through `src/runtime/adapters/dispatch-materializer.ts` writes a hardcoded empty selection and default provenance, regardless of the actual adapter-selection path.

**Evidence:** `materializeDispatch` emits `resolved_selection: { skills: [], invocation_options: {} }` and `resolved_from: { source: 'default' }` on `dispatch.started` (`src/runtime/adapters/dispatch-materializer.ts:122-134`). The selection contract says `DispatchStartedEvent.resolved_selection` is the effective record consumers see at dispatch time (`specs/contracts/selection.md:385-390`). The adapter contract says `resolved_from` names the winning precedence category and exact contributing entry where applicable (`specs/contracts/adapter.md:231-269`, `specs/contracts/adapter.md:391-399`).

**Impact:** Event logs are audit-hostile. P2-MODEL-EFFORT and router work will need trustworthy model/effort/skill/provenance events; the current log shape already normalizes a false default-selection story. This is the biggest silent failure mode waiting for P2.8/P2-MODEL-EFFORT.

**Remediation:** Thread a real `ResolvedSelection` and `DispatchResolutionSource` into `materializeDispatch`; fail if the caller cannot provide them. Add runner tests where step/workflow/default selection and role/circuit/explicit adapter resolution produce non-empty, non-default event payloads.

### HIGH 4 — AGENT_SMOKE evidence is stale after adapter-surface changes, but Check 30 cannot detect it

**Finding:** The `agent` smoke fingerprint proves only that commit `48bcab8...` is an ancestor of HEAD. It does not bind to the current `agent`/materializer/shared/runner surface, even though those files changed after the recorded smoke commit.

**Evidence:** `tests/fixtures/agent-smoke/last-run.json:3-5` records only `commit_sha`, `result_sha256`, and `recorded_at`. `checkAgentSmokeFingerprint` validates JSON, `commit_sha`, `result_sha256`, and ancestor-of-HEAD, then returns green (`scripts/audit.mjs:3702-3776`). In contrast, the Codex check adds `adapter_source_sha256` drift detection over adapter-layer source files (`scripts/audit.mjs:3779-3858`). Verified with `git diff --name-only 48bcab893a834dbe62e13d1d4386254ad3ee327b..HEAD -- src/runtime/adapters/agent.ts src/runtime/adapters/dispatch-materializer.ts src/runtime/adapters/shared.ts src/runtime/runner.ts`, which returns all four paths.

**Impact:** CC#P2-2 can remain green for the current agent adapter even if the agent adapter or materializer regresses after the smoke run. This is exactly the staleness gap Slice 45 fixed for Codex but left open for Agent.

**Remediation:** Promote the agent fingerprint to schema v2 with `adapter_source_sha256` and `cli_version`, covering `agent.ts`, `shared.ts`, `dispatch-materializer.ts`, and the runner seam that supplies dispatch input. Make source drift yellow/red until `AGENT_SMOKE=1 UPDATE_AGENT_FINGERPRINT=1` refreshes it.

### HIGH 5 — The Codex-challenger invariant has been reinterpreted away from "any ratchet change"

**Finding:** CLAUDE.md still requires a challenger for any ratchet change, but recent slices advance ratchets while declaring Codex not required.

**Evidence:** CLAUDE.md says cross-model challenger is required for "any ratchet change" (`CLAUDE.md:38-41`, `CLAUDE.md:235-237`). The plan acknowledges Slices 43a/43b/43c skipped Codex despite ratchet movement (`specs/plans/phase-2-implementation.md:401-410`). Slice 45a is recorded as +1 static test but says no Codex because "none apply" (`specs/plans/phase-2-implementation.md:677-690`). Slice 46b advances the floor +12 and says Codex not required (`PROJECT_STATE.md:7`, `tests/runner/continuity-lifecycle.test.ts:7-12`).

**Impact:** The methodology has quietly shifted from "challenger on ratchet change" to "challenger on ratchet weakening / governance movement." That may be a reasonable policy, but it is not the policy currently written. The 2-slice P2.7 arc also avoided composition review by threshold, while still closing a phase criterion.

**Remediation:** Either amend CLAUDE.md/ADR-0007 to the narrower rule, or enforce the written rule. For privileged runtime or phase-close slices, require per-slice challenger or a pre-declared arc-close subsumption even when the arc has only two slices.

### HIGH 6 — ADR-0007's no-aggregate firewall is being violated in live status surfaces

**Finding:** ADR-0007 explicitly forbids scalar Phase 2 close progress wording, but PROJECT_STATE and the Phase 2 plan now use "2/8 → 3/8" close-count language repeatedly.

**Evidence:** ADR-0007 forbids "N-of-8 complete," "7/8," "only N remaining," and any scalar close-progress summary (`specs/adrs/ADR-0007-phase-2-close-criteria.md:621-649`). PROJECT_STATE says "Phase 2 close count advances 2/8 → 3/8" (`PROJECT_STATE.md:7`) and repeats it in the plain-English summary (`PROJECT_STATE.md:15`). The plan repeats the same close-count wording (`specs/plans/phase-2-implementation.md:750-751`).

**Impact:** The most visible operator-facing surface has normalized the exact progress shorthand the ADR says is rejected on sight. This weakens the independent-gate model and makes future "nearly done" pressure easier.

**Remediation:** Replace close-count language with a per-criterion state list: `CC#P2-1 active — satisfied at placeholder-parity epoch`, etc. Add an audit check that rejects ADR-0007 forbidden close-progress phrases in PROJECT_STATE, plans, README, and review artifacts.

## MED findings

### MED 1 — P2-MODEL-EFFORT plan points at the wrong schema shape

**Finding:** The reserved P2-MODEL-EFFORT slice still says to put model/effort under `invocation_options`, but the current schema already makes them first-class selection fields.

**Evidence:** Plan text specifies `invocation_options.model`, `invocation_options.effort`, and `resolved_selection.invocation_options` (`specs/plans/phase-1-close-revised.md:612-620`). Current schema has `SelectionOverride.model`, `SelectionOverride.effort`, `ResolvedSelection.model`, and `ResolvedSelection.effort` as top-level fields (`src/schemas/selection-policy.ts:70-77`, `src/schemas/selection-policy.ts:89-96`). Workflow and Step already carry `SelectionOverride` slots (`src/schemas/workflow.ts:42-47`, `src/schemas/step.ts:15-24`).

**Impact:** The next likely slice is set up to implement against stale instructions.

**Remediation:** Amend `phase-1-close-revised.md` and the Phase 2 plan before opening P2-MODEL-EFFORT. The slice should wire existing first-class selection fields through resolution and dispatch events, not invent `invocation_options.model`.

### MED 2 — P2.10 placeholder-parity reopen trigger is narrative-only

**Finding:** The CC#P2-1 rebind at P2.10 is documented but not audit-enforced.

**Evidence:** ADR-0007 requires P2.10 to regenerate the golden and get a fresh composition review (`specs/adrs/ADR-0007-phase-2-close-criteria.md:139-153`). The current golden test explicitly self-checks the placeholder derivation (`tests/runner/explore-e2e-parity.test.ts:196-220`). `scripts/audit.mjs` has no P2.10 / golden-regeneration / fresh-composition-review check.

**Impact:** P2.10 can land and replace `writeSynthesisArtifact` while forgetting the golden rebind or the fresh composition review, and normal audit would not know.

**Remediation:** Add a P2.10-specific audit gate or close-matrix prerequisite that checks the golden was regenerated after the placeholder-removal commit and that a post-P2.10 composition review exists.

### MED 3 — Plugin command docs still carry pre-ADR-0009 adapter wording

**Finding:** The user-facing `/circuit:explore` scaffold still says P2.4 will use an "in-process Anthropic subagent," contradicting ADR-0009's subprocess-per-adapter decision.

**Evidence:** `.claude-plugin/commands/circuit-explore.md:23-25` says "real-agent adapter (`agent` in-process Anthropic subagent)." ADR-0009 replaced that wording with headless `claude` CLI subprocess (`specs/adrs/ADR-0009-adapter-invocation-pattern.md:136-146`).

**Impact:** The installed plugin surface misleads users and future slice authors about the adapter boundary.

**Remediation:** Patch command docs to say `agent` is a headless `claude` CLI subprocess per ADR-0009.

## LOW findings

### LOW 1 — Authority graph companion doc is stale

**Finding:** `specs/artifacts.md` says the current graph has 17 artifacts and lists 13 data-plane artifacts, but the JSON/audit report has 24 artifacts.

**Evidence:** `specs/artifacts.md:108-120` says 17 artifacts. `specs/artifacts.json` includes 24 rows, including explore artifacts (`specs/artifacts.json:592-714`), and `npm run audit` reports "24 artifacts."

**Impact:** Low runtime risk because `artifacts.json` explicitly wins, but it is a stale human authority surface.

**Remediation:** Regenerate the roll-up in `specs/artifacts.md`.

### LOW 2 — Audit check numbering comments are drifting

**Finding:** The audit script contains stale projected numbering in comments.

**Evidence:** The function comment says `checkPhase2SliceIsolationCitation` is "Check 23" (`scripts/audit.mjs:2346-2356`), while main wires it as Check 22 (`scripts/audit.mjs:4522-4528`). The plan also still says the audit had 21 checks at Phase 2 planning time (`specs/plans/phase-2-implementation.md:59`).

**Impact:** Low behavior risk, but stale Check-N citations are a repeated authority-drift class in this repo.

**Remediation:** Prefer function names over Check-N in ADRs/plans, or add an audit self-check that numbered comments match main output.

### LOW 3 — Prior-gen banner shape is currently mirrored, but not mechanically pinned

**Finding:** The SessionStart shell banner appears to mirror prior-gen today, but only by hand.

**Evidence:** circuit-next banner lines match the prior-gen pending/current-run text (`.claude/hooks/SessionStart.sh:63-89`; `/Users/petepetrash/Code/circuit/scripts/runtime/engine/src/cli/session-start.ts:14-52`). No circuit-next test compares or snapshots the hook output.

**Impact:** If prior-gen changes, or the shell hook drifts, the "mirrors prior-gen" claim becomes stale without any failure.

**Remediation:** Snapshot the circuit-next hook output directly. Do not couple to live prior-gen unless prior-gen is intentionally an authority source.

## META findings (methodology hardening)

- The ceremony is paying off where it has executable closure: authority graph, invariant ledger, path-collision detection, adapter forbidden-dep/import scans, and Codex source-hash drift checks all caught or prevented real errors.
- The ceremony is not paying off where prose forbids behavior but no audit enforces it: no-aggregate wording, P2.10 rebind, challenger-skip policy, and hook banner behavior.
- The missing rail is a "claim-to-evidence matrix" audit for PROJECT_STATE: every "closes CC#..." sentence should point to a criterion row, evidence type, test/audit path, and whether the evidence is placeholder/real/current/stale.

## Recommended fold-in disposition

1. Block the next privileged runtime slice until `npm run verify` and `npm run audit` are green in the intended agent environment.
2. Reopen CC#P2-4 and add hook-script behavior tests plus a portable engine test helper.
3. Add real dispatch selection/provenance plumbing before P2.8 or P2-MODEL-EFFORT.
4. Promote AGENT_SMOKE fingerprint to source-bound v2, symmetrical with CODEX_SMOKE.
5. Amend or enforce the Codex challenger rule; do not leave "any ratchet change" and "not required for ratchet advances" both live.
6. Remove scalar Phase 2 close-count wording and audit against ADR-0007 forbidden phrases.

## Trajectory check

The system is still moving in the right general direction, but the authority graph is drifting faster than the enforcement graph. The next high-risk slice is P2-MODEL-EFFORT or P2.8 router: both will consume dispatch provenance, selection resolution, and close-status claims that are currently weaker than advertised. The right next move is not more workflow surface; it is a short hardening fold-in arc over provenance truth, close-claim wording, hook behavior, and smoke freshness.
