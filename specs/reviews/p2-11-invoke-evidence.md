---
review_kind: invoke-evidence
review_target: P2.11 plugin-CLI wiring (Slice 56)
authored_at: 2026-04-23
authored_against_commit: 863ef620c04ba7a248c75997a95615c659ebf532
close_criterion: ADR-0007 §Decision.1 CC#P2-3 (plugin command registration)
cc_state_transition: active — red → active — satisfied at CLI-surrogate parity
evidence_scope: |
  The CLI path the rewritten command bodies instruct Claude to invoke is
  exercised end-to-end via a direct `npm run circuit:run` invocation. The
  slash-command handler path (Claude Code `/circuit:explore` → $ARGUMENTS
  substitution → Claude-constructs-Bash-call → Bash tool execution → CLI)
  is NOT directly exercised in this evidence file. Closing that
  surrogate-gap requires a live plugin-user invocation transcript from a
  Claude Code session with the plugin installed. Codex challenger HIGH 1
  (specs/reviews/arc-slice-56-codex.md) surfaced the distinction and the
  evidence language below is scoped accordingly.
---

# P2.11 Plugin-CLI Wiring — Invoke Evidence

This file records the live invocation evidence for ADR-0007 CC#P2-3 at
active-satisfied-at-CLI-surrogate-parity. Slice 56 (P2.11) rewrote
`.claude-plugin/commands/circuit-explore.md` + `.claude-plugin/commands/
circuit-run.md` so a plugin-user invocation of `/circuit:explore` in Claude
Code runs the explore workflow end-to-end via the project CLI instead of
returning "Not implemented yet" placeholder text. The invocation below
exercises the same CLI path the command body instructs Claude to invoke.

**Scope honesty note (Codex HIGH 1 fold-in).** The evidence below is a
**direct-CLI surrogate** for the plugin-user invocation path. The surrogate
proves that (a) the CLI path the command bodies point at is functional;
(b) the explore workflow runs end-to-end and produces canonical artifacts;
(c) both dispatch adapters (claude + codex) round-trip correctly under
Slice 53 + Slice 54 composed gate semantics. The surrogate does NOT
exercise Claude Code's slash-command handler, `$ARGUMENTS` substitution
into the command body, Claude-as-interpreter constructing the Bash call
from the instruction text, or the Bash tool's own permission/allowlist
behavior. Closing the surrogate gap is a separate concern — it requires
a plugin-user transcript from a live Claude Code session with the plugin
installed, which an author-time evidence file cannot capture. CC#P2-3 as
stated in ADR-0007 §Decision.1 is "plugin command registration" not
"plugin command invocation with full $ARGUMENTS substitution trace," so
CLI-surrogate parity is the honest close state at slice commit.

## Invocation path

The rewritten command body at `.claude-plugin/commands/circuit-explore.md`
tells Claude to invoke (via the Bash tool):

```bash
npm run circuit:run -- explore --goal "$ARGUMENTS"
```

`package.json:21` expands that to:

```bash
tsc -p tsconfig.build.json && node dist/cli/dogfood.js explore --goal "$ARGUMENTS"
```

`src/cli/dogfood.ts::main` loads the explore workflow fixture at
`.claude-plugin/skills/explore/circuit.json`, validates it through the
production `Workflow` schema + `validateWorkflowKindPolicy`, then dispatches
through `runDogfood` against the real `dispatchAgent` (subprocess
`claude -p`) and `dispatchCodex` (subprocess `codex exec`) adapters per
ADR-0009 §1.

## Live invocation (2026-04-23)

**Working directory:** `/Users/petepetrash/Code/circuit-next` (HEAD `863ef62`
pre-slice-56 baseline; the rewritten command bodies + Check 23 extension are
staged but not yet committed).

**Command:**

```bash
npm run circuit:run -- explore --goal "test P2.11 plugin wiring — confirm the slash command reaches the runtime and the explore workflow opens a run" --run-root /tmp/circuit-next-p2-11-evidence/run
```

**CLI stdout:**

```json
{
  "run_id": "0d5dc5c1-2742-4864-838f-ae1aa2e7254c",
  "run_root": "/tmp/circuit-next-p2-11-evidence/run",
  "outcome": "complete",
  "events_observed": 30,
  "result_path": "/tmp/circuit-next-p2-11-evidence/run/artifacts/result.json"
}
```

