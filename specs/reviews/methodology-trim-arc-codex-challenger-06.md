---
review: methodology-trim-arc-codex-challenger-06
reviewer: codex (cross-model challenger via codex exec, gpt-5.4 xhigh)
review_date: 2026-04-23
verdict: ACCEPT-WITH-FOLD-INS
fold_ins_minimum: 2  # two MED non-blocking
prior_objections_count: 5  # pass-05 F1-F5
prior_objection_resolution:
  resolved: 5  # F1 CLI-context, F2 compat-shim, F3 narrowed-skip+P5, F4 helper-unit-tests, F5 ledger-neutralization+R13/R14
new_findings:
  critical: 0
  high: 0
  med: 2
  low: 0
  total: 2
reviewed_plan:
  plan_slug: methodology-trim-arc
  plan_revision: 02
  plan_base_commit: 46cfceebe1f6cf0776d127f58afedc65486d0c5b
  plan_content_sha256: 1649996c9c593352b21c7e4f184e860c885de9caceb7aad6c86f55a198966aa2
  plan_content_sha256_note: "Post-transition SHA. Codex reviewed the plan at the pre-transition SHA 721faad8d19df4733c129a25bf158d32dda81712f7a1622179cc7b81016ce51d (plan committed at 455f8d3 / slice-64-prep, status challenger-pending). This artifact carries the POST-transition SHA so rule #17 validates on the currently-committed plan content (which includes the cleared_at / cleared_in_session / reviewed_plan frontmatter added by this transition). The review verdict applies to the plan BODY, which is unchanged between pre- and post-transition SHA — only frontmatter status + transition timestamps differ."
  plan_content_sha256_pre_transition: 721faad8d19df4733c129a25bf158d32dda81712f7a1622179cc7b81016ce51d
  plan_status_at_review: challenger-pending (committed at 455f8d3 / slice-64-prep)
  plan_status_post_review: challenger-cleared (committed at the transition slice alongside this review)
  recursive_validation: substantive_green  # plan-lint green at review-time SHA
pass_log_reference:
  - pass_01_draft: REJECT (1 CRITICAL governance-surface, 3 HIGH, 1 MED, 1 LOW)
  - pass_02_rev02: REJECT (F1 governance-surface-still-open, F4 rule-23-underfit, R6+trim-back non-blockers)
  - pass_03_rev03: REJECT (F1 TIER.md+reviews+MEMORY.md additions; R9 scope-reopen triggered)
  - pass_04_reframe: REJECT (§3.2 lifecycle-contract change, §3.4 hidden governance surface, plan-lint self-failure; operator authorized 5-slice exception)
  - pass_05_expanded_rev01: REJECT (2 HIGH + 2 MED + 1 LOW all classified underspec-within-5-slice-scope)
  - pass_06_expanded_rev02: ACCEPT-WITH-FOLD-INS (this review; 2 MED non-blocking)
purpose: |
  Persist Codex cross-model challenger pass 06 verdict against
  methodology-trim-arc.md revision 02. Pass 06 returned
  ACCEPT-WITH-FOLD-INS with 2 MED findings, neither blocking
  challenger-cleared. This artifact is the challenger-cleared
  authorization for the arc.

  Pass history context: the plan survived a 3-pass REJECT cycle on its
  original 3-slice framing (TUNE 1 challenger-trigger narrowing could
  not be enumerated completely; each pass kept finding more governance
  surfaces — R9 fired; operator directed Path A reframe), then
  another REJECT on the Path A reframe (§3.2 + §3.4 revealed as
  proper work, not cheap tunes; operator directed Path D scope
  expansion to 5 slices). Pass 05 on the expansion caught 5
  underspec-within-scope findings; pass 06 verifies their fold-ins.

  The 6-pass convergence exceeds Claude's original HIGH-2 "cap at N=3"
  guidance, explicitly authorized by operator as an arc-local
  exception to preserve methodology-arc integrity over budget discipline.
  Future arcs remain under the default 3-pass honest-bound.

  Both MED fold-ins apply at slice-open (§2.1 P5 verb-list specification
  + §5 readLiveStateSection fail-closed semantics + parity validation).
  Neither requires plan-revision 03.
---

# Codex pass 06 — ACCEPT-WITH-FOLD-INS

**Verbatim Codex output below.** Reviewed against
`specs/plans/methodology-trim-arc.md` at commit 452255d
(challenger-pending, content SHA
`721faad8d19df4733c129a25bf158d32dda81712f7a1622179cc7b81016ce51d`).

---

VERDICT: ACCEPT-WITH-FOLD-INS

