---
name: arc-slices-41-to-43-composition-review-codex
description: Cross-model challenger pass over the P2.4 + P2.5 adapter and end-to-end arc, focused on boundary seams across Slices 41/42/43a/43b/43c.
type: review
reviewer_model: gpt-5-codex
reviewer_model_id: gpt-5-codex
authorship_role: challenger
review_kind: composition-review
review_date: 2026-04-22
verdict: REJECT-PENDING-FOLD-INS -> incorporated -> ACCEPT-WITH-FOLD-INS
authored_by: gpt-5-codex
review_target: arc-slices-41-to-43-p2.4-p2.5-adapter-and-e2e-arc
target_kind: arc
target: p2.4-p2.5-adapter-and-e2e-arc
target_version: "HEAD=7bc3543 (post-Slice-43c)"
arc_target: phase-2-p2.4-p2.5-arc-slices-41-to-43
arc_version: "d482740..7bc3543"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  HIGH: 5
  MED: 5
  LOW: 3
  META: 3
commands_run:
  - sed -n '1,220p' /Users/petepetrash/Code/claude-code-setup/skills/exhaustive-systems-analysis/SKILL.md
  - pwd
  - git status --short
  - sed -n reads over specs/reviews/arc-slices-35-to-40-composition-review-codex.md, specs/reviews/arc-slices-41-to-43-composition-review-claude.md, specs/reviews/arc-slice-41-adapter-invocation-pattern-codex.md, specs/reviews/arc-slice-42-real-agent-adapter-codex.md
  - git log d482740..7bc3543 --oneline --decorate
  - git diff --name-only d482740..7bc3543
  - git show --stat --oneline b1dd9af 48bcab8 7bc3543
  - git show --name-only --oneline b1dd9af 48bcab8 7bc3543
  - rg -n <targeted composition review, P2.4/P2.5, Check 26/28/29/30, policy, golden, fingerprint, dry-run, explore-property patterns> <requested scope files>
  - nl -ba <requested scope files> | sed -n <targeted line ranges>
  - cat tests/fixtures/agent-smoke/last-run.json
  - cat tests/fixtures/golden/explore/result.sha256
  - rg --files specs/reviews | sort
  - npm run audit
  - npm run test -- tests/runner/dogfood-smoke.test.ts
  - npm run test -- tests/contracts/cross-model-challenger.test.ts
  - sed -n '1,220p' specs/reviews/arc-slices-41-to-43-composition-review-codex.md
  - sed -n '220,520p' specs/reviews/arc-slices-41-to-43-composition-review-codex.md
  - wc -l specs/reviews/arc-slices-41-to-43-composition-review-codex.md
  - rg -n <non-ASCII punctuation scan> specs/reviews/arc-slices-41-to-43-composition-review-codex.md
opened_scope:
  - specs/reviews/arc-slices-41-to-43-composition-review-claude.md
  - specs/reviews/arc-slices-35-to-40-composition-review-codex.md
  - specs/reviews/arc-slice-41-adapter-invocation-pattern-codex.md
  - specs/reviews/arc-slice-42-real-agent-adapter-codex.md
  - CLAUDE.md
  - PROJECT_STATE.md
  - README.md
  - specs/adrs/ADR-0007-phase-2-close-criteria.md
  - specs/adrs/ADR-0009-adapter-invocation-pattern.md
  - specs/contracts/adapter.md
  - specs/contracts/explore.md
  - specs/contracts/run.md
  - specs/plans/phase-2-implementation.md
  - specs/ratchet-floor.json
  - specs/invariants.json
  - specs/artifacts.json
  - .claude-plugin/skills/explore/circuit.json
  - scripts/audit.mjs
  - scripts/audit.d.mts
  - scripts/policy/workflow-kind-policy.mjs
  - scripts/policy/workflow-kind-policy.d.mts
  - src/cli/dogfood.ts
  - src/runtime/runner.ts
  - src/runtime/adapters/agent.ts
  - src/runtime/adapters/dispatch-materializer.ts
  - src/runtime/policy/workflow-kind-policy.ts
  - tests/contracts/workflow-kind-policy.test.ts
  - tests/contracts/slice-43c-agent-smoke-fingerprint.test.ts
  - tests/contracts/cross-model-challenger.test.ts
  - tests/contracts/adapter-binding-coverage.test.ts
  - tests/runner/dogfood-smoke.test.ts
  - tests/runner/agent-dispatch-roundtrip.test.ts
  - tests/runner/explore-e2e-parity.test.ts
  - tests/fixtures/agent-smoke/last-run.json
  - tests/fixtures/golden/explore/result.sha256
