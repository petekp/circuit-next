# PROJECT_STATE — circuit-next

**Last updated:** 2026-04-18 (ADR-0002 bootstrap discipline landed; autonomy arc begun)
**Phase:** 1 — Contract authorship **in progress**. Phase 0 Evidence Loop closed. First Phase 1 contract (`step.md`) landed + MED #7 (gate source tightening) closed. Bootstrap discipline (ADR-0002) codified; `.circuit/` now gitignored going forward.
**Tier:** 0 — scaffold complete, validated, committed.

## One-minute read

`circuit-next` now has a rigorously-validated Tier 0 foundation. The
Contract-First + Tiny-Step-Ratcheting + Architecture-First + cross-model-
challenger methodology (`specs/methodology/decision.md`) has been applied
end-to-end during this bootstrap: external prior-art was surveyed, internal
Circuit was extracted blind, the 4 in-repo prior-art docs were audited
against independent evidence, a type skeleton was drafted, adversarially
challenged by Codex, and hardened with compiler-enforced invariants.

Everything the user asked for overnight is in place:

- Tier 0 directory scaffold with CLAUDE.md, PROJECT_STATE.md, ADR-0001
- 4-worker parallel evidence pass (Claude + Codex × external + internal)
- Synthesized `specs/evidence.md` with labeled invariants + seams
- Architecture-first TypeScript type skeleton under `src/schemas/`
- Contract-first Zod schemas with 46 contract + 1 smoke = 47 tests (baseline 34 → +13 this session, including step-contract negatives and strict-mode coverage)
- Validation/verification infrastructure: tsc --strict, biome, vitest, all green
- Adversarial-review findings (6 HIGH objections) incorporated into the skeleton
- Phase 1 contract stubs: `specs/domain.md` + `specs/contracts/workflow.md`
- Prior-art audit (`bootstrap/prior-art-audit.md`) of the 4 Circuit docs

The skeleton is **deliberately minimal** (~700 lines of TS across 15 schema
files + 14 types) — digestible in one sitting. Nothing is "finished"; every
schema has clear Phase 1 / Phase 2 expansion points.

## How to pick this up in the morning

```bash
cd ~/Code/circuit-next
cat PROJECT_STATE.md          # this file
cat specs/evidence.md          # the Phase 0 synthesis — read second
npm install                     # if not already
npm run verify                  # tsc + biome + vitest; should all pass
```

Then in order of importance:

1. Read `specs/evidence.md` — the Phase 0 closure artifact.
2. Skim `bootstrap/adversarial-review-codex.md` — the objections Codex raised against the skeleton. 6 HIGH are incorporated; see below for what's deferred.
3. Read `src/schemas/workflow.ts`, `src/schemas/step.ts`, and `src/schemas/event.ts` — the three most consequential schemas. Verify they match your mental model.
4. Run `npm run test` — 47 tests should pass (46 contract + 1 smoke). Every test encodes an invariant from the methodology. Skim the test names to see what's enforced.
5. Read `specs/contracts/workflow.md` as an example Phase 1 contract. Phase 1 authors the remaining contracts (step, selection, adapter, continuity, skill, run, phase, behavioral tracks) in the same shape.
6. Decide what Phase 1 batch to start with. Recommended: `specs/contracts/step.md` next (the invariants are the densest).

## What happened overnight — timeline

