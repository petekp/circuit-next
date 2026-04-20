---
name: arc-slice-26b-codex
description: Codex challenger pass on the drafted Slice 26b working-tree diff (status-epoch alignment + status-docs-current + pinned ratchet floor + ADR-0002 Addendum A).
type: review
reviewer_model: gpt-5-codex
reviewer_model_id: gpt-5-codex
authorship_role: challenger
review_kind: challenger
review_date: 2026-04-20
verdict: REJECT pending HIGH fold-ins → incorporated → ACCEPT
authored_by: gpt-5-codex + claude-opus-4-7
target_kind: arc
target: slice-26b
target_version: 1556822+working-tree-diff
review_target: arc-slice-26b-status-epoch-and-pinned-floor
arc_target: slice-26b
arc_version: 1556822..HEAD (Slice 26b working tree)
opening_verdict: REJECT pending HIGH fold-ins
closing_verdict: ACCEPT (after 2 HIGH + 5 MED + 2 LOW fold-ins; META-1 partial — 27d TODO note added to plan)
commands_run:
  - read scripts/audit.mjs (new helpers + Check 17/18/19 wiring)
  - read scripts/audit.d.mts (new type declarations)
  - read specs/ratchet-floor.json (initial floor + metadata)
  - read tests/contracts/status-epoch-ratchet-floor.test.ts (red/green fixtures)
  - read README.md (marker placement)
  - read PROJECT_STATE.md (marker placement + slice narrative)
  - read TIER.md (rows moved planned → enforced)
  - read specs/adrs/ADR-0002-bootstrap-discipline.md (Addendum A)
  - read specs/plans/phase-1-close-revised.md (Slice 26b deliverables + Slice 27d scope)
  - traced countTests(null) against working-tree via git-ls-files + static regex
  - constructed temp-git repo to verify checkStatusDocsCurrent returns red on stale-unison fixture
opened_scope:
  - scripts/audit.mjs
  - scripts/audit.d.mts
  - specs/ratchet-floor.json
  - tests/contracts/status-epoch-ratchet-floor.test.ts
  - README.md
  - PROJECT_STATE.md
  - TIER.md
  - specs/adrs/ADR-0002-bootstrap-discipline.md
  - specs/plans/phase-1-close-revised.md (Slice 26b + Slice 27d sections only)
skipped_scope:
  - bootstrap/
  - specs/contracts/ (no contract surface touched by this slice)
  - specs/invariants.json (ledger tracks contract invariants; this slice is audit-machinery and adds no invariants)
  - specs/methodology/ (no methodology amendment in this slice)
---

# Codex Challenger Pass — Slice 26b

## Context

Slice 26b closes three TIER.md `planned → 26b` rows: `status_docs_current`, `pinned_ratchet_floor`, `current_slice_status_epoch`. The slice adds structured `<!-- current_slice: <id> -->` HTML-comment markers to README.md / PROJECT_STATE.md / TIER.md, three new audit dimensions (Check 17/18/19 in `scripts/audit.mjs`), a pinned floor at `specs/ratchet-floor.json`, ADR-0002 Addendum A documenting the pinned-floor pattern, and a new test file `tests/contracts/status-epoch-ratchet-floor.test.ts`. The close-gate hole being targeted is that `checkPhaseDrift` is agreement-only (if README and PROJECT_STATE both tell a stale story the audit is green) and the contract-test ratchet (Check 6) uses `HEAD~1` moving-window comparison (a regression commit followed by a docs-only commit slides the window forward and the regression goes green).

Dispatched via `/codex` skill per CHALLENGER-I5. Reviewer was told to produce an objection list (adversarial lint), not approval.

## Verdict

**Opening:** REJECT pending HIGH fold-ins (2 HIGH + 5 MED + 2 LOW + 1 META)

**Closing:** ACCEPT (after all HIGH + MED + LOW incorporated; META-1 partial — 27d TODO note added to plan)

## Findings and dispositions

### HIGH (2)

**HIGH-1 — Pinned floor below post-slice HEAD leaves the moving-window hole open.**
Anchor: `specs/ratchet-floor.json:4`, `scripts/audit.mjs:~1750` (checkPinnedRatchetFloor).
Rationale: staged tree's static test count is 556 (pre-fold-in) but the draft pinned floor at 530. Deleting `tests/contracts/status-epoch-ratchet-floor.test.ts` drops static count back to 530, so Check 19 is still green; Check 6 is red for one commit, then a docs-only commit slides `HEAD~1` and the original false-green returns.
**Disposition: ACCEPT.** Floor raised to 574 (final post-fold-in static count) in `specs/ratchet-floor.json` and the `notes` field rewritten to state "pins post-Slice-26b (post-Codex-fold-in) HEAD static count."

