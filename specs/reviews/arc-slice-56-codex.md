---
name: arc-slice-56-codex
description: Cross-model challenger pass over Slice 56 (P2.11 plugin-CLI wiring; closes CC#P2-3 at CLI-surrogate parity). Per-slice review per CLAUDE.md §Hard invariants #6 — ratchet-advance + privileged runtime surface (plugin command binding). Returns OBJECTION LIST per CHALLENGER-I1. Satisfies scripts/audit.mjs Check 35 (checkCodexChallengerRequiredDeclaration) for the Slice 56 commit.
type: review
reviewer_model: gpt-5.4
reviewer_model_id: gpt-5-codex
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-23
verdict: ACCEPT-WITH-FOLD-INS
authored_by: gpt-5-codex
review_target: slice-56-p2-11-plugin-wiring
target_kind: arc
target: slice-56
target_version: "HEAD=863ef620c04ba7a248c75997a95615c659ebf532 (Slice 55 arc-close) → <new-SHA-at-Slice-56-landing>"
arc_target: p2-11-plugin-wiring
arc_version: "single-slice arc opener post-Clean-Clone-Reality-Tranche; no arc-close composition review required per CLAUDE.md §Cross-slice composition review cadence (arc must span ≥3 slices)"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  high: 2
  med: 3
  low: 2
  meta: 1
commands_run:
  - read staged diff via `git diff --cached` (pre-fold-in pass)
  - read .claude-plugin/commands/circuit-explore.md (rewritten body)
  - read .claude-plugin/commands/circuit-run.md (rewritten body)
  - read .claude-plugin/plugin.json (description rewrite)
  - read scripts/audit.mjs §checkPluginCommandClosure (Check 23 rule-g extension)
  - read tests/runner/plugin-command-invocation.test.ts (new test file)
  - read tests/contracts/plugin-surface.test.ts (+2 tests for rule-g)
  - read specs/plans/p2-11-plugin-wiring.md (single-slice plan)
  - read specs/reviews/p2-11-invoke-evidence.md (invoke evidence)
  - read Claude Code docs on $ARGUMENTS + slash-command substitution (external)
  - ran targeted Vitest cluster — plugin-command-invocation + plugin-surface — 34 tests green
  - ran git diff --cached --check — clean
opened_scope:
  - .claude-plugin/commands/circuit-explore.md (body rewrite — placeholder removed; CLI invocation instructions; $ARGUMENTS substitution pattern; goal surfacing rules)
  - .claude-plugin/commands/circuit-run.md (body rewrite — route-to-explore pass-through; $ARGUMENTS substitution pattern)
  - .claude-plugin/plugin.json (description rewrite — version bump + wired-state phrasing)
  - scripts/audit.mjs (Check 23 rule-g extension — literal "Not implemented yet" regression guard)
  - tests/runner/plugin-command-invocation.test.ts (new file — runtime-binding assertions)
  - tests/contracts/plugin-surface.test.ts (+2 tests for rule-g red + green positive control)
  - specs/plans/p2-11-plugin-wiring.md (single-slice plan with scope + framing + trajectory check + Codex-REQUIRED marker)
  - specs/reviews/p2-11-invoke-evidence.md (live invocation transcript; 30 events; outcome=complete; sha256 fingerprints of 9 run artifacts; CC#P2-3 state transition disclosure)
skipped_scope:
  - bootstrap/** (Phase 0 evidence loop, frozen)
  - prior-gen circuit at ~/Code/circuit (read-only reference per CLAUDE.md)
  - src/runtime/** (this slice does not modify runtime source; the CLI path at src/cli/dogfood.ts is unchanged; adapters unchanged; the wiring is at the plugin-command-body layer only)
  - tests/properties/** (Tier 2+ deferred per CLAUDE.md hard invariants)
  - tests/runner/continuity-lifecycle.test.ts (env-gated to CIRCUIT_HOOK_ENGINE_LIVE=1 per Slice 52; Slice 56 unrelated to that surface)
  - AGENT_SMOKE + CODEX_SMOKE fingerprint fixtures (Slice 56 did not touch adapter source files — the two yellows carrying over from Slice 55 do not compound at this slice)
---

# Slice 56 — P2.11 plugin-CLI wiring — Cross-Model Challenger Pass

## Scope

Staged diff for the single-slice arc opener that closes ADR-0007 CC#P2-3
(plugin command registration). The slice rewrites the two plugin slash-command
bodies (`/circuit:explore`, `/circuit:run`) to actually invoke the CLI at
`src/cli/dogfood.ts` via the Bash tool instead of returning "Not implemented
yet" placeholder text. Four project-holistic ledger entries bundle to this
slice ([3] plugin-as-advertised, [6] manifest description divergence,
[25] pre-ADR-0009 adapter architecture in command body, [31] both command
bodies are placeholder). Baseline pre-slice audit 32 green / 2 yellow / 0 red;
verify 1125 passed / 19 skipped. Staged diff adds 8 tests (6 plugin-command-
invocation + 2 plugin-surface rule-g) for a post-slice verify of 1133 / 19.

## Opening verdict

**REJECT-PENDING-FOLD-INS** — Two blockers hit the actual claim: "a
plugin-user invocation in Claude Code runs the workflow end-to-end." The
staged evidence proves the CLI path works; it does not yet prove the plugin
invocation path is safe or actually exercised.

## Verbatim objection list (from the Codex pass)

### HIGH 1 — Invoke evidence overclaims slash-command proof

`specs/reviews/p2-11-invoke-evidence.md:12` says the file "satisfies"
CC#P2-3, and lines 138-143 claim "Plugin-command-body → CLI wiring is
functional." But the recorded command at lines 50-52 is a direct
`npm run circuit:run ...`, not `/circuit:explore ...` inside Claude Code.
That bypasses plugin loading, `$ARGUMENTS` substitution, Bash-tool
selection, and permission behavior.

**MUST land before commit:** either add an actual Claude Code
`/circuit:explore <goal>` invocation transcript, or downgrade the
file/state transition language to "direct CLI surrogate proven;
slash-command handler path still unproven." If CC#P2-3 requires
plugin-user invocation, the former is the right fix.

### HIGH 2 — The `$ARGUMENTS` Bash example is unsafe for arbitrary goals

`.claude-plugin/commands/circuit-explore.md:22` and
`.claude-plugin/commands/circuit-run.md:20` tell Claude to run:

```bash
npm run circuit:run -- explore --goal "$ARGUMENTS"
```

Claude Code docs say `$ARGUMENTS` expands to the full argument string as
typed. If a goal contains `"`, backticks, `$()`, `$VAR`, backslashes, or
newlines, the rendered shell can change argv or execute substitutions if
Claude copies the example. Double quotes prevent word splitting, not
shell expansion or quote break-out.

**MUST land before commit:** replace the example with a safe construction
rule — do not paste the raw goal into shell source; shell-escape it as one
single-quoted argv token, escaping embedded `'`, or pass it via a
non-shell-interpreted temporary file path. Add a regression test that
rejects the literal `--goal "$ARGUMENTS"` pattern and covers a pathological
goal shape in prose or fixture.

### MED 1 — Runtime-binding tests are too weak for the ratchet they claim

`tests/runner/plugin-command-invocation.test.ts:46` only checks that
`npm run circuit:run` or `node dist/cli/dogfood.js` appears somewhere,
and lines 67-75 let `circuit-run.md` pass with only a `P2.8` mention.
A body saying "Do not run `npm run circuit:run`; P2.8 later" could pass.

**Change:** extract fenced `bash` blocks or command-instruction sections
and assert both commands contain an executable explore invocation with
`--goal`; add negative fixtures for "mentioned only in prose" and
"P2.8 pointer only."

### MED 2 — Manifest description still opens with unlanded router behavior

`.claude-plugin/plugin.json:10` and `.claude-plugin/commands/circuit-run.md:3`
start with "Classify a task and dispatch..." before walking it back. That
front-loaded phrase is what `/help` and model context are likely to
surface first.

**Change:** lead with the wired truth: "Routes every task to `explore` in
this phase; full classification lands at P2.8."

### MED 3 — The command summary points users at `result.json`, not the explore output

`.claude-plugin/commands/circuit-explore.md:35` says `result_path` is the
artifact "the user can read to see the workflow output," but the CLI
returns `artifacts/result.json` at `src/cli/dogfood.ts:199`. The actual
close-step output is `artifacts/explore-result.json`, documented in the
evidence at lines 78-84.

**Change:** have the command surface both `result_path` and
`${run_root}/artifacts/explore-result.json`, with the placeholder-parity
caveat.

### LOW 1 — Check 23 rule (g) overstates its regression coverage

`scripts/audit.mjs:2476` says the rule prevents placeholder regression,
but line 2676 only rejects exact-case `Not implemented yet`.
"Not implemented," "not implemented yet," HTML-commented placeholders,
or Unicode lookalikes pass. Either narrow the comment to "exact old
placeholder only" or broaden the test with intentionally chosen variants.

### LOW 2 — Superseded-plan citation says "verbatim" when it is not

`specs/plans/p2-11-plugin-wiring.md:20` says the superseded Slice 52
scope body is "carried forward here verbatim," but lines 14-18 explicitly
say the numbering and wiring path were corrected.

**Change:** to "carried forward and revised here."

### META — Hard invariants compliance

No staged evidence of `--no-verify`, `--no-gpg-sign`, skip-hooks usage.
`CLAUDE.md` is 256 lines, so invariant #10 is still fine. No new
AGENT_SMOKE/CODEX_SMOKE compounding from this staged diff because adapter
source files were not touched. Targeted new/adjacent tests
(`tests/runner/plugin-command-invocation.test.ts`,
`tests/contracts/plugin-surface.test.ts`) both pass, 34 tests total.
`git diff --staged --check` clean. Full `npm run verify` not rerun by
Codex.

External check used: Claude Code docs on `$ARGUMENTS`, slash-command
substitutions, and `allowed-tools` —
https://code.claude.com/docs/en/slash-commands

## Fold-in disposition (post-Codex pass)

All 7 findings folded in pre-commit (2 HIGH + 3 MED + 2 LOW). No
defer-with-named-trigger items — the scope is small enough that every
finding has a drop-in fix.

### HIGH 1 fold-in — invoke-evidence claim language downgrade

`specs/reviews/p2-11-invoke-evidence.md` frontmatter `cc_state_transition`:
"active — red → active — satisfied" → "active — red → active — satisfied
at CLI-surrogate parity". New `evidence_scope` frontmatter field discloses
that the slash-command handler path is NOT exercised by this evidence
file. Body carries a new "Scope honesty note (Codex HIGH 1 fold-in)"
section naming the four aspects the surrogate does NOT exercise
(slash-command handler, $ARGUMENTS substitution, Claude-as-interpreter
Bash construction, Bash tool permission/allowlist). "What this proves"
restructured into "Proves (at CLI-surrogate parity)" + "Does NOT prove
(explicitly out of scope)" with 3+2 enumerated items. Final state
transition paragraph relabels the post-Slice-56 state as
"active — satisfied at CLI-surrogate parity" and names the slash-command
handler surrogate gap as pending.

### HIGH 2 fold-in — safe-construction rule + regression test

Both command bodies (`circuit-explore.md`, `circuit-run.md`) rewritten:
- The unsafe `npm run circuit:run -- explore --goal "$ARGUMENTS"` example
  DELETED. It appeared nowhere in the rewritten bodies.
- Instructions now carry a multi-step safe-construction rule: wrap goal
  in single quotes; escape any embedded `'` as `'\''`; never use double
  quotes (those expand `$VAR`, `$()`, `` `cmd` ``, `\` sequences from
  user-controlled goal text — shell-injection vector).
- Concrete worked examples added for (a) a benign goal (no special
  characters) and (b) a goal containing an apostrophe (shows the
  `'\''` escape in-place).
- `$ARGUMENTS` appears only in a quoted "> **Goal:**" / "> **Task:**"
  markdown blockquote carrying the user's text into the prompt — NOT
  inside a bash code block.

New regression tests in `tests/runner/plugin-command-invocation.test.ts`
assert:
- Neither body contains the literal `--goal "$ARGUMENTS"` double-quoted
  splice.
- All fenced bash blocks in both bodies that contain an explore+--goal
  invocation use single-quoted `--goal` values (and do NOT use
  double-quoted ones).
- Both bodies document the POSIX `'\''` escape sequence so future authors
  don't hand-reinvent an unsafe shape.

### MED 1 fold-in — fenced-bash-block extraction + negative fixtures

`tests/runner/plugin-command-invocation.test.ts` restructured around an
`extractBashBlocks(body)` helper + a `hasExecutableExploreInvocation(body)`
predicate that returns true only when a fenced bash block contains both
(a) an explore invocation via `npm run circuit:run` OR `node dist/cli/
dogfood.js` AND (b) the `--goal` flag. Prose-only mentions, P2.8-pointer-
only bodies, and negated ("do not run …") prose return false. Negative
fixtures assert the predicate rejects each pathology; positive fixtures
assert it accepts minimal correct bodies (npm run path + compiled-JS
path). Total new-file test count: 14 (up from 6 at pre-fold-in).

### MED 2 fold-in — manifest description leads with wired truth

`.claude-plugin/plugin.json` top-level description + `circuit:run`
per-command description + `.claude-plugin/commands/circuit-run.md`
frontmatter description + body opening all rewritten to lead with
"Routes every task to `explore`…" before mentioning the eventual
classifier at P2.8. Test added at
`tests/runner/plugin-command-invocation.test.ts::manifest description
consistency::circuit:run description leads with routing behavior (MED 2
fold-in)` asserting that "Routes every task" appears before
"Classify a task" in the description string (or classify language is
absent entirely).

### MED 3 fold-in — surface both result_path and explore-result.json

`.claude-plugin/commands/circuit-explore.md §Instructions` step 4 now
lists FOUR surface items (up from THREE at pre-fold-in): `outcome`,
`run_root`, `result_path` (canonical RunResult), AND
`${run_root}/artifacts/explore-result.json` (close-step output) with the
ADR-0007 CC#P2-1 placeholder-parity caveat. The placeholder-parity
disclosure points the user at the artifact so they can confirm the
placeholder state; a future slice closing CC#P2-1 at orchestrator-parity
(P2.10) will make this artifact carry real content.

### LOW 1 fold-in — Check 23 rule-g docstring narrowed

`scripts/audit.mjs` rule-g docstring rewritten to explicitly disclose
that the rule rejects only the exact-case "Not implemented yet"
substring and that case-insensitive, Unicode-lookalike, and
HTML-commented variants intentionally pass. The complementary
positive-assertion side is named at `tests/runner/plugin-command-
invocation.test.ts`. Codex LOW 1 accepted as scope-appropriate — narrow
by design.

### LOW 2 fold-in — superseded-plan citation honesty

`specs/plans/p2-11-plugin-wiring.md` frontmatter authority list:
"carried forward here verbatim" → "carried forward and revised here;
numbering corrected 52 → 56, wiring path simplified to reflect the
actual compiled-JS CLI invocation, and Codex challenger fold-ins
— specs/reviews/arc-slice-56-codex.md HIGH 2 + MED 2 — added".

## Closing verdict

**ACCEPT-WITH-FOLD-INS** — all 7 findings folded in the same commit as
the original staged diff (no separate fold-in commit; single slice). The
commit body carries literal "Codex challenger: REQUIRED" +
"Codex challenger file: specs/reviews/arc-slice-56-codex.md" per audit
Check 35.
