---
name: arc-methodology-trim-composition-review-claude
description: Fresh-read Claude composition-adversary pass over the Methodology-Trim Arc (Slices 64-67 + per-slice fold-ins 64a/65a/66a/67a as a unit). Arc-close ceremony per CLAUDE.md §Cross-slice composition review cadence.
type: review
reviewer_model: claude-opus-4-7
authorship_role: fresh-read-composition-adversary
review_kind: arc-close-composition-review
review_date: 2026-04-23
verdict: ACCEPT-WITH-FOLD-INS
authored_by: claude-opus-4-7
review_target: methodology-trim-arc
target_kind: arc
target: methodology-trim-arc
target_version: "HEAD=34e79cb (slice-67a Codex fold-ins — ACCEPT-WITH-FOLD-INS)"
arc_target: methodology-trim-arc
arc_version: "revision 02 / operator-signoff / slices 64-67a landed"
opening_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: "ACCEPT-WITH-FOLD-INS (1 HIGH + 2 MED top-three; 1 MED + 2 LOW in appendix)"
severity_counts:
  critical: 0
  high: 1
  med: 3
  low: 2
commands_run:
  - read specs/plans/methodology-trim-arc.md revision 02 end-to-end
  - read all 4 per-slice Codex reviews (arc-slice-64, 65, 66, 67-codex.md) + pass-06 challenger artifact
  - read all 8 arc commit bodies (42fdd2f 64 / f525a6f 64a / 6ef6425 65 / 00f6e66 65a / c5ed772 66 / 6003cf6 66a / 3e9336a 67 / 34e79cb 67a) with structured trailers
  - scan `ARC_CLOSE_GATES` in scripts/audit.mjs:3312-3372 — 5 entries pre-slice-68
  - scan readLiveStateSection production-caller footprint — only audit.mjs, audit.d.mts, tests/scripts/audit-live-state.test.ts, plan
  - scan §0 Live state contract bindings — tests/contracts/session-hygiene.test.ts:118 binds current_phase ↔ **Phase:** only
  - scan framing-label boundary check — scripts/audit.mjs:429-430 + SLICE_65_FRAMING_BOUNDARY = 6ef64255 (honest sharpness ratchet)
  - run `node scripts/plan-lint.mjs specs/plans/methodology-trim-arc.md` → RED on authoring-default (operator-signoff not valid authoring status)
  - scan trailer adoption across all 8 commits — 100% carry Lane/Isolation/Arc-Ref/Signoff-Predecessor
  - scan forcing-function citation — present in slice-64 body only; slices 65-67a do not cite
  - `npm run verify` at HEAD=34e79cb → 1218 tests green
  - `npm run audit` at HEAD=34e79cb → 32 green / 3 yellow / 0 red (yellows pre-existing)
opened_scope:
  - full arc slices 64 → 67a as composition unit
  - dual-surface live-state authority (HTML-comment marker vs §0 bullets vs **Phase:** line)
  - plan-lint context-split UX on committed plans
  - forcing-function discharge mechanism
  - ARC_CLOSE_GATES authoring-cost trajectory
  - trailer-literal consistency across arc window
  - framing-label sharpness at Slice 65 boundary
  - net burden accounting (plan §7) vs lived reality
skipped_scope:
  - P2.9 restart execution (downstream arc — the forcing-function measurement itself is out of scope here)
  - full migration of existing §0 consumers (post-P2.9 deferred per plan §5.2 compat-shim)
  - reference-Circuit parity (explicitly out of arc authority)
fold_in_status:
  HIGH-1: "pending operator decision — either land R14 parallel-read validation at Slice 68 (plan §9 recorded as 'optional Slice 68 enhancement') OR record acceptance with rationale in ADR-0010 follow-up"
  MED-1: "pending — fold into Slice 68 ceremony if trivial; else defer to post-P2.9 with a CLAUDE.md §Plan-authoring note"
  MED-2: "pending — plan §6 requires Slice 68 ceremony commit to cite forcing function; this closes the per-slice gap but leaves the measurement-point contract unbound"
findings:
  - id: HIGH-1
    severity: high
    title: current_slice and current_arc §0 fields have no contract binding to the legacy HTML-comment marker; R14 survives arc-close unaddressed
  - id: MED-1
    severity: med
    title: Bare `npm run plan:lint` on a committed plan returns a false RED under authoring-default context
  - id: MED-2
    severity: med
    title: Forcing-function citation is narrative-only; no audit gate enforces pre-arc baseline comparison at P2.9 restart
  - id: MED-3-appendix
    severity: med
    title: ARC_CLOSE_GATES authoring cost compounds linearly (now 6 entries); auto-generation inflection approaching
  - id: LOW-1-appendix
    severity: low
    title: Isolation-literal drift mid-arc (re-deferred → policy-compliant between slice-64a and slice-65)
  - id: LOW-2-appendix
    severity: low
    title: Operator feedback on after-slice summary style keeps recurring; CLAUDE.md updates have not stopped the drift
