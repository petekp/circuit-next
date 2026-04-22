---
name: arc-slice-47c-codex
description: Cross-model challenger pass over Slice 47c partial (commit d1dd56e — ADR-0007 §3 forbidden scalar-progress firewall + new audit Check 34; CLAUDE.md challenger-policy amendment deferred to Slice 47c-2 operator decision). Per-slice review per CLAUDE.md §Hard invariants #6 literal rule (ratified at Slice 47c-2) — slice adds a new audit gate + scrubs governance-surface plan files + lands contract tests pinning the check's behavior. NOT to be confused with specs/reviews/arc-slice-47c-2-codex.md which reviews the Slice 47c continuation at commit 19ea401 (the operator decision ratification). Returns OBJECTION LIST per CHALLENGER-I1. Batched with Slice 47b challenger pass (see also specs/reviews/arc-slice-47b-codex.md); findings split per slice here and there per the boundary-seam cross-slice finding.
type: review
reviewer_model: gpt-5.4
reviewer_model_id: gpt-5-codex
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-22
verdict: REJECT-PENDING-FOLD-INS -> incorporated -> ACCEPT-WITH-FOLD-INS
authored_by: gpt-5-codex
review_target: slice-47c-partial-adr-0007-firewall
target_kind: arc
target: slice-47c-partial
target_version: "HEAD=d1dd56e (slice-47c partial)"
arc_target: slice-47c-partial-single-slice
arc_version: "HEAD=d1dd56e (slice-47c partial)"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  high: 2
  med: 2
  low: 1
  meta: 0
commands_run:
  - git log --oneline -10
  - git show d1dd56e
  - git diff eed12fa..d1dd56e
  - cat scripts/audit.mjs
  - cat tests/contracts/slice-47c-forbidden-progress-firewall.test.ts
  - cat specs/adrs/ADR-0007-phase-2-close-criteria.md
  - cat specs/plans/slice-47-hardening-foldins.md
  - cat specs/reviews/phase-2-to-date-comprehensive-codex.md
  - npm run verify
batched_with:
  - specs/reviews/arc-slice-47b-codex.md
opened_scope:
  - scripts/audit.mjs (Check 34 `checkForbiddenScalarProgressPhrases` + ADR_0007_FORBIDDEN_PROGRESS_PATTERNS + FORBIDDEN_PROGRESS_SCAN_FILES + FORBIDDEN_PROGRESS_CITATION_GUARDS + projectStateScopedText)
  - tests/contracts/slice-47c-forbidden-progress-firewall.test.ts (9 original declarations at d1dd56e)
  - specs/adrs/ADR-0007-phase-2-close-criteria.md §3 No-aggregate-scoring (the authority surface for the forbidden pattern list)
  - specs/plans/phase-2-implementation.md (forbidden-phrase scrub sites)
  - specs/ratchet-floor.json (forbidden-phrase scrub site)
  - specs/plans/slice-47-hardening-foldins.md (§Slice 47c plan binding)
