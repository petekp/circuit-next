---
name: phase-2-implementation
description: Phase 2 implementation plan — from Alpha Proof fixture to one-workflow parity. Opens with target-workflow choice, sequences near-term slices, names mid-term skeleton, and records Phase 2 close-criteria candidates.
type: plan
date: 2026-04-21
authored_by: claude-opus-4-7
base_commit: 0223d11162b35458c22c4b8680859f872a83897c0
supersedes_scope:
  - (none — first Phase 2 plan authoring; complements specs/plans/phase-1-close-revised.md which owns Phase 1.5 close semantics only)
does_not_supersede:
  - specs/plans/phase-1-close-revised.md §Slice P2-MODEL-EFFORT (pulled in by reference)
  - specs/plans/phase-1-close-revised.md §Slice 25g (Phase 2 close planning slice — referenced but not rescheduled here)
status: draft — blocks on operator decision (§Target workflow for first parity)
---

# Phase 2 — Implementation Plan (2026-04-21)

## Why this plan exists

Phase 1.5 Alpha Proof closed at slice-31a (ceremony commit `0223d11`).
Phase 2 is now open per ADR-0001 Addendum B as amended by ADR-0006. This
is the first Phase 2 implementation plan. Its job is to name the arc from
the current state — a 2-step dry-run runner on a fixture (dogfood-run-0)
— to the first honest claim of **one-workflow parity with reference
Circuit**: one of the six Circuit workflows (`explore`, `build`, `repair`,
`migrate`, `sweep`, `review`) running end-to-end in circuit-next with
real agent dispatch.

This plan is **deliberately skeletal** past the near-term slices. Lane
discipline requires ≤30-minute slices; trying to fully specify 15-25
slices at authorship time would drift from the evidence as earlier
slices expose surface. Near-term slices (P2.1 through P2.5) carry full
framing; mid-term slices are named only, with their framing authored in
the slice commit that lands them.

## Entry state — what closed from Phase 1.5

See `PROJECT_STATE.md` for the authoritative snapshot. The executable
surface as of HEAD (`0223d11`):

- **Schemas (18 files):** full contract-bound type surface covering
  workflow, step, phase, run, event, snapshot, config, selection-policy,
  continuity, adapter, skill, gate, lane, manifest, primitives, rigor,
  role, ids.
- **Runtime (7 files, ~950 lines):** event-writer, event-log-reader,
  reducer, snapshot-writer, manifest-snapshot-writer, result-writer,
  runner. Closes a run end-to-end through the manifest/snapshot/event
  loop.
- **CLI:** `src/cli/dogfood.ts` wired to `npm run circuit:run` — runs the
  `dogfood-run-0` fixture through the runtime boundary.
- **Contracts (9):** adapter, config, continuity, phase, run, selection,
  skill, step, workflow — all with invariant ids and property ids bound
  to `specs/invariants.json`.
- **Behavioral concerns (3):** cross-model-challenger, prose-yaml-parity,
  session-hygiene.
- **Plugin surface:** `.claude-plugin/plugin.json` +
  `.claude-plugin/skills/dogfood-run-0/circuit.json` (a partial-spine
  workflow: plan+act only, synthesis+dispatch steps).
- **Audit:** `scripts/audit.mjs` — 21 checks (Check 21 added in 31a);
  20 green / 1 yellow (pre-discipline chore framing) / 0 red.
- **Tests:** 754 passing (701 contract + remainder unit/runner).
- **Scripts:** audit, inventory, slice:doctor.

### What the Alpha Proof did NOT prove (carried open)

Per ADR-0006 §What changes 4 and the 14a operator product-direction
check:

- Real agent dispatch (current dispatch is a dry-run fixture).
- Workflow parity with any reference Circuit workflow.
- Full spine coverage (dogfood-run-0 omits frame/analyze/verify/
  review/close).
- Per-step model + effort assignment (P2-MODEL-EFFORT reserved).
- Container isolation / distinct-UID implementer sandbox.
- Hidden test pool (`tests/properties/hidden/`).
- Plugin command registration (no `/circuit:*` slash commands wired).
- Non-LLM human cold-read evidence (retargeted per ADR-0006).

## Target workflow for first parity — OPEN QUESTION for operator

**Decision owner:** operator (product direction — per
`memory/project_circuit_next_governance.md`).

**Why the operator decides:** "which workflow to pursue first" is a
product-shape call, not a methodology call. It controls what the first
real-agent-dispatch slice feels like, which use-case circuit-next
validates first, and which contract surface gets the earliest stress.

