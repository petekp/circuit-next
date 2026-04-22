---
name: arc-slices-41-to-43-composition-review-claude
description: Fresh-read Claude composition-adversary pass over Slices 41 / 42 / 43a / 43b / 43c of the P2.4 + P2.5 adapter+end-to-end arc. Looks for boundary-seam failures no individual slice owned — things the per-slice reviews could not see because the seam is cross-slice. Paired with the Codex challenger prong to be commissioned at arc close.
type: review
reviewer_model: claude-opus-4-7
reviewer_model_id: claude-opus-4-7
authorship_role: auditor
review_kind: composition-review
review_date: 2026-04-21
verdict: REJECT-PENDING-FOLD-INS → incorporated → ACCEPT-WITH-FOLD-INS
authored_by: claude-opus-4-7
review_target: arc-slices-41-to-43-p2.4-p2.5-adapter-and-e2e-arc
target_kind: arc
target: p2.4-p2.5-adapter-and-e2e-arc
target_version: "HEAD=7bc3543 (post-Slice-43c)"
arc_target: phase-2-p2.4-p2.5-arc-slices-41-to-43
arc_version: "d482740..7bc3543"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  HIGH: 3
  MED: 4
  LOW: 3
  META: 2
commands_run:
  - Read specs/reviews/arc-slice-41-adapter-invocation-pattern-codex.md (Slice 41 per-slice Codex prong)
  - Read specs/reviews/arc-slice-42-real-agent-adapter-codex.md (Slice 42 per-slice Codex prong)
  - Read specs/reviews/arc-slices-35-to-40-composition-review-claude.md (prior arc-close Claude prong — calibration)
  - Read specs/reviews/arc-slices-35-to-40-composition-review-codex.md (prior arc-close Codex prong — calibration)
  - Read scripts/audit.mjs lines 3138-3250 (Check 26 checkArcCloseCompositionReviewPresence)
  - Read scripts/audit.mjs lines 3500-3850 (Check 28/29/30 + extractImportSpecifiers)
  - Read src/runtime/runner.ts (post-43b async + post-43c writeSynthesisArtifact)
  - Read src/cli/dogfood.ts (post-43c explore fixture loader + validateWorkflowKindPolicy)
  - Read tests/runner/explore-e2e-parity.test.ts (Slice 43c e2e — static + AGENT_SMOKE gated)
  - Read tests/contracts/slice-43c-agent-smoke-fingerprint.test.ts (Check 30 unit tests)
  - Read specs/plans/phase-2-implementation.md §P2.4 + §P2.5 (post-43a retargeting text)
  - Read specs/ratchet-floor.json (844 → 885 → 900 → 900 → 924 across arc)
  - Ran `npm run audit` — 29 green / 1 yellow / 0 red (yellow is framing warning on older commits)
  - Ran `git log d482740..HEAD --oneline` (5 arc commits confirmed)
  - Ran `git show --stat` on each of Slices 41/42/43a/43b/43c (file diffs + line counts)
  - Listed specs/reviews/ for slice-43 pattern match (found zero 43a/b/c per-slice Codex files)
opened_scope:
  - specs/reviews/arc-slice-41-adapter-invocation-pattern-codex.md
  - specs/reviews/arc-slice-42-real-agent-adapter-codex.md
  - scripts/audit.mjs Check 26 + Check 28 + Check 29 + Check 30
  - src/runtime/runner.ts
  - src/cli/dogfood.ts
  - src/runtime/adapters/agent.ts (referenced via Slice 42 Codex review)
  - src/runtime/adapters/dispatch-materializer.ts (referenced via Slice 42 Codex review)
  - src/runtime/policy/workflow-kind-policy.ts (Slice 43a new module)
  - scripts/policy/workflow-kind-policy.mjs (Slice 43a audit-side wrapper)
  - tests/runner/explore-e2e-parity.test.ts (Slice 43c)
  - tests/contracts/slice-43c-agent-smoke-fingerprint.test.ts (Slice 43c)
  - specs/plans/phase-2-implementation.md §P2.4 + §P2.5 + §P2.6-P2.11 backlog
  - specs/ratchet-floor.json (arc-wide floor advancement)
  - tests/fixtures/golden/explore/result.sha256 (new in 43c)
  - tests/fixtures/agent-smoke/last-run.json (new in 43c)
  - CLAUDE.md §Cross-slice composition review cadence + §Hard invariants #6
skipped_scope:
  - specs/adrs/ADR-0009-adapter-invocation-pattern.md — Slice 41 Codex prong opened this file end-to-end; cross-referenced via the per-slice review rather than re-opened
  - specs/adrs/ADR-0007-phase-2-close-criteria.md §Amendment Slice 37 — referenced via Slice 41/42 prong summaries
  - specs/contracts/adapter.md — ADAPTER-I1 amendment confirmed via Slice 41 Codex HIGH 1 fold-in record
  - tests/contracts/slice-42-agent-adapter.test.ts (37 tests) — Slice 42 per-slice prong opened this file; not re-opened
  - tests/runner/agent-dispatch-roundtrip.test.ts — Slice 42 per-slice prong opened this file; CC#P2-2 binding confirmed via the review record
  - src/schemas/event.ts — covered by Slice 37 fold-in chain + Slice 42 parseAgentStdout surface, not re-opened
  - specs/plans/phase-2-foundation-foldins.md — prior arc; not in this arc's scope
authority:
  - CLAUDE.md §Cross-slice composition review cadence
  - CLAUDE.md §Hard invariants #6 (cross-model challenger required for any ratchet change)
  - specs/reviews/arc-slices-35-to-40-composition-review-claude.md (format precedent)
  - specs/reviews/arc-slices-35-to-40-composition-review-codex.md (format precedent)
  - ADR-0007 §Decision.1 CC#P2-1 (one-workflow parity) + CC#P2-2 (real-agent dispatch transcript)
