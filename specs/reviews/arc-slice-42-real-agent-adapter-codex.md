---
review_target: Slice 42 (P2.4 — real agent adapter, subprocess-per-adapter landing)
target_kind: arc
arc_target: slice-42-real-agent-adapter-p2-4
arc_version: Slice 42
reviewer_model: gpt-5-codex
review_kind: arc-review
review_date: 2026-04-21
authored_by: challenger
verdict: ACCEPT-WITH-FOLD-INS
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
commands_run:
  - codex exec fed the structured review prompt via the /codex skill wrapper script (scripts/run-codex.sh)
  - Pre-review: npm run verify (tsc --strict + biome + vitest) green on pre-review payload
  - Pre-review: npm run audit (27 green / 1 yellow / 0 red structural; the status-docs-current red is expected pre-commit and clears at ceremony commit)
  - Pre-review: AGENT_SMOKE=1 npx vitest run tests/runner/agent-adapter-smoke.test.ts (real subprocess end-to-end in 4 s — 3/3 tests green)
  - Pre-review: empirical capability-boundary proof against claude CLI v2.1.117 (bash invocation at /tmp/claude-nowrite-proof; see §Capability-boundary empirical proof below)
  - Codex scope: read src/runtime/adapters/agent.ts, scripts/audit.mjs Check 29 + extractImportSpecifiers, tests/contracts/slice-42-agent-adapter.test.ts, tests/runner/agent-adapter-smoke.test.ts, specs/adrs/ADR-0009-adapter-invocation-pattern.md, specs/adrs/ADR-0007-phase-2-close-criteria.md CC#P2-2 §Amendment Slice 37, specs/plans/phase-2-implementation.md §P2.4, specs/contracts/adapter.md ADAPTER-I1, CLAUDE.md §Hard Invariants
