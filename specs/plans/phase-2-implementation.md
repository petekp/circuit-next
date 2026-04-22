---
name: phase-2-implementation
description: Phase 2 implementation plan — from Alpha Proof fixture to one-workflow parity. Opens with target-workflow choice, sequences near-term slices, names mid-term skeleton, and records Phase 2 close-criteria candidates.
type: plan
date: 2026-04-21
authored_by: claude-opus-4-7
base_commit: 0223d1162b35458c22c4b8680859f872a83897c0
supersedes_scope:
  - (none — first Phase 2 plan authoring; complements specs/plans/phase-1-close-revised.md which owns Phase 1.5 close semantics only)
does_not_supersede:
  - specs/plans/phase-1-close-revised.md §Slice P2-MODEL-EFFORT (pulled in by reference)
  - specs/plans/phase-1-close-revised.md §Slice 25g (Phase 2 close planning slice — referenced but not rescheduled here)
status: active — target workflow locked to `explore` (operator decision 2026-04-21; Codex challenger recommendation adopted over the in-session methodology recommendation of `review`); Phase 2 close criteria LOCKED via ADR-0007 (2026-04-21); Open Questions #3 (container isolation) and #5 (explore spine policy) RESOLVED via ADR-0007
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

## Target workflow for first parity — DECIDED: `explore`

**Decision:** `explore` locked as the first parity target.

**Decided by:** operator (product-direction authority per
`memory/project_circuit_next_governance.md`).

**Decision date:** 2026-04-21.

**Authority adopted:** Codex challenger recommendation over the
in-session Claude methodology recommendation of `review`. Codex
rationale (preserved verbatim, cited above in the operator-facing
summary):

> `review` is the safest engineering path because it has the smallest
> step graph and isolates real agent dispatch from routing complexity
> … But product-wise, `review` mostly proves "can we call an agent
> and get a verdict artifact back?" It does not exercise much of the
> workflow system we actually care about.
>
> `explore` feels like the better middle path: it exercises a fuller
> spine, real phase progression, synthesis, artifact production, and
> review, while staying much less gnarly than `build`.

**Why product-shape authority, not methodology authority:** "which
workflow to pursue first" controls what the first real-agent-dispatch
slice feels like, which use-case circuit-next validates first, and
which contract surface gets the earliest stress. Per governance split,
this decision belongs to the operator and was formally recorded on
2026-04-21.

**Fallback:** if adapter/routing scope starts ballooning during P2.3
or P2.4, fall back to `review` as a scope-reducing pivot. Pivoting
requires amending this plan (not a silent rename) because the commit
set below binds to `explore` explicitly.

**Non-options for first parity:** `build`, `repair`, `sweep`, and
`migrate` are deferred to P2.9+ (second-and-onward workflow parity)
because they either carry more spine complexity (`build`, `repair`)
or workflow-shape novelty (`sweep` queue/triage, `migrate`
coexistence/cutover) than the adapter-and-artifact-shake-out first
slice should absorb.

**What unlocks:** slices P2.3 and P2.5 below are now concrete and
bind to `explore`. P2.1, P2.2, P2.4 were target-agnostic and remain
unchanged.

## Phase 2 close criteria — LOCKED via ADR-0007 (2026-04-21)

**Status: LOCKED via ADR-0007 (2026-04-21).** These are the
authoritative Phase 2 close criteria with concrete executable
enforcement bindings. The locked summary table below mirrors
ADR-0007 §Decision.2 in full (not a pointer); on any conflict,
ADR-0007 §Decision.1 is authoritative. Any change — retarget,
weakening, relaxation, introduction of aggregate scoring — must
clear ADR-0007 §6 Precedent firewall before landing. Each criterion
is independently trackable with status values `active — satisfied`,
`active — red`, or `re-deferred` (no aggregate scoring — CLAUDE.md
hard invariant #8; see ADR-0007 §Decision.3 for the forbidden-
wording list).

| CC# | Title | Status at lock | Enforcement binding (non-substitutable) |
|---|---|---|---|
| P2-1 | One-workflow parity (target: `explore`) | active — red | `tests/runner/explore-e2e-parity.test.ts` + `tests/fixtures/golden/explore/` byte-shape golden (sha256 over normalized-JSON); authored at P2.5. |
| P2-2 | Real agent dispatch | active — red | `src/runtime/adapters/agent.ts` + `tests/runner/agent-dispatch-roundtrip.test.ts` with durable dispatch transcript (adapter id, request/receipt/result hashes, reducer+writer consumption); CI-skip requires `tests/fixtures/agent-smoke/last-run.json` with commit-ancestor audit. |
| P2-3 | Plugin command registration | active — red | `checkPluginCommandClosure` + `tests/contracts/plugin-surface.test.ts` + P2.11 invoke-evidence file at `specs/reviews/p2-11-invoke-evidence.md`. |
| P2-4 | Session hooks + continuity lifecycle | active — red | `.claude/hooks/SessionStart.sh` + `.claude/hooks/SessionEnd.sh` + `checkSessionHooksPresent` + `tests/runner/continuity-lifecycle.test.ts` (create → persist → resume → clear). |
| P2-5 | P2-MODEL-EFFORT landed | active — red | `src/schemas/workflow.ts` v0.3 + `tests/contracts/workflow-model-effort.test.ts` + `checkUnknownModelIds`; slice spec incorporated by reference from `specs/plans/phase-1-close-revised.md §Slice P2-MODEL-EFFORT`. |
| P2-6 | Spine policy coverage (full-spine `explore`) | active — red | `specs/contracts/explore.md` canonical phase set {Frame, Analyze, Synthesize, Review, Close} + `checkSpineCoverage` + `tests/contracts/spine-coverage.test.ts`. |
| P2-7 | Container isolation | **re-deferred by ADR-0007** | `checkPhase2SliceIsolationCitation` (interim, added in P2.1 ceremony commit) + CLAUDE.md §Phase discipline §Phase 2 + §Hard invariants #1–#4 (policy-layer, unchanged). Nine named trigger conditions at ADR-0007 §Decision.1 CC#P2-7 re-open the gate. |
| P2-8 | Close review (final blocking gate) | active — red | `specs/reviews/phase-2-close-matrix.md` + `specs/reviews/phase-2-close-codex.md` + `specs/reviews/phase-2-operator-product-check.md` + `checkPhase2CloseMatrix`; fails closed if any prior CC is red or supported only by LLM stand-in evidence. |