**HIGH-2 — Floor can be lowered or zeroed with audit green.**
Anchor: `scripts/audit.mjs:~1736` (previous `floor >= 0` guard), `specs/adrs/ADR-0002-bootstrap-discipline.md:~188`.
Rationale: draft `checkPinnedRatchetFloor` accepted any non-negative integer; `contract_test_count: 0` was valid and returned green when `headCount >= 0`. That contradicts the ADR's "explicit commit action" rule and leaves the ratchet silently relaxable in the same file that claims to enforce it.
**Disposition: ACCEPT.** New `validatePinnedRatchetFloorData` helper requires `contract_test_count > 0` (positive integer). `checkPinnedRatchetFloor` now routes through the helper and returns red on zero-or-negative floors. Red-fixture test added: `it('returns red when the floor field is not a positive integer ...')`. Cross-commit decrease detection (comparing against previous committed floor) deferred as a future enhancement — the positive-integer floor closes the trivially-bypassable relaxation path; the cross-commit case requires git-ancestry reads which the audit does not currently perform.

### MED (5)

**MED-1 — The core "both stale is red" behavior is not test-pinned.**
Anchor: `tests/contracts/status-epoch-ratchet-floor.test.ts` — the only `checkStatusDocsCurrent` test accepted `green | yellow | red`, so an implementation that always returned green would still pass. Codex verified the helper DOES return red on a temp-git stale-unison fixture; the suite does not protect that behavior.
**Disposition: ACCEPT.** Added temp-git fixtures using `initGitRepo` + `commitWithSubject` helpers: green fixture (docs match most recent slice commit), red fixture (docs all agree on stale id with newer slice commit ahead), red fixture (no slice-shaped commit in history), red fixture (alignment broken). Smoke-only live-repo test retained but no longer the sole coverage.

**MED-2 — Status freshness "unknown" is non-blocking.**
Anchor: `scripts/audit.mjs:~1746` (`findMostRecentSliceCommit` returning null → yellow).
Rationale: `findMostRecentSliceCommit` scans only 200 commits, and "no slice-shaped commit found" returned yellow; yellow exits 0. In a shallow checkout or after enough non-slice commits, status freshness becomes unverifiable but still non-blocking.
**Disposition: ACCEPT.** Made "no slice-shaped commit found" return red. Red-fixture test added (`returns red when no slice-shaped commit exists in history`). Rationale: a disciplined repo always has at least one `slice-<id>:` commit in the last 200 subjects; absence means discipline broken or shallow checkout — either way, blocking is the safe default. Full-history scan rejected as a fold-in because it costs proportional to commit count and 200 is already generous.

**MED-3 — Marker extraction is not anchored and ignores duplicates.**
Anchor: `scripts/audit.mjs:~1614` (draft `extractCurrentSliceMarker` returned the first regex hit anywhere in the file).
Rationale: if the top marker was deleted but a historical quoted marker remained later, or if two conflicting markers existed, the alignment check could read the wrong one.
**Disposition: ACCEPT.** Anchored extraction to the "status-header zone" (everything before the first `#` markdown heading) via new `sliceHeaderZone(text)` helper. Duplicate markers in the zone are rejected (returns null). Red-fixture tests added: marker-after-first-heading (rejected), duplicate-markers-in-header-zone (rejected), markers-below-heading-ignored (embedded in code blocks below the header zone are not read). All three live docs satisfy the zone rule by construction: README and PROJECT_STATE have the marker at line 1; TIER has it between frontmatter and the first `# TIER Claim Matrix` heading.