- **Scaffold** (~20 min): directory tree, `package.json`/`tsconfig.json`/ `biome.json`, CLAUDE.md, PROJECT_STATE.md (draft), ADR-0001, `specs/risks.md`, methodology symlinks, git init + first commit.
- **Parallel worker dispatch**: 4 evidence workers launched in parallel — Claude + Codex × external prior art + blind internal Circuit extraction. Two codex workers completed in ~5-7 min each; two Claude Agents completed in ~10 min each.
- **Orchestrator work while workers ran**: compiled `bootstrap/abstraction-inventory.md` from top-level Circuit docs; read methodology decision in detail.
- **External synthesis** (`analyze-ext`/artifacts/analysis.md): 51 + 41 sources across both drafts synthesized into evidence brief with 10 hard invariants + 8 seams.
- **Type skeleton draft** (15 schemas, 13 `.ts` files): Workflow, Phase, Step, Gate, Event, Snapshot, Config, SelectionPolicy, SkillDescriptor, LaneDeclaration, AdapterRef, ContinuityRecord, IDs (branded), Rigor, Role.
- **Validation wiring**: tsc strict, biome, vitest with initial 13 parity tests — all green.
- **Adversarial review** (`bootstrap/adversarial-review-codex.md`): Codex attacked the skeleton; 6 HIGH + 7 MED + 1 LOW objections. Verdict: `NEEDS ADJUSTMENT`.
- **Skeleton hardening**: incorporated 6 HIGH + 3 MED objections directly into schemas. Step became a discriminated union; Workflow got graph-closure superRefine; Lane got attached to RunBootstrappedEvent + Snapshot; SelectionPolicy added SkillOverride with inherit/replace/append/remove; Event log got richer for replay; DispatchConfig got adapter registry with closure validation; Continuity became discriminated union; isConsequentialRigor includes autonomous; provider-scoped models replaced marketing enum; Effort uses OpenAI 6-tier. 34 tests including negative cases for graph violations. All green.
- **Commit**: second commit `tier0: architecture-first type skeleton + adversarial-review fixes` with all schemas + tests + adversarial review artifact.
- **Prior-art audit** (`bootstrap/prior-art-audit.md`): audited the 4 in-repo Circuit docs against the independent external + internal evidence.
- **Final synthesis** (`specs/evidence.md`): master Phase 0 closure artifact combining all streams.
- **Phase 1 kickoff** (partial): `specs/domain.md` ubiquitous-language glossary + `specs/contracts/workflow.md` first contract.
- **Final commit** + continuity save (this step).

## Status checklist — what the user asked for

- [x] Tier 0 scaffold with CLAUDE.md <300 lines, PROJECT_STATE, ADR-0001, specs/methodology/ links, git init
- [x] External prior-art survey (Claude + Codex, independent drafts, synthesized)
- [x] Blind internal extraction of existing Circuit (Claude + Codex, independent drafts)
- [x] Prior-art audit of 4 in-repo docs against external + internal evidence
- [x] `specs/evidence.md` Phase 0 closure artifact
- [x] Architecture-first type skeleton (schemas + types) compiling under `tsc --strict`
- [x] Contract-first Zod schemas with 34 parity + negative tests
- [x] Validation/verification infrastructure (tsc, biome, vitest) all green
- [x] Cross-model challenger pass (Codex adversarial review on the skeleton)
- [x] Incorporate HIGH adversarial findings; defer MED/LOW with rationale
- [x] `specs/domain.md` ubiquitous-language glossary (Phase 1 draft)
- [x] `specs/contracts/workflow.md` as first Phase 1 contract (example)
- [x] git commits on every meaningful milestone
- [x] Methodology applied end-to-end (contract-first + architecture-first + tiny-step-ratcheting + cross-model challenger)

## What is NOT done (intentional deferral)

### Deferred to Phase 1 contract authorship

- Remaining contract stubs under `specs/contracts/`:
  - `phase.md`, `run.md`, `selection.md`, `adapter.md`,
    `continuity.md`, `skill.md`
- Behavioral tracks: `specs/behavioral/session-hygiene.md`,
  `specs/behavioral/prose-yaml-parity.md`, `specs/behavioral/cross-model-challenger.md`
- Adversarial-review MED #11 (workflow `spine_policy` for phase-omit/rename policy) — belongs in `phase.md`

### Closed this session (Phase 1, first contract slice + autonomy arc slice 1)

- **ADR-0002** — *Bootstrap Discipline*: codifies that `circuit-next` is built via the existing Circuit as harness (classic bootstrap), with four rules against design contamination (citation rule, gitignore rule, harness-vs-template distinction, enforcement via audit). Closes the "Circuit does X" silent-justification risk.
- `.circuit/` added to `.gitignore` going forward; `phase-1-step-contract-authorship` run preserved via negative rule as historical audit trail of the first Phase 1 slice.
- `specs/contracts/step.md` authored (STEP-I1..STEP-I7; v0.1).
- Adversarial-review MED #7 (gate `source` as typed reference) **closed** — `Gate.source` is a typed discriminated union with literal `ref` per source kind; `.strict()` rejects surplus keys; `superRefine` adds `Object.hasOwn` + undefined defense-in-depth.
- Codex cross-model adversarial property-auditor pass completed against step.md/gate.ts/step.ts — 3 HIGH + 3 MED + 1 LOW incorporated (prototype-chain attack, cross-slot drift, optional-undefined, strict-mode prose, biome scope, project-state sync, TS exactness prose).
- `biome.json` ignores `.circuit/` (no more formatter writes against run state).

