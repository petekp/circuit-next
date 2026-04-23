---
plan: planning-readiness-meta-arc
status: challenger-pending
revision: 08
opened_at: 2026-04-23
revised_at: 2026-04-23
opened_in_session: post-p2-9-codex-meta-retrospective
revised_in_session: post-codex-challenger-07-foldin-chronology-restructure
base_commit: defe76e
target: planning discipline (not a workflow; this is methodology)
prior_challenger_passes:
  - specs/reviews/planning-readiness-meta-arc-codex-challenger-01.md
    (verdict REJECT-PENDING-FOLD-INS, 12 objections, 3 minimum fold-ins;
    all folded in revision 02 — mapping in §Codex-foldin-map)
  - specs/reviews/planning-readiness-meta-arc-codex-challenger-02.md
    (verdict REJECT-PENDING-FOLD-INS, 7 minimum fold-ins + 2 CRITICAL
    + 2 HIGH new findings vs revision 02; all folded in revision 03 —
    see §0.B)
  - specs/reviews/planning-readiness-meta-arc-codex-challenger-03.md
    (verdict ACCEPT-WITH-FOLD-INS, 4 minimum fold-ins + 1 CRITICAL
    + 2 HIGH + 1 MED new findings vs revision 03; all folded in
    revision 04 — see §0.C)
  - specs/reviews/planning-readiness-meta-arc-codex-challenger-04.md
    (verdict REJECT-PENDING-FOLD-INS, 3 minimum fold-ins + 1 CRITICAL
    + 1 HIGH + 1 MED new findings vs revision 04; all folded in
    revision 05 — see §0.D)
  - specs/reviews/planning-readiness-meta-arc-codex-challenger-05.md
    (verdict REJECT-PENDING-FOLD-INS, 3 minimum fold-ins — CRITICAL
    test-reproducibility + HIGH stale-prose + MED §8-drift — 2 of
    3 resolved in revision 06)
  - specs/reviews/planning-readiness-meta-arc-codex-challenger-06.md
    (verdict REJECT-PENDING-FOLD-INS with no NEW findings; the only
    remaining fold-in was §8 chronology drift — future-tense
    "Slice 57d upcoming" when Slice 57d was already HEAD. Folded
    trivially in revision 07.)
  - specs/reviews/planning-readiness-meta-arc-codex-challenger-07.md
    (verdict REJECT-PENDING-FOLD-INS with no NEW findings; same
    chronology-drift class as pass 06 — completed commit-item
    listed as "next step." Revision 08 restructures §8 to state-
    protocol form eliminating the drift pattern entirely.)
