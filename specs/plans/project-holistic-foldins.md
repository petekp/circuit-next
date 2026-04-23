---
plan: project-holistic-foldins
status: superseded
opened_at: 2026-04-22
closed_at: 2026-04-22
opened_in_session: post-slice-49-continuity-resume
superseded_by: specs/plans/clean-clone-reality-tranche.md
supersession_rationale: |
  At Slice 51 ratification, operator commissioned a first-principles re-analysis
  through both Claude and Codex. The re-analysis surfaced a finding neither
  project-holistic review prong caught: `tests/runner/continuity-lifecycle.test.ts:55-107`
  hardcodes `.circuit/bin/circuit-engine`, which is `.gitignore`d (line 20) and
  not tracked by git. A clean clone fails 12/12 tests in that file with
  `spawnSync ENOENT` (verified at Slice 51 by hiding the shim and running the
  test). The default-verify baseline this plan's ordering debate anchored to
  (plugin-first vs runtime-correctness-first) is partly operator-machine state.
  Reproducibility of verification is prerequisite to any downstream correctness
  claim, which inverts both branches of the prior ordering argument.

  Separately: the 15-execution-slice arc (~8 governance/methodology-tightening)
  was itself an instance of the ratio critique (Codex Q1, Claude HIGH 1) the
  review named. A 4-slice tranche with 36 findings disposed at arc-close as
  defer-with-named-trigger closes the review more honestly than a 15-slice
  fold-in arc that confirms the critique in its own shape.

  Replacement plan: `specs/plans/clean-clone-reality-tranche.md` (Slice 51
  authoring + 52 Clean-Clone Reality Gate + 53 dispatch verdict truth +
  54 materializer schema-parse + 55 arc-close composition review with
  explicit disposition ledger for the 36 findings not folded in).
trigger: |
  Project-holistic critical review at HEAD 52bba0a (recorded at Slice 49, HEAD 3f379bb) returned a divergent two-prong verdict:
  - Claude fresh-read prong: ACCEPT-WITH-FOLD-INS (4 HIGH / 7 MED / 4 LOW / 3 META)
  - Codex cross-model challenger prong: REJECT-PENDING-FOLD-INS (7 HIGH / 14 MED / 1 LOW / 1 META)
  Charter §Anti-sycophancy framing treats verdict divergence as a feature — the prongs agreeing on findings is stronger signal than the prongs agreeing on endorsements. Combined finding pool at project scope: 11 HIGH (1 already resolved by Slice 48 = 10 open) + 21 MED + 5 LOW + 4 META = 40 findings.
  Operator directive (2026-04-22, explicit this session): ZERO findings unaddressed — every finding gets an explicit disposition (fix / accept-by-design with rationale / defer with named trigger). This plan structures that arc.
authority:
  - specs/reviews/phase-project-holistic-2026-04-22-codex.md (operative REJECT verdict — literal-rule governance)
  - specs/reviews/phase-project-holistic-2026-04-22-claude.md (concurring ACCEPT-WITH-FOLD-INS verdict + trajectory-honesty findings)
  - specs/reviews/phase-project-holistic-2026-04-22-scope.md (commissioning charter + eight-question structure)
  - CLAUDE.md §Cross-slice composition review cadence (this plan IS an arc of ≥3 slices touching privileged runtime + governance surfaces; arc-close composition review required)
  - CLAUDE.md §Hard invariants #6 literal (ratified at Slice 47c-2; every ratchet-advancing execution slice requires a Codex challenger pass)
finding_disposition_summary: |
  10 HIGH / 21 MED / 5 LOW / 4 META → 16 execution slices organized by phase:
  1. Plugin-CLI wiring (Slice 51) — Claude H4 / Codex M12 (capability advance; doubles as Codex Q1 / Q4 methodology-ratio defense).
  2. Runtime correctness (Slices 52-55) — Codex H14 dispatchVerdictForStep / H15 materializer schema-parse / H11 tsx IPC EPERM / H22 session hooks clean-clone.
  3. Convergent findings (Slices 56-57) — CC#P2-1 placeholder-parity honesty correction (Claude L3 + Codex H6 + Codex M2 + Claude H2 PROJECT_STATE "middle third" + Codex M13 trajectory); ratchet split runtime_invariant vs audit_machinery (Claude M5 + Claude M10 + Codex M10 + Codex M20 + Claude L2 + Claude M6 ratchet-floor notes refactor).
  4. Audit hardening (Slices 58-60) — Codex H7 Check 35 self-declaration gap; Codex M8 arc-subsumption validation + Codex M9 Check 34 scan scope; Codex H19 default-verify live-smoke separation.
  5. MED/LOW/META catch-all (Slices 61-65) — Codex M3/M4/L5 docs frontmatter; Claude M4 ADR-0007 §4c inherited ratchets; Codex M16 runDogfood terminals + Codex M21 explore properties; Claude M8 slice-id + Claude META2 trajectory check + Claude H3 framing regex follow-up; Codex M1 D10 tuning + Claude M1 ledger target_class + Codex META18 correlation rate + Codex M17 non-LLM cold-read.
  6. Arc-close composition review (Slice 66) — two-prong Claude + Codex per CLAUDE.md cadence; closing body incorporates the explicit disposition ledger for every accept-by-design / defer-with-trigger finding (Claude H1 ratio, Claude M2 ritual verdict, Claude M7 "next" deferred, Claude M9 DispatchFn acknowledgment, Claude META1 correlation, Claude META3 review-inherits-ratio, Claude L1 fresh-read, Claude L4 P2.9, Codex M23 advertised-surface).
---

# Project-Holistic Fold-In Arc

This plan structures the response to the 2026-04-22 project-holistic critical review (filed at Slice 49). The arc absorbs the 40-finding aggregate surface of the two prongs with the constraint that zero findings are left unaddressed: each finding carries an explicit disposition, either folded into an execution slice or recorded in the arc-close disposition ledger with rationale (accept-by-design) or named trigger (defer).

The arc ordering leads with plugin-CLI wiring (Claude Q5 / P2.11 promotion) rather than runtime correctness. Rationale: the single highest-impact lever on the Codex Q1 ("methodology-ratio dominance") + Codex Q4 ("trajectory hardening, not shipping") criticisms is a capability advance that reaches the advertised slash-command surface. Interleaving the plugin slice first makes the arc itself a counter-example to the ratio critique the review raised, rather than another eight-commit audit-tightening run that confirms it.

Operator can revise ordering during the plan-review slice (Slice 51 is a ratification slot — see §Slice 51 below). Plan-ratification may either land as an operator edit to this file plus a Slice 51 commit, or be accepted as-is in which case Slice 51 is a one-line PROJECT_STATE entry recording ratification and Slice 52 opens execution.

## Continuity decisions baked into this plan

From the project-holistic review records + operator directive this session:

- **Every finding gets an explicit disposition.** No "rejected as noise" without rationale. No "will decide later" without a named trigger. The arc-close composition review body at Slice 66 carries the full disposition ledger.
- **Plugin-CLI wiring leads execution.** Capability-interleave defense against the Codex Q1 methodology-ratio critique. Operator can revise.
- **Claude HIGH 3 (checkFraming regex false-negative for 10+ commits) is already RESOLVED at Slice 48.** The regex widening is committed. The residual concern — that the widened regex is now permissive enough to match mid-prose mentions — is folded into Slice 64 as a follow-up tightening, not a retroactive fix.
- **Claude MED 9 (DispatchFn seam retrospective) is acknowledgment, not actionable.** The drift was caught and fixed at Slice 45a; the Slice 47d amnesty scope covered the committed state. Recorded in the Slice 66 disposition ledger as ACCEPT-AS-HISTORICAL.
- **The arc does NOT include P2.5.1 explore property promotion as its own slice.** Codex M21 flagged four phase2-property explore properties (`artifact_emission_ordered`, `review_after_synthesis`, `no_skip_to_close`, `reachable_close_only_via_review`) as deferred. They fold into Slice 63 alongside runDogfood terminal-coerce fix (Codex M16) because both touch the same workflow-execution correctness surface.
- **The arc does NOT open P2-MODEL-EFFORT or P2.8 router.** Both are Phase 2 close-path work that needs its own framing slice. This arc's scope is fold-ins against the review; the next arc opens P2-MODEL-EFFORT or P2.8 (Claude M7 binding).
- **META findings about the review process are ACCEPT-AS-OBSERVATION unless they name a concrete fix.** Claude META3 (this review inherits HIGH 1 ratio critique) does not require a code change — it is a signal the operator reads alongside the review body.

## Convergence / divergence map

