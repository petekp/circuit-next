---
adr: 0009
title: Adapter Invocation Pattern — Subprocess-Per-Adapter for v0
status: Accepted (post-Codex-Slice-41-fold-in)
date: 2026-04-21
author: claude-opus-4-7 (drafted under operator direction) + gpt-5-codex (challenger — pass completed, objections folded in — see specs/reviews/arc-slice-41-adapter-invocation-pattern-codex.md)
supersedes: none
related:
  - ADR-0007 (Phase 2 close criteria; CC#P2-2 real-agent dispatch transcript — this ADR decides HOW that dispatch is invoked)
  - ADR-0008 (dispatch granularity modeling; establishes Synthesize and Review as dispatch steps that the adapter from this ADR services)
  - specs/plans/phase-2-implementation.md §P2.4 (the slice this ADR amends; original "same-process simpler than cross-process" framing reflected an undecided SDK-vs-CLI question, landed as plan-prose default rather than an auditable decision)
  - src/schemas/adapter.ts (ResolvedAdapter: BuiltInAdapter enum {agent, codex, codex-isolated} + CustomAdapterDescriptor carrying an argv array — the schema surface this ADR's decision binds to at runtime)
  - CLAUDE.md §Cross-model challenger protocol (the `/codex` wrapper, authoritative at CLAUDE.md:173-179, already exercises the subprocess pattern this ADR codifies — "pipes to `codex exec` via the shared wrapper script"; the plugin-level skill file under `.claude/` is untracked local state, not repo authority)
amends:
  - specs/contracts/adapter.md ADAPTER-I1 — `agent` semantic amendment: prior "same-process Claude Code Agent tool" wording replaced with "subprocess `claude -p` headless CLI invocation" per ADR-0009 §1. Codex Slice 41 HIGH 1 narrowing-amendment disclosure.
  - specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1 CC#P2-2 — enforcement surface widens with invocation-pattern specificity, and `agent in-process Anthropic subagent` prior wording replaced with `agent as headless claude CLI subprocess`. Codex Slice 41 HIGH 1 narrowing-amendment disclosure.
  - specs/plans/phase-2-implementation.md §P2.4 — Alternate framing prose ("same-process simpler than cross-process") replaced; the rejected alternative reframes as subprocess-vs-subprocess ordering question; baseline-dispatcher rationale added. P2.4 acceptance evidence extended with CLI no-write capability proof per Codex Slice 41 HIGH 4 fold-in.
---

# ADR-0009 — Adapter Invocation Pattern (Subprocess-Per-Adapter for v0)

## Context

The P2.4 slice (real agent adapter) reopens after the pre-P2.4
foundation fold-in arc closed at Slice 40 (`ebb797b`, two-prong
composition review, both prongs ACCEPT-WITH-FOLD-INS). The Slice 40
arc-close amendment to P2.4 added the HIGH 3 capability-boundary
constraint (v0 ships with no repo-write tool capability), but left
open a structurally adjacent question the plan prose was ambiguous
about: **how does the `agent` adapter invoke its dispatch target?**

The P2.4 plan text at `specs/plans/phase-2-implementation.md:271-287`
named the deliverable as "in-process Anthropic subagent invocation"
and rejected a codex-first ordering because `agent` is "the simplest
same-process path and isolates the adapter-boundary question from
cross-process subprocess complexity." That phrasing reads naturally
as "use `@anthropic-ai/sdk` to call the Anthropic API from inside
the Node.js process" — a same-process, no-subprocess invocation.

At P2.4 framing time (Slice 41 opening, 2026-04-21), the operator
surfaced the design drift:

- circuit-next is a Claude Code plugin. The `claude` CLI is present
  by construction on any machine running the plugin. The
  "no-claude-CLI-required" pro of an SDK path is vacuous.
- The product direction is **"Claude Code out-of-box, no Codex
  required"**: `agent` is the non-optional baseline adapter; `codex`
  / `gemini` / etc. are optional adapters users configure if they
  have the respective CLIs installed. Default workflows must work
  without optional adapters installed.
- The reference Circuit implementation at `~/Code/circuit` uses
  subprocess-per-adapter (headless CLI invocation) consistently for
  all dispatch targets. The `/codex` wrapper — authoritative per
  `CLAUDE.md:173-179` §Cross-model challenger protocol ("pipes to
  `codex exec` via the shared wrapper script") — is the already-
  worked subprocess-adapter pattern this repo exercises for every
  Codex challenger pass recorded under `specs/reviews/*-codex.md`.
  (The plugin-side skill file under `.claude/skills/codex/` is
  untracked local state, not repo authority — Codex Slice 41 MED 3
  fold-in.)
- Introducing `@anthropic-ai/sdk` would create **two Anthropic
  paths** (SDK for `agent`, subprocess for any future `claude-cli`
  adapter or tooling composition), a second auth path
  (`ANTHROPIC_API_KEY` separate from Claude Code's existing login),
  and a second billing path (Anthropic API account separate from the
  operator's Claude Code subscription) — all for zero product-level
  benefit given the CLI is already present.

The SDK-vs-CLI question is not cosmetic. It determines:

1. Whether the plugin adds its first non-`zod` external dependency.
2. Whether credential management branches ("Claude Code session auth"
   vs "ANTHROPIC_API_KEY environment variable").
3. Whether billing attribution is unified or fragmented across
   operator accounts.
4. Whether the adapter codepath is uniform across built-in adapters
   (all subprocess) or bifurcated (SDK for `agent`, subprocess for
   everyone else).
5. Whether future optional adapters (OpenAI, Google, local models)
   inherit a uniform adapter shape or each choose their own path.

This ADR picks the invocation pattern explicitly and closes the
prose ambiguity at governance level, so P2.4 (Slice 42) lands
bounded to adapter implementation rather than smuggling an
architectural decision into the first privileged runtime slice.
(Same structural failure mode the pre-P2.4 arc's HIGH 1 closed for
dispatch granularity; this ADR closes the adjacent slot for
adapter invocation.)

**Why a governance ratchet and not just a plan-text amendment.**
Three authority surfaces would otherwise disagree about the
invocation model: plan prose (current "same-process" reading
implies SDK), the `/codex` wrapper precedent (subprocess), and the
future audit check that will flag forbidden SDK deps. A plan-text
amendment alone cannot speak to the audit surface or future-slice
reopen triggers. The ADR is the right tool.

**ADR-0007 §6 applicability (Codex HIGH 1 fold-in — narrowing-with-
semantic-amendment, not pure widening).** ADR-0007 §6 precedent
firewall applies to "retarget, waive, relax, substitute, re-defer, or
aggregate" any Phase 2 close criterion. The initial draft of this ADR
read this as a pure widening (enforcement-surface specificity added,
no prior semantics changed). The Codex Slice 41 HIGH 1 pass surfaced
that this is more accurately a **narrowing amendment with semantic
content**: prior authority surfaces explicitly said `agent` is
"same-process" / "in-process Anthropic subagent" (`specs/contracts/
adapter.md` ADAPTER-I1; ADR-0007 CC#P2-2 pre-amendment). ADR-0009 §1
replaces that with "subprocess-per-adapter." The invocation space is
narrowed (SDK path excluded at v0) AND the specific prior semantics
are rewritten (same-process → subprocess). The seven §6 clauses
evaluated under the corrected classification:

- §6.1 retarget: N/A (CC#P2-2 target `agent` unchanged; the identifier
  keeps its binding, only the invocation pattern is amended).
- §6.2 waive: N/A (no criterion waived).
- §6.3 relax: N/A — the invocation space is *narrowed* (SDK path
  excluded at v0), not relaxed. Relaxation would widen allowable
  invocation patterns; this ADR restricts them to subprocess-only.
- §6.4 substitute: partial — same-process/in-process prior wording is
  substituted with subprocess wording across `specs/contracts/adapter.
  md` ADAPTER-I1 and ADR-0007 CC#P2-2 inline. §6.4 inline disclosure
  is satisfied by this ADR's §What-changes.1 (adapter.md amendment),
  §What-changes.2 (ADR-0007 amendment), §What-changes.3 (plan prose
  amendment); the substitution is non-semantic at the enforcement
  level (CC#P2-2 still demands a real round-trip; only the mechanism
  is specified).
- §6.5 re-defer: N/A (no deferral of a criterion).
- §6.6 aggregate: N/A (no aggregation across criteria).
- §6.7 disclosure: §Context block + §Consequences §Enabling +
  §What-changes block covering the three amended surfaces. Cross-model
  challenger satisfied by `specs/reviews/arc-slice-41-adapter-
  invocation-pattern-codex.md`.

## Decision

### 1. Invocation pattern for v0 — subprocess-per-adapter

All built-in adapters (`agent`, `codex`, `codex-isolated`) invoke
their dispatch target as a **subprocess of the Node.js runtime**,
via a headless CLI call:

| Adapter | Subprocess invocation (shape; exact flags decided at implementing slice) |
|---|---|
| `agent` | `claude -p "<prompt>"` or equivalent print-mode invocation of the Claude Code CLI |
| `codex` | `codex exec "<prompt>"` via the `/codex` wrapper script pattern |
| `codex-isolated` | Same as `codex`, with process-isolation flags added per the "isolated" variant's constraints (defined at the implementing slice) |

Custom adapters (`CustomAdapterDescriptor` per `src/schemas/adapter.ts:21`)
are **structurally subprocess-only** — the schema requires an argv
array of length ≥1 with each element `.min(1)`. Users declaring a
custom adapter declare its executable and args; the runtime spawns
that subprocess. This was the pre-existing constraint; this ADR
aligns built-in adapters with it.

**What "subprocess" means concretely.** The adapter module invokes
`child_process.spawn` (or `node:child_process` equivalent) with:

- The dispatch target's executable (e.g., `claude`, `codex`) as
  `argv[0]`.
- The prompt + any per-adapter arguments as subsequent argv entries
  or stdin input (decided per adapter at implementing slice).
- `stdio: ['pipe', 'pipe', 'pipe']` so stdin/stdout/stderr are
  capturable, not inherited.
- A bounded wall-clock timeout (defined by the dispatch step's
  `budgets.wall_clock_ms` when present; a per-adapter default
  otherwise).
- The adapter module reads stdout into the `writes.result` raw
  transcript slot per ADR-0008 §Decision.3a materialization rule;
  materializes the validated artifact into `writes.artifact.path`
  via the engine-owned writer path.

### 2. Rationale — why subprocess, not SDK

Four grounds (applying the ADR-0008 §2 four-ground frame; citation
form is "the four-ground analysis from ADR-0008 §2 is applied here
to adapter invocation," with fresh answers below):

**2.i Existing schema surface.** `CustomAdapterDescriptor.command:
z.array(z.string().min(1)).min(1)` at `src/schemas/adapter.ts:25`
already encodes subprocess-argv semantics for custom adapters. A
uniform subprocess pattern for built-in adapters means the
invocation shape is *the same across all adapter kinds*: built-in
adapters are argv wrappers over the respective CLI binaries; custom
adapters are argv wrappers the user supplies. An SDK path for
`agent` would introduce a second dispatch shape that the schema
cannot model without widening (a second variant of
`BuiltInAdapterRef` carrying SDK-config fields, or a sidecar
registry). That widening is avoidable.

**2.ii Single transcript path (Slice 37 event schema).** The five-
event dispatch transcript (`dispatch.started` +
`dispatch.request` + `dispatch.receipt` + `dispatch.result` +
`dispatch.completed`, all widened at Slice 37 per
`src/schemas/event.ts:14-variants`) is adapter-agnostic: the events
carry content hashes, not invocation metadata. Subprocess
invocation produces a single transcript path (stdout bytes hashed
into `dispatch.result.result_artifact_hash`). An SDK invocation
produces structurally richer transcript semantics (streaming chunks,
tool-use callbacks, cached-prefix indicators, per-step token
accounting) that the v0 event schema does not model. (Codex Slice
41 MED 1 fold-in, reworded from earlier "SDK would force a schema-
widening slice"): a minimal SDK integration *could* collapse SDK-
specific metadata into the existing `dispatch.result` transcript
slot by hashing a final response string, matching the subprocess-
stdout shape. That collapsing is a choice, not a forced widening —
but the choice discards the SDK's richer-semantics value proposition,
and the collapsed shape is byte-equivalent to subprocess stdout. If
the richer semantics later become load-bearing (tool-use rounds
accounted per step, cached-prefix hit-rate tracked in the ledger,
streaming deltas surfaced to UI), the event schema widens at that
point — Option A reopen trigger #2 names this forcing function.
Subprocess is congruent with the transcript schema as it stands; SDK
at v0 either collapses the richer semantics (buying nothing) or
forces a schema widening (v0 does not need). Either way, v0 gains
nothing.

**2.iii No new external dependency surface.** The plugin's only
runtime dep is `zod`. Adding `@anthropic-ai/sdk` opens a second
dependency surface: its own versioning, its own transitive deps,
its own type-stub maintenance (per CLAUDE.md §Hard invariant #7 —
every external-package identifier backed by installed type stubs
or an end-to-end call test), and its own security-update treadmill.
Subprocess invocation uses only `node:child_process`, which is a
stable Node stdlib module already available to any Node runtime.
The cost/benefit math favors subprocess at v0.

**2.iv Product-constraint binding — "no Codex required; Claude
Code out-of-box."** The operator's 2026-04-21 product decision
(recorded in this slice's conversation history; operator memory
`project_circuit_next_governance.md` as context for future
sessions) constrains the baseline `agent` adapter to work without
any optional dependency installed. The `claude` CLI is guaranteed
present because circuit-next *is* a Claude Code plugin. The
`@anthropic-ai/sdk` package is not guaranteed present and adding it
would re-import optional-dep concerns — "does pip/npm have the SDK
pinned correctly? does auth work?" — that subprocess invocation
against the already-present CLI avoids entirely.

**2.v Capability-boundary deferral — the CLI no-write requirement
is load-bearing (Codex Slice 41 HIGH 4 fold-in, 2026-04-21).** P2.4
as amended by Slice 40 HIGH 3 requires the `agent` adapter to ship
**with no repo-write tool capability** (file-write, directory-create,
shell-write subset) — see `specs/plans/phase-2-implementation.md §P2.4`
and `specs/reviews/p2-foundation-composition-review.md §HIGH 3`. The
subprocess pattern selected here is the right structural answer
**only if** the `claude` CLI's headless print-mode (`claude -p` or
equivalent) can be invoked with per-invocation tool restrictions
strong enough to satisfy that no-write capability boundary. This
ADR does NOT prove that property at Slice 41; the four grounds §2.i-
2.iv above are the invocation-pattern decision, not the capability-
boundary decision. The capability-boundary is a P2.4 (Slice 42)
acceptance-evidence requirement: the implementing slice MUST
empirically verify that `claude` subprocess invocation can enforce
the no-write tool boundary (either via a documented CLI flag or via
a demonstrable subprocess-level mechanism), and MUST record that
verification in the P2.4 commit body and Codex challenger review.
If the CLI cannot enforce the no-write boundary (see §6 reopen
trigger 5 below), ADR-0009 reopens BEFORE P2.4 can land against the
subprocess choice — the subprocess decision made here is conditional
on that empirical outcome.

### 3. Deferred options — future possibilities the operator explicitly asked be recorded

Per operator 2026-04-21 ("We should make a note of future
possibilities like B2 so we don't forget them"), the following
alternatives are deferred with explicit reopen triggers. Recording
them here satisfies the non-accidental-forgetting constraint:
deferred ≠ rejected-forever; deferred means "there is a named
condition under which this becomes the right answer."

#### 3.a Option A — Direct SDK (Anthropic / OpenAI / Google)

**What it is.** Adapter modules import the respective vendor SDK
(`@anthropic-ai/sdk`, `openai`, `@google/genai`) and invoke the
API in-process. No subprocess; no CLI dependency; one Node.js
process.

**Why deferred, not rejected.** SDK integration gives access to
vendor-specific capabilities that subprocess-wrapping a CLI cannot
reach: Anthropic prompt caching across dispatch calls, the Batch
API for large asynchronous jobs, the Files API for persistent
document handles, structured tool-use callbacks with streaming
deltas, fine-grained token accounting. These become valuable when
circuit-next's token consumption is high enough that subprocess
startup overhead + CLI-level indirection becomes a measurable
bottleneck, OR when a specific workflow needs a capability the
CLI-headless mode does not expose.

**Reopen triggers (any of):**

1. **Measurable subprocess overhead.** Empirical evidence
   (wall-clock profiling across typical dispatches) shows subprocess
   startup + teardown accounts for >20% of per-dispatch wall-clock
   on the target machine class. Threshold: 20% is a starting heuristic;
   the reopening slice can propose an updated threshold with its own
   rationale.
2. **Anthropic-specific capability becomes load-bearing.** A
   future slice identifies prompt caching, batch API, files API, or
   streaming tool-use as a capability the primary workflow
   (`explore`, `build`, `repair`, `migrate`, `sweep`) genuinely needs
   — not a nice-to-have. Evidence: a failing contract test or a user-
   facing performance problem that cannot be fixed via subprocess.
3. **OpenAI or Google SDK becomes the baseline.** If the
   `agent` baseline adapter retargets away from Claude to another
   vendor (ADR-0007 CC#P2-2 amendment), the new vendor's SDK path
   is re-evaluated against its own CLI availability and the four
   grounds in §2.
4. **A second Anthropic runtime path is already accepted for
   another reason (Codex Slice 41 MED 5 fold-in, tightened from
   earlier "transitive-dep-presence" wording).** If a future slice
   adds an *accepted Anthropic SDK runtime path* — meaning
   `@anthropic-ai/sdk` (or an equivalent) is already integrated
   with working auth, billing attribution, and transcript semantics
   for an unrelated feature (e.g., embeddings, indexing, tool-use
   accounting) — then the per-feature auth/billing/transcript cost
   the current ADR cites against SDK-for-agent has already been
   paid, and the cost/benefit for `agent` inverts. Transitive-dep
   *presence alone* (a lockfile-level install from a transitive
   dependency) is NOT sufficient — the Anthropic SDK must be a
   first-class runtime path with the same auth/billing/transcript
   assumptions `agent` would need. This tighter framing blocks the
   accidental-reopen path where a new library's lockfile carries
   `@anthropic-ai/sdk` as a transitive without any deliberate SDK
   runtime integration.

**Forbidden reopen trigger:** "we prefer SDK because it's cleaner"
without one of (1)-(4). The four grounds in §2 are the bar.

#### 3.b Option B2 — Runner pause/resume + Claude Code native Task tool

**What it is.** Instead of the TS runner spawning a `claude`
subprocess, the runner emits a structured dispatch request, returns
control to the outer `/circuit:run` slash-command orchestrator, the
orchestrator invokes the Claude Code Task tool (native subagent
machinery) to fulfill the request, the fulfillment result is handed
back, and the runner resumes. Zero subprocess; full subagent
integration; leverages the `.claude/agents/*.md` ecosystem and the
plugin's authored subagents directly.

**Why deferred, not rejected.** B2 is strictly the better answer
in the end-state: no subprocess startup cost, no CLI indirection,
native access to the Claude Code session state, composition with
the operator's existing subagent definitions. The reason it is not
v0 is architectural lift: the runner must become pause/resume-
capable — durable-workflow territory. The current runner
(`src/runtime/runner.ts:113-322`) is a synchronous TS loop; rewiring
it to yield at dispatch boundaries, persist state, and resume from
a re-entered orchestrator call is a substantial slice family, not a
single P2.4.

**Reopen triggers (any of):**

1. **Claude Code plugin runtime exposes a synchronous Task
   invocation API.** If a plugin TS module can call something like
   `await invokeTask({ agentType, prompt })` and receive the
   subagent's result — without the runner needing to yield + resume
   — B2 becomes a near-drop-in replacement for the subprocess
   adapter. The adapter contract stays; only the invocation
   primitive changes. Evidence: Claude Code plugin SDK docs naming a
   Task-invocation API, or empirical verification that such a hook
   exists.
2. **Runner gains pause/resume capability for other reasons.**
   A future slice makes the runner durable (persists its continuation
   state, re-enters from outside) for reasons unrelated to adapter
   invocation — e.g., long-running reviews, operator-approval
   interrupts, multi-day migrations. Once the pause/resume surface
   exists, B2 is ~"plug the Task tool invocation into the existing
   pause point" rather than building durability from scratch.
3. **Subprocess cost becomes dominant AND A is rejected.** If
   subprocess overhead is the bottleneck (Option A trigger #1) but
   the SDK-path four-ground analysis still fails, B2 becomes the
   alternative answer. This is the path where the subprocess
   invocation truly is the bottleneck and neither "stay subprocess"
   nor "switch to SDK" is right.
4. **Composition with native agents becomes the feature.** A
   future workflow-kind genuinely wants to invoke operator-authored
   subagents by name (e.g., `Plan`, `Explore`, `claude-code-guide`)
   and get their native results. Subprocess invocation of `claude -p`
   cannot reach those cleanly; B2 can.

**Forbidden reopen trigger:** "B2 is nicer" without one of (1)-(4).
The architectural lift is real; the bar is a named forcing function.

#### 3.c Option C — CLI subprocess pooling

**What it is.** Instead of spawning a fresh subprocess per dispatch,
the adapter module maintains a pool of long-lived `claude -p` (or
`codex exec`) subprocesses with persistent stdin/stdout pipes, and
multiplexes dispatches across the pool. Amortizes subprocess startup
cost across many dispatches.

**Prerequisite (Codex Slice 41 LOW 3 fold-in).** Pooling assumes
the underlying CLI exposes a stable multi-request protocol over
persistent stdin/stdout — i.e., the CLI can accept a second prompt
on the same open subprocess and emit a second response without
teardown. If `claude -p` and `codex exec` are single-shot-only
(accept one prompt, emit one response, exit), "pooling" is not a
performance optimization over Option's baseline; it is a different
option that depends on first establishing a multi-request CLI
protocol. The prerequisite itself becomes a reopen trigger if the
CLI adds multi-request support after v0.

**Why deferred, not rejected.** Pooling (given the prerequisite)
is a performance optimization over the v0 subprocess pattern, not
a different architecture. It preserves the adapter contract and
the event schema. It becomes worth building when subprocess startup
is a measurable bottleneck AND the multi-request CLI protocol
exists.

**Reopen triggers (any of):**

1. **Subprocess startup cost dominates.** Same threshold as Option
   A trigger #1 (>20% per-dispatch wall-clock in subprocess
   startup/teardown), but the chosen fix is pooling rather than SDK.
2. **Multiple concurrent dispatches become common.** A workflow-
   kind lands that runs ≥3 dispatch steps in parallel (e.g., tournament
   rigor from ADR-0001). Per-dispatch subprocess overhead
   compounds; pooling recovers the cost.

**Forbidden reopen trigger:** "pooling is a nice optimization"
without wall-clock evidence.

#### 3.d Option D — Streaming token integration via event-schema widening

**What it is.** Widen the dispatch event schema (Slice 37
transcript) with a streaming-chunk variant, pipe subprocess stdout
line-by-line into chunk events as the model emits, enable live UI
updates during dispatch.

**Why deferred, not rejected.** Streaming is a UX feature; v0
ships with `run-to-completion` dispatch (full stdout captured at
subprocess exit). Streaming becomes worth building when a user-
facing UI wants live dispatch visibility.

**Reopen triggers (any of):**

1. **Plugin gains a live-UI surface.** A UI shell (e.g., a web
   dashboard, a TUI, an IDE extension) needs live dispatch
   visibility for operator ergonomics.
2. **Long-dispatch visibility becomes a debugging need.**
   Operator feedback: "I cannot tell if a dispatch is progressing or
   stuck." Streaming tokens into events would show progress.

**Forbidden reopen trigger:** "streaming is modern" without a UX
forcing function.

### 4. Invocation-pattern discipline audit (Check 28)

**What it enforces.** `scripts/audit.mjs` Check 28
`checkAdapterInvocationDiscipline` fails red if root `package.json`
`dependencies`, `devDependencies`, `optionalDependencies`, or
`peerDependencies` contains any identifier in the `FORBIDDEN_ADAPTER_
SDK_DEPS` forbidden list for v0.

The list has two parts:

**Part A — Direct vendor SDKs (v0 pre-fold-in):**

```
'@anthropic-ai/sdk'          — Anthropic JS SDK
'@anthropic-ai/tokenizer'    — Anthropic tokenizer (banned for vendor
                                dep-surface growth parity with the SDK;
                                a future slice using just tokenization
                                still commits to the vendor dep-surface
                                treadmill per §Hard invariant #7)
'@anthropic-ai/bedrock-sdk'  — AWS Bedrock-hosted Anthropic SDK
'@anthropic-ai/vertex-sdk'   — GCP Vertex-hosted Anthropic SDK
'openai'                     — OpenAI JS SDK
'@openai/realtime-api-beta'  — OpenAI realtime API
'@google/genai'              — Google Gemini SDK (new name)
'@google/generative-ai'      — Google Gemini SDK (old name)
```

**Part B — Wrapper/provider SDKs (Codex Slice 41 HIGH 2 fold-in,
2026-04-21):**

```
'ai'                         — Vercel AI SDK (generateText/streamText/
                                etc.; in-process dispatch against the
                                vendor APIs without invoking the CLI)
'@ai-sdk/anthropic'          — Vercel AI SDK Anthropic provider binding
'@ai-sdk/openai'             — Vercel AI SDK OpenAI provider binding
'@ai-sdk/google'             — Vercel AI SDK Google provider binding
'@langchain/anthropic'       — LangChain Anthropic binding
'@langchain/openai'          — LangChain OpenAI binding
'@langchain/google-genai'    — LangChain Google binding
```

Rationale for Part B: a future slice could route built-in adapters
through a wrapper SDK (e.g., `import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';`) and reach the vendor
APIs in-process without any direct-vendor-SDK appearing in deps,
circumventing Part A. The eight direct-vendor names are not enough
on their own; the wrapper names close that bypass.

The combined list is extensible at ADR-0009 reopen via Options A /
B2 / C / D above; an out-of-band addition (not via ADR-0009 reopen)
to the forbidden list is also allowed when a new bypass surface is
discovered (§6 reopen trigger 5 below).

**What it does not enforce (scope disclosure).** Check 28 is a
*root-`package.json`-only dep-level guardrail*. It does not scan:

- Lockfile packages (`package-lock.json`, `pnpm-lock.yaml`) — a
  transitively-installed forbidden SDK could still be imported.
- Nested workspace manifests (this repo is single-package at v0, so
  the scope is currently exhaustive; a future workspaces conversion
  would need to extend the scan).
- Import sites under `src/runtime/adapters/**`.

The import-level scan over `src/runtime/adapters/**` is **mandatory
at Slice 42** (P2.4 — first adapter-code slice): when the first
adapter file lands, the slice must also land an import-level check
that rejects any `import { ... } from '<forbidden>'` statement under
`src/runtime/adapters/**`. This is not deferrable; it is the
complement to the dep-level check and closes the
transitive-install bypass.

**Vacuity at Slice 41.** At Slice 41 landing time, no adapter files
exist yet; the check fires against the current `package.json` which
has only `zod` as a dep. The check passes because none of the
forbidden identifiers are present. At Slice 42 (P2.4), the first
adapter file lands along with the mandatory import-level scan; the
combined check remains green and gains empirical meaning.

**Terminology note (Codex Slice 41 LOW 1 fold-in).** This list is a
**forbidden list** (deny-list), not an allowlist. Early drafts of
this ADR used "allowlist" colloquially; the correct terminology is
forbidden list.

### 5. Non-precedent clause

The precedent-firewall posture of this ADR is split per the
ADR-0008 §6 template.

**Allowed citations.** A future ADR deciding invocation pattern
for a different adapter kind or invocation surface MAY cite ADR-0009
for:

- The **four-ground analysis frame** in §2 (existing schema surface
  / single transcript path / no-new-dep-surface / product-constraint
  binding). Citation form: "the four-ground analysis from ADR-0009
  §2 is applied here to [adapter invocation decision]." The citing
  ADR produces its own answers.
- The **deferred-options-with-reopen-triggers pattern** in §3.
  Citation form: "the deferred-options pattern from ADR-0009 §3 is
  reused here." The citing ADR enumerates its own options, each with
  a named reopen trigger.
- The **forbidden-SDK-dep audit pattern** in §4 (Check 28). Citation
  form: "the Check 28 forbidden-dep pattern from ADR-0009 §4 extends
  to [new forbidden dep]." The citing ADR adds the new entry to the
  allowlist with its own rationale.

**Forbidden citations.** A future ADR MUST NOT cite ADR-0009 for:

- The **specific answer for v0** — subprocess-per-adapter over SDK.
  Citation forms explicitly rejected: "the ADR-0009 pattern applies
  here," "extending ADR-0009's subprocess choice," "subprocess per
  ADR-0009." The four-ground analysis produced subprocess for v0
  because the current schema, transcript, dep surface, and product
  constraint pointed that way; a future adapter with different
  constraints (e.g., a local-model adapter where the subprocess CLI
  wrapper does not exist, or an embeddings adapter where SDK is the
  only practical path) may reach Option A or B2 or a new option. The
  conclusion is not precedent.
- The **non-precedent clause itself as a template for not writing a
  non-precedent clause**. Every adapter-invocation ADR authors its
  own non-precedent clause with its own allowed/forbidden split.

**Enforcement.** Prose-level at v0.1. A future slice MAY add an
audit check over new ADRs for forbidden citation phrases; until
then, enforced at challenger-pass review time per CLAUDE.md
§Cross-model challenger protocol.

### 6. Reopen conditions for this ADR

This ADR is reopened if any of:

1. **Any deferred option triggers.** Options A, B2, C, or D in §3
   above each carry their own reopen triggers; activation of any
   one reopens this ADR for the relevant surface.
2. **CC#P2-2 amendment.** If ADR-0007 CC#P2-2 (real-agent dispatch
   transcript) is amended to change the target model or the
   transcript semantics, the invocation-pattern binding is re-
   evaluated.
3. **Custom adapter schema amendment.** If
   `src/schemas/adapter.ts` `CustomAdapterDescriptor` is amended to
   permit a non-argv invocation shape (e.g., a callable descriptor,
   a URL descriptor, an MCP-server descriptor), the built-in vs
   custom symmetry argument in §2.i weakens and this ADR is
   re-examined.
4. **Forbidden citation detected in a future ADR.** Following the
   ADR-0008 §5 trigger #7 pattern: if a future ADR cites ADR-0009
   using any of the §5 forbidden forms, this ADR is re-opened at the
   challenger-pass review time for that future ADR to decide whether
   the forbidden citation reflects drift in the non-precedent clause
   (clause needs tightening) or a challenger-pass failure (future
   ADR needs revision).
5. **CLI contract failure — headless mode cannot enforce no-write
   capability boundary (Codex Slice 41 HIGH 4 + MED 4 fold-in).** If
   empirical investigation (at P2.4 / Slice 42 or earlier) shows that
   `claude -p` or its equivalent headless invocation cannot be
   configured to disable write-capable tools per the §2.v capability-
   boundary requirement — e.g., the CLI inherits write-capable tools
   unconditionally, the `--allowed-tools` flag (if any) does not
   restrict writes, or the subprocess-level mechanism to block writes
   is unreliable — this ADR reopens BEFORE the P2.4 subprocess
   implementation can land. Option A (SDK direct, where capability
   shaping is API-level and precise) OR Option B2 (native Task tool,
   where capability shaping flows through the Claude Code plugin
   runtime) may become materially safer than subprocess at that point.
6. **Forbidden-dep bypass discovery (Codex Slice 41 MED 4 fold-in).**
   If a future session (or the Slice 42 import-level scan — see §4
   Slice 42 binding) discovers a wrapper/provider SDK identifier that
   routes dispatches around the subprocess decision but is NOT in
   `FORBIDDEN_ADAPTER_SDK_DEPS`, this ADR reopens at the time the
   identifier is discovered. The fold-in is: extend the forbidden list,
   update §4's Part A/Part B lists, and add a regression test. An
   amendment commit (not a full ADR rewrite) is sufficient provided
   the bypass is structurally analogous to Part B entries; otherwise
   a full reopen via Option A / B2 / C / D is required.
7. **Auth/session incompatibility with the CLI path (Codex Slice 41
   MED 4 fold-in).** If a future Claude Code release changes the
   headless-mode auth/session model in a way that breaks the parent-
   session inheritance assumption (e.g., print mode requires explicit
   re-auth, or subprocess invocation is blocked entirely from within
   a plugin execution context), this ADR reopens.

## Rationale (condensed)

The operator's 2026-04-21 product decision ("Claude Code out-of-box,
no Codex required") combined with the structural observation that
`claude` CLI is present by construction (circuit-next *is* a Claude
Code plugin) collapses the SDK-path cost/benefit: an SDK dep costs
credential-path branching, billing fragmentation, dep-surface growth,
and a second Anthropic path — and buys nothing the CLI does not
already provide. The four-ground analysis in §2 holds the decision
at the schema, transcript, dep, and product-constraint surfaces
simultaneously. The deferred-options section records the four
futures under which the decision should be revisited, each with a
named forcing function so "we never capture these possibilities" is
impossible by construction.

## What changes

### 1. `specs/plans/phase-2-implementation.md §P2.4`

Amend §Alternate framing: replace "same-process simpler than
cross-process" rationale (SDK-flavored) with "baseline dispatcher
must work without optional adapters installed; `claude` CLI present
by construction; subprocess pattern consistent with `/codex`
wrapper precedent" rationale. Add "Authority: ADR-0009" line.

### 2. `scripts/audit.mjs` — new Check 28 `checkAdapterInvocationDiscipline`

Implements the forbidden-SDK-dep check per §4. Binds to the
`FORBIDDEN_ADAPTER_SDK_DEPS` constant. Outputs the live-repo match
list (currently empty) and passes/fails accordingly. Export named so
`scripts/audit.d.mts` can type-declare it.

### 3. `tests/contracts/adapter-invocation-discipline.test.ts`

New contract test file. Tests:

- Happy path: current `package.json` has no forbidden deps; check
  passes green with match list `[]`.
- Negative: synthetic `package.json` with `@anthropic-ai/sdk` in
  `dependencies` fires red.
- Negative: synthetic `package.json` with `openai` in
  `devDependencies` fires red.
- Negative: synthetic `package.json` with `@google/genai` in
  `optionalDependencies` fires red.
- Structural: the forbidden list has length ≥1 and every entry is
  a non-empty string matching a recognized npm identifier pattern.
- Regression guard (live-repo): running the check against the
  current repo's `package.json` must pass green — this pins the
  v0 state so a future slice cannot silently add a forbidden dep.

### 4. `specs/reviews/adversarial-yield-ledger.md`

Append a row for Slice 41: class=governance, rigor_profile=standard,
status=accept-with-fold-ins-pending-codex.

### 5. `specs/ratchet-floor.json`

Advance floor 835 → 841 (+6 new contract tests per §3 above).
`last_advanced_in_slice: "41"`.

### 6. `tests/contracts/status-epoch-ratchet-floor.test.ts`

Live pin `'40'` → `'41'` per §Hard invariants #6 precedent.

### 7. `PROJECT_STATE.md` / `README.md` / `TIER.md`

Advance `current_slice=40` → `current_slice=41`; append Slice 41
block per slice-landing convention; plain-English summary per
CLAUDE.md §After-slice operator summary.

### 8. `specs/reviews/arc-slice-41-adapter-invocation-pattern-codex.md`

Codex challenger pass review file. Frontmatter per the existing
review-file pattern. The challenger prompt MUST inspect the
subprocess-vs-SDK decision, the deferred-options-with-reopen-
triggers structure, and the Check 28 forbidden-list completeness.

## Consequences

### Accepted

- v0 built-in adapters invoke subprocesses. Subprocess startup cost
  per dispatch is accepted as the v0 performance posture.
- Check 28 landing empty-match at Slice 41 means the check is
  vacuous at this slice; it gains empirical meaning at Slice 42
  when the first adapter file lands. The Slice 41 value is
  governance-side: future slices cannot silently add a forbidden
  dep without tripping the check.
- The ADR's non-precedent clause makes "subprocess" non-transferable
  to future adapter kinds without fresh analysis — this is a cost
  relative to "just always prefer subprocess." The cost is accepted
  because adapter kinds differ (a local-model adapter, an
  embeddings adapter, a hosted-MCP adapter each face different
  constraints).

### Enabling

- P2.4 (Slice 42) opens cleanly against a decided invocation
  pattern: the deliverable is "spawn `claude` subprocess with
  appropriate prompt materials, capture stdout, hash into
  `dispatch.result`, materialize into `dispatch.artifact` per
  ADR-0008 §Decision.3a."
- The `/codex` wrapper (authoritative per `CLAUDE.md:173-179`
  §Cross-model challenger protocol) becomes the explicitly-blessed
  reference implementation of the subprocess pattern; a future
  `codex` built-in adapter at Slice ~43+ can structurally mirror
  the `codex exec` subprocess invocation this repo already exercises
  on every Codex challenger pass.
- The deferred-options section gives future sessions named paths
  back to SDK / B2 / pooling / streaming without needing to
  rediscover the forcing functions.

### Deferred / Not changed

- Anthropic SDK integration: not attempted at v0. Option A reopen
  triggers named.
- Runner pause/resume capability: not built at v0. Option B2 reopen
  triggers named.
- Subprocess pooling: not built at v0. Option C reopen triggers
  named.
- Streaming integration: not built at v0. Option D reopen triggers
  named.
- Import-level SDK-ban scan over `src/runtime/adapters/**`: deferred
  to Slice 42 (the first slice with adapter source files).

## Provenance

- Operator decision 2026-04-21 (conversation log, Slice 41 opening):
  "Claude Code out-of-box, no Codex required" — product-constraint
  binding for §2.iv.
- Operator request 2026-04-21 (same conversation): "We should make
  a note of future possibilities like B2 so we don't forget them."
  This ADR's §3 (deferred options with reopen triggers) is the
  response.
- Pre-P2.4 arc close at Slice 40 (`ebb797b`, 2026-04-21): two-prong
  composition review both ACCEPT-WITH-FOLD-INS; HIGH 3 capability
  boundary amended into P2.4 plan; SDK-vs-CLI question left open
  — this ADR closes that open.
- Reference implementation: `~/Code/circuit` — read-only prior art;
  subprocess-per-adapter pattern established there and ported here.
- `/codex` wrapper authoritative at `CLAUDE.md:173-179`
  §Cross-model challenger protocol ("pipes to `codex exec` via the
  shared wrapper script"): the already-worked subprocess-adapter
  example this ADR generalizes. Exercised on every Codex challenger
  pass recorded under `specs/reviews/*-codex.md` (32+ passes to date).

## References

- CLAUDE.md §Hard invariants #5 (ADR required for contract relaxation),
  #6 (cross-model challenger on ratchet change), #7 (external-package
  identifiers backed by type stubs), #8 (no aggregate scoring).
- ADR-0007 (Phase 2 close criteria; CC#P2-2 real-agent dispatch).
- ADR-0008 (dispatch granularity modeling; this ADR inherits §2
  four-ground frame and §6 non-precedent clause template).
- `src/schemas/adapter.ts` (ResolvedAdapter + CustomAdapterDescriptor —
  the schema surface this ADR's decision binds to).
- `src/schemas/event.ts` (the five-variant dispatch transcript from
  Slice 37 — §2.ii congruence argument).
- `src/runtime/runner.ts:210-251` (current dry-run dispatch stub;
  P2.4 replaces the stub path for the `agent` adapter).
- `specs/plans/phase-2-implementation.md §P2.4` (the slice this ADR
  amends for Alternate framing text).

## Lane and ratchet declaration (for the ceremony slice landing this ADR)

**Slice 41.** Lane: **Ratchet-Advance** (modeling-authority ratchet
+ audit-coverage ratchet + contract-test ratchet). Trajectory: this
slice serves the one-workflow-parity arc by closing the invocation-
pattern question before P2.4 (Slice 42) opens against it. No earlier
slice makes this smaller — the question arose at P2.4 framing time
when plan prose ambiguity collided with operator product direction.
Failure mode addressed: without ADR-0009, P2.4 picks invocation
pattern under implementation pressure (smuggled architecture) or
defaults to SDK via literal reading of plan prose. Acceptance
evidence: this ADR ACCEPTED post-Codex-fold-in; P2.4 plan text
amended; Check 28 green; 6 new contract tests; ratchet floor 835 →
841; audit 26 green / 0 red (Check 27 adds to the total; Check 28
becomes Check 28). Alternate framing: fold the ADR into P2.4 itself
(one bigger slice). Rejected because ADR needs its own Codex
challenger pass (governance ratchet per §Hard invariants #6) and
combining would couple ADR objections to implementation rollback.
