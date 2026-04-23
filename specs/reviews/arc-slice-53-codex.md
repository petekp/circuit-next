---
name: arc-slice-53-codex
description: Cross-model challenger pass over Slice 53 (dispatch verdict truth — Codex H14 fold-in; Clean-Clone Reality Tranche slice 2 of 4). Per-slice review per CLAUDE.md §Hard invariants #6 — ratchet change + privileged runtime (gate evaluation rewrite + RunResult schema extension + composeDispatchPrompt tightening + new test surface). Returns OBJECTION LIST per CHALLENGER-I1. Satisfies scripts/audit.mjs Check 35 (checkCodexChallengerRequiredDeclaration) for the Slice 53 commit.
type: review
reviewer_model: gpt-5.4
reviewer_model_id: gpt-5-codex
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-22
verdict: ACCEPT-WITH-FOLD-INS
authored_by: gpt-5-codex
review_target: slice-53-dispatch-verdict-truth
target_kind: arc
target: slice-53
target_version: "HEAD=fa88d5c (pre-commit staged diff at initial Codex pass) → <new-SHA-at-Slice-53-landing>"
arc_target: clean-clone-reality-tranche
arc_version: "second execution slice in the tranche (52 + 53 done, 54 + 55 remaining); arc closes at Slice 55 arc-close composition review"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  high: 3
  med: 4
  low: 3
  meta: 2
commands_run:
  - cat staged diff via git diff --cached --stat + per-file inspection
  - read src/runtime/runner.ts (full file, dispatch branch + run.closed emission)
  - read src/runtime/adapters/dispatch-materializer.ts (artifact write logic)
  - read src/schemas/event.ts:43-52 (GateEvaluatedEvent.outcome enum)
  - read src/schemas/event.ts:97-106 (DispatchCompletedEvent.verdict shape)
  - read src/schemas/event.ts:198-206 (RunClosedOutcome enum)
  - read src/schemas/result.ts (RunResult shape)
  - read src/schemas/gate.ts (ResultVerdictGate shape)
  - read tests/runner/gate-evaluation.test.ts (new test surface — 5 baseline cases pre-fold-in)
  - read .claude-plugin/skills/dogfood-run-0/circuit.json (fixture used by tests)
  - read .claude-plugin/skills/explore/circuit.json (verdict surface for HIGH 2 analysis)
  - read specs/contracts/explore.md (gate-evaluation semantics subsection added by slice)
  - read specs/plans/clean-clone-reality-tranche.md §Slice 53 + §Slice 54 + §Slice 55
  - read specs/reviews/phase-project-holistic-2026-04-22-codex.md §HIGH 14 (originating finding)
  - read specs/adrs/ADR-0008-dispatch-granularity-modeling.md §Decision.3a (artifact-write rule)
  - grep `result_body:` across tests/ (other stub dispatchers that may need updating)
opened_scope:
  - src/runtime/runner.ts (dispatchVerdictForStep → evaluateDispatchGate rewrite + runDogfood loop integration)
  - tests/runner/gate-evaluation.test.ts (new test file)
  - specs/contracts/explore.md (Dispatch gate-evaluation semantics subsection)
  - src/schemas/result.ts (post-fold-in: RunResult.reason addition for HIGH 1)
  - src/runtime/runner.ts composeDispatchPrompt (post-fold-in: prompt tightening for MED 4)
  - specs/plans/clean-clone-reality-tranche.md §Slice 54 + §Slice 55 (post-fold-in: scope amendments for HIGH 2 + META 2)
