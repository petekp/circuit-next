---
track: session-hygiene
status: ratified-v0.1
version: 0.1
last_updated: 2026-04-19
depends_on:
  - CLAUDE.md
  - PROJECT_STATE.md
  - scripts/audit.mjs
enforced_by:
  - scripts/audit.mjs (PROJECT_STATE freshness + phase consistency + framing triplet + lane declaration + citation rule + .circuit/ gitignore)
  - CLAUDE.md §Hard invariants #10 (CLAUDE.md ≤ 300 lines)
  - CLAUDE.md §Session hygiene (compaction disabled; slice ≤ 30 min)
planned_tests:
  - tests/contracts/session-hygiene.test.ts (LANDED v0.1 in Slice 14 — asserts CLAUDE.md wc -l ≤ 300; README/PROJECT_STATE phase alignment; .circuit/ ignored unless allowlisted). v0.2 Tier-2+ promotions owed per §Evolution.
---

# Session hygiene

circuit-next is being built inside a harness (existing Circuit) that is
itself a long-running multi-session project. The harness has already
shown the failure modes this track names: cache-line bloat making a
primary instruction file stop fitting in the model's context; silent
compaction collapsing load-bearing state; session drift where a later
turn contradicts an earlier decision without noticing. Every one of
those failures compounds into the next slice.

This track is the behavioral counterpart to ADR-0001 (methodology
adoption) and ADR-0002 (bootstrap discipline): the invariants are not
about schemas or contracts, they are about **how operators (human +
agent) drive the repo across session boundaries**.

## Invariants

- **SESSION-I1 — CLAUDE.md stays ≤ 300 lines.** Every line in CLAUDE.md
  enters the context of every session. Past 300 lines, the primary
  instruction file starts eating into cache budget the slice actually
  needs; worse, later revisions accumulate contradictions because
  nobody can hold the whole file in head at once. Longer content MUST
  go in `specs/` with a pointer from CLAUDE.md. Enforced today by
  manual discipline + the hard-invariant line in CLAUDE.md itself
  (line 10 of §Hard invariants). The planned test formalizes it.
  Failure mode: "why is this instruction being ignored" — answer is
  usually "it rolled out of the primary prompt budget."

- **SESSION-I2 — PROJECT_STATE.md is the live session-to-session
  snapshot.** When a slice closes, PROJECT_STATE.md is updated in the
  same commit. When a phase changes, PROJECT_STATE.md reflects it
  before the next session starts. The audit already checks freshness
  via `projectStateCurrent()` (warns if no update within recent
  disciplined commits) and phase agreement with README.md. Failure
  mode: a later session discovers the repo is two phases ahead of
  what PROJECT_STATE says, and acts on the stale mental model.

- **SESSION-I3 — Compaction is disabled on this repo.** Anthropic's
  automatic compaction collapses old messages into summaries when the
  context fills. Compaction is excellent for general chat; it is
  actively dangerous here because load-bearing state (decisions,
  invariants, failure-mode names, lane declarations) is precisely the
  material that gets "summarized away" first. Treat sessions as
  long-horizon; artifact-based resume (PROJECT_STATE + continuity
  record) is the recovery path, not compacted summary. Failure mode:
  a compacted session silently loses the "we decided X but haven't
  written it down yet" line, and the next turn proposes not-X.

- **SESSION-I4 — Slices are bounded to ≤ 30 minutes wall-clock.** Not
  a budget, a diagnostic. A slice that takes longer is almost always a
  slice that needed to be split into two. The discipline gives
  reversibility (each commit is a step you can undo without undoing
  three other unrelated things) and keeps the human-in-the-loop
  feedback cycle short enough that course-correction is cheap. When a
  commit body names a lane and framing triplet (`Failure mode:`,
  `Acceptance evidence:`, `Alternate framing:`) it implicitly
  certifies that the slice fit the bound. Enforced by the audit's
  framing triplet check. Failure mode: a multi-hour "slice" lands
  with coupled changes across four subsystems and nothing is
  individually revertable.

