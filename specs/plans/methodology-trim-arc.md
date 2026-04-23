---
plan: methodology-trim-arc
status: operator-signoff
revision: 02
opened_at: 2026-04-23
revised_at: 2026-04-23
cleared_at: 2026-04-23
signoff_at: 2026-04-23
opened_in_session: post-p2-9-revision-04-cleared
revised_in_session: post-codex-pass-05-foldins
cleared_in_session: post-codex-pass-06-accept-with-foldins
signoff_in_session: post-pass-06-operator-signoff
signoff_note: "Operator explicit signoff ('resume. i confirm and sign off on the plan.', 2026-04-23). operator_signoff_predecessor: 0cef8175 (slice-64-prep challenger-cleared transition)."
reviewed_plan:
  challenger_artifact: specs/reviews/methodology-trim-arc-codex-challenger-06.md
  challenger_artifact_commit: e62b187
  plan_content_sha256_at_review: 721faad8d19df4733c129a25bf158d32dda81712f7a1622179cc7b81016ce51d
base_commit: 46cfceebe1f6cf0776d127f58afedc65486d0c5b
lane: Ratchet-Advance
arc_size: 5 slices — operator-authorized exception to 3-slice default
target: methodology-reform
authority:
  - specs/adrs/ADR-0010-arc-planning-readiness-gate.md §Decision (plan lifecycle gate; this plan is authored under the existing gate and proposes internal set-split amendment in Slice 66)
  - CLAUDE.md §Hard invariants (ratchet-advance + ADR + challenger requirements; §10 CLAUDE.md cap amended by this arc via ADR-0011)
  - CLAUDE.md §Plan-authoring discipline (lifecycle; this plan follows the gate)
  - CLAUDE.md §Lane discipline (framing quadruplet → pair is landed in Slice 65)
  - specs/reviews/phase-project-holistic-2026-04-22-claude.md (methodology-accretion finding motivating this arc)
  - specs/reviews/phase-project-holistic-2026-04-22-codex.md (adversarial corroboration)
  - specs/reviews/arc-slice-61-codex.md (CLAUDE.md semantic-loss evidence motivating cap raise)
  - specs/reviews/planning-readiness-meta-arc-codex-challenger-08.md (the 8-pass convergence that motivated the "cap passes at N=3" meta-rule here operationalized as R9 / R12)
forcing_function: P2.9 restart -a rate < 15% target after arc lands
---

# Methodology Trim Arc — Expanded Plan (revision 02)

## Fold-in log — pass 05 → revision 02

| Finding | Severity | Classification | Rev-02 resolution |
|---|---|---|---|
| F1 — Slice 66 missing CLI/audit context selector | HIGH | underspec-within-scope | §4.5 (new) adds `--context=authoring\|committed` flag to plan-lint CLI; Check 36 wired to `committed`; CLAUDE.md §Plan-authoring + ADR-0010 §State-set updated; test-suite coverage for both contexts. |
| F2 — Slice 67 misses live-state consumer surface | HIGH | underspec-within-scope | §5 adopts **compat-shim approach**. Existing markers (`<!-- current_slice: N -->` HTML-comment at PROJECT_STATE.md:1, plus README/TIER markers) preserved. `readLiveStateSection` added as internal helper for NEW consumers only; existing consumers (status-epoch, freshness, audit.mjs Check 26 arc-close gate, doctor, inventory, contract tests) unchanged. Full marker-to-section migration deferred to post-P2.9. "Read-only severity" language removed; standard severity model throughout. |
| F3 — Rule #23 skip regex too permissive | MED | underspec-within-scope | §2.1 skip narrowed to exact canonical headings list (no prefix match). New P5 detector for noun-led chronology (`\b(phase|arc)\s*\w+\b` + predictive verb). New fixture: `chronology-noun-led.md`. New fixture: `chronology-evidence-backed-suffix.md` (demonstrates suffix doesn't dodge the rule). |
| F4 — §5.4 pre/post audit diff is weak | MED | underspec-within-scope | §5.4 replaced with explicit unit-test coverage for `readLiveStateSection`: missing section, empty section, multiple sections, malformed section, valid section. No reliance on end-to-end audit-output diff. |
| F5 — §7/§9 burden accounting understates | LOW | underspec-within-scope | §7 "internal complexity" claim neutralized to +0. R13 (plan-lint context divergence at consumer) and R14 (marker-vs-section drift during compat-shim window) added. |

