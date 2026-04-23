---
name: arc-slice-52-codex
description: Cross-model challenger pass over Slice 52 (Clean-Clone Reality Gate — Clean-Clone Reality Tranche opener). Per-slice review per CLAUDE.md §Hard invariants #6 — ratchet change (contract-test binding pin rebound + ADR-0007 CC#P2-4 close-state ledger row advance). Returns OBJECTION LIST per CHALLENGER-I1. Satisfies scripts/audit.mjs Check 35 (checkCodexChallengerRequiredDeclaration) for the Slice 52 commit.
type: review
reviewer_model: gpt-5.4
reviewer_model_id: gpt-5-codex
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-22
verdict: ACCEPT-WITH-FOLD-INS
authored_by: gpt-5-codex
review_target: slice-52-clean-clone-reality-gate
target_kind: arc
target: slice-52
target_version: "HEAD=10f44e7 (pre-commit staged diff) → <new-SHA-at-Slice-52-landing>"
arc_target: clean-clone-reality-tranche
arc_version: "opens at Slice 52 (this slice); closes at Slice 55 arc-close composition review"
opening_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  high: 0
  med: 8
  low: 0
  meta: 2
commands_run:
  - cat staged diff via git diff --cached --stat + per-file inspection
  - read scripts/clean-clone-smoke.sh (new file)
  - read tests/runner/continuity-lifecycle.test.ts (env-gate conversion)
  - read package.json (build + circuit:run swap)
  - read tests/runner/dogfood-smoke.test.ts:250-357 (test pin + rationale comment)
  - read tests/contracts/slice-27d-dogfood-run-0.test.ts:117-129 (regex widened)
  - read specs/adrs/ADR-0007-phase-2-close-criteria.md (CC#P2-4 ledger row)
  - read PROJECT_STATE.md:7 (Slice 52 entry)
  - read scripts/audit.mjs:4018-4120 (Check 35 logic)
  - read tests/runner/hook-engine-contract.test.ts:194-217 (env-gate precedent)
  - read tests/runner/session-hook-behavior.test.ts:56-84 (portable stub precedent)
  - read .gitignore (specifically lines 20-21 for .circuit/ handling)
  - read .claude/hooks/SessionStart.sh / SessionEnd.sh / auto-handoff-guard.sh (live hook surface)
  - read src/runtime/policy/workflow-kind-policy.ts (scripts/ import leak check)
  - grep `.circuit/bin/circuit-engine` across tests/ src/ .claude/hooks/ .claude-plugin/ scripts/
  - git worktree add reproduction in Codex's own sandbox (failed — operation not permitted)
  - git clone --no-local --no-hardlinks reproduction in Codex's own sandbox (succeeded)
opened_scope:
  - scripts/clean-clone-smoke.sh (new tracked operator-facing smoke script)
  - tests/runner/continuity-lifecycle.test.ts (env-gate conversion surface)
  - package.json (build + verify chain + circuit:run binding swap)
  - tests/runner/dogfood-smoke.test.ts (test pin + rationale comment)
  - tests/contracts/slice-27d-dogfood-run-0.test.ts (regex widened)
  - specs/adrs/ADR-0007-phase-2-close-criteria.md (CC#P2-4 ledger row advance)
  - PROJECT_STATE.md + README.md + TIER.md (current_slice + Slice 52 narrative)
  - specs/plans/clean-clone-reality-tranche.md §Slice 52 (authoritative plan)
  - tests/runner/hook-engine-contract.test.ts (env-gate pattern precedent)
  - tests/runner/session-hook-behavior.test.ts (portable stub precedent)
  - .gitignore (for `.circuit/` wording precision)
  - .claude/hooks/SessionStart.sh + SessionEnd.sh + auto-handoff-guard.sh (for ADR-0007 ledger-row claim scope)
  - src/runtime/policy/workflow-kind-policy.ts (for dist self-containment check)
  - scripts/audit.mjs Check 35 logic
skipped_scope:
  - bootstrap/** (Phase 0 evidence loop, frozen)
  - prior-gen circuit at ~/Code/circuit (read-only reference per CLAUDE.md)
  - src/** runtime code outside the one import-reach check (Slice 52 did not modify runtime)
  - specs/contracts/** (Slice 52 did not modify contracts)
authority:
  - CLAUDE.md §Cross-model challenger protocol (objection list, not approval)
  - CLAUDE.md §Hard invariants #6 (challenger required for ratchet changes)
  - scripts/audit.mjs:4018-4120 Check 35 (checkCodexChallengerRequiredDeclaration — this file's existence is the evidence path)
  - specs/plans/clean-clone-reality-tranche.md §Slice 52 (plan being reviewed against)
  - tests/contracts/cross-model-challenger.test.ts §CHALLENGER-I3 (review-record frontmatter schema this file satisfies)
---

# Cross-model challenger review — Slice 52

**Verdict (opening):** ACCEPT-WITH-FOLD-INS
**Verdict (closing):** ACCEPT-WITH-FOLD-INS *(after this slice's fold-in commit)*

Codex (`codex-cli 0.118.0`, gpt-5-codex) ran against the staged Slice
52 diff and the authoritative plan at `specs/plans/clean-clone-reality-
tranche.md §Slice 52`. The prompt asked for an objection list, not
approval. Ten objections returned, numbered below with author
dispositions. Severity: 8 MED + 2 META (no HIGH). Slice 52's central
claim — clean-clone portability for the `verify + audit + circuit:run
--help` baseline — survives the objection list; the folded-in fixes
tighten honesty, precision, and robustness without changing the slice's
shape.

## MED

### MED 1 — `.circuit/` vs `.circuit/bin/circuit-engine` wording (prose precision)

**Finding:** `scripts/clean-clone-smoke.sh` and `PROJECT_STATE.md`
claim the clean-clone checkout makes `.circuit/` absent by
construction. `.gitignore:20` ignores `.circuit/`, but `.gitignore:21`
unignores `.circuit/circuit-runs/phase-1-step-contract-authorship/`
as historical audit trail; `git ls-files .circuit` returns tracked
files.

**Evidence:** `.gitignore:20-21`; `scripts/clean-clone-smoke.sh` (pre-
fold-in) header comment; `PROJECT_STATE.md:7` Slice 52 entry (pre-
fold-in). The smoke script only verifies `.circuit/bin/circuit-engine`
is absent.

**Impact:** Prose overclaims. The actually-verified invariant is "no
live-engine shim," not "no `.circuit/` tree."

**Remediation:** Reword every claim to "`.circuit/bin/circuit-engine`
shim absent."

**Disposition:** Incorporated. Smoke script header + inline invariant-
check comment, PROJECT_STATE Slice 52 entry, ADR-0007 ledger row
updated.

### MED 2 — `git worktree add` is not a clean clone + fails in constrained envs

**Finding:** The smoke script uses `git worktree add`, which writes
into the source repo's `.git/worktrees`. Codex reproduced the same
worktree creation in its own sandbox and it failed with `Operation
not permitted` creating `.git/worktrees/...`, so the smoke can trip a
constrained-filesystem failure while trying to prove constrained-
filesystem portability. It also shares Git config/refs/reflogs with
the source repo, so it is not quite a clean clone.

**Evidence:** `scripts/clean-clone-smoke.sh` (pre-fold-in) line 49;
Codex sandbox reproduction. A local `git clone --no-local --no-
hardlinks` succeeded where `git worktree add` failed.

**Impact:** The smoke's portability proof can be falsified by the same
class of environmental constraint it is meant to catch.

**Remediation:** Switch to `git clone --no-local --no-hardlinks
"$REPO_ROOT" "$SMOKE_DIR/repo"`.

**Disposition:** Incorporated. Smoke script now uses `git clone --no-
local --no-hardlinks --quiet` into `$SMOKE_DIR/repo`. Cleanup
simplified (no worktree-list check — straight `rm -rf $SMOKE_DIR`).

### MED 3 — `env -i PATH HOME` overclaims the env scrub

**Finding:** Preserving `HOME` lets npm read operator `~/.npmrc` and
use the operator npm cache, and `npm run` re-injects npm
lifecycle/config variables into child processes.

**Evidence:** `scripts/clean-clone-smoke.sh` (pre-fold-in) line 61;
npm docs on `NPM_CONFIG_USERCONFIG` + `NPM_CONFIG_CACHE` resolution.

**Impact:** The smoke can pass because of user-local npm config/cache,
while the prose says "no operator env vars/state."

**Remediation:** Isolate HOME + pin `NPM_CONFIG_USERCONFIG=/dev/null`
+ pin `NPM_CONFIG_CACHE="$SMOKE_DIR/npm-cache"`.

**Disposition:** Incorporated. Smoke `smoke_run()` helper now sets
`HOME="$SMOKE_DIR/home"`, `NPM_CONFIG_USERCONFIG=/dev/null`,
`NPM_CONFIG_CACHE="$SMOKE_DIR/npm-cache"`. Prose narrowed to "operator
env stripped; HOME + npm config + npm cache isolated to $SMOKE_DIR;
PATH preserved so node/npm are locatable."

### MED 4 — Acceptance-evidence prose overclaims smoke run

**Finding:** PROJECT_STATE records `bash scripts/clean-clone-smoke.sh`
as already green end-to-end, but the prompt said the script had not
yet been run against the Slice 52 commit. The script checks out
committed HEAD, not the staged tree, so a pre-commit run tests the
prior slice's tree.

**Evidence:** PROJECT_STATE.md:7 (pre-fold-in) acceptance evidence
paragraph; `scripts/clean-clone-smoke.sh:49` (pre-fold-in) `git
worktree add --detach HEAD`.

**Impact:** Commit body would contain acceptance evidence that was
not actually produced for the committed tree.

**Remediation:** Reword to acknowledge authored + exercised during
slice execution against the operator-local repo state; post-commit
smoke against the final Slice 52 SHA is the operator-owned next step;
further issues land as a follow-up slice, not an amend.

**Disposition:** Incorporated. PROJECT_STATE acceptance evidence
paragraph updated. The post-commit smoke is explicitly flagged as
the next operator-owned step.

### MED 5 — ADR-0007 ledger row overclaims "closed"

**Finding:** The row says "Clean-clone portability closed," but the
hook surface still no-ops without the untracked shim
(`SessionStart.sh:41`, `SessionEnd.sh:46`,
`auto-handoff-guard.sh:43`). "Closed" reads as "live session
continuity works in a clean clone"; it does not.

**Evidence:** `specs/adrs/ADR-0007-phase-2-close-criteria.md:366`
(pre-fold-in); `.claude/hooks/SessionStart.sh:41`;
`.claude/hooks/SessionEnd.sh:46`;
`.claude/hooks/auto-handoff-guard.sh:43`.

**Impact:** Ledger row overclaims scope. Future readers can mistake
the row for a live-hook-engine-closed claim.

**Remediation:** Narrow the row title + body to explicitly scope
"closed" to `verify + audit + circuit:run --help`, and note that the
hook scripts silently bail without the shim (existing Slice 47d
posture — no regression, no advance).

**Disposition:** Incorporated. Ledger row retitled "Clean-clone
portability closed for default verify + audit + CLI baseline"; body
explicitly names the hook bail behavior and the operator path to
live hook engine coverage.

### MED 6 — Check 35 requires a per-slice review file OR `arc-subsumption:`

**Finding:** The staged tree has no `specs/reviews/arc-slice-52-
codex.md`. Check 35 at `scripts/audit.mjs:4018-4120` looks for exact
`Codex challenger: REQUIRED` in the HEAD commit body and then requires
either the per-slice review file OR an `arc-subsumption:` field
pointing at an existing arc-close review. If the commit body uses the
exact required declaration without one of those paths, post-commit
audit goes red.

**Evidence:** `scripts/audit.mjs:4018-4120` (Check 35 logic);
`CODEX_CHALLENGER_REQUIRED_DECLARATION_PATTERN = /^Codex challenger:\s*REQUIRED\b/im`;
`git diff --cached --name-only` (before this review file landed)
confirms no review file was staged.

**Impact:** Post-commit audit goes red unless the commit body carries
an explicit path to either a per-slice review file or an arc-
subsumption target.

**Remediation:** Add `specs/reviews/arc-slice-52-codex.md` with the
objection list + dispositions; stage it with the commit.

**Disposition:** RESOLVED by this file's existence. The per-slice
path (`specs/reviews/arc-slice-52-codex.md`) is satisfied once this
file is tracked in the commit. The Slice 52 commit body carries the
exact literal `Codex challenger: REQUIRED`; Check 35 finds this file
and accepts.

### MED 7 — Dist is not self-contained (scripts/ import leak)

**Finding:** `src/runtime/policy/workflow-kind-policy.ts:1` imports
`../../../scripts/policy/workflow-kind-policy.mjs`, while
`tsconfig.build.json:11` only includes `src/**/*.ts`.
`dist/runtime/policy/workflow-kind-policy.js` depends on a repo-root
`scripts/` sibling at runtime. Clean worktree/clone has that file so
the smoke passes; a dist-only execution/package copy fails.

**Evidence:** `src/runtime/policy/workflow-kind-policy.ts:1`;
`tsconfig.build.json:11`; relative-import resolution semantics in
Node ESM.

**Impact:** Future packaging / distribution of `dist/` alone would
fail at runtime because the sibling module is absent. Slice 52's
`clean clone reproduces the baseline` criterion is unaffected (the
clone includes `scripts/`), but the broader portability claim has a
soft edge.

**Remediation:** Either move `scripts/policy/workflow-kind-policy.mjs`
under `src/` so the build includes it, or add an explicit packaging
step that copies the sibling module, or narrow the portability claim
to "repo-root-rooted invocation" (which is what `circuit:run` is
today).

**Disposition:** DEFER-WITH-NAMED-TRIGGER to Slice 55 arc-close
disposition ledger. Slice 52's acceptance criterion is "clean clone
reproduces `verify + audit + circuit:run --help` green" — the clone
includes `scripts/` so the criterion is satisfied. Named trigger for
reopening: next capability slice that packages `dist/` for distribution
(plugin-surface slice shipping compiled JS, or any vendor-copy
target). At that slice, pick one of the three remediations above.
Recorded in Slice 55 ledger as a dist-portability finding.

### MED 8 — Build-every-invocation + concurrent-invocation race

**Finding:** `circuit:run` now runs `tsc` on every invocation. The
smoke does `verify` → `audit` (which would run verify again if audit
invoked it, though it doesn't) → `circuit:run`, so the build work
repeats. Concurrent `npm run circuit:run` invocations write the same
`dist/` without a lock.

**Evidence:** `package.json:21` `circuit:run = npm run build --silent
&& node dist/cli/dogfood.js`; no file-lock primitive; no mtime
freshness guard.

**Impact:** Sluggishness on repeated `circuit:run` invocations; in
theory, corrupt dist/ on concurrent invocations. Non-blocking for a
Tier 0 dev CLI.

**Remediation:** mtime freshness guard (skip build if dist/ newer than
src/), OR a file lock, OR a `circuit:run:dev` binding that skips the
build for fast iteration.

**Disposition:** DEFER-WITH-NAMED-TRIGGER to Slice 55 arc-close
disposition ledger. Plan §Slice 52 explicitly contemplated this
binding shape as the simplest working option; the plan did not scope
an mtime guard or lock into Slice 52. Named trigger for reopening:
first operator/user complaint about `circuit:run` latency OR the
first confirmed `dist/` corruption from concurrent invocation. At
that point, pick one of the three remediations above. Recorded in
Slice 55 ledger as a circuit:run-ergonomics finding.

## META

### META 1 — `continuity-lifecycle.test.ts` opening comment drift

**Finding:** The file's opening comment at line 7 still says "With
this test green, ADR-0007 CC#P2-4 ... advances to active — satisfied,"
but the file now skips the entire suite by default under
`describe.skipIf(!liveGateEnabled)`. Future readers can mistake default
`verify` green for live-engine lifecycle enforcement.

**Evidence:** `tests/runner/continuity-lifecycle.test.ts:7` (pre-fold-
in); `tests/runner/continuity-lifecycle.test.ts:163` (post-fold-in
`describe.skipIf`).

**Impact:** Documentation drift. No correctness impact; readability
impact on future reviewers.

**Remediation:** Scope the "active — satisfied" phrasing to the Slice
46b historical close-state claim, and state that post-Slice-52 the 12
integration assertions are opt-in under `CIRCUIT_HOOK_ENGINE_LIVE=1`.

**Disposition:** Incorporated. Opening comment updated accordingly.
No env-read race exists; `liveGateEnabled` is resolved at module-load
time before `describe.skipIf` (Codex verified by reading source).

### META 2 — Smoke script mutates caller shell when sourced

**Finding:** The smoke script installs an EXIT trap and `cd`s into
the smoke directory. Sourcing it mutates the caller shell and leaves
cleanup attached to the caller's exit.

**Evidence:** `scripts/clean-clone-smoke.sh:46` (pre-fold-in EXIT
trap); line 51 (pre-fold-in `cd`).

**Impact:** Low — operational footgun only. Non-critical for Slice 52.

**Remediation:** Add a top-of-file sourcing guard using
`${BASH_SOURCE[0]} == $0`; wrap the body in `main "$@"`.

**Disposition:** Incorporated. Sourcing guard added; body wrapped
in `main "$@"`.

## Pre-existing findings surfaced (not Slice 52 scope)

Codex also flagged `.claude/hooks/auto-handoff-guard.sh:35` as
hardcoding `/Users/petepetrash/Code/circuit-next`. Codex was running in
a lowercase-c variant of the path, so the hardcoded path did not match
for Codex's invocation. macOS's default case-insensitive filesystem
makes this a non-issue for this operator, but it is a portability smell
in the hook script. Not Slice 52 scope (the hardcode pre-dates Slice
52). Added to Slice 55 disposition ledger as a separate finding.

## Closing

**Verdict:** ACCEPT-WITH-FOLD-INS. Must-fix objections (MED 1, 2, 3,
4, 5, 6, META 1, META 2) folded into the Slice 52 commit before
landing. Defer-with-named-trigger objections (MED 7, 8) bound to
Slice 55 arc-close ledger. The commit body carries the exact literal
`Codex challenger: REQUIRED` required by audit Check 35; this file is
the per-slice evidence path that check binds to.