skipped_scope:
  - bootstrap/** (Phase 0 evidence loop, frozen)
  - prior-gen circuit (read-only reference per CLAUDE.md)
  - Slice 47b + Slice 47c-2 (separate review records)
---

# Cross-model challenger review — Slice 47c partial (commit d1dd56e)

**Verdict (opening):** REJECT-PENDING-FOLD-INS
**Verdict (closing):** ACCEPT-WITH-FOLD-INS *(after this slice's fold-in commit at slice-47c: Codex challenger fold-ins)*

**Batched pass.** This review was authored from the same Codex session that reviewed Slice 47b (see `specs/reviews/arc-slice-47b-codex.md`). Findings are split per slice here; any finding that spans both slices lives under the Cross-Slice section at the bottom (shared with the Slice 47b review record).

**Distinguished from arc-slice-47c-2-codex.md.** This review covers the Slice 47c **partial** commit `d1dd56e` (the audit-check + scrub half of HIGH 6, with the CLAUDE.md challenger-policy amendment half deferred to operator decision). The Slice 47c continuation (operator decision ratification, commit 19ea401 — descriptive sub-name "47c-2") is a separate slice with its own per-slice review record at `specs/reviews/arc-slice-47c-2-codex.md`. Both reviews carry the same slice id prefix but review different commits.

## HIGH

### HIGH 1 — Check 34 forbidden-pattern enumeration is materially incomplete relative to ADR-0007

**Finding:** ADR-0007 §3 forbids a broader scalar-progress phrase family than Check 34 enumerates. ADR-0007 explicitly names: "6/8", "75% complete", progress-percentage fields, close-criteria completion metrics, "Phase 2 progress measured at N%", and "all except X". Check 34's pattern set covers `N/8`, `N-of-8`, `N of 8`, and several prose phrases ("substantially complete", "mostly done", etc.), but NOT `N out of 8`, percentage-complete variants, `all except X`, "progress percentage", or "close criteria completion". Future commits can reintroduce these ADR-forbidden wordings while Check 34 stays green.

**Evidence:** ADR-0007 forbidden phrasings enumerated at `specs/adrs/ADR-0007-phase-2-close-criteria.md:877` + `:882` + `:1049` + `:1053`. Check 34 pattern set at `scripts/audit.mjs:3723-3740` (17 patterns including `\b\d+\/8\b`, `\bN\/8\b`, `\b\d+-of-8\b`, `\bN-of-8\b`, `\b\d+ of 8\b`, `\bsubstantially complete\b`, `\bmostly done\b`, etc.) — missing `\b\d+ out of 8\b`, `\b\d+%\s+(?:complete|done|progress)\b`, `\ball except\b`, `\bprogress percentage\b`, `\bclose criteria completion\b`, `\b\d+\s+\/\s+8\b` (spaced-slash).

**Impact:** The firewall is load-bearing on the most operator-visible surfaces (PROJECT_STATE, plan files, ratchet-floor notes). A gap in pattern coverage means a future slice can drift back into "normalized aggregate scoring" using any uncovered phrase family, and the audit stays green until another human or model notices. This is a weaker closure than the forbidden-phrase list in ADR-0007 §3 intends.

**Remediation:** Expand the pattern set to cover every explicit ADR phrase family. Add direct red tests for each missing phrase.

**Disposition:** Incorporated. `scripts/audit.mjs` `ADR_0007_FORBIDDEN_PROGRESS_PATTERNS` extended with six new patterns:
- `\b\d+\s+\/\s+8\b` (label: `N / 8 spaced-slash`) — covers "5 / 8" spaced slash variants
- `\b\d+\s+out\s+of\s+8\b` (label: `N out of 8`) — covers "5 out of 8" phrasing
- `\b\d{1,3}%\s+(?:complete|done|progress)\b` (label: `N% complete/done/progress`) — covers "75% complete", "50% done", "30% progress" variants
- `\bprogress percentage\b` (label: `progress percentage`) — covers the ADR-named field label
- `\bclose criteria completion\b` (label: `close criteria completion`) — covers the ADR-named metric label
- `\ball except\b` (label: `all except`) — covers "all except X" phrasing (distinct from the existing `all but one` pattern)

`tests/contracts/slice-47c-forbidden-progress-firewall.test.ts` adds a new `it('detects expanded pattern families added in the Slice 47c Codex HIGH 1 fold-in')` block with 8 test cases (one per new pattern family, plus extra variants). Total pattern count: 23 (up from 17).

### HIGH 2 — Citation guards are too permissive and create an easy bypass

**Finding:** The `FORBIDDEN_PROGRESS_CITATION_GUARDS` list skips any line containing one of seven tokens: `/\bforbidden\b/i`, `/\breject(?:s|ed|ing|ion)?\b/i`, `/\bdo not use\b/i`, `/\bADR-0007/i`, `/\bNo-aggregate-scoring\b/i`, `/\bSlice 47c\b/i`, `/\bfirewall\b/i`. The last four are SOFT context tokens that appear naturally in prose about the firewall without carrying an explicit rejection. A line like "Slice 47c status: 7/8 complete" or "ADR-0007 progress: mostly done" bypasses the firewall entirely despite containing an unambiguous forbidden phrase.

**Evidence:** Guard list at `scripts/audit.mjs:3752-3760`. Contract test at `tests/contracts/slice-47c-forbidden-progress-firewall.test.ts:83-93` only asserts the positive case (a line citing ADR-0007 AND containing "rejects" passes); no test asserts that a line citing only the soft token without a rejection verb correctly fails.

**Impact:** A future slice can accidentally or deliberately append a soft token to a live progress sentence and bypass the firewall. Because the soft tokens are part of normal prose about the firewall itself, the bypass surface is unusually wide — any plan file, review record, or PROJECT_STATE entry discussing the firewall can contain exactly such lines.

**Remediation:** Remove slice names and document names as sufficient guards. Require an explicit rejection context: `forbids|rejects|prohibits|disallows|do not use|banned` near the quoted phrase. Add red tests for guard-abuse lines.

**Disposition:** Incorporated. `FORBIDDEN_PROGRESS_CITATION_GUARDS` tightened in `scripts/audit.mjs` to require an explicit rejection verb:
- Kept + expanded: `/\bforbid(?:s|den|ding)?\b/i`, `/\breject(?:s|ed|ing|ion)?\b/i`, `/\bdo not use\b/i` (added tense variants for forbid/reject)
- Added: `/\bprohibit(?:s|ed|ion)?\b/i`, `/\bdisallow(?:s|ed|ing)?\b/i`, `/\bdon['’]t use\b/i`, `/\bbanned\b/i`
- **Removed** (soft context tokens that allowed bypass): `/\bADR-0007/i`, `/\bNo-aggregate-scoring\b/i`, `/\bSlice 47c\b/i`, `/\bfirewall\b/i`

`tests/contracts/slice-47c-forbidden-progress-firewall.test.ts` adds two new `it()` blocks:
- `'a line citing "ADR-0007" or "Slice 47c" without an explicit rejection verb does NOT bypass the firewall'` — 4 bypass-attempt cases (all assert RED)
- `'a line carrying an explicit rejection verb DOES bypass the firewall (citation context)'` — 6 legitimate-citation cases covering each new rejection verb (all assert GREEN)

Also: updated the existing `'green when forbidden phrases appear inside a citation context'` test title + added a comment naming the Slice 47c Codex HIGH 2 fold-in and pointing to the new counter-example tests.

Verified pre-commit that all six currently-scanned live state files (PROJECT_STATE.md current entry, README.md, ratchet-floor.json, phase-2-implementation.md, phase-1-close-revised.md, slice-47-hardening-foldins.md) remain CLEAN under the tightened guards. One plan-file line needed a prose tweak (`### Slice 47c — ADR-0007 firewall: scrub 'N/8' wording...` → `### Slice 47c — ADR-0007 firewall: scrub forbidden 'N/8' wording...`) so the existing quotation qualified as a rejection-context citation under the tightened guards; captured as part of this fold-in.

## MED

### MED 1 — Scan scope is narrower than ADR-0007 and the slice plan claim

**Finding:** ADR-0007 §6.3 says future ADRs, audit checks, ratchet dashboards, operator-facing summaries, review files, commit bodies, and README surfaces are rejected if they compute or display scalar progress. The Slice 47 plan says to scrub "any other tracked file containing the forbidden patterns". Check 34 scans only six curated files, so forbidden wording can live in review artifacts, ADR amendments, other plan files, CLAUDE.md, TIER.md, dashboards, or commit bodies without audit detection.

**Evidence:** ADR-0007 surface enumeration at `specs/adrs/ADR-0007-phase-2-close-criteria.md:873` + `:875`. Slice 47 plan claim at `specs/plans/slice-47-hardening-foldins.md:108` + `:113`. Check 34 scan list at `scripts/audit.mjs:3743-3750` (six curated files).

**Impact:** The firewall's scan scope is narrower than both the ADR surface and the plan's stated scrub intent. A future regression introducing forbidden wording in a non-scanned file would land green here.

**Remediation:** Either rename Check 34 as a partial live-state scan (narrowing the plan claim), or expand it to tracked governance/operator surfaces with strict citation handling. Add a future-commit-body check separately so immutable history does not create unfixable failures.

**Disposition:** Deferred with HARD bounded trigger (not "if drift recurs"). Captured here as: a scan-scope expansion (EITHER Check 34 scans extended to the full tracked-governance-surface set — CLAUDE.md, TIER.md, additional plan files, review files carrying operator-facing status — with careful rejection-context handling for legitimate citations, OR a separate Check 35 scans commit bodies for new slices) MUST land in or before:
- the next slice that modifies the `FORBIDDEN_PROGRESS_SCAN_FILES` constant in `scripts/audit.mjs`, OR
- the next slice that introduces a new governance-surface file under `specs/plans/`, `specs/adrs/`, or `specs/reviews/` with operator-facing status summaries, OR
- the next slice that authors a README-level or TIER-level status summary that could contain close-progress wording,

whichever fires first. First-version shape (per Codex's remediation): rename the current check to `checkForbiddenScalarProgressPhrasesLiveStateScan` or document it as "partial live-state scan" in the check's banner; author a sibling `checkForbiddenScalarProgressPhrasesExtendedSurface` scanning a curated tracked-governance list with the same tightened guards. The scan-scope expansion must NOT swallow historical prose in preserved `*(Previous slice ...)` entries across PROJECT_STATE or historical ADR prose (the scope decision in the current MED 2 disposition applies symmetrically).

Rationale for deferral: expansion requires a careful scope decision (which files count as "operator-facing governance"? how should legitimate ADR discussion prose be handled?) plus scan-rule tuning to avoid false positives. Folding that into this commit would bundle the pattern-enumeration fix (HIGH 1) with substantial scope engineering — the 30-min slice bound would be exceeded, and the fold-in would become its own engineering decision rather than a narrow remediation of Codex's named HIGH. The bounded trigger ensures the expansion lands before the next surface that could silently harbor forbidden wording.

### MED 2 — PROJECT_STATE historical scoping leaves forbidden operator-visible text in the current file

**Finding:** `projectStateScopedText` slices `PROJECT_STATE.md` before the first `*(Previous slice` marker. The test suite explicitly asserts that historical `7/8` and "mostly done" wording below that marker remains green. ADR-0007 §6.3 frames operator-facing summaries as part of the rejection surface, so the most visible status file can still normalize forbidden language for future readers, just below a marker.

**Evidence:** Scoping at `scripts/audit.mjs:3762-3767` (`projectStateScopedText` returns text before first marker). Test assertion at `tests/contracts/slice-47c-forbidden-progress-firewall.test.ts:95-110` (historical entries remain green). ADR-0007 operator-facing framing at `specs/adrs/ADR-0007-phase-2-close-criteria.md:873`.

**Impact:** Preserves audit history but weakens the "rejected on sight" firewall for historical operator-visible text. A future reader scrolling through PROJECT_STATE encounters forbidden-phrase prose that the current audit gate would reject if that same prose were in the current entry.

**Remediation:** Scan historical PROJECT_STATE entries under stricter citation rules, or move preserved entries to an explicit archive file. At minimum, wrap retained forbidden examples in a clear historical/citation context that would still fail if reused as live status.

**Disposition:** Deferred as ACKNOWLEDGED-BY-DESIGN — NOT "if drift recurs". The historical-preservation scoping is an intentional audit-trail discipline decision: rewriting committed PROJECT_STATE prose to strip forbidden phrases from historical entries would itself violate audit-trail integrity (the historical entries document what was said at the time). The current gate's behavior — enforce the firewall on the CURRENT entry, preserve history verbatim — reflects the trade-off explicitly.

The remediation path if this trade-off becomes unacceptable: move preserved historical entries to an explicit archive file (e.g., `docs/PROJECT_STATE-archive.md`) that is NOT scanned by the firewall and carries a top-of-file banner explaining why. The move is a substantial reorganization and should be its own slice, not a fold-in here. Bounded trigger for the archive move: the next slice where a NEW operator reads PROJECT_STATE cold and reports the historical-forbidden-phrase surface as confusing. Until then, the scoped-live-entry check is the defensible minimum.

A weaker but available future tightening: scan historical entries under a STRICTER citation rule that requires *both* an explicit rejection verb AND a historical marker (e.g., "as recorded at Slice 46b, forbidden 'N-of-8' wording appeared"). Deferred to the same archive-move slice, since the engineering footprint is similar.

## LOW

### LOW 1 — The "full enumeration" test does not actually pin the full enumeration

**Finding:** The existing test asserts `ADR_0007_FORBIDDEN_PROGRESS_PATTERNS.length >= 15` and spot-checks five labels. A future edit can drop several patterns while keeping the test green (as long as the count stays ≥ 15 and the five named labels remain).

**Evidence:** `tests/contracts/slice-47c-forbidden-progress-firewall.test.ts:160-168` (count-based assertion + 5-of-17 label spot-check).

**Impact:** The pattern-enumeration pin is weaker than intended — a regression that removes or renames several patterns would land green until the count dips below 15 or a spot-checked label is renamed.

**Remediation:** Assert the exact label set, or table-test every forbidden phrase family from ADR-0007.

**Disposition:** Incorporated. `tests/contracts/slice-47c-forbidden-progress-firewall.test.ts` replaces the count-based spot-check with an EXACT-set pin: `expect(labels).toEqual([/* full 23-entry list in order */])`. Any addition, removal, or rename of a pattern trips the test and forces an intentional update. The new test is authored as `it('pins the EXACT forbidden pattern label set (LOW 1 fold-in — exact-set pin)')`. The original count + spot-check test was removed (the exact-set assertion strictly subsumes it).

## META

No META findings.

## Trajectory check

The slice points the right way by turning ADR prose into an audit gate, but the first version was too easy to route around at the guard layer AND left pattern coverage narrower than the ADR-named surface. Pre-fold-in, a future slice could have either (a) used a phrasing family Check 34 didn't enumerate (e.g. "5 out of 8" or "75% complete") to bypass detection, or (b) appended a soft token like "Slice 47c" to a forbidden-phrase status line and bypassed the citation guards. Both paths closed post-fold-in. **Post-fold-in (this commit), HIGH 1 (pattern enumeration expansion) + HIGH 2 (citation guard tightening) + LOW 1 (exact-set enumeration pin) are incorporated via audit-script + contract-test edits. MED 1 (scan scope expansion) is deferred with a HARD bounded trigger on the next slice that touches `FORBIDDEN_PROGRESS_SCAN_FILES` or introduces a new governance surface with close-progress wording. MED 2 (PROJECT_STATE historical scoping) is deferred as ACKNOWLEDGED-BY-DESIGN with an archive-move remediation path named. The closing verdict moves to ACCEPT-WITH-FOLD-INS.** The firewall is now stronger: fail obvious forbidden wording first (the 23-pattern enumeration), then require explicit rejection context for citations (the tightened guards), then surface any future regression to pattern or guard scope via the deferred-MED trigger. This is the discipline Codex was trying to restore with the original HIGH objections.
