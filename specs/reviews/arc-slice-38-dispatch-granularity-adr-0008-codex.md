---
review_target: ADR-0008 / Slice 38 (pre-P2.4 fold-in arc — HIGH 1 fold-in)
target_kind: arc
arc_target: phase-2-foundation-foldins
arc_version: Slice 38
reviewer_model: gpt-5-codex
review_kind: arc-review
review_date: 2026-04-21
authored_by: challenger
verdict: ACCEPT-WITH-FOLD-INS
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
commands_run:
  - sed -n / nl -ba reads over ADR-0008, explore contract, explore fixture, artifacts registry, audit script, audit declarations, adapter-binding tests, schemas, ADR-0007, plan, composition review, run contract, challenger test, PROJECT_STATE, and runtime dispatch surfaces
  - rg searches for DispatchStep, ResultVerdictGate, DispatchConfig.roles, WORKFLOW_KIND_CANONICAL_SETS, EXEMPT_WORKFLOW_IDS, trust_boundary, dispatch_event_pairing, and ADR-0008 precedent wording
  - node --check scripts/audit.mjs (pass)
  - npx vitest run tests/contracts/adapter-binding-coverage.test.ts tests/contracts/cross-model-challenger.test.ts (48 tests pass)
  - npm run check (pass)
  - npm run lint (pass)
  - npm run test (sandbox red: 877/878 tests pass; dogfood CLI smoke fails because tsx cannot open its IPC pipe under this sandbox with listen EPERM)
  - npm run audit (sandbox red through verify gate for the same tsx IPC EPERM; structural checks before verify show 24 green / 2 yellow / adapter-binding green / 1 verify red)
opened_scope:
  - specs/adrs/ADR-0008-dispatch-granularity-modeling.md
  - specs/contracts/explore.md
  - .claude-plugin/skills/explore/circuit.json
  - specs/artifacts.json
  - scripts/audit.mjs
  - scripts/audit.d.mts
  - tests/contracts/adapter-binding-coverage.test.ts
  - src/schemas/step.ts
  - src/schemas/gate.ts
  - src/schemas/adapter.ts
  - src/schemas/config.ts
  - src/schemas/workflow.ts
  - src/schemas/event.ts
  - specs/adrs/ADR-0007-phase-2-close-criteria.md
  - specs/plans/phase-2-foundation-foldins.md
  - specs/reviews/p2-foundation-composition-review.md
  - specs/contracts/run.md
  - tests/contracts/cross-model-challenger.test.ts
  - PROJECT_STATE.md
  - CLAUDE.md
  - .claude-plugin/skills/dogfood-run-0/circuit.json
  - src/runtime/reducer.ts
  - src/runtime/result-writer.ts
  - src/runtime/runner.ts
  - src/cli/dogfood.ts
  - specs/ratchet-floor.json