---

# Methodology-Trim Arc — composition-adversary review (Claude fresh-read prong)

## Verdict

**ACCEPT-WITH-FOLD-INS.** The arc genuinely discharged its pass-06 fold-in contract, slice-by-slice Codex fold-in coverage was 4/4 ACCEPT-WITH-FOLD-INS with all findings folded in the same ceremony commit, and the audit surface is honest green/yellow (32/3/0). The methodology change this arc actually ratchets — framing quadruplet → pair, rule-count −2, plan-lifecycle context split, live-state §0 surface — all appear in authority (`CLAUDE.md`, `ADR-0010`, `ADR-0011`, plan-lint) with matching test coverage.

The three findings below are composition-level only: each slice was locally honest; the seams visible only at arc-close are where objections land. None contradicts a slice-level Codex ACCEPT.

## Top 3 findings (severity-descending)

### HIGH-1 — current_slice and current_arc §0 fields have no contract binding to the legacy HTML-comment marker; R14 survives arc-close unaddressed

**Observation.** `PROJECT_STATE.md` now carries three live-state surfaces:

1. `<!-- current_slice: 67a -->` HTML-comment at line 1 (legacy; gate-consumed).
2. `**Phase:** 2 — Implementation (continuing)` at line 5 (legacy; SESSION-I2 + phase-drift gate-consumed).
3. `## §0 Live state` bullets for `current_slice`, `current_arc`, `current_phase` (new; compat-shim per plan §5.2).

Slice 67a LOW-1 added `tests/contracts/session-hygiene.test.ts:118` binding the §0 `current_phase` bullet to the top-level `**Phase:**` line (asserts same phase number). That correctly closed ONE binding gap.

Two gaps remain open:

- `current_slice` is in both the HTML-comment and in §0. No contract test binds them. `extractCurrentSliceMarker` reads only the HTML-comment; `readLiveStateSection` reads only §0. A manual edit to one surface that forgets the other passes audit silently.
- `current_arc` exists only in §0 — there is no legacy mirror to bind against, and no contract test asserts it matches the arc named in the plan frontmatter at `specs/plans/<arc>.md`.

Plan §9 records this risk explicitly as R14 ("marker-vs-section drift during compat-shim window") with mitigation language "audit parallel-read validation (optional Slice 68 enhancement)." Slice 68 is the current ceremony. Either:

- **(a)** Land the parallel-read validation now (two contract tests: one binding §0 `current_slice` to HTML-comment marker with identical value; one binding §0 `current_arc` to the frontmatter `plan:` field in the matching `specs/plans/<arc>.md`), OR
- **(b)** Record explicit acceptance of the drift risk with rationale in an ADR-0010 follow-up or a PROJECT_STATE.md comment, so R14 has a written disposition rather than surviving the arc open.

**Composition nature.** Each slice that touched the live-state surfaces was locally correct: Slice 67 added the §0 fields alongside the marker (compat-shim); Slice 67a bound `current_phase`. Neither slice owned `current_slice`/`current_arc` binding explicitly, so the gap fell through. Only arc-close sees that R14 was named and then not discharged.

**Minimum fold-in.** Add two contract-test cases (~40 lines) to `tests/contracts/session-hygiene.test.ts` for `current_slice` parity and `current_arc` frontmatter parity. No audit-check changes required; test-only ratchet.

**Acceptable alternative.** Record in ADR-0010 appendix "R14 disposition — 2026-04-23: compat-shim window extended through P2.9 restart; drift risk accepted because no production consumer reads §0 fields; re-evaluate at Slice 70 or first post-P2.9 slice."

### MED-1 — Bare `npm run plan:lint` on a committed plan returns a false RED under authoring-default context

**Observation.** Running `node scripts/plan-lint.mjs specs/plans/methodology-trim-arc.md` at HEAD=34e79cb emits:

```
RED [plan-lint.status-field-valid]
  Invalid status "operator-signoff" in authoring context.
  Valid statuses: evidence-draft, challenger-pending
```

The plan is fully green under `--context=committed`, and Check 36 validates it correctly at commit boundaries. But the bare command lies: the operator sees RED on a valid plan.

Plan §4.5 states the default is `authoring` for draft-window ergonomics ("preserves existing CLI behavior for plan authors running `npm run plan:lint` on their drafts"). This preserves authoring ergonomics but sacrifices committed-plan ergonomics. The tradeoff is asymmetric: drafts are untracked and uncommitted; committed plans are the common investigative target during audit failures.

**Composition nature.** Slice 66 introduced the split. Slice 67/67a didn't touch the CLI. Slice 68 is the last free moment before P2.9 uses the CLI under restart-debug pressure.

