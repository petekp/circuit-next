---
name: arc-slice-89-codex
description: Cross-model challenger pass over Slice 89 (P2.10 starter schemas for explore.brief and explore.analysis). Per-slice review per AGENTS.md hard invariant #6 for ratchet-advance runtime artifact work.
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-24
verdict: ACCEPT
authored_by: gpt-5.4 via codex exec
review_target: slice-89-p2-10-explore-brief-analysis-schemas
target_kind: arc
target: slice-89
target_version: "Base HEAD=a5ccb91 (Slice 88 model/effort arc close); working tree reviewed before Slice 89 commit"
arc_target: p2-10-artifact-schema-set
arc_version: "Slice 89 starts P2.10 with strict orchestrator-produced explore.brief/explore.analysis schemas and default synthesis writer support; dispatch-produced synthesis/review/result artifacts remain follow-ons"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT
severity_counts:
  high: 1
  med: 1
  low: 0
  meta: 0
commands_run:
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (opening pass over draft Slice 89 diff; verdict REJECT-PENDING-FOLD-INS)"
  - "parent session folded HIGH/MED findings by removing orchestrator-only schemas from the dispatch parse registry, adding dispatch fail-closed coverage, resolving explore.brief by path, and covering reordered reads"
  - "npm run lint"
  - "npm run check"
  - "npm run test -- tests/contracts/explore-artifact-schemas.test.ts tests/runner/explore-artifact-writer.test.ts tests/runner/materializer-schema-parse.test.ts tests/contracts/artifact-authority.test.ts"
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (follow-up pass over folded Slice 89 diff; verdict ACCEPT)"
opened_scope:
  - src/schemas/artifacts/explore.ts
  - src/schemas/index.ts
  - src/runtime/artifact-schemas.ts
  - src/runtime/runner.ts
  - tests/contracts/explore-artifact-schemas.test.ts
  - tests/runner/explore-artifact-writer.test.ts
  - tests/runner/materializer-schema-parse.test.ts
  - specs/artifacts.json
  - specs/contracts/explore.md
  - specs/plans/phase-2-implementation.md
  - PROJECT_STATE.md
  - PROJECT_STATE-chronicle.md
  - README.md
  - TIER.md
skipped_scope:
  - explore.synthesis strict schema
  - explore.review-verdict strict schema
  - explore.result aggregate schema
  - model-authored frame/analyze artifact generation
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

# Slice 89 - P2.10 Explore Brief/Analysis Schemas - Codex Challenger Pass

This records the Codex cross-model challenger pass for the slice that
starts the explore artifact schema set with strict, orchestrator-produced
`explore.brief@v1` and `explore.analysis@v1` payloads.

The landed claim is narrow: the default runtime synthesis writer emits
schema-valid brief and analysis artifacts on the normal explore path.
Dispatch-produced `explore.synthesis`, `explore.review-verdict`, and the
close aggregate `explore.result` remain follow-on work.

## Opening Verdict

**REJECT-PENDING-FOLD-INS.** Codex found one HIGH and one MEDIUM.

## Objection List and Dispositions

### HIGH 1 - Orchestrator-only schemas were admitted through dispatch materialization

The first draft registered `explore.brief@v1` and
`explore.analysis@v1` in `src/runtime/artifact-schemas.ts`, which is the
dispatch artifact parse registry. That let a future or malformed worker
dispatch step claim one of those orchestrator-only schema names and reach
the canonical artifact materialization path, conflicting with the
contract and artifact authority rows.

Disposition: **folded in.** `explore.brief@v1` and
`explore.analysis@v1` are no longer present in the dispatch parse
registry. The strict schemas remain exported from
`src/schemas/artifacts/explore.ts` for the orchestrator synthesis writer.
`tests/runner/materializer-schema-parse.test.ts` now proves a dispatch
step declaring `explore.analysis@v1` fails closed as an unregistered
schema and writes no canonical artifact.

### MED 1 - Analysis depended on positional `reads[0]`

The first draft assumed `step.reads[0]` was the brief. That matched the
current fixture but made the default writer fragile: a harmless extra
read or reordered reads array could parse the wrong file or abort for the
wrong reason.

Disposition: **folded in.** The analysis writer now locates the brief by
the expected run-relative path `artifacts/brief.json`.
`tests/runner/explore-artifact-writer.test.ts` covers a reordered reads
case with an extra read before the brief and still requires a valid
analysis artifact sourced from `artifacts/brief.json`.

## Follow-up Verdict

**ACCEPT.** Codex re-read the folded diff and found no remaining
findings. It explicitly confirmed the prior HIGH and MEDIUM objections
were closed and that the strict schema, contract, and artifact-authority
updates are internally consistent with the folded runtime behavior.

Codex did not run full repository verification in its read-only sandbox.
The parent session owns final `npm run verify` and `npm run audit` before
landing the slice.

## Verification Owned By Parent Session

- `npm run lint`
- `npm run check`
- `npm run test -- tests/contracts/explore-artifact-schemas.test.ts tests/runner/explore-artifact-writer.test.ts tests/runner/materializer-schema-parse.test.ts tests/contracts/artifact-authority.test.ts`

Final `npm run verify` and `npm run audit` are owned by the Slice 89
landing session after this review file is committed with the slice.
