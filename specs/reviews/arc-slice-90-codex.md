---
name: arc-slice-90-codex
description: Cross-model challenger pass over Slice 90 (P2.10 strict explore.synthesis dispatch artifact schema). Per-slice review per AGENTS.md hard invariant #6 for ratchet-advance dispatch artifact work.
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-24
verdict: ACCEPT
authored_by: gpt-5.4 via codex exec
review_target: slice-90-p2-10-explore-synthesis-schema
target_kind: arc
target: slice-90
target_version: "Base HEAD=dbf87a2 (Slice 89 explore brief/analysis schemas); working tree reviewed before Slice 90 commit"
arc_target: p2-10-artifact-schema-set
arc_version: "Slice 90 promotes dispatch-produced explore.synthesis@v1 to a strict schema; explore.review-verdict and explore.result remain follow-ons"
opening_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: ACCEPT
severity_counts:
  high: 0
  med: 1
  low: 1
  meta: 0
commands_run:
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (opening pass over draft Slice 90 diff; verdict ACCEPT-WITH-FOLD-INS)"
  - "parent session folded MED/LOW findings by adding strict surplus-key schema tests, runner-level extra-key abort coverage, and stronger prompt assertions"
  - "npm run lint"
  - "npm run check"
  - "npm run test -- tests/contracts/explore-artifact-schemas.test.ts tests/runner/explore-artifact-writer.test.ts tests/runner/materializer-schema-parse.test.ts tests/contracts/artifact-authority.test.ts"
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (follow-up pass over folded Slice 90 diff; verdict ACCEPT)"
  - "parent session updated legacy CLI/config test stubs to return an ExploreSynthesis-shaped body for explore synthesize-step after full verify exposed minimal-verdict stubs"
  - "npm run verify"
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (final narrow check over test-stub updates; ACCEPT remains valid)"
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
  - explore.review-verdict strict schema
  - explore.result aggregate schema
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

# Slice 90 - P2.10 Explore Synthesis Schema - Codex Challenger Pass

This records the Codex cross-model challenger pass for the slice that
promotes `explore.synthesis@v1` from the minimal dispatch verdict shape
to a strict synthesis payload schema.

The landed claim is narrow: the synthesize dispatch prompt names the full
JSON shape the adapter must return, the dispatch materializer parses that
body through `ExploreSynthesis`, and malformed or surplus-key payloads
abort before `artifacts/synthesis.json` is written.

## Opening Verdict

**ACCEPT-WITH-FOLD-INS.** Codex found one MEDIUM verification gap and one
LOW prompt-proof gap.

## Objection List and Dispositions

### MED 1 - Strictness was not directly proven

The first draft added `.strict()` schemas, but the tests only checked
required-field presence and non-empty arrays. A future regression from
strict object parsing to passthrough parsing could have stayed green.

Disposition: **folded in.** `tests/contracts/explore-artifact-schemas.test.ts`
now rejects surplus keys at both the `ExploreSynthesis` top level and
inside nested `supporting_aspects`. `tests/runner/explore-artifact-writer.test.ts`
also covers an otherwise-valid synthesize dispatch payload carrying a
surplus `smuggled` key and asserts the run aborts before
`artifacts/synthesis.json` is written.

### LOW 1 - Prompt proof was too thin

The first draft only asserted that the synthesize prompt contained
`success_condition_alignment`, even though the slice claim included the
full schema-specific shape, the no-extra-top-level-keys instruction, and
the runtime validation warning.

Disposition: **folded in.** The runtime test now asserts that the prompt
names `recommendation`, `success_condition_alignment`,
`supporting_aspects`, the no-extra-top-level-keys instruction, and the
`explore.synthesis@v1` validation-before-write rule.

## Follow-up Verdict

**ACCEPT.** Codex re-read the folded diff and reported no findings. It
confirmed that the schema strictness, prompt instruction, registry-backed
parse gate, and runner-level abort-before-write evidence line up.

After full verification exposed two legacy test stubs still returning only
`{ "verdict": "accept" }` for the explore synthesize step, the parent
session updated those test harnesses to return an `ExploreSynthesis`-
shaped body for synthesize and preserve the minimal verdict body for
later/non-synthesize dispatches. A final narrow Codex check reported that
ACCEPT remains valid and raised no new concerns.

Codex did not run full repository verification in its read-only sandbox.
The parent session owns final `npm run verify` and `npm run audit` before
landing the slice.

## Verification Owned By Parent Session

- `npm run lint`
- `npm run check`
- `npm run test -- tests/contracts/explore-artifact-schemas.test.ts tests/runner/explore-artifact-writer.test.ts tests/runner/materializer-schema-parse.test.ts tests/contracts/artifact-authority.test.ts`
- `npm run verify`

Final `npm run verify` and `npm run audit` are owned by the Slice 90
landing session after this review file is committed with the slice.