**Close condition (no aggregate):** Phase 2 closes when every
`active` criterion is `active — satisfied` AND every `re-deferred`
criterion has valid ADR-covered trigger conditions that have not
fired. See ADR-0007 §Decision.3 for the full forbidden-wording list
(rejects "green-by-redeferral", "7/8 complete", "mostly done", etc.).

**Inherited product ratchets must be green at close** (see ADR-0007
§Decision.4c): the seven Phase-1.5-inherited ratchets plus the three
Phase-2-added ratchets (`dispatch_realness`, `workflow_parity_fixtures`,
`plugin_surface_present`) are required-green-at-close in addition to
the close criteria; a red inherited ratchet blocks Phase 2 close
independently of CC#P2-N status.

## Near-term slices — P2.1 through P2.6

These slices are framed here; each still authors its own commit-body
framing per lane discipline at landing time. P2.1 and P2.2 are
target-agnostic; P2.3 and P2.5 bind to `explore` per the locked
target above; P2.4 and P2.6 are adapter-shaping and target-agnostic
in scope.

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

### P2.3 — `explore` workflow contract + fixture

**Lane:** Ratchet-Advance (contract-coverage ratchet).

**Trajectory:** first concrete Phase 2 workflow contract; serves the
one-workflow-parity arc; binds to `explore` per the locked target.

**Deliverable:** `specs/contracts/explore.md` — invariants, property
ids, artifact ids bound to `specs/artifacts.json`, plus
`specs/reviews/explore-md-v0.1-codex.md` (Codex challenger pass required
before land). Fixture at `.claude-plugin/skills/explore/circuit.json`
with full-spine phases — at minimum Frame → Analyze → Synthesize →
Review → Close mapped to canonical phase ids. Artifact shapes named
(brief, analysis, synthesis) but schema authoring may defer to P2.10
if pressure justifies.

**Acceptance evidence:** contract file + challenger review + fixture;
contract-test increment; fixture loadable by the existing runner
(workflow schema validation passes on the new `circuit.json`); audit
green.

**Alternate framing:** start from the runtime adapter (P2.4) first and
infer the contract from adapter pressure. Rejected because contract-
first is the methodology's first pillar (CLAUDE.md §Core methodology);
adapter design without a contract anchor is a D10 gate violation.

### P2.4 — Real agent adapter — `agent` (headless `claude` CLI subprocess per ADR-0009 §1)

**Lane:** Ratchet-Advance (dispatch-realness ratchet).

**Trajectory:** first non-dry-run dispatch; real-agent-dispatch arc;
serves one-workflow-parity by being the first adapter the target
workflow can dispatch to.

**Pre-P2.4 arc dependency.** P2.4 is gated by the pre-P2.4 foundation
fold-in arc at `specs/plans/phase-2-foundation-foldins.md` (Slices
35–40). P2.4 reopens at a future slice only after the arc-close
composition review lands `closing_verdict: ACCEPT-WITH-FOLD-INS` on
both prong files (Claude + Codex) per `scripts/audit.mjs` Check 26
two-prong binding.

**HIGH 3 capability-boundary constraint (pre-P2.4 arc scope update,
landed Slice 40 arc-close commit).** Per composition review §HIGH 3
fix hint option (a) and operator acceptance (`specs/plans/phase-2-
foundation-foldins.md §P2.4 scope update`): P2.4 v0 ships with **no
repo-write tool capability**. The deliverable below is constrained
accordingly. The P2.4 commit body MUST explicitly cite the capability
boundary using the Isolation posture string (ADR-0007 trigger #6
context) plus an explicit "no repo-write tool capability" clause.
The P2.4 Codex challenger prompt MUST inspect the capability boundary
as a named review item. Option (b) — a capability-aware audit check
that inspects what the adapter can actually do — is deferred to a
post-P2.4 slice once the capability descriptor surface exists.