## Why this plan exists

Arc goal: reduce methodology ceremony (chronology drift, blocked-state rules, trajectory check, morning-report long-form, PROJECT_STATE/chronicle coupling, CLAUDE.md-cap line-count posturing) that is either self-referential, stale-by-construction, or substance-free. Plan explicitly accepts the reduction pays rent only if it lowers ceremony without weakening safety; §7 burden ledger separates rule cuts from artifact additions so the net claim is auditable.

Phase goal: carry Phase 2 forward with reduced methodology load so P2.9 restart can measure empirical -a rate under the revised ceremony. P2.9 is the forcing-function test: target -a rate < 15%; reopen trim work if P2.9 restart exceeds 3 slices or -a > 20%.

Arc trajectory. No earlier slice has made this arc smaller. P2.9 implementation has not yet opened under the current methodology, so this arc can land *before* P2.9 implementation does — which is the whole empirical-signal play. Running it after P2.9 starts would confound the measurement.

Operator-authorized exception to 3-slice budget. Prior pass history (5 Codex passes on draft/rev02/rev03/reframe/expanded) demonstrated that §3.2 lifecycle split and §3.4 PROJECT_STATE refactor each require proper dedicated slices with ADR amendment + test/fixture updates + audit-script semantic handling. Operator explicitly authorized 5-slice expansion (2026-04-23). Exception is arc-local.

## §Evidence census