skipped_scope:
  - Full source tree outside the named arc files - searched by rg for dry-run, review, fingerprint, and explore-property patterns, but not opened end-to-end.
  - Full npm run verify - invoked indirectly by npm run audit; verify gate failed in this sandbox, and I did not continue with unrelated broad test triage.
  - AGENT_SMOKE=1 real subprocess rerun - not run; local auth/network/CLI side effects are intentionally opt-in, and the committed fingerprint/golden were inspected instead.
authority:
  - CLAUDE.md Cross-slice composition review cadence
  - CLAUDE.md Hard invariants #6
  - ADR-0007 Decision.1 CC#P2-1 and CC#P2-2
  - specs/plans/phase-2-implementation.md P2.4 / P2.5
  - specs/reviews/arc-slices-35-to-40-composition-review-codex.md
fold_in_disposition: HIGH #1, #3 are ceremony-governance fold-ins for the same commit that lands the two prongs and advances current_slice. HIGH #2, #4, #5 are claim/runtime-contract fold-ins that should land before P2.6 opens because they affect the meaning of "one-workflow parity", "dry-run", and P2.5 contract closure. MED items can fold into the same ceremony commit or the next micro-slice before another privileged runtime slice. LOW items are doc/test hygiene.
---

# Arc Slices 41-43 Composition Review - Codex Challenger Pass

## Scope

Fresh-read challenger pass over `d482740..7bc3543`, covering Slice 41
ADR-0009, Slice 42 real `agent` adapter, and P2.5 sub-slices 43a/43b/43c.
The target failure class is composition drift: seams that were not owned by
one slice, especially where runtime dispatch, audit gates, golden evidence,
and cross-model review discipline meet.

I did not trust the Claude prong. Three HIGH findings converge with it; two
HIGH findings below are independent: the CLI `--dry-run` flag now crosses the
real adapter, and P2.5 landed while `explore.md`'s own deferred-property
reopen trigger remains fired.

## Opening Verdict

**REJECT-PENDING-FOLD-INS.** The arc contains real progress: ADR-0009
resolved the invocation pattern, Slice 42 landed a substantive capability
boundary, 43a removed the old workflow-kind table duplication, 43b connected
the runner to a real dispatcher seam, and 43c runs `explore` through the
end-to-end path. But the aggregate overclaims what is now proven and leaves
three governance gates behind the arc it just closed.

## Closing Verdict

**ACCEPT-WITH-FOLD-INS.** The objections are fold-in sized and do not require
throwing away the implementation arc. They do require the ceremony commit (or
an immediate follow-up before P2.6) to state exactly what the current evidence
does and does not prove.

## HIGH Findings

### HIGH 1 - Slices 43a/43b/43c skipped per-slice Codex despite ratchet movement

**Evidence.** CLAUDE.md requires a cross-model challenger for any ratchet
change (`CLAUDE.md:224-237`). Slice 43a raised the pinned floor by 15 tests
and added the shared workflow-kind policy helper; Slice 43c raised the floor
by 24 tests and added Check 30 + golden/fingerprint fixtures
(`specs/ratchet-floor.json:1-10`). Slice 43b is recorded as advancing the
qualitative `dispatch_realness` ratchet even with +0 static tests
(`specs/ratchet-floor.json:1-10`; `specs/plans/phase-2-implementation.md:462`).
`rg --files specs/reviews` shows slice-level Codex prongs for 41 and 42 only;
there are no `arc-slice-43a`, `43b`, or `43c` Codex records. The live state
even records "Codex challenger pass NOT required" for 43b/43c while also
calling out ratchet movement (`PROJECT_STATE.md:7`, `PROJECT_STATE.md:19`).

