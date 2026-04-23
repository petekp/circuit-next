---
plan: clean-clone-reality-tranche
status: in-progress
opened_at: 2026-04-22
opened_in_session: post-slice-50-first-principles-reanalysis
supersedes: specs/plans/project-holistic-foldins.md
trigger: |
  At Slice 51 ratification, operator commissioned a first-principles re-analysis
  through both Claude and Codex on whether the 18-slice fold-in arc in
  `specs/plans/project-holistic-foldins.md` was the right response to the
  2026-04-22 project-holistic critical review. The analysis surfaced a finding
  both review prongs missed: `tests/runner/continuity-lifecycle.test.ts:55-107`
  hardcodes `.circuit/bin/circuit-engine`, which is `.gitignore`d at line 20
  and not tracked by git. A clean clone fails 12/12 tests in that file with
  `spawnSync ENOENT` (verified at Slice 51 by hiding the shim and running the
  test file). The project's "34 green / 0 yellow / 0 red" audit claim is
  partly operator-machine state, not portable state. This finding inverts the
  arc's ordering: reproducibility of verification is prerequisite to any
  correctness claim downstream, including plugin wiring and the four runtime
  HIGHs in the old plan's execution slices. The 18-slice arc (15 execution
  slices, ~8 of them methodology/governance tightening) also confirmed — in
  its own shape — the exact ratio critique (Codex Q1, Claude HIGH 1) the
  review named. This plan replaces that arc with a 4-slice tranche that
  (a) lands clean-clone portability first, (b) fixes the two dispatch-path
  runtime HIGHs that break correctness at first real invocation, (c) closes
  with a composition review that disposes the remaining 30+ findings as
  defer-with-named-trigger rather than fold-in-this-arc.
authority:
  - specs/reviews/phase-project-holistic-2026-04-22-codex.md (Codex HIGH 11 tsx EPERM, HIGH 14 dispatch verdict, HIGH 15 materializer, plus the clean-clone engine-shim finding verified at Slice 51 that neither prong caught)
  - specs/reviews/phase-project-holistic-2026-04-22-claude.md (concurring on ratio critique + methodology-drag pattern)
  - CLAUDE.md §Cross-slice composition review cadence (4-slice arc touching privileged runtime requires arc-close composition review)
  - CLAUDE.md §Hard invariants #6 (every ratchet-advancing execution slice in this arc requires Codex challenger pass)
  - User memory `feedback_plans_must_be_persisted.md` (plans must be persisted before execution)
---

# Clean-Clone Reality Tranche

This plan replaces the 18-slice fold-in arc (`specs/plans/project-holistic-foldins.md`) with a 4-slice tranche. The supersession is operator-ratified at Slice 51 after first-principles re-analysis through both Claude and Codex surfaced a clean-clone portability failure that the project-holistic review itself missed.

## Why supersession, not revision

The old plan's ordering debate (plugin-first vs runtime-correctness-first) was itself anchored to a presumption that the default-verify baseline was portable. It is not. A tranche that fixes portability first — before landing any new correctness claim or capability surface — beats both branches of the prior ordering argument.

Additionally: the old plan's 15 execution slices were ~7 capability-visible vs ~8 governance/methodology-tightening. Executing that arc would have consumed ~7.5 hours with no new user-facing surface at close. That shape is itself an instance of the ratio critique the review named. A 4-slice tranche lands a working invocation by close and disposes the remaining 30+ findings at arc-close as defer-with-named-trigger.

## Disposition of the old plan's 40-finding pool

Findings folded into this tranche (4 of 40):
- Codex H11 (tsx EPERM) → Slice 52 (part of clean-clone gate)
- Codex H22 (session hooks no-op on missing engine) → Slice 52 (resolved by portable-stub pattern for continuity-lifecycle test file)
- Codex H14 (dispatch verdict binding) → Slice 53
- Codex H15 (materializer schema-parse) → Slice 54