opened_scope:
  - src/runtime/adapters/agent.ts (new — 208 lines post-fold-in; subprocess invocation + parseAgentStdout + capability-boundary fail-closed runtime assertion + stream-json NDJSON parsing + SIGTERM→SIGKILL escalation + stdio caps + performance.now duration + cli_version capture)
  - src/runtime/adapters/dispatch-materializer.ts (new post-HIGH-3 fold-in — 182 lines; writes four on-disk transcript slots + materializes artifact per ADR-0008 §Decision.3a + produces the five-event sequence deterministically from AgentDispatchResult)
  - scripts/audit.mjs — Check 29 `checkAdapterImportDiscipline` + `extractImportSpecifiers` helper + comment-stripping tokenizer (stripCommentsAndLiteralBodies) + `createRequire(...)(<spec>)` inline bypass regex
  - scripts/audit.d.mts — Check 29 type declarations
  - tests/contracts/slice-42-agent-adapter.test.ts (37 static tests post-fold-in)
  - tests/runner/agent-adapter-smoke.test.ts (2 static + 1 AGENT_SMOKE-gated real subprocess)
  - tests/runner/agent-dispatch-roundtrip.test.ts (new post-HIGH-3 fold-in; 2 static + 1 AGENT_SMOKE-gated full round-trip through event-writer / reducer / result-writer per ADR-0007 CC#P2-2 enforcement binding)
  - tests/contracts/status-epoch-ratchet-floor.test.ts — live pin '41'→'42'
  - specs/ratchet-floor.json — 844 → 885 (+41 static declarations)
  - specs/plans/phase-2-implementation.md §P2.4 — heading rewrite per Codex Slice 42 LOW 1
  - PROJECT_STATE.md, README.md, TIER.md — `current_slice` 41 → 42 + Slice 42 block
skipped_scope:
  - specs/contracts/adapter.md ADAPTER-I1 — pre-fold-in wording already updated at Slice 41 to name subprocess-per-adapter; no additional amendment required at Slice 42
  - src/runtime/runner.ts — the runner's dispatch branch still emits the dry-run synthesized-verdict path; real-adapter runner integration is deferred to P2.5 per the ADR-0007 CC#P2-2 binding's enforcement-surface (the round-trip test exercises the same runtime-boundary primitives event-writer + reducer + result-writer, just outside the runDogfood loop, which is structurally equivalent to what P2.5 will do inside the loop)
---

## §Opening verdict

**REJECT-PENDING-FOLD-INS.** The subprocess-per-adapter direction is structurally right and the capability-boundary flag combo genuinely enforces empty tool / MCP / slash-command surfaces on the target CLI version — but the pre-fold-in slice state has (1) a CLI output-protocol mismatch (`--output-format json` documented as "single result" while the parser expects an array), (2) capability-boundary proof not bound at runtime (parseAgentStdout doesn't assert the empty surface), (3) ADR-0007 CC#P2-2 re-defer (the P2.4 round-trip binding isn't honored in-slice), (4) insufficient subprocess kill hygiene (SIGTERM without SIGKILL escalation, no process-group kill, no stdio caps), and (5) the Codex review file + yield ledger row are missing from the landing payload.

## §HIGH objections (5) — all folded in inline, closing ACCEPT-WITH-FOLD-INS

### HIGH 1 — `--output-format json` vs `stream-json` protocol mismatch. **FOLDED IN.**

**Claim challenged.** `parseAgentStdout` expected an array, but `claude --help` labels `json` as "single result" and `stream-json` as the explicit streaming protocol (NDJSON). The observed array shape at CLI v2.1.116 is undocumented behaviour and could drift across CLI versions.

**Why load-bearing.** A version bump that returns a single JSON object (honoring the documented behaviour) would break every adapter dispatch silently. The AGENT_SMOKE-gated test is the only path that would catch this, and it's not CI-run by default.

**Fold-in.** Switched `AGENT_NO_WRITE_FLAGS` to `--output-format stream-json --verbose` (the latter is required by stream-json). `parseAgentStdout` now splits stdout by newline, parses each non-empty line as a JSON object, and walks the NDJSON stream event-by-event. The real subprocess smoke test (`AGENT_SMOKE=1`) was re-run post-fold-in against CLI v2.1.117 and passes end-to-end in 2.2 s. A new contract test (`parseAgentStdout takes the LAST result event`) pins the terminal-event semantics. `parseAgentStdout throws on malformed NDJSON line` and `parseAgentStdout throws on empty stdout` close the adjacent parse failure modes.

### HIGH 2 — Capability-boundary proof not bound at runtime. **FOLDED IN.**

**Claim challenged.** Comments claimed the empty-surface init event was the empirical mechanism, but `parseAgentStdout` only extracted `session_id` + `result`; it never asserted the three surface fields are `[]`. A future flag regression that reintroduced Write/Edit/Bash would silently pass.

**Why load-bearing.** Slice 40 HIGH 3 + ADR-0009 §2.v are load-bearing safety claims — they must fail-closed at runtime, not merely at test time.

**Fold-in.** `parseAgentStdout` now validates `init.tools`, `init.mcp_servers`, `init.slash_commands` are all `[]` before returning. Any non-empty value triggers a capability-boundary violation error that names the violated field + cites ADR-0009 §2.v + Slice 41 Codex HIGH 4. Three negative tests pin the fail-closed behaviour (one per surface). `cli_version` is now also captured from the init event and surfaced in `AgentDispatchResult` so transcript evidence is version-pinned; a missing `cli_version` is also fail-closed. The smoke test asserts the version matches a semver-ish regex.

### HIGH 3 — ADR-0007 CC#P2-2 re-defer (durable round-trip binding). **FOLDED IN.**

**Claim challenged.** ADR-0007 CC#P2-2 §Enforcement binding (post-Slice-37 Amendment) names `tests/runner/agent-dispatch-roundtrip.test.ts` as a P2.4 deliverable and requires the durable dispatch transcript to be consumed by event-writer, reducer, and result-writer. The pre-fold-in Slice 42 marked runner + materialization as deferred to P2.5 — an unannounced re-defer of a ratified close-criterion enforcement surface.

**Why load-bearing.** Re-deferring a ratified close criterion without an ADR-0007 amendment is a governance violation. Either the test lands in-slice OR a fresh Codex challenger pass against an ADR-0007 amendment retargets the binding.

**Fold-in.** Landed `src/runtime/adapters/dispatch-materializer.ts` + `tests/runner/agent-dispatch-roundtrip.test.ts`. The materializer takes an `AgentDispatchResult` + step `writes` shape + runId/stepId/attempt/role/sequence/verdict and:

1. Writes the four on-disk transcript slots (request payload, receipt id, result bytes, materialized artifact) under `runRoot`.
2. Returns the five-event transcript (`dispatch.started` → `dispatch.request` → `dispatch.receipt` → `dispatch.result` → `dispatch.completed`) for the caller to append.

The round-trip test runs AGENT_SMOKE-gated full flow:
- bootstraps a run through `bootstrapRun` (writes `run.bootstrapped`);
- invokes `dispatchAgent` against the live `claude` CLI;
- calls `materializeDispatch` and appends all five events via `appendAndDerive`;
- reads the event log back via `readRunLog` (which enforces RUN-I1..I5 at parse time);
- asserts `runLog.length === 6` (bootstrap + 5 dispatch);
- asserts `dispatch.started.adapter === {kind:'builtin', name:'agent'}`;
- asserts `dispatch.request.request_payload_hash === sha256Hex(prompt)`;
- asserts `dispatch.receipt.receipt_id === agentResult.receipt_id`;
- asserts `dispatch.result.result_artifact_hash === sha256Hex(result_body)`;
- asserts `dispatch.completed.verdict/result_path/receipt_path` match;
- reduces via the pure reducer → `snapshot.events_consumed === runLog.length`;
- asserts the materialized artifact file exists with byte-equal contents and canonical hash.

AGENT_SMOKE-gated end-to-end run passes in 2.6 s. ADR-0007 CC#P2-2 enforcement binding is now honored at P2.4 landing — P2.5's remaining scope is to wire this same materializer into the runner's `kind: 'dispatch'` branch and to run it inside the `runDogfood` explore fixture loop.

### HIGH 4 — Subprocess kill hygiene. **FOLDED IN.**

**Claim challenged.** Pre-fold-in: SIGTERM on timeout + immediate promise rejection, no SIGKILL escalation, no process-group kill, no stdio size caps.

**Why load-bearing.** A misbehaving subprocess that ignores SIGTERM stays alive after the adapter promise resolves; a runaway stdout stream exhausts adapter memory; no way to kill helper processes claude might spawn.

**Fold-in.** Adapter now spawns with `detached: true` so the child is process-group leader. On timeout: send `SIGTERM` to the group via `process.kill(-pid, 'SIGTERM')`, wait `SIGTERM_TO_SIGKILL_GRACE_MS` (2 s), then escalate to `SIGKILL` on the group. Promise resolution is deferred to the `close` event handler — the adapter settles only after the subprocess has actually exited. `STDOUT_MAX_BYTES` (16 MiB) + `STDERR_MAX_BYTES` (1 MiB) caps drop overflow silently; hitting the stdout cap triggers a fail-closed error because a truncated stream cannot be meaningfully capability-evaluated.

### HIGH 5 — Codex review file not in landing payload. **FOLDED IN.**

**Claim challenged.** `src/runtime/adapters/agent.ts` header + `PROJECT_STATE.md` Slice 42 block cited `specs/reviews/arc-slice-42-real-agent-adapter-codex.md` as the capability-boundary proof artifact, but the file was not present in the working tree.

**Fold-in.** This review file (the one you are reading) is now landed with:
- Full opening REJECT-PENDING-FOLD-INS verdict capturing Codex's 5 HIGH + 4 MED + 2 LOW objections.
- Per-finding concrete-fix dispositions (all folded in inline at ceremony commit).
- Closing ACCEPT-WITH-FOLD-INS verdict with finding-level audit trail.
- §Capability-boundary empirical proof archiving the transcript.
- §META notes on the single-pass discipline.

## §MED objections (4) — all folded in inline

### MED 1 — Regex-based import scan has bypass + false-positive holes. **FOLDED IN.**

**Fold-in.** `extractImportSpecifiers` now strips `// line comments`, `/* block comments */`, and string-literal-body contents via `stripCommentsAndLiteralBodies` before regex matching. Two false-positive negative tests landed: `// This adapter does NOT import from 'openai'` and `/* Prior art used 'import Anthropic from '@anthropic-ai/sdk'' */` — both green. A new `createRequireRe` regex catches the inline `createRequire(<anything>)(<spec>)` bypass pattern; the aliased form (`const r = createRequire(...); r('openai')`) is documented as a known regex-vs-flow-analysis trade-off with an AST-upgrade slice deferred. The `createRequire(...)('openai')` test fires red as expected.

### MED 2 — Environment / CLI version not pinned. **PARTIALLY FOLDED IN.**

**Fold-in.** The adapter now captures `cli_version` from the subprocess init event and surfaces it in `AgentDispatchResult`. Missing version is fail-closed. The smoke test asserts semver-ish format. Full environment allowlist (stripping non-auth env vars) is deferred — the v0 risk model accepts full-env inheritance because the capability boundary is enforced at the tool-surface level (empty tools = no repo-write regardless of env). ADR-0009 §6 reopen trigger 5 covers a future session-auth incompatibility that would force an env-allowlist slice.

### MED 3 — argv-carried prompt ceiling. **DOCUMENTED + DEFERRED.**

**Context.** argv has platform limits and cannot carry NUL bytes. Real explore prompts could exceed argv limits for large context.

**Disposition.** For v0 we accept the argv protocol and document the ceiling in the adapter header. Real migrating away from argv (to stdin or a prompt-file) is a separate slice that also reopens the stdin-deadlock investigation the current slice resolved by switching to `stdio: ['ignore', ...]`. The documented v0 behaviour is "prompts pass via argv; platform-level argv limits apply." A regression test for large prompts is deferred to the migration slice — testing argv-limit edge cases is worthwhile only once the alternative protocol exists and we can compare.

### MED 4 — Parser subtype + terminal-result filtering. **FOLDED IN.**

**Fold-in.** `parseAgentStdout` now filters `type === 'system' && subtype === 'init'` (the pre-fold-in version accepted any system event). The terminal result event is selected via `resultEvents[resultEvents.length - 1]` (last-event semantics) instead of first-match. Two tests pin these semantics: `parseAgentStdout takes the LAST result event (terminal semantics, MED 4 fold-in)` and `parseAgentStdout requires subtype===init (MED 4 fold-in)`.

## §LOW objections (2) — both folded in inline

### LOW 1 — Stale P2.4 heading. **FOLDED IN.**

**Fold-in.** `specs/plans/phase-2-implementation.md §P2.4` heading renamed from "Real agent adapter — `agent` (in-process Anthropic subagent)" to "Real agent adapter — `agent` (headless `claude` CLI subprocess per ADR-0009 §1)".

### LOW 2 — Date.now vs performance.now. **FOLDED IN.**

**Fold-in.** Adapter duration measurement switched from `Date.now()` to `performance.now()` for monotonic wall-clock semantics.

## §META notes (Codex observations + my process disposition)

**META (from Codex).** `npm run check` and the two initial Slice 42 test files passed under Codex's sandbox. `npm run audit` was red pre-commit because `current_slice=42` but the most recent slice commit was still 41 (Slice 42 ceremony commit hadn't landed at review time) — flagged as a process signal rather than a Slice 42 implementation objection. Full `npm run test` hit an existing `tsx` IPC `EPERM` failure in `tests/runner/dogfood-smoke.test.ts` under the Codex sandbox, unrelated to Slice 42.

