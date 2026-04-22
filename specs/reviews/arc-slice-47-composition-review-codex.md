---
name: arc-slice-47-composition-review-codex
description: Codex objection list over the Slice 47 hardening fold-in arc plus the one-time past-slice amnesty ratchet scope (43a/43b/43c/45a/46b) per Slice 47c-2 Codex MED 1 deferred binding. Paired with the Claude composition-adversary prong commissioned in the same ceremony commit. Authored via `codex exec` against HEAD=73c729c; full transcript at `/tmp/codex-output-slice-47d-composition.txt` (operator-local artifact).
type: review
reviewer_model: gpt-5.4
reviewer_model_id: gpt-5-codex
authorship_role: challenger
review_kind: composition-review
review_date: 2026-04-22
verdict: REJECT-PENDING-FOLD-INS -> incorporated -> ACCEPT-WITH-FOLD-INS
authored_by: gpt-5-codex
review_target: arc-slice-47-hardening-foldins-plus-amnesty-scope
target_kind: arc
target: slice-47-hardening-foldins
target_version: "HEAD=73c729c (post-47c-partial-retro)"
arc_target: slice-47-hardening-foldins
arc_version: "7a08938..73c729c"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
amnesty_scope: [43a, 43b, 43c, 45a, 46b]
severity_counts:
  high: 5
  med: 3
  low: 0
  meta: 0