fold_in_disposition: Three HIGH findings require fold-in before P2.6 (codex adapter) opens; recommended fold-in vehicle is the ceremony commit (same commit that lands this review file's Codex sibling + advances `current_slice` + extends Check 26). Four MEDs are incorporable inline in the ceremony commit; three LOWs defer to a follow-up micro-slice at operator discretion. Closing verdict ACCEPT-WITH-FOLD-INS on the theory that the arc produced the right implementation work and the seam-level drifts are absorbable into the ceremony commit rather than requiring a second fold-in bundle.
---

# P2.4 + P2.5 adapter-and-e2e arc (Slices 41 / 42 / 43a / 43b / 43c) — Claude composition-adversary review

## Scope

Fresh-read composition-adversary pass over the five slices landed in
the P2.4 + P2.5 arc (commit range `d482740..7bc3543`, ending at
`current_slice=43c`). Each slice passed or elided its own Codex
challenger pass:

- Slice 41 (ADR-0009 adapter invocation pattern): passed Codex (4 HIGH / 6 MED / 3 LOW → ACCEPT-WITH-FOLD-INS, `arc-slice-41-adapter-invocation-pattern-codex.md`).
- Slice 42 (P2.4 real agent adapter): passed Codex (5 HIGH / 4 MED / 2 LOW → ACCEPT-WITH-FOLD-INS, `arc-slice-42-real-agent-adapter-codex.md`).
- Slice 43a (P2.5 HIGH 5 retargeting — `validateWorkflowKindPolicy` helper extraction): **no per-slice Codex pass**.
- Slice 43b (P2.5 `runDogfood` async + real-adapter seam): **no per-slice Codex pass**.
- Slice 43c (P2.5 explore end-to-end fixture run — closes CC#P2-1 + CC#P2-2): **no per-slice Codex pass**.

The purpose of this review is to surface boundary-seam failures the
per-slice reviewers could not see because the seam is cross-slice,
and to flag the arc-level policy drift of three consecutive ratchet-
touching sub-slices under `43` landing without cross-model challenger.
Calibration target: the two convergent HIGH findings the prior
composition review (`arc-slices-35-to-40-composition-review-claude.md`)
surfaced over the Slice 35/37/38/39 arc.

## Opening verdict

**REJECT-PENDING-FOLD-INS.** Three HIGH findings surfaced on first read:
(1) no per-slice Codex review exists for Slices 43a / 43b / 43c
despite all three touching ratchets — a direct violation of CLAUDE.md
§Hard invariants #6 (this is the Slice 39 MED 2 pattern multiplied by
three, landed silently in one day);
(2) the CC#P2-1 one-workflow-parity golden is self-referential — it
hashes a deterministic placeholder the runner writes from `gate.required`
section names, NOT from the dispatch output; the arc claims "parity"
but the measured byte-shape never touches real adapter output;
(3) Check 26 is still bound to the Slice 35-to-40 arc and the
41-to-43 arc is audit-unguarded — the ceremony slice must extend
the regex (or land a generalized arc-ledger gate) in the same commit
that lands this review, or the new arc-close is authored but unenforced.

## Closing verdict

**ACCEPT-WITH-FOLD-INS.** All three HIGH findings are real cross-slice
seam drifts, not slice-internal bugs, and all three are incorporable
into the arc-close ceremony commit. The arc produced substantive
implementation work: Slice 41's ADR-0009 is structurally right on its
four grounds; Slice 42's capability-boundary empirical proof at CLI
v2.1.117 is the strongest safety evidence this repo has produced to
date; Slice 43a's helper extraction cleanly resolved the EXPLORE-I1
delivery-window ambiguity; Slice 43b's async seam is a disciplined
runtime-boundary move; Slice 43c's five-event transcript lands twice
against a real CLI. The remaining drifts are governance-surface
(skipped Codex passes, audit-gate binding) and claim-calibration
(parity golden overclaims). Landing them as inline fold-ins in the
ceremony commit is cheaper than a second fold-in bundle and avoids
blocking P2.6 on a rediscovery pass.

---

## HIGH findings

### HIGH 1 — Three consecutive ratchet-touching sub-slices landed without per-slice Codex challenger (Hard Invariant #6 violation, arc-level)

**Evidence.**

- `CLAUDE.md §Hard invariants #6`: "Cross-model challenger required for any ratchet change."
- `ls specs/reviews/ | grep -E 'slice-43'` returns zero files. The arc
  has per-slice Codex records for Slice 41 and Slice 42 only.
- Slice 43a (commit `b1dd9af`) touched:
  - `specs/ratchet-floor.json` (885 → 900, +15 static declarations).
  - New runtime module `src/runtime/policy/workflow-kind-policy.ts` (+65 lines).
  - New audit-side wrapper `scripts/policy/workflow-kind-policy.mjs` (+161 lines).
  - `scripts/audit.mjs` Check 24 refactor (Check 24 body condensed +122/-113).
  - `src/cli/dogfood.ts` (runtime fixture loader now calls the helper).
  - `tests/contracts/workflow-kind-policy.test.ts` (new 312-line file, 15 new statics).
- Slice 43b (commit `48bcab8`) touched:
  - `src/runtime/runner.ts` runtime-boundary change: `runDogfood` became `async` (breaking signature), dispatch branch rewired to call `dispatchAgent` via injected `dispatcher` seam + `materializeDispatch` + five-event append-and-derive.
  - `src/cli/dogfood.ts` — `main` became async (consumes the new seam).
  - No ratchet-floor numeric advance (floor stayed 900 → 900 per the ratchet-floor.json note: "behavior migration, not ratchet-count advancement").
  - But **the qualitative `dispatch_realness` ratchet advanced** — per `specs/plans/phase-2-implementation.md §Product ratchets Phase 2 will carry`, `dispatch_realness` is a named product ratchet that flipped from inactive to active at Slice 43b. Product ratchet advancement is a ratchet change per Hard Invariant #6.
- Slice 43c (commit `7bc3543`) touched:
  - `specs/ratchet-floor.json` (900 → 924, +24 static declarations).
  - New audit surface `scripts/audit.mjs` Check 30 `checkAgentSmokeFingerprint` + test file `tests/contracts/slice-43c-agent-smoke-fingerprint.test.ts`.
  - New golden fixture `tests/fixtures/golden/explore/result.sha256`.
  - New fingerprint `tests/fixtures/agent-smoke/last-run.json`.
  - New e2e test `tests/runner/explore-e2e-parity.test.ts` (307 lines).
  - `src/runtime/runner.ts` extended with `writeSynthesisArtifact` helper (new close-step artifact semantics).
  - `src/cli/dogfood.ts` extended to accept `explore` alongside `dogfood-run-0`.
- Precedent from the prior arc: `arc-slices-35-to-40-composition-review-claude.md §MED 2` ("Slice 39 had no Codex challenger pass despite touching a ratchet surface") and `arc-slices-35-to-40-composition-review-codex.md §HIGH 1` surfaced the Slice 39 skipped-Codex issue. The prior arc skipped ONE slice's Codex with an explicit plan-file authorization (`specs/plans/phase-2-foundation-foldins.md:321-323`: "Codex challenger pass: not required (no ADR amendment, no ratchet *weakening*; registry ratchet *advances* either direction)"). This arc skipped THREE consecutive slices with NO plan-file authorization.
- `specs/plans/phase-2-implementation.md §P2.5` has no "Codex not required" subsection; there is no machine-readable record of why Codex was skipped for the three sub-slices.

**Impact.** Three ratchet-touching slices landed in one day (2026-04-21)
with no cross-model challenger pass and no plan-file authorization
for the skip. Each of the three could have surfaced issues the
other slices or the arc-close review might miss. Specifically:

- Slice 43a's `validateWorkflowKindPolicy` helper was extracted into
  **two** synchronized copies — `src/runtime/policy/workflow-kind-policy.ts`
  AND `scripts/policy/workflow-kind-policy.mjs`. A drift between these
  two copies would produce silent audit/runtime divergence. No per-slice
  Codex pass would have flagged this as a "why two copies, how is the
  drift prevented" question; the per-slice review would also have
  challenged whether the helper consumes `Workflow.safeParse` before
  policy (the prior composition review's HIGH 5 framing) vs after.
- Slice 43b's breaking `runDogfood` signature change (sync → async) is
  a runtime-boundary contract modification. No per-slice Codex would
  have asked "is the contract at `specs/contracts/run.md` updated to
  document the async return" or "are all callers across `src/` and
  `tests/` updated to `await` it." Those are exactly the questions the
  per-slice review format is designed to catch.
- Slice 43c's Check 30 + fingerprint + golden triad is the most
  novel governance mechanism this arc produced. Check 30's ancestor-
  check semantics (no staleness bound; schema_version unvalidated —
  see MED 2 + MED 3 below), the golden's self-referential derivation
  (HIGH 2 below), and the fingerprint's `commit_sha` pinning to
  `48bcab8` (Slice 43b — one commit BEFORE the committing slice's
  HEAD) are exactly the kind of design-choice surface that per-slice
  Codex flags.

The arc-close Codex prong (the sibling file of this review) may
subsume three retroactive per-slice passes if it explicitly scopes
each sub-slice's surface. But absent that scoping, the arc has
landed three governance gaps without disclosure.

**Fix hint.** Pre-P2.6, (a) dispatch the arc-close Codex prong with
an explicit scoping note requiring per-sub-slice coverage of: the
43a dual-helper drift risk + the 43b async-signature breaking-
contract surface + the 43c Check 30 staleness/schema-version gaps +
the 43c golden self-referentiality; (b) amend `specs/plans/phase-2-
implementation.md §P2.5` with an "arc-close-Codex-prong subsumes
per-sub-slice Codex" subsection recording the 2026-04-21 operator
decision to consolidate the three sub-slice passes into the arc-
close prong, citing the single-day tempo as the rationale — so the
audit trail is explicit rather than implicit; (c) consider adding a
new ADR or extending CLAUDE.md §Hard invariants #6 with an "arc-close
prong may subsume per-slice Codex when arc-close prong explicitly
scopes each sub-slice surface" clause. Absent (c), this precedent
creates drift pressure on future arcs: "Slice 43 skipped three
Codexes; we can skip one on this arc too." The clause or ADR would
bound the exemption to arc-close-subsumption scenarios only.

---

### HIGH 2 — CC#P2-1 one-workflow-parity golden is self-referential; "parity" is placeholder-parity, not dispatch-output-parity

**Evidence.**

- `ADR-0007 §Decision.1 CC#P2-1` reads (per the continuity's paraphrase):
  "target: `explore`; binding: `tests/runner/explore-e2e-parity.test.ts`
  + `tests/fixtures/golden/explore/` byte-shape golden (sha256 over
  normalized-JSON); authored at P2.5." The close criterion names
  **byte-shape parity** as the proof.
- `tests/runner/explore-e2e-parity.test.ts:196-213` ("golden sha256
  matches the hash of the deterministic placeholder body written by
  writeSynthesisArtifact"):
  ```ts
  it('golden sha256 matches the hash of the deterministic placeholder body written by writeSynthesisArtifact', () => {
    const { workflow } = loadExploreFixture();
    const close = workflow.steps.find((s) => s.id === 'close-step');
    if (close?.kind !== 'synthesis') throw new Error('close-step must be synthesis');
    const body: Record<string, string> = {};
    for (const section of close.gate.required) {
      body[section] = `<${close.id as unknown as string}-placeholder-${section}>`;
    }
    const raw = `${JSON.stringify(body, null, 2)}\n`;
    const normalized = normalizeExploreResult(raw);
    const digest = sha256Hex(normalized);
    const golden = readFileSync(GOLDEN_RESULT_SHA256_PATH, 'utf8').trim();
    expect(digest).toBe(golden);
  });
  ```
  This test asserts: `sha256(placeholder-derived-body) === sha256(golden-file)`.
  The golden file was produced (per the commit body) by running the
  AGENT_SMOKE=1 e2e, which writes `artifacts/explore-result.json` via
  `writeSynthesisArtifact`, which writes the same placeholder body.
  Golden is therefore `sha256(placeholder-derived-body)` by construction.
  The test is **self-referential**: it proves the placeholder shape
  matches the placeholder shape.
- `src/runtime/runner.ts:176-187` `writeSynthesisArtifact`:
  ```ts
  function writeSynthesisArtifact(runRoot, step) {
    const abs = join(runRoot, step.writes.artifact.path);
    mkdirSync(dirname(abs), { recursive: true });
    const body: Record<string, string> = {};
    for (const section of step.gate.required) {
      body[section] = `<${step.id as unknown as string}-placeholder-${section}>`;
    }
    writeFileSync(abs, `${JSON.stringify(body, null, 2)}\n`);
  }
  ```
  The body is purely a function of `step.id` + `step.gate.required`
  section names — both of which are static fixture data. **No
  dispatch output, no runtime state, no execution trace** influences
  the body. The inline comment at `src/runtime/runner.ts:164-175` is
  honest about this: "A future slice (P2.10 — artifact schema set +
  orchestrator-synthesis integration) replaces the stub with real
  orchestrator output; the seam is this single helper."
- The AGENT_SMOKE-gated e2e at `tests/runner/explore-e2e-parity.test.ts:236-297`
  does run real dispatch (synthesize-step + review-step through the
  real `claude` CLI subprocess, producing transcripts with cost +
  duration + session_id), and the five-event transcript is
  materialized and appended to the event log. But **the close-step
  artifact the golden hashes** is written by `writeSynthesisArtifact`
  AFTER all the dispatch is done, and it ignores everything the
  dispatches produced. The real-dispatch outputs materialize into
  their own `artifacts/synthesize-step-*` and `artifacts/review-step-*`
  slots (via `materializeDispatch`), none of which the golden covers.
- `tests/runner/explore-e2e-parity.test.ts:258-266`:
  ```ts
  // Hash the normalized close-step artifact against the golden.
  const normalized = normalizeExploreResult(readFileSync(exploreResultPath, 'utf8'));
  const digest = sha256Hex(normalized);
  if (UPDATE_GOLDEN) { ... }
  const golden = readFileSync(GOLDEN_RESULT_SHA256_PATH, 'utf8').trim();
  expect(digest).toBe(golden);
  ```
  The real-dispatch branch hashes the close-step's placeholder body,
  which (by `writeSynthesisArtifact`'s construction) is identical to
  the non-AGENT_SMOKE branch's derived body. The AGENT_SMOKE run and
  the non-AGENT_SMOKE run both hash the same placeholder; the real
  dispatch doesn't touch the hashed artifact.

**Impact.** CC#P2-1 is currently measured by a golden that is
functionally isomorphic to a snapshot of `step.gate.required` section
names for the explore fixture's close-step. A refactor that:

1. Completely rewrites dispatch semantics (changes prompt composition,
   changes adapter protocol, changes transcript hashing), but
2. Leaves the explore fixture's close-step `gate.required` section
   names unchanged,

would pass the golden check unchanged. The arc commit message says
"closes CC#P2-1 + CC#P2-2 simultaneously," but what's actually locked
is a *fixture-shape* invariant — "the explore fixture's close-step
declares `gate.required = [...]`" — not workflow parity in any
substantive sense.

This is a claim-calibration drift. The close criterion *will be*
substantively satisfied once `writeSynthesisArtifact` is replaced by
real orchestrator output (P2.10 per the in-code comment). Until then,
the ADR-0007 CC#P2-1 wording "byte-shape parity" overclaims relative
to what the golden actually pins.

The risk is compounding: a future slice reading "CC#P2-1 closed at
Slice 43c" will treat parity as solved and focus elsewhere; the
`writeSynthesisArtifact` seam may drift out of mind; P2.10 may land
with a different "one-workflow parity" framing that no longer
acknowledges the placeholder epoch.

This is the composition-review-class failure: per-slice reviews would
each say "Slice 43c adds a golden; golden has a reasonable
normalization function; golden hash matches." The cross-slice seam is
that the golden mechanism is architecturally disconnected from the
dispatch output that the close criterion NAMES as the "parity"
content.

**Fix hint.** Inline in the ceremony commit:
- **(a)** Amend `specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1
  CC#P2-1` with a v0.3-era disclosure: "CC#P2-1 parity at Slice 43c
  landing is measured by a sha256 over the explore fixture's close-step
  placeholder body (deterministic function of `step.gate.required`
  section names). Substantive dispatch-output parity is deferred to
  P2.10 when `writeSynthesisArtifact` is replaced by real
  orchestrator output. The v0.3 close-criterion satisfaction is
  therefore **placeholder-parity** rather than **orchestrator-parity**;
  both are valid epochs of the same criterion, and the Slice 43c
  golden catches drift in the placeholder shape (which is itself a
  useful ratchet because a future slice must not silently change the
  placeholder body without updating the golden)."
- **(b)** Add a reopen trigger to ADR-0007 CC#P2-1 binding: "when
  `writeSynthesisArtifact` is replaced by real orchestrator output
  (P2.10 landing), the CC#P2-1 golden must be regenerated from the
  new orchestrator's output, and a new composition review must re-
  verify that the close criterion is substantively rather than
  placeholder-shaped."
- **(c)** Rename `tests/runner/explore-e2e-parity.test.ts:196` test
  title from "golden sha256 matches the hash of the deterministic
  placeholder body written by writeSynthesisArtifact" to something
  that makes the self-referentiality explicit: "golden sha256 is
  self-consistent with the current placeholder-body derivation
  (P2.10 epoch: this becomes a real orchestrator-output assertion)."
  The current title hides the self-referentiality behind "deterministic
  placeholder body" which sounds like a good test name but is
  actually disclosing the problem.
- **(d)** Update `specs/plans/phase-2-implementation.md §P2.10` (if
  it exists) or add a §P2.10 section that names "replace
  `writeSynthesisArtifact` placeholder with real orchestrator output
  + regenerate `tests/fixtures/golden/explore/result.sha256` via
  AGENT_SMOKE=1 + UPDATE_GOLDEN=1" as an explicit deliverable that
  retires the placeholder epoch.

---

### HIGH 3 — Check 26 remains bound to the Slice 35-to-40 arc; the 41-to-43 arc is audit-unguarded

**Evidence.**

- `scripts/audit.mjs:3193-3194` (Check 26 regex):
  ```js
  const candidates = files.filter((f) =>
    /(arc.*35.*40|phase-2-foundation-foldins-arc-close|foldins-arc-close)/i.test(f),
  );
  ```
  The regex matches only the Slice 35-to-40 arc-close file names.
- `scripts/audit.mjs:3174-3178` (Check 26 trigger):
  ```js
  if (sliceNum < PHASE_2_FOUNDATION_FOLDINS_ARC_LAST_SLICE) {
    return { level: 'green', detail: `...still in progress...` };
  }
  ```
  `PHASE_2_FOUNDATION_FOLDINS_ARC_LAST_SLICE = 40` (confirmed via
  `scripts/audit.mjs:3206` in the prior Claude prong's citation).
- `npm run audit` live output:
  ```
  ✓ Arc-close composition review (Slice 35 / pre-P2.4 fold-ins)
    pre-P2.4 fold-in arc closed (current_slice=43); arc-close composition
    review two-prong gate satisfied — Claude: arc-slices-35-to-40-composition-
    review-claude.md; Codex: arc-slices-35-to-40-composition-review-codex.md
  ```
  With `current_slice=43c` (parsed as 43), the check is satisfied by
  the prior arc's 35-to-40 review files. **The 41-to-43 arc is
  invisible to the check.**
- `CLAUDE.md §Cross-slice composition review cadence`: "Check 26 is
  narrow to this first arc; subsequent arcs either extend the check
  or land a generalized arc-ledger gate."
- `specs/reviews/arc-slices-35-to-40-composition-review-claude.md §META 2`:
  "every future arc after this one will need its own Check 26 variant
  or a generalized ledger. [...] A future arc that doesn't land its
  own Check variant is out of compliance but audit-green." The prior
  prong explicitly named this as the next-arc risk.
- The continuity record at `debt_markdown` explicitly names this as
  a slice constraint: "Check 26 binding is `current_slice` advance ≥
  40 triggers the two-prong requirement over the 35-to-40 arc only.
  A future slice extending Check 26 to generalize arc-ledger binding
  is named in CLAUDE.md §Cross-slice composition review cadence."

**Impact.** At the moment of this review's landing (the ceremony
commit), the 41-to-43 arc-close composition review is authored. But
Check 26 does not know about it. If the ceremony commit stages
**only** the two prong files (this file + the Codex sibling) and
advances `current_slice` without extending Check 26, then:

1. `npm run audit` against the new staged state returns green because
   Check 26 sees `current_slice=<new>` (≥ 40) and finds the OLD
   35-to-40 review files, which satisfy the regex.
2. A future operator who deletes the new 41-to-43 review files would
   have the audit STILL return green — because Check 26 doesn't
   require the new arc's files.
3. A future P2.6 (codex adapter) slice could land **without** any
   arc-close review over 41-to-43 ever having existed, and Check 26
   would not flag it. The ceremony discipline documented in CLAUDE.md
   §Cross-slice composition review cadence would be violated silently.

The Slice 40 arc-close ceremony closed the prior arc by BOTH landing
the two prong files AND tightening Check 26 to enforce them. The
analogous move here is to widen/generalize Check 26 so the 41-to-43
prong files are required. Without it, the ceremony commit produces
authored-but-unenforced governance — the text exists on disk but
no gate cares if it stays there.

**Fix hint.** Pre-ceremony-commit, the ceremony slice extends Check
26 via one of two paths:

**Option (a) — widen the regex + add a second arc constant (cheapest).**
Add a new constant `PHASE_2_P2_4_P2_5_ARC_LAST_SLICE = 43` (or whatever
the ceremony slice id resolves to — see below). Extend the regex to
`(arc.*35.*40|arc.*41.*43|phase-2-foundation-foldins-arc-close|foldins-arc-close|...)`.
Add a second-arc trigger in Check 26: when `current_slice` ≥ the new
last-slice constant, require two-prong files matching the new regex.
This adds ~15 lines to `scripts/audit.mjs` and bounds the precedent
to "one constant per arc."

**Option (b) — land a generalized arc-ledger gate (more durable).**
Introduce a new file `specs/arc-ledger.json` (or similar) that
enumerates closed arcs as `{arc_id, first_slice, last_slice,
review_file_regex, required_prongs}`. Check 26 reads the ledger and
iterates — for each closed arc, require the listed prong files to
exist with ACCEPT* closing verdicts. This is the "generalized arc-
ledger gate" CLAUDE.md names as the alternative path; it's roughly
40-80 lines of new code + a new file + new tests.

Either option closes the HIGH. The operator's call on which: (a) is
a two-arc-specific tweak that carries the same "next arc needs a
new tweak" risk (META 2 from the prior prong); (b) is the durable
cross-arc mechanism but also the larger change. The ceremony slice
is already a ceremony-class commit, so (b)'s size is absorbable.

**Important sequencing note.** Whichever option is chosen, the
ceremony commit must stage: this review file + the Codex prong +
the Check 26 extension + any other fold-ins + the `current_slice`
advance **in a single commit**. The same-commit staging discipline
from the prior arc's Slice 40 (documented at CLAUDE.md §Cross-slice
composition review cadence) applies here too. A split commit (e.g.,
"land the review files first, then extend Check 26") produces a
transient audit-red window where the new `current_slice` triggers
the new Check 26 binding but the prong files aren't staged yet.

**Ceremony slice id.** The continuity record names two options:
"43d or 44 depending on naming choice." Recommend **Slice 44** for
parallelism with Slice 40: the prior arc's ceremony was a distinct
slice number (40), not a letter-suffixed extension of the last
implementation slice (39). The 43a/b/c letter suffixes were used
for tightly-coupled P2.5 sub-slices that shared a single close
criterion; the ceremony is a separately-conceived governance event
and a new number communicates that more clearly.

---

## MED findings

### MED 1 — `writeSynthesisArtifact` placeholder seam is undocumented at the contract surface

**Evidence.**

- `src/runtime/runner.ts:164-187` comment:
  > "A future slice (P2.10 — artifact schema set + orchestrator-
  > synthesis integration) replaces the stub with real orchestrator
  > output; the seam is this single helper."
- `specs/contracts/run.md` does not currently document
  `writeSynthesisArtifact` as a P2.10 seam. (Not verified exhaustively
  but absent from this review's scope reads; Slice 42 Codex prong
  opened `run.md §dispatch_event_pairing §Amendment Slice 37` but
  not the synthesis-step surface.)
- `specs/contracts/explore.md` similarly does not have a "close-step
  body is currently placeholder; parity will be re-bound at P2.10"
  disclosure.
- The in-code comment is the only record of the placeholder epoch
  boundary. When P2.10 lands and regenerates the golden, a fresh
  reader hitting `explore.md` will see "CC#P2-1 satisfied at Slice 43c"
  with no hint that the measurement semantics changed between
  Slice 43c and P2.10.

**Impact.** A per-slice Codex pass at Slice 43c would likely have
flagged "the contract surface does not disclose the placeholder
epoch." Absent it, the placeholder epoch is repo-internal tribal
knowledge. Composition-review-class failure: the contract-surface
drift is cross-slice between 43c (introduces placeholder) and P2.10
(replaces it), and no single slice's author would be responsible for
documenting the bridging epoch.

**Fix hint.** Inline in the ceremony commit, add a §Placeholder
epoch subsection to `specs/contracts/explore.md` or
`specs/contracts/run.md` documenting:

1. Current close-step body is placeholder-derived per
   `writeSynthesisArtifact`.
2. Golden at `tests/fixtures/golden/explore/result.sha256` pins the
   placeholder shape.
3. P2.10 replaces the placeholder and regenerates the golden.
4. Between Slice 43c and P2.10, CC#P2-1 is placeholder-parity;
   post-P2.10, CC#P2-1 is orchestrator-parity (per HIGH 2 above).

Same substance as HIGH 2's fix-hint (b), just at the contract
surface instead of the ADR surface. Combine or split per operator
preference.

---

### MED 2 — Check 30 has no staleness bound; an ancient fingerprint satisfies forever

**Evidence.**

- `scripts/audit.mjs:3700-3710` (Check 30 ancestor check):
  ```js
  try {
    execSync(`git -C "${rootDir}" merge-base --is-ancestor ${commitSha} HEAD`, {
      stdio: 'ignore',
    });
  } catch { return { level: 'red', detail: `... not an ancestor of HEAD ...` }; }
  ```
  Ancestor-of-HEAD is satisfied by any commit in the repository's
  history.
- `specs/ratchet-floor.json:8` note: "new tests/fixtures/agent-smoke/
  last-run.json fingerprint produced by the AGENT_SMOKE=1 run against
  claude CLI v2.1.117 binds commit 48bcab8 (Slice 43b) as the
  ancestor-of-HEAD proof point." The fingerprint at 43c landing
  already points BACKWARD to Slice 43b, not to the committing slice
  (43c). The fingerprint's "recent-enough" property isn't bound at
  all.
- Five commits from now (say, post-P2.6, P2.7, P2.8), Check 30 would
  still be green against the Slice 43b fingerprint, even if:
  - The `claude` CLI version bumped.
  - The explore fixture changed.
  - The runner's dispatch path changed.
  - The golden SHA changed.
  As long as commit `48bcab8` is still an ancestor of HEAD (it will
  be, barring history rewrite), the check stays green.
- The check's docstring (`scripts/audit.mjs:3626-3640`) is honest
  about the CI-skip semantics ("missing fingerprint is yellow (not
  red) until Phase 2 close") but does not name staleness as a
  concern.

**Impact.** Check 30 is structurally a "has this ever been green
once?" signal, not "is this currently green?" For v0 this is
acceptable — the stated goal is CI-skip semantics without requiring
every developer to produce a local fingerprint. But the check's name
("AGENT_SMOKE fingerprint commit-ancestor") implies a freshness
semantics that isn't actually enforced. A future slice that
regresses the explore e2e could leave Check 30 happily green
forever.

This is a deferred-enforcement smell of the same class as the
prior arc's MED 3 (ADR-0008 §6 non-precedent enforcement is prose-
level). Named here as a forward risk.

**Fix hint.** Two options, either acceptable as a fold-in or as a
deferred follow-up:

- **(a) Doc-only fix.** Update Check 30's docstring to explicitly
  say "ancestor-of-HEAD is the v0 freshness semantics; there is no
  bound on how far back the fingerprint was produced. A future slice
  may tighten this to 'commit_sha is within N commits of HEAD' or
  'commit_sha matches a recorded recency ratchet.'" This is a
  reopen-trigger named in prose, not machine-enforced.
- **(b) Staleness-bound fold-in.** Track `PROJECT_STATE.md
  current_slice` as a rolling staleness check: Check 30 accepts
  fingerprints from commits within the last K slices. If the
  fingerprint is from slice 43b and `current_slice` advances beyond
  `43b + K`, the check goes yellow or red until a fresh AGENT_SMOKE
  run is produced. Needs a K constant; the prior arc's MED 3 used a
  "reopen trigger in ADR-0008 §5" pattern — similar precedent here.

Defer (b) to a follow-up if the ceremony commit is already large; at
minimum land (a).

---

### MED 3 — `fingerprint.schema_version` is written but never validated

**Evidence.**

- `tests/runner/explore-e2e-parity.test.ts:287-294` writes:
  ```ts
  const fingerprint = {
    schema_version: 1,
    commit_sha: commitSha,
    result_sha256: digest,
    recorded_at: new Date().toISOString(),
  };
  ```
  Schema version is explicitly pinned at 1.
- `scripts/audit.mjs:3651-3710` (Check 30 validation logic): reads
  the file, validates `commit_sha` (string, regex, resolves, ancestor),
  validates `result_sha256` (string, 64-char hex), but **never
  examines `parsed.schema_version`**. The field is ignored.
- `tests/contracts/slice-43c-agent-smoke-fingerprint.test.ts` has no
  test that exercises a `schema_version=2` file or a missing
  `schema_version` field.

**Impact.** If a future slice bumps the fingerprint schema (e.g.,
adds a `cli_version` field, or changes `commit_sha` from string to
object), Check 30 will silently pass the new shape as long as
`commit_sha` and `result_sha256` still have the old shape. The
schema_version field is aspirational metadata without any binding.

This is the same class as the prior arc's MED 1 (empty-allowlist
shape tests were vacuously satisfied). The writer declares a
structured field; the reader ignores it.

