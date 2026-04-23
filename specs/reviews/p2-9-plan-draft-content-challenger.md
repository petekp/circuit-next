---
review: p2-9-plan-draft-content-challenger
reviewer: codex (cross-model challenger via /codex skill)
review_date: 2026-04-23
verdict: DO NOT SIGN OFF
fold_ins_minimum: 6
findings_count: 13
review_surface:
  path: specs/plans/p2-9-second-workflow.md
  status_at_review: draft (untracked, 700 lines)
  base_commit: a4de1d57230e82fd68e1164f9534f3aed8564943
continuity_source: .circuit/control-plane/continuity-records/continuity-79f40bf8-dcf8-4e83-ade5-f8772cd01728.json
purpose: |
  Persist the Codex content-challenger pass findings against the P2.9 second-
  workflow plan draft. These findings are the denominator for Slice 60's
  retroactive plan-lint proof-of-effectiveness run (planning-readiness-meta-arc
  Slice 60). This file exists because ADR-0010 cannot cite a session continuity
  record as authority (mutable, local-to-machine, not git-tracked); the
  findings must be persisted as durable evidence before they can be cited.
  Fidelity: reconstructed from the continuity record's state_markdown + debt_
  markdown narrative. Where a finding is a reconstruction rather than a verbatim
  Codex utterance, the entry is flagged `source: reconstructed`. Verbatim Codex
  output for this session was not preserved to disk at pass time; this
  document is the best-available reconstruction, and future challenger passes
  will be dumped verbatim to `specs/reviews/` at pass time (per ADR-0010
  enforcement contract).
---

# P2.9 Plan Draft — Codex Content Challenger Findings

## Verdict

**DO NOT SIGN OFF** — 6 minimum fold-ins required + ~13 findings across the
decision ledger. Plan as drafted must not reach operator sign-off until
fold-ins are resolved. Re-challenger pass required before sign-off.

## Context

Codex challenger dispatched via `/codex` skill in 2026-04-23 session after
Claude drafted the P2.9 second-workflow plan (700 lines, untracked at
`specs/plans/p2-9-second-workflow.md`). Challenger protocol: read-only
objection-list per CLAUDE.md §Cross-model challenger protocol. This pass
was an **arc-shape / multi-slice-scope** challenger pre-operator-signoff —
the category that ADR-0003 and ADR-0010 now gate machine-enforcement-wise.

## HIGH findings — minimum fold-ins required

### HIGH 1. Canonical phase mapping missing
**Source:** Codex verbatim summary. **Severity:** HIGH.

Plan declares 4-phase spine `{Intake, IndependentAudit, VerificationRerun,
Verdict}` but these titles do not map to the schema-valid canonical phase
set `{frame, analyze, plan, act, verify, review, close}` used by
`scripts/policy/workflow-kind-policy.mjs`. Plan must either (a) provide
explicit title→canonical map and `spine_policy.omits`, or (b) amend the
canonical set via a separate ADR before authoring the fixture. Plan does
neither; fixture authorship at Slice 59 would fail schema parse.

### HIGH 2. Artifact model contradicts reference surface
**Source:** Codex verbatim summary. **Severity:** HIGH.

Plan declares 4 new artifacts (`review.scope`, `review.report`,
`review.verification`, `review.result`) for the review workflow. Reference
Circuit's `review` skill (`~/Code/circuit/skills/review/SKILL.md`) emits
**exactly one artifact** (`review.md`). The 4-artifact model is invention,
not extraction. Per ADR-0003 §Clean-break-is-not-greenfield, the reference
shape is evidence-bearing; departure requires explicit justification at
characterization time, not buried in plan payload. Likely correct shape:
1 primary artifact (review.md) possibly with 1 engine-computed supporting
artifact (verification outputs). Plan must collapse the model.

### HIGH 3. REVIEW-I1 unenforceable as drafted
**Source:** Codex verbatim summary. **Severity:** HIGH.

REVIEW-I1 text ("verdict step MUST NOT be authored by the same adapter
instance that produced any review.report") requires the verdict step to
have an **adapter identity**. Runtime dispatch (`src/runtime/runner.ts:503`)
executes only `step.kind === 'dispatch'` steps through the adapter
registry; orchestrator `close` steps (which is how the verdict step is
planned) never touch adapter identity. REVIEW-I1 is slice-local-
unenforceable without a substrate-widening ADR. Plan must rewrite
REVIEW-I1 to: "audit step is worker-dispatch with `role=reviewer`;
verdict step is orchestrator-authored algorithmic aggregation" — a
shape that's actually enforceable at current runtime surface.

### HIGH 4. Verdict determinism incomplete
**Source:** Codex verbatim summary. **Severity:** HIGH.

Plan's verdict rule: "CLEAN iff Critical=0 AND High=0". Missing clause:
"AND verification commands all pass". Reference Circuit's verdict rule
includes the verification-passes gate — if verification fails, verdict is
not CLEAN regardless of finding counts. Plan's verdict rule is incomplete
and would emit CLEAN verdicts on runs where verification commands fail
silently.

### HIGH 5. Verification runtime not implemented
**Source:** Codex verbatim summary. **Severity:** HIGH.

Plan's VerificationRerun step assumes the runtime can execute verification
commands as subprocesses and capture stdout/stderr/exit codes. Current
`synthesis` step kind in `src/runtime/runner.ts` writes placeholder JSON
and does NOT execute subprocesses. Plan cannot land without either (a) a
new step kind `verification-exec` landing first, or (b) an ADR widening
`synthesis` step semantics. Plan as drafted assumes runtime capability
that doesn't exist.

### HIGH 6. Markdown artifact materialization unsafe
**Source:** Codex verbatim summary. **Severity:** HIGH.

Plan's `review.report` is Markdown-shaped (model-authored adversarial
audit text with structured finding blocks). Dispatch step emits JSON
through a registered schema (`src/schemas/`); there is no current
materialization path for Markdown artifacts authored by dispatch. Plan
must either (a) land a Markdown-artifact-materialization ADR + schema
widening first, or (b) restructure review.report as JSON with Markdown
substring fields. As drafted, plan would fail at dispatch schema parse.