| Id | Status | Source | Claim |
|---|---|---|---|
| E1 | verified | scripts/plan-lint.mjs | 1338 lines, 22 rules (#1–#22) |
| E2 | verified | scripts/plan-lint.mjs:86-92 | `PLAN_STATUS_SET` is a single enum of 5 values |
| E3 | verified | tests/fixtures/plan-lint/good/minimal-compliant-plan.md | Good fixture uses `status: evidence-draft` |
| E4 | verified | specs/adrs/ADR-0010-arc-planning-readiness-gate.md | `evidence-draft` defined valid authoring state (:90, :254) |
| E5 | verified | scripts/audit.mjs | Enforcement semantic not line-based: pre-heading zone (:1780, :1839); first-10 lines (:2078); `*(Previous slice` marker (:3875, :3982) |
| E6 | verified | scripts/audit.mjs | Scan inventories (:1865, :3935) exclude any chronicle path; `PROJECT_STATE-chronicle.md` does not yet exist |
| E7 | verified | specs/plans/planning-readiness-meta-arc.md @ defe76e | Historical chronology drift at :830-885 with `stages`, `If ACCEPT`, `If REJECT` |
| E8 | verified | CLAUDE.md | 279 lines, 21 under 300-line cap |
| E9 | verified | specs/reviews/arc-slice-61-codex.md:76 | Slice 61 Codex HIGH on CLAUDE.md/memory-checklist weakening |
| E10 | verified | .git | HEAD=46cfcee (Slice 63e); working tree clean |
| E11 | verified | specs/adrs/ADR-0010-arc-planning-readiness-gate.md | Lifecycle gate definition authority |
| E12 | verified | specs/reviews/phase-project-holistic-2026-04-22-claude.md:740 | Trajectory check identified as prose-only |
| E13 | verified | PROJECT_STATE.md:1 | Current marker syntax: `<!-- current_slice: N -->` HTML comment |
| E14 | verified | scripts/audit.mjs:4270 | Check 36 is the committed-plan validation entry point |
| E15 | verified | scripts/doctor.mjs:29, scripts/inventory.mjs:312 | Additional consumers of PROJECT_STATE marker helper |
| E16 | verified | scripts/audit.mjs:1943, :3312 | Status-doc freshness + arc-close gate read PROJECT_STATE marker |
| I1 | inferred | git log --oneline | Continuation rate 37% (13/35 base slices); R6 near-certain without cap |
| I2 | inferred | §7 ledger | "Bounded re-cut" accurate; net-additive on artifacts+ADRs+fixtures |
| I3 | inferred | Codex pass 05 F2 | Compat-shim approach (preserve markers, add helper) is cheaper than full migration; migration deferred post-P2.9 |
| I4 | inferred | operator 2026-04-23 | 5-slice exception is arc-local; future arcs stay at 3-slice default |

**Unknown-blocking:** none.

## 1. Arc shape — 5 slices

| Slice | Lane | Payload | Wall-clock | Continuation cap |
|---|---|---|---|---|
| 64 CHEAP-TRIM | Ratchet-Advance | Rule #23 (P1-P5 + narrow skip + quote guard + path scope); exception-report template; ADR decision/appendix convention; structured commit trailer; CLAUDE.md cap 300→450 (ADR-0011) | 60 min | ≤1 |
| 65 RULE-CUT | Ratchet-Advance | plan-lint cuts #8, #11, #22; framing quadruplet → pair | 45 min | ≤1 |
| 66 LIFECYCLE-SPLIT | Ratchet-Advance | ADR-0010 amendment (AUTHORING_STATUSES + COMMITTED_STATUSES); plan-lint PLAN_STATUS_SET split; `--context` CLI flag; Check 36 wires to committed; CLAUDE.md §Plan-authoring update; fixture updates + test coverage for both paths | 75 min | ≤1 |
| 67 LIVE-STATE-HELPER | Ratchet-Advance | `readLiveStateSection` helper (compat-shim: adds capability, does not replace existing markers); PROJECT_STATE split (`## §0 Live state` added alongside HTML-comment marker, chronicle file created); explicit unit tests on helper negative paths; scan-inventory wiring for chronicle | 60 min | ≤1 |
| 68 ARC-CLOSE | Equivalence Refactor | Two-prong composition review (short form); ARC_CLOSE_GATES entry; PROJECT_STATE §0 update | 45 min | 0 |

**Continuation cap semantics.** Continuation on Slices 64-67 stays inside cap only if it carries a concrete Codex finding not catchable pre-commit. Cap > 1 on any slice or > 0 on Slice 68 → pause, reopen. Total arc wall-clock: 285 min. Total Codex passes: 4 slice-level + 2 arc-close prongs = 6 reviews.

## 2. Slice 64 — CHEAP-TRIM

### 2.1 Rule #23 `prospective-chronology-forbidden`

**Semantic detectors:**

- **P1 — Future-slice reference + predictive/preparatory/imperative verb.**
  - Regex: `\bSlice\s*\d+[a-z]?\b` in-sentence with verbs: `will, shall, opens, lands, commits, introduces, adds, stages, upcoming, prepares, queues, awaits, dispatch, transition, bump`.
- **P2 — if-verdict-then-action syntax.**
  - `\bif\s+(ACCEPT|REJECT|challenger-cleared|operator-signoff|signoff)\b` followed within 5 lines by imperative clause.
- **P3 — Imperative action list (bullet OR numbered).**
  - List where ≥50% of items start with imperative verbs: `commit, revise, land, open, bump, transition, dispatch, stage, prepare, queue, verify, run`.
- **P4 — Heading hint (secondary).**
  - Headings matching `/^#+\s*(next\s*steps?|forthcoming|§\s*8\b.*chronology|upcoming\b)/im`. Bumps score; not sufficient alone.
- **P5 (NEW — pass-05 F3 fold-in) — Noun-led chronology.**
  - `\b(phase|arc|revision)\s+\w+\b` in-sentence with verbs from P1's verb list. Catches "Phase 2 lands ADR-0011" or "Arc revision two advances plan-lint" — noun-led forward-chronology that sidesteps "Slice N" detection.

Verdict logic: (P1 ∨ P2 ∨ P3 ∨ P5) → error; P4 alone → warning.

**Section-aware skip — NARROWED (pass-05 F3 fold-in):**
Rule #23 does not fire inside sections whose heading is **exactly** one of:
- `## §Evidence census`
- `## §Prior pass log`
- `## §Appendix`
- `## Example sequence`

No prefix match. `## Evidence-backed rollout` or `## Example flows` are NOT skipped.

**Quote guard:**
Rule does not fire on lines that are Markdown quotes (leading `> `) or inside fenced code blocks.

**Path scope:**
Rule applies only to `specs/plans/**` and plan files passed explicitly to the CLI. Does not scan `specs/reviews/**` or `specs/session-notes/**`.

**Regression fixtures:**
- `chronology-violating.md` — literal `defe76e:830-885`; must fire P1+P2+P3.
- `chronology-compliant.md` — HEAD state-protocol form; must fire none.
- `chronology-negative-control-quoted.md` — violating text inside fenced code block inside `## §Evidence census`; must fire none.
- **NEW (pass-05 F3):** `chronology-noun-led.md` — "Phase 2 lands the ADR. Revision three dispatches the review." Must fire P5.
- **NEW (pass-05 F3):** `chronology-evidence-backed-suffix.md` — forward-chronology text under `## Evidence-backed rollout` heading. Must fire (heading is not exact canonical skip match).

### 2.2 One-screen morning-report exception template

`specs/session-notes/_template-exception-report.md` — 60-line cap; 4 sections (Amends / Inferred operator decisions / Revert candidates / Ratified-nothing-to-report). Enforced by review, not audit.

### 2.3 ADR decision/appendix split convention

Future ADRs (≥ ADR-0011): `## Decision` ≤80 lines; `## Appendix` unlimited. Existing grandfathered. Enforced by review.

### 2.4 Structured commit trailer

`.gitmessage`:
```
<subject>

<body prose>

Lane: <ratchet-advance|equivalence-refactor|migration-escrow|discovery|disposable|break-glass>
Isolation: <container|distinct-uid|none-tier-0-deferred>
Arc-Ref: <arc-slug or N/A>
Signoff-Predecessor: <sha or N/A>
```

`scripts/audit.mjs` Checks 7+8 prefer trailer; prose fallback yellow for pre-arc commits. Cures two current reds on `e3ecd3b`.

### 2.5 CLAUDE.md cap 300 → 450 (ADR-0011)

New ADR-0011 cites E9. Audit cap bumped 300→450. ADR-0011 is contract-relaxation → Codex pass required per Hard Invariant #6.

### 2.6 Slice 64 close criteria

- `npm run verify` green.
- `npm run audit` green/yellow (reds on `e3ecd3b` clear via §2.4 fallback).
- Rule #23 fires on violating + noun-led + evidence-backed-suffix fixtures; does not fire on compliant + quoted-negative-control fixtures.
- ADR-0011 whole-slice Codex pass ACCEPT artifact.
- Slice 64 commit body uses structured trailer.

## 3. Slice 65 — RULE-CUT

### 3.1 Plan-lint rule cuts

- Cut `#8 blocked-invariant-without-full-escrow` (self-referential).
- Cut `#11 arc-trajectory-check-present` (prose-only). Folds into framing-pair (§3.2).
- Cut `#22 blocked-invariant-must-resolve-before-arc-close` (same as #8).

### 3.2 Framing quadruplet → pair

CLAUDE.md §Lane-discipline line 86 replaced. Current: `failure mode / acceptance evidence / alternate framing / trajectory check`. Revised: `failure mode / acceptance evidence / why-this-not-adjacent`.

### 3.3 Slice 65 close criteria

- `npm run verify` green. Plan-lint test suite still green after cuts.
- Whole-slice Codex pass ACCEPT.

## 4. Slice 66 — LIFECYCLE-SPLIT

### 4.1 ADR-0010 amendment

- **`AUTHORING_STATUSES` = {`evidence-draft`, `challenger-pending`}.**
- **`COMMITTED_STATUSES` = {`challenger-pending`, `challenger-cleared`, `operator-signoff`, `closed`}.**

Sets overlap at `challenger-pending` — valid both as authoring (plan just authored) and committed (first commit). Gate point.

ADR-0010 §90 and §254 text updated. Lifecycle diagram redrawn with the two-set overlay.

### 4.2 `scripts/plan-lint.mjs` split

`PLAN_STATUS_SET` at :86-92 replaced with `AUTHORING_STATUSES` + `COMMITTED_STATUSES` sets. Rule #15 `status-field-valid` parameterized by context. Rule #16 `untracked-plan-cannot-claim-post-draft-status` references `AUTHORING_STATUSES` explicitly.

### 4.3 Fixture + test updates

- `tests/fixtures/plan-lint/good/minimal-compliant-plan.md` (currently `status: evidence-draft`): stays valid under authoring-context. Add comment clarifying.
- New fixture: `tests/fixtures/plan-lint/good/minimal-compliant-committed.md` — `status: challenger-pending` with full committed-context compliance.
- Update bad-state fixtures crossing set boundary.
- **NEW (pass-05 F1):** `tests/scripts/plan-lint.test.ts` extended: test cases exercise both `--context=authoring` and `--context=committed` explicitly. Authoring-default CLI invocation without flag exercised.

### 4.4 CLAUDE.md + cross-ref updates (NEW — pass-05 F1 fold-in)

- CLAUDE.md §Plan-authoring discipline (line 251-ish) — description of the two contexts added. `AUTHORING_STATUSES` for draft-window lints; `COMMITTED_STATUSES` for post-commit enforcement.
- README.md pointer to plan lifecycle (if any) — checked and updated if needed.

### 4.5 CLI + audit entry-point surface (NEW — pass-05 F1 fold-in)

- `scripts/plan-lint.mjs` CLI gains `--context=authoring|committed` flag. Default: `authoring` (draft use — preserves existing CLI behavior for plan authors running `npm run plan:lint` on their drafts).
- `scripts/audit.mjs` Check 36 (`checkArcPlanLifecycleReadiness` at :4270, or whichever name) invokes plan-lint with `--context=committed` when validating committed plans under predecessor-ancestry gate. This ensures committed plans claiming `challenger-cleared` or `operator-signoff` are validated against the COMMITTED_STATUSES set only.
- Internal plan-lint callers (tests, fixtures) migrated to explicit context flag where applicable.

### 4.6 Slice 66 close criteria

- `npm run verify` green.
- Plan-lint test suite green on both contexts; both good fixtures pass; expected bad fixtures red in their respective contexts.
- ADR-0010 amendment + Check 36 wiring Codex pass ACCEPT artifact.
- Whole-slice Codex pass ACCEPT.

## 5. Slice 67 — LIVE-STATE-HELPER (compat-shim approach)

**Scope reframe (pass-05 F2 fold-in).** Original §5 proposed full migration of semantic-enforcement regions to a single `readLiveStateSection` helper. Codex pass-05 F2 evidence showed that would require cascading changes to `scripts/doctor.mjs:29`, `scripts/inventory.mjs:312`, `scripts/audit.d.mts:22`, `tests/contracts/status-epoch-ratchet-floor.test.ts`, `tests/contracts/session-hygiene.test.ts`, `tests/contracts/slice-47c-forbidden-progress-firewall.test.ts` — exceeding this slice's budget and reopening the scope-creep pattern.

**Compat-shim approach instead:**
1. Add `readLiveStateSection` as a NEW helper in audit.mjs (not replacement).
2. Existing marker syntax (`<!-- current_slice: N -->` HTML comment at PROJECT_STATE.md:1, README/TIER markers, first-10-lines phase-drift, `*(Previous slice` scoping) is preserved verbatim.
3. PROJECT_STATE.md gains `## §0 Live state` section alongside the HTML-comment marker (both exist simultaneously).
4. Chronicle file created; existing consumers unchanged.
5. Full migration of existing consumers to the helper is deferred to a post-P2.9 slice if/when warranted.

### 5.1 Add `readLiveStateSection` helper

New helper in `scripts/audit.mjs`:
```
function readLiveStateSection(markdownPath) {
  // Returns content between `## §0 Live state` and next `## ` heading.
  // Returns null if section absent.
}
```

Helper documented in `scripts/audit.d.mts` type surface. No existing consumer changed; new consumers (if any introduced by future slices) use the helper.

### 5.2 PROJECT_STATE file split

- `PROJECT_STATE.md` kept largely intact for backwards-compat:
  - Frontmatter unchanged.
  - `<!-- current_slice: N -->` HTML-comment marker unchanged (keeps doctor.mjs, inventory.mjs, audit.mjs status-epoch + freshness + arc-close gate + contract tests all working as-is).
  - NEW: `## §0 Live state` section added at the top: current_slice, current_arc, current_phase as explicit fields (mirror of the HTML-comment marker for human readability + future helper use).
  - Existing narrative content beyond §0 MOVED to `PROJECT_STATE-chronicle.md`.
  - Brief pointer added after §0: "Chronicle at PROJECT_STATE-chronicle.md."
- `PROJECT_STATE-chronicle.md` created with relocated narrative history. Documented at file top as "non-authoritative history; live state at `## §0` of PROJECT_STATE.md".

### 5.3 Scan-inventory wiring

- `scripts/audit.mjs:1865` and `:3935` scan-inventory lists updated to include `PROJECT_STATE-chronicle.md`. Chronicle is scanned for drift-visibility purposes, not gate-consumed — same treatment as README.md currently gets.
- `README.md` pointer to PROJECT_STATE updated (note the split).
- `CLAUDE.md` §Session-hygiene paragraph updated similarly.

### 5.4 Tests — explicit helper coverage (NEW — pass-05 F4 fold-in)

Unit tests in `tests/scripts/audit-live-state.test.ts` (new file) exercise `readLiveStateSection`:
- Happy path: valid `## §0 Live state` section returns its content.
- Missing section: returns null.
- Empty section: returns empty string.
- Multiple sections (authoring error): returns first section; test asserts behavior.
- Malformed section (heading typo): returns null.

No reliance on end-to-end audit-output diff. Each negative path gets explicit red/green coverage.

### 5.5 Slice 67 close criteria

- `npm run verify` green.
- `npm run audit` unchanged outputs on every existing fixture/commit (because no existing consumer changed).
- New helper unit-test file green.
- Chronicle file exists and is in scan inventories.
- Whole-slice Codex pass ACCEPT.

## 6. Slice 68 — ARC-CLOSE

- Two-prong composition review: Claude fresh-read + Codex `/codex` challenger. Short form: top 3 findings severity-descending, HIGH/CRITICAL never censored, MED/LOW spill to mandatory appendix, 45-min/prong.
- ARC_CLOSE_GATES entry for `methodology-trim-arc` registered in `scripts/audit.mjs` (Check 26 protection).
- `PROJECT_STATE.md` §0 update: `current_slice = 68`, `current_arc = methodology-trim-arc`, `current_phase = Phase 2 (continuing)`. HTML-comment marker updated in parallel.
- Arc-close commit body cites forcing function.
- Both prong artifacts at `specs/reviews/arc-methodology-trim-{claude,codex}.md`.

## 7. Combined burden ledger (pass-05 F5 fold-in — neutralized)

| Dimension | Delta |
|---|---|
| plan-lint rules | **-2** (cut #8, #11, #22; add #23) |
| plan-lint internal sets | **+1** (single `PLAN_STATUS_SET` → `AUTHORING_STATUSES` + `COMMITTED_STATUSES`); +1 CLI flag; +1 Check-36 context parameter |
| audit Checks | 0 (trim-back kept) |
| audit.mjs helpers | **+1 helper** (`readLiveStateSection`); existing region-concepts preserved (compat-shim) — net complexity neutral or slightly additive until future migration |
| Committed lifecycle states | 0 (F2 fold-in codifies split; no new states) |
| Framing sentences per slice | -1 |
| CLAUDE.md cap | +50% slack (300→450) |
| PROJECT_STATE files | +1 file (chronicle); -776 lines coupling in PROJECT_STATE.md (moved, not deleted) |
| Governance artifacts added | **+3** (PROJECT_STATE-chronicle.md, _template-exception-report.md, .gitmessage) |
| ADRs added | **+1** (ADR-0011) |
| ADRs amended | +1 amendment (ADR-0010 lifecycle split) |
| Fixtures added | **+5** (chronology-violating, chronology-compliant, chronology-negative-control-quoted, chronology-noun-led, chronology-evidence-backed-suffix, minimal-compliant-committed — six actually) |
| **Combined burden** | **+6 artifacts/ADRs / -2 rules / internal complexity +1 (neutralized from "-1" claim per pass-05 F5)** |

**Framing.** Bounded re-cut with authored exception. Not net-negative. Net-negative covenant applies to *next* cycle.

## 8. Hard-invariants audit

(Unchanged from rev 01 of expanded. Row 10 "CLAUDE.md ≤ 450" via ADR-0011.)

## 9. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| R1 lifecycle enum migration breaks fixture | LOW | Slice 66 updates all fixtures in-commit; test suite asserts both set paths. |
| R3 rule #23 false positives | LOW | §2.1 narrowed skip + quote guard + path scope + 5 fixtures covering positive, negative-control, noun-led, and suffix-heading cases. |
| R4 arc-close missing ARC_CLOSE_GATES | LOW | Check 26 self-protects. |
| R5 trailer adoption inconsistent | LOW | Prose fallback yellow for pre-arc. |
| R6 continuation commits | HIGH at base rate, managed | Cap ≤1 per slice, 0 on 68. Exceeded → pause + reopen. |
| R7 P2.9 measurement confounding | MED | Pre-arc baseline on last 3 non-meta arcs documented before Slice 64 opens. |
| R10 challenger volume unchanged after TUNE-1 drop | MED-accepted | Value prop = authoring friction + stale-doc coupling + audit/plan simplification; tied to P2.9 -a target. |
| R11 audit.mjs semantic refactor breaks subtly | LOW-MED | Compat-shim approach — no existing consumer changed. Future migration carries this risk only if attempted. |
| R12 4 more Codex passes cost time | ACCEPTED | Each slice pass is narrow; should converge faster than plan-level passes. |
| **R13 (NEW — pass-05 F5) plan-lint context divergence** | MED | Rule #15 is parameterized; tests cover both contexts; default `authoring` preserves existing CLI behavior; Check 36 explicitly sets `committed`. Divergence surfaces as a test failure, not silent drift. |
| **R14 (NEW — pass-05 F5) marker-vs-section drift during compat-shim window** | MED | PROJECT_STATE.md §0 and HTML-comment marker are both maintained during Slice 68 close-update. Audit parallel-read validation (optional Slice 68 enhancement): compare §0-parsed values against HTML-comment-marker-parsed values; warn yellow on mismatch. |

## 10. Operator signoff preconditions

- Codex pass 06 (pending — this dispatch) ACCEPT-class artifact.
- Plan committed to `specs/plans/methodology-trim-arc.md` at `challenger-pending` immediately before dispatch.
- `operator_signoff_predecessor: <challenger-cleared-sha>` in Slice 64 commit body post-ACCEPT.
- Each subsequent slice (65, 66, 67) gets its own whole-slice Codex pass at close.

## 11. §Prior pass log

- Pass 01 on rev 01 draft — REJECT (6 findings).
- Pass 02 on rev 02 — REJECT (F1 + F4 open; R6 + trim-back non-blockers).
- Pass 03 on rev 03 — REJECT (F1 still open; R9 fired; scope reopen triggered).
- Pass 04 on reframe — REJECT (3 HIGH + 1 MED; operator authorized 5-slice expansion).
- Pass 05 on expanded rev 01 — REJECT (2 HIGH + 2 MED + 1 LOW; all classified underspec-within-scope, no scope creep).
- Pass 06 (pending) — this revision.

## 12. Challenger directive for pass 06

Verify pass-05 fold-ins close:
- **F1 closure (§4.4, §4.5):** CLI `--context` flag; Check 36 wiring; CLAUDE.md + ADR-0010 updates. Enforceable mechanically?
- **F2 closure (§5 compat-shim reframe):** Existing consumers preserved; helper added alongside; chronicle wired. Is compat-shim genuinely compat or does it introduce silent drift (R14)?
- **F3 closure (§2.1 P5 + narrowed skip):** Does "noun-led" P5 catch what Codex named? Do narrowed skip + suffix fixture prevent dodge?
- **F4 closure (§5.4):** Explicit helper unit tests instead of audit-output diff. Negative paths enumerated.
- **F5 closure (§7 + R13/R14):** Ledger neutralized; risks added.

New for pass 06:
- Does R14 mitigation (optional parallel-read validation at arc-close) go far enough? Or does marker/§0 coexistence create a subtle failure class nobody watches?
- Is compat-shim the right trade vs full migration? What's the honest debt it creates?
- Under §11 prior-pass log — now at pass 06; earlier R9 wording said "pass 03 is honest bound." Operator exception authorizes exceeding that. Record honest, or does operator-override blur the audit trail?

Verdict vocabulary:
- ACCEPT — all closed; output IS challenger-cleared artifact.
- ACCEPT-WITH-FOLD-INS — only LOW/optional-MED; output IS challenger-cleared artifact.
- REJECT-PENDING-FOLD-INS — CRITICAL/HIGH remains.

If REJECT, classify each finding as new-scope-creep (contract further) or underspec-within-5-slice-scope (fold at slice-open).

---
END OF REVISION 02