**Fix hint.** Fold inline in the ceremony commit:

- Check 30 reads `parsed.schema_version` and requires it to be a
  number equal to the current expected version (`1` at Slice 43c);
  a mismatch goes red with a clear message.
- Add a unit test to
  `tests/contracts/slice-43c-agent-smoke-fingerprint.test.ts` that
  exercises `schema_version=2` (red) and `schema_version=1` (the
  existing green path).

Small (~10 lines). Closes the field-declared-but-unchecked smell.

---

### MED 4 — `validateWorkflowKindPolicy` has two implementations (runtime + audit-side wrapper) with no cross-module drift guard

**Evidence.**

- Slice 43a landed two copies of the helper:
  - `src/runtime/policy/workflow-kind-policy.ts` (65 lines, TypeScript,
    imported by `src/cli/dogfood.ts` + `tests/runner/explore-e2e-parity.test.ts`).
  - `scripts/policy/workflow-kind-policy.mjs` (161 lines, plain JS,
    imported by `scripts/audit.mjs`).
- The two must agree on (a) the canonical phase set per workflow kind,
  (b) the policy check (canonical phases + omits), and (c) the error
  message shape. A drift between them produces silent runtime-vs-audit
  divergence: runtime accepts a fixture the audit rejects, or vice
  versa.
