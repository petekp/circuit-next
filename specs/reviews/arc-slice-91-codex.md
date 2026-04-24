---
name: arc-slice-91-codex
description: Cross-model challenger pass over Slice 91 (P2.10 strict explore.review-verdict dispatch artifact schema). Per-slice review per AGENTS.md hard invariant #6 for ratchet-advance dispatch artifact work.
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-24
verdict: ACCEPT
authored_by: gpt-5.4 via codex exec
review_target: slice-91-p2-10-explore-review-verdict-schema
target_kind: arc
target: slice-91
target_version: "Base HEAD=c29cdfc (Slice 90 explore synthesis schema); working tree reviewed before Slice 91 commit"
arc_target: p2-10-artifact-schema-set
arc_version: "Slice 91 promotes dispatch-produced explore.review-verdict@v1 to a strict schema; explore.result remains the final P2.10 follow-on"
opening_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: ACCEPT
severity_counts:
  high: 0
  med: 1
  low: 1
  meta: 0
commands_run:
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (opening pass over draft Slice 91 diff; verdict ACCEPT-WITH-FOLD-INS)"
  - "parent session folded MED/LOW findings by adding review verdict vocabulary parity coverage and runner-level extra-key abort coverage"
  - "npm run lint"
  - "npm run check"
  - "npm run test -- tests/contracts/explore-artifact-schemas.test.ts tests/runner/explore-artifact-writer.test.ts tests/runner/cli-router.test.ts tests/runner/config-loader.test.ts tests/contracts/artifact-authority.test.ts"
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (follow-up pass over folded Slice 91 diff; verdict ACCEPT)"
opened_scope:
  - src/schemas/artifacts/explore.ts
  - src/runtime/artifact-schemas.ts
  - src/runtime/runner.ts
  - tests/contracts/explore-artifact-schemas.test.ts
  - tests/runner/explore-artifact-writer.test.ts
  - tests/runner/cli-router.test.ts
  - tests/runner/config-loader.test.ts
  - specs/artifacts.json
  - specs/contracts/explore.md
  - specs/plans/phase-2-implementation.md
  - PROJECT_STATE.md
  - PROJECT_STATE-chronicle.md
  - README.md
  - TIER.md
skipped_scope:
  - explore.result aggregate schema
  - P2.10 arc-close composition review over Slices 89-91
  - live AGENT_SMOKE and CODEX_SMOKE fingerprint refresh
  - full npm run verify inside the read-only Codex sandbox; parent session owns final verification
authority:
  - AGENTS.md Hard invariants #6
  - AGENTS.md Cross-model challenger protocol
  - specs/plans/phase-2-implementation.md P2.10
  - specs/contracts/explore.md
  - specs/artifacts.json
  - src/runtime/artifact-schemas.ts
---

# Slice 91 - P2.10 Explore Review Verdict Schema - Codex Challenger Pass

This records the Codex cross-model challenger pass for the slice that
promotes `explore.review-verdict@v1` from the minimal dispatch verdict
shape to a strict review verdict payload schema.

The landed claim is narrow: the review dispatch prompt names the full
JSON shape the reviewer adapter must return, the dispatch materializer
parses that body through `ExploreReviewVerdict`, and malformed or
surplus-key payloads abort before `artifacts/review-verdict.json` is
written.

## Opening Verdict

**ACCEPT-WITH-FOLD-INS.** Codex found one MEDIUM verification gap and one
LOW runtime-boundary proof gap.

## Objection List and Dispositions

### MED 1 - Review verdict vocabulary was duplicated without a parity ratchet

The first draft hardcoded `['accept', 'accept-with-fold-ins']` in
`ExploreReviewVerdictValue` while the fixture also declared the accepted
verdicts in `review-step.gate.pass`. If those drifted, the runner could
admit a verdict the artifact schema rejected, or reject one the schema
accepted.

Disposition: **folded in.** `tests/contracts/explore-artifact-schemas.test.ts`
now parses `.claude-plugin/skills/explore/circuit.json`, locates
`review-step`, and asserts `review-step.gate.pass` equals
`ExploreReviewVerdictValue.options`.

### LOW 1 - Runner-level strictness did not cover surplus review keys

The first draft proved missing-field aborts at the runtime boundary, but
surplus-key rejection was only covered by the schema unit test.

Disposition: **folded in.** `tests/runner/explore-artifact-writer.test.ts`
now sends an otherwise-valid review verdict payload with a surplus
`smuggled` key through the real runner path and asserts the run aborts
before `artifacts/review-verdict.json` is written.

## Follow-up Verdict

**ACCEPT.** Codex re-read the folded diff and reported no findings. It
confirmed that the verdict vocabulary parity ratchet and the runtime
extra-key abort coverage close the opening objections.

Codex did not run full repository verification in its read-only sandbox.
The parent session owns final `npm run verify` and `npm run audit` before
landing the slice.

## Verification Owned By Parent Session

- `npm run lint`
- `npm run check`
- `npm run test -- tests/contracts/explore-artifact-schemas.test.ts tests/runner/explore-artifact-writer.test.ts tests/runner/cli-router.test.ts tests/runner/config-loader.test.ts tests/contracts/artifact-authority.test.ts`

Final `npm run verify` and `npm run audit` are owned by the Slice 91
landing session after this review file is committed with the slice.