**Impact.** This is not just missing ceremony. 43a changed audit/runtime
policy, 43b changed the runner's async dispatch boundary, and 43c added a new
audit check plus a golden evidence scheme. These are exactly the surfaces
Hard Invariant #6 exists to second-voice.

**Fold-in.** Either add retroactive per-sub-slice Codex reviews, or amend the
methodology and P2.5 plan to explicitly allow one arc-close Codex prong to
subsume multiple same-day sub-slices only when it lists each sub-slice's
ratchet surfaces. This file can serve as the latter only if that exception is
made explicit before it becomes precedent.

### HIGH 2 - The CC#P2-1 golden hashes a close-step placeholder, not reference parity or dispatch output

**Evidence.** ADR-0007 says CC#P2-1 needs byte-shape parity with the reference
Circuit `explore` artifact on at least one canonical phase transition, and
the golden assertion must fail the close criterion when it fails
(`specs/adrs/ADR-0007-phase-2-close-criteria.md:97-110`). The P2 plan binds
that to `tests/runner/explore-e2e-parity.test.ts` and
`tests/fixtures/golden/explore/` (`specs/plans/phase-2-implementation.md:140-143`).
But `writeSynthesisArtifact` writes a deterministic JSON object whose values
are generated only from `step.id` and `step.gate.required`
(`src/runtime/runner.ts:164-187`). The static golden test re-derives that same
placeholder body and compares its hash to the checked-in golden
(`tests/runner/explore-e2e-parity.test.ts:196-212`). The AGENT_SMOKE path
hashes the close-step artifact after the run, but that artifact is still the
same placeholder body (`tests/runner/explore-e2e-parity.test.ts:258-266`).

**Impact.** The test does prove the runtime reaches close after two real
dispatches. It does not prove reference parity, and it does not prove the final
artifact consumes real synthesis/review content. The claimed "one-workflow
parity" is therefore stronger than the measured byte shape.

**Fold-in.** Rename the evidence as "runtime reaches the placeholder close
artifact" or change the golden to hash a real output that consumes prior
dispatch artifacts. If reference parity is still required, add a reference
artifact or a documented substitute with ADR-0007 amendment language.

### HIGH 3 - Check 26 still gates only the old 35-to-40 arc

**Evidence.** CLAUDE.md says arc-close reviews are required before the next
privileged runtime slice, and it also says Check 26 is narrow to the first arc;
subsequent arcs must extend it or land a generalized arc-ledger gate
(`CLAUDE.md:190-222`). The implementation is still hard-coded to
`PHASE_2_FOUNDATION_FOLDINS_ARC_LAST_SLICE = 40` and filters review files with
`arc.*35.*40` / foundation-foldin names only (`scripts/audit.mjs:3138-3199`).
At `current_slice=43c`, audit reports the old 35-to-40 two-prong gate as
satisfied (`scripts/audit.mjs:3245-3248`) while the newly authored
41-to-43 Claude prong is invisible to the check.

**Impact.** The next privileged runtime slice can open with this arc's two
prongs missing or stale, and Check 26 will stay green as long as the old arc's
reviews exist. That makes the current review ceremony voluntary rather than
machine-bound.

**Fold-in.** Extend Check 26 for `arc-slices-41-to-43-composition-review-
{claude,codex}.md`, or replace it with a general arc ledger keyed by current
slice ranges and required prongs. The ceremony commit that lands this file
should also advance `current_slice` only after the updated gate can see both
prongs.

### HIGH 4 - `--dry-run` now reports dry-run while executing the real adapter path

**Evidence.** The CLI still accepts `--dry-run`; its own comment says the flag
is "a no-op" and "the real dispatchAgent adapter ... run regardless"
(`src/cli/dogfood.ts:20-25`). `main()` never passes `dryRun` or a stub
dispatcher into `runDogfood`; the default runner resolves to `dispatchAgent`
(`src/cli/dogfood.ts:169-178`; `src/runtime/runner.ts:158-162`). The JSON
output then reports `dry_run: args.dryRun` even though the real adapter path
was used (`src/cli/dogfood.ts:180-189`). The only CLI smoke test invokes
`dogfood-run-0 --dry-run` without an injected dispatcher
(`tests/runner/dogfood-smoke.test.ts:225-261`).