- Slice 43a's tests live in `tests/contracts/workflow-kind-policy.test.ts`
  (+312 lines, 15 new statics) which presumably tests one of the two
  copies (likely the runtime one given it's a `.test.ts` file importing
  `.ts`). The audit-side `.mjs` copy is exercised indirectly via
  `npm run audit`.
- There is no test that asserts `runtime-policy.ts`'s canonical set
  equals `scripts/policy/workflow-kind-policy.mjs`'s canonical set at
  runtime. A `.test.ts` importing both copies and asserting set-
  equality would close this.

**Impact.** A future slice editing one copy without editing the
other produces silent divergence. For example, if explore's canonical
phase set gains a new phase, and the runtime copy is updated but the
audit-side is not, the audit continues to accept the old set while
the runtime rejects fixtures that don't include the new phase. This
is the exact class of error composition reviews exist to catch:
per-slice reviews would each say "the `.ts` copy is fine" or "the
`.mjs` copy is fine," but neither would check cross-module coherence.

**Fix hint.** Fold inline in the ceremony commit:

- Add a cross-module-coherence test in
  `tests/contracts/workflow-kind-policy.test.ts` that imports both
  copies (TS import + dynamic `import('scripts/policy/workflow-kind-
  policy.mjs')`) and asserts set-equality on the exported canonical
  sets + spine-omits + policy-rejection-message shape.