**Minimum fold-in.** Either:

- **(a)** Auto-detect context: if the path is tracked in git, default to `--context=committed`; else `--context=authoring`. `isGitTracked(path)` already exists from Slice 58.
- **(b)** On status-field-valid RED under authoring context, add a one-line hint: "Plan appears committed; retry with `--context=committed`."

Option (b) is one line and zero behavior change for correctness; option (a) is slightly more work but eliminates the trap.

**Deferrable.** If Slice 68 budget is tight, land a CLAUDE.md §Plan-authoring note explaining the default + hinting at `--context=committed` for committed plans. Ergonomics debt, not a correctness bug.

### MED-2 — Forcing-function citation is narrative-only; no audit gate enforces pre-arc baseline comparison at P2.9 restart

**Observation.** Plan §7 honestly admits net-additive burden: **+6 artifacts/ADRs / -2 rules / internal complexity +1**. The arc pays rent only if P2.9 restart -a rate falls below the 15% forcing-function target. Plan §Why this plan exists states: "P2.9 is the forcing-function test: target -a rate < 15%; reopen trim work if P2.9 restart exceeds 3 slices or -a > 20%."

Slice-level forcing-function citation coverage across the arc:

| Slice | Body cites forcing function? |
|---|---|
| 64 | yes |
| 64a | no |
| 65 | no |
| 65a | no |
| 66 | no |
| 66a | no |
| 67 | no |
| 67a | no |

Plan §6 requires the Slice 68 ceremony commit to cite the forcing function, which will bring per-slice coverage to 2/9. Ceremony commit citation closes the per-slice authoring gap but leaves a more fundamental contract unbound: **nothing enforces that P2.9 restart's -a rate is compared against a pre-arc baseline.**

No audit gate exists for:

- Is a pre-arc -a rate baseline recorded anywhere? (Answer: plan §9 row R7 says "Pre-arc baseline on last 3 non-meta arcs is documented prior to arc start" — search yields no committed baseline artifact.)
- Does P2.9 restart's slice commit body reference the baseline?
- If P2.9 completes with -a > 20%, is there a gate that reopens trim work?

If P2.9 restart proceeds without measuring against a baseline, the forcing function never discharges. The ceremony expansion is then permanent with no measured return. The arc honesty depends on future discipline that has no machine binding.

**Composition nature.** Each slice body reasonably omitted forcing-function restatement — the plan is the authority. But the arc as a whole has an implicit contract (measure P2.9 at -a < 15% or reopen) that lives only in plan §Why this plan exists. It survives as narrative across Slice 68 close and into P2.9.

**Minimum fold-in.** Record the pre-arc baseline in a committed artifact before Slice 68 closes. Either:

- **(a)** One-line -a-rate summary in PROJECT_STATE-chronicle.md arc-close entry: "Methodology-trim-arc closed at Slice 68. Pre-arc baseline -a rate across last 3 non-meta arcs: <N%>. Forcing-function discharge point: P2.9 restart slice; target -a < 15%; reopen-trim trigger -a > 20%."
- **(b)** New file `specs/plans/methodology-trim-arc-baseline.md` with git-log-derived -a counts across the 3 most recent non-meta arcs.

Option (a) is in-scope for the arc-close ceremony; option (b) is separate work.

**Deferrable.** Acknowledged: the forcing-function discharge mechanism is the whole point of the arc, and deferring baseline recording further weakens the discharge contract. If neither option lands at Slice 68, the risk is that future Claude, facing a P2.9 restart -a rate of 18%, has no baseline to compare against and has to reconstruct one under pressure.

## Appendix (MED + LOW findings)

### MED-3 — ARC_CLOSE_GATES authoring cost compounds linearly; auto-generation inflection approaching

`scripts/audit.mjs:3283` carries a comment: *"A fully automatic arc-ledger gate (derived from arc metadata in specs/arcs.json or equivalent) remains a candidate further step if maintaining this table becomes costly; at two entries it is still easier than authoring a ledger schema."*

Entry count trajectory:

| Slice | ARC_CLOSE_GATES length |
|---|---|
| 35 (introduction) | 1 |
| 44 | 2 |
| 47d | 3 |
| 55 | 4 |
| 62 | 5 |
| 68 (this ceremony) | 6 |

The "at two entries it is still easier" comment is stale after 200%+ growth. Per-entry authoring cost:

- New numeric const export in `scripts/audit.mjs` (~5 lines)
- Matching `.d.mts` type decl (~2 lines)
- New `ARC_CLOSE_GATES` frozen entry (~8 lines)
- Contract-test length-pin bump (1 line)
- Contract-test per-arc block asserting id / ceremony_slice / plan_path / review_file_regex (~15 lines)

Net ~30 LOC + ~30 min of ceremony per arc-close. At 6 entries, the auto-generation inflection is here or one arc away. Not a correctness issue; cognitive-load and ceremony-cost compounds silently.