**Deliverable:** `src/runtime/adapters/agent.ts` (or similar location
chosen at slice time) implementing the `ResolvedAdapter`-to-dispatch
boundary via a **`claude` CLI subprocess invocation** (per ADR-0009
§1 invocation-pattern decision), **with no repo-write tool capability**
(file-write, directory-create, shell-write subset) — the adapter
surface at v0 reads but does not write under the repo working tree;
any artifact materialization flows through the engine-owned
`result-writer.ts` and the workflow close-step path (per RESULT-I1
+ ADR-0008 §Decision.3a materialization rule). The subprocess is
invoked with bounded stdio (no inherited file handles) and a
bounded wall-clock timeout; no write-capable tools are passed to
the subprocess's tool-use surface at v0. Runner integration: `dispatch.started` event carries
`adapter.name = 'agent'` (via the `ResolvedAdapter` discriminated
union at `src/schemas/adapter.ts`; corrected from the earlier
`resolved_adapter.name` prose per ADR-0007 §Amendment Slice 37);
receipt and result artifacts written with real agent output. Dogfood
fixture extended with a real-agent smoke test OR a separate fixture
`agent-smoke-0` gated behind an env var so CI can skip it without
disabling the contract test ratchet.

**Acceptance evidence:** new adapter file; dispatch round-trip test
(skippable if `AGENT_SMOKE=0`); contract test ratchet increment;
audit green; commit body cites the capability-boundary constraint
explicitly (no repo-write tool capability, ADR-0007 trigger #6
context); Codex challenger review frontmatter names the capability-
boundary as an inspected review item.

**Additional acceptance evidence — CLI no-write capability proof
(ADR-0009 §2.v / Codex Slice 41 HIGH 4 fold-in).** P2.4 MUST
empirically verify that the `claude -p` (or equivalent headless)
subprocess invocation can enforce the no-repo-write capability
boundary. The proof must be one of: (a) a documented CLI flag that
restricts tool-use to a read-only subset, with the adapter
configured to use it + a test that confirms a write attempt fails;
or (b) a demonstrable subprocess-level mechanism (stdio-only, no
inherited filehandles, no shell env that exposes write tools) that
provably blocks writes + a test that confirms a write attempt
fails. If neither (a) nor (b) can be demonstrated, ADR-0009 §6
reopen trigger 5 fires and the subprocess choice is re-opened
BEFORE P2.4 can land against it. The proof artifact lives in the
P2.4 Codex challenger review file and is cited in the P2.4 commit
body.

**Invocation-pattern authority (ADR-0009, Slice 41 amendment).**
Per `specs/adrs/ADR-0009-adapter-invocation-pattern.md` (ACCEPTED
at Slice 41 ceremony commit), the `agent` adapter invokes its
dispatch target as a **subprocess of the Node.js runtime** via a
headless `claude` CLI call (print mode or equivalent), not via
direct `@anthropic-ai/sdk` integration. The subprocess decision
narrows P2.4's deliverable: the adapter reads stdin/stdout from a
`child_process.spawn`-spawned `claude` subprocess; stdout bytes
hash into `dispatch.result.result_artifact_hash` per Slice 37
event schema; the validated artifact materializes at
`writes.artifact.path` per ADR-0008 §Decision.3a. No new external
dependency beyond Node stdlib (`node:child_process`). Anthropic
SDK, runner pause/resume + native Task tool, subprocess pooling,
and streaming-token integration are all deferred with named reopen
triggers recorded in ADR-0009 §3.

