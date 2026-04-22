---
name: arc-slice-47b-codex
description: Cross-model challenger pass over Slice 47b (commit eed12fa — hook behavioral tests + portable engine stub + dogfood-smoke tsx EPERM fix). Per-slice review per CLAUDE.md §Hard invariants #6 literal rule (ratified at Slice 47c-2) — slice adds audit-gate-visible tests + reopens-and-recloses CC#P2-4 governance surface. Returns OBJECTION LIST per CHALLENGER-I1. Batched with Slice 47c partial challenger pass (see also specs/reviews/arc-slice-47c-codex.md); findings split per slice here and there per the boundary-seam cross-slice finding.
type: review
reviewer_model: gpt-5.4
reviewer_model_id: gpt-5-codex
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-22
verdict: REJECT-PENDING-FOLD-INS -> incorporated -> ACCEPT-WITH-FOLD-INS
authored_by: gpt-5-codex
review_target: slice-47b-hook-behavior-plus-engine-stub
target_kind: arc
target: slice-47b
target_version: "HEAD=eed12fa (slice-47b)"
arc_target: slice-47b-single-slice
arc_version: "HEAD=eed12fa (slice-47b)"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  high: 2
  med: 1
  low: 0
  meta: 0
commands_run:
  - git log --oneline -10
  - git show eed12fa
  - git diff 7d485c9..eed12fa
  - cat tests/runner/session-hook-behavior.test.ts
  - cat tests/runner/dogfood-smoke.test.ts
  - cat .claude/hooks/SessionStart.sh
  - cat .claude/hooks/SessionEnd.sh
  - cat specs/adrs/ADR-0007-phase-2-close-criteria.md
  - cat specs/plans/slice-47-hardening-foldins.md
  - cat scripts/audit.mjs
  - npm run verify
batched_with:
  - specs/reviews/arc-slice-47c-codex.md