### Deferred to Phase 2 implementation

- Container isolation / distinct-UID sandbox
- `tests/properties/visible/` visible property tests
- `tests/properties/hidden/` hidden pool + opaque rotation
- Mutation testing gate
- Anti-Goodhart ratchet machinery (quarantine, versioned floors,
  fingerprinting, meta-ratchets)
- Solo-approval protocol for ratchet weakening
- Registry-lookup install wrapper (firewalled network)
- Plugin manifest at `.claude-plugin/plugin.json` + the plugin surface
  itself (commands, agents, hooks, skills, MCP)
- Any actual workflow implementation (no workflow runs yet; that's Phase 2+)

## The schemas — exact shape

All under `src/schemas/`. Every file has `<60 lines` where possible;
most are ~30-40.

| File | Exports | Purpose |
|---|---|---|
| `ids.ts` | `WorkflowId`, `PhaseId`, `StepId`, `RunId`, `InvocationId`, `SkillId`, `ProtocolId` | Branded IDs |
| `rigor.ts` | `Rigor`, `CONSEQUENTIAL_RIGORS`, `isConsequentialRigor` | 5-tier rigor enum |
| `role.ts` | `Role` (alias of `DispatchRole`) | Dispatch-only roles |
| `adapter.ts` | `BuiltInAdapter`, `AdapterName`, `AdapterRef`, `CustomAdapterDescriptor` | Adapter descriptors |
| `lane.ts` | `Lane`, `LaneDeclaration`, `MigrationEscrowLane`, `BreakGlassLane` | Lane framing |
| `gate.ts` | `Gate`, `SchemaSectionsGate`, `CheckpointSelectionGate`, `ResultVerdictGate` | Step gates |
| `skill.ts` | `SkillDescriptor` | Skill registry entry |
| `selection-policy.ts` | `SelectionOverride`, `ResolvedSelection`, `SelectionResolution`, `SkillOverride`, `ProviderScopedModel`, `Effort`, `SELECTION_PRECEDENCE` | Per-step selection |
| `step.ts` | `Step` (discriminated union), `SynthesisStep`, `CheckpointStep`, `DispatchStep`, `DispatchRole`, `ArtifactRef` | Step variants |
| `phase.ts` | `Phase`, `CanonicalPhase` | Phase spine |
| `workflow.ts` | `Workflow`, `EntryMode`, `EntrySignals` | Workflow definition + graph closure |
| `event.ts` | `Event` (discriminated union, 11 kinds) | Append-only event log |
| `snapshot.ts` | `Snapshot`, `StepState`, `StepStatus` | Derived state |
| `config.ts` | `Config`, `DispatchConfig`, `LayeredConfig`, `ConfigLayer`, `CircuitOverride` | User/project/invocation config |
| `continuity.ts` | `ContinuityRecord` (discriminated union), `StandaloneContinuity`, `RunBackedContinuity`, `GitState`, `ContinuityNarrative` | Cross-session handoff |

All are re-exported through `src/schemas/index.ts` and `src/index.ts`.

## Contract tests

`tests/contracts/schema-parity.test.ts` — 46 contract tests (baseline 34
after overnight, +12 from the Phase 1 step-contract slice covering gate-
source literals, strict-mode surplus-key rejection, prototype-chain +
cross-slot drift rejection). Plus 1 smoke test at `tests/unit/smoke.test.ts`.
Each test encodes one invariant from `specs/evidence.md` or the landed
contracts. Notable ones:

- Rigor rejects unknown tiers
- `isConsequentialRigor` includes `autonomous` (adversarial-review fix)
- Role rejects `orchestrator` (executor, not a dispatch role)
- Migration-escrow lane requires expiry + restoration plan
- Break-glass lane requires post-hoc ADR deadline
- Step discriminated union rejects orchestrator+dispatch, worker without role, mismatched gate kinds
- Workflow graph rejects dangling entry_modes.start_at, phase-step refs, route targets, duplicate step ids
- Event log requires lane on bootstrap
- Snapshot requires lane + manifest_hash
- DispatchConfig validates adapter-name closure (named adapter must be in `dispatch.adapters`)
- Continuity record enforces standalone vs run-backed discriminants

`tests/unit/smoke.test.ts` — one smoke test.

## Run-state pointers

- External-evidence Explore run: `.circuit/circuit-runs/external-prior-art-evidence-pass-survey-academic-f/`
  - `artifacts/brief.md`, `artifacts/analysis.md`
  - `phases/analyze-ext/external-evidence.md` (Claude, 287 lines, 51 sources)
  - `phases/analyze-cdx/external-evidence.md` (Codex, 160 lines, 41 sources)
- Phase 0 internal-evidence Explore run: `.circuit/circuit-runs/phase-0-evidence-loop-for-circuit-next-blind-cross/`
  - `artifacts/brief.md`
  - `phases/analyze-int-claude/prompt.md` (prompt)
  - `phases/analyze-int-codex/prompt.md` (prompt)
  - `phases/adversarial-review/prompt.md` (prompt for Codex skeleton review)
- Tournament methodology artifacts: `.circuit/circuit-runs/design-a-methodology-for-llm-assisted-project-deve/artifacts/` (symlinked under `specs/methodology/`)

## Invocation id

This overnight run chains to invocation id `inv_ec9c950f-6044-4799-a293-e514fcb95656` from the `/circuit:run` directive that started the session.

## Open questions

1. **Next contract: `run.md` or `phase.md`?** `run.md` exposes the event-log + replay semantics (user-visible); `phase.md` needs the spine_policy decision (MED #11). Either unblocks selection.md/adapter.md/continuity.md/skill.md downstream.
2. **Keep `agent` as a built-in adapter alias?** Existing Circuit has `agent` = Claude Code Agent tool. Adversarial review notes `codex-isolated` is the real name with `codex` as alias. Decide in adapter.md.
3. **Spine policy (MED #11)?** Whether `Workflow.spine_policy` (which canonical phases are present/omitted/renamed) belongs in phase.md or workflow.md v0.2. Default: phase.md.

### Resolved this session

- ~~Start Phase 1 with step.md or run.md?~~ → step.md landed first; gate.source tightening (MED #7) folded in.
- ~~Accept the type skeleton as-is, or rerun adversarial review?~~ → Rerun happened inside the step.md slice (Codex read the tightened schema + new contract + tests); 3 HIGH + 3 MED + 1 LOW incorporated.

## If something is wrong

If `npm run verify` fails when you wake up, that's a high-priority signal.
The architecture is not structurally sound. Possible reasons:
- A schema file got corrupted (unlikely — git tracks everything)
- Node version mismatch (requires `>=20`; check `node -v`)
- A background process wrote something unexpected (check `git status`)

If evidence drafts look wrong or missed something material, the full source
traces are in the Run directories (see above). Workers cited everything with
file:line paths or URLs.

## Methodology trace

This bootstrap is itself an exercise of the methodology. You can audit it:

- **Contract-first**: schemas + contract tests authored before any runtime code.
- **Tiny-step ratcheting**: two commits so far — scaffold, then hardened skeleton. Each is reversible. Next commit will add contract stubs + final PROJECT_STATE.md.
- **Architecture-first**: `tsc --strict` is the compiler ratchet; 34 negative tests encode the invariants the methodology asks for.
- **Narrow cross-model challenger**: Codex reviewed the type skeleton exactly once, produced an objection list (not approval), operator (me) decided what to incorporate vs defer. Knight-Leveson Swiss-cheese, not independent corroboration.

Every lane declaration is still implicit (Tier 0 scaffold work is
Discovery-lane). Phase 1 contract authorship should begin with an explicit
Ratchet-Advance lane declaration in the commit for the first contract.