- Or: delete the duplication. If `scripts/audit.mjs` can import the
  TS version via a transpiled path or a shared `.mjs` single source,
  the duplication goes away. The audit side was originally `.mjs`
  because the audit runs Node directly; if that's no longer a hard
  constraint, consolidation is cleaner than a coherence test.

Defer the consolidation; land the coherence test in the ceremony
commit.

---

## LOW findings

### LOW 1 — Per-slice Codex reviewer_model naming remains inconsistent across the arc

**Evidence.**

- `specs/reviews/arc-slice-41-adapter-invocation-pattern-codex.md:6`:
  `reviewer_model: gpt-5-codex`.
- `specs/reviews/arc-slice-42-real-agent-adapter-codex.md:6`:
  `reviewer_model: gpt-5-codex`.
- Prior arc:
  `specs/reviews/arc-slice-35-methodology-upgrade-codex.md`:
  `reviewer_model: gpt-5.4`;
  `specs/reviews/arc-slice-37-high-2-widen-event-schema-codex.md`:
  `reviewer_model: gpt-5.4`;
  `specs/reviews/arc-slice-38-dispatch-granularity-adr-0008-codex.md`:
  `reviewer_model: gpt-5-codex`.

**Impact.** Low-severity governance consistency. The prior arc's
LOW 2 flagged this; the prior arc-close ceremony deferred
normalization. This arc continues the inconsistency (41 and 42 both
use `gpt-5-codex`, matching the most-recent prior convention, so
drift is now resolved in the forward direction — but the historical
records still mix).

