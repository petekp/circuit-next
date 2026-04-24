---
name: arc-slice-87-codex
description: Cross-model challenger pass over Slice 87 (P2-MODEL-EFFORT built-in adapter model/effort argv binding). Per-slice review per AGENTS.md hard invariant #6 for ratchet-advance privileged runtime adapter work.
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-24
verdict: ACCEPT
authored_by: gpt-5.4 via codex exec
review_target: slice-87-p2-model-effort-adapter-argv-binding
target_kind: arc
target: slice-87
target_version: "Base HEAD=45f0547 (Slice 86 product config loader); working tree reviewed before Slice 87 commit"
arc_target: p2-model-effort
arc_version: "Actual repository Slice 87; lands built-in adapter model/effort argv binding and leaves arc-close composition review as the next required step before new privileged runtime work"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT
severity_counts:
  high: 1
  med: 1
  low: 2
  meta: 0
commands_run:
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (opening pass over draft Slice 87 diff; verdict REJECT-PENDING-FOLD-INS)"
  - "parent session folded HIGH/MED/LOW findings by adding final Codex spawn-argv validation, Codex effort allowlist, and CODEX_SMOKE resolvedSelection coverage"
  - "npm run check"
  - "npm run lint"
  - "npm run test -- tests/contracts/slice-42-agent-adapter.test.ts tests/contracts/slice-45-codex-adapter.test.ts tests/contracts/workflow-model-effort.test.ts tests/runner/config-loader.test.ts tests/runner/codex-adapter-smoke.test.ts tests/runner/codex-dispatch-roundtrip.test.ts tests/contracts/schema-parity.test.ts tests/contracts/artifact-authority.test.ts"
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (follow-up pass over folded Slice 87 diff; verdict ACCEPT)"
  - "parent session folded follow-up LOW by adding explicit none-effort rejection assertions for agent and codex adapters"
opened_scope:
  - src/runtime/adapters/agent.ts
  - src/runtime/adapters/codex.ts
  - src/runtime/adapters/shared.ts
  - src/runtime/runner.ts
  - tests/contracts/slice-42-agent-adapter.test.ts
  - tests/contracts/slice-45-codex-adapter.test.ts
  - tests/runner/codex-adapter-smoke.test.ts
  - tests/runner/codex-dispatch-roundtrip.test.ts
  - specs/contracts/adapter.md
  - specs/contracts/selection.md
  - specs/plans/phase-1-close-revised.md
  - specs/plans/phase-2-implementation.md
  - specs/adrs/ADR-0007-phase-2-close-criteria.md
  - PROJECT_STATE.md
  - PROJECT_STATE-chronicle.md
  - README.md
  - TIER.md
skipped_scope:
  - live AGENT_SMOKE and CODEX_SMOKE fingerprint refresh
  - custom/gemini/third-party adapter routing
  - intelligent model selection or fallback routing
  - adapter-owned validation of specific model-id availability beyond provider compatibility
  - arc-close composition review over Slices 85-87; required next before new privileged runtime work
  - full npm run verify inside the read-only Codex sandbox; parent session owns final verification
authority:
  - AGENTS.md Hard invariants #6
  - AGENTS.md Cross-model challenger protocol
  - AGENTS.md Cross-slice composition review cadence
  - specs/plans/phase-2-implementation.md P2-MODEL-EFFORT
  - specs/contracts/adapter.md
  - specs/contracts/selection.md
  - scripts/audit.mjs Check 35
---

# Slice 87 - P2-MODEL-EFFORT Adapter Argv Binding - Codex Challenger Pass

This records the Codex cross-model challenger pass for the slice that
wires resolved model and effort selections into the built-in adapter
subprocess arguments.

The landed claim is narrow: the Claude adapter honors compatible
Anthropic model ids and supported effort tiers through its CLI flags; the
Codex adapter honors compatible OpenAI model ids and supported effort
tiers through `-m` plus a single allowlisted `model_reasoning_effort`
config override. Incompatible providers and unsupported built-in effort
tiers fail before subprocess spawn.

## Opening Verdict

**REJECT-PENDING-FOLD-INS.** Codex found one HIGH, one MED, and one LOW.

## Objection List and Dispositions

### HIGH 1 - Codex `-c` exception was not enforced at the final spawn argv boundary

The first draft added `-c model_reasoning_effort="<effort>"` even though
`-c` remained listed as a forbidden config-layer bypass. The only
boundary assertion checked `CODEX_NO_WRITE_FLAGS`, not the final argv
passed to `spawn()`, so the exception was convention-based rather than
mechanically pinned.

Disposition: **folded in.** `assertCodexSpawnArgvBoundary()` now validates
the final argv returned by `buildCodexArgs()`. It requires exactly one
`-s read-only` pair, allows at most one `-c`, allows only
`model_reasoning_effort=<supported effort>` after that `-c`, and rejects
config/profile/sandbox/write-widening tokens including `--config=...`,
`--profile`, `--sandbox=...`, duplicate `-c`, and extra `-s`.

### MED 1 - Codex effort support was overclaimed

The first draft accepted every schema `Effort` value and blindly emitted
it into Codex config. That meant `none` or `minimal` could fail in the
Codex CLI after spawn even though the docs claimed unsupported tiers
failed before spawn.

Disposition: **folded in.** `CODEX_SUPPORTED_EFFORTS` now pins the current
Codex allowlist to `low`, `medium`, `high`, and `xhigh`; `buildCodexArgs`
throws before spawn for unsupported tiers. The docs now state that
`none` and `minimal` are schema values but not currently honored by the
built-in adapters.

### LOW 1 - Smoke paths did not exercise resolved selection through the real dispatch call

The first draft tested argv builders directly, but the CODEX_SMOKE-gated
real subprocess tests still called `dispatchCodex()` without a
`resolvedSelection`.

Disposition: **folded in.** `tests/runner/codex-adapter-smoke.test.ts`
and `tests/runner/codex-dispatch-roundtrip.test.ts` now pass
`resolvedSelection: { effort: 'low', skills: [], invocation_options: {} }`
into `dispatchCodex()` when the real Codex subprocess path is enabled.

## Follow-up Verdict

**ACCEPT.** Codex re-read the folded diff and found the HIGH and MED
blockers closed. It also confirmed the CODEX_SMOKE path now exercises the
new dispatch input and that the P2-5 `active -- satisfied` claim does not
overclaim arc closure because PROJECT_STATE explicitly names the
composition review as the next required step before new privileged
runtime work.

The follow-up pass reported one LOW proof gap: docs name both `none` and
`minimal` as unsupported effort tiers, while the focused adapter tests
only asserted `minimal`. The parent session folded that by adding direct
`none` rejection assertions to both the Claude and Codex adapter suites.

Codex did not run the full repo verification in its read-only sandbox.
The parent session owns final `npm run verify` and `npm run audit` before
landing the slice.

## Verification Owned By Parent Session

- `npm run check`
- `npm run lint`
- `npm run test -- tests/contracts/slice-42-agent-adapter.test.ts tests/contracts/slice-45-codex-adapter.test.ts tests/contracts/workflow-model-effort.test.ts tests/runner/config-loader.test.ts tests/runner/codex-adapter-smoke.test.ts tests/runner/codex-dispatch-roundtrip.test.ts tests/contracts/schema-parity.test.ts tests/contracts/artifact-authority.test.ts`

Final `npm run verify` and `npm run audit` are owned by the Slice 87
landing session after this review file is committed with the slice.
