---
name: arc-slice-47-composition-review-claude
description: Fresh-read Claude composition-adversary pass over the Slice 47 hardening fold-in arc (Slices 47 / 47a / 47a-foldins / 47b / 47c-partial / 47c-2 / 47b-retro / 47c-partial-retro) PLUS one-time past-slice amnesty scope (Slices 43a / 43b / 43c / 45a / 46b) per Slice 47c-2 Codex MED 1 deferred binding. Paired with the Codex challenger prong commissioned in the same ceremony commit.
type: review
reviewer_model: claude-opus-4-7
reviewer_model_id: claude-opus-4-7
authorship_role: auditor
review_kind: composition-review
review_date: 2026-04-22
verdict: ACCEPT-WITH-FOLD-INS
authored_by: claude-opus-4-7
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
  high: 3
  med: 3
  low: 2
  meta: 1
commands_run:
  - git log --oneline 7a08938^..73c729c (arc commits)
  - git log --oneline b1dd9af 48bcab8 7bc3543 8999bb0 ee23c3c (amnesty scope)
  - git show --stat on each of 8 arc commits + 5 amnesty commits
  - git log --format=%B per commit | grep "Lane:|Codex challenger:|Isolation:" (discipline-mark scan)
  - Read src/runtime/adapters/dispatch-materializer.ts (post-47a)
  - Read src/runtime/runner.ts (post-45a + post-47a)
  - Read specs/behavioral/cross-model-challenger.md CHALLENGER-I2 (post-47c-2 amendment)
  - Read specs/plans/phase-2-implementation.md §Slice 45a + §Slice 46b (post-47c-2 supersession notes)
  - Read specs/plans/slice-47-hardening-foldins.md §Slice 47d scope items 1 + 5
  - Read specs/adrs/ADR-0007-phase-2-close-criteria.md §CC#P2-4 Close-state history (post-47b-retro)
  - Read scripts/audit.mjs lines 3120-3300 (Check 26 ARC_CLOSE_GATES)
  - Read scripts/audit.mjs lines 3680-3850 (Check 34 + FORBIDDEN_PROGRESS_SCAN_FILES + ADR_0007_FORBIDDEN_PROGRESS_PATTERNS post-47c-retro)
  - Read tests/runner/session-hook-lifecycle.test.ts (47b-retro)
  - Read tests/runner/hook-engine-contract.test.ts (47b-retro)
  - Read tests/contracts/slice-47c-forbidden-progress-firewall.test.ts (47c-partial-retro)
  - Read tests/runner/continuity-lifecycle.test.ts (46b, amnesty scope)
  - Read tests/runner/runner-dispatch-adapter-identity.test.ts (45a, amnesty scope)
  - Read src/runtime/policy/workflow-kind-policy.ts (43a, amnesty scope)
  - Read tests/runner/explore-e2e-parity.test.ts (43c, amnesty scope)
  - Replicated countTests(null) in node: 43 files, static count 1042 (matches audit gate formula)
  - grep -nE forbidden-scalar-progress-patterns across tests/ and specs/ outside FORBIDDEN_PROGRESS_SCAN_FILES
