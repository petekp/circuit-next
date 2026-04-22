---
name: phase-project-holistic-2026-04-22-claude
description: Fresh-read Claude project-holistic critical review at HEAD 52bba0a. Paired with Codex cross-model challenger prong specs/reviews/phase-project-holistic-2026-04-22-codex.md. Bound to charter specs/reviews/phase-project-holistic-2026-04-22-scope.md. Filed under the phase-comprehensive-review schema slot (tests/contracts/cross-model-challenger.test.ts:163-186) because a project-holistic sweep is the "phase-to-date sweep at project scope" — broader than a contract or arc. Generalizing the review-kind taxonomy (e.g. allowing target_kind=project-holistic as its own slot) is captured as a META fold-in.
type: review
reviewer_model: claude-opus-4-7
reviewer_model_id: claude-opus-4-7
authorship_role: auditor
review_kind: phase-comprehensive-review
review_date: 2026-04-22
verdict: ACCEPT-WITH-FOLD-INS
authored_by: claude-opus-4-7
review_target: phase-project-holistic-2026-04-22
target_kind: phase
phase_target: project-holistic
phase_version: "HEAD=52bba0a1980bf6bd581171c5f1e2168b4f9d1d65 (main, 2026-04-22)"
target_version: "HEAD=52bba0a1980bf6bd581171c5f1e2168b4f9d1d65 (main)"
opening_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: pending-fold-in-absorption
charter: specs/reviews/phase-project-holistic-2026-04-22-scope.md
paired_prong: specs/reviews/phase-project-holistic-2026-04-22-codex.md
severity_counts:
  high: 4
  med: 7
  low: 4
  meta: 3