**Recommended follow-up** (post-Slice-68, not blocking): draft `specs/arcs.json` schema + migrate ARC_CLOSE_GATES to derive from it. Archive the hand-authored array. This would also naturally address the companion concern of "what's the authoritative list of arcs" (currently spread across plan files and this frozen array).

### LOW-1 — Isolation-literal drift mid-arc

Arc commit trailers carry two distinct Isolation literals, transitioning at the slice-64a → slice-65 boundary:

| Commits | Isolation literal |
|---|---|
| 0cef817, 41bd4da, 42fdd2f, f525a6f (pre-65) | `re-deferred per ADR-0007 CC#P2-7` |
| 6ef6425, 00f6e66, c5ed772, 6003cf6, 3e9336a, 34e79cb (65+) | `policy-compliant (no implementer separation required)` |

Both literals are valid per plan §2.4 (both appear in the `Isolation:` placeholder enumeration in `.gitmessage`). No audit check distinguishes; consistency is honor-system.

The transition is undocumented — nothing in a slice-64a or slice-65 commit body explains the posture shift. A reader reconstructing the arc later has to infer whether the shift was deliberate (e.g., Slice 65 marking a milestone in container-isolation readiness) or incidental (author changed the default in their local `.gitmessage` and copied it forward).

**Recommended follow-up.** Either pick one literal for the arc and stick to it, or add a one-line rationale to the first commit that switched.

### LOW-2 — After-slice summary style feedback loop

Memory record `feedback_after_slice_summary_style.md` (2026-04-23) was added because post-slice-67 operator feedback said plain-English wrap-ups were still too dense/jargon-laden. CLAUDE.md §After-slice operator summary (80 lines) already specifies: "Write it like you'd explain it to someone walking up to your desk. No project-internal shorthand — no lane names, close-criterion numbers, ADR ids, slice codenames, phase-transition terminology, or gate/ratchet/audit vocabulary."

The feedback recurring after that guidance was landed suggests the guidance is insufficient. Possible causes:

- Claude internalizes the guidance but still drifts under ceremony-heavy slice pressure.
- CLAUDE.md guidance is read-once at session start; the LOW-surface reminders fade under long arcs.
- The three-beat template is too prescriptive to produce plain English and too loose to catch jargon.

**Recommended follow-up.** Consider: (a) a deterministic post-slice hook that extracts the three beats from a structured template and flags jargon literals (`CC#`, `D\d`, `F\d+`, ADR ids, slice codenames); (b) moving the summary from free-form Claude output to a structured commit-trailer field; (c) dropping the three-beat template and replacing with "one sentence per beat, no clauses longer than eight words."

Out of scope for this ceremony; flagged as a meta-loop the methodology-trim arc was meant to address but didn't.

## Honest record

- `npm run verify` at HEAD=34e79cb → 1218 tests green, 19 skipped. No arc-introduced regressions.
- `npm run audit` at HEAD=34e79cb → 32 green / 3 yellow / 0 red. The 3 yellows are all pre-existing (AGENT_SMOKE fingerprint, CODEX_SMOKE fingerprint, framing-pair on three pre-ratified plan-prep commits 0cef817/e62b187/455f8d3); all predate the arc and are documented blocked state in the continuity debt ledger.
- Slice 65a MED-1 was cleanly closed: `SLICE_65_FRAMING_BOUNDARY = 6ef64255` + `commitIsPreSlice65Framing(hash)` makes the framing-label ratchet sharp, not honor-system.
- Slice 64a HIGH-1 self-hosting concern for ADR-0011 was resolved in the fold-in (ADR-0011 now demonstrates the Decision/Appendix split it advocates).
- Trailer adoption across 8 arc commits: 100% carry the four-field structured trailer (Lane / Isolation / Arc-Ref / Signoff-Predecessor).
- Per-slice Codex passes: all 4 slice reviews + fold-ins at ACCEPT-WITH-FOLD-INS with all findings folded in the same ceremony commit. No deferrals survived into later slices.

The arc is ready to close. The three findings above are fold-in candidates for the Slice 68 ceremony commit or explicit-acceptance records; none blocks arc-close.

## Closing verdict

**ACCEPT-WITH-FOLD-INS.** The methodology-trim arc delivers a net-positive change relative to its explicit pre-arc contract (reduce ceremony to enable P2.9 measurement), honestly accounts for the +6/−2 burden ledger, and ships with clean per-slice review coverage. The three findings above are composition-level refinements only an arc-close sees. HIGH-1 (R14 disposition) deserves either a minimum fold-in or an explicit acceptance record before Slice 68 closes; MED-1 (plan-lint UX) and MED-2 (forcing-function baseline) are strongly recommended but deferrable with acknowledged debt.