The charter framed divergence between prongs as disproportionately weighted signal. Key findings by convergence:

### STRONG CONVERGENCE (both prongs flagged, similar framing)

| Concern | Claude prong | Codex prong | Slice |
|---|---|---|---|
| Plugin commands return placeholders | **HIGH 4** (Q5) | **MED 12** (Q4) | Slice 51 |
| CC#P2-1 satisfied at placeholder-parity, not orchestrator-parity | LOW 3 (Q8) | **HIGH 6** (Q2) | Slice 56 |
| Contract-test-count ratchet conflates audit-machinery with runtime invariants | MED 5 (Q3) | MED 10 (Q3) | Slice 57 |
| Tests assert naming / constants rather than behavior | LOW 2 (Q7) | MED 20 (Q7) | Slice 57 |
| Recent commit trajectory is hardening-heavy; capability work waiting | **HIGH 1** (Q1) | MED 13 (Q4) | Slice 56 (honesty) + this arc's plugin-first ordering |
| Correlation claimed but not computed | META 1 (Q6) | **META 18** (Q6) | Slice 65 |

**Severity divergence cases** — Codex saw a HIGH where Claude saw a LOW (CC#P2-1 placeholder-parity), and Claude saw a HIGH where Codex saw a MED (plugin placeholder) — both are treated at the higher severity in slicing.

### STRONG DIVERGENCE (one prong raised, other did not)

**Codex-only HIGHs** (Claude missed these; give disproportionate weight per charter §Anti-sycophancy framing):

| Codex finding | Why Claude missed it | Slice |
|---|---|---|
| H7 Check 35 self-declaration gap | Claude treated Check 35 as working enforcement; Codex ran it against HEAD and observed the not-applicable silent-pass path | Slice 58 |
| H11 tsx IPC EPERM CLI entrypoint | Claude read the entrypoint code but did not run `npm run circuit:run` in its sandbox; Codex did and hit EPERM | Slice 54 |
| H14 dispatchVerdictForStep returns first allowed verdict | Claude read the runner.ts but didn't trace the gate.evaluated emission; Codex traced the code path and found the unconditional outcome='pass' | Slice 52 |
| H15 materializer schema-parse violation | Claude didn't cross-check contract explore.md:551-558 MUST against dispatch-materializer.ts:94-102; Codex did | Slice 53 |
| H19 default verify skips live subprocess paths | Claude noted the env-gates as expected; Codex noted that "verify green" + "smoke fingerprint green" together over-assert current executable state | Slice 60 |
| H22 Session hooks no-op on missing engine | Claude observed hooks tracked + executable; Codex observed the `exit 0` silent path when `.circuit/bin/circuit-engine` absent (CC#P2-4 "satisfied" without live hook behavior on clean clones) | Slice 55 |

**Claude-only HIGHs** (Codex treated these as MEDs or did not flag; extra scrutiny per charter):

| Claude finding | Why Codex may have weighed differently | Slice |
|---|---|---|
| H1 Methodology-ratio dominates recent commits | Codex saw the same pattern but framed it as MED 13 trajectory tradeoff; Claude flagged it as a categorical concern | Arc structure itself (plugin-first) + Slice 66 disposition ledger |
| H2 "Middle third" framing understates what's left | Codex referenced the placeholder-parity concern (H6) but didn't call out the PROJECT_STATE summary text; Claude cited the specific line | Slice 56 |
| H3 checkFraming regex silent false-negative | Fixed at Slice 48 before review; Claude noted the residual "widened regex now too permissive" tension; Codex didn't see the historical false-negative as a concern | Slice 64 (follow-up tightening) |

## Arc structure

### Slice 50 — Plan authoring (THIS SLICE)

**Lane:** Discovery (plan surface lands; no ratchet advance; no audit-coverage addition)
**Failure mode addressed:** The project-holistic review returned divergent prong verdicts with 40 findings in aggregate. Without a plan, the operator faces a 40-item decision without an ordering or named dispositions, and execution-slice framing becomes reactive rather than planned.
**Acceptance evidence:** This plan file lands at `specs/plans/project-holistic-foldins.md`. PROJECT_STATE.md Slice 50 entry references the plan. `npm run audit` stays 34 green / 0 yellow / 0 red (no ratchet or audit-coverage movement).
**Alternate framing:** (a) Absorb fold-ins directly into a single arc-close commit without an explicit plan. Rejected — the review surface is too large (40 findings) to hold in commit bodies, and the operator explicitly asked for an arc with a plan file mirroring slice-47-hardening-foldins.md. (b) Author a lighter "finding-list + status" document without proposed slices. Rejected — the operator directive is "every finding gets explicit disposition," which requires the plan to carry proposed dispositions, not just a finding list.
**Trajectory check:** Arc goal — structure the 40-finding response into a sequenced arc with zero unaddressed findings. Phase goal — Phase 2 continues; this arc intervenes between the project-holistic review recording (Slice 49) and the next capability work. Prior-slice terrain — Slice 49 filed the review records; Slice 48 resolved Claude HIGH 3 (checkFraming); Slice 47d closed the prior hardening arc. No earlier slice made this plan smaller or obsolete.

**Scope:**
1. Author this plan file at `specs/plans/project-holistic-foldins.md`.
2. Update `PROJECT_STATE.md` with Slice 50 entry naming the plan file as authority for the arc.
3. Commit as Slice 50 (Lane: Discovery; no Codex challenger required — no ratchet advance, no governance-surface amendment; the plan commits a plan file only).

**Ratchet:** No floor advance. No audit-coverage addition. Test count unchanged.

**Codex challenger:** NOT REQUIRED (CLAUDE.md §Hard invariants #6 literal scope — plan authoring does not advance a ratchet floor, amend a contract, land a migration escrow, promote a discovery decision, or loosen a gate. The plan will be reviewed for ordering adjustment by the operator at Slice 51, not by a cross-model challenger).

### Slice 51 — Operator review + ratification

**Lane:** Discovery (operator decision slice; may or may not involve plan-file edits)
**Failure mode addressed:** The Slice 50 plan authored by Claude reflects Claude's ordering preference (plugin-CLI first). Operator may have a different preference based on risk appetite, schedule constraints, or disagreement with a specific slice's scope. Without an explicit ratification slot, the plan becomes de-facto ratified by silent acceptance, which is a subtle form of Nguyen-anchoring.
**Acceptance evidence:** EITHER (a) PROJECT_STATE.md Slice 51 entry records "plan ratified without edits; operator accepted plugin-first ordering" AND plan frontmatter `status` stays `in-progress`; OR (b) operator edits the plan (ordering changes, slice scope adjustments, finding disposition revisions) AND Slice 51 commits the edits with a PROJECT_STATE entry recording the changes.
**Alternate framing:** (a) Skip the ratification slot; execution opens at Slice 51 with plan-as-authored. Rejected — the operator explicitly asked to review the plan before execution. (b) Land ratification as a frontmatter-only edit (set `ratified_at` field) without a PROJECT_STATE entry. Rejected — the ratification is a decision the operator owns; PROJECT_STATE is the durable record of owner-level decisions.
**Trajectory check:** Arc goal — operator aligns on execution ordering before privileged runtime slices open. Phase goal — same as Slice 50's phase goal (Phase 2 continues; this arc is fold-ins). Prior-slice terrain — Slice 50 authored the plan; this slice is its ratification gate. No earlier slice made this obsolete.

**Scope:**
1. Operator reads the plan (this file) and the two prong review records.
2. Operator either ratifies as-is (PROJECT_STATE entry only) or edits the plan (PROJECT_STATE entry + plan-file edits).
3. Commit as Slice 51.

**Ratchet:** No advance either way.

**Codex challenger:** NOT REQUIRED (plan ratification is an operator decision slice; not a ratchet advance or governance amendment).

### Slice 52 — Plugin-CLI wiring (Claude Q5 HIGH 4 / Codex Q4 MED 12)

**Lane:** Ratchet-Advance (capability: plugin `/circuit:explore` reaches the functional pipeline; closes the plugin-surface-vs-runtime seam)
**Failure mode addressed:** `.claude-plugin/commands/circuit-run.md:8-18` and `.claude-plugin/commands/circuit-explore.md:8-17` return "Not implemented yet." A plugin user invoking `/circuit:explore` in Claude Code gets placeholder text. The functional pipeline lives at `src/cli/dogfood.ts::main` and is reachable only via `npm run circuit:run` — an npm-script invocation that requires cloning the repo. The plugin-advertised surface (two slash commands) does not connect to the runtime that actually works. CC#P2-3 (plugin command registration) is "active — red" under honest accounting.
**Acceptance evidence:** `/circuit:explore <goal>` invoked in a Claude Code session routes through the explore pipeline and produces the canonical run artifacts (`runs/<id>/events.jsonl`, `artifacts/explore-result.json`). A new `specs/reviews/p2-11-invoke-evidence.md` records the invocation + artifacts fingerprint. Test coverage: `tests/runner/plugin-command-invocation.test.ts` asserts the command file body references the runtime binding (not placeholder text). Audit: Check 23 (`checkPluginCommandClosure`) extended to reject "Not implemented yet" placeholder strings when CC#P2-3 is marked active-satisfied.
**Alternate framing:** (a) Wire via a Claude Code Skill (structured markdown with SKILL frontmatter, invoking the CLI via Bash tool). Preferred because it composes with Claude Code's existing skill surface. (b) Wire via a hook that intercepts `/circuit:explore` and dispatches the CLI. Rejected — hooks are for automated behaviors; slash commands should deliver their functionality directly. (c) Rewrite `src/cli/dogfood.ts` as a TypeScript-compiled bin that the command file invokes. Rejected — adds build infrastructure (`tsc --emit`, binary distribution) that doesn't fit Tier 0.
**Trajectory check:** Arc goal — close the review's single largest capability-visible gap before audit/governance fold-ins land. Phase goal — CC#P2-3 moves from "active — red" to "active — satisfied" at honest-parity (not placeholder); Phase 2 close path gains one resolved criterion. Prior-slice terrain — Slice 42 landed the real agent adapter; Slice 45 landed the codex adapter; Slice 43c closed the explore-e2e fixture. This slice consumes that infrastructure at the plugin layer. No earlier slice made this smaller or obsolete.

**Scope:**
1. Author `.claude-plugin/skills/explore-run/SKILL.md` (or equivalent path per plugin manifest conventions) that invokes the dogfood CLI with the goal parameter extracted from the slash command argument.
2. Rewrite `.claude-plugin/commands/circuit-explore.md` to reference the skill + invoke the runtime rather than "Not implemented yet."
3. Rewrite `.claude-plugin/commands/circuit-run.md` to either (a) route to `/circuit:explore` for now (single-workflow phase) or (b) carry a deliberate "Router not yet implemented; see P2.8" with a link to the explore command as the functional scaffold.
4. Add `tests/runner/plugin-command-invocation.test.ts` asserting command-body binding + skill presence.
5. Extend Check 23 to reject placeholder strings on active-satisfied CC#P2-3.
6. Author `specs/reviews/p2-11-invoke-evidence.md` with live invocation transcript.

**Ratchet:** Contract-test count advances (+N from new tests). Audit-coverage advances (Check 23 tightening).

**Codex challenger:** REQUIRED (privileged runtime change — plugin command binding — plus ratchet advance under literal rule). Dispatch via `/codex` skill.

### Slice 53 — Runtime correctness: dispatchVerdictForStep adapter-output binding (Codex Q5 HIGH 14)

**Lane:** Ratchet-Advance (privileged runtime change — the gate evaluation now consults adapter output)
**Failure mode addressed:** `src/runtime/runner.ts:146-157` `dispatchVerdictForStep` returns `step.gate.pass[0]` — the first allowed verdict — without reading adapter output. `runner.ts:451-500` passes that verdict into `materializeDispatch` and emits `gate.evaluated` with `outcome: 'pass'` unconditionally. The dogfood stub at `tests/runner/dogfood-smoke.test.ts:60-64` returns arbitrary `result_body` bytes; the runner does not parse them before passing the gate. Model output can be malformed, rejecting, or unrelated — the workflow advances anyway. This is the exact "gates pass by construction" failure mode the explore contract's gate schema is supposed to prevent.
**Acceptance evidence:** `dispatchVerdictForStep` parses the adapter output (against `step.gate.schema` if declared, or against a minimal `{verdict: string}` shape) and returns the verdict declared by adapter output IF it appears in `step.gate.pass`. If adapter output is unparseable OR declares a verdict not in `step.gate.pass`, the runner emits `gate.evaluated` with `outcome: 'reject'` + the reason, and the step does not advance. New tests: `tests/runner/gate-evaluation.test.ts` covers (a) happy-path pass verdict from adapter output, (b) reject verdict from adapter output, (c) unparseable adapter output → reject, (d) adapter-declared verdict not in `gate.pass` → reject.
**Alternate framing:** (a) Schema-parse adapter output at the materializer layer, not the runner layer. Rejected — the materializer writes the artifact; the runner decides the gate. Conflating them would couple the verdict decision to artifact shape. (b) Treat the first `gate.pass` verdict as the default fallback when adapter output is empty. Rejected — that re-introduces the silent-pass path; adapter output is the canonical source, not a suggestion.
**Trajectory check:** Arc goal — the runtime consulted by plugin-wired commands (Slice 52) produces honest gate decisions. Phase goal — Phase 2's workflow-execution correctness surface (CC#P2-1 at orchestrator-parity P2.10) gains a prerequisite. Prior-slice terrain — Slice 43b introduced the runDogfood async seam; Slice 43c closed the explore e2e fixture against the placeholder artifact; this slice closes the gate-evaluation gap that the placeholder masked.

**Scope:**
1. Amend `src/runtime/runner.ts::dispatchVerdictForStep` signature + implementation to accept `adapterResult: DispatchResult` and parse for verdict.
2. Update `runner.ts:451-500` caller site.
3. Schema — add `GateAdapterOutputSchema` (if not already present) to `src/schemas/gate.ts` or appropriate module.
4. New test file `tests/runner/gate-evaluation.test.ts` with the four cases above.
5. Update explore contract at `specs/contracts/explore.md` if the gate-evaluation semantics prose needs the explicit "verdict comes from adapter output" statement.
6. Update dogfood stub fixture at `tests/runner/dogfood-smoke.test.ts` to emit a schema-valid verdict payload.

**Ratchet:** Contract-test count advances. Audit-coverage may advance (depending on whether a new check lands for gate-evaluation binding).

**Codex challenger:** REQUIRED (privileged runtime — runner + gate evaluation; ratchet advance under literal rule).

### Slice 54 — Runtime correctness: dispatch-materializer schema parsing (Codex Q5 HIGH 15)

**Lane:** Ratchet-Advance (privileged runtime — materializer now schema-parses per contract MUST)
**Failure mode addressed:** `specs/contracts/explore.md:551-558` states: "The runtime MUST write `writes.artifact.path` by schema-parsing the result payload against `writes.artifact.schema`." `src/runtime/adapters/dispatch-materializer.ts:94-102` admits v0 writes raw `result_body` bytes with "no schema parsing," and `dispatch-materializer.ts:139-145` writes the raw result to both transcript and artifact paths. Downstream steps that read the artifact see unvalidated bytes. This is the exact failure ADR-0008 named as the dispatch-result-to-artifact gap.
**Acceptance evidence:** `materializeDispatch` schema-parses adapter output against `writes.artifact.schema` before writing; parse failure emits a `dispatch.failed` event and does not write to the artifact path; parse success writes the parsed canonical form. New tests: `tests/runner/materializer-schema-parse.test.ts` covers (a) valid payload round-trip, (b) invalid payload → no artifact write + failure event, (c) schema-missing fallback behavior (explicit error vs. permissive write — operator decision at implementation time).
**Alternate framing:** (a) Schema-parse at the runner level before calling materializeDispatch. Rejected — that duplicates schema logic; the materializer is the right layer. (b) Introduce a separate `validateDispatch` helper that the materializer consumes. Preferred over (a). Implementation detail; not a framing alternate.
**Trajectory check:** Arc goal — downstream artifact consumers see validated bytes. Phase goal — CC#P2-1 at orchestrator-parity (P2.10) gains a prerequisite: real artifact composition requires real artifact validation. Prior-slice terrain — Slice 45a introduced DispatchFn structured descriptor + 47a landed real selection provenance on `dispatch.started`; this slice closes the symmetric artifact-write correctness gap.

**Scope:**
1. Amend `src/runtime/adapters/dispatch-materializer.ts` to schema-parse result_body against `writes.artifact.schema`.
2. Update the five-event transcript to include validation status.
3. New test file `tests/runner/materializer-schema-parse.test.ts`.
4. Amend `specs/contracts/explore.md` if the MUST wording needs a complementary "schema absent → fail closed" clarification.
5. Verify CC#P2-1 placeholder flow still completes under new validation (placeholder body is schema-valid by construction per Slice 44 amendment).

**Ratchet:** Contract-test count advances. Audit-coverage may advance.

**Codex challenger:** REQUIRED.

### Slice 55 — CLI entrypoint tsx IPC EPERM (Codex Q4 HIGH 11)

**Lane:** Ratchet-Advance (closes product-demo-path failure in constrained environments; exposes live CLI as audit concern)
**Failure mode addressed:** `package.json:20` binds `circuit:run` to `tsx src/cli/dogfood.ts`. Running `npm run circuit:run -- --help` fails with `Error: listen EPERM ... /T/tsx-501/...pipe` in sandboxed agent environments. This is the same tsx IPC failure class described in `tests/runner/dogfood-smoke.test.ts:254-268` as the reason tests moved to direct `main()` import. The test workaround didn't fix the product entrypoint. The smallest user-facing demo can fail before it reaches circuit-next code.
**Acceptance evidence:** `npm run circuit:run -- --help` succeeds in the same environment class that fails today (sandbox/constrained /tmp). Options: (a) swap tsx for a direct node invocation using the pre-compiled output (if Tier 0 can accept a minimal build step), (b) use `node --import tsx/esm src/cli/dogfood.ts` or equivalent loader pattern that doesn't create an IPC pipe, (c) document the constraint + route plugin invocation through a skill that bypasses tsx. Slice-opening alt-framing consideration picks one.
**Alternate framing:** (a) Accept tsx IPC as an environment limit; document it in README. Rejected under operator directive "every finding gets disposition" — this is a product entrypoint, not a test helper. (b) Build step + compiled CLI. Possible but adds Tier 0 scope. (c) Loader pattern (`node --loader`). Narrower surface; try first.
**Trajectory check:** Arc goal — the product entrypoint runs where the plugin does. Phase goal — CC#P2-3 plugin wiring (Slice 52) is only load-bearing if the CLI it routes to is runnable. Prior-slice terrain — Slice 47d env-gated `tests/runner/dogfood-smoke.test.ts:248` CLI entrypoint test under `CLI_SMOKE=1` to keep default verify green in sandboxed environments; that closed the test-path problem but left the product-path problem open. This slice closes the product-path problem.

**Scope:**
1. Reproduce the EPERM in a sandbox environment.
2. Pick a path per alternate framing; implement.
3. New test or integration check: `tests/runner/cli-entrypoint.test.ts` exercises `npm run circuit:run -- --help` without env-gating, or the operative equivalent under the chosen loader.
4. Update any docs that reference `tsx` as the invocation mechanism.

**Ratchet:** Contract-test count advances. Audit-coverage may advance (Check X binding CLI entrypoint health).

**Codex challenger:** REQUIRED.

### Slice 56 — Session hooks no-op on missing engine (Codex Q8 HIGH 22)

**Lane:** Ratchet-Advance (closes CC#P2-4 clean-clone gap surfaced at Slice 47d ledger row 5)
**Failure mode addressed:** `.claude/hooks/SessionStart.sh:20-26,41-44` and `.claude/hooks/SessionEnd.sh:24-31,46-49` exit silently (`exit 0`) if `.circuit/bin/circuit-engine` is absent. `git ls-files .circuit/bin/circuit-engine` returns empty — the engine shim is untracked. A clean clone has the hook scripts but no live hook behavior. CC#P2-4 is "active — satisfied" on paper while operator-visible continuity behavior silently no-ops. The Slice 47d close-state ledger (ADR-0007 CC#P2-4 row 5) acknowledged this as "tracked hook scripts + portable stub coverage (default verify path)" vs "live clean-clone engine available" — the acknowledgment is honest, but the distinction means CC#P2-4 at clean clones is `unknown`, not `satisfied`.
**Acceptance evidence:** A clean clone runs the hooks non-trivially. Options: (a) track a minimal `circuit-engine` binary stub in the repo (or require the plugin install to populate it automatically). (b) Hooks detect missing engine and emit a visible one-time warning instead of silent exit. (c) Lifecycle test asserts that a clean clone produces a visible hook response (via an `init` step that bootstraps the engine stub).
**Alternate framing:** (a) Distribute engine as a compiled binary with the plugin. Preferred if Tier 0 supports it. (b) Keep the engine as a plugin-install-time bootstrap step. Requires plugin lifecycle hook. (c) Commit a portable shim that works without install (simplest — uses node + installed package). Try (c) first.
**Trajectory check:** Arc goal — continuity-resume behavior (the single most operator-facing plugin feature besides slash commands) works on clean clones. Phase goal — CC#P2-4 moves from "satisfied on paper + unknown on clean clones" to "satisfied under standard-use" per ADR-0007 CC#P2-4 close-state semantics. Prior-slice terrain — Slice 46 landed hook scripts; Slice 47b added behavioral + lifecycle tests through a persisting stub engine; Slice 47b-retro added the hook/engine contract pin + env-gated live drift check; Slice 47d ledger row 5 named the clean-clone gap. This slice closes it.

**Scope:**
1. Pick the engine-availability path.
2. If tracked stub: add to repo + update .gitignore. If plugin-install bootstrap: author the install hook. If portable shim: author the shim.
3. Update `tests/runner/hook-engine-contract.test.ts` to exercise the clean-clone path without `CIRCUIT_HOOK_ENGINE_LIVE=1` env-gate (if the chosen path makes live behavior portable).
4. Update ADR-0007 CC#P2-4 close-state ledger with a new row recording the clean-clone gap closure.
5. If a new audit check lands (Check X binding engine availability), wire it.

**Ratchet:** Contract-test count advances. Audit-coverage may advance. Governance-surface movement: yes (CC#P2-4 ledger row added).

**Codex challenger:** REQUIRED.

### Slice 57 — CC#P2-1 placeholder-parity honesty + PROJECT_STATE trajectory summary (Claude Q8 LOW 3 + Codex Q2 HIGH 6 + Claude Q2 HIGH 2 + Codex Q4 MED 13 + Codex Q1 MED 2)

**Lane:** Equivalence Refactor (wording/honesty correction) + Ratchet-Advance (new audit check binding if it lands)
**Failure mode addressed:** Four convergent threads. (a) `PROJECT_STATE.md:21` and the after-slice summary carry `CC#P2-1 active — satisfied` wording; ADR-0007 amends it to "placeholder-parity" but the summary text does not disclose the placeholder qualifier. (b) `PROJECT_STATE.md:15` + `ADR-0007` reference "middle third of Phase 2" framing; per-criterion count is 4 satisfied / 3 red / 1 re-deferred — exactly half done, not middle third, and the "satisfied" count rounds up over placeholder-parity at CC#P2-1. (c) Codex M13 trajectory: recent 30-commit log is dominated by hardening/governance; feature queue remains ahead; "no further cleanup pending" is a true statement about closure but misleads as "close to shipping." (d) Codex M2 Product Reality Gate: D1 from methodology requires product proof (user-facing command or e2e fixture), but CC#P2-1 satisfies at placeholder-parity — Product Reality Gate is not blocking placeholder evidence at close.
**Acceptance evidence:** PROJECT_STATE.md updated with (1) explicit per-criterion status table (8 rows, one per CC#P2-N, each with live status); (2) CC#P2-1 row carries "satisfied at placeholder-parity only; orchestrator-parity deferred to P2.10" qualifier; (3) "middle third" framing replaced with honest cardinal (or dropped); (4) recent trajectory summary discloses the ratio tilt. ADR-0007 amendment (if needed) tightens Product Reality Gate semantics. New audit check (optional): `checkPlaceholderParityDisclosure` rejects PROJECT_STATE after-slice summaries that write `CC#P2-1 satisfied` without the placeholder qualifier when the ADR-0007 amendment is active.
**Alternate framing:** (a) Leave PROJECT_STATE wording and rely on ADR-0007 as the authority. Rejected — the after-slice plain-English summary is the operator-facing surface the CLAUDE.md §After-slice operator summary directive owns; mismatch between summary and ADR is exactly the drift this arc is supposed to close. (b) Scrub the "middle third" language everywhere and replace with a per-criterion list. Preferred. (c) Keep "middle third" but require a per-criterion table as a sibling field. Possible compromise.
**Trajectory check:** Arc goal — PROJECT_STATE reflects the per-criterion reality the ADR amendment disclosed. Phase goal — CC#P2-1 wording is consistent across all operator-facing surfaces. Prior-slice terrain — Slice 44 authored the ADR-0007 placeholder-parity amendment; Slice 47d advanced the per-criterion close-status discipline; this slice extends that discipline to the after-slice summary layer.

**Scope:**
1. Edit `PROJECT_STATE.md` — replace "middle third" framing in the current Slice entry; add per-criterion status table; disclose CC#P2-1 placeholder-parity qualifier on every future summary by convention (noted in CLAUDE.md §After-slice operator summary if not already).
2. Amend `ADR-0007` if Product Reality Gate semantics need tightening (e.g., "placeholder-parity epochs MUST be explicitly disclosed in operator-facing summaries").
3. Optionally author `checkPlaceholderParityDisclosure` audit check + test.
4. Update `README.md` + `TIER.md` if they reference "middle third" or summary text that now needs qualifiers.

**Ratchet:** Governance-surface movement (PROJECT_STATE convention + possibly ADR amendment + possibly new audit check). Contract-test count advances if audit check lands.

**Codex challenger:** REQUIRED.

### Slice 58 — Ratchet split: runtime_invariant vs audit_machinery test counts (Claude Q3 MED 5 + Claude Q7 MED 10 + Codex Q3 MED 10 + Codex Q7 MED 20 + Claude Q7 LOW 2 + Claude Q3 MED 6)

**Lane:** Ratchet-Advance + Governance-surface (floor structure change)
**Failure mode addressed:** Converges five findings. (a) `specs/ratchet-floor.json` has one `contract_test_count` pool; `countTests` matches `/^\s*(it|test)\(/` across all tracked `tests/**/*.test.*`. Roughly 50-60% of the 1062-count is audit-machinery meta-testing (tests of `scripts/audit.mjs` checks); the rest is runtime-invariant testing. Advancing the pool by adding 40 audit-machinery tests is indistinguishable from advancing it by adding 40 runtime-invariant tests. (b) Several ratchet-counted tests assert naming / export facts rather than behavior (`tests/runner/agent-dispatch-roundtrip.test.ts:58-72` asserts literal-string match on `/^dispatch\./`; `codex-dispatch-roundtrip.test.ts:92-107` same). (c) Grandfather-list tautology tests: `slice-47d-audit-extensions.test.ts:91-94` asserts a string constant equals a literal. (d) `ratchet-floor.json` notes field is 12KB of prose changelog, overwhelming the machine-readable ratchet declaration.
**Acceptance evidence:** `specs/ratchet-floor.json` carries two floors: `runtime_invariant_test_count` + `audit_machinery_test_count`, each with independent advancement per CLAUDE.md §Hard invariants #8. `countTests` classifier function distinguishes runtime-invariant test files (schema-parity, primitives, workflow-kind-policy, adapter-binding, slice-NN-<runtime-surface>) from audit-machinery test files (slice-NN-audit-*, slice-47c-forbidden-*, slice-47d-audit-*, status-epoch-ratchet-floor, etc.). `specs/ratchet-floor-history.md` holds the prose changelog; `ratchet-floor.json` minimal (floors + last_advanced metadata). Existing tests classified via PR listing. New audit check `checkRatchetSplitClassification` rejects test files that don't carry the classification marker.
**Alternate framing:** (a) Three pools: runtime + audit + meta (where meta covers tautology tripwires that don't test behavior or audit logic). Rejected as over-engineered for current scale. (b) Two pools + a "meta" tag on individual tests that the runtime pool excludes. Too fine-grained; classification at file level is adequate for the drift the finding names. (c) Keep single pool but add a "coverage map" report. Rejected — report doesn't enforce; the finding is about ratchet enforcement.
**Trajectory check:** Arc goal — the ratchet protects what it claims to protect (runtime invariant coverage) without laundering it through audit machinery counts. Phase goal — Phase 2 close-criterion CC#P2-8 matrix gains a more honest input signal. Prior-slice terrain — Slice 47d advanced the static `countTests` 988 → 1062; Slice 47c added explicit forbidden-phrase guards; this slice refactors the ratchet shape without reducing coverage.

**Scope:**
1. Define classifier in `scripts/audit.mjs`: `classifyTestFile(path) → 'runtime_invariant' | 'audit_machinery'`. Enumeration list grows with test files.
2. Amend `specs/ratchet-floor.json` with both floors; seed with current counts per classification.
3. Move the 12KB notes blob to `specs/ratchet-floor-history.md`; leave a pointer in `ratchet-floor.json`.
4. Amend `scripts/audit.mjs` ratchet pinning to check both floors.
5. Classify each existing test file; commit the classification mapping.
6. New audit check `checkRatchetSplitClassification` rejecting unclassified test files.
7. Contract test: `tests/contracts/ratchet-split.test.ts` asserts the classifier + floor mapping is consistent.

**Ratchet:** Contract-test count advances (both floors from prior baseline + new tests). Governance-surface movement: yes.

**Codex challenger:** REQUIRED.

### Slice 59 — Check 35 self-declaration gap hardening (Codex Q3 HIGH 7)

**Lane:** Ratchet-Advance (audit-coverage tightening)
**Failure mode addressed:** `scripts/audit.mjs:3994-4009` Check 35 scans HEAD commit body for exact `Codex challenger: REQUIRED`. If the body does not declare it, the check returns "not applicable" at line 4064-4070. A ratchet-advancing commit that forgets or avoids the declaration stays green. The failure mode shifted from "no Codex pass exists" to "the commit forgot or avoids the declaration" — enforcement is self-attested.
**Acceptance evidence:** Check 35 detects ratchet advance independently (by delta against prior floor) and requires a Codex pass when delta > 0 regardless of commit body declaration. The "declare Codex required" path remains as a redundant signal for operator-facing clarity. New tests: `tests/contracts/check-35-self-declaration-hardening.test.ts` covers (a) commit advances ratchet without declaration → RED, (b) commit advances ratchet with declaration + review file → GREEN, (c) commit advances ratchet with arc-subsumption path → GREEN, (d) commit does not advance ratchet → not applicable (unchanged).
**Alternate framing:** (a) Keep Check 35 as self-attested + add a separate Check that enforces ratchet-advance → Codex. Rejected — doubles the surface; better to tighten Check 35. (b) Retire the self-declaration convention entirely and rely only on delta detection. Rejected — the declaration is operator-facing clarity, not just mechanical enforcement.
**Trajectory check:** Arc goal — Check 35 enforces the literal rule ratified at Slice 47c-2 without silent bypass. Phase goal — governance surface has honest enforcement at the audit layer. Prior-slice terrain — Slice 47c-2 ratified the literal rule; Slice 47d added Check 35 with grandfather list; this slice closes the self-declaration-optional gap the Codex review surfaced.

**Scope:**
1. Amend `scripts/audit.mjs` Check 35 (`checkCodexChallengerRequiredDeclaration`) to detect ratchet advance via delta.
2. Add ratchet-delta detection helper (compares current counts to `ratchet-floor.json` and detects advance).
3. New test file `tests/contracts/check-35-self-declaration-hardening.test.ts`.
4. Update the behavioral spec `specs/behavioral/cross-model-challenger.md` if the enforcement surface changes.

**Ratchet:** Audit-coverage advances. Contract-test count advances.

**Codex challenger:** REQUIRED.

### Slice 60 — Arc-subsumption path validation + Check 34 scan scope (Codex Q3 MED 8 + Codex Q3 MED 9)

**Lane:** Ratchet-Advance (audit-coverage tightening on two checks)
**Failure mode addressed:** Two audit-escape-hatch concerns. (a) `scripts/audit.mjs:4799-4804` (Check 2 arc-close exemption) and `scripts/audit.mjs:4073-4082` (Check 35 arc-subsumption) both accept an `arc-subsumption: <path>` field if the file exists. Neither verifies the referenced file is a review, has matching arc scope, or carries ACCEPT* closing verdict. A weak or wrong file satisfies the escape hatch unless another check happens to cover the same arc. (b) Check 34 (`checkForbiddenScalarProgressPhrases`) scans a curated file list at `scripts/audit.mjs:3864-3877` plus a glob that matches only `arc-slice.*composition-review` at `scripts/audit.mjs:3879-3891`. PROJECT_STATE is intentionally truncated before the first historical marker at line 3911-3916. Untracked files are excluded at line 3923-3928. Forbidden scalar-progress language can reappear in per-slice reviews, non-matching review names, or historical-looking current context — green audit, present forbidden phrase.
**Acceptance evidence:** Arc-subsumption validation: referenced file must (1) match an expected review prefix (`arc-slice-` or `phase-`); (2) carry YAML frontmatter with `closing_verdict` ∈ {ACCEPT, ACCEPT-WITH-FOLD-INS}; (3) match the arc scope of the current slice per slice-id comparison. Check 34 scan scope: glob extended beyond `arc-slice.*composition-review` to cover per-slice challenger records (`arc-slice-*-codex.md`) and phase review records (`phase-*.md`). PROJECT_STATE truncation boundary re-examined; if the historical marker is itself inside the pre-truncation region, the current context surface stays fully scanned. New test file `tests/contracts/arc-subsumption-validation.test.ts` with cases for each validation criterion.
**Alternate framing:** (a) Strip the arc-subsumption escape hatch entirely; every commit carries framing triplet. Rejected — the hatch exists because arc-close ceremony commits legitimately delegate framing evidence to prong files per CLAUDE.md §Cross-slice composition review cadence. (b) Require arc-subsumption to name a file created in the same commit. Possible but restrictive — a future arc-close commit referencing a review from an earlier commit is a legitimate case.
**Trajectory check:** Arc goal — the two escape hatches enforce real semantics, not just path existence. Phase goal — governance surface hardening continues to match the literal-rule ratification at Slice 47c-2. Prior-slice terrain — Slice 48 introduced the arc-close ceremony exemption + reused Slice 47d's `ARC_SUBSUMPTION_FIELD_PATTERN`; this slice tightens both usages.

**Scope:**
1. Amend `scripts/audit.mjs` Check 2 arc-close exemption validator.
2. Amend `scripts/audit.mjs` Check 35 arc-subsumption validator.
3. Extract shared `validateArcSubsumptionPath` helper for use in both.
4. Amend Check 34 scan scope (extended glob + truncation boundary review).
5. New test file `tests/contracts/arc-subsumption-validation.test.ts`.
6. Update test fixtures if needed to cover the tightened validators.

**Ratchet:** Audit-coverage advances. Contract-test count advances.

**Codex challenger:** REQUIRED.

### Slice 61 — Default verify live-smoke separation (Codex Q7 HIGH 19)

**Lane:** Ratchet-Advance (audit-coverage tightening + operator-facing documentation)
**Failure mode addressed:** `tests/runner/agent-dispatch-roundtrip.test.ts:46-51` gates real `claude` subprocess behind `AGENT_SMOKE=1`. `tests/runner/codex-dispatch-roundtrip.test.ts:34-39` gates real `codex` subprocess behind `CODEX_SMOKE=1`. `tests/runner/dogfood-smoke.test.ts:248-283` gates CLI entrypoint behind `CLI_SMOKE=1`. Default `npm run audit` reports verify green + smoke fingerprints green. The fingerprints are historical evidence (commit-ancestor SHA-binding), not current executable coverage. Default verify can pass while the live adapters or CLI entrypoint are broken in the current environment.
**Acceptance evidence:** Separate reporting for (1) "default verify (schema + type + static-asserted tests) passed" and (2) "live smoke (subprocess execution of agents/CLI) passed — latest run SHA + date". When (2) is older than a threshold (e.g., older than the current ratchet-floor last-advance commit) the audit emits a yellow disclosing the age. Operator-facing README + TIER update clarifies what "verify green" claims vs what "smoke green" claims. Optional: a new audit check `checkSmokeFingerprintFreshness` binds the age threshold.
**Alternate framing:** (a) Require `AGENT_SMOKE=1` + `CODEX_SMOKE=1` + `CLI_SMOKE=1` in the default verify path. Rejected — that forces operator-local live CLI + breaks sandboxed agent environments (the reason Slice 47d added the env-gate in the first place). (b) Rewrite the fingerprint machinery to carry executable-at-date metadata. Preferred — makes the "stale by design" yellows explicit. (c) Remove the fingerprint machinery entirely. Rejected — the fingerprints are the only mechanism that detects adapter-source drift against a known-good live run.
**Trajectory check:** Arc goal — operator reads "verify green" and knows exactly what that asserts. Phase goal — CC#P2-2 (real agent dispatch) + CC#P2-3 (plugin command registration) evidence surface is correctly scoped. Prior-slice terrain — Slice 47d env-gated the CLI entrypoint + added the AGENT_SMOKE / CODEX_SMOKE yellows as "stale by design"; this slice extends the honest-disclosure discipline.

**Scope:**
1. Amend `scripts/audit.mjs` to separate default-verify summary from live-smoke-fingerprint summary in output.
2. Add age-threshold yellow-emission logic for stale fingerprints.
3. Update `README.md` + `TIER.md` with the "what verify green asserts" clarification.
4. If new audit check lands: `tests/contracts/smoke-fingerprint-freshness.test.ts`.

**Ratchet:** Audit-coverage may advance. Contract-test count advances if new check lands.

**Codex challenger:** REQUIRED.

### Slice 62 — Doc/manifest staleness catch-all (Codex Q2 MED 3 + Codex Q2 MED 4 + Codex Q2 LOW 5)

**Lane:** Equivalence Refactor (stale prose → current prose; no semantic change in code)
**Failure mode addressed:** Three frontmatter / doc staleness concerns. (a) `TIER.md:28-32` marks `runner_smoke`, `workflow_fixture_runs`, `event_log_round_trip`, `snapshot_derived_from_log`, `manifest_snapshot_byte_match` as `planned` for slices `27d` / `27c`. Those slices are long past; markers are stale. Claim matrix can pass audit because `planned_slice` is non-empty while the plan date is stale. (b) `specs/plans/phase-2-foundation-foldins.md:13` says `status: active` though its arc is closed by Check 26. `specs/plans/slice-47-hardening-foldins.md:3` says `status: in-progress` though PROJECT_STATE says no further cleanup is pending. Stale plan frontmatter misroutes fresh agents. (c) `.claude-plugin/commands/circuit-explore.md:23-25` describes P2.4 as real-agent adapter "in-process Anthropic subagent"; ADR-0009 chose subprocess-per-adapter and `agent.ts:114-141` uses `spawn('claude', ...)`. Note: (c) may be superseded by Slice 52 (plugin wiring) which rewrites the command body.
**Acceptance evidence:** `TIER.md` planned markers updated to current status. `phase-2-foundation-foldins.md` status → `closed`. `slice-47-hardening-foldins.md` status → `closed`. `.claude-plugin/commands/circuit-explore.md` architecture prose updated (if Slice 52 has not already superseded it). New audit check `checkPlanStatusCurrency` scans `specs/plans/*.md` frontmatter and rejects status fields that disagree with arc-close ledger state.
**Alternate framing:** (a) Add a one-time frontmatter scrub slice without the audit check. Rejected — the drift will recur; mechanical enforcement is cheap. (b) Include this in the next arc's close. Rejected — already deferred long enough; the operator directive is to close these findings in this arc.
**Trajectory check:** Arc goal — docs + plan frontmatter reflect current state. Phase goal — fresh-agent routing authority surfaces are honest. Prior-slice terrain — Slices 35-40 closed `phase-2-foundation-foldins`; Slice 47d closed `slice-47-hardening-foldins`; this slice updates the frontmatter that should have been updated at those close times.

**Scope:**
1. Edit `TIER.md` stale markers.
2. Edit `phase-2-foundation-foldins.md` + `slice-47-hardening-foldins.md` frontmatter status.
3. Edit `.claude-plugin/commands/circuit-explore.md` (if not superseded by Slice 52).
4. Add `checkPlanStatusCurrency` audit check + test.

**Ratchet:** Audit-coverage advances. Contract-test count advances.

**Codex challenger:** REQUIRED (new audit check under literal rule).

### Slice 63 — ADR-0007 §4c inherited ratchet audit bindings (Claude Q2 MED 4)

**Lane:** Ratchet-Advance (audit-coverage hardening — binds named ratchets to audit checks)
**Failure mode addressed:** `specs/adrs/ADR-0007-phase-2-close-criteria.md:791-802` names 10 inherited product ratchets and states CC#P2-8 close-matrix includes a row per ratchet. 5 of 10 have no named audit check binding: `runner_smoke_present`, `workflow_fixture_runs`, `event_log_round_trip`, `snapshot_derived_from_log`, `manifest_snapshot_byte_match`. Each is implicit in existing runner/contract tests but not named by any audit check. When CC#P2-8 author starts `checkPhase2CloseMatrix`, the work expands to "first land 5 missing checks, then aggregate."
**Acceptance evidence:** Each of the 5 ratchets has a named audit check that asserts its ratchet claim. Options per ratchet: (a) add a dedicated check, (b) name an existing check as the binding (with a comment field), (c) refactor the ADR to drop the distinction where it is redundant with an existing binding. Contract test `tests/contracts/inherited-ratchet-bindings.test.ts` asserts the enumeration is complete (every §4c ratchet has a named binding).
**Alternate framing:** (a) Defer to CC#P2-8 authoring slice. Rejected — that's the exact path the finding warns against (the plan doesn't disclose the prerequisite work). (b) Group the 5 into a single composite check. Possible — if the checks are structurally similar, a single check with per-ratchet sub-cases is cleaner.
**Trajectory check:** Arc goal — CC#P2-8 close-matrix prereq work surfaces before P2.8 opens. Phase goal — Phase 2 close-path clarity. Prior-slice terrain — ADR-0007 §4c was authored at Phase 2 open; the audit check bindings have been deferred; this slice closes that prereq.

**Scope:**
1. For each of the 5 unbound ratchets, author or bind an audit check.
2. Amend `specs/adrs/ADR-0007-phase-2-close-criteria.md` with binding references per ratchet.
3. New test file `tests/contracts/inherited-ratchet-bindings.test.ts`.

**Ratchet:** Audit-coverage advances. Contract-test count advances.

**Codex challenger:** REQUIRED.

### Slice 64 — runDogfood terminal outcome semantics + four explore properties (Codex Q5 MED 16 + Codex Q7 MED 21)

**Lane:** Ratchet-Advance (privileged runtime — runner + explore contract property promotion)
**Failure mode addressed:** Two runtime correctness concerns that surface before P2.9 second workflow. (a) `src/runtime/runner.ts:501-506` throws on checkpoint steps as "not exercised." Routes to `@stop`, `@escalate`, or `@handoff` set a reason but still end with `outcome = 'complete'` at `runner.ts:393` and `runner.ts:525-547`. Schema at `src/schemas/workflow.ts:9` recognizes all terminal targets. Future workflow fixtures can be schema-valid and still misrepresent terminal outcomes. (b) `specs/contracts/explore.md:439-477` marks four semantic properties (`artifact_emission_ordered`, `review_after_synthesis`, `no_skip_to_close`, `reachable_close_only_via_review`) as deferred to P2.5.1 "not yet scheduled." Invariants ledger at `specs/invariants.json:1290-1313` keeps them `phase2-property`. Current tests prove the authored happy path, not that invalid explore graphs are rejected.
**Acceptance evidence:** `runDogfood` preserves terminal outcomes — `@stop` routes end with `outcome='stop'`, `@escalate` ends with `outcome='escalate'`, `@handoff` ends with `outcome='handoff'`. Checkpoint steps execute (per workflow fixture) or are explicitly exempted (with recorded rationale). The four explore properties are promoted from `phase2-property` to active contract invariants. Tests: `tests/runner/terminal-outcome-semantics.test.ts` covers the terminal-route cases; `tests/contracts/explore-semantic-properties.test.ts` covers the four promoted properties.
**Alternate framing:** (a) Defer both to P2.9 open. Rejected — the operator directive is explicit disposition; deferral requires a named trigger and "P2.9 open" is not named on a date. (b) Promote only the two properties most load-bearing (`review_after_synthesis` + `reachable_close_only_via_review`). Possible compromise if the full four promotion overruns 30-min lane.
**Trajectory check:** Arc goal — workflow-execution correctness holds beyond the explore happy path. Phase goal — P2.9 second workflow opens against proven explore generalization, not hypothetical. Prior-slice terrain — Slice 43c closed the explore e2e fixture; Slice 46 landed the session hooks; this slice closes the explore contract-property gap that Codex M21 named.

**Scope:**
1. Amend `src/runtime/runner.ts` terminal-outcome semantics.
2. Add checkpoint step execution (or exempt with recorded rationale).
3. Promote the four explore properties in `specs/contracts/explore.md` + `specs/invariants.json`.
4. New test files: `tests/runner/terminal-outcome-semantics.test.ts` + `tests/contracts/explore-semantic-properties.test.ts`.

**Ratchet:** Contract-test count advances (runtime_invariant pool — see Slice 58).

**Codex challenger:** REQUIRED.

### Slice 65 — Slice-id sub-naming + trajectory-check enforcement + framing regex tightening + ratchet-floor notes refactor (Claude Q4 MED 8 + Claude Q6 META 2 + Claude Q3 HIGH 3 follow-up)

**Lane:** Ratchet-Advance (audit-coverage) + Governance-surface (CLAUDE.md amendment if trajectory check audit-enforces)
**Failure mode addressed:** Four operator-facing governance concerns bundled because each is a narrow surgical edit. (a) `SLICE_ID_PATTERN` at `scripts/audit.mjs:1791` accepts `[0-9]+[a-z]?` — no sub-name support. Slice 47 arc had four `slice-47c:` commits distinguished by parenthetical sub-names (47c-2, 47b-retro, 47c-partial-retro); future arcs face the same problem. (b) CLAUDE.md:90-95 trajectory check is prose-only — no audit enforcement; empirical evidence over ~1 month shows the form is honored but substance varies (retroactive fold-in slices' trajectory checks say "no earlier slice obsoleted" when the 47b-retro situation literally was earlier slices reshaping the terrain). (c) `scripts/audit.mjs:393` widened `checkFraming` regex matches mid-prose mentions; should require label-line phrasing (`/^\s*failure mode[^:\n]*:/im`). (d) Ratchet-floor.json 12KB notes field — while primary handling is in Slice 58 (ratchet split), if Slice 58 does not land the notes-file extraction, it lands here as a separate commit.
**Acceptance evidence:** Options per concern: (a) `SLICE_ID_PATTERN` extended to `[0-9]+[a-z]?(-[0-9]+)?` accepting `47c-2` form, OR PROJECT_STATE entries carry a formal `phase` field. (b) Trajectory check either (b1) audit-enforced (new Check X scanning for three trajectory-check sentences in commit body) or (b2) operator-ratified as prose-only with an explicit "this check is honor-system" disclosure. (c) Framing regex tightened to require line-start anchor. (d) Ratchet-floor notes moved (if not already in Slice 58).
**Alternate framing:** (a) Do (b1) — audit-enforce trajectory check. Adds another gate; risks the exact Goodhart failure Claude HIGH 3 showed. (b2) — accept prose-only + disclosure — is the operator-signal "this is a judgment gate, not a mechanical one." Alternate framing (b2) is named in this plan; operator picks at slice-open time.
**Trajectory check:** Arc goal — operator-facing governance surfaces (slice-id, trajectory, framing regex) enforce what they claim or disclose that they don't. Phase goal — discipline surfaces are honest. Prior-slice terrain — Slice 48 widened the framing regex; this slice tightens it. Slice 47c-2 introduced slice-47c-N sub-naming; this slice formalizes the pattern.

**Scope:**
1. Extend `SLICE_ID_PATTERN` OR add `phase` field; update `compareSliceId` comparator accordingly.
2. Decide (b1) vs (b2) at slice-open; implement.
3. Tighten framing regex to line-start.
4. Ratchet-floor notes move (if not already in Slice 58).

**Ratchet:** Audit-coverage advances (if (b1) and/or (c) land new checks). Contract-test count advances.

**Codex challenger:** REQUIRED.

### Slice 66 — D10 tuning + ledger target_class + correlation rate computation + non-LLM cold-read (Codex Q1 MED 1 + Claude Q1 MED 1 + Codex Q6 META 18 + Codex Q6 MED 17)

**Lane:** Discovery + Governance-surface (D10 + ledger + correlation-rate decision)
**Failure mode addressed:** Four methodology-calibration gaps bundled as a single governance-surface slice. (a) `specs/methodology/decision.md:247-248` says D10 caps are "opinionated priors" to tune after 10-20 reviewed artifacts; ledger has 23 rows without a tuning pass. (b) Claude M1: adversarial-yield-ledger needs a `target_class` column (methodology / audit / runtime / user-surface) so the ratio is legible. (c) Codex META18: `specs/risks.md:12` names correlation rate >= 95% over N >= 20 as reopen signal; not currently computed. (d) Codex M17: ADR-0006 waived non-LLM human cold-read; substitute is still LLM-heavy; skeptical staff engineer would ask why methodology governance exceeds human operator review bandwidth.
**Acceptance evidence:** D10 tuning pass committed as a ledger amendment or D10 supplement (e.g., `specs/methodology/decision-d10-tuning-2026-04-22.md` if a dedicated doc). Ledger carries `target_class` column on all 23 existing rows + new rows going forward. Correlation-rate computation lands as a script (`scripts/correlation-rate.mjs`) + a ledger-attached numeric column + an audit check that emits RED or AR3-reopen when the rate passes 95% over N >= 20. Non-LLM cold-read: either (i) operator commits to a scheduled cold-read instance (by date), (ii) ADR-0006 amendment formally retires the cold-read requirement with rationale, or (iii) named alternative mechanism that substitutes (e.g., a different-LLM-family audit pass at specified milestones).
**Alternate framing:** (a) Split into four slices. Rejected — each is a narrow surgical edit and they share a methodology-calibration surface. (b) Defer the non-LLM cold-read decision. Rejected under operator directive. (c) Compute correlation rate + leave the other three as ACCEPT-AS-OBSERVATION. Possible compromise if 30-min lane can't hold all four.
**Trajectory check:** Arc goal — methodology calibrations the project commits to are observable, not just claimed. Phase goal — AR3 (Knight-Leveson correlation) risk has a working measurement instrument. Prior-slice terrain — Slice 31a ceremony opened Phase 2 at ratified D10 caps; Slice 47c-2 ratified the literal rule under Option A; this slice extends calibration to the instrumentation layer.

**Scope:**
1. D10 tuning pass: review current 23 ledger rows, assess cap adequacy, propose amendment.
2. Amend `specs/reviews/adversarial-yield-ledger.md` format to include `target_class` column; backfill 23 rows.
3. Author `scripts/correlation-rate.mjs` + a `checkCorrelationRate` audit check.
4. Non-LLM cold-read: operator decision at slice-open on path (i/ii/iii).
5. Amend `ADR-0006` if path (ii) or (iii) chosen.

**Ratchet:** Audit-coverage advances. Contract-test count advances (correlation-rate test).

**Codex challenger:** REQUIRED (governance-surface + literal rule).

### Slice 67 — Arc-close composition review (two-prong) + explicit disposition ledger

**Lane:** Equivalence Refactor (arc-close ceremony) + Discovery (composition review)
**Failure mode addressed:** Per CLAUDE.md §Cross-slice composition review cadence, an arc of ≥3 slices touching privileged runtime (52-55) + governance surfaces (57-66) requires arc-close composition review BEFORE the next privileged runtime slice (P2-MODEL-EFFORT / P2.8 router / P2.9 second workflow) opens. Additionally, the operator directive "zero findings unaddressed" requires the arc-close commit to carry an explicit disposition ledger for every finding not separately sliced — so the operator can confirm coverage at close time.
**Acceptance evidence:** `specs/reviews/arc-project-holistic-foldins-composition-review-claude.md` + `specs/reviews/arc-project-holistic-foldins-composition-review-codex.md` committed in the same commit as `current_slice` advance per Check 26. Both prong files carry closing verdict ACCEPT or ACCEPT-WITH-FOLD-INS. Claude prong's body carries the explicit disposition ledger covering:
  - Claude H1 (ratio) — ACCEPT-AS-TRAJECTORY-TARGET. This arc's plugin-first ordering + the four runtime-correctness slices (52-55) are the structural response. Ratio measurement at arc-close: count capability-advancing slices (51/52/53/54/55/63/64) vs methodology-advancing slices (57/58/59/60/61/62/65/66) — target is capability ≥ 50% of execution slices.
  - Claude M2 (ritual REJECT→ACCEPT verdict) — ACCEPT-AS-OBSERVATION. Operator-facing disclosure that no slice has opened with ACCEPT + no challenger-overruled outcome has been recorded; threshold for concern is 30+ passes without variance.
  - Claude M7 (P2-MODEL-EFFORT "next" deferred 6+ slices) — DEFERRED with named trigger: next arc open MUST advance P2-MODEL-EFFORT or P2.8 router or P2.9 second workflow; if not, reopen verdict of this arc-close composition review.
  - Claude M9 (DispatchFn seam retrospective) — ACCEPT-AS-HISTORICAL. Slice 45a fixed; Slice 47d amnesty scope covered. No action.
  - Claude META 1 (disposition convergence) — FOLDED into Slice 66 (correlation-rate computation lands the measurement).
  - Claude META 3 (this review inherits ratio critique) — ACCEPT-AS-OBSERVATION. The arc itself is the capability response.
  - Claude L1 (fresh-read not verified) — ACCEPT-AS-STRUCTURAL-LIMIT. Documented in `specs/behavioral/cross-model-challenger.md` as an acknowledged limit of same-training-distribution auditing.
  - Claude L4 (P2.9 second workflow no contract) — ACCEPT-AS-SCHEDULED. P2.9 opens after this arc close with its own framing slice.
  - Codex M23 (advertised surface larger than runtime) — ACCEPT-AS-TRADEOFF with README wording tightened in Slice 62 (or Slice 51's plugin wiring commit).

**Alternate framing:** (a) Split arc-close into two slices: one for the composition review, one for the disposition ledger. Rejected — same-commit-staging discipline (Check 26) requires prong files + slice marker advance in one commit. Disposition ledger is a body section of the Claude prong, not a separate artifact. (b) Defer non-sliced findings to a future arc. Rejected under operator directive. (c) Upgrade any ACCEPT-AS-OBSERVATION to its own slice. Rejected — inflates arc size; the operator directive is coverage, not separate-slice-per-finding.
**Trajectory check:** Arc goal — all 40 findings have explicit disposition at close. Phase goal — before the next privileged runtime slice (P2-MODEL-EFFORT / P2.8 / P2.9), the project-holistic review's findings are either folded in or explicitly accepted/deferred. Prior-slice terrain — Slices 51-66 executed the fold-ins; this slice closes the arc per CLAUDE.md cadence.

**Scope:**
1. Author Claude composition-adversary prong at `specs/reviews/arc-project-holistic-foldins-composition-review-claude.md`. Body includes explicit disposition ledger per above list.
2. Dispatch Codex cross-model challenger prong via `/codex` skill with the arc scope brief; record at `specs/reviews/arc-project-holistic-foldins-composition-review-codex.md`.
3. Stage prong files + advance `current_slice` to 67 in a single commit per Check 26.
4. Advance ratchet floors (runtime_invariant + audit_machinery) per accumulated test additions across the arc.
5. Update `PROJECT_STATE.md` with arc-close entry.
6. Amend plan frontmatter `status: closed` in this commit.

**Ratchet:** Floor advance for both pools. Governance-surface movement.

**Codex challenger:** Arc-close composition review IS the Codex challenger pass (per Slice 47d precedent).

## Out of arc scope (reserved for follow-up arcs or P2 close-path slices)

These are findings whose disposition is explicit but whose execution lands outside this arc:

| Finding | Prong | Disposition | Authority |
|---------|-------|-------------|-----------|
| P2-MODEL-EFFORT opening | Not a finding per se; Claude M7 binding | Reserved for next arc | Claude M7 trigger |
| P2.8 router opening | Codex M13 trajectory implication | Reserved for next arc | Codex M13 + Claude M7 |
| P2.9 second workflow | Claude L4 + Codex M23 | Reserved for P2.9 framing slice | ADR-0007 §4c |
| P2.10 artifact schemas (CC#P2-1 orchestrator-parity) | Claude L3 + Codex H6 (full closure beyond placeholder-parity disclosure) | Reserved for P2.10 | ADR-0007 §P2.10 |
| CC#P2-8 close matrix | Claude M4 sets prereq bindings | Reserved for P2.8 | ADR-0007 §Decision.1 |

## Arc close criterion

This arc closes when:

1. `npm run audit` is no-red (zero red findings) in the operator's local environment. Accepted yellows at arc close are enumerated explicitly (following Slice 47d precedent) — specifically: any smoke-fingerprint freshness yellows from Slice 61 that are "stale by design until live re-run" are acceptable.
2. All 10 open HIGH findings (Claude H1-H4 minus H3; Codex H6, H7, H11, H14, H15, H19, H22) are folded in or explicitly disposed.
3. All 21 MED findings have explicit disposition (fold-in slice OR accept-by-design-with-rationale OR defer-with-named-trigger).
4. All 5 LOW findings have explicit disposition.
5. All 4 META findings have explicit disposition.
6. Arc-close two-prong composition review lands (Slice 67) with both prongs ACCEPT or ACCEPT-WITH-FOLD-INS.
7. Capability-advancing slice count ≥ methodology-advancing slice count across execution slices (51-66). Counting proposed: capability = {51, 52, 53, 54, 55, 63, 64} = 7 slices; methodology = {57, 58, 59, 60, 61, 62, 65, 66} = 8 slices. Current balance: 7/8 — close to parity; final ratio depends on execution scope decisions at each slice. If methodology count exceeds 10, the arc's response to Claude HIGH 1 is itself evidence of the ratio concern — arc-close verdict should note this explicitly.
8. PROJECT_STATE.md updated with arc-close entry + plan frontmatter `status: closed`.

After arc close, the next session opens P2-MODEL-EFFORT or P2.8 router or P2.9 second workflow per Claude M7 binding — no additional methodology-tightening slices without explicit justification under §Claude M7 trigger.