**Process exit code:** 0.

## What the run produced

Run-root layout:

```
run/
├── events.ndjson              (30 events, 7,782 bytes)
├── manifest.snapshot.json     (8,304 bytes)
├── state.json                 (1,545 bytes)
└── artifacts/
    ├── analysis.json              (54 bytes)     — analyze-step
    ├── brief.json                 (121 bytes)    — frame-step
    ├── dispatch/                                 — synthesize + review adapter transcripts
    ├── explore-result.json        (119 bytes)    — close-step (historical placeholder-parity evidence; Slice 93 later replaces this with typed `explore.result@v1`)
    ├── result.json                (600 bytes)    — canonical RunResult
    ├── review-verdict.json        (20 bytes)     — review-step dispatch output
    └── synthesis.json             (231 bytes)    — synthesize-step dispatch output
```

**SHA-256 fingerprints:**

| File | SHA-256 |
|---|---|
| `artifacts/analysis.json` | `5bde06ff9dae0e4ab9dcbb65fcaeae8b20a8c9850e731899a33a0decd469f9b0` |
| `artifacts/brief.json` | `50d83d7183db0ea5c37e7af83642719c21c127c3004f6bd48e1939f71eff1796` |
| `artifacts/explore-result.json` | `99ad7d8c1c226af01130e4bc014864d9b507052922753e3b98f0d15875890e66` |
| `artifacts/result.json` | `0b7a30e9ae02b43e974a3d6c2e9d6d600f13bc742a214723a14701bc194c07d1` |
| `artifacts/review-verdict.json` | `f817a74a8548ce9af93ba55444165429639b5003ebdf3363706c6ae5f910e0de` |
| `artifacts/synthesis.json` | `b537b4d6bfd799d7d262327519e2b413bc032c5119a459749b56fc40fa69f5ea` |
| `events.ndjson` | `60d15203133e0253a288a3a03b14fbb206c9104c12f2161076e3abf09b450dd2` |
| `manifest.snapshot.json` | `7143e13f0a5b438064710f76ffd886d9a7cf79c790f1658ab53521a86e00fb8e` |
| `state.json` | `013efd9d1ebc79145c45ef22dc9cd8b9f7b19fe5dc4268dd2732ee73c6d7ea62` |

Fingerprints are included so a future re-invocation against the same
commit + same goal + same `--run-root` can be byte-compared. The manifest
hash (`0f97777d63e43e2988da81584b98f329df67edef8a9371b537f29ac97d399f31`)
is carried inside `result.json` and independently verifiable.

**`result.json` payload:**

```json
{
  "schema_version": 1,
  "run_id": "0d5dc5c1-2742-4864-838f-ae1aa2e7254c",
  "workflow_id": "explore",
  "goal": "test P2.11 plugin wiring — confirm the slash command reaches the runtime and the explore workflow opens a run",
  "outcome": "complete",
  "summary": "dogfood-run-0: explore v0.1.0 closed 5 step(s) for goal \"…\".",
  "closed_at": "2026-04-23T03:24:05.035Z",
  "events_observed": 30,
  "manifest_hash": "0f97777d63e43e2988da81584b98f329df67edef8a9371b537f29ac97d399f31"
}
```

## Event-kind histogram

All 30 events in `events.ndjson`, in sequence order:

| seq | kind | step_id | notes |
|---|---|---|---|
| 0 | `run.bootstrapped` | — | workflow=explore, rigor=standard, goal carried |
| 1–4 | `step.entered` / `step.artifact_written` / `gate.evaluated` / `step.completed` | `frame-step` | orchestrator-synthesis; artifact=`brief.json`, schema=`explore.brief@v1`, gate=schema_sections pass |
| 5–8 | same 4 events | `analyze-step` | orchestrator-synthesis; artifact=`analysis.json`, schema=`explore.analysis@v1` |
| 9–15 | `step.entered` + 4 dispatch events + `gate.evaluated` + `step.completed` | `synthesize-step` | worker-dispatch via `claude -p` adapter; artifact=`synthesis.json`, gate=result_verdict, verdict=`accept` (in `gate.pass=["accept"]`) |
| 16–22 | same 7-event pattern | `review-step` | worker-dispatch via `codex exec` adapter; artifact=`review-verdict.json`, gate=result_verdict, verdict=`accept` (in `gate.pass=["accept","accept-with-fold-ins"]`) |
| 23–28 | frame-phase-shape events | `close-step` | orchestrator-synthesis (recorded during the historical placeholder-parity epoch; Slice 93 later replaces this writer with the typed `explore.result@v1` aggregate); artifact=`explore-result.json`, historical declared schema token=`explore.result@v1`, gate pass |
| 29 | `run.closed` | — | `outcome: complete` |