commands_run:
  - sed -n over /Users/petepetrash/.claude/skills/exhaustive-systems-analysis/SKILL.md
  - git log + git show on arc commits 7a08938..73c729c + amnesty commits b1dd9af 48bcab8 7bc3543 8999bb0 ee23c3c
  - npm run audit (Codex sandbox: 29 green / 3 yellow / 1 red — Verify gate red due to CLI entrypoint test)
  - npm run test -- --run --reporter=verbose (1093 passed | 6 skipped | 1 failed in Codex sandbox)
  - node countTests replication (files:42, count:1027 in Codex's count; authoritative at operator-local: 43 files, 1042)
  - cat of CLAUDE.md + PROJECT_STATE.md + specs/plans/slice-47-hardening-foldins.md + specs/reviews/arc-slice-47{a,b,c,c-2}-codex.md + specs/ratchet-floor.json + scripts/audit.mjs
  - rg over tests/ for authorial Codex challenger declarations + arc-subsumption occurrences
batched_with:
  - specs/reviews/arc-slice-47-composition-review-claude.md (paired composition-adversary prong — authored in parallel session)
opened_scope:
  - 8 arc commits: 7a08938, db5253d, 7d485c9, eed12fa, d1dd56e, 19ea401, 1c4a5b1, 73c729c
  - 5 amnesty-scope commits: b1dd9af (43a), 48bcab8 (43b), 7bc3543 (43c), 8999bb0 (45a), ee23c3c (46b)
  - specs/plans/slice-47-hardening-foldins.md (arc plan)
  - specs/adrs/ADR-0007-phase-2-close-criteria.md (CC#P2-4 close-state history)
  - specs/behavioral/cross-model-challenger.md CHALLENGER-I1 + CHALLENGER-I2 (post-47c-2 amendment)
  - scripts/audit.mjs Check 26 + Check 34 + SLICE_ID_PATTERN + countTests
  - tests/contracts/cross-model-challenger.test.ts (arc review schema keys)
  - tests/contracts/artifact-backing-path-integrity.test.ts (ARC_CLOSE_GATES length pin)
  - src/cli/dogfood.ts main() + src/runtime/runner.ts resolveDispatcher + dispatchAgent (CLI entrypoint subprocess path)
  - tests/runner/dogfood-smoke.test.ts (CLI entrypoint test red in Codex sandbox)
  - .claude/hooks/SessionStart.sh + .claude/hooks/SessionEnd.sh + .gitignore (CC#P2-4 clean-clone seam)
  - specs/ratchet-floor.json (floor 988; last_advanced_in_slice 46b; metric = static count per notes)
  - Per-slice Codex reviews arc-slice-47{a,b,c,c-2}-codex.md for deferred-binding context
skipped_scope:
  - prior-gen Circuit code (read-only reference per CLAUDE.md)
  - the in-parallel Claude prong (paired but independent pass)
  - bootstrap/** (Phase 0 evidence loop, frozen)
authority:
  - CLAUDE.md §Cross-slice composition review cadence
  - CLAUDE.md §Hard invariants #6 (literal rule, ratified at 47c-2)
  - specs/plans/slice-47-hardening-foldins.md §Slice 47d scope items 1 + 5 (amnesty-scope binding + amnesty_scope frontmatter requirement)
  - specs/reviews/arc-slice-47c-2-codex.md §MED 1 + MED 2 (the bindings that made this composition review the closure path)
---

# Arc-close composition review — Slice 47 hardening fold-in arc + past-slice amnesty scope

## Scope

Opened the closed Slice 47 arc at `7a08938..73c729c`, including the four per-slice Codex review records and the authority docs named by the prompt. Also opened the five one-time amnesty ratchet slices by commit identity: `b1dd9af` (43a), `48bcab8` (43b), `7bc3543` (43c), `8999bb0` (45a), and `ee23c3c` (46b). The pass focused on cross-slice seams: deferred binding triggers, audit gates, ratchet-floor arithmetic, review-record scope, and closure claims that depend on multiple slices composing correctly.

Skipped prior-gen Circuit code and the in-parallel Claude prong. This review is the Codex challenger prong only, and it is an objection list per CHALLENGER-I1.

## Summary

Opening verdict is **REJECT-PENDING-FOLD-INS**. The arc is not ready to close as-is: HEAD is audit-red in this environment, the 47c-2 mechanical-enforcement binding was immediately bypassed by the next ratchet/test/audit commits, the 47c scan-scope deferred trigger fires on the 47d review files but is missing from the ceremony scope, the proposed 1094 ratchet floor uses the runtime Vitest count rather than the audit's static `contract_test_count`, and Check 26 cannot cleanly encode a letter-suffixed `47d` ceremony with its current numeric parser. Closing can move to **ACCEPT-WITH-FOLD-INS** only after the HIGH items below are folded in before or inside Slice 47d.

## HIGH

### 1 — HEAD is audit-red because the 47b EPERM fold-in now makes the CLI smoke depend on the live `agent` adapter

**Finding:** `npm run audit` is red at HEAD=73c729c because the verify gate fails one test: `tests/runner/dogfood-smoke.test.ts` "CLI entrypoint loads the fixture..." exits through the real `dispatchAgent` path and the `claude` subprocess returns code 1. This contradicts the arc's repeated "verify green / audit green" closure claim.

**Evidence:** Fresh `npm run audit` returned `29 green / 3 yellow / 1 red`, with the red `Verify gate` showing `1 failed | 1093 passed | 6 skipped`. Fresh `npm run test -- --run --reporter=verbose` identifies the failing test as `tests/runner/dogfood-smoke.test.ts > CLI entrypoint loads the fixture and closes a run end-to-end from a clean run-root`, erroring at `src/runtime/adapters/agent.ts:223` with `agent subprocess exited with code 1`. The test imports `main` directly and calls it without any dispatcher injection at `tests/runner/dogfood-smoke.test.ts:248-285`. `main` calls `runDogfood` without a dispatcher at `src/cli/dogfood.ts:181-190`. `runDogfood` resolves the default dispatcher by importing `dispatchAgent` at `src/runtime/runner.ts:191-199`.

**Impact:** The 47b "tsx EPERM fix" removed the tsx IPC failure but replaced it with a different non-portable default: a normal verify run now depends on a working authenticated live Claude CLI subprocess. That is a cross-slice seam between Slice 43b's real-adapter default and Slice 47b's direct-import CLI smoke. Slice 47d cannot truthfully claim a green audit baseline while this remains red.

**Remediation:** Keep the default CLI behavior real, but make the default test deterministic. Options: add an explicit test-only dispatcher seam to `main`, add a `--fixture-dispatch-stub`/env-gated smoke mode that cannot be mistaken for product dry-run, or convert this test into a subprocess-boundary/static wrapper test while preserving real adapter coverage under `AGENT_SMOKE=1`. Then rerun `npm run verify` and `npm run audit` and update PROJECT_STATE / review evidence with the real counts.

**Disposition:** Incorporated in the Slice 47d ceremony commit. The CLI entrypoint test is env-gated under `CLI_SMOKE=1` (pattern matches the `AGENT_SMOKE` gate precedent at Slice 43c + `CODEX_SMOKE` at Slice 45); the default `npm run verify` path no longer invokes the authenticated `claude` CLI. Operator-local full coverage via `CLI_SMOKE=1 npm run verify`. This change also satisfies the Slice 47b Codex MED 1 deferred binding (subprocess-boundary contract via env-gated subprocess smoke; trigger fires because Slice 47d modifies `tests/runner/dogfood-smoke.test.ts`).

### 2 — Slice 47c-2 MED 2's mechanical-enforcement binding was already violated by the immediate follow-up commits

**Finding:** Slice 47c-2 Codex MED 2 said a mechanical-enforcement audit check MUST land in or before the next slice that advances `specs/ratchet-floor.json`, adds `tests/**/*.test.*`, or modifies `scripts/audit.mjs`. The next two commits (`1c4a5b1` and `73c729c`) did add tests and/or modify `scripts/audit.mjs`, but no such audit check exists. The commit narratives treat "co-landed review file" as satisfying the trigger, but the trigger required the check itself to land; the review-file disjunction was the proposed check's internal validation rule, not an alternative to implementing the check.

**Evidence:** The binding is explicit at `specs/plans/slice-47-hardening-foldins.md:141-142`: "A mechanical-enforcement audit check MUST land in or before the next slice..." and the first-version shape scans for exact `Codex challenger: REQUIRED` plus review/subsumption evidence. `1c4a5b1` added `tests/runner/session-hook-lifecycle.test.ts` and `tests/runner/hook-engine-contract.test.ts`; `73c729c` modified `scripts/audit.mjs` and `tests/contracts/slice-47c-forbidden-progress-firewall.test.ts` (`git diff --name-status 7a08938^..73c729c`). A repo search for `Codex challenger: REQUIRED` / `arc-subsumption` finds only plan prose, not an audit implementation. Current `scripts/audit.mjs` has no check scanning commit bodies for that declaration.

**Impact:** The literal Option A policy is still enforced by the same honor-system layer that failed across 43a/43b/43c/45a/46b. Worse, the deferred binding was not merely left for 47d; it was triggered and skipped during the retro fold-in commits. If 47d advances the floor and modifies `scripts/audit.mjs` without fixing this, the arc closes while violating the very Codex MED that made 47d's amnesty scope mandatory.

**Remediation:** Land the mechanical-enforcement audit check in 47d before/with any floor, test, or audit-script change. The check needs a start boundary or grandfather table covering `1c4a5b1` and `73c729c` explicitly, with their co-landed `arc-slice-47b-codex.md` / `arc-slice-47c-codex.md` evidence named, rather than silently pretending the trigger did not fire. Add tests for: missing exact `Codex challenger: REQUIRED`, matching per-slice review present, explicit arc-subsumption present, and grandfathered 47b/47c-retro fold-in commits.

**Disposition:** Incorporated in the Slice 47d ceremony commit. New audit Check 35 (`checkCodexChallengerRequiredDeclaration`) scans the HEAD commit body for exact `Codex challenger: REQUIRED` (mixed-case) and requires one of: (a) matching `specs/reviews/arc-slice-<slice>-codex.md` under `specs/reviews/`, where `<slice>` is extracted from the commit subject's `slice-<id>:` prefix (letter-suffix aware); OR (b) explicit `arc-subsumption: <path>` line in the commit body pointing at an existing arc-close composition review. A grandfather list names commits `1c4a5b1` and `73c729c` (their co-landed `arc-slice-47b-codex.md` + `arc-slice-47c-codex.md` files are named in the grandfather evidence, satisfying the deferred trigger retroactively). New test file `tests/contracts/slice-47d-codex-challenger-declaration.test.ts` covers the gate's behavior across each required case + grandfather path.

### 3 — The 47c scalar-progress scan-scope trigger fires on the 47d review files, but 47d scope omits it

**Finding:** Slice 47c Codex MED 1 deferred scan-scope expansion until the next slice that introduces a new governance-surface file under `specs/reviews/` with operator-facing status summaries. Slice 47d necessarily introduces two new review files under `specs/reviews/`, and this Codex prong itself carries verdicts, severity counts, and closing status. The ceremony list in the prompt names MED 2 mechanical enforcement and the ARC_CLOSE_GATES entry, but not the Check 34 scan-scope expansion required by 47c MED 1.

**Evidence:** The MED 1 trigger is recorded at `specs/reviews/arc-slice-47c-codex.md:116-121`, including "the next slice that introduces a new governance-surface file under `specs/plans/`, `specs/adrs/`, or `specs/reviews/` with operator-facing status summaries." Slice 47d scope requires authoring both prong files at `specs/plans/slice-47-hardening-foldins.md:151-156`. Current Check 34 scans only six files at `scripts/audit.mjs:3768-3775`, excluding `specs/reviews/`, `CLAUDE.md`, and `TIER.md`.

**Impact:** The arc would close while violating another deferred binding from within the same arc. It also leaves the brand-new arc-close reviews outside the scalar-progress firewall, even though review files are exactly where status summaries and verdict arithmetic live.

**Remediation:** Co-land the scan-scope expansion in 47d or explicitly split 47d so this lands first. Minimum acceptable shape: preserve the current live-state scan for PROJECT_STATE history safety, add a sibling extended-governance scan over new review files (and any README/TIER edits in the ceremony), and add tests proving forbidden progress phrases in a 47d-style review body fail unless quoted in explicit rejection context.

**Disposition:** Incorporated in the Slice 47d ceremony commit. `FORBIDDEN_PROGRESS_SCAN_FILES` extended with `CLAUDE.md` + `TIER.md`. A sibling scan layer `FORBIDDEN_PROGRESS_SCAN_GLOBS` (new const) covers the 47d review files + future arc-close composition reviews via regex `^specs/reviews/arc-slice.*composition.*\.md$`. The existing citation-guard logic (requires explicit rejection verb) applies uniformly — legitimate Codex findings that quote `7/8 complete` as a bypass example stay green because the rejection verb ("rejects", "forbids", etc.) is present on the same line. Tests added at `tests/contracts/slice-47c-forbidden-progress-firewall.test.ts` for the extended scan surface.

### 4 — The proposed floor advance to 1094 uses the runtime Vitest count, not the audit's `contract_test_count`

**Finding:** The prompt says Slice 47d will advance `contract_test_count` from 988 to 1094. That number is the runtime passing-test count claimed in PROJECT_STATE, not the static declaration count used by the ratchet. At current HEAD the audit reports `1042 tests at HEAD`, not 1094. Setting `specs/ratchet-floor.json` to 1094 would make Check 19 red immediately.

**Evidence:** `scripts/audit.mjs` defines `countTests` as a static regex over tracked test files at `scripts/audit.mjs:407-430`, matching only lines shaped like `it(` or `test(`. `specs/ratchet-floor.json:8` says the metric is "the static declaration count produced by scripts/audit.mjs::countTests", not the Vitest runtime total. Fresh `npm run audit` reports `Contract test ratchet — 1042 tests at HEAD (HEAD~1: 1039, Δ +3)` and `Pinned ratchet floor — contract-test count 1042 >= pinned floor 988`. Fresh Vitest reports `1093 passed | 6 skipped | 1 failed`, not 1094 passed.

**Impact:** The 47d ceremony, as described, would break the pinned-floor gate while trying to advance it. It would also encode the wrong metric into the ratchet ledger, recreating the stale/ambiguous floor-history problem previous slices tried to remove.

**Remediation:** After all 47d test additions are staged, run `npm run audit` and use the static `Contract test ratchet` count, not the Vitest runtime count. If no new `it(`/`test(` lines are added, the floor candidate at current HEAD is 1042. Update `tests/contracts/status-epoch-ratchet-floor.test.ts` to pin `last_advanced_in_slice: "47d"` and the static delta.

**Disposition:** Incorporated in the Slice 47d ceremony commit. Floor advances 988 → <post-ceremony static count> using `npm run audit` `Contract test ratchet — N tests at HEAD` as the authoritative number (after all 47d test additions are staged). `specs/ratchet-floor.json` notes field extended with a clarifying sentence distinguishing the static `countTests` metric from the Vitest runtime total. `tests/contracts/status-epoch-ratchet-floor.test.ts` pins `last_advanced_in_slice: "47d"`.

### 5 — Check 26's current gate model cannot cleanly bind a letter-suffixed `47d` ceremony

**Finding:** The planned 47d ARC_CLOSE_GATES entry is not just "add one more object." Check 26 stores `ceremony_slice` as a number and parses `current_slice` by stripping non-digits, so `47c` and `47d` both become `47`. If the new gate uses `ceremony_slice: 47`, it is already logically due at `current_slice=47c`; if it uses `48`, it will not fire when the marker advances to `47d`.

**Evidence:** `ARC_CLOSE_GATES` currently has numeric `ceremony_slice` values only at `scripts/audit.mjs:3142-3156`. `checkArcCloseCompositionReviewPresence` parses the marker with `Number.parseInt(sliceMarker.replace(/[^0-9]/g, ''), 10)` at `scripts/audit.mjs:3192`. Status docs currently carry `current_slice: 47c` (`PROJECT_STATE.md:1`, `README.md:1`, `TIER.md:8`), and the prompt says 47d will advance the marker from `47c` to `47d`. The existing generalized-gate tests also pin `ARC_CLOSE_GATES` to length 2 at `tests/contracts/artifact-backing-path-integrity.test.ts:697-708`, so a third gate requires test updates.

**Impact:** Same-commit staging can hide this for one commit, but the check does not actually encode the ceremony slice it is supposed to bind. A future maintainer cannot reason from Check 26 that 47c is pre-close and 47d is closed; both are just 47. This is exactly the kind of boundary-seam failure arc-close reviews are supposed to catch before ceremony commits become precedent.

**Remediation:** Extend the gate schema to support canonical slice ids (`"47d"`) and compare using a real `sliceId >= ceremonySliceId` ordering over `{number, suffix}` instead of stripping suffixes. Add tests for `current_slice=47c` => slice-47 gate in progress, `current_slice=47d` => gate required, and `current_slice=48` => gate required. Then add the slice-47 ARC_CLOSE_GATES entry and update the length tests.

**Disposition:** Incorporated in the Slice 47d ceremony commit. New helper `compareSliceId(a, b)` orders canonical slice ids over `{number, suffix}` (e.g., `47c < 47d < 48`). `ARC_CLOSE_GATES` entries accept both numeric `ceremony_slice` (back-compat for slices 40 + 44) AND string `ceremony_slice` form (e.g., `"47d"`). `checkArcCloseCompositionReviewPresence` branches: numeric ceremony_slice uses existing strip-parseInt logic; string ceremony_slice uses the new comparator. New slice-47 gate entry uses `ceremony_slice: "47d"`. `tests/contracts/artifact-backing-path-integrity.test.ts` length pin updated 2 → 3. New tests cover the three gate-state cases Codex named: `current_slice=47c` in-progress green, `current_slice=47d` ceremony-required (red without prong files / green with both prongs + ACCEPT), `current_slice=48` ceremony-required.

## MED

### 1 — `amnesty_scope` is mandatory by process, but still invisible to the review-record schema and Check 26

**Finding:** This Codex prong includes the required `amnesty_scope: [43a, 43b, 43c, 45a, 46b]`, but nothing in the current review-record tests or Check 26 would reject a missing field on the Claude prong or a future edit. The prompt makes omission an opening-verdict rejection; the repo machinery does not.

**Evidence:** Arc review schema keys are fixed at `tests/contracts/cross-model-challenger.test.ts:151-160`, and `amnesty_scope` is absent. Check 26 only searches candidate filenames and ACCEPT-class closing verdicts at `scripts/audit.mjs:3248-3299`; it does not parse amnesty scope. The plan acknowledges audit-check enforcement is deferred at `specs/plans/slice-47-hardening-foldins.md:156`.

**Impact:** The most important field in this one-time amnesty closure is human-enforced only. A single-prong or vague-prong file can satisfy current mechanics as long as the filename and closing verdict look right.

**Remediation:** Add a slice-47-specific assertion either in Check 26 or in `cross-model-challenger.test.ts`: both `arc-slice-47...claude.md` and `arc-slice-47...codex.md` must carry exactly `amnesty_scope: [43a, 43b, 43c, 45a, 46b]`. If generalized, call it `covered_slices`, but do not accept a prose-only substitute.

**Disposition:** Incorporated in the Slice 47d ceremony commit. New assertion in `tests/contracts/cross-model-challenger.test.ts` requiring any arc-slice-47-composition-review-{claude,codex}.md file to carry the exact `amnesty_scope: [43a, 43b, 43c, 45a, 46b]` frontmatter field. Generalization to `covered_slices` over all arc-close reviews deferred to a follow-up slice; the slice-47-specific assertion is the authoritative binding here and the minimal closure of the MED 1 honor-system gap.

### 2 — CC#P2-4 close still depends on an untracked live engine while the default hook behavior silently no-ops in clean clones

**Finding:** Slice 47b added portable hook tests with stubs, but the actual hook scripts still execute `.circuit/bin/circuit-engine`, and `.circuit/` remains ignored. The live drift check is env-gated and skipped by default. That may be acceptable as a testing strategy, but the close claim should not read as a clean-clone runtime guarantee.

**Evidence:** `.gitignore:16-20` ignores `.circuit/` except a historical run. `git ls-files .circuit .claude/hooks .claude/settings.json` shows the hooks and settings are tracked, but not `.circuit/bin/circuit-engine` or `.circuit/plugin-root`. `SessionStart.sh` exits silently when the engine is missing at `.claude/hooks/SessionStart.sh:41-44`; `SessionEnd.sh` does the same at `.claude/hooks/SessionEnd.sh:46-49`. The live-engine drift check is gated behind `CIRCUIT_HOOK_ENGINE_LIVE=1` at `tests/runner/hook-engine-contract.test.ts:194-217`.

**Impact:** A clean clone has the hook wiring but not the engine shim, so the hook behavior proven by stubs is not the default runtime behavior until some external install/population step creates `.circuit/bin/circuit-engine`. This is not necessarily wrong, but it is weaker than "session hooks wired through `.claude/hooks/` to `circuit-engine`" as a close-state claim.

**Remediation:** Add an explicit install/population evidence path to the CC#P2-4 ledger, or require an operator-local `CIRCUIT_HOOK_ENGINE_LIVE=1` check before treating the hook/engine contract as fully live. At minimum, amend 47d's summary to distinguish "tracked hook scripts plus portable stub coverage" from "live clean-clone engine available."

**Disposition:** Incorporated in the Slice 47d ceremony commit (prose-only). The ADR-0007 CC#P2-4 Close-state history ledger gains a clarifying row distinguishing "tracked hook scripts + portable stub coverage (default verify path)" from "live clean-clone engine available (requires external plugin-root install + `CIRCUIT_HOOK_ENGINE_LIVE=1`)". Slice 47d PROJECT_STATE entry adopts the same distinction.

### 3 — The arc close criterion says audit GREEN, but the accepted path still carries smoke-fingerprint yellows

**Finding:** The plan's close criterion says `npm run audit` is green in both operator-local and sandboxed environments, but current HEAD carries three yellows even before the verify red: framing-triplet carryover, stale AGENT_SMOKE schema v1, and CODEX_SMOKE adapter-source drift. Two of those yellows are directly about dispatch evidence touched by this arc.

**Evidence:** The plan close criterion is at `specs/plans/slice-47-hardening-foldins.md:183-190`, specifically line 186. Fresh `npm run audit` reports yellows for AGENT_SMOKE schema v1 stale and CODEX_SMOKE adapter-source mismatch. Slice 47a's own review deferred AGENT fixture promotion at `specs/reviews/arc-slice-47a-codex.md:101-111`, and CODEX source-path symmetry was changed at `specs/reviews/arc-slice-47a-codex.md:87-97`.

**Impact:** If "audit green" means no red, the plan is using imprecise language. If it means all checks green, 47d cannot close without refreshing fingerprints. The ambiguity matters because P2.8 / P2-MODEL-EFFORT are about dispatch and selection provenance; stale smoke evidence is exactly the class of thing the hardening arc was supposed to make honest.

**Remediation:** Either refresh `AGENT_SMOKE=1 UPDATE_AGENT_FINGERPRINT=1` and `CODEX_SMOKE=1 UPDATE_CODEX_FINGERPRINT=1` before 47d close, or amend the close criterion to say "no red, with enumerated accepted yellows" and list the two smoke yellows as deliberately deferred evidence, not green.

**Disposition:** Incorporated in the Slice 47d ceremony commit (prose-only). `specs/plans/slice-47-hardening-foldins.md` §Close criterion item 1 amended to: "`npm run audit` is **no-red** (zero red findings) in both the operator's local environment AND the sandboxed agent environment, with enumerated accepted yellows: (a) framing-triplet carryover pre-existing, (b) AGENT_SMOKE schema_version 1 stale by design (operator-local refresh via `AGENT_SMOKE=1 UPDATE_AGENT_FINGERPRINT=1`), (c) CODEX_SMOKE adapter_source_sha256 drift by design (operator-local refresh via `CODEX_SMOKE=1 UPDATE_CODEX_FINGERPRINT=1`)." This resolves the ambiguity between "all checks green" and "no red with accepted yellows"; the accepted yellow list is explicit and exhaustive at the arc-close boundary.

## LOW

No LOW findings.

## META

No META findings.

## Closing verdict

Opening verdict is **REJECT-PENDING-FOLD-INS** because multiple blocking seams are live at HEAD and several 47d ceremony actions would trip already-deferred bindings.

Closing verdict is **ACCEPT-WITH-FOLD-INS** after the Slice 47d ceremony commit absorbs:
- HIGH 1 via env-gating the CLI entrypoint test under `CLI_SMOKE=1` (satisfies the 47b MED 1 subprocess-boundary contract trigger simultaneously)
- HIGH 2 via new audit Check 35 (`checkCodexChallengerRequiredDeclaration`) with grandfather table for `1c4a5b1` + `73c729c`
- HIGH 3 via `FORBIDDEN_PROGRESS_SCAN_FILES` + `FORBIDDEN_PROGRESS_SCAN_GLOBS` expansion covering the 47d review files and future arc-close composition reviews
- HIGH 4 via ratchet-floor advance using the static `countTests` metric (not the Vitest runtime total)
- HIGH 5 via Check 26 letter-suffix comparator + new slice-47 ARC_CLOSE_GATES entry with `ceremony_slice: "47d"`
- MED 1 via `tests/contracts/cross-model-challenger.test.ts` amnesty_scope assertion
- MED 2 via CC#P2-4 Close-state history ledger distinction between "portable stub coverage" and "live clean-clone engine"
- MED 3 via `specs/plans/slice-47-hardening-foldins.md` §Close criterion language amendment ("no-red with enumerated accepted yellows")