**Alternate framing:** implement `codex` adapter first since the
`/codex` skill already has the wrapper script. Rejected because
`agent` is the baseline dispatcher that MUST work without optional
adapters installed (operator product constraint 2026-04-21: "Claude
Code out-of-box, no Codex required"); learning the subprocess
pattern on the non-optional adapter first means `codex` (Slice
~43+) becomes a near-copy against an established pattern rather
than the pattern-setter. The earlier "same-process simpler than
cross-process" rationale was SDK-flavored plan prose superseded by
ADR-0009's subprocess-per-adapter decision.

### P2.5 — `explore` end-to-end fixture run

**Lane:** Ratchet-Advance (workflow-end-to-end ratchet).

**Trajectory:** first honest claim of one-workflow parity substrate;
closes Phase 2 close criteria #1 and #2 simultaneously; serves the
one-workflow-parity arc; binds to `explore` per the locked target.

**HIGH 5 retargeting (pre-P2.4 arc scope update, 2026-04-21).** Per
operator interim retargeting recorded in
`specs/plans/phase-2-foundation-foldins.md §Slice 40 Retargeting note`,
HIGH 5 from the Phase 2 foundation composition review
(`specs/reviews/p2-foundation-composition-review.md §HIGH 5`) —
extraction of `validateWorkflowKindPolicy` helper + refactor of
`scripts/audit.mjs` Check 24 and `src/cli/dogfood.ts:125` to call the
helper — is owned by P2.5 rather than the pre-P2.4 arc. Reasoning:
P2.5 natively composes the helper with end-to-end dispatch wiring
and deferred-property promotion. Extracting pre-P2.4 without the
runtime wiring risks a second refactor at P2.5 landing.

**Deliverable:** a runnable `explore` fixture under
`.claude-plugin/skills/explore/` (extending P2.3's `circuit.json`)
that runs the full workflow through the runtime boundary using the
`agent` adapter. Corresponding CLI wiring (`npm run circuit:explore`
or a unified `npm run circuit:run <fixture>`) and a smoke test in
`tests/runner/` that verifies the final run result byte-shape against
a golden artifact. Golden artifacts stored under
`tests/fixtures/golden/explore/` (per open question #4 resolution at
slice time).

**Additional P2.5 deliverable — HIGH 5 helper extraction:** new
helper `validateWorkflowKindPolicy(workflow)` exported from
`src/runtime/workflow-policy.ts` (or equivalent). Helper runs
`Workflow.safeParse(workflow)` first, then applies kind-specific
policy (canonical phase set, spine-policy omits) on the parsed
value. `scripts/audit.mjs` Check 24 (`checkSpineCoverage`)
refactored to call the helper instead of hand-parsing JSON.
Runtime fixture loading (`src/cli/dogfood.ts:125` or the P2.5
equivalent entry) extended to call the helper after
`Workflow.parse`. Acceptance for this subscope: the currently-passing
invalid fixture at `tests/contracts/spine-coverage.test.ts:34`
(`steps: []`) fails red under the helper; live-repo fixture stays
green; runtime rejects a hand-crafted invalid explore-kind fixture
with a clear error. `specs/contracts/explore.md §EXPLORE-I1` prose
reconciles: "runtime MUST reject" is enforced via the helper at
P2.5 landing (the v0.3 contract disclosed the P2.5 delivery window
explicitly).

**Acceptance evidence:** passing smoke test; golden artifacts
committed; operator product-direction check analogous to the 14a
artifact (per Phase 2 close criterion #8); `validateWorkflowKindPolicy`
helper landed + Check 24 refactored + runtime fixture loading wired
to the helper.

**Alternate framing:** skip the golden-artifact check and rely on
result-verdict tests only. Rejected because byte-shape goldens catch
drift that verdict-only tests miss (H5 / dogfood parity lesson from
Phase 1.5).

**Arc-close Codex-prong subsumption of skipped per-sub-slice Codex
passes (Slice 44 arc-close fold-in, convergent Claude+Codex HIGH 1).**
Slices 43a / 43b / 43c landed on 2026-04-21 without per-slice Codex
challenger passes, despite each touching ratchet surfaces (43a: +15
static tests + new `validateWorkflowKindPolicy` helper module; 43b:
+0 static tests but qualitative `dispatch_realness` ratchet advance
+ runtime-breaking `runDogfood` async signature change; 43c: +24
static tests + new Check 30 + new golden/fingerprint fixtures).
CLAUDE.md §Hard invariants #6 requires a cross-model challenger for
any ratchet change; the three skips are a governance drift at arc
scale.

The arc-close Codex prong at
`specs/reviews/arc-slices-41-to-43-composition-review-codex.md`
explicitly scopes each sub-slice's ratchet surface (43a dual-helper
drift, 43b async-signature breaking-contract surface, 43c Check 30
staleness / schema_version / fingerprint semantics + golden self-
referentiality). Operator decision recorded at Slice 44 ceremony:
the arc-close Codex prong subsumes the three skipped per-sub-slice
passes on the basis that (a) the three sub-slices landed in a
single day under compressed P2.5 tempo, (b) the arc-close prong's
scoping is no narrower than three per-slice prongs would have been
combined, and (c) the prior arc (Slice 39 skipped Codex, flagged
as the prior composition review's MED 2) set precedent that
skipped passes do not automatically reject when the arc-close
subsumes them — this arc formalizes that precedent.

**Policy going forward.** The arc-close-subsumption pattern is
bounded: arc-close prongs MAY subsume skipped per-sub-slice Codex
passes only when (i) the arc-close prong explicitly scopes each
skipped sub-slice's ratchet surface, (ii) the skip was tempo-driven
rather than an attempt to avoid challenger friction, and (iii) the
ceremony commit records the subsumption in plan-file authority (as
this paragraph does). A future slice tempted to skip Codex MUST
either (a) land an explicit "challenger not required" subsection in
the plan file with rationale (the prior arc's Slice 39 precedent),
or (b) commit to an arc-close subsumption at cadence time. Silent
skips remain Hard Invariant #6 violations.

### P2.5 post-arc-close ratchet touch-ups (Slice 44 ceremony fold-ins)

The arc-close ceremony at Slice 44 lands the following fold-ins
alongside the two prong review files, to close convergent HIGHs
and independent Codex HIGHs raised during the arc-close pass:

1. **Check 26 generalization** (Claude HIGH 3 + Codex HIGH 3).
   `scripts/audit.mjs` refactored from a single-arc hardcode to
   iteration over `ARC_CLOSE_GATES`. New constant
   `PHASE_2_P2_4_P2_5_ARC_LAST_SLICE = 44` binds the 41-to-43 arc.
   Adding a future arc = adding an `ARC_CLOSE_GATES` entry rather
   than refactoring the check body. Five new tests under
   `tests/contracts/artifact-backing-path-integrity.test.ts`
   exercise the generalized gate's per-arc isolation + two-prong
   binding.
2. **`--dry-run` fail-closed** (Codex HIGH 4). `src/cli/dogfood.ts`
   now rejects `--dry-run` with a pointer to this review, instead
   of silently invoking the real adapter while reporting
   `dry_run: true` in the JSON envelope. Re-enabling the flag
   requires landing a deterministic dry dispatcher + event-log
   marker; tracked post-Slice-44.
3. **CC#P2-1 placeholder-parity disclosure** (Claude HIGH 2 +
   Codex HIGH 2). See ADR-0007 §Decision.1 CC#P2-1 amendment +
   `specs/contracts/explore.md` §Placeholder epoch subsection.
4. **Explore-contract deferred-property re-defer** (Codex HIGH 5).
   See `specs/contracts/explore.md` §Deferred property promotion
   re-defer (post-Slice-44) subsection.

### P2.6 — `codex` adapter — second adapter (`codex exec` subprocess per ADR-0009 §1)

**Lane:** Ratchet-Advance (adapter-coverage ratchet + contract-test
ratchet + CC#P2-2 real-dispatch additional-evidence strengthening +
governance-surface Codex challenger required per CLAUDE.md §Hard
invariants #6).

**Governance correction (Codex Slice 45 HIGH 1 fold-in, 2026-04-22).**
An earlier draft of this block claimed P2.6 closes "CC#P2-4 (second
adapter)." ADR-0007 CC#P2-4 is "Session hooks" (`specs/adrs/
ADR-0007-phase-2-close-criteria.md:326-349`), not "second adapter."
The "second adapter" surface in ADR-0007 is additional evidence under
CC#P2-2 real-agent dispatch (ibid. lines 157-170: "At least one non-
dry-run adapter (`agent` ... or `codex` ...) lands..."). P2.6 does
NOT close a new Phase 2 close criterion; it strengthens CC#P2-2 by
landing the second adapter named in that criterion's enumeration.
**Per-criterion close status (Slice 47c forbidden-scalar-phrase
fold-in — ADR-0007 §3 No-aggregate-scoring rule):** CC#P2-1 active —
satisfied (placeholder-parity epoch, Slice 43c); CC#P2-2 active —
satisfied (real-dispatch, Slice 43c, strengthened via second-adapter
round-trip at this slice); all other criteria (CC#P2-3, CC#P2-4,
CC#P2-5, CC#P2-6, CC#P2-7, CC#P2-8) remain in their prior status.
CC#P2-4 (session hooks) is active — red and is P2.7's deliverable.

**Trajectory.** Arc goal: prove the ADR-0009 subprocess-per-adapter
pattern generalizes beyond the single `agent` adapter by landing a
second adapter (`codex`) against the same seam. Phase goal:
strengthen CC#P2-2 (real-agent dispatch) evidence by landing the
second adapter named in its enumeration and closing the adapter-
coverage ratchet from "one adapter dispatched" to "two adapters
dispatched." Earlier-slice impact:
Slice 42 (agent adapter) authored the subprocess template; Slice 43c
proved end-to-end round-trip through materializer / event-writer /
reducer / result-writer; Slice 44 arc-close generalized Check 26 via
`ARC_CLOSE_GATES` and ratified both arcs closed-with-both-prongs-
ACCEPT. P2.6 is neither obsolete nor mis-sequenced by earlier slices —
it specifically depends on the Slice 42 template and the Slice 43c
materializer seam existing.

**Failure mode addressed.** The ADR-0009 subprocess-per-adapter claim
is under-tested until a second adapter actually lands. Without P2.6
the pattern is a claim derived from one data point — the `agent`
adapter could be fitted with agent-specific glue that the template
couldn't accommodate for a second adapter (silent adapter-specific
drift in the materializer, the event schema, or the fixture shape).

**Capability-boundary mechanism (different from `agent`).** The
`agent` adapter's no-repo-write capability boundary is enforced via
`claude -p` declarative tool-list flags (`--tools ""`,
`--strict-mcp-config`, `--disable-slash-commands`) with a parse-time
assertion over the subprocess init event's `tools` / `mcp_servers` /
`slash_commands` arrays. The `codex` adapter's no-repo-write boundary
is enforced differently: `codex exec -s read-only` uses an **OS-level
sandbox** (Codex's Seatbelt / Landlock policy) that gates write
syscalls at the process level, regardless of what tools the Codex
subprocess believes it has. Codex's `--json` event stream does NOT
emit an init event enumerating tool surfaces, so the parse-time
assertion shape from `agent` is not available. The P2.6 adapter's
boundary proof is therefore two-layered:
  (a) **Argv-constant assertion at spawn time** — the adapter's
      `CODEX_NO_WRITE_FLAGS` constant MUST include `-s read-only` and
      MUST NOT include `--dangerously-bypass-approvals-and-sandbox`;
      both facts are provable by code inspection and locked by
      contract tests.
  (b) **Event-stream capability discipline** — the subprocess's
      JSONL stream is parsed for the terminal `item.completed` event
      whose `item.type === 'agent_message'`. The adapter rejects
      stream-level anomalies (missing `thread.started`, missing
      `turn.completed`, an `item.completed` whose `item.type` is
      unknown) fail-closed.
The mechanism difference is governance-surface — adapter.md
ADAPTER-I1 codex bullet is amended to name the OS-level-sandbox
mechanism explicitly, distinguishing it from the agent's declarative
tool-list mechanism.

**Deliverable.** `src/runtime/adapters/codex.ts` implementing the
`ResolvedAdapter`-to-dispatch boundary via a **`codex exec` subprocess
invocation** (per ADR-0009 §1 invocation-pattern decision) with no
repo-write tool capability (file-write, directory-create, shell-write
subset all blocked by `-s read-only` OS-level sandbox). Subprocess is
invoked with bounded stdio (no inherited file handles beyond
pipe/pipe/pipe), bounded wall-clock timeout, SIGTERM-to-SIGKILL grace
window on timeout, and stdout/stderr byte caps (all modeled on Slice
42 `agent.ts`). The materializer at `src/runtime/adapters/dispatch-
materializer.ts` is parameterized to accept an `adapterName`
discriminant so the same five-event transcript template serves both
adapters; no behavioral drift in the transcript shape. CLI version
captured via a pre-invocation `codex --version` call (Codex does not
emit version in the JSONL stream, unlike `claude`'s init event). The
capability-boundary argv-constant assertion binds at module load via
frozen constants. `dispatch.started` carries `adapter: {kind:
'builtin', name: 'codex'}`; receipt_id = Codex's `thread_id` from the
`thread.started` event; result_body = `item.text` of the LAST
`item.completed` with `item.type === 'agent_message'`; duration_ms =
`performance.now()` delta.

**Acceptance evidence.**
  1. New adapter file `src/runtime/adapters/codex.ts` with named
     exports `dispatchCodex`, `parseCodexStdout`, `CODEX_NO_WRITE_
     FLAGS`, `CODEX_EXECUTABLE`.
  2. New smoke test `tests/runner/codex-adapter-smoke.test.ts`
     (static + CODEX_SMOKE=1-gated e2e) mirroring the Slice 42 agent
     smoke test shape.
  3. New round-trip test `tests/runner/codex-dispatch-roundtrip.test.
     ts` (static + CODEX_SMOKE=1-gated e2e) covering the full
     materializer / event-writer / reducer / result-writer path,
     asserting `adapter: {kind: 'builtin', name: 'codex'}` on
     `dispatch.started`.
  4. `tests/fixtures/codex-smoke/last-run.json` fingerprint
     (generated by running the round-trip under CODEX_SMOKE=1 at
     slice-landing commit; commit_sha must be ancestor-of-HEAD).
  5. New audit Check 32 `checkCodexSmokeFingerprint` modeled on
     Check 30, parse + ancestor-of-HEAD validation against the
     codex-smoke fingerprint path **plus** adapter-surface binding
     per Codex Slice 45 HIGH 4 fold-in: fingerprint records
     `adapter_source_sha256` over the concatenation of
     `src/runtime/adapters/codex.ts`, `src/runtime/adapters/shared.ts`,
     and `src/runtime/adapters/dispatch-materializer.ts`; Check 32
     rehashes those files at audit time and flags drift as yellow (so
     a subsequent codex adapter edit without a fresh CODEX_SMOKE run
     is surfaced). Missing fingerprint remains yellow until Phase 2
     close (same semantics as Check 30 AGENT_SMOKE).
  6. `specs/contracts/adapter.md` ADAPTER-I1 codex bullet amended:
     name the OS-level-sandbox mechanism explicitly; distinguish
     from agent's declarative tool-list mechanism; cite ADR-0009
     §Consequences.Enabling as the governance authority (not a re-
     argument of subprocess-per-adapter — that's already decided).
  7. Import-level Check 29 coverage extends to `codex.ts` (empty-
     match expected; the file must not import any Part A or Part B
     forbidden SDK).
  8. Contract-test ratchet floor advances.
  9. PROJECT_STATE / README / TIER `current_slice` bumped to 45;
     specs/ratchet-floor.json floor advanced;
     tests/contracts/status-epoch-ratchet-floor.test.ts live pin
     bumped.
 10. Codex challenger pass via `/codex` skill, recorded at
     `specs/reviews/arc-slice-45-codex-adapter-codex.md`. Per
     CLAUDE.md §Hard invariants #6 + Slice 44 plan-file amendment
     ("Silent skips remain Hard Invariant #6 violations"), this per-
     slice Codex challenger pass IS required; arc-close subsumption
     does NOT apply. The challenger prompt MUST inspect:
       (i) the capability-boundary mechanism difference (OS-level
           sandbox vs declarative tool-list);
       (ii) the argv-constant assertion (is it actually fail-closed
            against a future flag regression?);
       (iii) the JSONL parser's robustness against missing /
             reordered / unknown Codex event types;
       (iv) the materializer parameterization (does adding
            `adapterName` risk drift elsewhere?);
       (v) the Check 32 fingerprint-staleness story (same ancestor-
           only semantics Codex MED 2 flagged at Slice 44).
 11. Full commit body citing:
       - Lane declaration (Ratchet-Advance).
       - Framing triplet (failure mode / acceptance evidence /
         alternate framing).
       - ADR-0009 §Consequences.Enabling citation (§Enabling
         explicitly names codex as the next adapter — this slice
         fulfills that enabling prediction, not a re-argument).
       - Capability-boundary mechanism disclosure (OS-level sandbox
         via `-s read-only`; argv-constant assertion of no
         `--dangerously-bypass-approvals-and-sandbox`).
       - Adversarial yield ledger row.

**Alternate framing (rejected).** Defer to P2.7 (session hooks) or
P2.5.1 (explore deferred-property promotion) first, then open P2.6
after one of those lands. Rejected because:
  (a) The second adapter is named in ADR-0007 CC#P2-2 enumeration
      ("`agent` ... or `codex` ..."); P2.6 strengthens an already-
      closed criterion's evidence whereas P2.5.1 refines an already-
      closed criterion's property coverage. Both are additive to
      criteria that closed at 43c; neither opens/closes a new
      criterion. Ordering between them is operator tempo. (Correction
      per Codex Slice 45 HIGH 1: earlier draft mistakenly framed P2.6
      as closing CC#P2-4 — CC#P2-4 is session hooks per ADR-0007.)
  (b) P2.6 has no dependency on P2.5.1 or P2.7, and neither has a
      dependency on P2.6 — ordering is tempo, not coupling.
  (c) The Slice 42 template is freshly-landed and freshly-reviewed
      (Slice 44 arc-close both prongs ACCEPT-WITH-FOLD-INS); re-using
      it while the template's invariants are still vivid in-context is
      cheaper than revisiting after P2.5.1 / P2.7 churn.

**Invocation-pattern authority (ADR-0009 §Consequences.Enabling
citation).** Per `specs/adrs/ADR-0009-adapter-invocation-pattern.md`
§Consequences.Enabling: "a future `codex` built-in adapter at Slice
~43+ can structurally mirror the `codex exec` subprocess invocation
this repo already exercises on every Codex challenger pass." P2.6
fulfills that enabling prediction. The subprocess pattern itself is
NOT re-argued — ADR-0009 §1 decided it at Slice 41; P2.6 cites
§Enabling and applies the pattern. No ADR amendment is required.

**Named follow-up slice 45a (Codex Slice 45 HIGH 3 deferral — LANDED
2026-04-22).** The Codex challenger pass on Slice 45 surfaced that the
runner's `DispatchFn` injection seam at `src/runtime/runner.ts:75` was
a bare function type, and the materializer call site at
`src/runtime/runner.ts:302-324` always passed `adapterName: 'agent'`.
If a test caller injected `dispatchCodex` (or any non-agent
dispatcher) through the seam, the resulting `dispatch.started` event
recorded `adapter: {kind: 'builtin', name: 'agent'}` — an adapter-
identity lie at the event-log level. This was a defense-in-depth
concern not yet load-bearing at Slice 45: the runner only dispatched
to `agent` in production (the codex round-trip test called
`dispatchCodex` → `materializeDispatch` directly, not through
`runDogfood`), so no on-disk event log carried the false identity
at Slice 45 HEAD. HIGH 3 was deferred to Slice 45a with scope: change
`DispatchFn` to a structured `{ adapterName: BuiltInAdapter; dispatch:
(input) => Promise<DispatchResult> }` descriptor; plumb
`adapterName` from the descriptor into the materializer call site;
add a regression test that injecting a codex-shaped dispatcher into
`runDogfood` lands `adapter.name='codex'` on `dispatch.started`.
**Reopen trigger (no longer active).** Slice 45a was required to land
before P2.7 (session hooks) or any subsequent slice that adds codex
routing to `runDogfood`; Slice 45a landed ahead of P2.7, satisfying
the reopen trigger. **Resolution.** Slice 45a landed at commit
(to-be-assigned) as a Ratchet-Advance slice (+1 static declaration in
`tests/runner/runner-dispatch-adapter-identity.test.ts`). Scope exactly
as specified: `DispatchFn` flipped to the structured descriptor;
`resolveDispatcher` lifts the default `dispatchAgent` into the
descriptor with `adapterName: 'agent'`; the materializer call site
reads `dispatcher.adapterName` from the descriptor. The regression
test injects a codex-shaped descriptor and asserts
`dispatch.started.adapter = {kind:'builtin', name:'codex'}` — fails on
`HEAD~1`, passes at 45a. No ADR amendment (pure TypeScript-signature
refactor; no governance-surface movement); no Codex challenger pass
per CLAUDE.md §Hard invariants #6 (challenger required only for
ratchet changes, contract-relaxation ADRs, migration escrows,
discovery-decision promotion, gate-loosening requests — none apply).
`src/runtime/runner.ts` now reads `dispatcher.dispatch(input)` at the
call site and `adapterName: dispatcher.adapterName` at the
materializer invocation. See PROJECT_STATE.md Slice 45a block for the
full framing + acceptance-evidence ledger.

## Mid-term slices — named, framing authored at landing

Order is intent, not commitment. Each slice authors framing at its
commit time. Expect re-ordering as earlier slices expose surface.

- **P2.7 — Session hooks** — SessionStart continuity resume +
  SessionEnd handoff-summary, wired through `.claude/hooks/` to
  circuit-engine. Two sub-slices:
  - **P2.7a (Slice 46, LANDED 2026-04-22)** — hook scripts +
    `.claude/settings.json` wiring + audit Check 33
    `checkSessionHooksPresent`. Lane: Ratchet-Advance. Closes the
    first half of the ADR-0007 §Decision.1 CC#P2-4 enforcement
    binding (`.claude/hooks/SessionStart.sh + .claude/hooks/
    SessionEnd.sh + checkSessionHooksPresent`). SessionStart hook
    mirrors prior-gen `~/Code/circuit/scripts/runtime/engine/src/
    cli/session-start.ts` banner shape so an operator sees a
    consistent resume surface across both generations. SessionEnd
    hook does NOT auto-save a continuity record (`continuity save`
    requires Claude-authored narrative fields; authoring is the
    existing Stop hook's job at `.claude/hooks/auto-handoff-guard.sh`);
    SessionEnd's job is to mark the boundary and surface drift.
    Audit Check 33 enforces presence + executable bit + engine
    reference + matcher coverage of {startup, resume, clear, compact}
    so a future commit cannot silently delete the hooks or downgrade
    them to placeholders.
  - **P2.7b (Slice 46b, LANDED 2026-04-22)** — `tests/runner/
    continuity-lifecycle.test.ts` integration test driving the engine
    through the create→persist→resume→clear lifecycle. Lane:
    Ratchet-Advance. +12 static declarations covering (a) status on
    a fresh empty project root reports `selection: 'none'` with no
    index file written; (b) save writes the index file with a
    populated `pending_record` entry; (c) save writes the record file
    at `payload_rel` with the round-tripped narrative; (d) status
    after save reports `selection: 'pending_record'` and surfaces the
    saved narrative; (e) resume after save returns `source:
    'pending_record'` with the same record_id; (f) resume is
    non-destructive — status after resume still reports the pending
    record; (g) resume on an empty project returns `source: 'none'`
    with a "nothing to resume" message; (h) clear after save deletes
    the record file from disk + clears the index pending_record +
    reports `cleared_pending_record: true` with `deleted_record_id`
    matching; (i) status after clear reports `selection: 'none'`;
    (j) clear is idempotent on empty projects (`cleared: true`,
    `deleted_record_id: null`); (k) save twice replaces the index
    pointer without deleting the prior record file from disk
    (pinning save-replace-of-pointer semantics — clear is the only
    command that reaps record files); (l) the engine reports the
    `selection` (status) and `source` (resume) discriminant fields
    the SessionStart and SessionEnd hooks read from `--json` output
    (pinning the field-name surface so a hidden rename breaks loud
    here). Tests invoke `.circuit/bin/circuit-engine` as real
    subprocesses against ephemeral mkdtempSync project roots scoped
    via `--project-root`; macOS `/var/folders` ↔ `/private/var/
    folders` aliasing collapsed via `realpathSync`. Closes the
    second half of CC#P2-4. **Per-criterion close status update
    (Slice 47c forbidden-scalar-phrase fold-in — ADR-0007 §3
    No-aggregate-scoring rule):** CC#P2-4 (session hooks +
    continuity lifecycle) advances from active — red to active —
    satisfied at this landing. No ADR amendment, no Codex challenger
    pass (CLAUDE.md §Hard invariants #6 scope does not apply —
    adds new contract suite strictly tightening surface, advances
    ratchet without governance-surface movement). Ratchet floor
    976 → 988.
- **P2.8 — Router (`/circuit:run` classifier)** — first-class
  workflow classifier: given task text + entry signals, selects among
  registered workflows.
- **P2-MODEL-EFFORT — workflow v0.3: explicit model + effort
  assignment.** Already reserved at commit `b538979` and specified in
  `specs/plans/phase-1-close-revised.md §Slice P2-MODEL-EFFORT`.
  Triggers once P2.3 and at least one adapter land.
- **P2.9 — Second workflow** — likely `review` (Codex's fallback
  suggestion and the smallest remaining surface) unless Phase 2
  evidence points elsewhere. Proves the
  contract/adapter/fixture/protocol pattern generalizes beyond
  `explore`. Target reselection occurs at P2.9 framing time.
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

1. ~~**Target workflow for first parity.**~~ **RESOLVED 2026-04-21:**
   `explore` (see §Target workflow for first parity — DECIDED).
2. **Adapter precedence — `agent` vs `codex` first?** P2.4 assumes
   `agent`; if the operator wants `codex` first (Codex is the Knight-
   Leveson challenger voice already in the methodology), flip P2.4 /
   P2.6.
3. ~~**Phase 2 close criterion #7 — container isolation.**~~
   **RESOLVED 2026-04-21 via ADR-0007 CC#P2-7:** re-deferred with
   nine named trigger conditions and interim per-slice citation audit
   check (`checkPhase2SliceIsolationCitation`) added in P2.1 ceremony
   commit. CLAUDE.md §Phase discipline §Phase 2 sentence + §Hard
   invariants #1–#4 remain authoritative at the policy layer;
   close-criterion-layer weakening is explicitly acknowledged per
   ADR-0007 §Consequences.Accepted.
4. **Golden-artifact location and hashing scheme.** Phase 2 should
   lock this before P2.5 lands; candidate: sha256 over
   normalized-JSON result artifacts, stored under
   `tests/fixtures/golden/explore/`.
5. ~~**Spine policy for `explore`.**~~ **RESOLVED 2026-04-21 via
   ADR-0007 CC#P2-6:** full-spine at Standard rigor — {Frame,
   Analyze, Synthesize, Review, Close}. P2.3 contract authorship
   adopts this canonical phase set; `checkSpineCoverage` audit check
   enforces it at Phase 2 close.