**Options and methodology read:**

1. **`review`** — Standalone code review. **Smallest surface.** One
   dispatch step (a reviewer agent produces a verdict artifact); no
   branching. D10 operationalization (adversarial budget per rigor,
   why-continue checkpoint, review-execution alternation) already
   landed at Slice DOG+1. Showcases real agent dispatch without
   multi-step routing complexity. Fastest path to "end-to-end real
   agent call completes a workflow."
2. **`explore`** — Investigation/research. Full spine (Frame → Analyze
   → Synthesize → Review). Demonstrates the research use-case and
   exercises the full phase graph; produces a brief + analysis
   artifact pair. Medium complexity.
3. **`build`** — The doing workflow. Full spine (Frame → Plan → Act
   → Verify → Review → Close). Demonstrates the methodology as
   practiced in this repo. Highest complexity; highest value if it
   lands because it lets circuit-next build its own next slices.
4. **`repair`** — Bug fixing with test-first discipline. Similar
   complexity to build but more focused.
5. **`sweep`** — Systematic codebase sweeps. Queue/triage/batch
   discipline. Complex.
6. **`migrate`** — Large-scale migrations. Coexistence + cutover
   discipline. Most complex.

**Methodology recommendation (not a decision):** `review`. Rationale:
smallest step graph, already has D10 discipline operationalized, gives
circuit-next the ability to review its own slices as a self-hosting
feedback loop earlier than any other workflow, and isolates the
real-agent-dispatch question from routing/spine complexity. Landing
`review` first makes `explore` and `build` strictly easier to slice
afterwards because the adapter, protocol, and artifact-handling
surfaces will be shaken out.

**What unlocks with the choice:** slices P2.3 through P2.5 can be
concretely framed only after the target is named. Until the operator
picks, P2.3+ below are **tentative** and scoped against the `review`
recommendation.

## Phase 2 close criteria (draft — candidate, not locked)