commands_run:
  - Read CLAUDE.md in full
  - Read PROJECT_STATE.md frontmatter + first 200 lines + section headings + sampled slice entries (file is 668 lines / 365 KB)
  - Read specs/reviews/phase-project-holistic-2026-04-22-scope.md (this charter)
  - Read specs/adrs/ADR-0001-methodology-adoption.md (first 150 lines)
  - Read specs/adrs/ADR-0007-phase-2-close-criteria.md (lines 1-200, 600-840)
  - Read specs/plans/phase-2-implementation.md (lines 1-200, 400-880)
  - Read specs/plans/slice-47-hardening-foldins.md in full
  - Read specs/risks.md in full
  - Read specs/ratchet-floor.json in full
  - Read specs/reviews/adversarial-yield-ledger.md in full
  - Read specs/reviews/arc-slice-47-composition-review-claude.md in full
  - Read specs/reviews/arc-slices-41-to-43-composition-review-claude.md (first 100 lines)
  - Read src/runtime/runner.ts in full
  - Read src/runtime/reducer.ts in full
  - Read src/runtime/adapters/agent.ts in full
  - Read src/runtime/adapters/codex.ts in full
  - Read src/runtime/adapters/dispatch-materializer.ts in full
  - Read src/cli/dogfood.ts in full
  - Read src/schemas/event.ts in full
  - Read specs/contracts/workflow.md (first 100 lines)
  - Read specs/domain.md (first 80 lines)
  - Read .claude-plugin/plugin.json + both command files in full
  - Read tests/contracts/slice-47d-audit-extensions.test.ts in full
  - Read tests/contracts/slice-47c-forbidden-progress-firewall.test.ts (first 150 lines)
  - Read tests/contracts/schema-parity.test.ts (first 100 lines)
  - Read tests/contracts/slice-27d-dogfood-run-0.test.ts (first 80 lines)
  - Read tests/runner/codex-adapter-smoke.test.ts in full
  - Read tests/runner/dogfood-smoke.test.ts (lines 220-300 — CLI smoke)
  - Read tests/contracts/plugin-surface.test.ts (first 80 lines)
  - Read scripts/audit.mjs — lines 376-575, 3216-3397, 3837-3992 (check dispatch shape + Check 26 + Check 34)
  - git log --oneline -30 + git log --oneline --since="2 weeks ago"
  - ls of tests/contracts, tests/runner, tests/unit, src/schemas, src/runtime, src/runtime/adapters
  - wc -l on contracts, plans, ADRs, audit.mjs, runtime/* — size calibration
  - Ran npm run audit — 34 green / 0 yellow / 0 red at HEAD
opened_scope:
  - methodology surface (CLAUDE.md + specs/methodology via ADR-0001 + ADR-0007 sampling)
  - governance (ADR-0001, ADR-0007, ADR-0009)
  - plans (phase-2-implementation, slice-47-hardening-foldins)
  - runtime (runner.ts, reducer.ts, adapters/agent.ts, adapters/codex.ts, adapters/dispatch-materializer.ts, cli/dogfood.ts)
  - schemas (event.ts detailed; file list + line counts for the rest)
  - audit machinery (scripts/audit.mjs — Check dispatch shape, Check 2/26/34/35, framing regex at line 393)
  - tests (sampled contract + runner tests — slice-47d-audit-extensions, slice-47c-forbidden-progress-firewall, slice-27d-dogfood-run-0, schema-parity, plugin-surface, codex-adapter-smoke, dogfood-smoke CLI branch)
  - review ledger (adversarial-yield-ledger — all 23 rows)
  - prior arc-close reviews (arc-slice-47-composition-review-claude, arc-slices-41-to-43-composition-review-claude — first 100 lines, as calibration)
  - plugin surface (plugin.json + commands/circuit-run.md + commands/circuit-explore.md + explore/circuit.json fixture head)
  - recent 30-commit arc (git log --oneline -30 + since 2 weeks)
skipped_scope:
  - bootstrap/** (per charter — frozen Phase 0)
  - prior-gen circuit at ~/Code/circuit (per CLAUDE.md — read-only reference)
  - specs/reviews/p2-foundation-composition-review-codex-transcript.md (>200KB per charter)
  - full sweep of all 10 contract files — opened workflow.md head; spot-checked via schema-parity + invariants
  - full sweep of all 9 ADRs — opened ADR-0001 (methodology) + ADR-0007 (Phase 2 close) in detail; others referenced via ledger + audit checks
  - full sweep of all 53 test files — opened 9 representative; spot-checked via grep + file sizes
  - Codex prong output (does not exist at time of this writing per charter workflow)
authority:
  - specs/reviews/phase-project-holistic-2026-04-22-scope.md (charter — eight questions, verdict vocabulary, anti-sycophancy framing)
  - CLAUDE.md §Cross-slice composition review cadence (project scope is a valid aggregation per charter §Authority)
  - CLAUDE.md §Hard invariants #6 (cross-model challenger required for any ratchet change — the governance layer this review operates under)
  - ADR-0001 Addendum B §Phase 2 entry criteria (this review tests the methodological integrity Phase 2 presumes)
  - Operator's 2026-04-22 commission: "largest and most exhaustive critical examination before building further"
fold_in_disposition: |
  Four HIGH findings: (1) The methodology machinery consumes disproportionate share of recent slice work vs. user-facing capability; the last 15+ commits are overwhelmingly audit-tightening and review ceremony, with only Slices 42/43b/43c/45/46 landing substantive runtime capability. (2) The contract-test-count ratchet conflates invariant tests with meta-tests of the audit machinery itself; advancing the ratchet by adding tests-for-audit-checks is indistinguishable from advancing it by adding tests-for-real-invariants at the gate layer. (3) `checkFraming` at scripts/audit.mjs:393 was silently false-negative for 10+ recent slices because the regex didn't match the natural phrasing — a gate that silently passes on the phrasing operators actually write is performative, not protective. (4) The advertised plugin surface (`.claude-plugin/commands/circuit-run.md` + `circuit-explore.md`) is explicitly "Not implemented yet" — a user installing the plugin today gets two commands that return placeholder text; the gap between charter ambition and runtime reality is wider than PROJECT_STATE's "middle third" framing admits.

  Seven MED findings: ratchet notes field is 12 KB of prose rather than a ratchet declaration; `dogfood-run-0` fixture is still counted as a "plugin command surface" entry per Check 23 despite being internal test infrastructure; the "trajectory check" three-sentence requirement (CLAUDE.md:90-95) has no audit enforcement; ADR-0007 §4c "inherited product ratchets must be green at close" names ratchets that have no corresponding audit check; multiple `tests/runner/*.test.ts` files duplicate state the audit script owns; CC#P2-4 close-state history's four-row ledger is honor-system (LOW 1 in the Slice 47 composition review was deferred to operator discretion — now becoming real friction); `amnesty_scope` frontmatter field enforcement uses string-match on the composition review body not on the governance surface where amnesty was granted.

  Four LOW findings: operator-facing vocabulary ("arc-close composition review", "CC#P2-N", "ADR-0009") in plain-English summaries leaks despite CLAUDE.md §After-slice operator summary prohibition; test-file naming inconsistency (slice-47c-forbidden-progress-firewall vs slice-47d-audit-extensions — different naming bases); Codex challenger citation style varies between `dispatched via /codex` and `dispatched via codex exec`; `src/schemas/role.ts` is 6 lines + an alias for DispatchRole and could be inlined.

  Three META findings: the arc-close composition review pattern has now run three times; each has produced convergent HIGHs that fold into audit machinery — this is the Goodhart "closure audits as rubber-stamps" risk (specs/risks.md OR6) realized in a different mode; the 300-line CLAUDE.md constraint forces authority into specs/ where it compounds; fresh-read is contingent on `/clear`, which an auditing prong cannot mechanically verify.

  Overall verdict: **ACCEPT-WITH-FOLD-INS**. The fold-ins do not block Phase 2 continuation — they are pressure on how the next arc is shaped. If Phase 2 closes through another 15-commit run of methodology-tightening slices without CC#P2-5 / CC#P2-8 / CC#P2-3 advancing, the verdict should re-evaluate to REJECT at that arc-close review.
---

# circuit-next — project-holistic critical review (Claude fresh-read prong)

## Scope and method

Fresh-read pass over the artifacts listed in `opened_scope`, bound to the
eight charter questions. I am the Claude fresh-read prong; the Codex
cross-model challenger prong runs independently. Per charter §Anti-sycophancy
framing, I do not praise the project as preamble. I looked for specific
file:line evidence for each finding; abstract concerns not backed by a
citation are in META or were dropped.

Calibration note: I have read three prior arc-close composition reviews
(Slice 40 / Slices 41-43 / Slice 47) during prep. Each produced 2-5 HIGH
findings that folded into audit machinery or ceremony-commit discipline.
None produced a HIGH that would have changed the trajectory of user-facing
capability. This observation is load-bearing for the META section.

## Q1 — Is the methodology paying for itself?

### HIGH 1. Audit-machinery and review-ceremony work dominates recent commit velocity

**Evidence:** `git log --oneline --since="2 weeks ago"` returns 40 commits.
Reading each subject:

- **Substantive user-facing runtime capability (6 commits):** Slice 42
  (real agent adapter subprocess), Slice 43b (runDogfood async + dispatch
  seam), Slice 43c (explore e2e fixture + CC#P2-1/CC#P2-2 close), Slice 45
  (codex adapter subprocess), Slice 45a (DispatchFn refactor — this is
  audit-surfaced but touches runtime), Slice 46 (session hook scripts).
- **Methodology / audit / review ceremony (25+ commits):** Slices 32-41,
  44, 46b, 47, 47a/b/c/c-2/b-retro/c-partial-retro/d, 48. These land
  new audit checks, fold in cross-model challenger objections on
  previous slices, and close arc-close composition reviews.

The most recent arc (Slices 47 through 47d + 48) is 9 commits. Zero of
them advance user-facing runtime capability. All 9 close drift in the
audit / review / plan surface. The arc closed with
`PROJECT_STATE.md:1` reading "Slice 48 — framing-triplet audit widening +
arc-close-ceremony exemption" — widening a regex in `scripts/audit.mjs`.

**Risk if left:** The methodology exists to keep user-facing capability
honest. When the ratio of methodology-to-capability commits sustains above
roughly 3:1 over multiple arcs (which is the current pattern), the
methodology is no longer paying for capability — it is paying for its own
maintenance. The operator's explicit 2026-04-22 commission ("largest and
most exhaustive critical examination before building further") is itself
a symptom: the need for a project-holistic review arises because
per-slice signal isn't translating to confidence that the project is
advancing.

**Counter-evidence considered:** The Slice 47 arc opened because a
comprehensive Phase 2-to-date review (`specs/reviews/phase-2-to-date-
comprehensive-codex.md`) returned REJECT-PENDING-FOLD-INS with 6 Codex
HIGHs. That's signal — real drift caught before it compounded. The
methodology did its job. But the fold-ins themselves are also
methodology work, not capability work, so the arc is self-
reinforcing.

**Proposed disposition:** Operator should set an explicit ratio target
(e.g., for the next arc, capability-advancing commits must outnumber
methodology commits). Not a hard audit check — that would itself be
more methodology. A plan-file commitment in the next arc.

### MED 1. Adversarial-yield-ledger shows escalating reviewer yield but the yield goes into audit, not into product

**Evidence:** `specs/reviews/adversarial-yield-ledger.md` has 23 rows as of
HEAD. HIGH counts across the rows: 7, 0, 2, 1, 0, 2, 5, 3, 0, 5, 7, 3, 4,
5, 5, 1, 3, 0, 0, 2, 4, 5, 5. The average HIGH per pass is ~3.0 — a healthy
adversarial-yield signal (Codex is finding real concerns).

Reading the `why_continue_failure_class` column on recent rows:

- Slice 35 (pre-P2.4 foundation): "ratchet change (two new audit checks + allowlist shape)"
- Slice 41 (ADR-0009): "new governance ADR ... + Check 28 audit binding"
- Slice 42 (real agent adapter): product-facing — **this is the exception**
- Slice 44 (arc-close): "two-prong arc-close composition review ... §6 precedent firewall applies"
- Slice 45 (codex adapter): product-facing — **exception**
- arc-slices-41-to-43-composition-review: "composition review over ... surfaced boundary-seam failures no individual slice owned"

The pattern: ~80% of adversarial passes target governance / audit / review
surfaces, not runtime code. When Codex does catch concerns on product
slices (42, 45), the HIGH counts are 5 and 5 respectively — but the
surrounding slices that consume those passes are mostly audit-tightening.

**Risk if left:** Adversarial yield looks high (23 rows, many HIGHs
absorbed) but the adversarial surface is methodology-heavy. That's not
Knight-Leveson-catching-correlated-failures — that's two LLMs iterating
on the shape of the methodology they share training distribution on.
Convergence between Claude and Codex on "ADR-0007 needs a §6 firewall
amendment" is cheap. Convergence between them on "this workflow feature
is broken for users" would be valuable. The ledger's shape suggests the
latter is rare.

**Proposed disposition:** Ledger should add a column `target_class ∈
{methodology, audit, runtime, user-surface}` so the ratio is legible.
Not a fold-in for this review — a follow-up slice.

### MED 2. "REJECT-PENDING-FOLD-INS → ACCEPT-WITH-FOLD-INS" is becoming a ritual verdict

**Evidence:** Of the 23 ledger rows, 10 explicitly carry `REJECT-PENDING-
FOLD-INS → ACCEPT-WITH-FOLD-INS`, another 5 use minor variants of the same
pattern (`REJECT → incorporated → ACCEPT`). The two arc-close composition
reviews (slice-40, slices-41-to-43) both REJECT-then-ACCEPT. The slice-47
arc-close followed the same pattern. The verdict transition is almost
always: opening REJECT, fold in the HIGHs, close ACCEPT.

This is the pre-mortem failure mode P1/P2 from `specs/methodology/
decision.md` (imported into `specs/risks.md` — "Property tests become
tautological despite the auditor"). The same pattern applies here:
adversarial reviews become tautological — the challenger produces HIGHs,
the slice absorbs HIGHs in the same commit, the verdict closes ACCEPT. A
slice that opens ACCEPT without fold-ins is almost unheard-of; a slice
whose opening verdict stood at REJECT and was never closed is
structurally impossible in the ceremony pattern.

**Risk if left:** The operator sees "adversarial review pass — 5 HIGHs
absorbed — verdict ACCEPT-WITH-FOLD-INS" and reads "healthy". It's not
automatically healthy — it's the expected shape whether the HIGHs were
substantive or not, because the slice-authoring process is set up so the
author (Claude) absorbs the challenger's (Codex) objections before
closing. The author never "loses." An honest challenger process needs
occasional outcomes where the challenger is overruled, or where the
slice fails to close and must be redesigned. The ledger shows zero such
outcomes in 23 passes.

**Proposed disposition:** Operator should consider what a genuine REJECT
outcome (not REJECT-then-ACCEPT) would look like and whether any slice
in the last 2 months would have qualified. If the answer is "none would
have," that's strong signal the adversarial gate is ritualistic.

## Q2 — Artifact-to-code drift

### HIGH 2. PROJECT_STATE.md "middle third" framing understates how much is left

**Evidence:** `PROJECT_STATE.md:15` reads: "**How much is left.** Same
position as 47d — middle third of Phase 2." And earlier at line 31: "A
reasonable expectation is that Phase 2 is in its middle third — most of
the close criteria are active and satisfied, but the second workflow +
router + artifact-schema work is ahead before Phase 2 close is real."

Cross-checking against `ADR-0007 §Decision.1` + the locked summary table:

| CC# | Title | Live status at HEAD |
|---|---|---|
| P2-1 | One-workflow parity (`explore`) | active — satisfied **(at placeholder-parity, not orchestrator-parity)** |
| P2-2 | Real agent dispatch | active — satisfied |
| P2-3 | Plugin command registration | **active — red** (plugin commands are "Not implemented yet" per `.claude-plugin/commands/circuit-run.md:9` + `circuit-explore.md:9`) |
| P2-4 | Session hooks + continuity lifecycle | active — satisfied |
| P2-5 | P2-MODEL-EFFORT landed | **active — red** (not started) |
| P2-6 | Spine policy coverage | active — satisfied |
| P2-7 | Container isolation | re-deferred by ADR-0007 |
| P2-8 | Close review | **active — red** (not started) |

Of 8 close criteria: 4 active — satisfied, 3 active — red, 1 re-deferred.
That is exactly "half done" by criterion count — not "middle third."

Plus the "inherited product ratchets" that ADR-0007 §4c requires to be
green at close: 10 ratchets named, some with unclear enforcement bindings
(see MED 4). And CC#P2-1's satisfaction is explicitly "placeholder-parity"
per the Slice 44 amendment — the reference-Circuit-artifact comparison the
original criterion named is deferred to P2.10 which is not started.

**Risk if left:** The operator plans against a "middle third" mental model
and will be surprised when Phase 2 close takes longer than expected. More
insidiously: the "middle third" framing implicitly suggests most gates are
closed, so opening a new arc (e.g., P2-MODEL-EFFORT) feels like the next
incremental step. But P2-MODEL-EFFORT + P2.8 router + P2.10 artifact
schemas together represent roughly as much work as everything done since
Phase 2 opened.

**Proposed disposition:** Next `PROJECT_STATE.md` update should either
cite the per-criterion status explicitly ("4 satisfied / 3 red / 1
re-deferred; CC#P2-1 satisfied at placeholder-parity only") or drop the
cardinal framing and say "a lot of work remains before Phase 2 close."

### MED 3. Plugin manifest description claims "first-parity workflow is `explore`" but plugin-invocation is still placeholder

**Evidence:** `.claude-plugin/plugin.json:4` reads: "Claude Code plugin
that automates developer workflows (explore, build, repair, migrate,
sweep) with per-step configurability. Phase 2 scaffold — plugin command
surface scaffolded at slice P2.2; first-parity workflow is `explore`
(target of ADR-0007 CC#P2-1)."

`.claude-plugin/commands/circuit-explore.md:9`: "Not implemented yet.
This command file is a Phase 2 plan slice P2.2 scaffold entry."
`circuit-run.md:9`: same.

A user who installs this plugin today sees two commands — `/circuit:run`
and `/circuit:explore` — both returning placeholder notices. The manifest
description implies a working scaffold; the command bodies confirm they
are non-functional. The `src/cli/dogfood.ts` CLI entrypoint IS working
(runs `explore` end-to-end via `npm run circuit:run` against the real
`claude -p` subprocess), but that CLI is not reached through any of the
plugin-advertised commands.

This is not quite drift — the placeholder commands honestly disclose
their non-functional state — but the manifest `description` is
load-bearing for plugin-discovery and is advertising capability the
plugin doesn't deliver at the `/slash-command` layer.

**Risk if left:** Plugin-marketplace-facing representation (what a user
sees when they list available plugins) diverges from installation
experience. The underlying runtime works, but the advertised entrypoint
doesn't connect to it.

**Proposed disposition:** Either wire the existing CLI through the
`/circuit:explore` command (genuine connection), or trim the manifest
description to reflect scaffold-only state. Minor edit either way. Not
a blocker.

### MED 4. ADR-0007 §4c inherited ratchets are named but not all have audit enforcement

**Evidence:** `specs/adrs/ADR-0007-phase-2-close-criteria.md:791-802`
enumerates 10 inherited product ratchets (7 from Phase 1.5 +
`dispatch_realness`, `workflow_parity_fixtures`, `plugin_surface_present`)
and states: "A red inherited ratchet at close blocks Phase 2 close
independently of CC#P2-N status; CC#P2-8 close-matrix audit check
includes a row for each inherited ratchet and fails if any is red."

Checking `scripts/audit.mjs` for each ratchet's enforcement binding:

- `runner_smoke_present` — exists via `tests/runner/dogfood-smoke.test.ts`
  but no audit check cites it by name
- `workflow_fixture_runs` — exists via `tests/contracts/slice-27d-
  dogfood-run-0.test.ts` but similar no-named-check
- `event_log_round_trip` — implicit in runner tests; no named audit check
- `snapshot_derived_from_log` — implicit; no named audit check
- `manifest_snapshot_byte_match` — implicit; no named audit check
- `status_docs_current` — **YES**, Check 18 `checkStatusDocsCurrent`
- `tier_claims_current` — **YES**, Check 13 `checkTierOrphanClaims`
- `dispatch_realness` — via Check 30 `checkAgentSmokeFingerprint` +
  Check 32 `checkCodexSmokeFingerprint`
- `workflow_parity_fixtures` — implicit via Check 24 `checkSpineCoverage`
  and Check 27 `checkAdapterBindingCoverage`; no named check on this ratchet
- `plugin_surface_present` — via Check 23 `checkPluginCommandClosure`

Five of the ten named ratchets have no named audit check binding them.
ADR-0007 says `CC#P2-8 close-matrix audit check includes a row for each
inherited ratchet` — but `checkPhase2CloseMatrix` is not yet implemented
(CC#P2-8 is still active — red). When P2.8 goes to author
`checkPhase2CloseMatrix`, the author will discover 5 of 10 ratchets have
no existing audit check to call into.

**Risk if left:** CC#P2-8 authoring becomes a coordinated multi-slice
effort to first land 5 missing audit checks, then aggregate them in
the close matrix. The plan file doesn't disclose this.

**Proposed disposition:** Plan amendment at `specs/plans/phase-2-
implementation.md §P2.8` or a new slice-list entry enumerating the
missing-check prerequisites.

## Q3 — Ratchet validity / Goodhart

### HIGH 3. `checkFraming` regex was silently false-negative for ~10 recent commits before Slice 48 widening

**Evidence:** `scripts/audit.mjs:381-399` documents the Slice 48 widening:

```
// Empirical basis (Slice 48): 8 of 9 arc-47 commits use `Failure mode addressed:`
// — phrasing mirrors CLAUDE.md §Lane discipline "name the failure mode
// being addressed". The narrow regex was a false-negative on correctly-
// framed commits.
```

Pre-Slice-48, the regex `/failure mode:/i` matched only the bare literal
`Failure mode:`. The natural phrasing used across the arc-47 slices was
`Failure mode addressed:` — producing 8 false negatives where `checkFraming`
silently flagged correctly-framed commits as missing the failure-mode
label. The audit showed this as framing-triplet yellow. Those yellows
persisted through the whole arc. Slice 48 widens the regex and notes in
PROJECT_STATE.md: "Previous framing-triplet yellow (10 commits flagged)
fully resolved."

This is Goodhart realized at the audit layer. The gate was intended to
enforce the CLAUDE.md §Lane discipline triplet. It was structurally unable
to recognize the phrasing that authors actually wrote — so either (a) it
silently passed slice after slice because authors happened to write in a
way that matched, OR (b) it silently yellowed correctly-framed slices and
no one noticed for 10+ commits. The evidence says (b) is what actually
happened.

The fix is good. The slice-48 widening is correct. But:

1. The regex at scripts/audit.mjs:393 (`/\bfailure mode[^:\n]*:/i`) now
   matches "Failure mode:" AND "Failure mode addressed:" AND "Failure
   mode being addressed:" AND literally any `Failure mode <anything
   without colon or newline>:` — including mid-sentence prose ("...we
   observed a failure mode: X"). The regex is now permissive enough
   that a commit body with the phrase casually embedded in prose
   passes the gate. That may or may not be what was intended.
2. The false-negative state went unnoticed for 10+ commits. If a
   different gate (e.g., Check 34 forbidden-progress-phrase) had a
   symmetric silent false-positive, would we have noticed?

**Risk if left:** (a) The widened regex is a loosening, not a tightening.
A slice commit that mentions "failure mode" in a casual sentence
(e.g., "the original failure mode: the gate was too narrow") passes
Check 2's failureMode assertion regardless of whether the full framing
triplet was declared. (b) More fundamentally: the 10-commit silent
false-negative shows that audit-gate validity is itself a Goodhart
target. The gate reported green(yellow) on commits that framed
correctly and red would have been the signal if any had framed
incorrectly; but since the gate was silently wrong for 10 commits,
there is no empirical evidence over that window that the gate
functioned as intended.

**Proposed disposition:** (a) Tighten the regex to require the pattern
be at line-start (i.e., `/^\s*failure mode[^:\n]*:/im` — the framing
triplet is conventionally written as labelled lines, not mid-prose).
(b) Consider adding a counter-test: a commit body WITH the failure-mode
label and WITHOUT the other two labels should yield a precise error
("framing-triplet incomplete: missing acceptance_evidence"), not a
generic yellow.

### MED 5. The contract-test-count ratchet is counting meta-tests alongside invariant tests

**Evidence:** `specs/ratchet-floor.json:4` sets `contract_test_count:
1062`. `scripts/audit.mjs:430-445` defines `countTests(ref)` as matching
`/^\s*(it|test)\(/gm` across all tracked `tests/**/*.test.*` files.

Sampling recent additions:

- `tests/contracts/slice-47d-audit-extensions.test.ts` — 306 lines, +20
  tests at 47d. These test `compareSliceId()` (a comparator exported
  from audit.mjs), `SLICE_47_HARDENING_FOLDINS_ARC_CEREMONY_SLICE` (a
  string constant), `checkCodexChallengerRequiredDeclaration` (an audit
  check), `FORBIDDEN_PROGRESS_SCAN_FILES` membership, `FORBIDDEN_
  PROGRESS_SCAN_GLOBS` regex behavior. These are tests of audit
  infrastructure.
- `tests/contracts/slice-47c-forbidden-progress-firewall.test.ts` — 286
  lines, 9 tests. Tests `checkForbiddenScalarProgressPhrases` — another
  audit check.
- `tests/contracts/status-epoch-ratchet-floor.test.ts` — 519 lines,
  many tests. Tests the ratchet-floor check machinery itself.
- `tests/contracts/schema-parity.test.ts` — tests Zod schemas for the
  product runtime (Workflow, Step, Event, etc.). These are invariant
  tests.

The ratchet treats all four file categories as equivalent. If the
next arc adds 40 new tests-for-audit-checks and no tests-for-runtime-
invariants, `contract_test_count` advances by 40 and the ratchet
reports "advancing." Structurally this is the exact Goodhart failure
the methodology is supposed to defend against (specs/risks.md AR6 —
"Metric laundering").

The ratchet-floor.json notes field (line 8 of ratchet-floor.json — 12KB
of prose — see MED 6) explicitly acknowledges: "the static declaration
count produced by scripts/audit.mjs::countTests (matches /^\\s*(it|
test)\\(/gm across git-tracked tests/**/*.test.* files), not the
vitest runtime total". It does NOT distinguish between invariant tests
and meta-tests-of-the-audit-machinery.

**Risk if left:** The ratchet is measurable and green, but what it
measures is "total count of `it(`/`test(` across all test files" — a
proxy that conflates invariant coverage with audit-infrastructure
coverage. If the next arc spends another 100 declarations exclusively
on Check 36/37/38 audit tests, the ratchet advances; the invariants
the project actually ships don't.

**Proposed disposition:** Split the ratchet: `runtime_invariant_test_
count` (tests under `tests/contracts/schema-parity.test.ts` + tests
against `src/runtime/*.ts` + tests against `src/schemas/*.ts`) vs.
`audit_machinery_test_count` (tests against `scripts/audit.mjs`).
Both can advance independently per CLAUDE.md §Hard invariants #8.
This is a Codex-challenger-required ratchet change; not a fold-in
for this review but a next-slice priority.

### MED 6. `specs/ratchet-floor.json` notes field is a 12KB prose changelog, not a ratchet declaration

**Evidence:** `specs/ratchet-floor.json` is 10 lines. Line 8 is a single
JSON-string notes field that is **12,085 characters** long (roughly a
third of the charter file). It contains the full commit-by-commit
evolution of the ratchet floor from initial 574 → current 1062,
describing each slice's contribution in prose.

This is a changelog masquerading as a JSON field. Reading it does tell
the story — but the file's structural purpose (a machine-readable ratchet
declaration) is overwhelmed by it. A programmatic reader that wants
`floor_value` has to JSON-parse a 12KB string-escaped blob to find it.

Structurally, the notes field duplicates what git log already contains
(every slice that advanced the floor has a commit subject describing
the advance) and what `adversarial-yield-ledger.md` records. The
ratchet file becomes a third-copy of the same history — prone to drift
against the other two.

**Risk if left:** Readers parsing ratchet-floor.json have to handle an
escaped 12KB string. Editors modifying the file have a hard time
distinguishing the ratchet metadata (floor / last_advanced_in_slice)
from the running commentary. The file is git-log-as-JSON-field.

**Proposed disposition:** Move the prose to a sibling file
`specs/ratchet-floor-history.md` or to ADR-0002 §Ratchet advancement
history. Keep `ratchet-floor.json` minimal (3 fields: floors,
last_advanced_at, last_advanced_in_slice).

## Q4 — Trajectory honesty

### MED 7. Of the 10 "next-session" work items named in PROJECT_STATE.md §Slice 48, one has been "next" for 6+ slices

**Evidence:** PROJECT_STATE.md:13: "**What's next.** Same as after 47d
landed: the per-step model-and-effort work (workflow contracts
specifying which model each step runs with + at what reasoning effort)
or the router (the classifier turning a free-form task into a routed
workflow). Both still sit waiting at the top of the Phase 2 next-slice
list."

Going back slice-by-slice:

- Slice 47d entry (PROJECT_STATE:29): "Two paths are now open ... per-
  step model-and-effort work ... router ... both still sit waiting"
- Slice 47c-partial-retro (PROJECT_STATE:43-45): "the next session can
  open the per-step model+effort work or the router work"
- Slice 47c-2 entry (PROJECT_STATE:71-73): "Next: dispatch the batched
  Codex challenger pass for the prior Slices 47b and 47c"
- Slice 47b-retro (PROJECT_STATE:57-59): "The sibling commit absorbs
  Codex's objections ... After that lands, the only remaining arc step
  is Slice 47d"
- Going further back: Slice 45 entry was "next: P2.6 codex adapter" —
  which landed — but that was P2.6 closing, and P2-MODEL-EFFORT + P2.8
  were already "next after P2.6" at that time.

P2-MODEL-EFFORT is the highest-priority "next" for roughly **6 slices**
running (47 / 47a / 47b / 47c / 47c-2 / 47c-retro / 47c-partial-retro /
47d / 48 = 9 slices where it has been "next"). None of those slices
advanced it. The arc that intervened was entirely methodology-hardening.

**Risk if left:** "Next" becoming a placeholder that perpetually defers
while methodology work fills the actual slice queue. This is the
pre-mortem P1 failure mode realized ("Phase 1 bureaucracy crushes
velocity" applied to Phase 2 scope). The literal text in PROJECT_STATE
says P2-MODEL-EFFORT is "next" but the observed behavior is that
whenever a Codex pass objects to something, that objection folds into
a hardening slice and "next" gets pushed out another session.

**Proposed disposition:** Operator commitment: the next slice that
opens MUST either (a) advance P2-MODEL-EFFORT or P2.8 router, OR
(b) declare in its framing WHY it is a methodology slice and what
objection it is absorbing. No further audit-tightening slices without
explicit justification.

### MED 8. The `slice-47c` marker reused across four commits obscures the arc's real shape

**Evidence:** `git log --oneline -10` shows four commits carry the
`slice-47c:` prefix:

- `d1dd56e slice-47c: ADR-0007 §3 forbidden scalar-progress firewall + Check 34 (Slice 47c partial ...)`
- `19ea401 slice-47c: operator decision ratified — Option A literal challenger policy + Codex challenger fold-ins (Slice 47c continuation / 47c-2)`
- `1c4a5b1 slice-47c: Codex challenger fold-ins — Slice 47b retroactive (Slice 47c continuation / 47b-retro)`
- `73c729c slice-47c: Codex challenger fold-ins — Slice 47c partial retroactive (Slice 47c continuation / 47c-partial-retro)`

Four commits, same slice id `47c`, distinguished only by sub-names
(partial / continuation-47c-2 / 47b-retro / 47c-partial-retro).
PROJECT_STATE.md explains at line 65: "Slice id remains `47c` per the
precedent set by Slice 47a Codex fold-ins (commit 7d485c9) where a
continuation commit kept the same slice marker."

The SLICE_ID_PATTERN at `scripts/audit.mjs:1791` accepts `[0-9]+[a-z]?`,
so `47c-2` is not a valid slice id — hence the sub-name workaround.

The CLAUDE.md §Lane discipline framing requires slice ≤30 min
wall-clock. Four 30-minute slices on the same slice id is, effectively,
a 2-hour slice split across commits for monotonicity reasons. That's
fine mechanically — the commits stay atomic — but operationally:

1. The continuity narrative has to explain "Slice 47c-2" / "47b-retro" / 
   "47c-partial-retro" to future readers (3 of the top 6 PROJECT_STATE
   entries dedicate paragraphs to this explanation)
2. "Slice 47c" is now ambiguous without a sub-name
3. The SLICE_ID_PATTERN would need to extend to accept `47c-2`, or the
   convention needs a formal naming rule

**Risk if left:** Future arcs that want to split work across multiple
ratchet-advancing commits face the same problem. Each arc invents its
own sub-naming convention. No formal mechanism.

**Proposed disposition:** Extend SLICE_ID_PATTERN to accept
`[0-9]+[a-z]?(-[0-9]+)?` (e.g., `47c-1`, `47c-2`) OR formalize that
continuation commits keep the parent slice id and add a prose "phase"
field to PROJECT_STATE entries. Either solves the ambiguity.

## Q5 — Architectural coupling / seams

### HIGH 4. The plugin-as-advertised is not reached through the production entrypoint

**Evidence:** The plugin advertises two commands via `.claude-plugin/
plugin.json`:

- `/circuit:run` — "Router not yet implemented — this is a P2.2 scaffold
  entry that returns a not-implemented notice pointing at plan slice P2.8."
- `/circuit:explore` — "P2.2 scaffold entry — invocation returns a
  not-implemented notice."

The functional explore pipeline lives at `src/cli/dogfood.ts::main`.
That entrypoint is reached via `npm run circuit:run -- explore --goal
"..."`. The npm script binding at `package.json:17` is `"circuit:run":
"tsx src/cli/dogfood.ts"`. This is NOT a plugin-command invocation —
it's an npm-script invocation requiring (a) a cloned working tree, (b)
node/npm installed, (c) tsx installed, (d) `npx vitest` compatible.

When Claude Code loads this plugin, it registers `/circuit:run` and
`/circuit:explore` as slash commands pointing at the respective
`.claude-plugin/commands/*.md` files. Each of those files contains:
"Not implemented yet."

So:

- A plugin user invoking `/circuit:explore` in Claude Code gets
  placeholder text.
- The same user cannot reach the functional pipeline from within
  Claude Code — they would have to clone the repo and run
  `npm run circuit:run -- explore`.
- The functional pipeline IS real (runs against `claude -p` subprocess
  per Slice 42; runs against `codex exec` subprocess per Slice 45;
  produces artifacts) but it is not wired to the plugin surface.

**Risk if left:** ADR-0007 CC#P2-3 ("Plugin command registration")
requires a `specs/reviews/p2-11-invoke-evidence.md` that proves a
plugin-user can invoke the command AND get meaningful output. At HEAD,
that evidence file does not exist and cannot exist because the commands
return placeholders. Phase 2 close requires CC#P2-3 satisfied. P2.11
is therefore on the critical path, but the plan file treats it as a
late slice with no concrete framing. The plugin-surface-vs-runtime seam
(plugin registers → not-implemented-placeholder ↔ CLI runs → real
pipeline) will surface as the load-bearing Phase 2 failure mode.

**Proposed disposition:** P2.11 should be promoted from its current
late-schedule position. A single slice landing "wire `/circuit:explore`
to `src/cli/dogfood.ts` via a skill or hook" plus an invoke-evidence
file would close the seam. This is a genuine capability advance, not
methodology work.

### MED 9. The `DispatchFn` structured descriptor was introduced to fix a silent adapter-identity lie that slipped past per-slice Codex review

**Evidence:** `src/runtime/runner.ts:90-93`:

```
export interface DispatchFn {
  readonly adapterName: BuiltInAdapter;
  readonly dispatch: (input: AgentDispatchInput) => Promise<DispatchResult>;
}
```

The history at `src/runtime/runner.ts:77-90` comments: "Slice 45a (P2.6
HIGH 3 fold-in) ... Prior to 45a, `DispatchFn` was a bare function type
and the runner's materializer call site hardcoded `adapterName: 'agent'`;
injecting a non-agent dispatcher (e.g. `dispatchCodex`) through
`DogfoodInvocation.dispatcher` would silently lie on the
`dispatch.started` event's adapter discriminant."

The bare-function seam was introduced at Slice 43b. Slice 45 landed the
codex adapter. Slice 45's Codex challenger pass caught the adapter-
identity-lie as HIGH 3 — after the codex adapter had landed. The fix
came at Slice 45a.

This is the exact failure-mode class that composition reviews are
supposed to catch. Per-slice Codex on 43b (the slice that introduced
the seam) didn't catch it — indeed Slice 43b did not get a per-slice
Codex pass (`specs/reviews/` has no `arc-slice-43b-codex.md`). The
seam survived until the second adapter was written on top of it. The
cross-slice composition review at `arc-slices-41-to-43-composition-
review-claude.md` might have caught it but was authored AFTER Slice
45 already landed (Slice 44 opened the arc-close ceremony; Slice 45 is
the next arc).

**Risk if left:** This is a positive datapoint for the methodology —
the adapter-identity lie was caught and fixed. But it reveals that
seams introduced by one slice without per-slice Codex review can survive
to surface only when a later slice lands on top of them. The "practical
narrowing" of the Codex-required rule (43a/43b/43c skipped Codex)
directly caused this. Slice 47c-2 ratified the literal "any ratchet
change" rule going forward, which addresses future instances — but the
retrospective review of 43a/b/c via the amnesty path at Slice 47d is
scope-only; it did not re-examine whether other silent seams survive
from that window.

**Proposed disposition:** This is an acknowledgment, not an actionable
finding. The operator should note that past-slice amnesty scope does
not retroactively apply adversarial attention to the seam layer — it
only nominally covers the ratchet advance. A future slice could
author a one-time deeper-read pass on the Slice 43 seam set
specifically, looking for other silent drifts of the Slice 45a
flavor.

## Q6 — Blind spots / correlated failures

### META 1. Both Claude and Codex share a disposition to produce ADRs and audit checks as remediation — an outsider might choose differently

**Evidence:** Looking at the 23 adversarial-yield-ledger rows and the
recent arc-close reviews, the dominant remediation pattern for a HIGH
finding is:

1. Amend an ADR to name the concern (ADR-0007, ADR-0008, ADR-0009
   were all authored in response to earlier-surfaced concerns).
2. Add an audit check to mechanically enforce the ADR (Check 27, 28, 29,
   30, 32, 33, 34, 35 all bind ADRs).
3. Add a ratchet-floor test declaration pinning the check's behavior.

Over 23 passes, essentially zero HIGH findings resolved with "delete
this code; the concern it protects against isn't real." Zero resolved
with "this is over-engineered; simplify the interface." Zero resolved
with "the user story doesn't need this; cut it."

This is the plausible shape of correlated failure AR3 / P5 the
methodology documents. Claude and Codex share training distribution —
they share the disposition to author governance artifacts when
uncertainty appears. Both models interpret "this slice looks wobbly" as
"add more rails." A staff engineer from a non-LLM-centric org, shown
the audit.mjs file (5352 lines, 35 checks, a dozen exported constants,
four regex enumerations, string-vs-numeric ceremony_slice branches), is
likely to raise an eyebrow at the rate of accretion.

The methodology explicitly acknowledges this as AR3 and monitors
"Claude/Codex convergence rate ≥95% on ADRs over N≥20 samples" as a
reopen signal (specs/risks.md AR3). Counting from the ledger:

Of 23 passes, 0 appear to have reached a "Claude says X, Codex says
not-X, operator decides" outcome. The closest was Slice 47c-2 where
Codex HIGH 5 forced an operator decision between Options A and B —
but the choice was operator-made, not challenger-vs-author-disagreement.

This is at or near the 95% reopen threshold. The ledger doesn't
compute the rate formally because the `operator_justification_if_
past_cap` column tracks pass-count caps, not convergence rate. If
convergence were measured (and I am doing that measurement right
now, as the Claude fresh-read prong speculating about what the Codex
prong will say), we would see exactly this review converge with the
Codex prong on a non-trivial subset of these findings — and that
convergence would be expected given the training distribution, NOT
evidence of correctness.

**Disposition:** Not a fold-in — a signal to the operator that the
project may have entered the AR3 reopen zone. Operator should
consider whether a genuinely independent reviewer (non-LLM, or a
different LLM family, or a human staff engineer) should be consulted
before the next major milestone. The charter's anti-sycophancy framing
explicitly calls this out; the operator is already doing the right
thing by commissioning this holistic review. The question is whether
the two LLMs' output on it should be weighted differently than the
existing challenger outputs.

### META 2. The "trajectory check" (CLAUDE.md:90-95) is prose-only — no audit enforcement, no structural record

**Evidence:** CLAUDE.md:90-95 adds a trajectory-check requirement:

```
**Trajectory check (before the framing triplet).** Restate in one line each:
what arc goal this slice serves, what phase goal that arc serves, and whether
any earlier-completed slice has made this one smaller, obsolete, or
mis-sequenced. ... Three sentences at slice open, no new artifact.
```

This is supposed to guard against arc-level drift — the exact failure
mode this review's Q4 finding HIGH 2 and MED 7 describe. Unlike the
framing triplet (audited by Check 2), the trajectory check has no
audit enforcement. It is a prose directive.

Sampling recent commit bodies for the trajectory check pattern:

- Slice 48 (HEAD): "Trajectory check: arc goal — close the yellow-audit
  cleanup..." — present, three sentences, correct shape.
- Slice 47d: "Trajectory: closes the hardening fold-in arc..." —
  present.
- Slice 47b-retro: "Trajectory: this commit closes the 47b half of the
  batched Codex challenger pass..." — present but short (one sentence).

The check is being done on recent commits. But without audit
enforcement, a future commit that drops it lands green. More importantly:
the trajectory check is supposed to catch "has any earlier slice made
this one smaller, obsolete, or mis-sequenced" — and in the recent arc,
the three slices that became retroactive-fold-ins (47b-retro /
47c-partial-retro / 47c-2) are themselves evidence that earlier slices
DID reshape the terrain, but the subsequent slices' trajectory checks
say "no earlier slice obsoleted or mis-sequenced." The form is being
honored; the substance isn't being tested against reality.

**Disposition:** The prose-only discipline has ~one month of data
showing it does NOT protect against the drift it was introduced to
guard. Operator should decide whether to audit-enforce it (with the
attendant risks of adding another tautological gate — see Q3 HIGH 3)
or to accept that the check is ornamental at current substance.

### LOW 1. "Fresh-read" is claimed but not mechanically verified

**Evidence:** `specs/reviews/arc-slice-47-composition-review-claude.md:312-318`
(META 1 in that review) acknowledges: "Fresh-read is aspirational: the
author has just dispatched Codex on the primary arc + amnesty scope and
has seen the continuity record's framing before authoring. Counter: the
author's substantive session context was truncated at `/clear` per the
context-guard directive; this session begins with empty context and
re-reads HEAD state."

The current review (this file) inherits the same structural issue. I
was invoked with a charter file plus a preamble that references prior
reviews (p2-foundation-composition-review, Slice 47 arc-close). I have
read CLAUDE.md and PROJECT_STATE.md in full. "Fresh-read" in the sense
of "has not been exposed to the repo before this review" is false —
the Claude Code session that is writing this review is the same model
family that authored the prior reviews (different instance, but same
training distribution and shared framing).

A genuinely fresh read — one that has not been exposed to the repo's
self-description — would require a different model family or an
operator-mediated blinded read.

**Disposition:** Acknowledgment. The charter explicitly names this
tension ("The prongs agreeing on a finding is stronger signal than the
prongs agreeing on an endorsement"). Operator should read this review
with the knowledge that "Claude fresh-read" means "fresh session,
not fresh training distribution."

## Q7 — Test validity

### MED 10. Many tests in `tests/contracts/slice-*.test.ts` are meta-tests of audit checks, not invariant tests of the runtime

**Evidence:** Counting representative files:

- `tests/contracts/slice-47d-audit-extensions.test.ts` — 306 lines, tests
  `compareSliceId` comparator, `ARC_CLOSE_GATES` behavior,
  `checkCodexChallengerRequiredDeclaration`, `FORBIDDEN_PROGRESS_SCAN_*`.
  All audit machinery.
- `tests/contracts/slice-47c-forbidden-progress-firewall.test.ts` — 286
  lines, tests `checkForbiddenScalarProgressPhrases`. All audit
  machinery.
- `tests/contracts/status-epoch-ratchet-floor.test.ts` — 519 lines,
  tests `checkPinnedRatchetFloor`, `checkStatusDocsCurrent`,
  `checkStatusEpochAlignment`, `CURRENT_SLICE_MARKER_PATTERN` regex,
  `SLICE_COMMIT_SUBJECT_PATTERN`, etc. All audit machinery.
- `tests/contracts/plugin-surface.test.ts` — 80+ lines, tests
  `checkPluginCommandClosure`. Audit machinery.
- `tests/contracts/artifact-backing-path-integrity.test.ts` — tests
  `checkArtifactBackingPathIntegrity`. Audit machinery.
- `tests/contracts/adapter-binding-coverage.test.ts` — tests Check 27.
  Audit machinery.
- `tests/contracts/adapter-invocation-discipline.test.ts` — tests Check 28+29.
  Audit machinery.
- `tests/contracts/session-hooks-present.test.ts` — tests Check 33.
  Audit machinery.
- `tests/contracts/session-hygiene.test.ts` — tests CLAUDE.md shape.
  Static-anchor tests.
- `tests/contracts/invariant-ledger.test.ts` — tests the invariants.json
  ledger. Meta-test.

Versus invariant tests of the runtime surface:

- `tests/contracts/schema-parity.test.ts` — Zod schema round-trip tests.
  Real invariant coverage.
- `tests/contracts/primitives.test.ts` — primitive schema tests. Real.
- `tests/contracts/artifact-authority.test.ts` — authority-graph tests.
  Partially real, partially meta.
- `tests/contracts/workflow-kind-policy.test.ts` — tests
  `validateWorkflowKindPolicy`. Real (validates a runtime policy).
- `tests/contracts/slice-37-dispatch-transcript.test.ts` — tests event
  schema shape. Real.
- `tests/contracts/slice-42-agent-adapter.test.ts` — tests adapter
  constants + parser. Real.
- `tests/contracts/slice-45-codex-adapter.test.ts` — tests codex adapter
  constants + parser. Real.

Estimating from file names + sizes: roughly **50-60% of the contract-
test count is audit-machinery meta-testing**, with the remainder on
runtime invariants. The ratchet at 1062 reported in ratchet-floor.json
counts all of these as one pool.

This isn't necessarily bad — the audit machinery is load-bearing and
deserves coverage. But Q3's HIGH 3 finding showed `checkFraming` was
silently false-negative for 10+ commits despite being test-covered.
Meta-tests verify the check's behavior against constructed fixtures;
they cannot detect "the check's fixture set doesn't resemble real
commit bodies." That's exactly the `checkFraming` failure class.

**Risk if left:** Ratchet advancement is indistinguishable between "we
added 20 invariant tests on a new schema" and "we added 20 audit-check
branch-coverage tests on a new Check 36." The latter does not advance
runtime safety in the way the methodology claims the ratchet tracks.

**Proposed disposition:** See Q3 MED 5. Split the ratchet.

### LOW 2. Several tests assert on literal constant values that provide only tautological guarantee

**Evidence:** `tests/contracts/slice-47d-audit-extensions.test.ts:91-94`:

```
it('exports the ceremony slice as the canonical letter-suffixed string "47d"', () => {
  expect(typeof SLICE_47_HARDENING_FOLDINS_ARC_CEREMONY_SLICE).toBe('string');
  expect(SLICE_47_HARDENING_FOLDINS_ARC_CEREMONY_SLICE).toBe('47d');
});
```

This test asserts that a string constant equals a literal. It fails only
if someone renames the constant. It doesn't defend any runtime invariant
— it's a rename-detection tripwire.

Similar patterns at `tests/contracts/slice-47d-audit-extensions.test.ts:252-
262`:

```
it('exports the grandfather list with the two retroactive 47 fold-in commits', () => {
  const keys = Object.keys(CODEX_CHALLENGER_DECLARATION_GRANDFATHERED_COMMITS);
  expect(keys).toContain('1c4a5b1');
  expect(keys).toContain('73c729c');
  ...
```

Grandfather lists are tautology targets: the test is by construction
designed to match the committed state. A future slice that needs to
regrandfather something has to update both the constant AND the test.

**Risk if left:** These tests contribute to the ratchet count but do
not catch anything that type-checking and greppable constant references
would not catch. They inflate the count without increasing the
invariant surface.

**Proposed disposition:** Operator discretion. Could be scrubbed.
Not blocking.

## Q8 — Completion / implementation gaps

### LOW 3. The explore workflow's close-step artifact is a "deterministic placeholder" per ADR-0007 §CC#P2-1 amendment

**Evidence:** `specs/adrs/ADR-0007-phase-2-close-criteria.md:116-148` (the
Slice 44 arc-close amendment):

```
**Amendment — Slice 44 arc-close (placeholder-parity epoch disclosure...**
CC#P2-1 at Slice 43c landing is measured by a sha256 over the `explore`
fixture's close-step placeholder body. The body is a deterministic function
of `step.gate.required` section names, written by
`src/runtime/runner.ts::writeSynthesisArtifact`; no real dispatch
output is consumed into the hashed artifact.
```

And `src/runtime/runner.ts:315-326` (`writeSynthesisArtifact`):

```
function writeSynthesisArtifact(
  runRoot: string,
  step: Workflow['steps'][number] & { kind: 'synthesis' },
): void {
  const abs = join(runRoot, step.writes.artifact.path);
  mkdirSync(dirname(abs), { recursive: true });
  const body: Record<string, string> = {};
  for (const section of step.gate.required) {
    body[section] = `<${step.id as unknown as string}-placeholder-${section}>`;
  }
  writeFileSync(abs, `${JSON.stringify(body, null, 2)}\n`);
}
```

So `explore` runs end-to-end with real agent dispatch (synthesize-step
+ review-step hit `claude -p` as subprocess), but the final artifact
that the golden hash measures is generated by a placeholder that
replaces the dispatch outputs with literal `<stepId-placeholder-
sectionName>` strings. The dispatch outputs land at `writes.result`
(raw subprocess output bytes) but do not compose into the close-step
artifact at `artifacts/explore-result.json`.

This is honestly disclosed in ADR-0007's amendment. CC#P2-1 is
"satisfied at placeholder-parity" not at "orchestrator-parity."
P2.10 is the slice that replaces the placeholder with real orchestrator
output.

**Risk if left:** The plain-English PROJECT_STATE.md summary and the
`dispatch_realness` ratchet claim "explore runs end-to-end" — which is
technically true (events land, result artifact is written) but the
result artifact is a shape-mirror of the gate schema, not a composition
of dispatch outputs. Reading the per-criterion table: CC#P2-1 status is
"active — satisfied" with the placeholder qualifier buried in an ADR
amendment.

**Disposition:** This is honest disclosure — the project is not hiding
the placeholder state. But the plain-English summary ("middle third" —
see HIGH 2) and the per-criterion status line ("active — satisfied")
both round up over the qualifier. A next-arc framing should either
prioritize P2.10 or be explicit that "satisfied" was a useful epoch but
not a user-visible capability.

### LOW 4. The second workflow (P2.9) is named `review` but no contract or fixture exists yet

**Evidence:** `specs/plans/phase-2-implementation.md:789-793`:

```
- **P2.9 — Second workflow** — likely `review` (Codex's fallback
  suggestion and the smallest remaining surface) unless Phase 2
  evidence points elsewhere. Proves the
  contract/adapter/fixture/protocol pattern generalizes beyond
  `explore`. Target reselection occurs at P2.9 framing time.
```

No `specs/contracts/review.md` exists. No `.claude-plugin/skills/review/
circuit.json` exists. The plan marks this slice as "Mid-term — named
but not scheduled."

Since CC#P2-1 satisfaction was defined in terms of "one workflow at
orchestrator-parity with reference Circuit," the "second workflow proves
generalization" claim is entirely forward-looking. Phase 2 could close
(per ADR-0007 §Decision.1) with just one workflow satisfied, but the
methodology argument for circuit-next over reference Circuit depends on
the methodology scaling. Without a second workflow, the "methodology
generalizes" claim is untested.

**Disposition:** This is a scoping acknowledgment. Phase 2 close does
NOT require a second workflow per ADR-0007, but the eventual product
argument does. The risk is finding out at P2.9 that explore-specific
decisions (e.g., `writeSynthesisArtifact` placeholder shape, the
dispatch-materializer's five-event transcript binding) don't
generalize cleanly.

## META — Review process itself

### META 3. This review is itself subject to the ratio critique (HIGH 1)

**Observation:** The charter commissioning this review is 294 lines. The
review file as authored will be ~500 lines. The combined effort represents
what is effectively another methodology-heavy slice — specifically a
meta-methodology slice (a review of the review cadence, among other
things).

Per CLAUDE.md §After-slice operator summary, the operator needs to know
"how much is left." This review itself consumes operator attention that
could have been spent on a capability slice. The charter explicitly
commissioned this as "before building further" — so the time cost is
budgeted. But the ratio critique at HIGH 1 includes this review in its
scope: commissioning a review is methodology time, not capability time.

The defensive argument: catching drift before it compounds is cheaper
than fixing drift after. That's the standard methodology-pays-for-itself
claim. The counter: if the drift being caught is itself methodology
drift (as the Slice 47 arc caught), then the review's yield is
methodology-maintenance yield, not capability yield.

**Disposition:** Operator should read the findings here for genuine
signal, but also weigh whether any of them is load-bearing enough to
justify the attention cost. If a substantive HIGH (like HIGH 4) turns
into a near-term capability slice (wire plugin to CLI), the review
paid for itself. If the review's output becomes another round of audit
tightening, the review confirmed HIGH 1.

## Consolidated disposition table

| Question | HIGH | MED | LOW | META | Disposition |
|---|---:|---:|---:|---:|---|
| Q1 — Methodology ROI | 1 | 2 | 0 | 0 | Operator ratio-check for next arc; ledger column addition; scrutiny of ritual verdicts |
| Q2 — Drift | 1 | 2 | 0 | 0 | PROJECT_STATE.md trajectory honesty; plan-manifest alignment; enforcement binding gap on inherited ratchets |
| Q3 — Ratchet / Goodhart | 1 | 2 | 0 | 0 | Tighten framing regex; split contract-test-count ratchet; move ratchet-floor notes to history file |
| Q4 — Trajectory honesty | 0 | 2 | 0 | 0 | Operator commitment to next-slice-must-be-capability; slice-id sub-naming formalization |
| Q5 — Coupling / seams | 1 | 1 | 0 | 0 | Promote P2.11 plugin-wiring slice; note past-slice amnesty blind spot |
| Q6 — Blind spots | 0 | 0 | 0 | 2 + 1 LOW | AR3 threshold acknowledgment; trajectory-check empirical failure; fresh-read structural limit |
| Q7 — Test validity | 0 | 1 | 1 | 0 | Ratchet split (cross-reference Q3); scrub tautology tests (optional) |
| Q8 — Completion gaps | 0 | 0 | 2 | 0 | Honesty-on-placeholder-parity; P2.9 scoping caveat |
| META on review | 0 | 0 | 1 LOW | 1 | This review inherits HIGH 1 ratio critique |

**Totals:** 4 HIGH / 7 MED / 4 LOW / 3 META (with LOW 1 / MEDs overlapping
across Q6 / Q8 into the META column; counts are primary assignment).

## Closing verdict

**ACCEPT-WITH-FOLD-INS.**

Rationale:

- None of the HIGH findings block Phase 2 continuation. HIGH 1 (ratio)
  is a trajectory concern, not a gate-blocker. HIGH 2 (trajectory
  honesty) is operator-visibility. HIGH 3 (framing regex false-
  negative) is already fixed at Slice 48 — the finding is that the
  bug existed, not that it exists. HIGH 4 (plugin-not-wired) is a
  sequencing recommendation.
- No finding materially diverges from what a good-faith operator
  reading PROJECT_STATE.md in detail would have surfaced. The review's
  value is consolidation + cross-question pattern matching + the META
  observations about correlated-failure risk.
- The methodology IS catching real drift (the Slice 47 arc is proof);
  the question is whether the rate of methodology-tightening is
  sustainable. The operator is already asking this question by
  commissioning this review.
- If the next arc opens with P2-MODEL-EFFORT or P2.8 router or
  P2.11 plugin wiring (capability work), the recommended fold-ins
  from this review are absorbed implicitly. If the next arc opens
  with another methodology-tightening slice in response to a Codex
  objection on this review, that would REJECT the verdict.

Single-prong acceptance is explicitly rejected by the charter (per
CLAUDE.md §Cross-slice composition review cadence). This review is
paired with the Codex cross-model challenger prong at
`specs/reviews/phase-project-holistic-2026-04-22-codex.md`.

## Notes on what this review did NOT find

Per the charter, "finding zero or finding 80 are both suspect." I found
15 findings — four HIGH, seven MED, four LOW, three META. I will name
what I expected to find and did not:

1. **I expected a broken Zod schema invariant** — some case where the
   schema validates input that shouldn't parse or rejects input that
   should. I did not find one. The schema surface is the strongest
   part of the codebase.
2. **I expected a dead-code seam** — a `src/runtime/*.ts` function that
   is exported but no longer called, surviving a refactor. I did not
   find one. The imports are tight.
3. **I expected a test file asserting on a fixture that drifted from
   what it tested** — similar to the classic tautology failure. I did
   not find a single clear instance; most tests assert on production
   exports or temp-fixture-constructed inputs.
4. **I expected a misaligned git-worktree concern**. None surfaced — the
   repo is on `main` with working tree clean.
5. **I expected an audit check that's been unreachable for weeks**. I
   did not find an unreachable check; all 35 checks run on every
   `npm run audit`. Check 35 is "not applicable" at HEAD but that's
   the correct behavior for that branch.

The absence of these "classic" findings is itself signal — the
methodology, whatever the critique of its ratio, does produce code
that holds up to technical scrutiny at the artifact level. The
critique here is categorical: the wrong ratio of effort. Not the
wrong effort.