1. `MED` — Compat-shim still permits silent live-state drift because the new helper is specified fail-open and the parity check is only optional.
Location: `/tmp/trim-arc-plan-expanded-rev02.md:236-243`, `:253-258`, `:315-316`; `scripts/audit.mjs:1852-1862`; `scripts/doctor.mjs:29-40`; `scripts/inventory.mjs:312-338`.
Evidence: rev 02 adds a second live-state authority (`## §0 Live state`) alongside the existing `<!-- current_slice -->` marker, but all current consumers remain marker-based. The only mitigation is R14's "optional" parallel-read validation at arc-close. More importantly, §5.4 says duplicate `## §0 Live state` sections should "return first section," while the existing marker helper already fails closed on duplicates by returning `null`. That combination means ambiguous or mismatched §0 data can survive green until some future consumer trusts the new helper.
Fold-in proposal: make marker-vs-§0 parity validation mandatory in Slice 67 or 68, and specify `readLiveStateSection` to fail closed on duplicate or mismatched live-state sections; add regression tests for duplicate-§0 and marker/§0 mismatch.
Blocks challenger-cleared: no

2. `MED` — P5 noun-led chronology closure is still underspecified because the verb matcher does not cover the plan's own examples.
Location: `/tmp/trim-arc-plan-expanded-rev02.md:84-93`, `:116`.
Evidence: P5 says it uses P1's verb list: `will, shall, opens, lands, commits, introduces, adds, stages, upcoming, prepares, queues, awaits, dispatch, transition, bump`. But the text says it should catch "Arc revision two advances plan-lint," and the new fixture includes "Revision three dispatches the review." `advances` is not in the listed set, and `dispatches` only matches if the implementation does unstated stemming/inflection. That leaves the pass-05 F3 fold-in partly resting on implied behavior rather than specified behavior.
Fold-in proposal: replace the prose list with the exact matching rule the implementation must use, or explicitly define inflected/stemmed verb families and add a fixture for `advances`.
Blocks challenger-cleared: no

---

## Slice-open fold-ins (both MED, non-blocking)

### Fold-in for Slice 64 (applies to §2.1 rule #23)

Pass-06 MED 2 asks for a specification of the exact verb matching rule. Slice 64
authoring must:

1. Replace the prose verb lists in P1 + P5 with either
   - (a) explicit verb lemma set + documented stemming rule, OR
   - (b) enumerated exact-string verb list that covers all inflected forms seen
     in the existing regression fixtures.
2. Add `advances` fixture case (noun-led + `advances`) if choosing (a) stemming
   rule. If choosing (b), expand the explicit list to cover: `advance, advances,
   advanced, dispatch, dispatches, dispatched, land, lands, landed, open,
   opens, opened, commit, commits, committed, transition, transitions,
   transitioned, bump, bumps, bumped, stage, stages, staged, prepare,
   prepares, prepared, queue, queues, queued, await, awaits, awaited`.
3. Regression fixture `chronology-noun-led.md` must include the `advances`
   example verbatim to verify coverage.

Recommendation: (b) explicit enumerated list. Simpler to implement and reason
about. No stemming-library dependency.

### Fold-in for Slice 67 (applies to §5 compat-shim)

Pass-06 MED 1 asks for mandatory parity validation and fail-closed semantics.
Slice 67 authoring must:

1. `readLiveStateSection` specification updated: returns `null` on
   - missing `## §0 Live state` section
   - duplicate `## §0 Live state` sections
   - section header typo / malformed
   - empty section (optional — plan may choose empty-returns-empty instead).
2. Parity validation is NO LONGER optional. Add as a new audit Check (call it
   Check 39 `project-state-marker-section-parity`): reads both the HTML-comment
   marker value and the `## §0 Live state` section current_slice field, fails
   red on mismatch. This replaces R14's "optional" language.
3. Unit-test coverage:
   - `readLiveStateSection` returns null on duplicate / typo / missing
   - parity-check Check 39 fires red on mismatch
   - parity-check Check 39 passes on matching values.

Rev 02 risk R14 is upgraded from MED-with-optional-mitigation to
LOW-with-mandatory-mitigation once Slice 67 lands. Slice 67 close criteria
(plan §5.5) extended to include parity-check test.

## Why this output is the challenger-cleared artifact

Per methodology §Cross-model challenger protocol, Codex produces an
objection list not an approval; the challenger-cleared status transition is
authorized by any ACCEPT-class verdict. ACCEPT-WITH-FOLD-INS is ACCEPT-class
when the remaining fold-ins are documented for slice-open application (done
above) and are not CRITICAL/HIGH (both are MED).

This artifact + the transition commit together satisfy ADR-0010 §Decision
requirements for the plan's status advance to `challenger-cleared`. Operator
signoff on the cleared plan is the next gate; Slice 64 opens after signoff.