**Impact.** This is a cross-slice regression: the Phase 1.5 dry-run CLI flag
met Slice 43b's new default real-dispatch seam. A user or CI job can ask for a
dry run and still spawn `claude -p`, while the output claims `dry_run: true`.
That is a safety and evidence-labeling bug, not just a stale help string.

**Fold-in.** Make `--dry-run` fail closed until implemented, or make it inject
a deterministic dry dispatcher and emit an event/log marker that distinguishes
dry-run from non-dry-run. Gate non-dry-run CLI smoke behind `AGENT_SMOKE=1`.

### HIGH 5 - P2.5 landed without promoting the explore deferred properties it promised to close

**Evidence.** `explore.md` says when P2.5 lands, the deferred properties gain
test bindings and the contract amends their enforcement state
(`specs/contracts/explore.md:382-390`). It also says to reopen the contract if
P2.5 lands without promoting `artifact_emission_ordered`,
`review_after_synthesis`, `no_skip_to_close`, and
`reachable_close_only_via_review` from `phase2-property` to `test-enforced`
(`specs/contracts/explore.md:560-567`). P2.5 has now landed, but all four
properties remain `phase2-property` in the invariant ledger
(`specs/invariants.json:1290-1316`), and `rg` finds no test-title binding for
those property ids outside the contract text.

**Impact.** The end-to-end run exercises the happy path, but the contract's
own negative-path promises are still deferred after the slice that was named
as their promotion point. That means the P2.5 closure claim and the explore
contract are now inconsistent.

**Fold-in.** Add property-id-bearing tests that mutate the explore fixture to
skip synthesis, review before synthesis, or close without review, then promote
the four ledger entries to `test-enforced`; or explicitly amend `explore.md`
and ADR-0007 to re-defer them with a new target slice.

## MED Findings

### MED 1 - Check 30 validates ancestry, not the full smoke artifact ADR-0007 required

ADR-0007 says a CI-skipped smoke artifact must carry timestamp, commit SHA,
adapter id, request/receipt/result hash triple, and manifest signature, with
an audit check at Phase 2 close (`specs/adrs/ADR-0007-phase-2-close-criteria.md:145-158`).
The committed fingerprint has only `schema_version`, `commit_sha`,
`result_sha256`, and `recorded_at` (`tests/fixtures/agent-smoke/last-run.json`).
Check 30 validates `commit_sha` format/ancestor and `result_sha256` format
only (`scripts/audit.mjs:3669-3714`). It does not validate `schema_version`,
`recorded_at`, adapter id, request hash, receipt id, manifest signature, or
that `result_sha256` equals the checked-in golden.

Fold-in: either narrow ADR-0007's required fingerprint schema to match the
implemented file, or expand Check 30 and the AGENT_SMOKE writer to carry and
validate the promised fields.

### MED 2 - The workflow-kind helper is shared, but audit and runtime still have different strength

I do not carry Claude's "two implementations" objection as written. The TS
runtime wrapper imports the JS policy table directly
(`src/runtime/policy/workflow-kind-policy.ts:1-7`), and the JS module documents
itself as the single source of truth (`scripts/policy/workflow-kind-policy.mjs:1-27`).
The real residual seam is weaker but real: Check 24 remains raw JSON plus
canonical-set policy only (`scripts/audit.mjs:2739-2790`), while runtime adds
`Workflow.safeParse` (`src/runtime/policy/workflow-kind-policy.ts:38-64`).

Fold-in: add an audit-visible structural validation path or document that
Check 24 is only a kind-policy gate and cannot stand in for runtime fixture
load validity.

### MED 3 - `explore.result` authority prose overstates the placeholder artifact shape

The artifact registry describes `explore.result` as composing a summary,
verdict snapshot, and pointers to the four prior artifacts
(`specs/artifacts.json:693-708`). The runner writes only placeholder strings
for the close step's required fields (`src/runtime/runner.ts:176-187`), and
the contract's placeholder note discusses provisional `schema_sections` gates
but not that the current terminal result omits the prior-artifact pointers
the registry describes (`specs/contracts/explore.md:505-522`).