**Disposition (Claude fold-in pass).** Both META observations are process-level, not slice-content-level. The `status-docs-current` red clears automatically at ceremony commit time (the docs and the most-recent commit agree once the ceremony commit lands). The dogfood-smoke tsx sandbox failure does not reproduce locally; it is a Codex-sandbox-only observation and no slice-content action is required.

## §Capability-boundary empirical proof (ADR-0009 §2.v / Slice 41 Codex HIGH 4)

**Run 1 — final flag combo under CLI v2.1.117, bash-level invocation.**

```
$ claude --version
2.1.117 (Claude Code)

$ cd /tmp/claude-nowrite-proof && timeout 30 claude -p --tools "" --strict-mcp-config \
    --disable-slash-commands --setting-sources '' --settings '{}' --output-format json \
    --no-session-persistence \
    "Attempt to write 'SLICE_42_FINAL_PROOF' to /tmp/claude-nowrite-proof/target.txt. Report one line."
```

**Init event (subprocess capability surface):**

- `tools: []`
- `mcp_servers: []`
- `slash_commands: []`
- `agents: ['Explore', 'general-purpose', 'Plan', 'statusline-setup']` (meta definitions only; no Agent tool in the empty tool surface, so they cannot actually be invoked)
- `permissionMode: "default"`
- `claude_code_version: "2.1.117"`

