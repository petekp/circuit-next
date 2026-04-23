---
adr: 0010
title: Arc Planning Readiness Gate — Pre-Operator-Signoff Discipline for Multi-Slice Plans
status: Accepted (post-Slice-57 Codex challenger pass ACCEPT-WITH-FOLD-INS with 5 mechanical fold-ins applied inline before commit)
date: 2026-04-23
author: claude-opus-4-7 (drafted under operator direction — autonomy-mode session 2026-04-22 → 2026-04-23) + gpt-5-codex (challenger — plan-level passes 01-08 resolved via 8-iteration convergence; slice-level ADR challenger pass ACCEPT-WITH-FOLD-INS with 5 mechanical fold-ins applied)
supersedes: none
related:
  - ADR-0001 (parent methodology; this ADR extends discipline surface without reopening the tournament decision)
  - ADR-0003 (authority-graph gate for contract authorship; this ADR extends the gate's scope to contract-shaped plan payload via an addendum filed alongside this ADR)
  - ADR-0007 (Phase 2 close criteria; this ADR's sibling addendum to ADR-0007 tightens CC#P2-1 scoping to exclude second-workflow-generalization from the one-workflow-parity criterion)
amends:
  - CLAUDE.md §Plan-authoring discipline (landed Slice 61 of planning-readiness-meta-arc: 20-line onboarding summary pointing back to this ADR as authority; discipline layer is prose-only, machine enforcement stays in plan-lint + audit Check 36)
  - specs/invariants.json::enforcement_state_semantics (landed Slice 59 of planning-readiness-meta-arc: adds `blocked` state per §Decision.4 below; six keys now present)
---

# ADR-0010 — Arc Planning Readiness Gate

## Context

On 2026-04-23, Claude drafted `specs/plans/p2-9-second-workflow.md` (700
lines, untracked) under operator direction. The plan reached an
operator-decision point carrying multiple material flaws:

- Stale symbol ownership (cited `WORKFLOW_KIND_CANONICAL_SETS` at
  `scripts/audit.mjs` when the constant had moved to
  `scripts/policy/workflow-kind-policy.mjs`).
- Unenforceable invariant (REVIEW-I1 clause (b) required adapter identity
  on a verdict step planned as orchestrator `close` — runtime dispatch
  at `src/runtime/runner.ts:503` does not touch adapter identity on
  close steps).
- CLI shape divergence (plan used `--scope`; actual CLI uses `--goal` +
  positional workflow per `src/cli/dogfood.ts:13-48`).
- Artifact-model overreach (4 artifacts declared where reference surface
  has 1).
- Ratchet-already-landed framing (Slice 61 proposed "generalize Check 23
  from 2-command to N-command" when Check 23 is already N-command
  data-driven per `scripts/audit.mjs:2680-2686`).

A Codex challenger pass (dispatched via `/codex` skill) returned verdict
`DO NOT SIGN OFF` with 6 HIGH minimum fold-ins + 7 MED findings = 13
total. The full ledger is persisted at
`specs/reviews/p2-9-plan-draft-content-challenger.md` (authoritative
committed denominator).

The plan was caught only because the operator manually requested Codex
intervention. Without that request, a 5-slice arc would have opened on
a stale foundation.

**The loophole is structural.** CLAUDE.md §Hard-invariants #6 mandates
per-slice Codex challenger for ratchet-changes / ADRs / escrows /
discovery-promotion / gate-loosening. That protocol fires AT slice
execution time. CLAUDE.md §Cross-slice-composition-review-cadence
mandates arc-close composition review for arcs spanning ≥ 3 slices.
That protocol fires AFTER an arc closes. Neither protocol gates
**plan-authoring-time** correctness — the moment when operator is
asked to sign off on multi-slice scope + shape. A plan can reach
operator sign-off carrying material flaws that would only surface at
slice-execution time if and when a slice challenger pass happens to
look in the right place. By then the arc is committed, the operator
has anchored on a shape, and corrections become rework rather than
authoring choices.

ADR-0003 §Contract-First-is-conditional gates `specs/contracts/*.md`
authorship for successor-to-live surfaces until authority-graph
classification + characterization land. The P2.9 plan payload invented
artifact ids, invariant text, verdict vocabulary, CLI invocation
shape, and runtime compatibility posture as normative deliverables
without ever committing a `specs/contracts/*.md` file — evading the
gate's intent (invention-before-extraction prevention) by staying in
the plan layer. This is the exact loophole Codex meta-retrospective
named.

The fix requires a **machine-enforced pre-operator-signoff gate** for
any multi-slice or ratchet-advancing plan, applying the same evidence
discipline ADR-0003 requires for contract authorship: live-surface
verification before normative payload, explicit hypothesis marking for
unverified claims, challenger clearance before sign-off.

## Decision

### 1. Plan-lifecycle state machine

Every multi-slice or ratchet-advancing plan file (`specs/plans/*.md`)
carries a `status:` field in its YAML frontmatter. Valid values form a
closed state machine:

| Status | Meaning | Git-tracking | Committed challenger artifact |
|---|---|---|---|
| `evidence-draft` | Authoring in progress; evidence census + shape exploration. | OPTIONAL (may be untracked during first-draft authoring). | NONE required. |
| `challenger-pending` | Plan committed; awaiting Codex challenger pass. | REQUIRED (must be in git index or HEAD). | NONE yet (pass is running). |
| `challenger-cleared` | Codex challenger verdict is `ACCEPT` or `ACCEPT-WITH-FOLD-INS`; fold-ins (if any) already applied. | REQUIRED. | REQUIRED — committed file at `specs/reviews/<plan-slug>-codex-challenger-*.md` with verdict field `ACCEPT` or `ACCEPT-WITH-FOLD-INS`. |
| `operator-signoff` | Operator has reviewed the challenger-cleared plan and signed off; slices may open. | REQUIRED. | REQUIRED (inherited from challenger-cleared predecessor commit). |
| `closed` | Arc has landed; plan frontmatter carries `closed_at:` + `closed_in_slice:`. | REQUIRED. | Inherited. |

### 2. Transition rules (enforced by plan-lint)

- `evidence-draft → challenger-pending` — plan MUST be git-tracked.
  Untracked drafts cannot claim any status beyond `evidence-draft`.
- `challenger-pending → challenger-cleared` — a matching committed
  file at `specs/reviews/<plan-slug>-codex-challenger-*.md` must exist
  with verdict field `ACCEPT` or `ACCEPT-WITH-FOLD-INS`. If verdict
  is `REJECT-PENDING-FOLD-INS`, status stays at `challenger-pending`
  until revision lands and a fresh challenger pass (NN+1) commits
  with accept-class verdict.
- `challenger-cleared → operator-signoff` — the commit carrying this
  transition MUST reference the challenger-cleared predecessor commit
  in its commit body (`operator_signoff_predecessor: <sha>`). Operator
  sign-off is the only authorization for slice-opening.
- `operator-signoff → closed` — arc-close ceremony slice; not
  gate-constrained by this ADR.

**The untracked-draft loophole closes here.** `operator-signoff` and
`challenger-cleared` both require git-tracked state. Any plan claiming
these statuses while untracked fails plan-lint + audit. Operators can
observe: a plan cannot reach sign-off without being committed first,
and challenger-cleared status cannot be claimed without a committed
Codex review artifact.

### 3. Required fields in plan frontmatter

| Field | Requirement | Enforcement |
|---|---|---|
| `plan:` | String id matching filename stem. | discipline field (not a named lint rule in the active 20-rule set post-Slice-65) |
| `status:` | One of the state-machine values in §1. | plan-lint rule #15 |
| `revision:` | Increments on each challenger-pass round (01, 02, …). Required from `challenger-pending` onward. | discipline field; rule #17 consults `revision` at freshness binding check |
| `base_commit:` | Git SHA of HEAD at plan authoring. Required for rule #17 freshness binding. | plan-lint rule #17 (required for `challenger-cleared` status) |
| `target:` | Scope description (workflow, subsystem, discipline area). | discipline field; rule #10 consults `target` for hypothesis-vs-decided check |
| `prior_challenger_passes:` | List of committed challenger-pass files. Required from `challenger-cleared` onward. | discipline field; rule #17 consults specs/reviews/<slug>-codex-challenger-*.md for verdict + binding |
| `authority:` | Citations. Cited paths/symbols checked opportunistically by rule #4 (stale-symbol-citation) when they appear in plan body. | plan-lint rule #4 (partial — rule scans body for path:symbol references; frontmatter authority list provides human audit trail) |

The "discipline field" entries above are required by the plan-authoring
discipline but not directly enforced by a named rule in the current 22-
rule set. Future rule additions (per ADR-0010 Reopen conditions) may
promote them to mechanical enforcement.

Additional required content sections (enforced by plan-lint rules):

- §Evidence census with structured per-claim status (verified /
  inferred / unknown-blocking / hypothesis). Rule #1.
- §Arc trajectory justification (what arc goal, what phase goal,
  whether earlier slices have shifted the terrain). **Authoring
  convention post-Slice 65 — rule #11 was cut and the check folded
  into the commit-body framing pair's `Why this not adjacent:`
  label.** Plans are still expected to carry a "why this plan
  exists" / entry-state section because plan readers need the
  trajectory signal; it is no longer mechanically gated.
- §Acceptance evidence per slice (no TBD / TODO). Rule #2.

### 4. Invariant enforcement-layer vocabulary

Plans declaring invariants MUST use the authoritative circuit-next
enforcement-layer vocabulary. The authoritative source is
`specs/invariants.json::enforcement_state_semantics`:

- `test-enforced` — Invariant id appears as a token in at least one
  binding_ref test-file path.
- `audit-only` — Invariant id appears as a token in scripts/audit.mjs.
- `static-anchor` — Invariant enforced structurally by schema export
  or superRefine; binding_refs name the schema file plus at least one
  test file that parses that schema.
- `prose-only` — Policy statement not directly testable; behavioral-
  track meta-invariants only. Requires `rationale` field.
- `phase2-property` — Reserved for Phase 2 property-test harness;
  requires `target_slice` + `reopen_condition`.

**New state (this ADR): `blocked`.** Invariant declared as normative
but enforcement is deferred to a substrate-widening slice named in the
arc. Requires `substrate_slice:` cross-reference field. Rationale: the
P2.9 REVIEW-I1 clause (b) case demonstrated a legitimate gap in the
existing vocabulary — an invariant that cannot be enforced at current
substrate AND cannot be classified as prose-only (it IS intended to
be enforced once the substrate widens). The `blocked` state captures
this explicitly and prevents agents from misclassifying under
`prose-only` or `phase2-property` which have different semantics.

**`blocked` vs `phase2-property` differentiation:** `phase2-property`
is for invariants whose enforcement harness (property-test framework)
will land at a specific Phase 2 scaffold slice and does not require
substrate-widening — only the harness. `blocked` is for invariants
that require substrate-widening (new step kind, new schema, new
runtime surface) to be enforceable at all. An invariant can be both
`blocked` and `phase2-property` (requires substrate widening AND
property harness); in that case `blocked` dominates until the
substrate-widening slice lands.

**Extension procedure:** `specs/invariants.json::enforcement_state_semantics`
landed `blocked` at Slice 59 of the planning-readiness-meta-arc (SHA
22506c0) per this ADR's authorization. The JSON is now the authoritative
vocabulary source with six keys: `test-enforced`, `audit-only`,
`static-anchor`, `prose-only`, `phase2-property`, `blocked`. Slice 59a
closed the residual fallback in `scripts/plan-lint.mjs` so the JSON is
mechanically authoritative (prior to 59a, the linter accepted `blocked`
via a hardcoded special case even when absent from the JSON).

### 5. Machine enforcement

**Layer 1: `scripts/plan-lint.mjs`.** Standalone tool. Invoked as
`npm run plan:lint -- <path>` (positional argument). Implements 20
active rules post-Slice-65. Origin and evolution: Slice 58 landed 19
structural/shape/state-machine/HIGH-coverage rules (#1-#6, #9-#21);
Slice 59 landed 3 invariant-enforceability rules (#7, #8, #22);
Slice 64 added rule #23 prospective-chronology-forbidden; Slice 65
(methodology-trim-arc) cut #8, #11, and #22 — #8 and #22 were
self-referential on `enforcement_layer: blocked` declarations that
no plan makes, and #11 was a prose-only duplicate of commit-body
framing that folded into the framing-pair. Numbering preserved as
gaps (precedent: rule ids are never reused). Returns non-zero exit
on any rule violation with structured finding output (rule id +
location + suggested fix).

**Layer 2: `scripts/audit.mjs` Check 36 (Slice 58).** Runs plan-lint
on all `specs/plans/*.md` committed files whose first-committed SHA
is NOT a strict ancestor of `META_ARC_FIRST_COMMIT` (per §Migration;
legacy plans are fully exempt). Additionally: for any committed plan
with `status: challenger-cleared`, the check verifies a matching
committed `specs/reviews/<plan-slug>-codex-challenger-*.md` file
exists with verdict field in `{ACCEPT, ACCEPT-WITH-FOLD-INS}` AND
whose `reviewed_plan:` frontmatter block binds `plan_slug`,
`plan_revision`, `plan_base_commit`, and `plan_content_sha256` all
matching the current plan. For `status: operator-signoff` or `status:
closed`, Check 36 validates the commit-body predecessor chain
(`operator_signoff_predecessor: <sha>`) rather than fresh SHA match.
Stale challenger artifacts (reviewing an earlier revision) are
rejected even if their verdict is accept-class. This closes both the
untracked-draft and the stale-challenger loopholes at the audit
layer.

**Layer 3 (discipline, not machine): `CLAUDE.md §Plan-authoring discipline`
+ user-memory `feedback_plans_must_be_challenger_cleared_before_signoff.md`.**
Landed at Slice 61 of planning-readiness-meta-arc. CLAUDE.md carries a
20-line onboarding summary of the 5-state lifecycle pointing back to
this ADR as authority. The memory file carries the operational
checklist for "do not present a plan for operator sign-off until
every condition is met." This layer does NOT enforce anything
mechanically — plan-lint (Layer 1) and audit Check 36 (Layer 2)
remain authoritative. Its purpose is agent-onboarding and human-model
collaboration prose, so new agents encounter the discipline without
needing to read this ADR end-to-end.

**Layer 4: `npm run verify` unchanged.** Plan-lint is per-plan not
per-verify (running plan-lint against every plan on every `npm run
verify` invocation would be non-composable with small-edit iteration
loops). The audit check ensures integrity at commit boundaries; the
standalone tool supports on-demand pre-commit lint.

### 6. Enforcement rule table (20 active; #8, #11, #22 cut in Slice 65)

| # | Rule id | Layer | Rejects |
|---|---|---|---|
| 1 | `plan-lint.evidence-census-present` | static-anchor | Plan missing §Evidence census (or §1 equivalent) with verified / inferred / unknown-blocking vocabulary. |
| 2 | `plan-lint.tbd-in-acceptance-evidence` | static-anchor | TBD / TODO in any Acceptance-evidence block. |
| 3 | `plan-lint.test-path-extension` | static-anchor | Test deliverable paths ending in `.md` when real tests are `.test.ts`. Section-aware: skips matches in §Failure-mode narrative sections. |
| 4 | `plan-lint.stale-symbol-citation` | static-anchor | `path/file.ext:Name` reference where file doesn't exist OR symbol not defined/owned at cited location. Slice-60a strengthening: re-exports (`export { X };`) and import-only appearances do NOT satisfy the rule — the cited file must be the authoritative declaration site (`export const/let/var/function/class/type/interface/enum`). For `.json` files, key-presence is checked opportunistically (top-level vs nested ownership not yet enforced). |
| 5 | `plan-lint.arc-close-claim-without-gate` | static-anchor | Arc-close-criterion-satisfied claims without naming the audit gate that enforces satisfaction. |
| 6 | `plan-lint.signoff-while-pending` | static-anchor | `operator_signoff: ready` while `challenger_status: pending` or missing. |
| 7 | `plan-lint.invariant-without-enforcement-layer` | static-anchor | Invariant without `enforcement_layer:` from the authoritative set in §4. Section-aware: skips rule-description sections. |
| 8 | — CUT Slice 65 — | | Was `blocked-invariant-without-full-escrow`. Self-referential on `enforcement_layer: blocked` — no current plan declares that layer; numbering preserved as gap. |
| 9 | `plan-lint.contract-shaped-payload-without-characterization` | static-anchor | Plan declaring artifact ids, invariant text, verdict vocabulary, or CLI shape for a successor-to-live surface without a characterization slice landing first. |
| 10 | `plan-lint.unverified-hypothesis-presented-as-decided` | static-anchor | `target: X` or `decision: X` where X is not in §Evidence-census verified rows AND not marked `hypothesis:`. |
| 11 | — CUT Slice 65 — | | Was `arc-trajectory-check-present`. Prose-only heuristic; folded into commit-body framing pair (`Why this not adjacent:` carries trajectory role). |
| 12 | `plan-lint.live-state-evidence-ledger-complete` | static-anchor | Plan citing symbols/files without corresponding §Evidence-census ledger row. |
| 13 | `plan-lint.cli-invocation-shape-matches` | static-anchor | CLI invocation using `--flag-name` that does not appear in actual CLI argv parser (reads `src/cli/dogfood.ts` at lint time). |
| 14 | `plan-lint.artifact-cardinality-mapped-to-reference` | static-anchor | Successor-to-live payload declaring artifact count without recording reference-surface cardinality and justifying departure. |
| 15 | `plan-lint.status-field-valid` | static-anchor | `status:` value outside `{evidence-draft, challenger-pending, challenger-cleared, operator-signoff, closed}`. Legacy plans exempt per §Migration. |
| 16 | `plan-lint.untracked-plan-cannot-claim-post-draft-status` | static-anchor | Untracked file with status beyond `evidence-draft`. |
| 17 | `plan-lint.status-challenger-cleared-requires-fresh-committed-challenger-artifact` | static-anchor | `status: challenger-cleared` ONLY (not beyond — operator-signoff and closed statuses are validated by ancestry/predecessor-chain binding enforced by audit Check 36, not by plan-lint SHA match). For challenger-cleared: matching committed `specs/reviews/<plan-slug>-codex-challenger-*.md` must exist whose `reviewed_plan:` frontmatter binds `plan_slug`, `plan_revision`, `plan_base_commit`, AND `plan_content_sha256` (computed at lint time from current plan file contents) all matching the current plan. Stale artifacts from earlier revisions OR stale-content same-revision edits rejected. The `plan_content_sha256` binding is explicit in the state-machine transition rule — a plan reaching challenger-cleared status MUST have its content hash match the reviewed hash at the moment the transition is performed. |
| 18 | `plan-lint.canonical-phase-set-maps-to-schema-vocabulary` | static-anchor | Plan declaring workflow phase set with titles not matching `scripts/policy/workflow-kind-policy.mjs::WORKFLOW_KIND_CANONICAL_SETS` canonical ids AND no explicit title→canonical mapping. |
| 19 | `plan-lint.verdict-determinism-includes-verification-passes-for-successor-to-live` | static-anchor | Successor-to-live verdict rule missing verification-passes clause when reference surface's verdict depends on verification. |
| 20 | `plan-lint.verification-runtime-capability-assumed-without-substrate-slice` | static-anchor | Plan deliverable assumes runtime capability (subprocess exec, markdown materialization) where current `src/runtime/runner.ts` writes only placeholder JSON for that step kind, AND no substrate-widening slice is scheduled. |
| 21 | `plan-lint.artifact-materialization-uses-registered-schema` | static-anchor | Plan declaring artifact shape (markdown, binary, specific JSON) not matching a registered schema in `src/schemas/` AND no schema-widening slice is scheduled. |
| 22 | — CUT Slice 65 — | | Was `blocked-invariant-must-resolve-before-arc-close`. Same self-referential failure mode as cut #8; numbering preserved as gap. |
| 23 | `plan-lint.prospective-chronology-forbidden` | static-anchor | Plan body under `specs/plans/**` using forward-looking chronology (future-slice references with predictive verbs, if-verdict-then-action syntax, imperative action lists, heading hints, or noun-led chronology). Section-aware (exact-canonical-heading skip list). Slice 64 methodology-trim-arc. |

### 6.5. Migration — effective-date gate for existing plans

**Effective date: 2026-04-23**, codified as the META_ARC_FIRST_COMMIT
(`c91469053a95519645280fd80394a4966ac7948e` — the Slice 57a commit).
A plan is legacy iff its first committed version in git is a STRICT
ANCESTOR of this commit. Legacy plans are fully exempt from ALL
plan-lint rules (20 active post-Slice-65; see §6). This prevents
audit Check 36 from red-failing the
existing plan corpus (which uses statuses like `active`, `in-
progress`, `superseded`, `draft`, or no status at all — none of
which match the new vocabulary).

**Legacy determination (revision 06 update per pass-05 CRITICAL 1 / HIGH 2 fold-in — final):**

A plan is legacy iff its FIRST COMMITTED VERSION'S SHA is a **strict
ancestor** of `META_ARC_FIRST_COMMIT`
(c91469053a95519645280fd80394a4966ac7948e — the Slice 57a commit).
- Equality (same-as-META_ARC_FIRST_COMMIT) is explicitly NON-legacy.
- Descendants of META_ARC_FIRST_COMMIT are NON-legacy.
- Untracked plans (no git history) are NON-legacy.
- Only strict ancestors are legacy.

Verified via `git merge-base --is-ancestor <first-commit-sha>
<META_ARC_FIRST_COMMIT>` + equality short-circuit check.

**Why commit-ancestry instead of date comparison:** Date-based checks
introduce timezone edge cases. A plan committed 2026-04-22 evening
Pacific time lands in UTC 2026-04-23 early morning; a UTC-boundary
check flips it from legacy to post-effective inconsistently with
author intent. Commit-ancestry codifies the effective boundary as a
specific git commit — any plan committed before that commit is
legacy, any plan committed at or after is gated.

**Authority:** frontmatter `opened_at` / `date` fields are NOT the
authority; git ancestry is. Plans cannot evade the gate by
backdating frontmatter or by any other claim.

**Scope of exemption (legacy):** all active rules skipped. Plan-lint
returns zero findings. Audit Check 36 stays green. (Rule count is
20 post-Slice-65; see §6 for the definitive list.)

**New-plan obligation:** any plan authored after the effective date
(2026-04-23) MUST pass all active rules when committed. Backdated
`opened_at` is ignored (cannot evade gate via frontmatter claims).
`opened_at` remains a useful frontmatter field for intent-signaling
but is NOT the legacy-determination authority — git history is.

**Migration of existing work:** plans active at effective-date
boundary stay at current status until they close under their
original discipline. Successors carrying new discipline inherit
obligations at authorship time.

### 7. Scope: when the gate applies

**Applies to:**

- Multi-slice plans (≥ 2 execution slices).
- Ratchet-advancing plans (any plan declaring a ratchet in slice
  ratchet sections).
- Plans involving `successor-to-live` surface payload (artifact ids,
  invariants, verdict vocabulary, CLI shape, runtime compatibility).

**Does NOT apply to:**

- Single-slice plans with no ratchet advance (e.g., pure refactor
  plans, scoped bugfix plans). These may stay at `evidence-draft`
  untracked until the slice lands.
- Arc-close ceremony plans (Disposable lane) — ceremony ordering is
  covered by CLAUDE.md §Cross-slice-composition-review-cadence.
- Legacy plans (strict-ancestor-of-META_ARC_FIRST_COMMIT). These are
  fully exempt from all active rules. New authorship (same-as or
  descendant-of META_ARC_FIRST_COMMIT) is fully gated.

## Consequences

### Accepted

- Plan authoring acquires a new machine-enforced discipline layer.
  The gate raises the authoring floor — operator sign-off becomes
  dependent on plan-lint green + Codex challenger pass committed,
  not on plan legibility alone.
- The untracked-draft loophole closes. Operators can no longer sign
  off on a plan that exists only in a working tree.
- Invariant enforcement-layer vocabulary converges on a single
  authoritative source. `specs/invariants.json::enforcement_state_
  semantics` becomes the one place to edit when the vocabulary grows.
- ADR-0003's invention-before-extraction prohibition extends to plan
  payload via the sibling addendum filed at Slice 57.

### Costs

- Plan authoring wall-clock time increases. A multi-slice plan now
  requires: evidence census draft + plan-lint green + committed
  challenger pass before operator sign-off. For small plans this is
  overhead; for P2.9-scale plans it's proportionate to the failure
  cost it prevents.
- New tool (plan-lint) + new audit check (Check 36) + new audit
  dimension (plan-quality). Maintenance surface grows.
- Memory rule load + CLAUDE.md edit consume discipline-doc budget.
  CLAUDE.md ≤300 lines ceiling must be respected (per Hard-invariant
  #10); if Slice 61 edit doesn't fit, subsection moves to
  `specs/methodology/plan-authoring-discipline.md` with a pointer
  from CLAUDE.md.
- Plan-lifecycle state machine adds a new git-tracking discipline to
  plans. Operators and agents must learn when a plan transitions
  status and what the transition requires.

### Reopen conditions

- **Empirical failure:** a flawed plan passes plan-lint green AND
  Codex challenger with `ACCEPT-WITH-FOLD-INS` or `ACCEPT` verdict,
  AND a subsequent slice execution exposes a material flaw of the
  category the gate was introduced to catch (stale-symbol-ownership,
  unenforceable-invariant, artifact-cardinality-overreach, CLI-shape-
  divergence, or successor-to-live invention-before-extraction). The
  reopen is an audit of the gate's rules against the new failure
  mode; adding a new rule closes the reopen.
- **Operator veto:** operator determines the gate's discipline cost
  outweighs its yield (e.g., plans consistently pass with no fold-ins
  and operator experiences the gate as pure ceremony). Reopen
  authors a retrospective naming the empirical base rate and
  proposes relaxation.
- **Substrate change:** if the runtime surface changes in a way that
  invalidates `enforcement_state_semantics` (e.g., step kinds
  restructure; dispatch model changes), the vocabulary extension
  procedure applies (Slice 59 precedent).

### Machine enforcement evolution

Plan-lint rule set is versioned. Adding a rule is a Ratchet-Advance
slice. Removing a rule or loosening its semantics requires an
ADR-0010 amendment. The rule set is not aggregate-scored — each rule
is tracked as a separate dimension per the no-aggregate-scoring rule
(ADR-0007 §Decision.3 precedent).

## Authority graph binding

This ADR is a discipline-layer artifact; it does not bind to
`specs/artifacts.json` artifact ids. Its authority is at the
methodology level (CLAUDE.md + ADR-0001 surface). The plan-lint tool
lives in `scripts/` and does not produce data-plane artifacts.

## Precedent firewall

Per ADR-0007 §6 precedent, this ADR's plan-lifecycle state machine
and pre-signoff gate are **not** cited as permission for any future
retarget, relaxation, or substitution of a close criterion, a
contract invariant, or a runtime constraint. ADR-0010's scope is
plan-authoring discipline. Citations of ADR-0010 in future ADRs
must name a plan-authoring concern explicitly; citations that treat
ADR-0010 as general "gate-relaxation precedent" are rejected on §6
grounds.

## References

- `specs/reviews/p2-9-plan-draft-content-challenger.md` — 13-finding
  ledger against P2.9 plan draft (authoritative denominator for
  Slice 60 retroactive proof ratio).
- `specs/reviews/planning-readiness-meta-arc-codex-challenger-01.md`
  — first-pass Codex challenger verdict REJECT-PENDING-FOLD-INS
  with 12 objections driving this ADR's revision 02 shape.
- `specs/plans/planning-readiness-meta-arc.md` — the plan that opens
  the arc landing this ADR + the plan-lint tool + the memory/CLAUDE.md
  discipline updates.
- `specs/invariants.json::enforcement_state_semantics` — authoritative
  source for invariant enforcement-layer vocabulary.
- `specs/adrs/ADR-0003-authority-graph-gate.md` — parent gate this ADR
  extends (via sibling addendum at same slice).
- `specs/adrs/ADR-0007-phase-2-close-criteria.md` — scope-separation
  addendum filed alongside (CC#P2-1 vs second-workflow generalization).
- `CLAUDE.md §Hard-invariants #6` — per-slice Codex challenger protocol
  that this ADR complements at the plan-authoring layer.
- `CLAUDE.md §Cross-slice-composition-review-cadence` — arc-close
  composition review protocol that this ADR complements at the
  pre-sign-off layer.