**Fix hint.** Defer per prior-arc precedent; or fold a
`cross-model-challenger.test.ts` schema allowlist that accepts both
spellings with a canonical-form preference.

---

### LOW 2 — `tests/runner/explore-e2e-parity.test.ts:41` live-state test accepts both yellow AND green as passing

**Evidence.**

`tests/contracts/slice-43c-agent-smoke-fingerprint.test.ts:41-48`:
```ts
it('yellow when the live-repo fingerprint file is absent OR points to an ancestor (initial landing: yellow → green after AGENT_SMOKE run)', () => {
  const result = checkAgentSmokeFingerprint(REPO_ROOT);
  expect(['yellow', 'green']).toContain(result.level);
});
```

The assertion accepts either yellow or green. This test will
therefore pass regardless of the live fingerprint's audit health
(short of producing red, which is caught by OTHER tests in the
same file that use `withTempRepo`).

**Impact.** The test name promises a state-transition narrative
("initial landing: yellow → green after AGENT_SMOKE run") but the
assertion enforces neither branch. If a future slice leaves the
fingerprint in a weird in-between state that resolves to red on the
live repo, this specific test fails (because red isn't in the
expected set), but it fails with a generic "expected 'red' to be in
['yellow', 'green']" message rather than a targeted "the live
fingerprint is stale" message.