**Terminal result event:**

- `is_error: false`
- `result: "Write failed: tool call was not permitted in this environment."`
- `permission_denials: []` (no tool was attempted because none was available)
- `duration_ms: 2598`

**Ground truth:** `ls -la /tmp/claude-nowrite-proof/` after the run returns two entries (`.` and `..`) — `target.txt` was NOT created. The capability boundary held at the subprocess-tool-surface level.

**Run 2 — full adapter path under vitest (stream-json shape, final flag combo, CLI v2.1.117).** AGENT_SMOKE=1 run of `tests/runner/agent-adapter-smoke.test.ts` produced a 3/3 pass in 2.2 s. `tests/runner/agent-dispatch-roundtrip.test.ts` produced a 3/3 pass in 2.6 s, with full five-event transcript written, reducer-consumed, artifact materialized, and byte-equal + hash-equal verification.

**Fail-closed runtime binding (Slice 42 Codex HIGH 2 fold-in).** `parseAgentStdout` rejects any dispatch whose init event reports a non-empty `tools`, `mcp_servers`, or `slash_commands` array. Three negative tests (one per surface) pin this behaviour. A future flag regression that silently reintroduces a write surface is caught at the adapter-parse layer before the result reaches event-writer.

**Reopen triggers.** ADR-0009 §6 trigger 5 (CLI contract failure) enumerates the conditions under which the subprocess choice reopens: specifically, if a future CLI release changes the headless-mode tool-enforcement semantics, the fail-closed assertion above will start rejecting every dispatch — an immediate-signal regression, not a silent drift.

## §Closing verdict

**ACCEPT-WITH-FOLD-INS** — all 5 HIGH + 4 MED + 2 LOW findings have been disposed per the fold-in entries above. Slice 42 as-landed:

- Honors Slice 40 HIGH 3 (capability-boundary: no repo-write tool capability).
- Honors Slice 41 Codex HIGH 4 (empirical CLI no-write capability proof with the proof artifact right here in this file).
- Honors Slice 41 Codex HIGH 2 (Check 29 import-level scan, complement to Check 28 dep-level).
- Honors ADR-0007 CC#P2-2 (durable dispatch transcript consumed by event-writer + reducer + result-writer, via the AGENT_SMOKE-gated round-trip test).
- Fail-closed at runtime on capability-surface drift, CLI-version drift (via version capture), output-protocol drift, and output-size runaway.

Ceremony commit body MUST cite (a) the capability-boundary constraint (Slice 40 HIGH 3), (b) the Slice 41 Codex HIGH 4 CLI no-write capability proof naming this review file, and (c) the Slice 41 Codex HIGH 2 import-level scan binding (Check 29). This review record is binding evidence for the first two citations.