Fold-in: add a v0 placeholder disclosure to the `explore.result` artifact row,
or make the placeholder body include the pointers the row claims.

### MED 4 - Unknown workflow kinds are still runtime pass-through and audit yellow

The shared policy returns `pass_through` for unknown workflow ids
(`scripts/policy/workflow-kind-policy.mjs:98-104`), the runtime treats that as
`ok: true` (`src/runtime/policy/workflow-kind-policy.ts:53-64`), and Check 27
returns yellow for unregistered workflow kinds rather than red
(`scripts/audit.mjs:3321-3330`, `scripts/audit.mjs:3405-3410`). That may be
acceptable while only `explore` and `dogfood-run-0` exist, but P2.9+ is about
adding more workflow kinds.

Fold-in: before the next workflow-kind slice, make new unregistered workflow
kinds red unless they are explicitly in `EXEMPT_WORKFLOW_IDS` with rationale.

### MED 5 - Check 29's import scan does not cover the runtime dispatch caller

Check 29 scans `src/runtime/adapters/**` only (`scripts/audit.mjs:3548-3571`).
Slice 43b made `src/runtime/runner.ts` the lazy-importing dispatch caller
(`src/runtime/runner.ts:158-162`), but the runner itself is outside the
import-level scan. Root `package.json` still blocks direct forbidden deps, but
a transitive forbidden package imported from runner-side glue would not trip
Check 29.

Fold-in: either extend the import-level scan to the runtime dispatch caller
surface or add an explicit assertion that all model-provider imports must live
under the scanned adapter tree.

## LOW Findings

### LOW 1 - The CLI usage string still says dogfood-run-0 only

`usage()` says "v0.1 scope: dogfood-run-0 only" (`src/cli/dogfood.ts:38-43`),
but Slice 43c explicitly removed that guard and now resolves any
`.claude-plugin/skills/<workflow-name>/circuit.json` (`src/cli/dogfood.ts:122-125`).
This is smaller than HIGH 4 because it is text-only, but it will mislead the
next operator.

### LOW 2 - README still describes real dispatch and workflow parity as future work

README says real agent dispatch and workflow parity "remain Phase 2+ work"
(`README.md:41-48`), while PROJECT_STATE says Slice 43c closes CC#P2-1 and
CC#P2-2 simultaneously (`PROJECT_STATE.md:7`, `PROJECT_STATE.md:13`). The
README can be coarse, but this sentence is now stale enough to confuse the
arc-close handoff.

### LOW 3 - Reviewer model naming remains inconsistent

The prior arc Codex composition prong uses `reviewer_model: gpt-5.4`, while
the Slice 41/42 prongs use `gpt-5-codex`. This file follows the user's
requested `gpt-5-codex` value, but the repo still lacks a normalized model-id
policy for review records. Not blocking, but it weakens queryability.

## META Notes

1. `npm run audit` returned 28 green / 1 yellow / 1 red. The structural audit
   checks through Check 30 were green except the known framing yellow; the red
   was the verify gate tail.
2. `npm run test -- tests/runner/dogfood-smoke.test.ts` also failed in this
   sandbox at the CLI smoke test because `tsx` could not open its IPC pipe
   (`listen EPERM ... tsx-501/...pipe`). I treat that as sandbox evidence only,
   not as the core dry-run finding; the dry-run finding is from code flow.
3. Claude's placeholder-contract and workflow-policy objections need
   calibration. Placeholder output is disclosed in PROJECT_STATE and runner
   comments, and the workflow-kind table is single-sourced through the JS
   module. Those facts do not rescue HIGH 2 or MED 2; they do narrow the fix.

## Closing

Do not open P2.6 on the current ceremony state. The smallest credible fold-in
bundle is: make the 41-to-43 two-prong gate visible to audit, explicitly
dispose the skipped 43a/43b/43c Codex passes, correct the golden/parity claim,
fix or reject `--dry-run`, and either promote or re-defer the four explore
properties whose P2.5 reopen trigger has fired. After that, the remaining MED
and LOW items are ordinary hardening rather than arc blockers.