- **SESSION-I5 — Commits cite specs/, CLAUDE.md, bootstrap/, or an
  ADR.** ADR-0002 citation rule. Every disciplined commit has at
  least one path reference that anchors the change to a documented
  decision. This is enforcement against "because Circuit does X"
  reasoning — if the only justification for a change is an unnamed
  precedent or vibe, the commit fails the rule. The audit regex
  already covers this. Failure mode: a slice lands that looks
  reasonable but has no documented motivation, and the next slice
  depends on that motivation without realizing it was never committed.

- **SESSION-I6 — `.circuit/` run artifacts are gitignored except for
  the explicitly allowlisted historical trail.** ADR-0002's gitignore
  rule. The operator's Circuit harness writes per-run state into
  `.circuit/`; those artifacts are development-time scaffolding, not
  product. The one exception (`phase-1-step-contract-authorship/`) is
  preserved as a historical audit trail of the first Phase 1 slice.
  Audit fails on any new staged/untracked `.circuit/` path outside
  the allowlisted prefix. Failure mode: run-state bleeds into git
  history and becomes load-bearing state that the repo implicitly
  depends on.

## Failure modes addressed

- `session-drift:stale-project-state` — a session starts with an
  out-of-date PROJECT_STATE mental model and the first commit acts on
  wrong assumptions. Mitigated by SESSION-I2 + audit freshness check.
- `session-drift:compacted-summary-loses-decision` — compaction
  erases a load-bearing "we decided X" line. Mitigated by SESSION-I3
  (disabled) + SESSION-I2 (artifact-persisted state).
- `prompt-bloat:claude-md-overflow` — CLAUDE.md exceeds 300 lines and
  the primary instruction budget starts evicting tail lines silently.
  Mitigated by SESSION-I1 + future test.
- `slice-dilation:unbounded-coupled-changes` — a "slice" actually
  touches four subsystems and cannot be reverted individually.
  Mitigated by SESSION-I4 + framing triplet requirement.
- `circuit-as-justification` — a commit justifies its decision by
  citing unnamed existing Circuit behavior. Mitigated by SESSION-I5
  + ADR-0002 citation rule + audit smell check.
- `orchestration-artifact-bleed` — `.circuit/` run state lands in git
  and becomes implicit dependency. Mitigated by SESSION-I6 + audit
  gitignore check.

## Planned test location

`tests/contracts/session-hygiene.test.ts` (Phase 1 track; landed
Slice 14 — SESSION-I1..I6 pinned). Asserts:

- CLAUDE.md line count ≤ 300 (SESSION-I1).
- README.md and PROJECT_STATE.md agree on current phase (SESSION-I2;
  already covered by audit but the test gives local fast feedback).
- No `.circuit/` path is tracked in git outside the allowlisted
  prefix `.circuit/circuit-runs/phase-1-step-contract-authorship/`
  (SESSION-I6).

Slices 1–9 rely on `npm run audit` for all six invariants. Promoting
these to a contract-test file lands when Tier 2+ (container isolation)
starts — session hygiene becomes a hard precondition for shared-
container work, not a nice-to-have.

## Cross-references

- `CLAUDE.md` §Hard invariants #10 (CLAUDE.md ≤ 300 lines).
- `CLAUDE.md` §Session hygiene.
- `specs/adrs/ADR-0001-methodology-adoption.md` §Session hygiene
  protocol.
- `specs/adrs/ADR-0002-bootstrap-discipline.md` citation rule +
  gitignore rule.
- `specs/adrs/ADR-0003-authority-graph-gate.md` §Machine enforcement.
- `scripts/audit.mjs` — 8 of the 10 green checks this track relies on.

## Evolution

- **v0.1 (this draft)** — invariants SESSION-I1..I6 named; planned
  test location committed. No schema changes; behavioral tracks are
  prose contracts that bind to the audit + the hard-invariant list
  rather than to a zod schema.
- **v0.2** — land `tests/contracts/session-hygiene.test.ts` when
  Phase 1 test scaffolding admits a non-schema-parity contract test
  file. Reopen conditions: a real incident where the audit missed a
  hygiene violation because the check was framing-triplet-adjacent
  rather than load-bearing; OR Tier 2+ containerization promotes
  these invariants to hard gates.