skipped_scope:
  - bootstrap/** (Phase 0 evidence loop, frozen)
  - prior-gen circuit at ~/Code/circuit (read-only reference per CLAUDE.md)
  - src/runtime/adapters/agent.ts + codex.ts (Slice 53 did not modify adapters; agent surface SHA changes only because runner.ts is in the AGENT_ADAPTER_SOURCE_PATHS fingerprint binding)
  - src/runtime/adapters/dispatch-materializer.ts (Slice 53 changed only the runner-side caller arguments; materializer body is untouched and reserved for Slice 54)
  - tests/properties/** (Tier 2+ deferred per CLAUDE.md hard invariants)
authority:
  - CLAUDE.md §Cross-model challenger protocol (objection list, not approval)
  - CLAUDE.md §Hard invariants #6 (challenger required for ratchet changes / privileged runtime)
  - scripts/audit.mjs Check 35 (checkCodexChallengerRequiredDeclaration — this file's existence is the evidence path)
  - specs/plans/clean-clone-reality-tranche.md §Slice 53 (plan being reviewed against)
  - specs/reviews/phase-project-holistic-2026-04-22-codex.md §HIGH 14 (originating Codex finding)
  - tests/contracts/cross-model-challenger.test.ts §CHALLENGER-I3 (review-record frontmatter schema this file satisfies)
---

# Slice 53 — Codex challenger pass (cross-model adversarial review)

This is the Codex cross-model challenger pass for Slice 53 (dispatch
verdict truth — Codex H14 fold-in), dispatched via the `/codex` skill
with the staged Slice 53 diff before commit.

## Initial verdict

**REJECT-PENDING-FOLD-INS** with 3 HIGH / 4 MED / 3 LOW / 2 META findings.

## Findings (verbatim from Codex response)

### HIGH 1 — `result.json` does not carry the abort reason

- Body: The slice brief says post-loop `run.closed` and `result.json`
  carry the aborted outcome + reason. The code only writes the reason
  onto `run.closed`; `RunResult` has no `reason` field and `writeResult`
  receives only `outcome` (`src/runtime/runner.ts:641`,
  `src/schemas/result.ts:22`). The new test only asserts
  `result.json.outcome === 'aborted'`, so the missing reason is
  invisible (`tests/runner/gate-evaluation.test.ts:166`). The explore
  contract also says the reason is "preserved on `RunResult.outcome`,"
  which is structurally impossible and semantically confused
  (`specs/contracts/explore.md:580`).
- Recommendation: fold in this commit. Either add optional `reason`
  to `RunResult` and write/assert it, or remove the claim that
  `result.json` carries the reason. I would prefer adding
  `reason?: string` because the user-facing close artifact should
  explain aborted runs.

### HIGH 2 — Gate-failed dispatch still writes canonical artifacts

- Body: On fail, `evaluateDispatchGate` runs before materialization,
  but `materializeDispatch` is still called with `writes.artifact`
  and writes raw `result_body` to the canonical artifact path before
  the `gate.evaluated outcome=fail` event
  (`src/runtime/runner.ts:515`,
  `src/runtime/adapters/dispatch-materializer.ts:139`). The dogfood
  fixture used by the new tests has no `writes.artifact`, so none of
  the fail cases exercise the exact ADR-0008 hazard present in
  explore (`.claude-plugin/skills/dogfood-run-0/circuit.json:77`).
  This makes the Slice 53/54 split defensible only if Slice 54 is
  explicitly scoped to both schema-parse and artifact-write ordering.
- Recommendation: defer-with-named-trigger only if the Slice 54
  acceptance text is updated to say "do not write
  `writes.artifact.path` unless verdict gate passes and schema parse
  succeeds." Add a Slice 53 regression test using an explore-shaped
  dispatch step that proves today's known violation is visible, or
  at least documents it as an expected failing/known gap for
  Slice 54.

### HIGH 3 — Contract text contradicts runtime ordering

- Body: The contract says gate evaluation happens "after the
  five-event dispatch transcript is materialized," and later says
  the runner materializes before evaluating
  (`specs/contracts/explore.md:568`, `:608`). The code parses /
  evaluates before calling `materializeDispatch`, then emits the
  `gate.evaluated` event after the dispatch transcript is written
  (`src/runtime/runner.ts:508`). That difference matters because
  `dispatch.completed.verdict` is computed from the evaluation.
- Recommendation: fold in this commit. Rewrite the contract to
  distinguish "verdict parsing decision" from "`gate.evaluated` event
  emission." The honest statement is: parse/evaluate result bytes
  before constructing `dispatch.completed`; materialize transcript
  and current raw artifact slots; then emit `gate.evaluated`.

### MED 1 — `'<no-verdict>'` makes `dispatch.completed.verdict` look adapter-authored

- Body: `dispatch.completed.verdict` historically reads as the
  verdict slot. On unparseable or missing verdict, the runtime
  injects `'<no-verdict>'` to satisfy `z.string().min(1)`
  (`src/runtime/runner.ts:173`, `src/schemas/event.ts:98`). That is
  more honest than pretending pass, but it is still not a verdict.
  A consumer that looks only at `dispatch.completed` can misread a
  runtime sentinel as adapter output.
- Recommendation: fold in if the event schema can move now: make
  the completed verdict field optional/null or add an explicit
  `verdict_observed: boolean` / `verdict_source` shape. If schema
  churn is too wide for Slice 53, defer-with-named-trigger to
  Slice 54/55 and amend the contract to call the sentinel
  runtime-injected, not adapter-declared.

### MED 2 — Failure-path assertions are too shallow

- Body: The fail tests assert abort behavior, but they do not
  assert the full advertised transcript: reject should put `"reject"`
  into `dispatch.completed.verdict`; unparseable/no-verdict should
  put the sentinel; `gate.evaluated.reason`, `step.aborted.reason`,
  and `run.closed.reason` should be byte-identical; `result.json`
  should carry the reason if that remains the contract
  (`tests/runner/gate-evaluation.test.ts:124`).
- Recommendation: fold in this commit. These assertions are cheap
  and would catch the exact future drift this slice is trying to
  prevent.

### MED 3 — Edge-case parser coverage is incomplete

- Body: The evaluator has clear behavior for arrays, `null`,
  primitives, non-string verdicts, empty string, nested verdicts,
  whitespace-only strings, and case differences, but tests only
  cover unparseable JSON and missing field. The current
  implementation accepts any non-empty string exactly if present in
  `gate.pass`; it does not trim or case-normalize
  (`src/runtime/runner.ts:195`).
- Recommendation: fold in this commit or defer-with-named-trigger
  to the next runner test hardening pass. Minimum tests:
  `{"verdict":""}`, `{"verdict":" "}`, `{"verdict":123}`, `[]`,
  `null`, `{"payload":{"verdict":"ok"}}`, and `{"verdict":"OK"}`.
  Contract should explicitly say exact string membership, no
  trimming/case folding.

### MED 4 — Real LLM output contract is brittle at the prompt boundary

- Body: The runner uses raw `JSON.parse(result_body)`. The prompt
  says "Respond with a JSON object..." but does not say "only JSON,
  no Markdown fences, no prose" (`src/runtime/runner.ts:240`). That
  is probably intentional strictness, but with real `claude` /
  `codex` adapters it is a live abort trap. The newly introduced
  AGENT/CODEX fingerprint yellows may be partly semantic churn from
  this path.
- Recommendation: fold in this commit by tightening the prompt
  wording. Do not add fuzzy extraction unless you intentionally
  want a broader contract; exact `JSON.parse` is fine if the prompt
  and contract say so plainly.

### LOW 1 — In-memory fixture mutation is acceptable but weakly tied to live coverage

- Body: The "parsed from body, not pass[0]" test mutates
  dogfood-run-0 in memory to create a multi-pass gate
  (`tests/runner/gate-evaluation.test.ts:210`). That proves the
  regression, but it does not touch the real explore review step,
  which already has `["accept", "accept-with-fold-ins"]`
  (`.claude-plugin/skills/explore/circuit.json:158`).
- Recommendation: no action required for Slice 53, but better
  coverage would add a focused test against the explore fixture or
  a small named fixture with `writes.artifact` and multi-pass
  verdicts.

### LOW 2 — Reason strings are unbounded and include raw verdict text

- Body: A malicious or broken adapter can return a very long
  verdict string; the runtime copies it into `observedVerdict` and
  the event `reason` (`src/runtime/runner.ts:202`). JSON event
  encoding prevents structural injection, but log bloat and
  unreadable reasons are still possible.
- Recommendation: defer-with-named-trigger to the next event-log
  hygiene pass. Truncate displayed verdicts in reason strings while
  preserving raw bytes in `dispatch.result`.

### LOW 3 — Explore contract wording overclaims "closed by Slice 53"

- Body: The H14 pass-by-construction behavior is closed for route
  advancement, but dispatch artifacts can still be materialized
  from invalid/failed output. The "closed by Slice 53" disclosure
  is true only for verdict admissibility, not for the broader
  dispatch-truth surface (`specs/contracts/explore.md:592`).
- Recommendation: fold in a narrower phrase: "closed for gate
  verdict admissibility; artifact-side truth remains Slice 54."

### META 1 — Ratchet-Advance with new yellows needs a named disposal line

- Body: The reported audit move from `34/0/0` to `32/2/0` is
  explainable because runner source is fingerprinted, but it is
  still a visible ratchet regression. The slice body should not
  merely mention it; it needs a concrete trigger and owner action.
- Recommendation: defer-with-named-trigger is acceptable:
  "operator-local AGENT_SMOKE/CODEX_SMOKE fingerprint promotion
  window, or Slice 55 arc-close fold-in, whichever comes first."

### META 2 — Slice 55 needs to review the composed dispatch failure story, not just H14/H15 separately

- Body: Slice 53 adds aborted gate semantics; Slice 54 is planned
  to add schema-parse/materialization ordering; Slice 55 must
  verify the composition: bad model output produces durable
  request/receipt/result transcript, no canonical artifact, no
  route advance, no `step.completed`, `run.closed outcome=aborted`,
  and user-facing `result.json` reason.
- Recommendation: fold into Slice 55 scope explicitly. Otherwise
  this tranche can "close" both individual findings while leaving
  the cross-step failure invariant unproven.

## Closing verdict (Codex)

**REJECT-PENDING-FOLD-INS.**

## Disposition (Claude)

Folded into this commit:

- **HIGH 1** — `RunResult` schema gains optional `reason: z.string().min(1).optional()`; runner passes `closeReason` into `writeResult` (RESULT-I4 added). Test asserts `outcome.result.reason` matches event-stream reason. Explore contract wording fixed.
- **HIGH 2** — Runner gates the canonical artifact write on
  `evaluation.kind === 'pass'`; transcript files (request / receipt /
  result) still write unconditionally on either path. New regression
  test mutates the dogfood fixture to declare `writes.artifact` and
  asserts (a) no canonical artifact on gate fail, (b) canonical
  artifact present on gate pass. Slice 54 acceptance text updated to
  state "artifact write requires BOTH verdict gate pass AND schema
  parse success."
- **HIGH 3** — Explore contract `Dispatch gate-evaluation semantics`
  subsection rewritten to distinguish "verdict parsing decision"
  (happens INSIDE the runner before materializeDispatch) from
  "`gate.evaluated` event emission" (happens AFTER the five-event
  dispatch transcript). Explicit event-ordering subsection added.
- **MED 2** — Test suite strengthened: REJECT case asserts
  `dispatch.completed.verdict === 'reject'`, byte-identical reasons
  across `gate.evaluated` / `step.aborted` / `run.closed` / 
  `RunResult.reason`. UNPARSEABLE and NO-VERDICT cases assert
  `dispatch.completed.verdict === '<no-verdict>'` sentinel and the
  same byte-identical-reason invariant.
- **MED 3** — 12 new edge-case tests under
  `Slice 53 — dispatch verdict truth: edge-case parser coverage`:
  empty-string verdict, whitespace-only verdict, numeric verdict,
  boolean verdict, null verdict, object verdict, nested-payload
  verdict (no top-level), parsed-as-array, parsed-as-null,
  parsed-as-string, parsed-as-number, case-mismatch (`"OK"` vs
  `"ok"`). Each asserts run.outcome=aborted with a per-case reason
  pattern. Contract amended to state "exact string equality, no
  trimming, no case folding."
- **MED 4** — `composeDispatchPrompt` instruction rewritten to
  forbid Markdown code fences and prose around the JSON object;
  names `JSON.parse` as the runtime parser explicitly so the
  adapter knows the strictness. Contract amended in the same vein.
- **LOW 3** — Explore contract claim narrowed to "closed for
  verdict admissibility; artifact-side closes at Slice 54."
- **META 1** — Slice commit body discloses the 2 audit yellows
  (AGENT_SMOKE / CODEX_SMOKE fingerprint mismatches) as expected
  consequences of touching `src/runtime/runner.ts` (which is in
  `AGENT_ADAPTER_SOURCE_PATHS` and the symmetric CODEX list).
  Resolution path named: operator-local re-promotion via
  `AGENT_SMOKE=1 UPDATE_AGENT_FINGERPRINT=1` and `CODEX_SMOKE=1
  UPDATE_CODEX_FINGERPRINT=1`, or Slice 55 arc-close fold-in.
  Slice 55 plan entry updated to dispose this item explicitly.
- **META 2** — Slice 55 scope amended in
  `specs/plans/clean-clone-reality-tranche.md` to require the
  composition review verify the composed dispatch failure story
  (transcript present + no canonical artifact + no step.completed
  + run.closed outcome=aborted + byte-identical reason across
  events and result.json), not merely the union of per-slice
  per-finding closure.

Deferred-with-named-trigger:

- **MED 1** — `dispatch.completed.verdict` schema bump to
  distinguish runtime-injected sentinel from adapter-declared
  verdict. Trigger: first downstream consumer that needs to
  disambiguate. Disclosed in explore contract `Runtime sentinels
  on dispatch.completed.verdict` subsection. Disposition added to
  Slice 55 ledger.
- **LOW 2** — Reason-string length bounds / truncation policy.
  Trigger: next event-log hygiene pass. Disposition added to
  Slice 55 ledger.

No action:

- **LOW 1** — Acknowledged; the in-memory fixture mutation pattern
  is consistent with how Slice 47a's tests inject `default_selection`
  for provenance coverage. The HIGH 2 regression test added in this
  fold-in pass uses the same pattern with `writes.artifact`,
  partially addressing the spirit of LOW 1's recommendation
  (broader coverage of the explore-fixture-shaped dispatch step).

## Final verdict (post-fold-in)

**ACCEPT-WITH-FOLD-INS** — all findings either folded into this
commit or registered in the Slice 55 disposition ledger with
explicit triggers. The slice closes Codex H14 honestly: dispatch
verdict admissibility now consults adapter output, the contract is
internally consistent on event ordering, the failure-path event
surface is uniform, and the user-visible close artifact carries
the explanation a future operator needs to understand an aborted
run without walking the event log.