opened_scope:
  - tests/runner/session-hook-behavior.test.ts
  - tests/runner/dogfood-smoke.test.ts
  - .claude/hooks/SessionStart.sh
  - .claude/hooks/SessionEnd.sh
  - .circuit/bin/circuit-engine (shim surface only — untracked by .gitignore)
  - specs/adrs/ADR-0007-phase-2-close-criteria.md (CC#P2-4 binding + close-state ledger landing)
  - package.json (tsx npm-script binding target)
skipped_scope:
  - bootstrap/** (Phase 0 evidence loop, frozen)
  - prior-gen circuit (read-only reference per CLAUDE.md)
  - Slice 47c partial + Slice 47c-2 (separate review records)
---

# Cross-model challenger review — Slice 47b (commit eed12fa)

**Verdict (opening):** REJECT-PENDING-FOLD-INS
**Verdict (closing):** ACCEPT-WITH-FOLD-INS *(after this slice's fold-in commit at slice-47b: Codex challenger fold-ins)*

**Batched pass.** This review was authored from the same Codex session that reviewed Slice 47c partial (see `specs/reviews/arc-slice-47c-codex.md`). Findings are split per slice here; any finding that spans both slices lives under the Cross-Slice section at the bottom.

## HIGH

### HIGH 1 — CC#P2-4 still not proven as the full end-to-end lifecycle

**Finding:** ADR-0007 CC#P2-4 names the lifecycle as `create → persist → resume on next session → clear on done`, and its enforcement binding says the lifecycle test must re-read via the SessionStart resume path and assert banner content. The new `tests/runner/session-hook-behavior.test.ts` executes the hook scripts against a CANNED-JSON stub: the stub has no persistence layer, and the tests assert banner substrings derived from the static JSON blob the test itself scaffolds. There is no test that saves a continuity record, resumes it through SessionStart.sh, and clears it, all across the hook/engine boundary.

**Evidence:** ADR-0007 CC#P2-4 text at `specs/adrs/ADR-0007-phase-2-close-criteria.md:332` + `:341`. Canned-JSON stub pattern at `tests/runner/session-hook-behavior.test.ts:70` + `:72`. Banner assertions derive from stubbed JSON at `tests/runner/session-hook-behavior.test.ts:133` + `:148`. No save / resume / clear invocations in the test body.

**Impact:** A regression in the real continuity lifecycle or in the live engine's `continuity status --json` shape after save/clear can still pass the hook tests. The slice closes the "hook not executed" gap (closed by the session-hook-behavior test suite), but not the full CC#P2-4 binding.

**Remediation:** Add one integration test that uses the portable/live engine helper to create a continuity record, invokes `SessionStart.sh` to render the actual pending record, invokes the clear path, and verifies both the banner and cleared record state. If the current intended architecture no longer has SessionEnd persistence, amend ADR-0007 rather than relying on split evidence.

**Disposition:** Incorporated. Added `tests/runner/session-hook-lifecycle.test.ts` driving the full `save` → `status` → `clear` cycle through a persisting stub engine. The persisting stub (vs the canned-JSON stub in the pre-fold-in test file) implements real state-file persistence at `.circuit/state/continuity-stub.json`, so the test exercises the same data path the hooks traverse in production — a save that produces a JSON shape SessionStart.sh cannot parse, or a clear that leaves residual state, lands red here. Also updated ADR-0007 CC#P2-4 with a close-state history table naming the transitions (first claim at Slice 46b → reopen per Slice 47a comprehensive review → behavior reclose at Slice 47b → lifecycle reclose at Slice 47b fold-in); see §Cross-Slice 1 disposition.

### HIGH 2 — Stub engine masks the exact hook-to-engine CLI contract

**Finding:** Both session-hook-behavior.test.ts hooks call the live binary as `.circuit/bin/circuit-engine continuity status --json` with no explicit `--project-root`. The test stub accepts exactly those first three argv values and always exits 0 for everything else. The hook invocation supplies `cwd` and `CLAUDE_PROJECT_DIR`, but the stub does not validate that this matches the live engine's root-discovery behavior, stderr behavior, or exit-code conventions. No contract test pins the assumed argv + JSON-field shape to what the live engine actually emits.

**Evidence:** Hook argv at `.claude/hooks/SessionStart.sh:50` + `.claude/hooks/SessionEnd.sh:55`. Stub argv handling at `tests/runner/session-hook-behavior.test.ts:67` + `:72` + `:78`. Hook `CLAUDE_PROJECT_DIR` passage at `tests/runner/session-hook-behavior.test.ts:92` + `:95`. No contract test in the pre-fold-in repo pinning the stub's assumed shape against the live engine.

**Impact:** The tests can pass even if the real engine requires a different project-root convention, emits incompatible JSON, or changes failure behavior in a way the hooks silently swallow.

**Remediation:** Pin the stub to a documented subset of live engine behavior. Prefer a shared fixture/contract test that compares the stub's `continuity status --json` shape and argv assumptions against the real portable engine helper, including root discovery and nonzero/invalid-output cases.

**Disposition:** Incorporated. Added `tests/runner/hook-engine-contract.test.ts` pinning the contract as:
- `HOOK_ENGINE_ARGV` enumerates every argv form the hooks invoke (`['continuity', 'status', '--json']` — the only one).
- `HOOK_ENGINE_JSON_FIELDS` enumerates every jq path the hooks extract (`.selection`, `.record.narrative.goal`, `.record.narrative.next`, `.warnings`, `.record.record_id`, `.record.git.base_commit`).
- Argv contract: scans both hook scripts and asserts the pinned argv is present AND no other `continuity` subcommands (save/resume/clear) appear in the hooks.
- JSON field contract: asserts both hook scripts parse exactly the pinned jq paths.
- Stub conformance: exercises the canned-JSON stub against the pinned argv + JSON field set; a stub refactor that drops the contract trips this test.
- Live drift check: env-gated on `CIRCUIT_HOOK_ENGINE_LIVE=1` — when enabled and `.circuit/bin/circuit-engine` is executable, the test exercises the LIVE engine's `continuity status --json` and asserts the payload has `.selection` at the pinned jq path. This gives operator-local drift detection without requiring the prior-gen plugin install in CI.

## MED

### MED 1 — tsx EPERM fix removes subprocess coverage, replaces with only a static npm-script string assertion

**Finding:** The CLI smoke now imports `main` directly and invokes it in-process. The only remaining package-script coverage asserts `package.json` contains the literal string `tsx src/cli/dogfood.ts`. Regressions in the process entrypoint wrapper, `process.argv` slicing, top-level `main` dispatch, `process.exitCode`/exit propagation, tsx resolution, or stdout/stderr process behavior are no longer exercised.

**Evidence:** Direct-import CLI smoke at `tests/runner/dogfood-smoke.test.ts:268` + `:277`. Static package.json string assertion at `tests/runner/dogfood-smoke.test.ts:305` + `:313`.

**Impact:** The original EPERM failure is avoided, but the claim that every subprocess code path is still covered is too broad. A regression in the entrypoint wrapper or exit-code propagation can land green here.

**Remediation:** Keep the direct import for sandbox portability, but add a narrow non-EPERM process-boundary contract: for example, statically assert the entrypoint wrapper calls `main(process.argv.slice(2))` and propagates the returned exit code, or add a subprocess smoke behind an explicit environment gate that is not counted as the only CLI coverage.

**Disposition:** Deferred with HARD bounded trigger (not "if drift recurs"). Captured here as: a subprocess-boundary contract test (either static assert on the wrapper pattern, or an env-gated subprocess smoke) MUST land in or before:
- the next slice that modifies `src/cli/dogfood.ts`, OR
- the next slice that modifies `tests/runner/dogfood-smoke.test.ts`, OR
- the next slice that modifies the `"dogfood"` entry in `package.json`,

whichever fires first. First-version shape (per Codex's recommendation): read `src/cli/dogfood.ts` as text and assert the entrypoint wrapper calls `main(process.argv.slice(2))` AND propagates the returned exit code to `process.exitCode`. If that shape is too brittle (e.g. the wrapper moves to a different module), fall back to an env-gated subprocess smoke using `execFile` on a `tsx`-compatible path with `CIRCUIT_CLI_SUBPROCESS_SMOKE=1`. The slice that lands this check declares it in its commit body (same pattern as the MED 2 mechanical enforcement trigger from Slice 47c-2 Codex MED 2). Captured at Slice 47b fold-in commit body.

## LOW

No LOW findings.

## META

No META findings.

## Trajectory check

The slice points in the right direction: executing the hook scripts is a real improvement over presence-only evidence (Codex Slice 47a comprehensive review HIGH 2 is closed as a hook-level finding), and removing the fragile `tsx` subprocess from the default smoke path resolves the EPERM portability issue (Codex Slice 47a comprehensive review HIGH 1 is closed). The remaining problem at opening was evidentiary granularity: the slice proves hook rendering and engine lifecycle as separable facts, but CC#P2-4 is written as an integrated lifecycle claim. **Post-fold-in (this commit), HIGH 1 + HIGH 2 are incorporated via `tests/runner/session-hook-lifecycle.test.ts` (lifecycle integration) + `tests/runner/hook-engine-contract.test.ts` (contract pin) + ADR-0007 CC#P2-4 close-state history table. MED 1 is deferred with a HARD bounded trigger (not "if drift recurs"). The closing verdict moves to ACCEPT-WITH-FOLD-INS.** The arc now carries the full CC#P2-4 lifecycle evidence chain: engine-CLI surface (continuity-lifecycle.test.ts from Slice P2.7) + hook banner rendering (session-hook-behavior.test.ts from Slice 47b) + end-to-end integration (session-hook-lifecycle.test.ts + hook-engine-contract.test.ts from this fold-in).