**MED-4 — Floor metadata is prose-enforced, not audit-enforced.**
Anchor: `scripts/audit.mjs:~1716` (previous `checkPinnedRatchetFloor` only validated `floors.contract_test_count`), `specs/adrs/ADR-0002-bootstrap-discipline.md:~188`.
Rationale: `schema_version`, `last_advanced_at`, and `last_advanced_in_slice` could be missing or malformed and Check 19 still went green as long as the numeric floor was acceptable. The ADR's "explicit commit action" rule therefore had no machine surface.
**Disposition: ACCEPT.** New exported helper `validatePinnedRatchetFloorData(floorData)` returns a list of error strings and enforces: `schema_version === 1` (literal), `floors.contract_test_count` positive integer, `last_advanced_at` matches `/^\d{4}-\d{2}-\d{2}$/`, `last_advanced_in_slice` matches `SLICE_ID_PATTERN`. `checkPinnedRatchetFloor` routes through it and returns red with every violation enumerated. Red fixtures added for each metadata field individually plus a combined-violations fixture.

**MED-5 — Slice-id regex admits draft / provisional / WIP subjects as canonical.**
Anchor: `scripts/audit.mjs:~1663` (previous `^slice-([0-9a-z-]+?):\s` accepted `slice-26b-wip:` and `slice-27c-b:`).
Rationale: the regex accepted arbitrary hyphenated alphanumeric ids, so a work-in-progress commit could become the "current slice" epoch; markers using `26b-wip` would similarly validate.
**Disposition: ACCEPT.** Introduced a single shared `SLICE_ID_PATTERN = /^[0-9]+[a-z]?$/` constant + `isValidSliceId(value)` helper. Both `extractCurrentSliceMarker` and `extractSliceIdFromCommitSubject` now post-validate the captured id against the pattern and return null on mismatch. `SLICE_COMMIT_SUBJECT_PATTERN` kept as the initial wide regex for compatibility with existing commit history; validation tightens at the extractor layer. Rejection tests added for `26ba`, `26b-wip`, `27c-b`, `phase-1`, and the empty / trailing-space cases. Widening the pattern requires an ADR amendment.

### LOW (2)

**LOW-1 — Audit numbering was visually out of order.**
Anchor: `scripts/audit.mjs:~2094..~2244` (draft printed Check 16 / 17 / 18 / 19 BEFORE Check 15 because verify was slotted below the Slice 26b checks).
**Disposition: ACCEPT.** Renumbered the verify-gate comment from Check 15 → Check 20 so the printed order matches the comment labels: 6 / 7 / 8 / 9 / 10 / 11 / 12 / 13 / 14 / 16 / 17 / 18 / 19 / 20. Gap at 15 retained as historical marker — gap preferred to reshuffling existing check labels mid-stream.

**LOW-2 — The audit comment and regex disagreed.**
Anchor: `scripts/audit.mjs:~1607` (comment said "regex on `^slice-<id>[a-z]?:`") vs `scripts/audit.mjs:~1663` (actual regex `^slice-([0-9a-z-]+?):\s`).
**Disposition: ACCEPT.** Updated the comment block to describe the actual `SLICE_ID_PATTERN = /^[0-9]+[a-z]?$/` shape and to note that `SLICE_COMMIT_SUBJECT_PATTERN` is deliberately wider (matches any hyphenated id shape) with the extractor-layer post-validation tightening it. Comment now documents why the two layers diverge.

### META (1)

**META-1 — "Close gate" binding still depends on future process.**
Anchor: `specs/plans/phase-1-close-revised.md:658` (Slice 27d), `package.json:17` (`verify` / `audit` scripts).
Rationale: Check 19 is wired into `npm run audit`, and audit exits non-zero on red, so it is not ornament. But the dogfood close gate itself does not exist yet; the binding is still plan prose until Slice 27d encodes "audit green required before evidence accepted."
**Disposition: PARTIAL.** Added a `close_gate_commands` TODO bullet to Slice 27d in `specs/plans/phase-1-close-revised.md` naming `npm run audit` as a required pre-evidence check. Full encoding (acceptance clause that says "if audit is red, `dogfood-run-0` rejects its own evidence") deferred to Slice 27d itself; Slice 26b's responsibility is to make the gate machine-enforceable, which it now is.

## Summary ledger

| class | count | disposition |
|---|---:|---|
| HIGH | 2 | 2 ACCEPT |
| MED | 5 | 5 ACCEPT |
| LOW | 2 | 2 ACCEPT |
| META | 1 | 1 PARTIAL (27d TODO note added; full encoding deferred to Slice 27d) |

**Verdict chain:** REJECT pending HIGH fold-ins → HIGH-1 + HIGH-2 + MED-1..MED-5 + LOW-1 + LOW-2 incorporated + META-1 partial → **ACCEPT**.