These are the candidate gates for calling Phase 2 done. They are
authored here for ranging purposes and must be locked via an ADR
before any slice claims one of them. Each is independently trackable
(no aggregate scoring — CLAUDE.md hard invariant #8).

1. **One-workflow parity.** The chosen target workflow (above) runs
   end-to-end in circuit-next with real agent dispatch and produces
   the same artifact shape as the reference Circuit workflow.
2. **Real agent dispatch.** At least one non-dry-run adapter landed
   (`agent` or `codex`), with a concrete request/receipt/result
   round-trip verified in the runtime boundary.
3. **Plugin command registration.** `/circuit:<workflow>` slash
   commands exposed via `.claude-plugin/` and invokable in Claude
   Code.
4. **Session hooks.** SessionStart continuity resume and SessionEnd
   handoff wired through to circuit-engine — matches the behavior
   reference Circuit already exhibits.
5. **P2-MODEL-EFFORT landed.** Workflow contract v0.3 (explicit
   per-step model + effort assignment) with schema parity tests and
   unknown-model-id audit check.
6. **Spine policy coverage.** The target workflow exercises at least
   the canonical phases required by its kind (explore: frame/analyze/
   synthesize; build: frame/plan/act/verify/review/close).
7. **Container isolation** (deferred — Tier 2+). Phase 2 may close
   without this if an ADR explicitly re-defers; hard invariant #1-4
   remain load-bearing for any future slice that claims isolation.
8. **Close review.** Adversarial pass (Codex challenger) on Phase 2
   close claim, yield-ledger row, operator product-direction
   confirmation analogous to the 14a artifact.

## Near-term slices — P2.1 through P2.5

These slices are framed here; each still authors its own commit-body
framing per lane discipline at landing time. P2.1 and P2.2 are
target-agnostic; P2.3+ are tentative-against-`review` and may be
renamed/rescoped when the operator picks.

### P2.1 — Phase 2 close-criteria ADR (ADR-0007)

**Lane:** Ratchet-Advance (governance ratchet).

**Trajectory:** closes the "close criteria are draft prose" gap; locks
the list above into authoritative governance; no earlier slice
obsolesces this.

**Deliverable:** `specs/adrs/ADR-0007-phase-2-close-criteria.md`
capturing the eight candidates above, each with: test/check binding or
planned slice, no-aggregate-scoring reminder, and a Precedent-firewall
clause (analogous to ADR-0006 §5) preventing future retargets from
citing ADR-0007 as permission.

**Acceptance evidence:** new ADR file; Codex challenger pass recorded
in `specs/reviews/adr-0007-codex.md`; yield-ledger row; audit green.

**Alternate framing:** ADR-0007 could be authored later once P2.3
surfaces real pressure on the close criteria. Rejected because lane
discipline is weaker without an authoritative close definition —
later slices would have no anchor for "does this advance Phase 2 or
just churn."

### P2.2 — Plugin manifest hardening + command-surface scaffold

**Lane:** Ratchet-Advance (plugin-surface ratchet — first step).

**Trajectory:** closes "no `/circuit:*` commands wired" gap and opens
the path for target-workflow slice P2.3+ to attach as a real command
rather than an orphaned CLI; no earlier slice obsolesces this.

**Deliverable:** `.claude-plugin/plugin.json` expanded with the command
block (at minimum: `/circuit:run` as classifier shell, and the target
workflow's command placeholder returning "not implemented yet");
matching entries under `.claude-plugin/commands/`; audit check that
plugin.json commands are closure-consistent with
`.claude-plugin/commands/*.md` filenames.

**Acceptance evidence:** new audit check (Check 22 after Verify
renumber); tests extending `tests/contracts/governance-reform.test.ts`
or a new file; npm run audit green.

**Alternate framing:** ship plugin commands only once the target
workflow works. Rejected because the scaffold is cheap and the audit
floor grows strictly better with it in place before P2.3+ lands.

### P2.3 — Target workflow contract (tentative: `review.md`)

**Lane:** Ratchet-Advance (contract-coverage ratchet).

**Trajectory:** first concrete Phase 2 workflow contract; serves the
one-workflow-parity arc.

**Deliverable:** `specs/contracts/review.md` (or the chosen workflow's
contract) — invariants, property ids, artifact ids bound to
`specs/artifacts.json`, and `specs/contracts/<workflow>-md-codex.md`
(challenger pass). Fixture at
`.claude-plugin/skills/<workflow>/circuit.json` with full-spine phases
(not the partial-spine shape dogfood-run-0 uses).

**Acceptance evidence:** contract file + challenger review + fixture;
contract-test increment; audit green.

**Alternate framing:** start from the runtime adapter (P2.4) first and
infer the contract from adapter pressure. Rejected because contract-
first is the methodology's first pillar (CLAUDE.md §Core methodology);
adapter design without a contract anchor is a D10 gate violation.

### P2.4 — Real agent adapter — `agent` (in-process Anthropic subagent)

**Lane:** Ratchet-Advance (dispatch-realness ratchet).

**Trajectory:** first non-dry-run dispatch; real-agent-dispatch arc;
serves one-workflow-parity by being the first adapter the target
workflow can dispatch to.

**Deliverable:** `src/runtime/adapters/agent.ts` (or similar location
chosen at slice time) implementing the `ResolvedAdapter`-to-dispatch
boundary for in-process Anthropic subagent invocation. Runner
integration: `dispatch.started` event carries `resolved_adapter.name
= 'agent'`; receipt and result artifacts written with real agent
output. Dogfood fixture extended with a real-agent smoke test OR a
separate fixture `agent-smoke-0` gated behind an env var so CI can
skip it without disabling the contract test ratchet.

**Acceptance evidence:** new adapter file; dispatch round-trip test
(skippable if `AGENT_SMOKE=0`); contract test ratchet increment; audit
green.

**Alternate framing:** implement `codex` adapter first since the
`/codex` skill already has the wrapper script. Rejected because
`agent` is the simplest same-process path and isolates the adapter-
boundary question from cross-process subprocess complexity.

### P2.5 — Target workflow end-to-end fixture run

**Lane:** Ratchet-Advance (workflow-end-to-end ratchet).

**Trajectory:** first honest claim of one-workflow parity substrate;
closes the Phase 2 close criterion #1 and #2 simultaneously; serves
the one-workflow-parity arc.

**Deliverable:** a runnable fixture under `.claude-plugin/skills/<target>/`
that runs the full target workflow through the runtime boundary using
the `agent` adapter. Corresponding CLI wiring
(`npm run circuit:<target>` or a unified `npm run circuit:run
<fixture>`) and a smoke test in `tests/runner/` that verifies the
final run result byte-shape against a golden artifact.

**Acceptance evidence:** passing smoke test; golden artifacts
committed; operator product-direction check analogous to the 14a
artifact (per Phase 2 close criterion #8).

**Alternate framing:** skip the golden-artifact check and rely on
result-verdict tests only. Rejected because byte-shape goldens catch
drift that verdict-only tests miss (H5 / dogfood parity lesson from
Phase 1.5).

## Mid-term slices — named, framing authored at landing

Order is intent, not commitment. Each slice authors framing at its
commit time. Expect re-ordering as earlier slices expose surface.

- **P2.6 — `codex` adapter** (second adapter; cross-process; extends
  `agent` surface).
- **P2.7 — Session hooks** — SessionStart continuity resume +
  SessionEnd handoff, wired through `.claude/hooks/` to circuit-engine.
- **P2.8 — Router (`/circuit:run` classifier)** — first-class
  workflow classifier: given task text + entry signals, selects among
  registered workflows.
- **P2-MODEL-EFFORT — workflow v0.3: explicit model + effort
  assignment.** Already reserved at commit `b538979` and specified in
  `specs/plans/phase-1-close-revised.md §Slice P2-MODEL-EFFORT`.
  Triggers once P2.3 and at least one adapter land.
- **P2.9 — Second target workflow** (whichever wasn't picked as
  first). Proves the contract/adapter/fixture pattern generalizes.
- **P2.10 — Artifact schema set** — at least the core artifact
  schemas the target workflows emit (brief, analysis, synthesis,
  result, verdict).
- **P2.11 — Plugin-level skill wiring** — user-invocable skills that
  wrap `/circuit:<workflow>` commands so the plugin-user UX matches
  reference Circuit.

## Deferred to Phase 2+ (named but not scheduled)

- Container isolation / distinct-UID implementer sandbox
  (hard invariant #1-3; defers to Tier 2+ substrate slice).
- Hidden test pool (`tests/properties/hidden/`) + opaque rotation.
- Mutation testing gate.
- Anti-Goodhart ratchet machinery (quarantine, versioned floors,
  fingerprinting, meta-ratchets).
- Solo-approval protocol for ratchet weakening.
- Registry-lookup install wrapper (firewalled network).
- Intelligent routing selector (post-P2-MODEL-EFFORT; needs usage
  data).
- Third-voice cross-model challenger (beyond Claude+Codex; Knight-
  Leveson hedge).
- `circuit:create` — custom workflow authoring UX.
- `circuit:handoff` — full workflow parity (currently served by
  `circuit-engine continuity`; graduating to workflow-shaped is its
  own arc).

## Product ratchets Phase 2 will carry

Inherited from Phase 1.5 close (per phase-1-close-revised.md §Product
Ratchets) — these continue as headline audit signals:

- `runner_smoke_present`
- `workflow_fixture_runs`
- `event_log_round_trip`
- `snapshot_derived_from_log`
- `manifest_snapshot_byte_match`
- `status_docs_current`
- `tier_claims_current`

Phase 2 adds (bound to close criteria above):

- `dispatch_realness` — at least one non-dry-run adapter registered
  and exercised by a fixture (criterion #2).
- `workflow_parity_fixtures` — count of target workflows with
  full-spine fixtures (criterion #1, #6).
- `plugin_surface_present` — `.claude-plugin/commands/*.md` closure
  with `plugin.json` command block (criterion #3).

## Review fold-ins

Not yet reviewed. A Codex challenger pass on this plan is scheduled
before P2.1 lands; fold-ins will amend this file rather than replace
it.

## Open questions

1. **Target workflow for first parity.** Operator decision (see
   above). Blocks concrete framing of P2.3+.
2. **Adapter precedence — `agent` vs `codex` first?** P2.4 assumes
   `agent`; if the operator wants `codex` first (Codex is the Knight-
   Leveson challenger voice already in the methodology), flip P2.4 /
   P2.6.
3. **Phase 2 close criterion #7 — container isolation.** Close with
   it or re-defer by ADR at P2.1 / ADR-0007 authoring time?
4. **Golden-artifact location and hashing scheme.** Phase 2 should
   lock this before P2.5 lands; candidate: sha256 over
   normalized-JSON result artifacts, stored under
   `tests/fixtures/golden/<workflow>/`.
5. **Spine policy for `review`** (if picked first). Reference Circuit
   treats `review` as single-phase; circuit-next's spine policy allows
   `mode: partial` (dogfood-run-0 uses it). Does `review` need
   partial-spine or a canonical full-spine with most phases empty?
   Contract-authoring call; addressed in P2.3.
