---
adr: 0007
title: Phase 2 Close Criteria — Locked Governance, Independent Ratchets, Container Isolation Re-Deferral
status: Accepted
date: 2026-04-21
author: claude-opus-4-7 (drafted + fold-ins incorporated) + gpt-5-codex (challenger, 7 HIGH / 5 MED / 1 LOW / 1 META folded in)
supersedes: none
related:
  - ADR-0001 Addendum B (§Phase 1.5 → Phase 2 transition; authority surface this ADR operates under)
  - ADR-0006 (historical-context-only for CC#14 retarget; ADR-0006 §5 clause 7 forbids citing ADR-0006 as precedent — ADR-0007 therefore re-authenticates its own basis and is NOT analogous or derivative of ADR-0006)
  - specs/plans/phase-2-implementation.md §Phase 2 close criteria (draft list this ADR locks)
amends:
  - specs/plans/phase-2-implementation.md §Phase 2 close criteria — status "draft — candidate, not locked" → locked by this ADR
  - CLAUDE.md §Phase discipline — "Phase 2 — Implementation. … Implementer runs in a container with distinct UID" — amended at the close-criterion layer only by CC#P2-7 re-deferral §Decision.1 CC#P2-7; the CLAUDE.md sentence remains policy-level authoritative (see §Decision.1 CC#P2-7 and §Consequences.Accepted for the explicit weakening disclosure)
---

# ADR-0007 — Phase 2 Close Criteria (Governance)

## Context

Phase 1.5 Alpha Proof closed at Slice 31a (ceremony commit `0223d11`,
Phase 1.5 → Phase 2 transition per ADR-0001 Addendum B as amended by
ADR-0006). Phase 2 — Implementation — is now open.

`specs/plans/phase-2-implementation.md` (commit `58b53a5`, amended at
`3bf4868`) enumerated **eight candidate Phase 2 close criteria** under
its §Phase 2 close criteria section, explicitly marked **draft —
candidate, not locked**. The plan further stipulated: *"They are
authored here for ranging purposes and must be locked via an ADR before
any slice claims one of them."* That ADR is this one.

Locking close criteria in governance before any code slice can cite
them protects the arc. Without a locked anchor, any near-term slice
(P2.2 plugin surface, P2.3 `explore` contract, P2.4 `agent` adapter,
P2.5 end-to-end fixture) would either invent its own partial close
definition or drift — producing the failure mode where Phase 2 "closes"
on vibes rather than on pre-specified, independently-trackable gates.

The criteria themselves (see §Decision.1 below) are lifted from the
plan's draft list; this ADR's job is to make them authoritative, bind
each to a concrete executable enforcement mechanism (named test file,
named audit function, named artifact paths — not merely slice names),
state the no-aggregate-scoring rule inline, resolve plan Open Question
#3 (container isolation) by re-deferral with named trigger conditions,
resolve plan Open Question #5 (`explore` spine policy) by aligning
CC#P2-6 with the plan's P2.3 deliverable, and install a §Precedent
firewall (§6) that prevents ADR-0007 from being cited as permission
for any future retarget, relaxation, or substitution of a close
criterion.

**Relationship to ADR-0006 (read carefully).** ADR-0006 §5 clause 7
forbids citing ADR-0006 as precedent for future retargets of phase-
close criteria. ADR-0007 therefore does **not** cite ADR-0006 as
precedent, pattern, template, or analogy in any permission-granting
way. ADR-0006 appears in this document only as (i) historical
Phase-1.5-close authority under §References, and (ii) a negative
constraint under ADR-0006 §5 clause 7 that ADR-0007 explicitly honors.
ADR-0007's §6 Precedent firewall is authored independently from first
principles, not derivatively from ADR-0006 §5.

**This ADR is a governance ratchet, not a product claim.** Locking the
close criteria does not move Phase 2 closer to done; it defines what
*done* means so that subsequent slices can make real progress against a
fixed target.

## Decision

### 1. The eight Phase 2 close criteria — locked with concrete enforcement bindings

Phase 2 — Implementation is considered closed when and only when **all
active** criteria below are **satisfied** and **all re-deferred
criteria** carry a valid ADR-covered trigger-condition set. Each
criterion is tracked as a separate dimension; no aggregate score is
computed across them (see §Decision.3). Status values per criterion
are exactly one of:

- `active — red` (enforcement binding fails)
- `active — satisfied` (enforcement binding passes, evidence on-file)
- `re-deferred` (not required for Phase 2 close per this ADR; trigger
  conditions in force)

**There is no `green-by-redeferral` status.** A re-deferred criterion
is neither green nor red; it is `re-deferred`. Any summary, dashboard,
or review that treats a re-deferred criterion as green is rejected on
§6 Precedent firewall grounds (see §Decision.3).

---

**CC#P2-1 — One-workflow parity.**

The target workflow locked in `specs/plans/phase-2-implementation.md`
§Target workflow for first parity (as of this ADR: **`explore`**) runs
end-to-end in circuit-next with real agent dispatch and produces the
same artifact shape as the corresponding reference Circuit workflow at
`~/Code/circuit`.

- **Enforcement binding (executable):**
  - Test file: `tests/runner/explore-e2e-parity.test.ts` (to be
    authored at P2.5; exact filename may be refined, but the test
    must exist and must exercise the full-spine explore fixture
    through the runtime boundary using the `agent` adapter).
  - Golden artifacts: `tests/fixtures/golden/explore/` (committed at
    P2.5; sha256 of normalized-JSON result artifacts; per plan Open
    Question #4).
  - Contract: `specs/contracts/explore.md` (authored at P2.3).
  - Fixture: `.claude-plugin/skills/explore/circuit.json` (authored at
    P2.3, extended at P2.5).
- **Non-substitutable failure conditions:** byte-shape parity with the
  reference Circuit `explore` artifact on at least one canonical
  phase transition; failing the golden assertion must fail CC#P2-1.
- **Retarget rule:** if the target workflow is reselected (plan permits
  `review` as a scope-reducing fallback), this ADR is amended in place
  via the retarget checklist at §Decision.4b. Silent rename in the
  plan is rejected on §6 grounds.

**Amendment — Slice 44 arc-close (placeholder-parity epoch disclosure,
convergent Claude HIGH 2 + Codex HIGH 2).** CC#P2-1 at Slice 43c
landing is measured by a sha256 over the `explore` fixture's close-
step placeholder body. The body is a deterministic function of
`step.gate.required` section names, written by
`src/runtime/runner.ts::writeSynthesisArtifact`; no real dispatch
output is consumed into the hashed artifact. The AGENT_SMOKE-gated
e2e test at `tests/runner/explore-e2e-parity.test.ts` does run real
dispatches via the `agent` subprocess adapter, and the
`dispatch.request` → `dispatch.result` five-event transcript lands
correctly for both `synthesize-step` and `review-step` — but the
*hashed* artifact is still the deterministic placeholder, not a
composition of dispatch outputs.

This makes CC#P2-1 v0.3-era satisfaction a **placeholder-parity**
claim rather than an **orchestrator-parity** claim. Both are valid
epochs of the same criterion; the Slice 43c golden catches drift in
the placeholder shape (which is itself a useful ratchet because a
future slice cannot silently change the placeholder body without
updating the golden). But the "reference Circuit `explore` artifact"
comparison the original non-substitutable-failure-condition names is
NOT what the v0.3 golden measures.

**Re-bound at P2.10.** When `writeSynthesisArtifact` is replaced by
real orchestrator output (P2.10 artifact schema set + orchestrator-
synthesis integration per plan §P2.10 / §Mid-term slices), the
CC#P2-1 golden MUST be regenerated from the new orchestrator's
output via `AGENT_SMOKE=1 UPDATE_GOLDEN=1 npx vitest run
tests/runner/explore-e2e-parity.test.ts`. A fresh composition review
MUST verify the new golden is substantively orchestrator-parity
rather than placeholder-parity. Until P2.10 lands, CC#P2-1 is
**closed at placeholder-parity** with this amendment naming the
epoch explicitly.

**Reopen trigger.** P2.10 landing without CC#P2-1 golden
regeneration + a fresh composition review MUST reopen this ADR to
re-evaluate whether placeholder-parity still satisfies the close
criterion (it does not; re-bind).

---

**CC#P2-2 — Real agent dispatch.**

At least one non-dry-run adapter (`agent` as a **headless `claude` CLI
subprocess** per ADR-0009 §1, or `codex` as a `codex exec` subprocess)
lands with a concrete request → receipt → result round-trip verified by
the runtime boundary (event-writer → reducer → result-writer) and
exercised by a fixture. ADR-0009 (Slice 41) amended this criterion: the
earlier "`agent` in-process Anthropic subagent or `codex` cross-process"
wording predated the invocation-pattern decision and described two
different invocation patterns (same-process for `agent`, subprocess for
`codex`). ADR-0009 §1 unified both built-ins onto subprocess-per-adapter;
this clause is updated to match. The earlier phrasing is preserved only
in historical prose (ADR-0007 §Provenance / commit history); authority
here is the subprocess wording above.

- **Enforcement binding (executable):**
  - Adapter file: `src/runtime/adapters/agent.ts` (or sibling for
    `codex`-first flip per plan Open Question #2).
  - Test file: `tests/runner/agent-dispatch-roundtrip.test.ts` (to be
    authored at P2.4; must assert on a durable dispatch transcript,
    not byte-shape of a single output).
  - **Durable dispatch transcript requirement (non-substitutable):**
    the test must verify the event log contains, in order, a
    `dispatch.started` event whose `adapter.name` is the real
    adapter id (field resolves via the `ResolvedAdapter`
    discriminated union at `src/schemas/adapter.ts`; the earlier
    prose "resolved_adapter.name" predated the schema and is
    corrected in §Amendment (Slice 37)), a `dispatch.request` with
    a non-empty request payload hash, a `dispatch.receipt` with a
    receipt id, and a `dispatch.result` with a result artifact
    hash. The reducer must have consumed that sequence and the
    result-writer must have produced the result artifact. A mock
    adapter returning a fixed byte string cannot satisfy this test
    even if the byte-shape matches.
  - **CI skip semantics:** if the agent smoke path is CI-skipped via
    `AGENT_SMOKE=0`, the ADR-0007 close claim requires a local smoke
    artifact at `tests/fixtures/agent-smoke/last-run.json` with:
    timestamp, commit SHA of the smoke run, adapter id, request/
    receipt/result hash triple, and a manifest signature. An audit
    check at Phase 2 close verifies that this artifact's commit SHA
    is an ancestor of HEAD.
- **Binding:** `dispatch_realness` product ratchet (plan §Product
  ratchets Phase 2 will carry) advances to `active — satisfied` when
  the test above passes on a non-CI-skip invocation and the local
  smoke artifact is on-file.

- **§Amendment (Slice 37, pre-P2.4 fold-in, 2026-04-21) — Event
  schema binding tightened; governance surface unchanged.**

  The durable dispatch transcript requirement above names four event
  kinds: `dispatch.started`, `dispatch.request`, `dispatch.receipt`,
  `dispatch.result`. At the time CC#P2-2 was ratified, only
  `dispatch.started` and `dispatch.completed` existed in
  `src/schemas/event.ts`; the other three were named in prose but had
  no type-level binding. The composition review (`specs/reviews/
  p2-foundation-composition-review.md` §HIGH 2) found this
  governance-vs-runtime incoherence: the P2.4 round-trip test could
  have written an event log that satisfied the CC#P2-2 prose while
  using a schema union that rejected the very events CC#P2-2 required.

  This Amendment widens the event schema to carry the three missing
  variants and tightens the CC#P2-2 binding to name them by schema
  location. **The close criterion itself is not relaxed or narrowed —
  widen-over-weaken was the operator's chosen resolution path (§HIGH 2
  alternate framing (a), recorded in `specs/plans/phase-2-foundation-
  foldins.md` Slice 37).**

  **Schema binding (new, replaces prose-only reference above):** the
  durable dispatch transcript is the five-event sequence on a single
  `(step_id, attempt)` pair, each variant defined at:
  - `dispatch.started` — `src/schemas/event.ts` (`DispatchStartedEvent`,
    pre-existing).
  - `dispatch.request` — `src/schemas/event.ts` (`DispatchRequestEvent`,
    added Slice 37); carries `request_payload_hash` (SHA-256 of
    request bytes, 64-char lowercase hex via `ContentHash`).
  - `dispatch.receipt` — `src/schemas/event.ts` (`DispatchReceiptEvent`,
    added Slice 37); carries `receipt_id` (opaque, adapter-chosen
    format, `z.string().min(1)`).
  - `dispatch.result` — `src/schemas/event.ts` (`DispatchResultEvent`,
    added Slice 37); carries `result_artifact_hash` (SHA-256 of result
    artifact bytes, 64-char lowercase hex via `ContentHash`).
  - `dispatch.completed` — `src/schemas/event.ts`
    (`DispatchCompletedEvent`, pre-existing); carries `result_path`
    and `receipt_path`.

  All three new variants are `.strict()` and registered in the `Event`
  discriminated union at the `Event` declaration in
  `src/schemas/event.ts`. The log-level ordering invariant lives at
  `run.prop.dispatch_event_pairing` in `specs/contracts/run.md` and
  governs their canonical ordering when present; the CC#P2-2 test
  above obligates all three to *be* present for a non-dry-run adapter
  (the contract widens the schema; this criterion obligates the
  writer).

  **Why this is an Amendment, not a silent edit.** Per CLAUDE.md §Hard
  invariants #5, an ADR is required for any relaxation of a contract,
  ratchet floor, or gate. Widening is the opposite of relaxation but
  the same governance surface applies (the CC#P2-2 enforcement binding
  names executable artifacts; changing those artifacts must be
  recorded). Per §Cross-model challenger protocol this Amendment was
  dispatched through `/codex` for an objection list before landing;
  record at `specs/reviews/arc-slice-37-high-2-widen-event-schema-
  codex.md` (co-commit artifact).

  **What did not change.** The *realness criterion* (non-substitutable
  evidence of a real adapter round-trip), the `dispatch_realness`
  ratchet advancement rule, the CI-skip semantics, and the Phase 2
  close condition are unchanged; the Amendment only tightens the
  *executable binding* — i.e. "what event kinds does
  `src/schemas/event.ts` define, and at what field paths are they
  inspected." Specifically, the Amendment widens the prose-only
  4-kind reference (`dispatch.started` + the three hash/id bearing
  events) to a 5-event schema-bound sequence that includes
  `dispatch.completed` as the terminal event. No relaxation occurs:
  the test must still assert the presence of all hash/id evidence,
  and a mock adapter emitting only `dispatch.started` +
  `dispatch.completed` still fails CC#P2-2 because the intervening
  transcript events are required (at the adapter-level
  Enforcement binding above) even though they are optional at the
  schema level (dry-run path).

  **Adapter-field path correction (Codex HIGH #1 fold-in).** The
  Enforcement binding above earlier read "`resolved_adapter.name`";
  no such field exists on `DispatchStartedEvent`. The correct schema
  path is `adapter.name` via the `ResolvedAdapter` discriminated
  union (`src/schemas/adapter.ts`). The Enforcement binding text is
  now corrected in-place; `specs/plans/phase-2-implementation.md`
  §P2.4 corrected in the same slice. This was a stale prose
  reference, not a schema change — the schema has always carried
  `DispatchStartedEvent.adapter: ResolvedAdapter` since ADAPTER-I7
  (Slice 26). Without this correction P2.4 would have asserted on a
  field that does not exist, recreating the governance/runtime
  mismatch HIGH 2 is meant to close.

---

**CC#P2-3 — Plugin command registration.**

`/circuit:<workflow>` slash commands exposed via `.claude-plugin/`,
invokable in Claude Code (not merely manifest/markdown closure), with
the plugin manifest (`.claude-plugin/plugin.json`) carrying a command
block whose entries are closure-consistent with the markdown files
under `.claude-plugin/commands/`.

- **Enforcement binding (executable):**
  - Audit check: `checkPluginCommandClosure` (function name in
    `scripts/audit.mjs`; number assigned at implementation time using
    the next-available-slot rule at §Decision.7). Verifies:
    - `plugin.json` `commands` array entries each correspond to an
      existing `.claude-plugin/commands/*.md` file.
    - Each `commands/*.md` file has a non-empty `description` and
      body.
    - At least one command entry for the target workflow (currently
      `/circuit:explore`) and one for the router (`/circuit:run`)
      exists.
  - **Claude Code invokability binding (non-substitutable):** a
    contract test under `tests/contracts/plugin-surface.test.ts` (to
    be authored at P2.2) parses `.claude-plugin/plugin.json` with the
    plugin-manifest schema and asserts the workflow command is
    registered; additionally, a manual-invokability check note lives
    in the P2.11 slice evidence (a recorded invocation of the
    `/circuit:<workflow>` command inside Claude Code with a transcript
    or screenshot, committed under `specs/reviews/p2-11-invoke-
    evidence.md`). Closure alone is insufficient.
- **Binding:** `plugin_surface_present` product ratchet advances to
  `active — partial` after P2.2 and `active — satisfied` after P2.11.

---

**CC#P2-4 — Session hooks.**

SessionStart continuity resume + SessionEnd handoff wired through
`.claude/hooks/` to `circuit-engine`, matching the behavior reference
Circuit already exhibits (pending-continuity pickup, stark HANDOFF
banner at stopping points per operator feedback memory), **plus**
continuity-record lifecycle proven end-to-end (create → persist →
resume on next session → clear on `done`).

- **Enforcement binding (executable):**
  - Hook scripts: `.claude/hooks/SessionStart.sh` and
    `.claude/hooks/SessionEnd.sh` shelling to
    `.circuit/bin/circuit-engine continuity`.
  - Audit check: `checkSessionHooksPresent` verifies both hook scripts
    exist, are executable, and shell to the circuit-engine helper.
  - Test file: `tests/runner/continuity-lifecycle.test.ts` (to be
    authored at P2.7) seeds a continuity record, simulates SessionEnd
    persistence, re-reads the record via the SessionStart resume path,
    simulates `done`, and asserts the record is cleared. Must assert
    on the pending-continuity banner content (operator feedback memory
    requirement: stark HANDOFF SAVED / NOT SAVED at stopping points).
- **Binding:** continuity contract invariants in
  `specs/contracts/continuity.md` remain test-enforced through the new
  lifecycle test (not substituted).

**Close-state history (Slice 47b Codex cross-slice fold-in, 2026-04-22):**

Because CC#P2-4 was claimed-closed once and then reopened-and-reclosed,
future readers need a ledger that names the transitions explicitly.
Without it, a reader encountering ratchet-floor history or preserved
PROJECT_STATE entries can confuse the first claim with the substantive
close.

| Transition | Slice | Evidence state at that landing |
|---|---|---|
| First claim of close | Slice 46b | Presence + settings wiring at `.claude/hooks/SessionStart.sh` + `SessionEnd.sh`; engine-CLI lifecycle at `tests/runner/continuity-lifecycle.test.ts`. Neither surface *executed* the hook scripts; the hook-audit tests only asserted text presence. |
| Reopened — structurally hollow | Slice 47a Codex comprehensive review HIGH 2 | Reviewer named the close as "a regression that left the hooks invocable but emitted the wrong banner — or no banner — would not surface"; no test ran the hook scripts. |
| Reclosed — hook behavior | Slice 47b | Added `tests/runner/session-hook-behavior.test.ts` executing both hook scripts against a canned-JSON stub and asserting banner / tombstone content against the hook scripts' documented contract. |
| Reclosed — full lifecycle integration | Slice 47b Codex challenger HIGH 1 fold-in (this commit) | Added `tests/runner/session-hook-lifecycle.test.ts` driving `save` → `status` → `clear` through a persisting stub engine and asserting the banner reflects saved content + goes silent after clear. Added `tests/runner/hook-engine-contract.test.ts` pinning the argv + JSON-field contract between hooks and the engine CLI so stub drift does not silently mask hook regressions. |
| Clean-clone runtime distinction noted | Slice 47d Codex MED 2 fold-in | Clarifies the close posture: the CC#P2-4 evidence chain is "tracked hook scripts + portable stub coverage" (default `npm run verify` path), NOT "live clean-clone engine available." The hook scripts invoke `.circuit/bin/circuit-engine`, which is untracked (`.gitignore:16-20`); clean clones have the hook wiring but not the engine shim until an external plugin-install / population step creates it. The live-engine drift check at `tests/runner/hook-engine-contract.test.ts` under `CIRCUIT_HOOK_ENGINE_LIVE=1` remains the operator-local path to live-engine coverage. |
| Clean-clone portability closed for default verify + audit + CLI baseline | Slice 52 (Clean-Clone Reality Tranche — Codex H22 fold-in) | Slice 47d's ledger row *noted* that `tests/runner/continuity-lifecycle.test.ts` required the untracked shim, but the file itself still ran unconditionally against `.circuit/bin/circuit-engine`; verified at Slice 51 by hiding the shim and running the file (12/12 failures with `spawnSync ENOENT`). Slice 52 converts the file to `describe.skipIf(!liveGateEnabled)` with `liveGateEnabled = process.env.CIRCUIT_HOOK_ENGINE_LIVE === '1'` (same env surface `tests/runner/hook-engine-contract.test.ts:204` uses for its live-engine drift check). Default `npm run verify` skips the 12 integration assertions (portable); operator-local full coverage via `CIRCUIT_HOOK_ENGINE_LIVE=1 npm run verify`. Slice 52 also lands `scripts/clean-clone-smoke.sh` — a tracked operator-facing reproducibility artifact that exercises `npm ci` → `npm run verify` → `npm run audit` → `npm run circuit:run -- --help` against a `git clone --no-local --no-hardlinks` clean checkout with an `env -i` scrub that isolates HOME + npm config + npm cache to a smoke-local dir. Companion changes: `package.json` adds a `build` script using `tsconfig.build.json`, `circuit:run` binding swaps from `tsx src/cli/dogfood.ts` to `npm run build --silent && node dist/cli/dogfood.js` (Codex H11 fold-in — tsx's `/tmp/tsx-<uid>/*.pipe` EPERM reproduced operator-locally, not just in sandboxed agents), and `verify` chains `build` before `test` so compiled output is always current. **Narrow scope of "closed":** this row closes the `npm run verify` + `npm run audit` + `npm run circuit:run -- --help` baseline for clean clones. It does NOT close live SessionStart / SessionEnd hook execution on clean clones — `.claude/hooks/SessionStart.sh:41`, `.claude/hooks/SessionEnd.sh:46`, and `.claude/hooks/auto-handoff-guard.sh:43` still silently bail without the shim (existing Slice 47d posture; no regression, no advance). Operator path to live hook engine coverage remains "install the prior-gen Circuit plugin to populate `.circuit/plugin-root` + `.circuit/bin/circuit-engine`, then `CIRCUIT_HOOK_ENGINE_LIVE=1 npm run verify`". A later slice may land a tracked bootstrap/install step; at that point, a new row naming live-hook-engine portability as closed can advance this criterion further. |

The criterion text (above) did not change across these transitions —
only the evidence did. A future slice that modifies the CC#P2-4
binding text MUST amend this table (add a row) rather than rewrite
history.

---

**CC#P2-5 — P2-MODEL-EFFORT landed.**

Workflow contract v0.3 — explicit per-step `model` + `effort`
assignment — landed, with schema-parity tests and a named audit check
rejecting unknown-model-ids.

- **Enforcement binding (executable):**
  - Schema: `src/schemas/workflow.ts` v0.3 with per-step `model` and
    `effort` fields.
  - Test files: `tests/contracts/schema-parity.test.ts` extended for
    v0.3; plus `tests/contracts/workflow-model-effort.test.ts` (to be
    authored at P2-MODEL-EFFORT) exercising per-step assignment.
  - Audit check: `checkUnknownModelIds` verifies that every `model`
    string in every workflow fixture under `.claude-plugin/skills/*/
    circuit.json` is a known model id (enumerated in the workflow
    schema or a sibling registry file). Rejects unknown ids.
  - Slice spec: `specs/plans/phase-1-close-revised.md §Slice
    P2-MODEL-EFFORT` (incorporated by reference; not redefined here).

---

**CC#P2-6 — Spine policy coverage (aligned with plan P2.3).**

The target workflow's fixture declares and exercises the canonical
phase set its kind requires. For `explore`, the canonical set matches
the plan's P2.3 deliverable: **Frame → Analyze → Synthesize → Review →
Close** (five phases). This aligns with `specs/plans/phase-2-
implementation.md §P2.3 Deliverable` wording *"full-spine phases — at
minimum Frame → Analyze → Synthesize → Review → Close mapped to
canonical phase ids"* and resolves plan Open Question #5 to **full-
spine at Standard rigor**.

- **Enforcement binding (executable):**
  - Contract: `specs/contracts/explore.md` declares canonical phase
    set for `explore` as {Frame, Analyze, Synthesize, Review, Close}.
  - Fixture: `.claude-plugin/skills/explore/circuit.json` declares
    steps covering those five phases.
  - Audit check: `checkSpineCoverage` (reusable across workflows)
    verifies the fixture's declared phase set matches the canonical
    set for its workflow kind. Rejects missing phases.
  - Test file: `tests/contracts/spine-coverage.test.ts` (to be
    authored at P2.3) property-tests the spine-coverage check against
    fixtures with missing/extra/renamed phases.
- **Plan amendment note:** this ADR resolves plan Open Question #5 by
  adopting the full-spine option. The plan's Open Question #5 is
  amended to `RESOLVED 2026-04-21 via ADR-0007 CC#P2-6: full-spine
  Standard rigor`.

---

**CC#P2-7 — Container isolation — RE-DEFERRED (with explicit weakening disclosure).**

CLAUDE.md §Phase discipline §Phase 2 contains the sentence:
*"Implementer runs in a container with distinct UID; `specs/`,
`tests/properties/visible/`, `tests/mutation/`, `specs/behavioral/`, CI
configuration mounted read-only; `tests/properties/hidden/` not mounted
at all."* CLAUDE.md §Hard invariants #1–#4 restate the substance.

**ADR-0007 weakens Phase 2 close by accepting unisolated implementer
execution for Phase 2 close.** This is weaker than the CLAUDE.md
policy-level statement. The weakening is recorded openly here, not as
an appendix, and is surfaced in §Consequences.Accepted and in
PROJECT_STATE.md's P2.1 landing note.

**Scope of the weakening (narrow):**

- Only the *close-criterion layer* is weakened: Phase 2 may close
  without container isolation implemented.
- The policy-level statements (CLAUDE.md §Phase discipline §Phase 2
  sentence + Hard invariants #1–#4) remain load-bearing for any slice
  that claims to run under isolation or whose failure mode depends on
  isolation. A slice violating the policy statements without
  declaring re-deferral citation or Break-Glass lane is rejected by
  audit (see interim enforcement below).

**Rationale for re-deferral (independent of ADR-0006 precedent):**

- No current slice in the Phase 2 plan (P2.1–P2.11 + P2-MODEL-EFFORT)
  requires container isolation to land honestly. Each near-term slice
  (P2.1 governance; P2.2 plugin scaffold; P2.3 contract authorship;
  P2.4 adapter; P2.5 end-to-end fixture) is authored by the operator
  + Claude/Codex pair in the operator session, not by a distinct
  implementer process with filesystem authority.
- Forcing container isolation into Phase 2 close would couple Phase 2
  closure to Tier-2+ substrate work (container tooling, UID mapping,
  mount discipline) that `specs/plans/phase-2-implementation.md
  §Deferred to Phase 2+` has already placed outside Phase 2 scope.
- The honest distinction is between (i) LLM drafting in the operator
  session, under operator acceptance, where no process separate from
  the operator's editor exists, and (ii) an agent/tool process with
  filesystem authority (adapter-driven writes, workflow-execution
  writes, hook-driven writes, CI-driven writes). Only case (ii)
  requires isolation; case (i) does not. The trigger conditions below
  make this distinction operative.

**Named trigger conditions for re-opening CC#P2-7 (any one triggers
re-opening; list is extensible — adding a trigger is an amendment,
removing one requires a §6 firewall pass):**

1. **Implementer-operator split.** A Phase 2+ slice lands an actual
   separate implementer process/user/role with filesystem authority
   (not merely a naming convention, and not LLM drafting in the
   operator session). The first such slice must cite this ADR and
   promote CC#P2-7 from `re-deferred` to `active`.
2. **Hidden test pool lands.** Any `tests/properties/hidden/` content
   is committed to the repo, or any tooling begins to treat a set of
   tests as "hidden" (not mounted to implementer).
3. **Mutation-testing gate lands.** `tests/mutation/` content or a
   mutation-testing ratchet begins enforcing invariants that depend
   on specs+tests being read-only to the mutator.
4. **External contributor (non-operator) implementer.** Any slice
   implemented by a human or agent other than the operator or
   Claude/Codex under operator direction, on operator-owned
   hardware, in an operator-owned session.
5. **Phase 3 open.** Regardless of other triggers, Phase 2 close must
   re-evaluate CC#P2-7's re-deferral as part of the Phase 2 → Phase 3
   transition. If no other trigger has fired, Phase 3 may still
   re-defer, but must do so by its own ADR (not by citing this one).
6. **Agent/tool process with repo write capability.** Any landed
   adapter, hook, workflow step, plugin command, or subprocess that
   can (by its type or by runtime capability) write under `specs/`,
   `tests/`, `.github/`, `.claude-plugin/`, `src/`, `scripts/`, or
   CI/hooks configuration. Example: a P2.4 `agent` adapter run with
   tool use that has file-write capability.
7. **Protected-surface mutation by workflow execution.** Any
   instance of the runner or a workflow step producing changes to
   `specs/`, `tests/properties/visible/`, `tests/mutation/`,
   `specs/behavioral/`, or CI config during a non-interactive run
   (i.e. not a human-typed edit in the operator session).
8. **New property, behavioral, mutation, or CI enforcement surface.**
   Any new visible property test, behavioral spec, mutation gate, or
   CI enforcement check whose correctness depends on read-only
   specs/tests for the implementer.
9. **Reference-Circuit parity harness.** Any harness that mounts both
   the reference Circuit tree at `~/Code/circuit` and the
   circuit-next tree simultaneously, or otherwise requires source-of-
   truth separation between reference and target.

**Interim enforcement surface (new audit check, adds an audit-
coverage ratchet advance in this slice).**

A new audit check, `checkPhase2SliceIsolationCitation`, is added to
`scripts/audit.mjs` in the same ceremony commit as this ADR. The check
inspects each slice commit in Phase 2 (commits after `0223d11` whose
body declares a Lane) and rejects the commit if **both** of the
following hold:

- The commit's file changes touch any of `specs/`, `tests/`,
  `.github/`, `.claude-plugin/`, `src/`, `scripts/`, or CI/hooks
  configuration; **and**
- The commit body does not contain either (i) the string
  `Isolation: policy-compliant (no implementer separation required)`
  or (ii) the string `Isolation: re-deferred per ADR-0007 CC#P2-7` or
  (iii) a Break-Glass lane declaration.

This is an in-commit-body citation requirement, not a filesystem
capability check. Its job is to force slice authors to declare
isolation status explicitly rather than silently normalize unisolated
Phase 2 execution. The check is a Phase-2-only gate (it does not run
against pre-Phase-2 commits) and it is tuned to be satisfiable with
a one-line commit-body addition.

**Audit numbering:** the new check takes the next available audit-
check slot after Check 22 (currently the verify gate). Check numbering
is not fixed in this ADR; the implementing commit must preserve
monotonic printed Check-N order (see §Decision.7).

---

**CC#P2-8 — Close review (final blocking review, not artifact-presence only).**

Phase 2 close requires a final adversarial review that, unlike
Slice-31a-style artifact-presence checks, **fails closed** if any
prior criterion is not in the required state. CC#P2-8 is the final
blocking gate for Phase 2 close.

- **Enforcement binding (executable):**
  - Close matrix file: `specs/reviews/phase-2-close-matrix.md` with
    exactly one row per CC#P2-N (N = 1..7) containing:
    - Criterion id
    - Status (`active — satisfied` / `active — red` / `re-deferred`)
    - Evidence path (test file, audit function, artifact file —
      non-substitutable per CC#P2-N enforcement binding above)
    - Passing-commit SHA (for `active — satisfied`) or ADR citation
      (for `re-deferred`) or red-diagnosis pointer (for `active —
      red`)
    - Structural evidence type (non-LLM mechanical / operator /
      cross-model challenger / test-enforced / audit-enforced)
  - Codex challenger pass: `specs/reviews/phase-2-close-codex.md`
    with frontmatter `review_kind: challenger-objection-list`,
    `target_kind: phase-close`, objection list in the same shape as
    `specs/reviews/adr-0007-codex.md`. HIGH + MED must be folded in
    before Phase 2 close lands.
  - Operator product-direction note:
    `specs/reviews/phase-2-operator-product-check.md` with
    `review_kind: operator-product-direction-check`,
    `scope: product-direction-only`, `not_claimed` covering forbidden
    wording analogous to ADR-0006 14a.
  - Audit check: `checkPhase2CloseMatrix` (new; added at the Phase 2
    close ceremony slice, not in this P2.1 slice). Rejects the close
    claim if:
    - Any row's status is `active — red`;
    - Any row's status is `re-deferred` without a corresponding ADR
      citation path that exists on disk and is in `Accepted` status;
    - Any row's `structural_evidence_type` is `cross-model
      challenger` or `test-enforced via LLM stand-in` only, with no
      corresponding operator or non-LLM mechanical evidence elsewhere
      in the matrix (CC#15-style structural-separation rule);
    - The Codex challenger pass closing verdict is not
      `ACCEPT-WITH-FOLD-INS` or `ACCEPT`;
    - The operator product-direction note's `not_claimed` is missing
      or its forbidden-wording list is empty.
- **Non-substitutable failure conditions:** artifact presence alone
  does not satisfy CC#P2-8. Each row of the matrix must show
  executable evidence (commit SHA + test/audit result); LLM-only
  stand-in evidence is insufficient; aggregate-style wording in the
  matrix or review artifacts fails the audit.
- **Circularity check:** CC#P2-8 can only pass *after* CC#P2-1
  through CC#P2-7 are each in a final state (`active — satisfied` or
  `re-deferred` with valid ADR). CC#P2-8 cannot declare itself
  satisfied.

### 2. Plan status amendment (genuine in-place content, not pointer)

`specs/plans/phase-2-implementation.md §Phase 2 close criteria` status
changes from **"draft — candidate, not locked"** to **"locked via
ADR-0007 (2026-04-21)"**. The plan prose is amended in place by the
ceremony commit landing this ADR.

**The plan carries the following locked summary in its §Phase 2 close
criteria section (full in-place content, not a pointer):**

| CC# | Title | Status at lock | Enforcement location |
|---|---|---|---|
| P2-1 | One-workflow parity (target: `explore`) | active — red (not yet satisfied) | `tests/runner/explore-e2e-parity.test.ts` + `tests/fixtures/golden/explore/` (authored at P2.5) |
| P2-2 | Real agent dispatch | active — red | `src/runtime/adapters/agent.ts` + `tests/runner/agent-dispatch-roundtrip.test.ts` (authored at P2.4) |
| P2-3 | Plugin command registration | active — red | `checkPluginCommandClosure` + `tests/contracts/plugin-surface.test.ts` + P2.11 invoke-evidence file |
| P2-4 | Session hooks + continuity lifecycle | active — red | `.claude/hooks/` scripts + `checkSessionHooksPresent` + `tests/runner/continuity-lifecycle.test.ts` |
| P2-5 | P2-MODEL-EFFORT landed | active — red | `src/schemas/workflow.ts` v0.3 + `checkUnknownModelIds` + `tests/contracts/workflow-model-effort.test.ts` |
| P2-6 | Spine policy coverage (full-spine) | active — red | `specs/contracts/explore.md` + `checkSpineCoverage` + `tests/contracts/spine-coverage.test.ts` |
| P2-7 | Container isolation | **re-deferred by ADR-0007** | `checkPhase2SliceIsolationCitation` (interim) + CLAUDE.md hard invariants #1–#4 (policy-layer) |
| P2-8 | Close review | active — red | `specs/reviews/phase-2-close-matrix.md` + `specs/reviews/phase-2-close-codex.md` + `specs/reviews/phase-2-operator-product-check.md` + `checkPhase2CloseMatrix` |

On any conflict between the plan's locked summary and this ADR's
§Decision.1, ADR-0007 §Decision.1 is authoritative. The plan's locked
summary is a full mirror of the enforcement bindings, not a pointer,
so that slice authors reading the plan get the locked semantics
directly.

Plan Open Questions updated:

- **#3 (container isolation)**: `RESOLVED 2026-04-21 via ADR-0007
  CC#P2-7: re-deferred with nine named trigger conditions; interim
  per-slice citation audit check added.`
- **#5 (spine policy for `explore`)**: `RESOLVED 2026-04-21 via
  ADR-0007 CC#P2-6: full-spine Standard rigor — Frame, Analyze,
  Synthesize, Review, Close.`

Order-of-authority for close-criteria semantics after this ADR:

1. **ADR-0007** (this document) — authoritative for the enumerated
   gates and their enforcement bindings.
2. **`specs/plans/phase-2-implementation.md §Phase 2 close criteria`
   locked summary** — tactical plan surface; mirrors bindings, does
   not redefine them.
3. **Slice commit bodies** — per-slice justification surface; may
   cite this ADR but may not substitute weaker evidence.

### 3. No-aggregate-scoring rule (explicit, inline, tightened)

**No aggregate score is computed across the eight Phase 2 close
criteria.** Phase 2 closes when:

- Every `active` criterion is in status `active — satisfied`, **AND**
- Every `re-deferred` criterion has valid ADR-covered trigger
  conditions and has not had a trigger fire.

A situation where five criteria are `active — satisfied` and three
are `active — red` does not close Phase 2. Nor does a situation where
six criteria are satisfied, one is `active — red`, and one is
`re-deferred`. There is no weighted rollup, no "score of 6/8," no
"substantially complete" wording. This is the direct application of
CLAUDE.md §Hard invariants #8: *"No aggregate scoring across
ratchets; each dimension tracked independently."*

**Forbidden status/progress wording (rejected on §6 grounds):**

- "N-of-8 complete", "N of 8 green", "8/8", "7/8"
- "substantially complete", "mostly done", "nearly done", "close to
  done", "near close"
- "all but one", "all except X"
- "only N remaining"
- "complete except for X"
- "green-by-redeferral", "trivially green" (for any criterion)
- "aggregate green", "composite status"
- Any scalar summary of Phase 2 close progress

Why aggregate scoring is excluded: aggregate scores hide regressions.
A Phase-2-close number of "7/8" on the day before closure — where
CC#P2-7 is re-deferred and CC#P2-6 spine coverage is red on the target
workflow — would mask the single load-bearing failure. Independent
tracking with explicit `active — satisfied` / `active — red` /
`re-deferred` status values forces the failure to be visible as a
named non-green gate.

Ratchet-advance semantics per criterion: the product ratchets named
in `specs/plans/phase-2-implementation.md §Product ratchets Phase 2
will carry` continue to advance independently. None of these ratchets
is a substitute for a close criterion; none of the close criteria is
a substitute for its ratchet. The two surfaces are complementary, not
aggregatable.

### 4a. Scope of this ADR (explicit)

This ADR **does**:

- Lock the eight close criteria with concrete executable enforcement
  bindings (not slice-name-only bindings).
- Resolve plan Open Question #3 (container isolation) by re-deferral
  with nine named trigger conditions and an interim per-slice citation
  audit check.
- Resolve plan Open Question #5 (spine policy for `explore`) by
  adopting the full-spine set {Frame, Analyze, Synthesize, Review,
  Close}.
- State the no-aggregate-scoring rule inline, with an explicit
  forbidden-wording list.
- Install a §6 Precedent firewall preventing ADR-0007 from being
  cited as precedent, pattern, or template.
- Amend the plan's §Phase 2 close criteria status and locked-summary
  table in place.
- Add one interim audit check (`checkPhase2SliceIsolationCitation`)
  advancing the audit-coverage ratchet independently of the close-
  criteria-authority ratchet.

This ADR **does not**:

- Re-sequence slices P2.1–P2.11 or P2-MODEL-EFFORT. Ordering stays
  with the plan.
- Retarget the first-parity workflow (that decision was recorded at
  plan commit `3bf4868`, operator 2026-04-21). Future retargets
  require amending this ADR via the retarget checklist at §4b.
- Waive, relax, or weaken any Phase 1.5 close criterion.
- Claim Phase 2 is closer to done. See §Consequences.Accepted.
- Weaken CLAUDE.md hard invariants #1–#4 at the policy layer. The
  close-criterion-layer re-deferral at CC#P2-7 is explicitly
  acknowledged as a weakening of Phase 2 close only, not of the
  policy-level statements.
- Introduce aggregate scoring. See §Decision.3.
- Re-scope `circuit:create`, `circuit:handoff` (workflow parity),
  registry-lookup install wrapper, intelligent routing selector,
  third-voice challenger, or any item under plan §Deferred to Phase
  2+. Those remain deferred.
- Add Phase 2 close gates for P2.8 router, P2.10 artifact schemas,
  or continuity-lifecycle-beyond-CC#P2-4. See §Decision.4c for
  explicit non-gating disposition.

### 4b. Retarget checklist (CC#P2-1 target-workflow reselection)

If the operator exercises the plan's documented `review` fallback for
the first-parity target (per `specs/plans/phase-2-implementation.md
§Target workflow for first parity — DECIDED.Fallback`), the retarget
requires this ADR to be amended. The amendment payload must include:

1. **New target workflow name.** The workflow id as it appears in
   `specs/contracts/` and `.claude-plugin/skills/`.
2. **New canonical phase set** (CC#P2-6 binding). For `review`, the
   canonical set is not yet enumerated in this repo; the retarget
   amendment must author `specs/contracts/review.md` first.
3. **New fixture path.** `.claude-plugin/skills/<target>/circuit.json`.
4. **New golden path.** `tests/fixtures/golden/<target>/`.
5. **New test file names.** `tests/runner/<target>-e2e-parity.test.ts`,
   and any workflow-specific contract tests.
6. **Artifact-shape contract update.** If the new target produces
   different artifact shapes (review: verdict/objections; explore:
   brief/analysis/synthesis), CC#P2-1's byte-shape golden definition
   must be updated inline.
7. **Affected planned slices.** Which of P2.3, P2.5, P2.9, P2.10,
   P2.11 require re-scoping or re-ordering.
8. **Disposition of any landed `explore` artifacts.** Are they kept
   as partial/discarded/second-workflow-candidate? The retarget
   amendment must state the disposition inline.
9. **Evidence the retarget is structurally required, not merely
   scope-reducing.** Per §6 Precedent firewall clause 2.
10. **Codex challenger pass** on the retarget amendment per §6 clause
    6, with HIGH + MED fold-ins before landing.
11. **Operator product-direction acknowledgment** recorded in the
    amendment commit body, explicit about `not_claimed` (e.g. "this
    retarget is not a claim that `explore` was the wrong choice; it
    is a scope-pivot under documented fallback").

A target-name swap without this payload is rejected on §6 grounds.

### 4c. Non-gating disposition for mid-term plan items

The following items appear in `specs/plans/phase-2-implementation.md`
as Phase 2 work but are **not** Phase 2 close gates. They are
explicitly demoted to non-gating status by this ADR; their absence
at Phase 2 close does not block closure unless a specific CC#P2-N
binding above requires them:

- **P2.8 router (`/circuit:run` classifier)** — non-gating for Phase 2
  close. A single-workflow parity claim (CC#P2-1) does not require a
  multi-workflow classifier. If a second workflow lands before Phase 2
  close (P2.9), the router may become load-bearing — at that point,
  a future ADR may add a CC#P2-9 gate. This ADR does not pre-install
  that gate.
- **P2.10 artifact schema set (brief/analysis/synthesis/result/
  verdict)** — partially load-bearing via CC#P2-1 byte-shape golden
  (the golden artifact *is* the schema definition operationally for
  Phase 2 close). Full Zod schemas for each artifact are non-gating;
  their absence does not block close. If the P2.5 golden cannot be
  produced without a Zod schema, CC#P2-1 fails first, not CC#P2-10.
- **Continuity lifecycle beyond CC#P2-4 scope** — the lifecycle test
  at CC#P2-4 covers create/persist/resume/clear. Broader continuity
  lifecycle work (multiple concurrent records, branch-aware resume,
  cross-worktree hygiene) is non-gating.

**Inherited product ratchets.** The seven ratchets inherited from
Phase 1.5 close (`runner_smoke_present`, `workflow_fixture_runs`,
`event_log_round_trip`, `snapshot_derived_from_log`,
`manifest_snapshot_byte_match`, `status_docs_current`,
`tier_claims_current`) and the three added by Phase 2
(`dispatch_realness`, `workflow_parity_fixtures`,
`plugin_surface_present`) must be green at Phase 2 close. This is
separate from close criteria and is enforced by existing audit checks
on those ratchets (or by the audit checks added by their implementing
slices). A red inherited ratchet at close blocks Phase 2 close
independently of CC#P2-1..8 status; CC#P2-8 close-matrix audit check
includes a row for each inherited ratchet and fails if any is red.

### 5. Reopen basis — explicit one-time exception (re-authenticated independently)

This ADR does **not** cite ADR-0006 as precedent, pattern, template,
or analogy for its re-deferral of CC#P2-7 or for any other provision.
Per ADR-0006 §5 clause 7, that citation is forbidden. Instead, this
ADR's re-deferral and governance moves rest on their own four-part
basis, re-authenticated fresh from first principles:

- **(a) Named failure mode the existing close-criterion list cannot
  absorb.** The draft list in the plan was marked "draft — candidate,
  not locked" precisely because it could not govern real slices
  without ADR authority. Without locking, any near-term slice could
  either invent a partial close definition or drift — the
  methodology-instead-of-product failure D1 was installed to prevent.
  Locking the list is itself the named failure-mode remediation.
- **(b) D1 impact analysis.** Locking the close criteria does not
  substitute methodology work for executable product evidence; it
  *defines* what executable product evidence will satisfy Phase 2
  close. CC#P2-1 (end-to-end workflow parity), CC#P2-2 (real agent
  dispatch), CC#P2-6 (spine policy coverage) all require *executable*
  evidence produced by later slices. This ADR does not manufacture
  its own satisfaction; it only names what satisfaction looks like.
- **(c) Cross-model challenger pass.** Codex pass on this ADR lands
  at `specs/reviews/adr-0007-codex.md`. This is a governance ratchet
  change per CLAUDE.md hard invariant #6, and the challenger pass is
  mandatory per the §Cross-model challenger protocol. Opening verdict
  on the as-authored ADR: REJECT PENDING FOLD-INS (7 HIGH / 5 MED /
  1 LOW / 1 META). All HIGH + MED + LOW + META folded in via this
  revision (same authoring session).
- **(d) Written explanation why re-deferral of CC#P2-7 is honest.**
  See §Decision.1 CC#P2-7: current Phase 2 slices do not require
  container isolation to land honestly; the LLM-drafting-in-operator-
  session case is operationally distinct from the agent-tool-process-
  with-filesystem-authority case; the nine named trigger conditions
  re-open the gate the moment the distinction breaks.

**This four-part basis is not a standing reopen condition.** Future
methodology amendments claiming this basis must re-authenticate each
of (a)–(d) freshly and cannot cite ADR-0007 as precedent (see §6).

### 6. Precedent firewall

Any future ADR, plan amendment, commit body, audit script, review
artifact, or operator-facing summary proposing to retarget, waive,
relax, substitute, re-defer, or aggregate any Phase 2 close criterion
(including but not limited to retargeting the first-parity workflow,
re-opening or re-closing CC#P2-7 container isolation, weakening any
of CC#P2-1 through CC#P2-8, or introducing aggregate-style status
wording) **must** clear all of the following to be accepted:

1. **Identify the original criterion being replaced or amended** with
   its exact CC#P2-N identifier and the specific enforcement binding
   under this ADR's §Decision.1.
2. **Prove the amendment is necessary** — not merely convenient, not
   merely scope-reducing, but structurally required given evidence
   that emerged after this ADR's date (2026-04-21). Scope-reducing
   pivots (e.g. `review` fallback for CC#P2-1) are acceptable only
   under the retarget checklist at §4b, not under general amendment.
3. **Name compensating evidence of a different structural type** if
   weakening — not LLM-on-LLM delegation alone. If the only
   compensation is cross-model or LLM stand-in evidence, the
   amendment must be rejected on CC#15-style structural-separation
   grounds (see ADR-0001 Addendum B CC#15 for the underlying
   principle; this ADR re-authenticates the principle independently
   and does not cite ADR-0006's application of it as precedent).
4. **Carry weaker-evidence wording openly** on every authority
   surface the amendment touches (this ADR's body if amended, any
   referenced plan section, PROJECT_STATE, README). "This is a
   weaker substitute" must be recorded in-line, not as an appendix
   pointer.
5. **Add expiry or reopen trigger** — a concrete condition under
   which the amendment is revisited. For CC#P2-7 specifically, the
   nine trigger conditions at §Decision.1 CC#P2-7 are in force; any
   future amendment to CC#P2-7 must either retire one of those
   triggers (with justification and re-authenticated (a)–(d)) or add
   new ones, never silently remove all.
6. **Get a cross-model challenger pass with an objection list** per
   CLAUDE.md §Cross-model challenger protocol; HIGH + MED objections
   must be folded in before landing. The yield-ledger row for the
   challenger pass must be class = `governance`.
7. **Explicit non-precedent clause** stating that ADR-0007 is not
   being cited as precedent, pattern, template, or analogy, and
   re-authenticating (1)–(6) on fresh grounds. An amendment claiming
   ADR-0007 as precedent — whether by name, by pattern-matching
   ("similar to ADR-0007's CC#P2-7 re-deferral"), or by implicit
   template-reuse ("applying the ADR-0007 approach") — is rejected
   on §Precedent firewall grounds alone.

**Inline restatement of CLAUDE.md §Hard invariants #8 (aggregate-
scoring firewall clause specific to this ADR).** Any future ADR,
audit check, ratchet dashboard, operator-facing summary, review file,
commit body, or README that computes or displays any of the
following is rejected on sight:

- A scalar or composite Phase 2 close status ("6/8", "75% complete",
  "composite green")
- Any of the forbidden wordings enumerated at §Decision.3
- A status graph/chart/table that visually aggregates Phase 2 close
  criteria into a single indicator
- A "progress percentage" field in any Phase 2 governance artifact
- A "close criteria completion" metric in any ratchet dashboard

This restatement is operative in this document. The firewall does not
merely cite CLAUDE.md §Hard invariants #8; it restates the rule as a
rejection-on-sight condition for this specific ADR and its domain.

### 7. Audit — one new interim check (next-available-slot numbering)

Unlike Slice 31a (which added Check 21 for CC#14 retarget artifact
presence), this ADR adds **one** new audit check:
`checkPhase2SliceIsolationCitation` (see CC#P2-7 interim enforcement).
No per-criterion satisfaction checks are added by this ADR (those are
added by the slices that land each criterion — CC#P2-3 check at P2.2,
CC#P2-6 check at P2.3, etc.).

**Audit numbering rule (to prevent stale Check-N citations):**

- The current audit script ends at Check 22 (verify gate).
  `checkPhase2SliceIsolationCitation` takes the next available slot
  after Check 22 (projected: Check 23, but not fixed by this ADR).
- Future slices adding audit checks MUST use the next available slot
  at the time of their commit, not any number pre-allocated by this
  or prior ADRs. The printed Check-N order in audit output MUST be
  monotonic.
- Any audit-check number cited in this ADR (Check 23, Check 24, etc.)
  is projected, not locked. The implementing slice assigns the final
  number.

## Rationale

Three separate lines of reasoning support locking the close criteria
now rather than later. ("Separate," not "independent" — these lines
are authored by the same Claude-Codex pair and share training
distribution per Knight & Leveson 1986; they are not epistemically
independent of each other.)

1. **Anchor before pressure.** The plan's draft list cannot govern
   near-term slices without ADR authority. The first code slice that
   cites a close criterion (projected: P2.2 or P2.3) would either
   gain an authority vacuum or invent its own partial definition.
   Locking the list in governance before the first code-carrying
   slice removes that ambiguity. This is the Contract-First pillar
   applied at the phase-close layer.

2. **Re-deferral with explicit weakening beats either silent
   deferral or forced compliance.** Plan Open Question #3 had two
   acceptable resolutions: lock CC#P2-7 as a Phase 2 gate, or
   re-defer it by ADR with named triggers. Leaving it as a draft
   open question would produce ambiguous Phase 2 close later. This
   ADR picks re-deferral because no Phase 2 slice honestly requires
   container isolation to land. Re-deferral is weaker than the
   CLAUDE.md policy-level statement, and ADR-0007 acknowledges the
   weakening openly (§Decision.1 CC#P2-7, §Consequences.Accepted).
   The nine named trigger conditions + interim per-slice citation
   audit check ensure re-deferral has enforceable exit conditions.

3. **Aggregate-score firewalling must be inline, not cited.**
   CLAUDE.md §Hard invariants #8 is authoritative, but past
   operator-facing summaries and review drafts have reached for
   aggregate-sounding wording under time pressure. Restating the
   no-aggregate rule inline in the §Precedent firewall — not merely
   citing it — gives future readers a single authoritative surface
   to point to when rejecting aggregate-style summaries of Phase 2
   progress.

## What changes

### 1. `specs/plans/phase-2-implementation.md §Phase 2 close criteria`

Status line amended from:

> These are the candidate gates for calling Phase 2 done. They are
> authored here for ranging purposes and must be locked via an ADR
> before any slice claims one of them.

To:

> **Status: LOCKED via ADR-0007 (2026-04-21).** These are the
> authoritative Phase 2 close criteria with concrete executable
> enforcement bindings. The locked summary table (see ADR-0007
> §Decision.2) is mirrored in full below; on any conflict, ADR-0007
> §Decision.1 is authoritative. Any change — retarget, weakening,
> relaxation, introduction of aggregate scoring — must clear
> ADR-0007 §6 Precedent firewall before landing.

Followed by the full locked summary table from §Decision.2 above,
inlined in the plan — not a pointer.

Plan Open Questions updated:

- **#3 (container isolation)**: `RESOLVED 2026-04-21 via ADR-0007
  CC#P2-7: re-deferred with nine named trigger conditions; interim
  per-slice citation audit check added in ceremony slice.`
- **#5 (spine policy for `explore`)**: `RESOLVED 2026-04-21 via
  ADR-0007 CC#P2-6: full-spine Standard rigor — Frame, Analyze,
  Synthesize, Review, Close.`

P2.3 deliverable text and CC#P2-6 canonical phase set are
consistent; no change to P2.3 prose required beyond the Open Question
#5 resolution annotation.

### 2. New ADR file

`specs/adrs/ADR-0007-phase-2-close-criteria.md` (this document). First
ADR authored under Phase 2 — Implementation.

### 3. Codex challenger pass artifact

`specs/reviews/adr-0007-codex.md` — objection list from Codex
cross-model challenger pass. Opening verdict: REJECT PENDING FOLD-INS
(7 HIGH / 5 MED / 1 LOW / 1 META). Disposition: all HIGH + MED + LOW
+ META folded in via this ADR's revision (same authoring session),
per §Decision.5(c).

### 4. Yield-ledger row

`specs/reviews/adversarial-yield-ledger.md` appends a row for the
ADR-0007 Codex pass:

- `pass_date`: 2026-04-21
- `artifact_path`: `specs/adrs/ADR-0007-phase-2-close-criteria.md`
- `artifact_class`: governance
- `pass_number_for_artifact`: 1
- `reviewer_id`: gpt-5-codex
- `mode`: llm-review
- `HIGH_count`: 7 / `MED_count`: 5 / `LOW_count`: 1 (META not
  columnar but noted in the review artifact)
- `verdict`: REJECT PENDING FOLD-INS → incorporated → ACCEPT-WITH-
  FOLD-INS
- `rigor_profile`: standard
- `why_continue_failure_class`: n/a (pass 1)
- `prior_execution_commit_sha`: n/a (pass 1)

### 5. Ceremony commit body — required framing (with expanded forbidden wording)

The ceremony commit landing this ADR **must** carry:

- **Lane:** Ratchet-Advance (governance ratchet — close-criteria
  authority ratchet; advances independently from Slice 31a's phase-
  graph authority ratchet per CLAUDE.md hard invariant #8; additionally
  advances the audit-coverage ratchet via
  `checkPhase2SliceIsolationCitation`).
- **Trajectory:** P2.1 → Phase 2 close-criteria arc → Phase 2 entry
  goal. No earlier slice makes this one smaller or mis-sequenced.
- **Failure mode:** draft close criteria in the plan cannot govern
  near-term slices; first code slice to cite them would invent or
  drift.
- **Acceptance evidence:** this ADR file; Codex challenger pass at
  `specs/reviews/adr-0007-codex.md`; yield-ledger row; plan §Phase 2
  close criteria amended in place with full locked summary table;
  Open Questions #3 and #5 marked RESOLVED; new audit check
  `checkPhase2SliceIsolationCitation` added;
  `npm run verify` + `npm run audit` green.
- **Alternate framing:** author ADR-0007 after P2.2–P2.5 land, once
  real surface pressure emerges. Rejected because lane discipline is
  weaker without an authoritative anchor.
- **Authority:** this ADR (once landed) + CLAUDE.md §Core methodology
  + CLAUDE.md §Hard invariants #6 + #8.
- **Isolation status line** (per CC#P2-7 interim check): `Isolation:
  policy-compliant (no implementer separation required)` — this slice
  is LLM drafting in the operator session, not an agent/tool process
  with filesystem authority.

**Forbidden wording** (expanded; ceremony commit body, plan prose,
PROJECT_STATE, README, any operator-facing summary):

- "Phase 2 progress measured at N%" / "N-of-8 complete" / "8/8" /
  "7/8" / any scalar or composite Phase 2 close progress wording
- "substantially complete", "mostly done", "nearly done", "close to
  done", "near close"
- "all but one", "all except X", "complete except for X"
- "only N remaining"
- "green-by-redeferral", "trivially green" (for any criterion,
  especially CC#P2-7)
- "Phase 2 close criteria satisfied" (the ADR locks the criteria; it
  does not satisfy any of them)
- "Container isolation not required for Phase 2" without the phrase
  "re-deferred by ADR-0007 with nine named trigger conditions and
  interim per-slice citation audit check"
- "Close criteria finalized" / "close criteria complete" (they are
  *locked*, not satisfied)
- Any citation pattern that implies ADR-0006 or ADR-0007 is precedent
  for future retargets
- "Analogous to ADR-0006" / "following the ADR-0006 pattern" / "like
  ADR-0006 did" — these are §6 clause 7 violations even if
  superficially descriptive

The ceremony commit body **must** say, positively:

> P2.1 lands ADR-0007, locking Phase 2 close criteria with concrete
> executable enforcement bindings. CC#P2-7 container isolation is
> re-deferred at the close-criterion layer with nine named trigger
> conditions and an interim per-slice citation audit check. This ADR
> does not move Phase 2 closer to done; it defines what done means so
> that P2.2 through P2.11 + P2-MODEL-EFFORT can bind against a fixed
> target. Policy-level CLAUDE.md hard invariants #1–#4 remain in
> force; the close-criterion-layer weakening is acknowledged openly.

### 6. PROJECT_STATE.md update

`PROJECT_STATE.md` header gains a P2.1 landing entry under "Last
updated" capturing: slice number (P2.1), lane (Ratchet-Advance),
trajectory (one line), the failure mode this slice addresses,
acceptance evidence locations, isolation status line, and a plain-
English one-line summary per CLAUDE.md §After-slice operator summary.
No forbidden wording; no aggregate phrasing.

### 7. Audit — one new check + numbering rule

`checkPhase2SliceIsolationCitation` added to `scripts/audit.mjs`
(next available slot after Check 22, projected Check 23). See
CC#P2-7 interim enforcement and §Decision.7 numbering rule.

### 8. CLAUDE.md — no amendment in this slice, but weakening acknowledged

CLAUDE.md §Phase discipline §Phase 2 sentence and §Hard invariants
#1–#4 are **not** textually amended by this ADR. They remain
authoritative at the policy layer. CC#P2-7's re-deferral is at the
close-criterion layer only. The `amends` frontmatter field of this
ADR calls out this scope-limited amendment explicitly to prevent
drift interpretation.

## Consequences

### Accepted (with explicit weakening disclosures)

- **Locking does not satisfy.** ADR-0007 defines what Phase 2 close
  means; it does not move Phase 2 closer to done. Rough conversation-
  level estimate of remaining work: ~15–25 slices from the current
  state (Alpha Proof fixture + skeletal plan) to all eight close
  criteria in final status. Plan authorship will refine.
- **ADR-0007 weakens Phase 2 close by accepting unisolated implementer
  execution for Phase 2 close.** This is the explicit weakening
  disclosure required by §6 clause 4 and by HIGH #2 fold-in. The
  CLAUDE.md policy-level isolation sentence remains in force; only
  the close-criterion-layer version is weakened. The nine trigger
  conditions + interim audit check ensure the weakening has
  enforceable exits.
- **CC#P2-7 re-deferral is honest but time-limited.** Any of the
  nine named trigger conditions re-opens the gate.
- **LLM-pair concurrence is not independence.** Claude and Codex
  share training distribution (Knight & Leveson 1986); concurrence
  between them on this ADR is same-distribution advisory context,
  not independent justification. The Codex challenger pass produced
  7 HIGH + 5 MED + 1 LOW + 1 META objection; fold-ins are recorded
  in this revision. The closing verdict on the challenger pass
  (post-fold-in) is ACCEPT-WITH-FOLD-INS.
- **CC#15-style structural-separation is carried forward.** Any
  future retarget of a close criterion that rests solely on LLM
  stand-in evidence must be rejected on §6 clause 3.
- **Aggregate-scoring attempts will happen.** The inline firewall at
  §6 is protection against drift, not a claim drift is unlikely.

### Enabling

- Near-term slices P2.2 through P2.5 now have a locked anchor with
  concrete enforcement bindings to commit against.
- The §6 Precedent firewall + inline aggregate-scoring firewall
  prevents ADR-0007 from being laundered as permission for silent
  retargets or aggregate-scoring creep.
- CC#P2-7's explicit re-deferral (with nine named triggers + interim
  audit check) removes the "is this a gate or not?" ambiguity that
  would otherwise surface at every Phase 2 slice touching isolation-
  adjacent work, while honestly acknowledging the close-criterion-
  layer weakening.
- The retarget checklist at §4b makes `explore` → `review` (or other)
  reselection auditable instead of a silent rename.
- The non-gating disposition at §4c removes "is this a gate?"
  ambiguity for P2.8 router, P2.10 artifact schemas, and broader
  continuity lifecycle work.

### Deferred / Not changed

- **Phase 1.5 close criteria:** unchanged.
- **CLAUDE.md hard invariants #1–#4:** unchanged at the policy layer;
  weakened at the Phase 2 close-criterion layer per CC#P2-7.
- **Product ratchets:** unchanged in definition; required-green-at-
  close status added per §4c.
- **Sub-slice sequencing (P2.2–P2.11 + P2-MODEL-EFFORT):** unchanged.
- **`specs/methodology/decision.md`:** unchanged.

## Reopen conditions (for ADR-0007 specifically)

This ADR is reopened if any of:

1. **Target-workflow reselection** — per §4b retarget checklist.
2. **CC#P2-7 trigger fires** — any of the nine trigger conditions at
   §Decision.1 CC#P2-7.
3. **Plan list diverges from ADR list** — any future plan amendment
   attempting to add, remove, or rename a close criterion without an
   amending ADR.
4. **Aggregate-scoring proposal surfaces** — see §6 inline firewall.
5. **Phase 2 close review (CC#P2-8) reveals structural defect** — if
   the close-matrix review or Codex challenger pass finds that one
   or more criteria was satisfied by weaker evidence than this ADR
   specifies.
6. **Interim audit check turns out non-satisfiable or easily gamed**
   — if `checkPhase2SliceIsolationCitation` is found to be
   routinely satisfied by boilerplate commit-body text without
   genuine isolation reasoning, revise the check to require more
   substantive citation (e.g. citing a specific trigger condition
   that does NOT apply, rather than a one-line string).
7. **CLAUDE.md §Phase discipline sentence is amended.** If the
   policy-layer statement changes, CC#P2-7's close-criterion-layer
   relationship to it must be re-evaluated.
8. **Non-gating items promoted.** If P2.8 router, P2.10 schemas, or
   broader continuity lifecycle are later required by a Phase 2 use
   case, this ADR must be amended to add them as CC#P2-9, CC#P2-10,
   etc.

## Provenance

This ADR was drafted by Claude (opus-4-7) on 2026-04-21, under
operator full-autonomy authorization for overnight Phase 2 progress.
The draft is based on the eight close criteria enumerated in
`specs/plans/phase-2-implementation.md §Phase 2 close criteria`.

**Claude/Codex concurrence on the close-criteria list is recorded as
same-distribution advisory context only, not as justification for
the ADR.** Claude and Codex share training distribution (Knight &
Leveson 1986); concurrence between them cannot be laundered as
independent verification.

Cross-model challenger dispatch: required per CLAUDE.md hard
invariant #6 and `specs/methodology/decision.md` cross-model
challenger protocol. Dispatched via `/codex` skill. Codex's
objection list at `specs/reviews/adr-0007-codex.md`. Opening verdict:
REJECT PENDING FOLD-INS (7 HIGH / 5 MED / 1 LOW / 1 META).
Disposition: all HIGH + MED + LOW + META folded in via this revision,
same authoring session, per ADR-0006-style (but not ADR-0006-derived)
fold-in pattern. Closing verdict on the fold-in receipt:
ACCEPT-WITH-FOLD-INS.

## References

- `specs/adrs/ADR-0001-methodology-adoption.md` §Addendum B §Phase
  1.5 → Phase 2 transition semantics
- `specs/adrs/ADR-0006-cc14-operator-governance-alignment.md` —
  historical Phase-1.5-close authority; ADR-0006 §5 clause 7 is the
  *negative* constraint ADR-0007 honors by not citing ADR-0006 as
  precedent
- `specs/plans/phase-2-implementation.md` §Phase 2 close criteria;
  §Target workflow for first parity; §Open questions; §Product
  ratchets Phase 2 will carry
- `specs/methodology/decision.md` §D10 — governs Codex pass rigor
- `CLAUDE.md §Core methodology`; §Phase discipline §Phase 2; §Hard
  invariants #1–#4, #6, #8
- `specs/reviews/adr-0007-codex.md` (Codex challenger pass;
  authored in the same ceremony commit)
- `specs/reviews/adversarial-yield-ledger.md` (row appended for the
  ADR-0007 pass)
- `specs/plans/phase-1-close-revised.md §Slice P2-MODEL-EFFORT`
  (CC#P2-5 enforcement binding; incorporated by reference)

## Lane and ratchet declaration (for the ceremony slice landing this ADR)

Lane: **Ratchet-Advance**. Ratchets advanced (independently tracked
per CLAUDE.md hard invariant #8):

- **Close-criteria authority ratchet** — first Phase 2 close-criteria
  lock.
- **Audit-coverage ratchet** — `checkPhase2SliceIsolationCitation`
  added (interim CC#P2-7 enforcement).
- **No-aggregate-scoring firewall surface** — inline restatement of
  CLAUDE.md §Hard invariants #8 in §6 adds a governance-layer
  enforcement surface distinct from the policy-layer hard invariant.

---

## Appendix A — Close-criteria-to-slice binding table (authoritative)

| CC# | Criterion | Enforcement slice | Concrete binding (non-substitutable) |
|---|---|---|---|
| P2-1 | One-workflow parity (target: `explore`) | P2.5 | `tests/runner/explore-e2e-parity.test.ts` + `tests/fixtures/golden/explore/` byte-shape golden (sha256 over normalized-JSON) |
| P2-2 | Real agent dispatch | P2.4 (+ P2.6 optional) | `src/runtime/adapters/agent.ts` + `tests/runner/agent-dispatch-roundtrip.test.ts` with durable dispatch transcript assertion (adapter id, request/receipt/result hashes, reducer+writer consumption); CI-skip requires `tests/fixtures/agent-smoke/last-run.json` with commit-ancestor audit |
| P2-3 | Plugin command registration | P2.2 (scaffold) + P2.11 (invokability) | `checkPluginCommandClosure` + `tests/contracts/plugin-surface.test.ts` + `specs/reviews/p2-11-invoke-evidence.md` |
| P2-4 | Session hooks + continuity lifecycle | P2.7 | `.claude/hooks/SessionStart.sh` + `.claude/hooks/SessionEnd.sh` + `checkSessionHooksPresent` + `tests/runner/continuity-lifecycle.test.ts` |
| P2-5 | P2-MODEL-EFFORT landed | P2-MODEL-EFFORT | `src/schemas/workflow.ts` v0.3 + `tests/contracts/workflow-model-effort.test.ts` + `checkUnknownModelIds` |
| P2-6 | Spine policy coverage (full-spine) | P2.3 (declare) + P2.5 (run) | `specs/contracts/explore.md` canonical {Frame,Analyze,Synthesize,Review,Close} + `checkSpineCoverage` + `tests/contracts/spine-coverage.test.ts` |
| P2-7 | Container isolation | RE-DEFERRED (this ADR) | `checkPhase2SliceIsolationCitation` (interim) + CLAUDE.md §Phase discipline §Phase 2 + Hard invariants #1–#4 (policy-layer unchanged) |
| P2-8 | Close review (final blocking gate) | P2-CLOSE-REVIEW (named in plan) | `specs/reviews/phase-2-close-matrix.md` + `specs/reviews/phase-2-close-codex.md` + `specs/reviews/phase-2-operator-product-check.md` + `checkPhase2CloseMatrix` |

This table is authoritative. If §Decision.1 and Appendix A diverge,
§Decision.1 governs.

## Appendix B — Internal consistency reconciliation table (META #14 fold-in)

One row per Codex-objection fold-in, showing where the fold-in
landed in this revision.

| Objection | Severity | Fold-in location |
|---|---|---|
| 1 | HIGH | Frontmatter `related:` field reworded; Context §Relationship to ADR-0006 paragraph added; CC#P2-7 rationale ADR-0006 bullet removed; §Decision.5 reworded; §6 clause 7 tightened (pattern-matching citation also forbidden) |
| 2 | HIGH | CC#P2-7 §Scope of the weakening added; §Consequences.Accepted explicit weakening disclosure bullet; new audit check `checkPhase2SliceIsolationCitation`; frontmatter `amends:` field calls out CLAUDE.md scope-limited amendment |
| 3 | HIGH | CC#P2-7 trigger list expanded from 5 to 9 conditions; blanket "Claude/Codex under operator direction" exclusion removed; LLM-drafting-vs-agent-tool-process distinction made operative |
| 4 | HIGH | CC#P2-8 revised to "final blocking review, not artifact-presence only"; `checkPhase2CloseMatrix` audit check named; matrix rows require evidence path + status + commit SHA + structural evidence type; fail-closed conditions enumerated; circularity check added |
| 5 | HIGH | Each CC#P2-N now has "Enforcement binding (executable)" subsection naming test file + audit function + fixture/golden path + non-substitutable failure conditions; slice-name enforcement replaced |
| 6 | HIGH | CC#P2-6 canonical phase set aligned with plan P2.3 to {Frame,Analyze,Synthesize,Review,Close}; Open Question #5 resolved inline |
| 7 | HIGH | §Decision.2 now inlines full locked summary table in plan (CC#P2-N, title, status, enforcement location), not a pointer |
| 8 | MED | §Decision.4b retarget checklist added (11 required amendment payload items) |
| 9 | MED | §Decision.3 expanded forbidden-wording list with "green-by-redeferral" and siblings; status values clarified (`active — satisfied` / `active — red` / `re-deferred`); close condition redefined |
| 10 | MED | §Decision.7 audit numbering rule added; all future Check-N references marked "projected, not locked" |
| 11 | MED | §Decision.4c non-gating disposition section added for P2.8 router, P2.10 artifact schemas, continuity lifecycle beyond CC#P2-4; inherited product ratchets required-green-at-close rule added (via CC#P2-8 matrix) |
| 12 | MED | CC#P2-2 durable dispatch transcript requirement added (adapter id, request/receipt/result hashes, reducer+writer consumption); CI-skip requires local smoke artifact with commit-ancestor audit |
| 13 | LOW | Rationale opening reworded from "Three independent lines" to "Three separate lines"; Knight-Leveson note added inline |
| 14 | META | This Appendix B added (internal consistency table); contradictions from the all-in-one scope are enumerated here so reviewers can verify each fold-in landed |

Fold-in completeness claim: every HIGH, MED, LOW, and META objection
from `specs/reviews/adr-0007-codex.md` is addressed in this revision
of ADR-0007 at the location named above. If a reviewer finds an
objection not addressed, re-open this ADR per §Reopen condition 5.