## MED findings — should fix but not signoff-blocking

### MED 7. Stale audit.mjs target
**Source:** Codex verbatim summary. **Severity:** MED.

Plan cites `scripts/audit.mjs::WORKFLOW_KIND_CANONICAL_SETS` as the
kind-map extension surface. That constant **moved** to
`scripts/policy/workflow-kind-policy.mjs` (shared with runtime per Slice
54 convergence). Plan's stale citation would route the edit to the wrong
file. Trivial mechanical fix but evidence of stale-state authorship.

### MED 8. CLI shape mismatch
**Source:** Codex verbatim summary. **Severity:** MED.

Plan's `/circuit:review` command body invokes
`npm run circuit:run -- review --scope '<safely-single-quoted-scope>'`.
Current CLI at `src/cli/dogfood.ts:13-48` uses positional workflow
argument + `--goal` flag, not `--scope`. Plan's CLI surface is invention,
not current reality. Plan must either match actual CLI shape OR land a
CLI-widening slice first.

### MED 9. `/circuit:run` heuristic rejected as bug farm
**Source:** Codex verbatim summary. **Severity:** MED (downgraded from HIGH
per operator pre-agreement on fallback).

Plan's Slice 61 `/circuit:run` routing heuristic ("if goal starts with
review verb OR names scope files, route to review; else explore") is
rejected as a bug farm — verb-match on natural-language input has no
confidence guarantee and will route wrong under normal operator usage.
Acceptable fallback (pre-agreed with operator): `/circuit:run` remains
pass-through to `/circuit:explore`; operators type `/circuit:review`
directly until P2.8 lands a real classifier. Plan must remove the
heuristic and note the fallback.

### MED 10. Check 23 rule-g premise stale
**Source:** Codex verbatim summary. **Severity:** MED.

Plan's Slice 61 frames Check 23 rule-g as "generalize from 2-command
hardcoded to N-command data-driven". Actual rule at `scripts/audit.mjs:
2680-2686` is already N-command data-driven (iterates over manifest
command loop). Plan's "generalization" is fictional work — the
generalization happened at Slice 52. Plan must either drop this item or
reframe as "extend Check 23 to assert `/circuit:review` specifically"
(a different rule, not a generalization).

### MED 11. Target=review accepted conditionally with claim downgrade
**Source:** Codex verbatim summary. **Severity:** MED.

Plan frames the arc as "does the explore-pattern generalize". Codex
points out `review` is the closest structural twin to `explore` (both
investigation-shaped, both 4-5 phase, both emit a primary text artifact).
A successful P2.9 arc proves "review-family generalization" (explore +
review), not "workflow system generalization" (explore + review + repair
+ build + sweep + migrate). Claim must downgrade — target=review is fine
but the acceptance evidence description overclaims generalization power.

### MED 12. Parent-plan conditional collapsed without census
**Source:** Claude retrospective + Codex meta pass. **Severity:** MED.

Parent plan `specs/plans/phase-2-implementation.md §P2.9` says "likely
`review` ... unless Phase 2 evidence points elsewhere. Target reselection
occurs at P2.9 framing time." Plan draft collapsed to `target: review`
without the "what Phase 2 evidence now says" census. Plan must either
(a) add the evidence census showing target reselection produced `review`
as the winner, or (b) acknowledge target selection is inherited unchanged
from parent plan.

### MED 13. Plan authorship outran extraction
**Source:** Codex meta-retrospective. **Severity:** MED (meta-finding).

Plan invented artifact ids + REVIEW-I1 + 4-phase shape + CLI `--scope`
shape before characterization evidence landed at
`specs/reference/legacy-circuit/review-characterization.md`. ADR-0003
blocks contract authorship before characterization; plan payload
inherits the same prohibition. This is the root-cause failure mode the
planning-readiness-meta-arc is being authored to durably close.

## Minimum fold-ins required (Codex enumeration)

1. Canonical phase mapping (HIGH 1) — title→canonical map + spine_policy
   explicit, OR amend canonical set via separate ADR.
2. Artifact model (HIGH 2) — collapse to match reference surface; 1-2
   artifacts, not 4.
3. REVIEW-I1 (HIGH 3) — rewrite to enforceable form.
4. Verdict determinism (HIGH 4) — add verification-passes clause.
5. Runtime widening (HIGH 5 + HIGH 6) — add pre-P2.9 infrastructure arc
   OR restructure artifact shapes to fit current runtime.
6. `/circuit:run` heuristic (MED 9) — remove, use pass-through fallback.

## Disposition notes

- **Operator-direction decision:** whether to accept fold-ins and rewrite
  (A), pivot target to avoid runtime-widening requirement (B), or ask
  Codex clarifying questions (C). As of planning-readiness-meta-arc
  authoring, decision is deferred — P2.9 is paused until the planning-
  readiness-meta-arc lands the discipline that would have caught these
  failures pre-authorship.
- **Reflexive use:** this file is the denominator for the planning-
  readiness-meta-arc Slice 60 retroactive plan-lint run. Severity-aware
  threshold: plan-lint must catch 100% of HIGH findings (HIGH 1-6) and
  ≥70% of combined HIGH+MED findings (≥10/13). If threshold not met,
  rule set extends before arc close.