## What this proves (and what it does not)

**Proves (at CLI-surrogate parity):**

1. **The CLI path the command body instructs Claude to invoke is
   functional.** The CLI runs end-to-end on an operator machine with
   authenticated `claude` + `codex` CLIs. A future regression that unwires
   the commands from the CLI path is caught by Check 23 rule (g) (literal
   "Not implemented yet" rejection — narrow exact-case coverage per Codex
   LOW 1 disclosure) + `tests/runner/plugin-command-invocation.test.ts`
   (fenced-bash-block extraction + executable-explore-invocation
   assertions + negative fixtures for prose-only / P2.8-pointer-only /
   negated bodies, per Codex MED 1 fold-in) + the Codex HIGH 2 fold-in
   regression test that rejects unsafe `--goal "$ARGUMENTS"` double-quoted
   splices.
2. **The full explore workflow spine executes.** All 5 canonical phases
   (frame → analyze → synthesize → review → close) produced their canonical
   artifacts and advanced through their gates. Both dispatches (synthesize
   + review) round-tripped through the subprocess adapters per ADR-0009 §1
   and produced verdict-carrying result bodies that passed Slice 53's
   `evaluateDispatchGate` admissibility check.
3. **Slice 53 + 54 runtime-correctness composition holds under real
   dispatch.** `dispatch.completed.verdict` values match the adapter output
   (both `"accept"` — actual output; not runtime sentinel); the canonical
   artifacts at `writes.artifact.path` were written only after both verdict
   admissibility (Slice 53) AND schema parse (Slice 54) passed; the event
   sequence follows the contract's prescribed ordering.

**Does NOT prove (explicitly out of scope):**

4. **Slash-command handler behavior.** Claude Code's `/circuit:explore`
   handler receives the raw user text, substitutes it for `$ARGUMENTS` in
   the command body, and feeds the substituted body to Claude as a prompt.
   None of these steps is exercised here — the surrogate invokes the CLI
   directly. A future slice that collects a real plugin-user transcript
   (or a plugin-install smoke that captures the slash-command → CLI round
   trip) is the honest way to close this gap.
5. **Claude-as-interpreter safety.** The command body relies on Claude to
   construct the Bash invocation using the safe single-quote-with-escape
   rule documented in the body (Codex HIGH 2 fold-in). The rule is
   documented and regression-tested at the body layer; its actual
   adherence by Claude at runtime is not proven here.

## CC#P2-3 state transition

- **Before Slice 56:** `active — red` (command bodies returned "Not
  implemented yet"; plugin surface did not connect to the runtime at all).
- **After Slice 56:** `active — satisfied at CLI-surrogate parity`
  (command bodies route through the CLI to the runtime; the CLI path is
  proven load-bearing by the live invocation below; audit Check 23
  extended to reject exact-case placeholder regression; invocation evidence
  recorded in this file). Slash-command handler path remains unproven
  pending a plugin-user transcript — see "Does NOT prove" above.

Note: this evidence was recorded while CC#P2-1 was still at
placeholder-parity (per ADR-0007 amendment). Slice 93 later replaced the
close-step placeholder writer with the typed `explore.result@v1` aggregate,
so the captured `explore-result.json` fingerprint is historical evidence for
the Slice 56 CLI-surrogate invocation, not current close-result shape
evidence. The wiring gap CC#P2-3 closes is separate from the
orchestrator-parity gap CC#P2-1 tracks.

## Authority

- `specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1 CC#P2-3`
- `specs/plans/p2-11-plugin-wiring.md` (this slice's plan)
- `specs/contracts/explore.md §Canonical phase set + §Dispatch
  gate-evaluation semantics`
- `specs/adrs/ADR-0009-adapter-invocation-pattern.md §1`
  (subprocess-per-adapter — the adapters the runner dispatches to during
  synthesize + review)