skipped_scope:
  - src/schemas/* other than step.ts, gate.ts, adapter.ts, config.ts, workflow.ts, and event.ts — not needed for the dispatch-step, adapter-resolution, or fixture-parse claims checked here
  - ~/Code/circuit reference implementation — Slice 38 is a pre-P2.4 modeling/audit/fixture fold-in; no reference artifact parity claim was evaluated in this pass
---

## §Opening verdict.

REJECT-PENDING-FOLD-INS: Slice 38 closes the obvious zero-dispatch hole, but it over-claims distinct-adapter guarantees, leaves dispatch result-to-artifact ownership ambiguous, and does not advance the ratchet floor it says it advances.

## §HIGH objections.

1. **Claim: ADR-0008's central "distinct adapter / Knight-Leveson boundary is a contract guarantee" assertion is false at the current contract layer.**

   **Evidence.** ADR-0008 says option (a) makes distinct-model synthesis/review "fall out of the step schema itself" and that worker dispatch is "by definition" work handed to a different adapter (`specs/adrs/ADR-0008-dispatch-granularity-modeling.md:153-166`). It repeats that Review crosses the boundary because the reviewer-role adapter is selected distinctly from the implementer-role adapter (`specs/adrs/ADR-0008-dispatch-granularity-modeling.md:196-202`). The explore contract and artifact registry carry the same guarantee (`specs/contracts/explore.md:181-194`, `specs/artifacts.json:655`, `specs/artifacts.json:680`).

   The schemas do not enforce that. `DispatchStep` only records `role` plus request/receipt/result paths; it carries no adapter identity and no "different from prior dispatch" field (`src/schemas/step.ts:60-72`). `DispatchConfig.roles` is a record of role-to-reference bindings with default `{}` and no disjointness constraint between `implementer` and `reviewer` (`src/schemas/config.ts:34-40`, `src/schemas/config.ts:87-99`). `ResolvedAdapter` permits a single builtin adapter value such as `{kind: "builtin", name: "agent"}` for every dispatch (`src/schemas/adapter.ts:59-63`). The current dogfood runner demonstrates that role dispatch can use the same builtin `agent` adapter while only changing `role` (`src/runtime/runner.ts:210-227`).

   **Required fold-in.** Pick one. Either add an enforceable explore-specific adapter-distinctness binding (config fixture or policy plus tests/audit that prove implementer and reviewer resolve to different adapters/models), or weaken every authority surface to say only "role-tagged worker-dispatch boundary is now contract-visible; actual distinct adapter/model separation is deferred to P2.4/P2.5 evidence." This must touch ADR-0008, `specs/contracts/explore.md`, and both `trust_boundary` fields in `specs/artifacts.json`.

2. **Claim: The dispatch flip creates an unbound split between the canonical artifact path and the dispatch result path.**

   **Evidence.** `DispatchStep.writes.artifact` is optional, while `request`, `receipt`, and `result` are required (`src/schemas/step.ts:64-72`). `ResultVerdictGate` always gates on `source: {kind: "dispatch_result", ref: "result"}`, not on `artifact` (`src/schemas/gate.ts:67-72`). The new synthesize fixture writes both `artifact: artifacts/synthesis.json` and `result: artifacts/dispatch/synthesize.result.json`, but the gate passes/fails on `result` (`.claude-plugin/skills/explore/circuit.json:120-135`). The Review step then reads `artifacts/synthesis.json`, not the dispatch result path (`.claude-plugin/skills/explore/circuit.json:139-145`). The same split exists for Review's verdict artifact (`.claude-plugin/skills/explore/circuit.json:149-164`).

   No runtime or contract surface binds those two paths. The only current dispatch execution branch emits `dispatch.started`, `dispatch.completed`, and a `gate.evaluated`; it does not emit `step.artifact_written` for `writes.artifact` or copy `writes.result` to `writes.artifact` (`src/runtime/runner.ts:210-250`). The explore contract still says the five phases "emit artifacts in order" and that Review executes after Synthesize (`specs/contracts/explore.md:291-300`), and its reader/writer graph treats `explore.synthesis` and `explore.review-verdict` as the downstream artifacts (`specs/contracts/explore.md:344-350`).

   **Required fold-in.** Define the dispatch artifact materialization rule before this model is accepted. The narrow fixes are: make the explore dispatch `result` path be the canonical artifact path; or keep separate paths but add a required result-to-artifact promotion/copy event/writer binding; or make `artifact` required for adapter-bound explore dispatches and require `step.artifact_written` before downstream readers can run. Add at least one contract test that fails when `synthesize-step.writes.result` is populated but `explore.synthesis` is never written.

3. **Claim: The contract-test ratchet declared by ADR-0008 is not actually advanced in the worktree.**

   **Evidence.** ADR-0008 says `specs/ratchet-floor.json` advances by the new declarations in `tests/contracts/adapter-binding-coverage.test.ts`, with `last_advanced_in_slice` set to `"38"` (`specs/adrs/ADR-0008-dispatch-granularity-modeling.md:434-439`, `specs/adrs/ADR-0008-dispatch-granularity-modeling.md:576-579`). The new test file has 15 static `it(` declarations (`tests/contracts/adapter-binding-coverage.test.ts:191`, `tests/contracts/adapter-binding-coverage.test.ts:206`, `tests/contracts/adapter-binding-coverage.test.ts:232`, `tests/contracts/adapter-binding-coverage.test.ts:243`, `tests/contracts/adapter-binding-coverage.test.ts:254`, `tests/contracts/adapter-binding-coverage.test.ts:262`, `tests/contracts/adapter-binding-coverage.test.ts:273`, `tests/contracts/adapter-binding-coverage.test.ts:288`, `tests/contracts/adapter-binding-coverage.test.ts:303`, `tests/contracts/adapter-binding-coverage.test.ts:314`, `tests/contracts/adapter-binding-coverage.test.ts:323`, `tests/contracts/adapter-binding-coverage.test.ts:339`, `tests/contracts/adapter-binding-coverage.test.ts:346`, `tests/contracts/adapter-binding-coverage.test.ts:353`, `tests/contracts/adapter-binding-coverage.test.ts:366`).

   But `specs/ratchet-floor.json` still pins `contract_test_count` at `810` and `last_advanced_in_slice` at `"37"` (`specs/ratchet-floor.json:3-8`). My `git diff -- specs/ratchet-floor.json PROJECT_STATE.md README.md TIER.md` was empty. This leaves the new 15-test ratchet below the pinned floor, so a later deletion of this whole test file could still pass the floor check once the file has been committed and then removed back to 810.

   **Required fold-in.** Update `specs/ratchet-floor.json` in this slice: `contract_test_count` should advance 810 -> 825, `last_advanced_in_slice` should be `"38"`, and the notes should name `tests/contracts/adapter-binding-coverage.test.ts` plus the 15 static declarations. Re-run audit after the new test file is tracked/staged so `git ls-files`-based counting sees it.

## §MED objections.

1. **Claim: The ADR-0007 §6 precedent-firewall posture is under-disclosed.**

   **Evidence.** ADR-0008 argues that ADR-0007 §6 does not apply because the change is a widening rather than a weakening (`specs/adrs/ADR-0008-dispatch-granularity-modeling.md:70-82`) and later says ADR-0007's firewall remains in force only for ADRs that amend CC#P2-1..P2-8, which this ADR "does neither" (`specs/adrs/ADR-0008-dispatch-granularity-modeling.md:310-313`). But the same ADR states that CC#P2-1's enforcement surface now expects a stricter model (`specs/adrs/ADR-0008-dispatch-granularity-modeling.md:60-68`), and its provenance cites the continuity entry requiring this pass "per §6 precedent firewall" (`specs/adrs/ADR-0008-dispatch-granularity-modeling.md:538-546`). ADR-0007 §6 applies to any future artifact proposing to retarget, waive, relax, substitute, re-defer, or aggregate close criteria and requires seven explicit checks when it applies (`specs/adrs/ADR-0007-phase-2-close-criteria.md:776-823`).

   **Required fold-in.** Do not leave this as a binary "firewall does not apply." Add an explicit §6-style checklist or applicability note: identify CC#P2-1 as touched; state that clauses about weakening/compensating weaker evidence are N/A because this is intended as a widening; retain cross-model challenger and non-precedent requirements as applied. This makes the "widening" argument auditable instead of a prose escape hatch.

2. **Claim: Check 27 only detects zero-dispatch fixtures, not the ADR-0008 explore binding.**

   **Evidence.** ADR-0008's decision table requires both Synthesize and Review to be `worker` + `dispatch` (`specs/adrs/ADR-0008-dispatch-granularity-modeling.md:94-103`). Check 27 only counts whether any step has `kind === "dispatch"` (`scripts/audit.mjs:3343-3355`). The tests intentionally bless an explore fixture with exactly one dispatch step after flipping Review back to orchestrator synthesis (`tests/contracts/adapter-binding-coverage.test.ts:206-229`). That means Check 27 can be green while the Review half of ADR-0008 is broken.

   The same scope rule lets a future `build` fixture with zero dispatch pass as "unknown workflow kind" until someone remembers to register it in `WORKFLOW_KIND_CANONICAL_SETS` (`scripts/audit.mjs:3337-3340`; test at `tests/contracts/adapter-binding-coverage.test.ts:243-251`). ADR-0008 says Check 27 prevents the HIGH 1 class from recurring when future `build`, `repair`, `migrate`, or `sweep` fixtures land (`specs/adrs/ADR-0008-dispatch-granularity-modeling.md:223-251`), which is stronger than the implementation.

   **Required fold-in.** Either narrow the ADR/test prose to "Check 27 detects only zero-dispatch recurrence for registered workflow kinds" and rely on the live fixture tests for the exact Synthesize/Review binding, or strengthen Check 27 with an explore policy row requiring `synthesize-step` and `review-step` to be dispatch. For unknown fixture ids, consider yellow with an explicit "unregistered workflow kind" finding rather than green if the intent is to catch future workflow-kind landings.

3. **Claim: The non-precedent clause is semantically fuzzy and not load-bearing.**

   **Evidence.** ADR-0008 forbids citing it as "precedent, pattern, template, or analogy" for future workflow kinds and rejects claims like "the explore ADR-0008 pattern applies here" (`specs/adrs/ADR-0008-dispatch-granularity-modeling.md:296-308`). But the Rationale says ADR-0008 establishes the four-ground analysis as the canonical test for future workflow kinds (`specs/adrs/ADR-0008-dispatch-granularity-modeling.md:333-341`), and Consequences says future workflow kinds inherit that analysis frame (`specs/adrs/ADR-0008-dispatch-granularity-modeling.md:483-489`). There is no audit check or naming convention that would catch a future ADR saying "using the ADR-0008 four-ground frame" versus "copying ADR-0008's conclusion."

   **Required fold-in.** Split the clause into allowed and forbidden citations. Allowed: "ADR-0008 defines the four questions future workflow ADRs must answer." Forbidden: "ADR-0008's answer for explore is precedent for this workflow." If the clause is meant to be machine-load-bearing, add a small audit guard over new ADRs for forbidden phrases like "ADR-0008 pattern applies" / "extending ADR-0008" without an explicit fresh-analysis subsection.

## §LOW objections.

1. **Claim: ADR-0008's Deferred/Not changed section is stale relative to this slice's actual artifact-registry edits.**

   **Evidence.** ADR-0008 says `specs/artifacts.json` provenance fields for `explore.synthesis` and `explore.review-verdict` "may need amendment" and are either folded into this slice if Codex flags them HIGH or deferred to Slice 39 (`specs/adrs/ADR-0008-dispatch-granularity-modeling.md:491-504`). They were already amended in this slice (`specs/artifacts.json:648-655`, `specs/artifacts.json:671-680`), and the explore contract says they are updated at Slice 38 (`specs/contracts/explore.md:374-379`).

   **Required fold-in.** Rewrite ADR-0008 §Deferred / Not changed to say the provenance fields were amended in Slice 38, with any remaining refinement explicitly deferred. Do not leave the reader wondering whether the artifact-registry amendment is pending or landed.

2. **Claim: `dangerous_sinks` did not get the same provenance widening as `trust_boundary`.**

   **Evidence.** `explore.synthesis.dangerous_sinks` still lists only "review gate input" and "close-phase result composition" (`specs/artifacts.json:654`); `explore.review-verdict.dangerous_sinks` lists close-phase result composition (`specs/artifacts.json:677-680`). After the dispatch flip, the new risk is not just that the artifact is read downstream; it is that an adapter-authored `writes.result` payload may be promoted into, or confused with, the canonical workflow artifact.

   **Required fold-in.** Either widen `dangerous_sinks` now to mention dispatch-result promotion / adapter-authored payload consumption, or add an explicit deferral note to Slice 39/40. This can be folded together with HIGH objection #2 if the result-to-artifact binding is clarified.

3. **Claim: The requested review frontmatter shape and the executable test schema disagree.**

   **Evidence.** The prompt-specified skeleton uses `target_kind: adr`, but `tests/contracts/cross-model-challenger.test.ts` classifies files whose names begin with `arc-` as arc reviews (`tests/contracts/cross-model-challenger.test.ts:320-325`) and requires every arc review to carry `target_kind=arc` (`tests/contracts/cross-model-challenger.test.ts:494-505`). This file's required path begins with `arc-`.

   **Required fold-in.** Keep this file at `target_kind: arc` so the current schema passes, and if ADR-targeted arc reviews are a recurring shape, amend the test/schema to add a separate subject-kind field instead of overloading `target_kind`.

## §Meta objections.

None beyond LOW #3.

## §Scope I did not open this pass.

- `src/schemas/*` other than `step.ts`, `gate.ts`, `adapter.ts`, `config.ts`, `workflow.ts`, and `event.ts`: not needed to evaluate dispatch-step shape, adapter-resolution claims, or fixture parse.
- `~/Code/circuit`: not opened because Slice 38 does not claim reference artifact parity; CC#P2-1 parity remains P2.5 scope.

## §Fold-in record (post-pass, author side — all HIGH + MED folded in; selected LOWs also folded in)

### HIGH fold-ins (all folded in; HEAD 828 tests; audit 25 green / 2 yellow / 0 red)

- **HIGH 1 — distinct-adapter overclaim.** Prose weakened across
  three authority surfaces per ADR-0007 §6.4 inline-disclosure
  rule:
  - `specs/adrs/ADR-0008-dispatch-granularity-modeling.md
    §Decision.2 (iii)` rewritten to "role-tagged worker-dispatch
    boundary is contract-visible at v0.2; distinct-adapter /
    distinct-model enforcement is deferred to P2.4/P2.5 evidential
    guarantee." Weaker-evidence disclosure cited in the subsection
    title itself.
  - `specs/adrs/ADR-0008-dispatch-granularity-modeling.md
    §Decision.3` ("weaker substitute retired") amended with a
    bullet explicitly noting that v0.2 schema does NOT enforce
    distinct adapters (`src/schemas/config.ts:34-99` permits both
    roles to bind to the same adapter); disclosure cites Codex
    Slice 38 HIGH 1 by name.
  - `specs/contracts/explore.md §Executor and kind per phase`
    ("Why Synthesize and Review are dispatch steps") + §verify-
    omission rationale: both amended with the same weaker-evidence
    disclosure; the "cross a Knight-Leveson model boundary" claim
    is split into "dispatch-machinery-routing contract-visible at
    v0.2" (true now) + "distinct-adapter evidentially enforced at
    P2.4/P2.5" (deferred).
  - `specs/artifacts.json` `explore.synthesis.trust_boundary` +
    `explore.review-verdict.trust_boundary` both rewritten with the
    weaker-evidence disclosure inline; the Knight-Leveson claim is
    now "dispatch-machinery-routing precondition at v0.2; contract-
    guaranteed at P2.4/P2.5 config/parity enforcement."
- **HIGH 2 — dispatch result vs canonical artifact path unbound.**
  ADR-0008 §Decision.3a "Dispatch result-to-artifact
  materialization rule" added (new subsection between §Decision.3
  and §Decision.4). Rule: when a DispatchStep declares
  `writes.artifact`, the runtime MUST, after the gate passes,
  materialize the artifact at `writes.artifact.path` by
  schema-parsing the `result` payload against
  `writes.artifact.schema`. Contract-level at v0.2 (fixture-level
  precondition); runtime-enforced at P2.4. Check 27 amended with
  a policy row `WORKFLOW_KIND_DISPATCH_POLICY.explore.
  require_writes_artifact_on_dispatch = true`: every dispatch step
  in the explore fixture MUST declare `writes.artifact`
  alongside the required `writes.result`. Red on missing. Two new
  contract tests bind the rule (temp-dir red path stripping
  writes.artifact; live-repo regression guard). The explore
  contract amended with a new §"ADR-0008 provenance note"
  subsection documenting the binding + materialization rule + the
  separate on-disk paths (transcript vs validated artifact).
- **HIGH 3 — ratchet-floor not advanced.** `specs/ratchet-floor.json`
  updated: `contract_test_count: 810 → 828`, `last_advanced_in_slice:
  "37" → "38"`, notes block extended with Slice 38 narrative (+18
  static test declarations: initial 15 + 3 post-fold-in). The
  `tests/contracts/status-epoch-ratchet-floor.test.ts` live-repo
  pin updated `'37' → '38'`.

### MED fold-ins (all folded in)

- **MED 1 — §6 posture under-disclosed.** ADR-0008 §Context gained
  an explicit seven-clause §6 applicability checklist that
  addresses ADR-0007 §6.1-6.7 clause by clause; §6.3 is N/A (this
  is widening, not weakening) but the one weaker-evidence claim
  (distinct-adapter) triggers §6.4 inline-disclosure, which is
  satisfied across the four authority surfaces per HIGH 1 fold-in.
- **MED 2 — Check 27 weaker than ADR-0008 binding.** Check 27
  strengthened in `scripts/audit.mjs`:
  - New module-level constant `WORKFLOW_KIND_DISPATCH_POLICY` with
    `explore` policy row naming `require_dispatch_step_ids:
    ['synthesize-step', 'review-step']` +
    `require_writes_artifact_on_dispatch: true`.
  - Rule (2): every required step id MUST exist and have `kind:
    "dispatch"`; missing or wrong-kind red with diagnostic prose
    citing ADR-0008 §Decision.1 authority.
  - Rule (3): every dispatch step MUST declare `writes.artifact`
    (HIGH 2 binding); missing red with citation to
    §Decision.3a.
  - Unknown workflow kinds now yellow, not green — prompts the
    author to either register the kind or exempt it. Two new
    tests bind these paths (flipping review-step back to
    synthesis now reds; missing review-step entirely reds;
    missing writes.artifact on dispatch reds; unknown-kind yellow
    instead of green).
- **MED 3 — non-precedent clause fuzzy.** ADR-0008 §6 rewritten
  into "Allowed citations" (four-ground analysis frame; §6
  applicability checklist pattern; dispatch materialization rule)
  vs "Forbidden citations" (the specific explore answer; citations
  treating the conclusion as transferable). Enforcement is
  prose-level at v0.2 with a follow-up audit-check reopen trigger
  noted.

### LOW fold-ins

- **LOW 1 — stale ADR Deferred text.** ADR-0008 §Deferred / Not
  changed rewritten to reflect actually-landed amendments:
  `specs/artifacts.json` provenance + `dangerous_sinks` fields
  landed in Slice 38 (not deferred); schema files for artifact v1
  still deferred to P2.10; runtime-enforcement of materialization
  rule still deferred to P2.4; collision closing to Slice 39.
- **LOW 2 — `dangerous_sinks` not widened.** Both
  `explore.synthesis.dangerous_sinks` and
  `explore.review-verdict.dangerous_sinks` in `specs/artifacts.json`
  gained a new entry naming dispatch-result-to-artifact
  materialization as the new upstream risk surface: an
  adversarial or malformed adapter response is promoted into the
  canonical artifact via the §Decision.3a rule.
- **LOW 3 — frontmatter target_kind mismatch.** No fold-in
  required; Codex already correctly used `target_kind: arc` to
  satisfy the executable test schema
  (`tests/contracts/cross-model-challenger.test.ts:494-505`). The
  prompt-specified `adr` was the discrepancy; Codex caught and
  corrected.

### Cross-slice / meta

- The Codex-reported `npm run test` + `npm run audit` sandbox
  failures (dogfood CLI smoke + verify gate failing on `tsx` IPC
  EPERM) did NOT reproduce in the author's local environment;
  `npm run verify` passes 881/881 tests green + `npm run audit`
  shows 25 green / 2 yellow / 0 red at fold-in completion. The
  two yellows are pre-existing and unrelated: the Check 25 tracked
  HIGH 4 collision closing at Slice 39, plus the pre-existing
  framing warning on old docs commits.

## §Closing verdict.

ACCEPT-WITH-FOLD-INS.

All 3 HIGH and 3 MED objections folded in across
`specs/adrs/ADR-0008-dispatch-granularity-modeling.md`,
`specs/contracts/explore.md`, `specs/artifacts.json`,
`scripts/audit.mjs` (+ `scripts/audit.d.mts` types),
`specs/ratchet-floor.json`,
`tests/contracts/adapter-binding-coverage.test.ts` (+18 static
declarations; +3 from the pre-fold-in 15), and
`tests/contracts/status-epoch-ratchet-floor.test.ts` (live pin).
All 3 LOW objections also folded in (LOW 3 was a no-op —
frontmatter already correct). 881 tests green; audit 25 green / 2
yellow / 0 red. Yield-ledger row class = `governance` per ADR-0007
§6.6.