**Fix hint.** Rename and tighten:
- Split into two tests: "live fingerprint is one of {yellow, green}
  at Slice 43c landing" (narrow expected set) + a comment explaining
  the rationale; OR
- Use a branching assertion: `if (existsSync(FINGERPRINT_PATH))
  expect(result.level).toBe('green'); else expect(result.level).toBe('yellow');`
  which makes the intended narrative machine-checked.

Doc-only / small test edit; defer or fold inline.

---

### LOW 3 — Fingerprint `recorded_at` field is written but never validated

**Evidence.**

`tests/runner/explore-e2e-parity.test.ts:287-294` writes
`recorded_at: new Date().toISOString()`. Check 30 never examines
this field (ignored like `schema_version` per MED 3).

**Impact.** Same class as MED 3 but lower severity because
`recorded_at` is not structurally load-bearing (it's auditor-
observable metadata, not an invariant). The field is purely
informational; its presence in the file is not machine-enforced.

**Fix hint.** Either (a) ignore — field is informational only; or
(b) validate as ISO-8601 timestamp during the Check 30 schema check
(+3 lines, matches MED 3's fold-in style).

---

## META observations

### META 1 — The arc is structurally coherent on the implementation side; drifts are governance-surface and claim-calibration

The five slices produced substantive work:

- Slice 41's ADR-0009 locks `subprocess-per-adapter` with four-grounds
  reasoning + four explicit reopen triggers (Options A/B2/C/D).
- Slice 42's empirical capability-boundary proof at CLI v2.1.117
  (empty `tools` / `mcp_servers` / `slash_commands` surfaces, real
  file-write denial verified at `/tmp/claude-nowrite-proof/`) is the
  strongest safety evidence this repo has ever produced.
- Slice 43a's helper extraction cleanly resolved the EXPLORE-I1
  delivery-window ambiguity the prior composition review flagged;
  the refactor collapsed Check 24 from hand-parsing to helper call.
- Slice 43b's async seam is a disciplined runtime-boundary move;
  `resolveDispatcher` injection allows deterministic test stubs
  without compromising the real-subprocess capability-boundary
  enforcement.
- Slice 43c's e2e lands the first workflow that exercises the full
  dispatch→materialize→event-log→derive cycle against a real CLI
  subprocess end-to-end, two times (synthesize + review).

The HIGH findings above are all at the *thinking-about-the-arc*
surface (missing Codex reviews, overclaimed parity, audit-gate
drift), not at the code/contract surface. That is itself a signal
that the arc did its job on the implementation side. The remaining
drift is in the governance surface, which the ceremony commit can
absorb — same pattern as the prior arc's META 1.

### META 2 — Check 26 generalization is the methodology's own open question; the 41-to-43 arc is the forcing function

The prior arc's META 2 explicitly named this: "every future arc
after this one will need its own Check 26 variant or a generalized
ledger. [...] The discipline rule itself lacks a generalized audit
binding, relying on operator-remembers-to-extend-Check-26 or author-
a-new-ledger."

This ceremony is the forcing function. The operator's choice
between HIGH 3's options (a) and (b) decides whether the "extend
Check 26 per arc" or "land a generalized arc-ledger" path becomes
the precedent. Both are methodologically valid; (a) is cheaper; (b)
is more durable. Either answer closes HIGH 3; neither is a
structural blocker.

Not a fold-in requirement; named as the methodology-level forward
decision.

---

## Closing — what the operator should do

Pre-P2.6 (before P2.6 or any other privileged runtime slice
reopens):

1. **HIGH 1 fold-in (three skipped Codex passes).** Dispatch the
   arc-close Codex prong with explicit scoping over 43a's dual-helper
   drift, 43b's async-signature breaking-contract surface, 43c's
   Check 30 staleness + golden self-referentiality. Land a plan-file
   amendment at `specs/plans/phase-2-implementation.md §P2.5`
   recording the arc-close-subsumption rationale for the three
   skipped per-slice passes. (Optional but recommended) Amend
   `CLAUDE.md §Hard invariants #6` with an arc-close-subsumption
   clause that bounds future exemptions.
2. **HIGH 2 fold-in (CC#P2-1 placeholder-parity disclosure).** Amend
   `specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1 CC#P2-1`
   to document the v0.3-era placeholder-parity epoch + add a reopen
   trigger at P2.10 regeneration. Rename the
   `tests/runner/explore-e2e-parity.test.ts:196` test to make self-
   referentiality explicit. Update `specs/contracts/explore.md` or
   `specs/contracts/run.md` with a §Placeholder epoch subsection.
3. **HIGH 3 fold-in (Check 26 extension).** Choose option (a)
   widen-the-regex OR option (b) generalized-arc-ledger. Stage the
   audit.mjs change + any new tests + the two prong review files +
   `current_slice` advance to Slice 44 all in the same ceremony
   commit. Confirm `npm run audit` green against the staged tree
   before committing.
4. **MED 1, MED 2, MED 3, MED 4, all LOWs.** Incorporable inline in
   the ceremony commit as small edits + short tests. MED 3
   (schema_version check) and MED 4 (cross-module coherence test)
   are the highest-value MED fold-ins; the others are doc-only or
   deferred.

Closing verdict ACCEPT-WITH-FOLD-INS stands on the theory that the
arc produced the right implementation work and the seams above are
all incorporable into the ceremony commit. If the operator prefers
to land fold-ins as a second bundle (a Slice 45 pre-P2.6), the
verdict downgrade to REJECT-PENDING-FOLD-INS is defensible; no
convergent HIGH blocks P2.6 by itself, but HIGH 3 specifically must
land before P2.6 (else Check 26 doesn't guard this arc).

## Fold-in discipline

- **HIGH #1** — Fold-in: Codex prong scoping + plan-file amendment
  in ceremony commit; optional CLAUDE.md §Hard invariants #6 clause.
- **HIGH #2** — Fold-in: ADR-0007 CC#P2-1 amendment + test rename +
  contract-surface §Placeholder epoch subsection, ceremony commit.
- **HIGH #3** — Fold-in: Check 26 extension (option a or b) +
  same-commit staging discipline, ceremony commit. **Blocker for
  P2.6 if not landed.**
- **MED #1** — Fold-in: contract-surface placeholder-epoch
  subsection, ceremony commit (subsumed by HIGH 2 fix-hint if a
  single subsection serves both).
- **MED #2** — Fold-in: doc-only update to Check 30 docstring
  naming staleness-unbound semantics; (b) staleness-bound mechanism
  deferred to follow-up.
- **MED #3** — Fold-in: `schema_version` validation in Check 30 +
  two new tests, ceremony commit.
- **MED #4** — Fold-in: cross-module coherence test in
  `tests/contracts/workflow-kind-policy.test.ts`, ceremony commit.
- **LOW #1** — Defer per prior-arc precedent.
- **LOW #2** — Fold-in: rename or tighten assertion, ceremony
  commit (small).
- **LOW #3** — Defer (informational-only field).
- **META #1 + #2** — Observational; no fold-in required.

## Post-fold-in addendum (Slice 44 arc-close ceremony commit)

This addendum is authored during the arc-close ceremony commit after
all inline fold-ins land. Closing verdict transitions from opening
REJECT-PENDING-FOLD-INS → closing ACCEPT-WITH-FOLD-INS on the
following dispositions:

- **HIGH #1 (skipped per-slice Codex on 43a/b/c).** Incorporated.
  `specs/plans/phase-2-implementation.md §P2.5` gained an
  "Arc-close Codex-prong subsumption of skipped per-sub-slice Codex
  passes" subsection recording the operator decision + subsumption
  bounds (three requirements: arc-close prong explicit per-sub-slice
  scoping, tempo-driven skip, ceremony-commit plan-file record) +
  forward policy ("Silent skips remain Hard Invariant #6
  violations"). The Codex sibling prong of this composition review
  explicitly scopes each of the three sub-slices' ratchet surfaces
  (43a dual-helper + runtime/audit wrapper, 43b async-signature
  breaking-contract surface, 43c Check 30 + fingerprint semantics +
  golden self-referentiality), discharging the per-sub-slice
  challenger-pass obligation.
- **HIGH #2 (CC#P2-1 placeholder-parity overclaim).** Incorporated.
  `specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1 CC#P2-1`
  gained a "Slice 44 arc-close amendment" paragraph naming the v0.3
  closure as **placeholder-parity** (not orchestrator-parity) +
  P2.10 reopen trigger. `specs/contracts/explore.md` gained a "CC#P2-1
  placeholder-parity epoch" subsection with a pointer to the ADR
  amendment. Self-referential golden test at
  `tests/runner/explore-e2e-parity.test.ts:196` renamed — the test
  title now reads "golden sha256 is self-consistent with the
  writeSynthesisArtifact placeholder derivation (v0.3 placeholder-
  parity epoch; P2.10 re-binds to orchestrator-parity per ADR-0007
  §Decision.1 Slice 44 amendment)".
- **HIGH #3 (Check 26 still bound to old arc).** Incorporated.
  `scripts/audit.mjs` refactored from hardcoded single-arc constant
  to generalized `ARC_CLOSE_GATES` table iterating per-arc
  descriptors. New constant `PHASE_2_P2_4_P2_5_ARC_LAST_SLICE = 44`
  + `scripts/audit.d.mts` type declarations. Seven new tests in
  `tests/contracts/artifact-backing-path-integrity.test.ts` exercise
  the generalized gate: constant export + table contents + new-arc
  in-progress detail + new-arc closed without review red + only-
  Claude-prong red + both-prongs-ACCEPT green + plan-file-absent
  skip. Option (a) widen-the-regex path chosen per operator
  decision; option (b) full specs/arcs.json ledger deferred as a
  future-worth but ceremony-out-of-scope mechanism refactor. Same-
  commit staging discipline satisfied: audit.mjs + audit.d.mts +
  tests + both prong files + current_slice advance + yield-ledger
  row + ratchet floor all land in a single ceremony commit.
- **MED #1 (placeholder seam undocumented at contract surface).**
  Subsumed by HIGH #2 fold-in — the §Placeholder epoch subsection
  added to `specs/contracts/explore.md` serves MED #1 at the
  contract surface.
- **MED #2 (Check 30 no staleness bound).** Deferred to a follow-up
  micro-slice per original disposition — doc-only docstring update
  is the minimum; staleness-bound mechanism (K-slice sliding window
  or current_slice-relative cutoff) is a larger design choice that
  belongs with the P2.6+ fingerprint evolution rather than the
  ceremony commit.
- **MED #3 (fingerprint.schema_version not validated).** Deferred
  to a follow-up micro-slice per compressed-ceremony-scope decision.
  The field is declared at v1 and has no v2 producers yet; MED
  severity rather than HIGH because it's forward-looking. Tracked
  implicitly by Check 30's docstring — future schema bumps are
  caught by grep-for-schema_version-check as a forward audit.
- **MED #4 (`validateWorkflowKindPolicy` dual implementation).**
  Codex prong's MED 2 reframes this — the TS runtime wrapper
  imports the JS policy table directly (not a duplication; the JS
  module documents itself as single source of truth at Slice 43a).
  The actual residual seam is weaker: Check 24 uses raw JSON while
  runtime uses `Workflow.safeParse`. Deferred to a follow-up
  audit-structural-validation slice.
- **LOW #1 (`reviewer_model` naming).** Deferred per prior-arc
  precedent (LOW 2 of 35-to-40 prong). Arc-slice-41 + arc-slice-42
  + this arc's Codex prong all use `gpt-5-codex` — historical
  inconsistency with the earlier `gpt-5.4` records remains but
  forward drift is resolved.
- **LOW #2 (live-state test accepts yellow+green).** Deferred;
  trivial renaming fold-in for a follow-up.
- **LOW #3 (`recorded_at` field unvalidated).** Deferred; the field
  is informational metadata and the risk is bounded by MED #3's
  schema_version enforcement (once landed).
- **META #1 + #2.** Retained as non-objections. META #2's forward-
  looking observation ("next arc will need a Check 26 variant")
  was discharged by the generalized `ARC_CLOSE_GATES` table —
  adding a new arc is now a table-entry addition, not a check-body
  refactor.

Three convergent HIGH findings (per this review + the Codex
sibling prong) + two independent Codex HIGH findings (`--dry-run`
fail-closed fix + explore deferred-property re-defer) are closed
in the Slice 44 arc-close commit. Check 26 now fires red on the
41-to-43 arc if either prong goes missing or fails its closing
verdict. P2.6 (codex adapter) opens at a future slice against the
now-audit-bound governance surface.