opened_scope:
  - 8 arc commits: 7a08938, db5253d, 7d485c9, eed12fa, d1dd56e, 19ea401, 1c4a5b1, 73c729c
  - 5 amnesty-scope commits: b1dd9af (43a), 48bcab8 (43b), 7bc3543 (43c), 8999bb0 (45a), ee23c3c (46b)
  - specs/plans/slice-47-hardening-foldins.md (arc plan)
  - specs/plans/phase-2-implementation.md §P2.5 + §P2.6 + §P2.7 (amnesty scope plan anchors)
  - specs/adrs/ADR-0007-phase-2-close-criteria.md (CC#P2-4 close-state history ledger)
  - specs/behavioral/cross-model-challenger.md (CHALLENGER-I2 post-47c-2 amendment)
  - scripts/audit.mjs Check 26 + Check 34 (+ ADR_0007_FORBIDDEN_PROGRESS_PATTERNS + FORBIDDEN_PROGRESS_SCAN_FILES)
  - src/runtime/runner.ts (post-45a DispatchFn + post-47a deriveResolvedSelection + deriveResolvedFrom)
  - src/runtime/adapters/dispatch-materializer.ts (post-47a fail-closed resolvedSelection/resolvedFrom)
  - Per-slice Codex reviews: arc-slice-47a-codex.md, arc-slice-47b-codex.md, arc-slice-47c-codex.md, arc-slice-47c-2-codex.md
  - Prior arc-close reviews as calibration: arc-slices-35-to-40-composition-review-{claude,codex}.md, arc-slices-41-to-43-composition-review-{claude,codex}.md
  - PROJECT_STATE.md top 3 entries (47c-partial-retro, 47b-retro, 47c-2)
  - specs/ratchet-floor.json (floor 988, last_advanced_in_slice 46b)
  - CLAUDE.md §Cross-slice composition review cadence + §Hard invariants #6
skipped_scope:
  - bootstrap/** (Phase 0 evidence loop, frozen)
  - prior-gen circuit (read-only reference per CLAUDE.md)
  - specs/reviews/phase-2-to-date-comprehensive-{claude,codex}.md (the arc-initiating reviews — referenced but not re-opened)
  - Slice 44 ceremony + Slice 45 codex-adapter per-slice review — prior arc, not in this arc's scope
authority:
  - CLAUDE.md §Cross-slice composition review cadence (this arc exceeds 3 slices; privileged-runtime modification at 47a triggers the cadence)
  - CLAUDE.md §Hard invariants #6 (literal rule, ratified at 47c-2)
  - specs/plans/slice-47-hardening-foldins.md §Slice 47d scope items 1 + 5 (amnesty-scope binding + amnesty_scope frontmatter requirement)
  - specs/reviews/phase-2-to-date-comprehensive-codex.md §HIGH 5 (the policy-vs-practice drift that originated this arc)
  - ADR-0007 §Decision.1 CC#P2-4 Close-state history ledger (47b-retro authored)
fold_in_disposition: Three HIGH findings — (1) tracked-file forbidden-phrase drift outside Check 34 scan scope; (2) Slice 47c-2 Codex MED 2 mechanical-enforcement check must land in this ceremony commit with a shape that accepts arc-subsumption as a Codex-pass substitute; (3) ARC_CLOSE_GATES must gain an entry for this arc so Check 26 binds the two-prong gate here. All three are incorporable into the Slice 47d ceremony commit. Three MEDs are incorporable inline (amnesty-scope body coverage, per-slice sections; ratchet-floor advance narrative accuracy; framing-triplet yellow disposition). Two LOWs defer to operator discretion. Closing verdict ACCEPT-WITH-FOLD-INS on the theory that the arc produced the right outcomes at each slice boundary, that the Codex per-slice reviews already caught per-slice concerns, and that the seam-level drifts surfaced here are absorbable into the ceremony commit rather than requiring a separate fold-in arc.
---

# Slice 47 hardening fold-in arc + past-slice amnesty scope — Claude composition-adversary review

## Scope

Fresh-read composition-adversary pass over two scopes:

1. **Primary arc (8 commits):** Slice 47 hardening fold-in arc opened to restore audit honesty after the Phase-2-to-date comprehensive review returned REJECT-PENDING-FOLD-INS on the Codex prong with 6 HIGH / 3 MED / 3 LOW / 3 META findings. The arc spans:
   - `7a08938` Slice 47 META — phase-review classifier + comprehensive review files committed
   - `db5253d` Slice 47a — dispatch-event provenance + AGENT_SMOKE schema v2 + P2-MODEL-EFFORT plan amendment
   - `7d485c9` Slice 47a Codex fold-ins — 3 HIGHs + 2 MEDs + 1 LOW absorbed
   - `eed12fa` Slice 47b — hook behavioral tests + portable engine stub + dogfood-smoke tsx EPERM fix
   - `d1dd56e` Slice 47c partial — ADR-0007 §3 forbidden scalar-progress firewall + Check 34
   - `19ea401` Slice 47c-2 — operator decision ratified (Option A literal challenger policy)
   - `1c4a5b1` Slice 47c / 47b-retro — Codex challenger fold-ins for Slice 47b (retroactive)
   - `73c729c` Slice 47c / 47c-partial-retro — Codex challenger fold-ins for Slice 47c partial (retroactive)

2. **Past-slice amnesty scope (5 commits)** per the Slice 47c-2 operator decision + Codex MED 1 deferred binding at `specs/plans/slice-47-hardening-foldins.md` §Slice 47d scope item 1:
   - `b1dd9af` Slice 43a — validateWorkflowKindPolicy helper extraction
   - `48bcab8` Slice 43b — runDogfood async + real-adapter seam
   - `7bc3543` Slice 43c — explore end-to-end fixture run (CC#P2-1 + CC#P2-2 close)
   - `8999bb0` Slice 45a — DispatchFn structured-dispatcher refactor
   - `ee23c3c` Slice 46b — continuity-lifecycle integration test (CC#P2-4 first-claim close)

   Each of these 5 slices advanced ratchets (contract-test count, audit-coverage check, or qualitative) without a per-slice Codex challenger pass, under the then-permissive "no governance-surface movement → no Codex" interpretation that Slice 47c-2 retired.

**Method.** Each commit opened via `git show --stat`; every non-trivial file change tracked to its current HEAD state; per-slice Codex reviews consulted for per-commit findings; seam points between slices inspected for drift that no individual commit owned.

**Mechanical cross-check.** Replicated `countTests(null)` in Node against the current `git ls-files -- tests` set: 43 files, 1042 static `it()`/`test()` declarations. This is the authoritative floor-advance target, not the 1094 vitest-runtime count referenced in the continuity narrative. (The runtime count is higher because some `describe` blocks expand at runtime; the audit gate uses the deterministic static count, per `scripts/audit.mjs:416-433`.)

## Summary

Opening verdict: **REJECT-PENDING-FOLD-INS.** Three HIGH findings and three MED findings require fold-in before this ceremony commit lands. After fold-in in the same ceremony commit (per Check 26 same-commit-staging discipline), closing verdict: **ACCEPT-WITH-FOLD-INS.**

The arc produced the right outcomes at each slice boundary. Per-slice Codex reviews caught per-slice concerns (8 HIGHs, 5 MEDs, 3 LOWs folded in across the arc). The Slice 47c-2 operator decision closed the long-running policy-vs-practice drift on CLAUDE.md §Hard invariant #6 that the comprehensive review's Codex HIGH 5 originated. The audit-firewall half (Check 34 + pattern enumeration + tightened citation guards) is load-bearing on the most operator-visible surfaces and is now strictly tightening. The CC#P2-4 close-state history ledger in ADR-0007 makes the claim-close-reopen-reclose trajectory legible to future readers.

What the composition review surfaces are three boundary seams the per-slice passes could not see:

1. **The firewall's scan scope is too narrow.** `tests/runner/continuity-lifecycle.test.ts:12` contains a forbidden ADR-0007 §3 scalar-progress phrase ("count advances 2/8 → 3/8") introduced at Slice 46b (amnesty scope). The file is outside `FORBIDDEN_PROGRESS_SCAN_FILES`. Check 34 does not catch it. This is the exact concern the Slice 47c-partial-retro MED 1 deferral named, now materialized in a concrete violating line.

2. **The mechanical-enforcement check must land NOW with a shape that does not self-reject the ceremony commit.** Slice 47c-2 Codex MED 2 deferred a check to "the next slice that ATTEMPTS to advance `specs/ratchet-floor.json`, OR adds a `tests/**/*.test.*` file, OR modifies `scripts/audit.mjs`." Slice 47d triggers all three. The first-version shape (scan HEAD commit body for exact `Codex challenger: REQUIRED` declaration; require matching `arc-slice-<slice>-codex.md` OR `arc-subsumption:` field) must explicitly accept the arc-subsumption form — otherwise the Slice 47d ceremony commit itself fails the check because its Codex pass IS the arc-close composition review, not a per-slice review.

3. **Check 26 does not bind this arc.** `ARC_CLOSE_GATES` currently enumerates only two gates (pre-P2.4 fold-in arc; P2.4 + P2.5 adapter+e2e arc). The Slice 47 hardening fold-in arc has its own plan file (`specs/plans/slice-47-hardening-foldins.md`) but no gate entry, so Check 26 will not enforce the two-prong review requirement on Slice 47d's close. The gate must be added in this ceremony commit.

The past-slice amnesty closure path is structurally sound: the composition review's broader-than-arc scope provides the cross-model adversarial coverage the five past slices did not receive at landing. Per-slice attention to 43a/43b/43c/45a/46b surfaced one structural concern (the CC#P2-4 first-claim hollowness at 46b, already acknowledged and folded in via 47b + 47b-retro + the ADR-0007 close-state history ledger) and one residual forbidden-phrase drift (HIGH 1 above, originating at 46b).

## HIGH

### HIGH 1 — Tracked forbidden scalar-progress phrase outside Check 34 scan scope (boundary seam: 46b → 47c)

**Finding:** `tests/runner/continuity-lifecycle.test.ts:12` contains the line `// count advances 2/8 → 3/8.` This is an operator-visible scalar-progress statement about Phase 2 close-criteria count — precisely the wording family ADR-0007 §3 forbids. The file was introduced at Slice 46b (`ee23c3c`, amnesty scope). It survives to HEAD (`73c729c`).

The Check 34 firewall (landed at Slice 47c partial; tightened at 47c-partial-retro) does not catch this because `FORBIDDEN_PROGRESS_SCAN_FILES` (`scripts/audit.mjs:3768-3775`) is scoped to six governance-surface files:

```
'PROJECT_STATE.md',
'README.md',
'specs/ratchet-floor.json',
'specs/plans/phase-2-implementation.md',
'specs/plans/phase-1-close-revised.md',
'specs/plans/slice-47-hardening-foldins.md',
```

The scan does not reach `tests/` nor the broader `specs/` tree. The Slice 47c-partial-retro MED 1 deferral at `PROJECT_STATE.md` current entry named this gap abstractly ("scan scope narrower than ADR-0007 §6.3 surface + plan claim") with a hard bounded trigger for the next governance-surface addition. This finding escalates the abstract MED to a concrete HIGH because an in-tree violating line exists NOW.

**Evidence:**
- `tests/runner/continuity-lifecycle.test.ts:12` — the violating line
- `scripts/audit.mjs:3768-3775` — `FORBIDDEN_PROGRESS_SCAN_FILES` enumeration (scoped to 6 files)
- `scripts/audit.mjs:3742-3766` — `ADR_0007_FORBIDDEN_PROGRESS_PATTERNS` rejects the pattern `\b\d+\/8\b` at line 3743, which would match the forbidden `2/8` and `3/8` phrasings
- Slice 46b commit `ee23c3c` introduced `tests/runner/continuity-lifecycle.test.ts` (amnesty scope)
- Slice 47c-partial-retro (`73c729c`) PROJECT_STATE current entry §MED 1 deferral text

**Impact:** The firewall is load-bearing at the most operator-visible surfaces but silent on tracked code comments that make the same operator-visible claim in a form that would render in README badges, documentation extracts, or AI-agent summaries that read the repo tree holistically. A future reader (human or agent) surveying "what's closed in Phase 2?" by grep could find the `2/8 → 3/8` comment (which ADR-0007 §3 forbids) and believe the scalar claim — the exact failure mode ADR-0007 §3 was written to reject.

**Remediation (recommended, incorporable in ceremony commit):** Scrub the comment at `tests/runner/continuity-lifecycle.test.ts:12` to per-criterion wording. Example: `// With this test green, CC#P2-4 (session hooks + continuity lifecycle) closes.` No other content change required; the comment exists to explain the test's motivation.

Alternate path (rejected): Expand `FORBIDDEN_PROGRESS_SCAN_FILES` to cover `tests/**/*.test.*`. Rejected because (a) tests legitimately include forbidden phrases as test INPUTS (the slice-47c-forbidden-progress-firewall.test.ts fixtures intentionally do this), which would require a smarter scan mode that distinguishes test-input contexts from comment contexts, and (b) that scope-expansion engineering decision is exactly what MED 1's hard bounded trigger defers to a separate slice with proper false-positive tuning. Scrubbing the single violating comment is the minimal + correct fold-in here.

**Disposition:** To be incorporated in the Slice 47d ceremony commit.

### HIGH 2 — Slice 47c-2 Codex MED 2 mechanical-enforcement check must land with arc-subsumption acceptance, else the ceremony commit self-rejects

**Finding:** The Slice 47c-2 Codex MED 2 deferral at `specs/plans/slice-47-hardening-foldins.md` §Slice 47c-2 + `PROJECT_STATE.md` Slice 47c-2 entry specifies:

> **MED 2 deferred → next-ratchet-advancing-slice co-landing requirement:** A mechanical-enforcement audit check MUST land in or before the next slice that ATTEMPTS to advance specs/ratchet-floor.json, OR adds a tests/**/*.test.* file, OR modifies scripts/audit.mjs — whichever fires first. First-version shape: scan slice commit body for exact `Codex challenger: REQUIRED` declaration AND verify a corresponding specs/reviews/arc-slice-<slice>-codex.md OR an explicit arc-subsumption field naming the future arc-close review that will cover it.

Slice 47d is the next slice that triggers the co-landing requirement across **all three** dimensions: (a) advances `specs/ratchet-floor.json` from 988 → 1042; (b) modifies `scripts/audit.mjs` (to add the MED 2 check + add a new `ARC_CLOSE_GATES` entry per HIGH 3 below); and (c) may add test files covering the new check.

The first-version check shape must be carefully specified. If the check scans commit body for exact `Codex challenger: REQUIRED` and requires a matching `specs/reviews/arc-slice-<slice>-codex.md` file, the Slice 47d ceremony commit itself will fail the check because the arc-close review files do not carry per-slice review names (`arc-slice-47d-codex.md`) but instead carry composition-review names (`arc-slice-47-composition-review-codex.md`). The check's design must include the third branch: if the commit body carries an `arc-subsumption:` field identifying the composition review, the check accepts this as the Codex-pass substitute.

Additionally, the first-version shape should be narrow: it applies only when the commit body declares the exact phrase `Codex challenger: REQUIRED`. A commit that says `Codex challenger: NOT required` (e.g., non-ratchet trivia) is out of scope. A commit that says `Codex challenger: SATISFIED by the upstream review at specs/reviews/arc-slice-<N>-codex.md` (the fold-in commit pattern observed at 7d485c9, 1c4a5b1, 73c729c) should also pass by virtue of the named file existing.

**Evidence:**
- `PROJECT_STATE.md` current entry (Slice 47c-2 retained in entry below historical marker) + Slice 47c-partial-retro current entry §MED 2 disposition — the mechanical-enforcement trigger specification
- `specs/plans/slice-47-hardening-foldins.md` §Slice 47c-2 Codex challenger fold-in disposition MED 2 — the plan binding
- Slice 47d plan text at `specs/plans/slice-47-hardening-foldins.md` §Slice 47d Codex challenger: `Arc-close composition review IS the Codex challenger pass.` — the arc-subsumption pattern
- Commit bodies 7d485c9, 1c4a5b1, 73c729c — all declare `Codex challenger pass: NOT required` or `Codex challenger pass: SATISFIED by the upstream review at ...`, none use exact `Codex challenger: REQUIRED`

**Impact:** If the check is written in its first-version shape literally (only accepting exact `Codex challenger: REQUIRED` → matching `arc-slice-<slice>-codex.md`), the Slice 47d ceremony commit lands RED on audit. Check 26 would also go RED because the prong files would be present but the new MED 2 check would reject the commit. The arc-close ceremony would fail the very audit gate it is trying to tighten.

**Remediation (incorporable in ceremony commit):** Author the check with three accept branches:

1. Commit body does NOT contain `Codex challenger: REQUIRED` (exact phrase) → check not applicable → green.
2. Commit body contains `Codex challenger: REQUIRED` (exact phrase) AND `specs/reviews/arc-slice-<slice>-codex.md` exists (where `<slice>` is extracted from commit subject's `slice-<N>:` prefix, first matching any letter-suffixed variant for 47-arc commits) → green.
3. Commit body contains `Codex challenger: REQUIRED` (exact phrase) AND an `arc-subsumption:` field that names an existing `specs/reviews/arc-slice-<N>-composition-review-codex.md` file → green.

Any commit with `Codex challenger: REQUIRED` but no matching per-slice file AND no arc-subsumption declaration → red.

For Slice 47d itself: the ceremony commit body should include both `Codex challenger: REQUIRED (governance-surface movement + ratchet advance)` AND `arc-subsumption: specs/reviews/arc-slice-47-composition-review-codex.md` so branch (3) fires green.

**Disposition:** To be incorporated in the Slice 47d ceremony commit.

### HIGH 3 — `ARC_CLOSE_GATES` does not bind this arc; Check 26 will not enforce two-prong discipline on Slice 47d close

**Finding:** `scripts/audit.mjs:3142-3157` defines `ARC_CLOSE_GATES` with two entries:

```
{ arc_id: 'phase-2-foundation-foldins-slices-35-to-40', ceremony_slice: 40, plan_path: 'specs/plans/phase-2-foundation-foldins.md', ... }
{ arc_id: 'phase-2-p2.4-p2.5-arc-slices-41-to-43', ceremony_slice: 44, plan_path: 'specs/plans/phase-2-implementation.md', ... }
```

The Slice 47 hardening fold-in arc has a dedicated plan file (`specs/plans/slice-47-hardening-foldins.md`) with 8 slices and explicit arc-close ceremony at Slice 47d. Per CLAUDE.md §Cross-slice composition review cadence, this arc (≥3 slices; modifies privileged runtime at 47a) requires a two-prong arc-close review. Per Slice 40 convergent-HIGH fold-in, Check 26 is the mechanical enforcement of the cadence rule.

Without an `ARC_CLOSE_GATES` entry for this arc, Check 26 falls back to its applicable-gates filter (`scripts/audit.mjs:3173-3175`). The filter only considers gates whose `plan_path` exists. The Slice 47 arc plan exists but has no gate entry, so Check 26 silently skips it. The two-prong discipline is then honor-system at Slice 47d, which is the exact failure mode the Slice 40 convergent HIGH fold-in was designed against.

**Evidence:**
- `scripts/audit.mjs:3142-3157` — `ARC_CLOSE_GATES` current two-entry enumeration
- `scripts/audit.mjs:3173-3182` — applicable-gates filter behavior
- CLAUDE.md §Cross-slice composition review cadence — two-prong binding authority
- `specs/plans/slice-47-hardening-foldins.md` — the arc plan file (exists; has 8 slices; declares Slice 47d as ceremony)

**Impact:** Slice 47d closes without mechanical enforcement of the two-prong requirement. Even with both prong files authored and staged per same-commit discipline, Check 26's silent no-op means a future ceremony slice (47 arc or later) that forgets one prong lands green. The ratchet regresses without tripping audit.

**Remediation (incorporable in ceremony commit):** Add a third `ARC_CLOSE_GATES` entry:

```js
Object.freeze({
  arc_id: 'slice-47-hardening-foldins',
  description: 'Slice 47 hardening fold-in arc',
  ceremony_slice: 47,  // numerically 47 (matches parseInt('47d', 10) after non-digit strip)
  plan_path: 'specs/plans/slice-47-hardening-foldins.md',
  review_file_regex: /arc.*47.*composition/i,
}),
```

The regex `/arc.*47.*composition/i` distinguishes the arc-close composition review (`arc-slice-47-composition-review-{claude,codex}.md`) from the per-slice reviews (`arc-slice-47{a,b,c,c-2}-codex.md`), preserving the Slice 40 two-prong disambiguation. The numeric `ceremony_slice: 47` works with Check 26's existing `parseInt(marker.replace(/[^0-9]/g, ''), 10)` logic (line 3192), where `47d` → `47` matches the gate's ceremony_slice.

**Caveat on ceremony_slice vs current_slice string form.** Because `47c` and `47d` both parse to numeric 47, the gate fires as-closed from current_slice=47c onward. This means the gate WOULD have fired RED on any commit after Slice 47 (7a08938) advanced current_slice marker to `47` numerically. The reason the gate stays green in the ceremony commit is that the same commit stages both prong files before audit runs. A corollary: landing only the `ARC_CLOSE_GATES` entry without the prong files in the SAME commit would fail the audit. This is consistent with Check 26 same-commit-staging discipline; documenting the caveat explicitly in the ceremony commit body is worthwhile.

**Disposition:** To be incorporated in the Slice 47d ceremony commit.

## MED

### MED 1 — Amnesty-scope coverage must include per-slice body sections, not just frontmatter

**Finding:** The Slice 47c-2 Codex MED 1 deferred binding specifies both prong files MUST carry `amnesty_scope: [43a, 43b, 43c, 45a, 46b]` frontmatter. The structural declaration is necessary but not sufficient — the plan's §Slice 47d scope item 1 amendment says "the composition-review prompt MUST name the past slices in its scope-disclosure block so the verdict explicitly covers them."

Beyond naming them in scope, the review BODY needs per-slice adversarial sections covering each amnesty-scope slice with concrete evidence paths. Without per-slice sections, the amnesty closure is prose-only: the frontmatter field exists, the scope discloses the five slices, but the review produces no finding-by-slice analysis that would demonstrate the broader-than-arc scope was actually exercised.

**Evidence:**
- `specs/plans/slice-47-hardening-foldins.md` §Slice 47d scope item 1 + item 5 — the binding text
- This review file's frontmatter carries `amnesty_scope: [43a, 43b, 43c, 45a, 46b]`
- This review's Summary + HIGH 1 address amnesty-scope (HIGH 1 originates from Slice 46b)
- But per-slice sections for 43a, 43b, 43c, 45a individually not yet authored at first-draft time

**Impact:** If the amnesty closure path is taken by frontmatter + scope disclosure only, a future reader trying to verify "did Slice 47d actually cover past-slice drift?" has only a generic verdict to rely on. The efficiency-over-breadth trade-off is still defensible, but only if per-slice sections make the per-slice adversarial pass visible.

**Remediation (incorporable in this review):** Add `## Amnesty-scope per-slice sections` below the primary findings, with one short paragraph per slice naming (a) the ratchet advanced, (b) the implementation scope, (c) what a hypothetical per-slice Codex pass would have caught at landing, (d) whether the concern was subsequently folded in by a later slice in the primary arc.

**Disposition:** Folded in within this review (see §Amnesty-scope per-slice sections below).

### MED 2 — Floor-advance narrative must distinguish static-count 1042 from vitest-runtime count 1094

**Finding:** The continuity narrative carried across session boundaries (read out of `/circuit:handoff resume`) states "Test count 1094 above pinned floor 988." The number 1094 is the vitest runtime passed count. The pinned ratchet metric is the static `it()`/`test()` declaration count per `scripts/audit.mjs::countTests` at lines 418-433, which regex-matches `/^\s*(it|test)\(/gm` against git-tracked test files.

Replicating `countTests(null)` against HEAD=73c729c yields 43 files, 1042 declarations. This is the authoritative floor-advance target for Slice 47d. The difference (1094 - 1042 = 52) reflects describe-block loops that expand at runtime but do not match the static regex (e.g., `it.each`, `for (...) { it(...) }`, and context-scope amplifications).

**Evidence:**
- `scripts/audit.mjs:418-433` — `countTests` implementation
- Replicated count in Node at HEAD: 43 files, 1042 declarations
- Continuity narrative states 1094 (vitest runtime)
- Ratchet-floor.json notes field explicitly specifies the static metric: "the static declaration count produced by scripts/audit.mjs::countTests (matches /^\\s*(it|test)\\(/gm across git-tracked tests/**/*.test.* files), not the vitest runtime total"

**Impact:** If the Slice 47d ceremony commit body cites `1094` as the floor-advance target, it creates narrative drift between the commit body and the actual `ratchet-floor.json` value. A future reader parsing the commit body for arc-accounting ("+106 tests in Slice 47 arc") gets the wrong delta. The correct arc-wide delta is 1042 − 988 = **+54 static declarations** across the 8 arc commits.

**Remediation (incorporable in ceremony commit):** Cite the static count explicitly in the commit body and PROJECT_STATE entry. Suggested wording: "Ratchet-floor.json advanced 988 → 1042 (+54 static declarations across Slice 47 arc; the vitest runtime count is higher at 1094 due to describe-loop expansion, but the audit gate uses the deterministic static count per `scripts/audit.mjs:418-433`)."

**Disposition:** To be incorporated in the Slice 47d ceremony commit body + `ratchet-floor.json` notes field extension.

### MED 3 — Framing-triplet audit yellow is arc-carryover, not 47-arc-originating; disposition should land in ceremony commit

**Finding:** The continuity narrative carries forward a pre-existing `framing-triplet carryover audit yellow` that predates the 47 arc. The yellow is not from this arc's work but surfaces on every audit run. Without explicit disposition in the ceremony commit, the yellow persists into the post-arc baseline and future slices inherit ambiguity on whether it is noise or signal.

**Evidence:**
- Continuity narrative state block: "CONSTRAINT: framing-triplet carryover audit yellow is pre-existing (not from this session's work); to be investigated under future slice."
- Current audit state: 30 green / 3 yellow / 0 red per continuity
- The three yellows: framing-triplet carryover + AGENT_SMOKE schema_version 1 stale by design + CODEX_SMOKE adapter_source_sha256 drift by design

**Impact:** Yellows accumulate into audit noise. The AGENT_SMOKE + CODEX_SMOKE yellows are documented as by-design (operator-local refresh path named in continuity). The framing-triplet yellow has no such disposition — it's a deferred investigation with no named remediation slice.

**Remediation (incorporable in ceremony commit body):** Name the yellow's provenance in the ceremony commit body as a deferred investigation with either (a) a specific slice commitment (e.g., "framing-triplet investigation deferred to Slice 48 or the next framing-citation-touching slice") OR (b) an explicit acknowledgment-by-design with rationale.

**Disposition:** Minor disposition text in the ceremony commit body.

## LOW

### LOW 1 — ADR-0007 CC#P2-4 close-state history ledger text could note audit-enforcement status

**Finding:** ADR-0007 CC#P2-4 §Close-state history (authored at 47b-retro) produces a four-row ledger of CC#P2-4 transitions (claim / reopen / reclose-hook-behavior / reclose-lifecycle-integration). The ledger text says "A future slice that modifies the CC#P2-4 binding text MUST amend this table (add a row) rather than rewrite history." This is an honor-system discipline directive. No audit check enforces it.

**Evidence:**
- `specs/adrs/ADR-0007-phase-2-close-criteria.md` §CC#P2-4 Close-state history table
- No matching check in `scripts/audit.mjs` scanning for ledger-row additions on CC#P2-4 binding-text diffs

**Impact:** The ledger discipline depends entirely on future slice authors honoring the prose rule. A rename of CC#P2-4 binding text without a ledger row would land green.

**Remediation (optional; defer to follow-up):** A future slice could add an audit check that scans for CC#P2-4 binding-text modifications in git diff and requires a matching row addition in the ledger. Low-priority given the narrow scope of CC#P2-4 modifications expected going forward.

**Disposition:** Defer to operator discretion — note in ceremony commit body as acknowledged honor-system discipline.

### LOW 2 — PROJECT_STATE current-entry prose could link directly to the arc-close review file

**Finding:** The Slice 47d PROJECT_STATE entry to-be-authored should include a direct link to `specs/reviews/arc-slice-47-composition-review-{claude,codex}.md` for audit-trail traceability. The prior arc-close slices (40, 44) link to their composition review files in the respective PROJECT_STATE entries; the Slice 47d entry should do the same.

**Evidence:**
- PROJECT_STATE.md Slice 40 + Slice 44 entries (composition-review references)
- Slice 47d entry not yet authored

**Impact:** Minor — missing the link does not break any gate, but makes audit-trail navigation slower.

**Remediation (incorporable in ceremony commit):** Include explicit path references in Slice 47d PROJECT_STATE entry.

**Disposition:** To be incorporated in the Slice 47d PROJECT_STATE entry.

## META

### META 1 — Fresh-read is aspirational; the author is the same Claude instance orchestrating the ceremony commit

**Observation:** This review is authored in the same session that orchestrates the Slice 47d ceremony commit. Fresh-read is aspirational: the author has just dispatched Codex on the primary arc + amnesty scope and has seen the continuity record's framing before authoring. Counter: the author's substantive session context was truncated at `/clear` per the context-guard directive; this session begins with empty context and re-reads HEAD state. The `opened_scope` enumeration lists the reads performed in this session; no prior-session insights are carried beyond what HEAD state encodes and what the continuity narrative discloses.

**Mitigation:** The Codex prong (dispatched to `codex exec` subprocess with the full arc + amnesty scope brief) is run by a different model with no shared session state. Knight & Leveson 1986 correlated-failures cautions about cross-model diversity still apply (gpt-5-codex and claude-opus-4-7 are not independent), but session-diversity is preserved between prongs.

**Disposition:** Acknowledged; no action required.

## Amnesty-scope per-slice sections

Each past slice below advanced a ratchet at landing without a per-slice Codex challenger pass, under the then-permissive "no governance-surface movement → no Codex" interpretation now retired. A hypothetical per-slice Codex pass at landing might have caught the following concerns:

### Slice 43a — `b1dd9af` — `validateWorkflowKindPolicy` helper extraction

**Ratchet advanced:** +15 static declarations in `tests/contracts/workflow-kind-policy.test.ts`. Helper-extraction refactor moving dispatch-policy validation logic into `src/runtime/policy/workflow-kind-policy.ts` as a pure function. No runtime behavior change.

**Hypothetical per-slice Codex concerns:** Pure helper extraction is structurally sound; the primary Codex concern would likely be (a) the test suite duplicates audit-side logic, creating two sources of truth until (ADR-0008 audit side) converges — already tracked in `scripts/policy/workflow-kind-policy.mjs` as the audit-side wrapper. No drift evident at HEAD.

**Subsequent fold-in:** None required. Slice 43a is structurally complete.

### Slice 43b — `48bcab8` — `runDogfood` async + real-adapter seam

**Ratchet advanced:** +0 static declarations; qualitative "dispatch-realness" ratchet advanced as an enabler (no numeric floor change). Made `runDogfood` async so the dispatch branch can `await` a real adapter; introduced `DispatchFn` injection seam (later refactored at 45a); routed the dispatch branch through `dispatchAgent` + `materializeDispatch` per ADR-0007 §Amendment Slice 37 + ADR-0009 §1.

**Hypothetical per-slice Codex concerns:** The injection seam's initial bare-function shape (`DispatchFn = (input) => Promise<DispatchResult>`) was load-bearing for Codex's Slice 45 HIGH 3 finding (materializer hardcoded `adapterName: 'agent'`; injecting a codex-shaped dispatcher silently lied on `dispatch.started.adapter`). This was a foreseeable seam: once the injection surface exists without an adapter-identity discriminant, future adapter routing through it will drift.

**Subsequent fold-in:** Slice 45 Codex HIGH 3 → Slice 45a DispatchFn structured-descriptor refactor (amnesty scope itself; see below).

### Slice 43c — `7bc3543` — explore end-to-end fixture run (CC#P2-1 + CC#P2-2 close)

**Ratchet advanced:** +24 static declarations. New `tests/runner/explore-e2e-parity.test.ts` (14 declarations) + `tests/contracts/slice-43c-agent-smoke-fingerprint.test.ts` (10 declarations). New audit Check 30 (`checkAgentSmokeFingerprint`) binding ADR-0007 CC#P2-2 CI-skip semantics. New AGENT_SMOKE fingerprint fixture at `tests/fixtures/agent-smoke/last-run.json`.

**Hypothetical per-slice Codex concerns:** The AGENT_SMOKE fingerprint Check 30 at 43c was **schema v1** (carrying `commit_sha` + `result_sha256` only). Codex's Slice 47a HIGH 4 later caught this as asymmetric with CODEX_SMOKE v2 (which had `adapter_source_sha256` + `cli_version` added by Slice 45). The gap was foreseeable: a per-slice Codex pass at 43c might have flagged either "inadequate detectiveness" (if reviewer compared to what CODEX_SMOKE was in flight toward) or been content with v1 (if reviewer did not look forward). Most likely outcome: v1 would have been accepted at 43c with an explicit "deferred to symmetric upgrade" note, similar to what actually happened at 47a.

**Subsequent fold-in:** Slice 47a promoted AGENT_SMOKE v1 → v2 with `adapter_source_sha256` + `cli_version`. Symmetric closure now complete. The fixture `tests/fixtures/agent-smoke/last-run.json` remains schema_version 1 by design (operator-local refresh path documented).

### Slice 45a — `8999bb0` — `DispatchFn` structured-dispatcher refactor

**Ratchet advanced:** +1 static declaration in `tests/runner/runner-dispatch-adapter-identity.test.ts`. Structural refactor: `DispatchFn` type flipped from bare function to `{ adapterName: BuiltInAdapter; dispatch: ... }` descriptor; materializer call site reads `adapterName` from descriptor instead of literal.

**Hypothetical per-slice Codex concerns:** This slice IS the Codex-initiated fold-in (deferred from Slice 45 Codex pass HIGH 3). The structural pattern is sound: the descriptor binds adapter-identity at the injection seam, so future adapter routing lands correctly. Possible Codex concern: the default dispatcher is lazy-imported via `import('./adapters/agent.js')` inside `resolveDispatcher` (`src/runtime/runner.ts:191-200`); tests that stub the dispatcher bypass the import entirely, so a stub that forgets to set `adapterName` drifts silently. The regression test at `tests/runner/runner-dispatch-adapter-identity.test.ts` catches this exact drift — already covered.

**Subsequent fold-in:** None required. Slice 45a closed the Slice 45 HIGH 3 reopen trigger.

### Slice 46b — `ee23c3c` — continuity-lifecycle integration test (CC#P2-4 first-claim close)

**Ratchet advanced:** +12 static declarations in `tests/runner/continuity-lifecycle.test.ts`. Subprocess-driven lifecycle assertions over `.circuit/bin/circuit-engine continuity {save,status,resume,clear}` CLI surface. First claim of CC#P2-4 close.

**Hypothetical per-slice Codex concerns:** Two concerns a per-slice Codex pass at 46b would likely have caught:

1. **The CC#P2-4 first-claim was structurally hollow.** CC#P2-4's text names "session hooks" (plural) + lifecycle. Slice 46 landed the hook scripts; Slice 46b landed the engine-lifecycle integration. Neither slice executed the hook scripts against the engine. A behavioral reader would conclude CC#P2-4 was "closed" at 46b by the union of (scripts present + engine-lifecycle tested), but the union never tested the scripts' behavior. This is exactly what Slice 47a comprehensive review Codex HIGH 2 caught retroactively.

2. **The test file itself contains a forbidden ADR-0007 §3 scalar-progress phrase.** `tests/runner/continuity-lifecycle.test.ts:12` says `// count advances 2/8 → 3/8.` — introduced at 46b, surviving to HEAD. See HIGH 1 above.

**Subsequent fold-in:** Slice 47b + 47b-retro reclosed CC#P2-4 with behavioral + lifecycle integration tests (see ADR-0007 close-state history ledger). HIGH 1 above proposes scrubbing the forbidden comment in the Slice 47d ceremony commit.

## Closing verdict

**ACCEPT-WITH-FOLD-INS** *(after the Slice 47d ceremony commit absorbs HIGH 1 + HIGH 2 + HIGH 3 + MED 1 + MED 2 + MED 3 + LOW 1 + LOW 2 per the dispositions above).*

Rationale:
- The arc produced the right outcomes at each slice boundary. Per-slice Codex reviews caught per-slice concerns (8 HIGHs + 5 MEDs + 3 LOWs folded in across the arc).
- Slice 47c-2 closed the policy-vs-practice drift authoritatively; CHALLENGER-I2 is now strictly tightening with explicit past-slice amnesty path.
- The audit-firewall half (Check 34 + pattern enumeration + tightened citation guards) is load-bearing on operator-visible surfaces and is still strictly tightening.
- CC#P2-4 close-state history ledger makes the claim-close-reopen-reclose trajectory legible.
- The three HIGH boundary-seam findings surface three concrete actions (scrub the forbidden comment at `tests/runner/continuity-lifecycle.test.ts:12`; land the MED 2 check with arc-subsumption acceptance; add the `ARC_CLOSE_GATES` entry). All three are absorbable in the Slice 47d ceremony commit and strengthen the audit ratchet rather than weaken it.
- The past-slice amnesty closure path is structurally sound; per-slice sections above make the broader-than-arc scope visible.

Single-prong satisfaction is explicitly rejected by Check 26 (Slice 40 convergent HIGH fold-in) — this review is paired with the Codex composition-adversary prong at `specs/reviews/arc-slice-47-composition-review-codex.md`, authored in the same ceremony commit.

After fold-in, Slice 47d closes the Slice 47 hardening fold-in arc and enables the next session to open P2.8 router or P2-MODEL-EFFORT against an honest audit baseline.