Findings disposed at arc-close (Slice 55) as defer-with-named-trigger (36 of 40):
- Claude H4 / Codex M12 (plugin-command placeholder) → defer to next arc: user-visible capability work opens after this tranche closes; plugin wiring is that arc's opener.
- Codex H6 / Claude L3 (CC#P2-1 placeholder-parity wording) + Claude H2 (middle-third) → defer to Slice 55 inline PROJECT_STATE correction (not its own slice).
- Codex H7 (Check 35 self-declaration gap) → defer-with-named-trigger: next ratchet-advancing commit that falsely declares "Codex challenger: REQUIRED" without a review record. Check 35 is self-attested by design today; if a future miss is caught, reopen.
- Codex H19 (default verify live-smoke separation) → defer-with-named-trigger: next time the "verify green / smoke fingerprint green" wording appears in operator-facing docs; inline correction.
- All remaining MED/LOW/META (30+ findings) → disposed as ACCEPT-AS-OBSERVATION or defer-with-named-trigger at Slice 55. Each finding gets a line in the arc-close ledger with a concrete trigger (e.g., "next capability slice touching X").

The operator directive "zero findings unaddressed" is satisfied by explicit disposition at arc-close, not by a fold-in slice per finding.

## Slice structure

### Slice 51 — Operator decision: supersede old plan + author this plan (THIS SLICE)

**Lane:** Discovery (plan-file-only commit; no ratchet advance; no audit-coverage addition)
**Failure mode addressed:** Old plan was authored against a baseline (default verify portable) that first-principles re-analysis proved incorrect. Without superseding it, execution would open at the wrong slice (plugin wiring) against an unverifiable foundation.
**Acceptance evidence:** This plan file exists. Old plan's frontmatter `status` is `superseded`. PROJECT_STATE.md has a Slice 51 operator-decision entry naming the finding + direction change. `npm run audit` stays 34 green / 0 yellow / 0 red.
**Alternate framing:** (a) Revise the old plan in-place with ordering + scope edits. Rejected — the material change is the ordering premise itself (portability before correctness before capability), which invalidates enough of the old plan's slice map that a replacement reads more honestly than a diff. (b) Defer the supersession, execute the old plan as-written. Rejected — executing against a baseline known to be non-portable is exactly the Q2/Q8 failure class Codex flagged and Claude concurred on.
**Trajectory check:** Arc goal — operator chooses the direction for the review-response arc. Phase goal — Phase 2 continues. Prior-slice terrain — Slice 50 authored the old plan; first-principles re-analysis at Slice 51 produced this supersession. No earlier slice made this smaller.
**Scope:** Author this plan file. Mark old plan `status: superseded`. PROJECT_STATE.md entry + current_slice markers (README.md, TIER.md).
**Ratchet:** No advance.
**Codex challenger:** NOT REQUIRED (plan authoring / operator-decision slice; Slice 50 precedent).

### Slice 52 — Clean-Clone Reality Gate

**Lane:** Ratchet-Advance (audit-coverage tightening + test portability)
**Failure mode addressed:** (a) `tests/runner/continuity-lifecycle.test.ts:55-107` hardcodes `.circuit/bin/circuit-engine` as default-path test dependency; `.gitignore:20` ignores `.circuit/`; `git ls-files` does not track the shim. A clean clone fails 12/12 tests in that file. Verified at Slice 51 by hiding the shim and running the test file. (b) `package.json:20` binds `circuit:run` to `tsx src/cli/dogfood.ts`; `npm run circuit:run -- --help` fails with `listen EPERM` in constrained /tmp environments (Codex H11). The same tsx IPC failure class is already documented at `tests/runner/dogfood-smoke.test.ts:254-268` as the reason tests moved to direct `main()` import. (c) CC#P2-4 "active — satisfied" is partly operator-machine state (Codex H22 — hooks exit silently without the engine shim on clean clones).
**Acceptance evidence:** A clean-clone smoke script (`scripts/clean-clone-smoke.sh` or equivalent; tracked) runs `npm ci` → `npm run verify` → `npm run audit` → `npm run circuit:run -- --help` with `.circuit/` absent and no env vars set, and all four succeed. The smoke script is runnable locally and gated in CI if CI exists (Tier 0 — no CI requirement yet, but the script is the operator-facing reproducibility artifact). `continuity-lifecycle.test.ts` converted to use the `CIRCUIT_HOOK_ENGINE_LIVE=1` env-gate pattern already used by `tests/runner/hook-engine-contract.test.ts:194-210`, OR a tracked portable stub engine (30-line bash per Slice 47b precedent). `package.json` adds a `build` script using `tsconfig.build.json`; `circuit:run` binding swaps from `tsx src/cli/dogfood.ts` to `node dist/cli/dogfood.js`; `verify` gains a `build` prerequisite so compiled output is always current before test runs. Test pins on the tsx invocation (`tests/runner/dogfood-smoke.test.ts:332`, `tests/contracts/slice-27d-dogfood-run-0.test.ts:118` — paths verified during slice execution) updated to the compiled-JS path.
**Alternate framing:** (a) Track the engine shim as a git-committed binary. Rejected — the shim is generated by plugin install; tracking it creates sync drift between plugin and repo. Portable stub or env-gate is cleaner. (b) Keep tsx and gate the CLI entrypoint test only. Rejected — that's what Slice 47d did (`CLI_SMOKE=1`); the operator-facing `circuit:run` script still fails. The fix must reach the product entrypoint. (c) Build step in CI only, leave local as tsx. Rejected — there is no CI; the operator-local invocation is the product invocation.
**Trajectory check:** Arc goal — a fresh clone can reproduce the verify + audit + CLI-help baseline. Phase goal — every downstream correctness claim (Slices 53/54 and all future runtime slices) lands on a portable baseline. Prior-slice terrain — Slice 47b introduced portable stubs for hook lifecycle; Slice 47d env-gated CLI entrypoint test; Slice 46b introduced the continuity-lifecycle test that this slice addresses. The pattern is established; this slice applies it to the remaining non-portable surfaces.
**Scope:**
1. Convert `tests/runner/continuity-lifecycle.test.ts` to portable pattern — prefer env-gate (`CIRCUIT_HOOK_ENGINE_LIVE=1`) over tracked stub for minimal surface area; choose at implementation time.
2. Add `build` script to `package.json` using `tsconfig.build.json`.
3. Swap `circuit:run` binding to compiled-JS path.
4. Chain `build` into `verify` (or into the `circuit:run` script via `run-s` / explicit `npm run build && node dist/...`).
5. Update test pins on tsx invocation.
6. Author `scripts/clean-clone-smoke.sh` (or `.mjs`) exercising the clean-clone path.
7. PROJECT_STATE.md Slice 52 entry + ADR-0007 CC#P2-4 close-state ledger row clarifying clean-clone portability.
**Ratchet:** Contract-test count advances (clean-clone smoke + any new test coverage). Audit-coverage may advance (new check binding clean-clone smoke freshness).
**Codex challenger:** REQUIRED (ratchet advance + privileged runtime surface — CLI entrypoint + test portability contract).

### Slice 53 — Dispatch verdict truth (Codex H14)

**Lane:** Ratchet-Advance (privileged runtime — gate evaluation now consults adapter output)
**Failure mode addressed:** `src/runtime/runner.ts:146-157` `dispatchVerdictForStep` returns `step.gate.pass[0]` — the first allowed verdict — without reading adapter output. `runner.ts:451-500` passes that verdict into `materializeDispatch` and emits `gate.evaluated` with `outcome: 'pass'` unconditionally. The dogfood stub at `tests/runner/dogfood-smoke.test.ts:60-64` returns arbitrary `result_body` bytes; the runner does not parse them before passing the gate. Model output can be malformed, rejecting, or unrelated — the workflow advances anyway. This is the exact "gates pass by construction" failure mode the explore contract's gate schema is supposed to prevent.
**Acceptance evidence:** `dispatchVerdictForStep` parses adapter output (against `step.gate.schema` if declared, or against a minimal `{verdict: string}` shape) and returns the verdict declared by adapter output IF it appears in `step.gate.pass`. If adapter output is unparseable OR declares a verdict not in `step.gate.pass`, the runner emits `gate.evaluated` with `outcome: 'reject'` + the reason, and the step does not advance. New tests: `tests/runner/gate-evaluation.test.ts` covers (a) happy-path pass verdict from adapter output, (b) reject verdict from adapter output, (c) unparseable adapter output → reject, (d) adapter-declared verdict not in `gate.pass` → reject.
**Alternate framing:** (a) Schema-parse adapter output at the materializer layer, not the runner layer. Rejected — the materializer writes the artifact; the runner decides the gate. Conflating them would couple the verdict decision to artifact shape. (b) Treat the first `gate.pass` verdict as the default fallback when adapter output is empty. Rejected — that re-introduces the silent-pass path; adapter output is the canonical source, not a suggestion.
**Trajectory check:** Arc goal — a workflow cannot advance past a dispatch step unless adapter output declares an allowed verdict. Phase goal — CC#P2-1 at orchestrator-parity (P2.10) gains a prerequisite. Prior-slice terrain — Slice 43b introduced the runDogfood async seam; Slice 43c closed the explore e2e fixture against the placeholder artifact; this slice closes the gate-evaluation gap that the placeholder masked.
**Scope:**
1. Amend `src/runtime/runner.ts::dispatchVerdictForStep` signature + implementation to accept `adapterResult` and parse for verdict.
2. Update `runner.ts:451-500` caller site.
3. Add `GateAdapterOutputSchema` (or equivalent) if not already present.
4. New test file `tests/runner/gate-evaluation.test.ts` with the four cases.
5. Update explore contract at `specs/contracts/explore.md` if semantics need explicit statement.
6. Update dogfood stub fixture at `tests/runner/dogfood-smoke.test.ts` to emit a schema-valid verdict payload.
**Ratchet:** Contract-test count advances. Audit-coverage may advance.
**Codex challenger:** REQUIRED.

### Slice 54 — Materializer schema-parse (Codex H15)

**Lane:** Ratchet-Advance (privileged runtime — materializer now schema-parses per contract MUST)
**Failure mode addressed:** `specs/contracts/explore.md:551-558` states: "The runtime MUST write `writes.artifact.path` by schema-parsing the result payload against `writes.artifact.schema`." `src/runtime/adapters/dispatch-materializer.ts:94-102` admits v0 writes raw `result_body` bytes with "no schema parsing," and `dispatch-materializer.ts:139-145` writes the raw result to both transcript and artifact paths. Downstream steps that read the artifact see unvalidated bytes. This is the exact failure ADR-0008 named. Slice 53 closed the verdict-admissibility half (gate-fail does not write the canonical artifact); Slice 54 closes the artifact-shape half (parse-fail does not write either, even on gate pass).
**Acceptance evidence:** `materializeDispatch` (or its caller in the runner) schema-parses adapter output against `writes.artifact.schema` before writing the canonical artifact at `writes.artifact.path`. The artifact write requires BOTH (a) verdict gate pass per Slice 53 AND (b) schema parse success per Slice 54 — failure on either path leaves `writes.artifact.path` absent on disk. Parse failure emits `gate.evaluated` with `outcome: 'fail'` and a reason naming the schema parse error (mirroring the Slice 53 reject-on-bad-verdict shape so the failure-path event surface is uniform), then `step.aborted`, then `run.closed outcome=aborted`. New tests: `tests/runner/materializer-schema-parse.test.ts` covers (a) valid payload round-trip → artifact written + outcome=complete, (b) invalid payload → no artifact write + outcome=aborted with parse reason, (c) schema-missing fallback behavior (fail-closed — operator decision at implementation, but rejected is the preferred default per contract MUST), (d) interaction with Slice 53: gate-fail on bad verdict still skips artifact write even when the body would otherwise be schema-valid (regression for the Slice 53 HIGH 2 fold-in).
**Alternate framing:** (a) Schema-parse at the runner level before calling materializeDispatch. Rejected — duplicates schema logic; the materializer is the right layer. (b) Introduce a separate `validateDispatch` helper that the materializer consumes. Preferred implementation pattern; not a framing alternate.
**Trajectory check:** Arc goal — downstream artifact consumers see validated bytes. Phase goal — CC#P2-1 at orchestrator-parity (P2.10) gains a prerequisite. Prior-slice terrain — Slice 45a introduced DispatchFn structured descriptor + 47a landed real selection provenance on `dispatch.started`; this slice closes the symmetric artifact-write correctness gap.
**Scope:**
1. Amend `src/runtime/adapters/dispatch-materializer.ts` to schema-parse result_body against `writes.artifact.schema`.
2. Emit `dispatch.failed` event on parse failure; do not write artifact.
3. New test file `tests/runner/materializer-schema-parse.test.ts`.
4. Amend `specs/contracts/explore.md` if MUST wording needs a complementary "schema absent → fail closed" clarification.
5. Verify CC#P2-1 placeholder flow still completes under new validation (placeholder body is schema-valid by construction per Slice 44 amendment).
**Ratchet:** Contract-test count advances. Audit-coverage may advance.
**Codex challenger:** REQUIRED.

### Slice 55 — Arc-close composition review + remaining-findings disposition ledger

**Lane:** Equivalence Refactor (arc-close ceremony) + Discovery (composition review)
**Failure mode addressed:** Per CLAUDE.md §Cross-slice composition review cadence, a 4-slice arc touching privileged runtime (52-54) requires arc-close composition review before the next privileged runtime slice opens. Separately, operator directive "zero findings unaddressed" requires explicit disposition of the 36 findings from the project-holistic review that are not folded into this tranche.
**Acceptance evidence:** `specs/reviews/arc-clean-clone-reality-composition-review-claude.md` + `specs/reviews/arc-clean-clone-reality-composition-review-codex.md` land in the same commit as `current_slice` advance, per Check 26. Both prong files carry closing verdict ACCEPT or ACCEPT-WITH-FOLD-INS. Claude prong body carries the disposition ledger: 36 findings not folded-in, each with explicit disposition (ACCEPT-AS-* with rationale OR defer-with-named-trigger). Codex prong is dispatched via `/codex` skill with the arc scope brief. **Composed dispatch failure story (Slice 53 Codex META 2 fold-in):** the composition review MUST verify the cross-slice failure invariant — bad model output (verdict not in pass, OR unparseable, OR parseable with no verdict, OR schema-invalid artifact body) produces a durable `request/receipt/result` transcript on disk, NO canonical artifact at `writes.artifact.path`, NO `step.completed` for the failed step, `run.closed outcome=aborted` with the reason text byte-identical across `gate.evaluated` / `step.aborted` / `run.closed` / `RunResult.reason`. Slice 53 closes verdict admissibility; Slice 54 closes artifact-shape; Slice 55 must prove the composition is honest and is not surfacing only the union of per-slice claims. **Slice-53-deferred items the ledger MUST dispose:** (a) Codex MED 1 — `dispatch.completed.verdict` schema bump to distinguish runtime-injected `'<no-verdict>'` sentinel from adapter-declared verdicts (trigger: first downstream consumer that needs to disambiguate). (b) Codex LOW 2 — reason-string length bounds / truncation policy (trigger: next event-log hygiene pass). (c) Slice 53 audit yellows — AGENT_SMOKE / CODEX_SMOKE fingerprint mismatches caused by `src/runtime/runner.ts` source SHA change (trigger: operator-local re-promotion via `AGENT_SMOKE=1 UPDATE_AGENT_FINGERPRINT=1` and `CODEX_SMOKE=1 UPDATE_CODEX_FINGERPRINT=1`).
**Alternate framing:** (a) Split arc-close into two slices: composition review + disposition ledger. Rejected — same-commit-staging discipline (Check 26) requires prong files + slice marker advance in one commit. (b) Defer non-folded-in findings to a future arc without explicit trigger. Rejected under operator directive. (c) Fold every finding into its own micro-slice. Rejected — that's the old plan's failure mode.
**Trajectory check:** Arc goal — all 40 review findings have explicit disposition at close; clean-clone portable baseline is live; dispatch-path runtime HIGHs are closed. Phase goal — before the next capability arc (plugin wiring, P2.8 router, P2-MODEL-EFFORT, or P2.9), the project-holistic review findings are either folded in or explicitly accepted/deferred with triggers. Prior-slice terrain — Slices 51-54 executed the tranche; this slice closes the arc per CLAUDE.md cadence.
**Scope:**
1. Author Claude composition-adversary prong. Body includes the 36-finding disposition ledger.
2. Dispatch Codex cross-model challenger prong via `/codex` skill with arc scope brief.
3. Stage prong files + advance `current_slice` to 55 in a single commit per Check 26.
4. Advance ratchet floors (per accumulated test additions across the arc).
5. PROJECT_STATE.md arc-close entry.
6. Plan frontmatter `status: closed`.
**Ratchet:** Floor advance. Governance-surface movement.
**Codex challenger:** Arc-close composition review IS the Codex challenger pass (per Slice 47d + Slice 50 precedents).

## Arc close criterion

This arc closes when:
1. `npm run audit` is no-red (accepted yellows enumerated explicitly per Slice 47d precedent).
2. A clean clone reproduces `npm run verify` + `npm run audit` + `npm run circuit:run -- --help` green with no env vars and no engine shim present.
3. Dispatch verdicts come from adapter output, not `step.gate.pass[0]`.
4. Materializer schema-parses before writing; failure emits `dispatch.failed`.
5. All 40 findings from the project-holistic review have explicit disposition (4 folded in + 36 disposed at arc-close ledger).
6. Both prongs of arc-close composition review land ACCEPT or ACCEPT-WITH-FOLD-INS.
7. PROJECT_STATE.md updated; plan frontmatter `status: closed`.

After arc close, the next arc opens on capability work — plugin wiring (Claude H4) or P2.8 router or P2-MODEL-EFFORT or P2.9 second workflow — against a portable baseline with honest dispatch semantics.