trigger: |
  P2.9 plan draft (specs/plans/p2-9-second-workflow.md, untracked)
  reached operator decision point carrying multiple material flaws
  captured at specs/reviews/p2-9-plan-draft-content-challenger.md
  (13 findings, 6 HIGH minimum fold-ins). Per-slice Codex challenger
  protocol (CLAUDE.md §Hard-invariants #6) fires at slice execution
  time; arc-close composition review fires after arc closes; neither
  gates plan-authoring-time correctness before operator sign-off.
  Codex meta-retrospective: "alarming that we're this late in the
  game and we're still discovering major issues that weren't caught
  automatically by our adversarial review steps." Operator selected
  path 1 (meta-arc first) over narrow P2.9 rewrite.
authority:
  - specs/reviews/p2-9-plan-draft-content-challenger.md (13-finding
    ledger against P2.9 plan draft; ADR-0010 Slice 60 retroactive
    proof denominator)
  - specs/reviews/planning-readiness-meta-arc-codex-challenger-01.md
    (pass 01 against this plan's revision 01; 12 objections drove
    revision 02 fold-ins)
  - specs/reviews/planning-readiness-meta-arc-codex-challenger-02.md
    (pass 02 against revision 02; 7 fold-ins + 2 CRITICAL + 2 HIGH
    findings drove revision 03 fold-ins — see §0.B)
  - specs/plans/p2-9-second-workflow.md (the flawed-plan case study;
    untracked intentionally; Slice 60 retroactive run consumes it)
  - specs/adrs/ADR-0001-methodology-adoption.md (parent methodology)
  - specs/adrs/ADR-0003-authority-graph-gate.md (precedent; Slice 57
    adds Addendum C extending gate to contract-shaped plan payload)
  - specs/adrs/ADR-0007-phase-2-close-criteria.md (Slice 57 adds
    Addendum A separating second-workflow-generalization from
    CC#P2-1)
  - specs/invariants.json §enforcement_state_semantics (authoritative
    vocabulary for invariant enforcement layers)
  - CLAUDE.md §Core-methodology + §Lane-discipline + §Cross-slice-
    composition-review-cadence (current discipline surface)
  - scripts/audit.mjs (current machine enforcement)
  - scripts/policy/workflow-kind-policy.mjs (single source of truth
    for canonical phase sets)
  - User memory directory
  - User decision (2026-04-23 in-session): path 1 — meta-arc first
effective_date: 2026-04-23
legacy_exemption_scope: |
  Plans with opened_at < effective_date are fully exempt from all
  plan-lint rules (including status-field-valid rule #15) per
  §Migration below. New/revised plans from 2026-04-23 onward are
  fully gated. See §Migration and Slice 58 acceptance evidence.
---

# Planning Readiness Meta-Arc — durable fix for pre-signoff discipline

Install the machine-enforced pre-operator-signoff gate that P2.9's
flawed draft exposed as missing. The arc adds: one new ADR (Arc
Planning Readiness Gate) + two ADR amendments (ADR-0003 scope
extension, ADR-0007 criterion separation) + one new tool (plan-lint
with 22 rules) + one new user-memory rule + one CLAUDE.md process-
sequence update + a **plan-lifecycle state machine** (new in revision
02) + **challenger-artifact freshness binding** (new in revision 03)
+ **effective-date migration gate** (new in revision 03). Arc closes
with retroactive plan-lint run on P2.9 draft as proof artifact
before discipline-hardening lands.

## §0 — Codex foldin map

### §0.A Revision 02 foldins (from pass 01)

All 12 objections from `specs/reviews/planning-readiness-meta-arc-
codex-challenger-01.md` are folded in revision 02. Each objection's
resolution is verified by pass 02 (see §0.B for resolution status).

| Codex # | Severity | Fold-in location | Pass 02 status |
|---|---|---|---|
| 1 | HIGH | §3 rule count reconciled — 17 total (15 structural at Slice 58 + 2 invariant at Slice 59) | PARTIAL in rev 02; RESOLVED in rev 03 |
| 2 | HIGH | §3 rule #11 `arc-trajectory-check-present` | RESOLVED |
| 3 | HIGH | §3 rule #12 `live-state-evidence-ledger-complete` | PARTIAL; rev 03 strengthens |
| 4 | HIGH | §3 rule #13 `cli-invocation-shape-matches` | PARTIAL in rev 02 (plan had CLI inconsistency); RESOLVED in rev 03 |
| 5 | HIGH | §3 rule #14 `artifact-cardinality-mapped-to-reference` | RESOLVED |
| 6 | HIGH | §4 slice ordering — proof at Slice 60 before discipline at Slice 61 | RESOLVED |
| 7 | HIGH | Authority cites committed `specs/reviews/p2-9-plan-draft-content-challenger.md` | UNRESOLVED in rev 02 (file untracked); RESOLVED in rev 03 commit |
| 8 | HIGH | §1 structured evidence-census table + §8 references specific rows | PARTIAL; rev 03 adds §Entry-state |
| 9 | CRITICAL | Enforcement-layer vocabulary aligned to specs/invariants.json | PARTIAL; rev 03 strengthens `blocked` semantics |
| 10 | HIGH | Slice 60 severity-aware threshold: 100% HIGH + ≥70% overall | RESOLVED |
| 11 | CRITICAL | Plan-lifecycle state machine in §Plan-lifecycle + rules #15-#17 | PARTIAL; rev 03 adds freshness binding |
| 12 | MED | Purpose-built minimal compliant fixture; p2-11 no longer canonical known-good | RESOLVED |

### §0.B Revision 03 foldins (from pass 02)

All 7 minimum fold-ins + 2 CRITICAL + 2 HIGH + 2 MED new findings
from `specs/reviews/planning-readiness-meta-arc-codex-challenger-02.md`
are folded in revision 03. Mapping:

| Pass 02 # | Severity | Fold-in location | Nature |
|---|---|---|---|
| CRITICAL 1 | CRITICAL | §Plan-lifecycle §3 rule #17 + ADR-0010 §Decision | Rule #17 strengthened — challenger review file MUST carry `reviewed_plan:` frontmatter binding: `plan_slug`, `plan_revision`, `plan_base_commit`, `plan_content_sha256`. Rule #17 verifies ALL four match the current plan. Stale ACCEPT artifacts reject. |
| CRITICAL 2 | CRITICAL | §Migration + §3 rule #15 + Slice 58 acceptance | Effective-date gate: plans with `opened_at` < 2026-04-23 are fully exempt from ALL plan-lint rules (not just #1 and #11). Existing corpus stays green. Rule #15 only enforces new vocabulary on post-2026-04-23 plans. |
| HIGH 3 | HIGH | §4 Slice 57a ceremony preparation commit | Pre-Slice-57 preparation commit stages plan + all review artifacts + plan-lint + fixtures as Discovery lane. ADR files + addenda land at Slice 57 proper. Sequencing matches plan's own prescription. |
| HIGH 4 | HIGH | §3 rules #18-#21 new | Added explicit rules: #18 canonical-phase-set-maps-to-schema-vocabulary; #19 verdict-determinism-includes-verification-passes-for-successor-to-live; #20 verification-runtime-capability-assumed-without-substrate-slice; #21 artifact-materialization-uses-registered-schema |
| HIGH 5 | HIGH | §3 rule #8 strengthened + new rule #22 | Rule #8 now requires full escrow: `substrate_slice` + `owner` + `expiry_date` + `reopen_condition` + `acceptance_evidence` (post-resolution). New rule #22 `blocked-invariant-must-resolve-before-arc-close` forbids `status: closed` or `status: operator-signoff` with unresolved blocked invariants. |
| MED 6 | MED | §Plan-lifecycle table + §3 rule #15 | `closed` added as 5th state explicitly. Lifecycle table: evidence-draft → challenger-pending → challenger-cleared → operator-signoff → closed. |
| MED 7 | MED | Plan-lint section-aware scoping (Slice 58 implementation note) | Rules #3, #7, #8 skip matches inside §2 Failure-mode narrative sections and §3 Lint-rule inventory descriptions. Implementation: pre-scan for section headers, tag each match with enclosing section, skip matches in designated narrative sections. |
| MIN 1 | CRITICAL | §Self-validation step sequence | Revision 03 commits plan + reviews + plan-lint draft at Slice 57a PRE-challenger commit; pass 03 runs on the committed revision 03. |
| MIN 2 | CRITICAL | Rule #17 binding; see CRITICAL 1 row above | |
| MIN 3 | CRITICAL | §Migration + Slice 58 acceptance; see CRITICAL 2 row above | |
| MIN 4 | HIGH | §3 rule count = 22 everywhere; CLI is positional `npm run plan:lint -- <path>` | Plan-lint CLI: positional only. ADR-0010 + Slice 58 acceptance evidence unified. |
| MIN 5 | HIGH | §3 rules #18-#21; see HIGH 4 row | |
| MIN 6 | HIGH | §Entry state new section + plan-lint section-aware scoping | |
| MIN 7 | HIGH | §3 rule #8 escrow semantics + new rule #22; see HIGH 5 row | |

### §0.D Revision 05 foldins (from pass 04)

Pass 04 verdict: REJECT-PENDING-FOLD-INS. 3 minimum fold-ins + 1
CRITICAL + 1 HIGH + 1 MED new findings. The beautiful meta-reflexive
failure: revision 04's self-lint was VACUOUSLY GREEN because
`isLegacyPlan` used a sliced-local-date check (`slice(0, 10)`) that
treated the plan's Pacific-timezone commit (2026-04-22T23:37:40-07:00)
as pre-effective, skipping all 22 rules. Codex pass 04 caught that
my gate was bypassing itself. All 3 fold-ins applied in revision 05:

| Pass 04 # | Severity | Fold-in location | Nature |
|---|---|---|---|
| CRITICAL 1 | CRITICAL | scripts/plan-lint.mjs isLegacyPlan + §Migration Implementation prose | Replaced date comparison with `git merge-base --is-ancestor` check against `META_ARC_FIRST_COMMIT` (c91469053a...). A plan is legacy iff its first-commit SHA is a STRICT ANCESTOR of this commit; equality or descendant → non-legacy. This avoids all timezone edge cases by using commit ancestry as the boundary. (Initial Date.parse fix was refined further in same revision after tests showed clean-clone-reality-tranche.md would flip to non-legacy under UTC date comparison because its first-commit UTC timestamp happens to fall 7 minutes after the effective boundary.) |
| HIGH 2 | HIGH | §0.B MIN 4 row + §5 dependency graph | Both stale references to "21" reconciled to "22". |
| MED 3 | MED | §8 self-validation | Updated from "revision 03" to "revision 05"; next-steps reference pass-04 fold-ins and pass-05 dispatch. |

### §0.C Revision 04 foldins (from pass 03)

Pass 03 verdict: ACCEPT-WITH-FOLD-INS. 4 minimum fold-ins + 1 CRITICAL +
2 HIGH + 1 MED new findings. All folded:

| Pass 03 # | Severity | Fold-in location | Nature |
|---|---|---|---|
| CRITICAL 1 | CRITICAL | scripts/plan-lint.mjs rule #17 + §3.B rule #17 text | Rule #17 now computes SHA-256 of current plan content and requires matching `plan_content_sha256` in challenger review AND requires `plan_base_commit` (no longer optional-prefix). Stale same-revision content edits rejected. |
| HIGH 2 | HIGH | §3 rule count + §0.B MIN 4 + Slice 58/59 ratchets + plan-lint module header | Rule count reconciled to 22 EVERYWHERE: 19 baseline at Slice 58 (rules #1-6, #9-21), +3 at Slice 59 (rules #7, #8, #22 — invariant dimension trio). |
| HIGH 3 | HIGH | scripts/plan-lint.mjs isLegacyPlan + §Migration | Effective-date loophole closed. isLegacyPlan now uses git-history first-commit-date check: only plans whose FIRST committed version predates 2026-04-23 qualify as legacy. Untracked plans and newly-committed plans pass through FULL rule set regardless of frontmatter claims. Backdating evasion impossible. |
| MED 4 | MED | §Plan-lifecycle table + Slice 58 Check 36 deliverable | `operator_signoff_predecessor` enforcement explicitly named as audit Check 36 responsibility (not plan-lint). Plan-lint does not inspect commit bodies; Check 36 does. Added a deliverable bullet in Slice 58. |

## §Entry state — arc-level trajectory justification

**Arc goal.** Install machine-enforced pre-operator-signoff discipline
for multi-slice plans. Closes the P2.9 failure-mode class
(invention-before-extraction in plan payload, stale-symbol-ownership,
unenforceable-invariant, CLI-shape-divergence, artifact-cardinality-
overreach) BEFORE operator is asked to sign off on scope + shape.

**Phase goal.** This arc extends methodology discipline (ADR-0001
pillar-set). It does not land Phase 2 close criteria work. Phase 2
remains at current state (CC#P2-1 satisfied at Slice 43c placeholder-
parity + CC#P2-3 satisfied at Slice 56); this arc is orthogonal —
it hardens HOW plans are authored going forward, not WHAT Phase 2
ratchets advance.

**Earlier-completed-slice trajectory check.** Slices 52-56 closed the
Clean-Clone Reality Tranche with CC#P2-3 satisfaction (Slice 56
P2.11 plugin-CLI wiring). The P2.9 second-workflow arc would be
next-available under plan phase-2-implementation.md §P2.9. The
meta-arc's existence changes that sequencing: P2.9 is DEFERRED
until meta-arc closes. No earlier slice has made this arc smaller
or obsolete — the meta-arc's failure mode (planning-time gate
absence) is structural, not accidentally resolved by any prior slice.

**Trajectory confidence.** Arc scope (6 slices, ~5-6 hrs wall-clock)
matches the failure-mode surface. No prior slice has tried to close
this gap; no alternative design (markdown-discipline-only) has been
tested and found sufficient. The chief risk is empirical: Slice 60's
retroactive run may reveal rule gaps requiring arc extension. This
is planned for in §7 (H4).

## §Plan-lifecycle — state machine (revision 03; closes Codex CRITICAL 11 from pass 01 + CRITICAL 1 from pass 02)

Plan files live in one of **five** states (revision 03 adds `closed`
explicitly per pass 02 MED 6). ADR-0010 codifies this; plan-lint
enforces; audit Check 36 audits committed plans for valid state
transitions.

| Status | Meaning | Git-tracking | Committed challenger artifact | Frontmatter binding |
|---|---|---|---|---|
| `evidence-draft` | Authoring in progress; evidence census + shape exploration. | OPTIONAL | NONE required | None |
| `challenger-pending` | Plan committed; awaiting Codex challenger pass. | REQUIRED | NONE yet (pass running) | `base_commit` |
| `challenger-cleared` | Codex verdict is ACCEPT or ACCEPT-WITH-FOLD-INS; fold-ins applied. | REQUIRED | REQUIRED — committed `specs/reviews/<plan-slug>-codex-challenger-NN.md` with matching `reviewed_plan:` frontmatter fields (slug, revision, base_commit, content_sha256). | `base_commit`, `revision`, `prior_challenger_passes:` list |
| `operator-signoff` | Operator reviewed and signed off; slices may open. | REQUIRED | REQUIRED (inherited from challenger-cleared predecessor) | Commit body MUST carry `operator_signoff_predecessor: <sha>` naming the challenger-cleared commit |
| `closed` | Arc landed; `closed_at:` + `closed_in_slice:` set. | REQUIRED | Inherited | `closed_at`, `closed_in_slice` |

**Transition rules (enforced by plan-lint + audit Check 36):**

- `evidence-draft → challenger-pending` — plan MUST be git-tracked.
- `challenger-pending → challenger-cleared` — committed challenger
  artifact must exist at `specs/reviews/<plan-slug>-codex-
  challenger-NN.md` with:
  - verdict field `ACCEPT` or `ACCEPT-WITH-FOLD-INS`
  - `reviewed_plan:` frontmatter fields: `plan_slug`, `plan_revision`,
    `plan_base_commit`, `plan_content_sha256` all matching the current
    plan.
  - If plan's `revision` has advanced since the matching challenger,
    a NEWER challenger file at revision NN+1 is required.
- `challenger-cleared → operator-signoff` — commit body carries
  `operator_signoff_predecessor: <sha>` referencing the challenger-
  cleared predecessor commit.
- `operator-signoff → closed` — arc-close ceremony slice; closes via
  Check 26 arc-close composition review presence.

**Untracked-draft loophole closes.** Statuses beyond `evidence-draft`
require git-tracked state. Any plan claiming post-draft status while
untracked fails plan-lint (rule #16) + audit (Check 36).

**Stale-challenger-artifact loophole closes.** Challenger artifacts
bind to plan slug + revision + base_commit + content_sha256. A stale
ACCEPT from an earlier revision cannot clear a materially-changed
plan.

## §Migration — effective-date gate for existing plans

**Effective date: 2026-04-23.** Plans with `opened_at` < this date
are fully exempt from ALL plan-lint rules, NOT just rules #1 and #11.
This prevents audit Check 36 from red-failing the existing plan
corpus (which uses statuses like `active`, `in-progress`, `superseded`,
`draft`, or no status at all — none of which match the new
vocabulary).

**Implementation (revision 06 per pass-05 CRITICAL 1 + HIGH 2 fold-in):**

- Plan-lint queries git history for the file's first-committed SHA
  via `git log --diff-filter=A --follow --format=%H`.
- The legacy boundary is a specific commit SHA —
  `META_ARC_FIRST_COMMIT = c91469053a95519645280fd80394a4966ac7948e`
  (the Slice 57a commit, first commit of this meta-arc).
- A plan is legacy iff its first-commit SHA is a **strict ancestor**
  of `META_ARC_FIRST_COMMIT`. Equality (same-as-meta-arc-first-commit)
  is explicitly treated as NON-LEGACY. Descendants are also
  non-legacy.
- Enforced via `git merge-base --is-ancestor <first-commit-sha>
  <META_ARC_FIRST_COMMIT>` (exit 0 = ancestor, including equal).
  Equality is checked separately and short-circuits to non-legacy.
- Untracked plans have no git history → NOT legacy. They go through
  the full 22-rule gate.
- Frontmatter `opened_at` / `date` fields are NOT the authority for
  legacy determination. They are useful for author-intent signaling
  but git ancestry is the enforcement surface.
- Rule #15 (status vocabulary) applies only to non-legacy plans.

**Why commit-ancestry instead of date comparison:** Date comparison
introduces timezone edge cases. Plans committed in Pacific evening
on 2026-04-22 (local) land in UTC early-morning 2026-04-23. A
UTC-boundary check would flip these plans from legacy to non-legacy
inconsistently with author intent. Commit-ancestry is principled:
the meta-arc starts at a specific commit; plans predating that commit
are grandfathered; everything else is gated.

**Scope of exemption (legacy):** all 22 rules skipped.

**New-plan obligation:** any plan authored after the effective date
and committed after the UTC effective boundary MUST pass all 22
rules. Backdating via `opened_at` is ignored (legacy determination
uses git history, not frontmatter claims).

**Migration of existing work:** plans active at effective-date
boundary (e.g., `phase-2-implementation.md`) stay at current status
until they close under their own discipline (which predates this
arc). If a future plan SUPERSEDES an active pre-effective plan, the
successor carries the new discipline; the predecessor stays exempt.

## §1 — Evidence census (structured)

Authorship source: live read of repo state at base commit `a4de1d57`
(2026-04-23). Status values per claim: `verified` (file read, symbol
present at cited path:line), `inferred` (reasoned from visible
evidence), `unknown-blocking` (needs resolution before payload).

### §1.A Claims about current discipline surface

| # | Claim | Status | Source |
|---|---|---|---|
| E1 | Per-slice Codex challenger mandated for ratchet/ADR/escrow/discovery-promotion/gate-loosening slices | verified | CLAUDE.md §Hard-invariants #6 (line ~225) |
| E2 | Audit Check 35 validates `Codex challenger: REQUIRED` literal in commit bodies | verified | scripts/audit.mjs line 5331 (direct grep) |
| E3 | Audit Check 26 validates arc-close composition review same-commit staging | verified | CLAUDE.md §Cross-slice-composition-review-cadence + audit.mjs Check 26 |
| E4 | ADR-0003 authority-graph gate blocks contract authorship for successor-to-live artifacts until classification + reference_evidence | verified | specs/adrs/ADR-0003-authority-graph-gate.md §Decision.Contract-First-is-conditional |
| E5 | specs/invariants.json::enforcement_state_semantics = {test-enforced, audit-only, static-anchor, prose-only, phase2-property} | verified | specs/invariants.json lines 4-9 (direct read) |
| E6 | scripts/policy/workflow-kind-policy.mjs is single source of truth for canonical phase sets; audit.mjs consumes it | verified | module header lines 5-15 + audit.mjs line ~2780 |
| E7 | audit.mjs Check 23 rule-g is N-command data-driven (iterates manifest command loop) | verified | scripts/audit.mjs lines 2680-2686 |
| E8 | User memory feedback_plans_must_be_persisted.md mandates plan persistence before execution | verified | File exists + MEMORY.md indexed |
| E9 | User memory feedback_no_amend_without_authorization.md | verified | MEMORY.md index |
| E10 | Highest numbered audit Check at current HEAD is 35 | verified | grep scripts/audit.mjs — Checks 21/23/24/26/27/28/29/30/32/33/34/35 exist, highest is 35 |

### §1.B Claims about enforcement gaps

| # | Claim | Status | Source |
|---|---|---|---|
| E11 | No audit check verifies plan-file INTERNAL quality (evidence census, TBD, stale symbols, arc-trajectory) | verified | Grep of audit.mjs — plans referenced for ratchet binding only, no internal-quality check |
| E12 | Per-slice Codex challenger fires at slice execution time, not at multi-slice plan authoring time | verified | CLAUDE.md §Hard-invariants #6 scope |
| E13 | Arc-close composition review fires AFTER arc closes, not before operator sign-off on arc SHAPE | verified | CLAUDE.md §Cross-slice-composition-review-cadence text |
| E14 | ADR-0003 §Decision block gates `specs/contracts/*.md` authorship; no text extends to `specs/plans/*.md` | verified | specs/adrs/ADR-0003-authority-graph-gate.md body |
| E15 | No user-memory rule requires challenger clearance before plan sign-off | verified | ls ~/.claude/projects/-Users-petepetrash-Code-circuit-next/memory/ — 4 files, none cover sign-off quality |

### §1.C Claims about the P2.9 failure case

| # | Claim | Status | Source |
|---|---|---|---|
| E16 | P2.9 draft collapsed parent plan's conditional target to normative target without census | verified | specs/plans/p2-9-second-workflow.md line 6 vs specs/plans/phase-2-implementation.md §P2.9 conditional language |
| E17 | P2.9 draft cited WORKFLOW_KIND_CANONICAL_SETS at scripts/audit.mjs when symbol moved to scripts/policy/workflow-kind-policy.mjs | verified | Codex P2.9 challenger MED 7 (committed at specs/reviews/p2-9-plan-draft-content-challenger.md) |
| E18 | P2.9 draft's REVIEW-I1 clause (b) is slice-local-unenforceable | verified | Codex P2.9 HIGH 3 + src/runtime/runner.ts:503 analysis |
| E19 | P2.9 draft declared 4 artifacts; reference surface has 1 | verified | Codex P2.9 HIGH 2 |
| E20 | P2.9 draft CLI shape uses `--scope`; actual CLI uses `--goal` + positional workflow | verified | Codex P2.9 MED 8 + src/cli/dogfood.ts:13-48 (grep confirmed `--goal` + no `--scope`) |
| E21 | P2.9 draft proposed `/circuit:run` verb-match heuristic; rejected as bug farm | verified | Codex P2.9 MED 9 |
| E22 | 13 Codex findings committed at specs/reviews/p2-9-plan-draft-content-challenger.md | verified | File exists in working tree; committed at Slice 57a |

### §1.D Claims about this plan's own evidence posture (revision 03 reflexive)

| # | Claim | Status | Source |
|---|---|---|---|
| E23 | Plan's revision 01 received REJECT-PENDING-FOLD-INS from Codex pass 01 with 12 objections | verified | specs/reviews/planning-readiness-meta-arc-codex-challenger-01.md (committed at Slice 57a) |
| E24 | Plan's revision 02 received REJECT-PENDING-FOLD-INS from Codex pass 02 with 7 minimum fold-ins + 4 new CRITICAL/HIGH findings | verified | specs/reviews/planning-readiness-meta-arc-codex-challenger-02.md (committed at Slice 57a) |
| E25 | All 12 pass-01 objections folded in revision 02; rev 02 resolution status in §0.A | verified | §0.A table |
| E26 | All 7 pass-02 minimum fold-ins + 4 new findings folded in revision 03 | verified | §0.B table |

### §1.E Hypotheses (unverified; marked for resolution)

| # | Hypothesis | Resolution point |
|---|---|---|
| H1 | ADR-0010 is next available ADR number (ADRs 0001-0009 exist) | Slice 57 open — verified via `ls specs/adrs/` this session: 0001-0009 + addendum-B; H1 RESOLVED, ADR-0010 confirmed next |
| H2 | Audit check number for plan-lint wrapper is 36 | Slice 58 open — verified via grep this session: Check 35 is highest; H2 RESOLVED, Check 36 confirmed next |
| H3 | Plan-lint tool can run on untracked files as standalone `node scripts/plan-lint.mjs <path>` command | Slice 58 open — verified this session: draft plan-lint.mjs runs on arbitrary paths including untracked files |
| H4 | Retroactive run on P2.9 draft will surface ≥6 HIGH findings (100% of HIGH) + ≥4 MED findings | Slice 60 — empirical test; if HIGH coverage <100%, arc extends with rule-set additions |
| H5 | CLAUDE.md current line count leaves room for §Plan-authoring-discipline subsection (~30-50 lines) | Slice 61 — `wc -l CLAUDE.md` at slice open; currently 256 lines; subsection ~30-50 lines → likely fits within 300 |

### §1.F Unknown-blocking

*None remaining at revision 03 authoring.* UB1 from revision 02
(whether `blocked` vocabulary extension is redundant with existing
states) is resolved by revision 03's §Decision to make `blocked` a
full escrow state with distinct semantics from `phase2-property`
(see ADR-0010 §Decision.3).

## §2 — Failure-mode ledger (what went wrong in P2.9)

Per `specs/reviews/p2-9-plan-draft-content-challenger.md`:

1. **Plan authorship outran extraction.** ADR-0003 blocks contract
   authorship but NOT contract-shaped plan payload. Addendum C at
   Slice 57 closes this gap.

2. **Parent plan treated as authority instead of stale hypothesis.**
   Conditional target collapsed to normative target without census.
   Plan-lint rule #10 catches this.

3. **Trajectory check existed too late.** CLAUDE.md requires
   trajectory check before slice framing; no equivalent at arc
   planning time. Plan-lint rule #11 catches this.

4. **Live ownership not revalidated.** Stale symbol citations (cited
   `scripts/audit.mjs::WORKFLOW_KIND_CANONICAL_SETS` when moved to
   `scripts/policy/workflow-kind-policy.mjs`). Plan-lint rule #4
   catches this.

5. **Possible future generalization mistaken for current blocker.**
   CLI hard-coding listed as Open Question when CLI already supports
   the intended shape. Plan-lint rule #13 catches this.

6. **Invariant enforceability not gated.** REVIEW-I1 demanded adapter
   identity on orchestrator close step. Plan-lint rule #7, #8, and
   new rules #19-#22 catch this.

7. **Plan-lint did not exist for uncommitted drafts.** audit.mjs
   protects committed/staged state. Plan-lint tool (new in Slice 58)
   operates on any path.

## §3 — Lint-rule inventory (22 rules total in revision 04)

Derived from the 7 failure modes + Codex pass-01 4 new dimensions +
Codex pass-02 4 new explicit-coverage dimensions. Each rule declares
an `enforcement layer` from the authoritative circuit-next vocabulary
at `specs/invariants.json::enforcement_state_semantics`:
`{test-enforced, audit-only, static-anchor, prose-only, phase2-property}`.
Plan-lint rules are `static-anchor`-enforced.

**Rule count reconciliation (revision 04 final — 22 rules total):**
- **Slice 58 baseline: 19 rules** (structural/shape #1-#6, #9-#14,
  state-machine #15-#17, new HIGH-coverage #18-#21).
- **Slice 59 extension: +3 rules** (invariant-enforceability trio:
  #7, #8, #22 — all three enforce the `blocked` escrow discipline
  across declaration + escrow completeness + resolution-before-
  close).
- **Total post-Slice-59: 22 rules.**
- This count is used consistently everywhere: §3 rule table, §0.B
  MIN 4 row, §0.C MIN 4 row, Slice 58/59 ratchet notes, Slice 58
  acceptance evidence, `scripts/plan-lint.mjs` module header, §6
  arc-close acceptance evidence.

### §3.A Structural / shape rules (Slice 58 baseline)

| # | Rule id | What it rejects | Layer |
|---|---|---|---|
| 1 | `plan-lint.evidence-census-present` | Plan missing §Evidence census (or §1 equivalent) with verified / inferred / unknown-blocking vocabulary | static-anchor |
| 2 | `plan-lint.tbd-in-acceptance-evidence` | TBD / TODO in any Acceptance-evidence block | static-anchor |
| 3 | `plan-lint.test-path-extension` | Test deliverable paths ending in `.md` when real tests are `.test.ts` (ONLY in Deliverable / Acceptance sections, NOT in Failure-mode narrative §2 per Slice 58 section-aware scoping) | static-anchor |
| 4 | `plan-lint.stale-symbol-citation` | `path/file.ext:Name` reference where file doesn't exist OR symbol not present at cited location | static-anchor |
| 5 | `plan-lint.arc-close-claim-without-gate` | Arc-close-criterion-satisfied claims without naming the audit gate | static-anchor |
| 6 | `plan-lint.signoff-while-pending` | `operator_signoff: ready` while `challenger_status: pending` or missing | static-anchor |
| 9 | `plan-lint.contract-shaped-payload-without-characterization` | Plan declaring artifact ids, invariant text, verdict vocabulary, or CLI shape for a successor-to-live surface without a characterization slice landing first in arc ordering | static-anchor |
| 10 | `plan-lint.unverified-hypothesis-presented-as-decided` | `target: X` or `decision: X` where X is not in §Evidence-census verified rows AND not marked `hypothesis:` | static-anchor |
| 11 | `plan-lint.arc-trajectory-check-present` | Plan missing §Entry-state (or equivalent) arc-level trajectory justification | static-anchor |
| 12 | `plan-lint.live-state-evidence-ledger-complete` | Plan citing symbols/files without corresponding §Evidence-census ledger row | static-anchor |
| 13 | `plan-lint.cli-invocation-shape-matches` | CLI `--flag-name` usage not in actual CLI argv parser | static-anchor |
| 14 | `plan-lint.artifact-cardinality-mapped-to-reference` | Successor-to-live plan payload declaring artifact count without recording reference-surface cardinality | static-anchor |

### §3.B State-machine rules (Slice 58)

| # | Rule id | What it rejects | Layer |
|---|---|---|---|
| 15 | `plan-lint.status-field-valid` | `status:` value outside `{evidence-draft, challenger-pending, challenger-cleared, operator-signoff, closed}` (legacy plans exempt per §Migration) | static-anchor |
| 16 | `plan-lint.untracked-plan-cannot-claim-post-draft-status` | Untracked file with status beyond `evidence-draft` | static-anchor |
| 17 | `plan-lint.status-challenger-cleared-requires-fresh-committed-challenger-artifact` | `status: challenger-cleared` (or beyond) without matching committed `specs/reviews/<plan-slug>-codex-challenger-NN.md` whose `reviewed_plan:` frontmatter binds `plan_slug`, `plan_revision`, `plan_base_commit`, and `plan_content_sha256` all matching the current plan. Stale artifacts from earlier revisions rejected. | static-anchor |

### §3.C P2.9 HIGH-coverage rules (Slice 58; new in revision 03)

| # | Rule id | What it rejects | Layer |
|---|---|---|---|
| 18 | `plan-lint.canonical-phase-set-maps-to-schema-vocabulary` | Plan declaring workflow phase set with titles not matching scripts/policy/workflow-kind-policy.mjs::WORKFLOW_KIND_CANONICAL_SETS canonical ids AND no explicit title→canonical mapping in plan body | static-anchor |
| 19 | `plan-lint.verdict-determinism-includes-verification-passes-for-successor-to-live` | Plan declaring a verdict rule for a successor-to-live surface where the rule does not include verification-passes clause (if reference surface's verdict depends on verification) | static-anchor |
| 20 | `plan-lint.verification-runtime-capability-assumed-without-substrate-slice` | Plan deliverable assumes runtime capability (subprocess exec, markdown materialization, etc.) where current src/runtime/runner.ts writes only placeholder JSON for that step kind, AND no substrate-widening slice is scheduled | static-anchor |
| 21 | `plan-lint.artifact-materialization-uses-registered-schema` | Plan declaring an artifact shape (markdown, binary, specific JSON) that does not match a registered schema in src/schemas/ AND no schema-widening slice is scheduled | static-anchor |

### §3.D Invariant-enforceability rules (Slice 59)

| # | Rule id | What it rejects | Layer |
|---|---|---|---|
| 7 | `plan-lint.invariant-without-enforcement-layer` | Invariant without `enforcement_layer:` from the authoritative set + `blocked` extension | static-anchor |
| 8 | `plan-lint.blocked-invariant-without-full-escrow` | `enforcement_layer: blocked` invariant without ALL of: `substrate_slice:`, `owner:`, `expiry_date:`, `reopen_condition:`, `acceptance_evidence:` (post-resolution). Revision 03 strengthens from "substrate_slice only" to "full escrow". | static-anchor |
| 22 | `plan-lint.blocked-invariant-must-resolve-before-arc-close` | Plan with any `enforcement_layer: blocked` invariant claiming `status: closed` OR `status: operator-signoff` without an `acceptance_evidence:` field proving resolution (either substrate slice landed or escrow renewed per its terms) | static-anchor |

### §3.E Vocabulary authority (revision 03 CRITICAL 9 resolution)

Authoritative vocabulary for `enforcement_layer:` is
`specs/invariants.json::enforcement_state_semantics`. Rule #7 pulls
from this set at lint time.

**`blocked` extension (Slice 59):** New state added to
`enforcement_state_semantics`. Semantics: "Invariant declared as
normative; enforcement deferred to a substrate-widening slice named
in the arc via `substrate_slice:`. REQUIRES full escrow: `substrate_
slice`, `owner`, `expiry_date`, `reopen_condition`, `acceptance_
evidence`. Forbids arc close while unresolved (rule #22)."

**`blocked` vs `phase2-property` differentiation:**
`phase2-property` invariants have a known harness landing at a
specific Phase 2 property-scaffold slice; enforcement landing is
scheduled and non-escrow. `blocked` is for invariants requiring
substrate-widening (new step kind, new schema, new runtime surface)
where BOTH the harness AND the substrate need to change. Full
escrow semantics differentiate by requiring expiry + reopen
condition + post-resolution acceptance evidence, none of which
`phase2-property` requires.

## §4 — The arc

7 slices: 1 preparation (57a) + 5 execution (57, 58, 59, 60, 61) +
1 arc-close ceremony (62). Each ≤30min wall-clock EXCEPT Slice 58
(plan-lint baseline + 19 rules + state machine + section-aware
scoping + fixtures) which may run 60-90min and should split if it
exceeds that.

### Slice 57a — Preparation commit: evidence persistence + plan-lint draft + known-good fixture

**Lane:** Discovery (pre-slice evidence persistence; no ratchet
advance; answer to "does the committed artifact survive pass 03?").

**Failure mode addressed:** Pass 02 HIGH 3 — plan says "commit plan
+ reviews before re-dispatch" but revision 02 dispatched pass 02
before committing. Revision 03's pass 03 must dispatch after plan +
reviews + supporting artifacts are committed.

**Deliverable:**
1. `specs/plans/planning-readiness-meta-arc.md` — revision 03, status
   `challenger-pending`, committed.
2. `specs/reviews/p2-9-plan-draft-content-challenger.md` — committed.
3. `specs/reviews/planning-readiness-meta-arc-codex-challenger-01.md`
   — committed.
4. `specs/reviews/planning-readiness-meta-arc-codex-challenger-02.md`
   — committed.
5. `scripts/plan-lint.mjs` — draft (will be finalized at Slice 58;
   this commit brings it into git for reflexive use at pass 03).
6. `tests/fixtures/plan-lint/good/minimal-compliant-plan.md` — known-
   good fixture.
7. `~/.claude/projects/-Users-petepetrash-Code-circuit-next/memory/
   feedback_plans_must_be_challenger_cleared_before_signoff.md` —
   memory rule drafted (will be finalized at Slice 61 after proof).

**What this slice does NOT commit:**
- `specs/adrs/ADR-0010-arc-planning-readiness-gate.md` — deferred to
  Slice 57 proper.
- Modifications to `specs/adrs/ADR-0003-authority-graph-gate.md` —
  deferred to Slice 57 proper.
- Modifications to `specs/adrs/ADR-0007-phase-2-close-criteria.md` —
  deferred to Slice 57 proper.

These three files are UNSTAGED/RESET at Slice 57a commit boundary
(draft text preserved locally as working-tree evidence; not part of
the preparation commit).

**Acceptance evidence:**
- `npm run verify` + `npm run audit` green.
- Commit body declares lane `Discovery` + failure mode + acceptance
  evidence + alternate framing.
- No audit regressions (Check 36 does not yet exist; pre-existing
  checks stay green).

**Alternate framing:**
- *(a) Commit everything in one Slice 57 mega-commit.* Rejected —
  conflates evidence persistence (pre-discipline) with ADR landing
  (discipline ratchet). Discovery lane is right for preparation;
  Ratchet-Advance is right for Slice 57 proper.
- *(b) Do not commit reviews; run pass 03 against untracked state.*
  Rejected — pass 02 HIGH 3 is explicit: plan's own discipline
  requires committed-before-challenger. Recursive-validation demands
  the plan follow its own prescription.

**Ratchet:** No ratchet advance (Discovery).

**Codex challenger:** NOT REQUIRED (Discovery lane, evidence
persistence; no ADR or ratchet change). Pass 03 runs AFTER this
commit against the committed plan.

### Slice 57 — Policy layer: ADR-0010 + ADR-0003 Addendum C + ADR-0007 Addendum A

**Lane:** Ratchet-Advance (new discipline ratchet; authority-graph
gate scope widens; CC#P2-1 scoping tightens).

**Failure mode addressed:** No ADR-level policy exists mandating
pre-operator-signoff challenger gate + evidence-census + hypothesis-
marking + plan-lifecycle state machine for multi-slice plans.

**Deliverable:**
1. `specs/adrs/ADR-0010-arc-planning-readiness-gate.md` — new ADR
   codifying §Plan-lifecycle state machine, §Migration effective-
   date gate, §Enforcement-layer vocabulary + `blocked` extension
   (Slice 59 implementation).
2. `specs/adrs/ADR-0003-authority-graph-gate.md` Addendum C —
   extends gate scope from `specs/contracts/*.md` to `specs/plans/*.md`
   contract-shaped payload.
3. `specs/adrs/ADR-0007-phase-2-close-criteria.md` Addendum A —
   separates second-workflow-generalization from CC#P2-1 scope.

**Acceptance evidence:**
- ADR-0010 committed with Context + Decision + Enforcement +
  Vocabulary sections.
- ADR-0003 Addendum C committed extending gate scope.
- ADR-0007 Addendum A committed clarifying CC#P2-1 scope.
- `npm run verify` + `npm run audit` green.

**Alternate framing:**
- *(a) Land all three ADR changes as separate slices.* Rejected —
  each change is short; bundling keeps the policy layer coherent.
- *(b) Write tooling first, author ADRs retroactively.* Rejected —
  inverts policy-before-enforcement pattern.

**Ratchet:** ADR count (9 → 10); ADR-amendment count (N → N+2).

**Codex challenger:** REQUIRED. Filed at `specs/reviews/arc-slice-57-
codex.md`.

### Slice 58 — Tooling layer: plan-lint baseline (19 rules) + state machine + audit Check 36 + section-aware scoping + fixtures

**Lane:** Ratchet-Advance (audit-coverage ratchet; new tool lands).

**Failure mode addressed:** No machine enforcement of plan-quality,
plan-lifecycle, or freshness binding exists. Untracked-draft loophole
+ stale-challenger-artifact loophole both open.

**Deliverable:**
1. `scripts/plan-lint.mjs` — finalized tool. Positional argument
   `npm run plan:lint -- <path-to-plan.md>`. Implements 19 rules
   (structural/shape #1-#6, #9-#14 + state-machine #15-#17 + HIGH-
   coverage #18-#21). Reads `specs/invariants.json` for vocabulary
   (supports rule #7 at Slice 59). **Section-aware scoping:**
   pre-scans for section headers (`## §N — Title`, `## Heading`,
   etc.); rules #3, #7, #8 skip matches inside sections whose title
   matches `§\d+ — Failure-mode|§\d+ — Lint-rule|narrative`.
2. `package.json` — adds `"plan:lint": "node scripts/plan-lint.mjs"`.
3. `scripts/audit.mjs` — new Check 36 runs plan-lint on all
   `specs/plans/*.md` whose first-committed-version post-dates
   effective-date (2026-04-23). Legacy plans skipped per §Migration.
   Additionally:
   - For committed plans with `status: operator-signoff`, Check 36
     verifies matching committed challenger artifact with full
     `reviewed_plan:` binding (slug + revision + base_commit +
     content_sha256).
   - For commits transitioning `challenger-cleared → operator-
     signoff` (Slice 58 delivers this check; triggered when a commit's
     diff shows `status:` advancing to `operator-signoff`), Check 36
     verifies the commit body carries `operator_signoff_
     predecessor: <sha>` naming a commit in this branch's history
     with the predecessor plan at `status: challenger-cleared`. This
     closes the MED 4 fold-in from pass 03 — the predecessor-chain
     enforcement lives in audit (Check 36 can inspect commit bodies
     and git ancestry), NOT in plan-lint (which operates on plan file
     content only).
4. `tests/scripts/plan-lint.test.ts` — new test file. Per-rule tests
   + section-aware scoping tests + legacy exemption test + freshness
   binding test.
5. `tests/fixtures/plan-lint/good/minimal-compliant-plan.md` —
   already committed at Slice 57a; validated here.
6. `tests/fixtures/plan-lint/bad/` — one bad fixture per rule (≥19).
7. `tests/fixtures/plan-lint/legacy/` — at least one fixture carrying
   `opened_at: 2026-04-20` (pre-effective) to test legacy exemption.

**Acceptance evidence:**
- `npm run plan:lint -- tests/fixtures/plan-lint/good/minimal-
  compliant-plan.md` exits 0.
- `npm run plan:lint -- tests/fixtures/plan-lint/bad/<fixture>`
  exits non-zero with expected rule id(s).
- `npm run plan:lint -- tests/fixtures/plan-lint/legacy/<fixture>`
  exits 0 (legacy exemption).
- `npm run plan:lint -- specs/plans/planning-readiness-meta-arc.md`
  (revision 04+) exits 0 (reflexive self-lint green).
- `npm run plan:lint -- specs/plans/p2-9-second-workflow.md` exits
  non-zero with findings aligned to the 13-finding ledger (retroactive
  preview; full proof at Slice 60).
- `npm run plan:lint -- specs/plans/phase-2-implementation.md` exits
  0 (legacy exemption; opened_at pre-effective).
- `npm run verify` + `npm run audit` green (Check 36 passes on all
  existing committed plans via legacy exemption).
- Test count advances by ≥35 (≥19 rule tests + section-aware scoping
  + legacy exemption + freshness binding + bad-combination edges).

**Alternate framing:**
- *(a) Implement plan-lint as audit.mjs check.* Rejected — per-plan
  lint on arbitrary paths (including untracked) is the main feature.
- *(b) Start with 3 rules.* Rejected — the 19-rule set is derived
  from 13 committed findings + Codex pass-01 HIGH 2-5 + Codex pass-02
  HIGH 4. Fewer leaves known gaps.

**Ratchet:** Tool count (N → N+1); audit check count (35 → 36);
test count (+≥35); plan-lint rule count (0 → 19).

**Codex challenger:** REQUIRED. Filed at `specs/reviews/arc-slice-58-
codex.md`.

### Slice 59 — Invariant enforceability dimension + `blocked` escrow

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Plans can declare invariants without
enforcement-layer field, or declare `blocked` escrow without full
escrow terms (substrate_slice + owner + expiry + reopen_condition +
acceptance_evidence), or reach arc close with unresolved blocked
invariants.

**Deliverable:**
1. `scripts/plan-lint.mjs` extension: rules #7, #8, #22 implemented.
2. `specs/invariants.json` update: adds `blocked` to
   `enforcement_state_semantics` with escrow semantics.
3. Test coverage: per-rule tests + REVIEW-I1-shaped fixture.

**Acceptance evidence:**
- Rules #7, #8, #22 fire on bad fixtures; stay silent on good.
- `specs/invariants.json` header updated; still valid JSON.
- `npm run verify` + `npm run audit` green.

**Alternate framing:** *(a) Bundle into Slice 58.* Rejected — keeps
Slice 58 focused on baseline.

**Ratchet:** Lint-rule count (19 → 22); invariant vocabulary (5 → 6
states).

**Codex challenger:** REQUIRED.

### Slice 60 — Retroactive proof: plan-lint on P2.9 draft

**Lane:** Discovery.

**Failure mode addressed:** Rule set adequacy is hypothesis until
validated against a real failure surface.

**Deliverable:**
1. Run `npm run plan:lint -- specs/plans/p2-9-second-workflow.md`.
2. Cross-reference findings against 13 findings at
   `specs/reviews/p2-9-plan-draft-content-challenger.md`.
3. Author `specs/reviews/p2-9-plan-lint-retroactive-run.md` with:
   - Verbatim lint output.
   - Cross-reference table.
   - Severity-aware ratios: HIGH-caught = N/6; MED-caught = N/7;
     combined = N/13.
   - **Acceptance criterion:** HIGH-caught MUST be 6/6 (100%);
     combined MUST be ≥10/13 (≥77%).
   - Gap commentary + proposed rule additions if needed.

**Acceptance evidence:**
- Retroactive run file committed with full output + ratios +
  commentary.
- HIGH-caught ≥ 6/6.
- Combined ≥ 10/13.
- If thresholds not met: intra-slice follow-up commits extend rules.

**Alternate framing:** *(a) Skip retroactive run.* Rejected.

**Ratchet:** Discovery slice count (N → N+1); review file count.

**Codex challenger:** REQUIRED.

### Slice 61 — Discipline layer: memory rule + CLAUDE.md process sequence

**Lane:** Ratchet-Advance.

**Failure mode addressed:** No user-memory rule or CLAUDE.md process
sequence documents the plan-authoring-discipline.

**Deliverable:**
1. User memory file `feedback_plans_must_be_challenger_cleared_
   before_signoff.md` finalized (drafted at Slice 57a).
2. MEMORY.md index entry.
3. `CLAUDE.md` §Plan-authoring-discipline subsection (≤300 lines
   ceiling honored; fallback to `specs/methodology/plan-authoring-
   discipline.md` with pointer if needed).

**Acceptance evidence:**
- Memory file + MEMORY.md entry committed.
- CLAUDE.md edit committed; `wc -l CLAUDE.md` ≤ 300.
- `npm run verify` + `npm run audit` green.

**Alternate framing:** *(a) Memory only.* Rejected. *(b) CLAUDE.md
only.* Rejected.

**Ratchet:** Memory rule count (4 → 5).

**Codex challenger:** REQUIRED.

### Slice 62 — Arc-close composition review (ceremony)

**Lane:** Disposable.

**Deliverable:**
1. `specs/reviews/arc-planning-readiness-meta-arc-composition-review-
   claude.md`.
2. `specs/reviews/arc-planning-readiness-meta-arc-composition-review-
   codex.md`.
3. HIGHs folded in same commit.
4. `PROJECT_STATE.md` `current_slice` advances.
5. Plan frontmatter `status: closed`, `closed_at`, `closed_in_slice:
   62`.

**Acceptance evidence:**
- Both prong reviews committed.
- Both verdicts ACCEPT or ACCEPT-WITH-FOLD-INS.
- Check 26 green.

**Codex challenger:** REQUIRED (as review prong).

## §5 — Dependency graph

```
Slice 57a (preparation)                — evidence persistence + fixtures
  └─ Slice 57 (ADRs)                   — policy
       └─ Slice 58 (plan-lint baseline 19 rules + state machine + section-aware)
                                       — tooling [needs ADR-0010]
            └─ Slice 59 (invariant dim + blocked escrow = 22 total)
                                       — tooling extension
                 └─ Slice 60 (retroactive proof on P2.9)
                                       — empirical validation
                      └─ Slice 61 (memory + CLAUDE.md)
                                       — discipline
                           └─ Slice 62 (arc-close review)
```

Linear. Arc total ~5-7 hrs wall-clock plus challenger turnaround.

## §6 — Acceptance evidence for arc close

1. ADR-0010 + ADR-0003 Addendum C + ADR-0007 Addendum A committed.
2. `scripts/plan-lint.mjs` + `npm run plan:lint` + new Check 36
   committed.
3. 22 plan-lint rules implemented + tested.
4. Plan-lifecycle state machine codified + freshness binding enforced.
5. `specs/reviews/p2-9-plan-lint-retroactive-run.md` committed with
   HIGH 6/6 + combined ≥10/13.
6. User memory + MEMORY.md + CLAUDE.md §Plan-authoring-discipline
   committed.
7. Both arc-close composition review prongs committed with ACCEPT
   verdicts.
8. All execution slices + ceremony slice carry Codex challenger
   files.
9. `specs/invariants.json::enforcement_state_semantics` extended
   with `blocked` escrow state.

## §7 — Open questions / constraints

1. **H4 — retroactive-run outcome.** Slice 60 HIGH ratio unknown.
   If <100%, arc extends with rule-set additions. Chief empirical
   risk.
2. **H5 — CLAUDE.md line count.** Currently 256; subsection ~30-50
   lines → likely fits within 300. If not, fallback to
   `specs/methodology/`.
3. **CONSTRAINT: P2.9 restart timing.** This arc does not resume
   P2.9. Operator decides after Slice 62.
4. **DECIDED: `/circuit:run` routing heuristic removed** per Codex
   P2.9 MED 9.
5. **DECIDED: `blocked` is full escrow** per pass 02 HIGH 5 fold-in.
6. **DECIDED: effective-date migration** per pass 02 CRITICAL 2
   fold-in.

## §8 — Self-validation (reflexive, revision 08)

This plan is authored under the discipline it proposes.

**Plan lifecycle status evidence (state-protocol, not chronology).**
- Current status: see frontmatter `status:` field (authoritative).
- Revision: see frontmatter `revision:` field.
- Preparation commits: enumerate via `git log --oneline` against
  files under `specs/plans/planning-readiness-meta-arc.md` and
  `specs/reviews/planning-readiness-meta-arc-codex-challenger-*.md`.
- Revision authoring source: most recent challenger-pass review
  artifact referenced in frontmatter `prior_challenger_passes:`
  list. Revision N+1 is authored in response to pass N's fold-ins.

**Structured ledger (per §1):**
- Verified claims: E1-E10, E11-E15, E16-E22, E23-E26 (26 total).
- Hypotheses: H1, H2, H3 resolved during preparation; H4, H5 remain
  open (H4 resolves at Slice 60; H5 resolves at Slice 61).
- Unknown-blocking: none remaining.

**Arc trajectory (per §Entry-state):** explicit section.

**Why this plan does not trigger ADR-0003 contract-shaped-payload gate:**
- Arc targets are ADRs + tools + rules (greenfield to the arc).
- No artifact ids declared for a runtime surface.
- No invariant text declared as normative runtime deliverable; §3
  rules are plan-lint ids, not runtime invariants.

**Plan's commitment to its own lint (substantive proof):**
Iteration history:
- Rev 04: self-lint GREEN but VACUOUSLY — `isLegacyPlan` sliced the
  local-timezone date and misclassified a Pacific-evening commit as
  pre-effective. Pass 04 caught this.
- Rev 05: refactored `isLegacyPlan` to use `git merge-base
  --is-ancestor` against `META_ARC_FIRST_COMMIT` (c91469053a...).
  Eliminates date-comparison entirely. Self-lint GREEN and
  SUBSTANTIVE — verified by pass 05 via explicit trace (first-commit
  SHA equals META_ARC_FIRST_COMMIT → non-legacy → runAllRules
  reaches the 22-rule array).
- Rev 06 (this revision): folds pass 05's 3 fold-ins — (a) committed
  test fixture for P2.9 at `tests/fixtures/plan-lint/bad/p2-9-
  flawed-draft.md` so tests are clean-checkout reproducible; (b)
  §Migration + §0.D + §8 prose updated to describe the actual
  commit-ancestry mechanism (no more stale Date.parse references);
  (c) §8 language past-tense reflecting HEAD reality.

**Next action (state-protocol, not chronology-list).**
The plan's forward progress is governed by the §Plan-lifecycle state
machine. From `challenger-pending` status, the next transition is
`challenger-cleared` upon commit of an accept-class committed Codex
challenger-pass review file matching the current plan (slug +
revision + base_commit + plan_content_sha256). From
`challenger-cleared`, the next transition is `operator-signoff` via
a commit carrying `operator_signoff_predecessor: <sha>`. This
section intentionally does NOT enumerate slice-specific commit
identifiers — they would drift with every commit and trigger the
chronology-drift false-positive pattern observed across passes
04-07. The state machine is the authority; specific next-slice IDs
belong in the commit log, not in the plan's self-validation.
