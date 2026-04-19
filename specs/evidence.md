# Phase 0 Evidence Synthesis — circuit-next

**Status:** Phase 0 closure artifact.
**Inputs:** external prior-art analysis, two blind internal-extraction drafts, prior-art audit of 4 in-repo docs, adversarial review of the type skeleton.
**Output:** this file, which informs Phase 1 contract authorship.

This synthesis is the authoritative evidence base for circuit-next. It is *not* a design. Designs happen in `specs/contracts/<module>.md` during Phase 1, grounded in this evidence.

---

## Evidence Streams

| Stream | Artifact | Coverage |
|---|---|---|
| External prior art (Claude) | `.circuit/circuit-runs/external-prior-art-evidence-pass-*/phases/analyze-ext/external-evidence.md` | 51 sources; 12 abstraction targets + 8 discovered |
| External prior art (Codex) | `.circuit/circuit-runs/external-prior-art-evidence-pass-*/phases/analyze-cdx/external-evidence.md` | 41 sources; independent cross-model draft |
| External synthesis | `.circuit/circuit-runs/external-prior-art-evidence-pass-*/artifacts/analysis.md` | Convergence + contradictions + implications |
| Internal extraction (Claude, blind) | `bootstrap/evidence-draft-claude.md` | 18 invariants, 10 seams, 13 failure modes, 75 facts |
| Internal extraction (Codex, blind) | `bootstrap/evidence-draft-codex.md` | 18 invariants, comparable seam/failure-mode coverage |
| Prior-art audit | `bootstrap/prior-art-audit.md` | Audit of 4 in-repo docs against external + internal evidence |
| Adversarial review (type skeleton) | `bootstrap/adversarial-review-codex.md` | 6 HIGH objections, 4 MED, 1 LOW; 6 HIGH incorporated |

---

## Convergent Conclusions (multi-stream agreement)

Claims where the external evidence, both internal drafts, and the prior-art audit all agree. These are the load-bearing findings.

1. **Event-sourced runs with derived snapshots are the correct durability model.** External: Fowler, Temporal, LangGraph, OpenHands all instantiate this. Internal: existing Circuit's `events.ndjson` + `state.json` is a correct instantiation (`derive-state.ts:56-292`, `append-event.ts:82-88`). Prior-art audit: all 4 docs assume this. Hard invariant.
2. **The determinism-replay boundary must be explicit.** Workflow orchestration code is deterministic; LLM calls and tool invocations are non-deterministic activities. External: Temporal's explicit split. Internal: Circuit's synthesis steps are deterministic; dispatch steps are non-deterministic. Confirmed both sides.
3. **Lane discipline is load-bearing.** Every slice needs: lane, failure mode, acceptance evidence, alternate framing. External: Nguyen 2024 on anchoring + IDE-agent convergence on mode/profile-based permissions. Methodology: decision.md §Lane discipline. Internal: existing Circuit does NOT enforce lane framing; this is a gap. Adversarial review incorporated: `LaneDeclaration` is now attached to `RunBootstrappedEvent` and `Snapshot`.
4. **Cross-model review is one Swiss-cheese layer, not independent corroboration.** External: Knight & Leveson 1986, Anthropic Harness Design 2025. Internal: existing Circuit has no cross-model layer. Methodology: decision.md §Stance C Breaks (15 stress BREAKs/FATALs). Narrow scope: ratchet changes, contract relaxation ADRs, gate loosening, migration escrows.
5. **Configuration precedence is a first-class concern, not an implementation detail.** External: npm/cargo/pyproject/bun, Codex AGENTS.md, VS Code settings. Internal: existing Circuit layers `.claude/circuit.config.yaml` < `circuit.config.yaml`. Prior-art audit: Principle 5 survives. Adversarial review: made precedence explicit via `SELECTION_PRECEDENCE` and `SelectionResolution` with `applied` trace.
6. **Prose-as-policy is an anti-pattern.** Internal: existing Circuit has 400-500 line `SKILL.md` files mixing bash heredocs + markdown with no structural cross-check against `circuit.yaml`. External: DSPy, GEPA, BAML all treat prompt-as-compiled-artifact. Prior-art audit: Principle 6 survives; adversarial-review #6 is corroborated. Circuit-next must prevent prose/YAML drift structurally.
7. **Progressive disclosure generalizes beyond skills.** Anthropic: L1 frontmatter, L2 body, L3 on-demand. Same pattern applies to workflows (entry signals L1; brief.md L2; artifact chain L3), configs (effective value L1; per-layer breakdown L2; full audit trail L3). External evidence + inventory both support.
8. **Single-agent beats multi-agent on most coding/depth tasks** (Cognition, Smit 2024, ICLR 2025). Multi-agent wins on breadth-first research (Anthropic 90.2%). circuit-next's default posture should be single-agent tool-loop; multi-agent only when task shape is parallelizable research. Tournament rigor should NOT be the default for decide: prefix.
9. **Types at module boundaries beat tests when types can express the invariant.** External: Ousterhout, Parnas, "Parse Don't Validate" (King). Methodology: decision.md adopts this. Internal: existing Circuit's branded types + Zod schemas are partially implemented but inconsistent.
10. **Provider abstraction is leaky at the edges.** External: Ronacher on SDK brittleness; OpenAI/Anthropic message-schema differences; caching semantics diverge. Internal: existing Circuit adapter resolution order (`explicit → role → circuit → default → auto`) is the right shape; the **adapter registry** was missing from config. Adversarial review incorporated: `DispatchConfig.adapters` registry now validated.

---

## Invariants (derived — compiler-enforced where possible)

The following must be preserved or abandoned only via ADR. Every invariant in this list maps to a type-level constraint in `src/schemas/` or is documented as a contract-test target.

1. **Event log is the authoritative source of state.** `events.ndjson` is append-only. `state.json` is a pure function of events. (External + internal convergent. Enforced at `src/schemas/snapshot.ts`.)
2. **Manifest snapshot is immutable per run.** After bootstrap, the manifest must byte-match on every re-entry. Internal evidence: `bootstrap.ts:128`. Enforced via `manifest_hash` on `RunBootstrappedEvent` + `Snapshot`.
3. **Every run carries a lane declaration.** Lane is on `RunBootstrappedEvent`, carried in `Snapshot`, required for `migration-escrow` (expiry + restoration plan) and `break-glass` (post-hoc ADR deadline). Enforced at `src/schemas/lane.ts` + `event.ts` + `snapshot.ts`.
4. **Workflow graph is closed.** Every entry-mode `start_at` exists in `steps`; every phase-step reference resolves; every route target is `@complete|@stop|@escalate|@handoff` or a known step; no duplicate step ids. Enforced at `src/schemas/workflow.ts` `superRefine`.
5. **Step discipline: `orchestrator↔synthesis|checkpoint`, `worker↔dispatch`.** Dispatch steps carry a dispatch role (`researcher|implementer|reviewer`). `orchestrator` is an executor, NOT a dispatch role. Enforced at `src/schemas/step.ts` discriminated union.
6. **Gate-kind match per step kind.** `synthesis → schema_sections`, `checkpoint → checkpoint_selection`, `dispatch → result_verdict`. Enforced at the step discriminated union.
7. **Adapter resolution is auditable.** Every dispatched step records `resolved_from` in the event log (`explicit | role | circuit | default | auto`). The effective adapter is never unknown after the fact. Enforced at `DispatchStartedEvent`.
8. **Selection precedence is explicit.** `default < user-global < project < workflow < phase < step < invocation`. `SelectionResolution.applied` records the full chain. Enforced at `src/schemas/selection-policy.ts`.
9. **Skill overrides are typed operations, not empty-array ambiguity.** `SkillOverride` is `inherit|replace|append|remove`. Enforced at selection-policy schema.
10. **Continuity discriminant is structural.** `standalone` records forbid `run_ref`; `run-backed` records require it and require `resume_run` mode. Enforced at `src/schemas/continuity.ts` discriminated union.
11. **All external-package identifiers are grounded.** API-grounding gate (methodology): every new import is backed by installed type stubs, docstrings, `.d.ts`, or an end-to-end call test. (Tier 2+ enforcement; Tier 0 is advisory via CLAUDE.md.)
12. **CLAUDE.md ≤ 300 lines.** Anthropic-documented cache + comprehension threshold.
13. **Cross-model challenger produces objection list, not approval.** One Swiss-cheese layer; ratchet/gate-loosening still requires operator decision. Not type-enforceable; documented in `specs/methodology/decision.md`.
14. **Slices bounded to ≤ 30 min wall-clock.** METR 2025 + LORE 2025 (super-linear collapse past ~120 steps). Not type-enforceable at Tier 0.

---

## Seams (contract boundaries for Phase 1)

Where truth must be pinned between layers. These inform `specs/contracts/<module>.md` authorship in Phase 1.

1. **Workflow type ↔ Run instance.** A Workflow is immutable type; a Run is a replayable instance. Contract: Run is a deterministic replay of Workflow + events.
2. **Step writes ↔ Gate source.** Adversarial review MED objection #7: gate `source` strings are opaque. **Closed in Phase 1 slice 1** (`specs/contracts/step.md` v0.1 STEP-I3/I4) — `gate.source` is typed per gate variant and `ref` is a literal constrained to an existing `writes.*` slot.
3. **Event ↔ Snapshot reducer.** Snapshot is a pure fold over events. Reducer must be total, deterministic, and tested with property-style tests (Tier 2+).
4. **Selection layer ↔ Effective config.** A pure function takes all layers and returns `ResolvedSelection` with provenance trace.
5. **Skill descriptor L1 ↔ Runtime loader.** L1 YAML frontmatter loaded at session start; L2 body on trigger match; L3 extra files on explicit request. Cache-cost boundary.
6. **Orchestrator ↔ Worker public/private contract.** Existing Circuit splits public `jobs/*.{request,receipt,result}.json` + `reports/report.md` from private `batch.json`, `events.ndjson`, `plan.json`. Phase 1 decides: preserve or collapse.
7. **Cross-model challenger ↔ Gate.** Challenger writes an objection list; gate counts non-empty objections against a merge-block criterion. Objection does NOT cause auto-abort.
8. **Session hook ↔ Installed helper wrappers.** `session-start.sh` populates `.circuit/bin/*` + writes `.circuit/plugin-root` pointer. Phase 1 decides cache-invalidation policy.
9. **Manifest snapshot ↔ Events ↔ State.** Three file-level seams; projections cross all three.
10. **Custom circuit publish ↔ Plugin surface.** User-authored workflows under `~/.claude/circuit/skills/<slug>/`; publish validates by bootstrapping a detached run. Phase 1 decides the overlay vs plugin-install model.

---

## Failure Modes Observed in Existing Circuit (carry-forward risks)

Not architectural judgments — observed anti-patterns that the rewrite must actively reject.

- **Verdict enum bloat.** ~35 global verdicts + per-protocol conditionals in JSON Schema. ~250-line wall of `if protocol == X then verdict ∈ [...]`. Adding a verdict requires editing 3 places. Symptom of prose-driven accretion.
- **Two parallel runtime layers.** `runtime-core/` and classic engine coexist; CLI still imports classic. Partial rewrite, not replacement.
- **Prose/YAML drift.** `SKILL.md` text vs `circuit.yaml` structure: no runtime cross-check. Adversarial-review doc objection #6 is corroborated by internal evidence.
- **Skill files 400-500 lines.** Mix of bash heredocs + markdown; Claude follows literally without structural consistency check.
- **Build Lite documentation drift.** `skills/build/circuit.yaml` says review runs; generated `CIRCUITS.md` says review is skipped.
- **Config discovery picks one.** `config.ts:67-109` — project OR global, no layered merge. External evidence says merged precedence is standard.
- **Concurrent event writes without file lock.** `append-event.ts:82` — unlocked append. Concurrent tools could interleave. Enforce serialization or add optimistic locking.
- **Codex janitor ownership by argv string.** `codex-runtime.ts:385` — matches process command strings. Brittle to argv shape changes.
- **Gate semantics: section headings only.** `schema_sections` proves H2 headings + nonempty bodies. A syntactically complete but semantically empty artifact passes.

---

## Contradictions + Resolutions

| Topic | Source A | Source B | Resolution |
|---|---|---|---|
| Multi-agent vs single-agent | Anthropic: 90.2% gain on research (breadth) | Cognition + academic: often worse on coding (depth) | **Task-type-dependent.** circuit-next defaults single-agent; tournament only when parallelizable breadth. |
| Unified SDK vs provider-native | Vercel AI SDK, LangChain | Ronacher on SDK brittleness | **Adapter with escape hatch.** Unified for simple calls; provider-native for caching, hidden state. |
| Background autonomy vs approval gate | Cursor background agents | Cline, Junie approvals-by-default | **Execution-substrate-typed.** Local-process / sandbox / remote-VM / cloud-worktree have different approval policies. |
| Structured-output strictness | OpenAI Structured Outputs `strict: true` | Simon Willison's semantic-correctness warning | **Pipeline, not point.** generate → validate → repair → log. |
| Session checkpoints vs Git | Cursor local/session-scope | Aider Git-durable | **Orthogonal.** Session checkpoints ephemeral; Git commits durable. Both needed. |

---

## Unknowns Acknowledged

- No public quantitative data on user-global + project + invocation-override precedence specifically applied to model/effort/skill selection.
- No head-to-head eval of MCP vs Claude Code skills vs OpenAI AGENTS.md for trigger-matching accuracy.
- No published operator-tuning data for event-sourced LLM-run storage at realistic scale.
- No settled portable agent-checkpoint format across Cursor, Claude Code, Cline, OpenHands, Codex.
- Practical thresholds for when to dispatch challenger models vs a stronger single model are empirically task-specific.

These gaps are carried forward; they will manifest as low-confidence defaults that Phase 1 contract authorship must make explicit.

---

## Adversarial-Review Incorporation Status

Adversarial review verdict: `NEEDS ADJUSTMENT`. Summary of incorporation:

| # | Severity | Objection | Status |
|---|---|---|---|
| 1 | HIGH | Workflow graph not closed | Incorporated (`Workflow.superRefine`) |
| 2 | HIGH | Lane declaration detached from runs | Incorporated (`lane` on event + snapshot) |
| 3 | HIGH | Event log insufficient to replay snapshot | Incorporated (new events: `step.completed`, `step.aborted`; richer `dispatch.*` events) |
| 4 | HIGH | Selection policy lacks precedence/overrides | Incorporated (`SkillOverride`, `SelectionResolution`) |
| 5 | HIGH | Adapter config schema doesn't match documented surface | Incorporated (`dispatch.adapters` registry + closure validation) |
| 6 | MED | Step under-constrained | Incorporated (`Step = discriminatedUnion`) |
| 7 | MED | Gate source is opaque string | **Closed** in Phase 1 slice 1 (`specs/contracts/step.md` v0.1 — STEP-I3/I4: `gate.source` is a typed discriminated union with literal `ref` per kind) |
| 8 | MED | Rigor semantics wrong for autonomous | Incorporated (`CONSEQUENTIAL_RIGORS` includes `autonomous`) |
| 9 | MED | Continuity contradictory resume states | Incorporated (discriminated union on `continuity_kind`) |
| 10 | MED | Branded IDs don't protect dangerous edges | Partial (route target validation via workflow superRefine; path/source strings remain) |
| 11 | MED | Phase spine too loose | **Closed** in Phase 1 slice 3 (`specs/contracts/phase.md` v0.1 — PHASE-I4: `Workflow.spine_policy` required discriminated union, strict/partial modes; HIGH-level semantic gaps honestly scoped as Phase 2 property_ids after second Codex adversarial pass) |
| 12 | MED | Model/Effort enums overfit | Incorporated (provider-scoped `ProviderScopedModel`; `Effort` matches OpenAI 6-tier) |
| 13 | LOW | Parity tests ratify permissiveness | Incorporated (now 34 contract tests including negative cases) |

---

## Implications for Phase 1 Contract Authorship

Phase 1 must produce:

- `specs/domain.md` — ubiquitous language glossary. Draft included alongside this spec.
- `specs/contracts/workflow.md` — Workflow module contract with invariants, pre/postconditions, property_ids.
- `specs/contracts/run.md` — Run module contract (replay, reducer, snapshot).
- `specs/contracts/step.md` — Step module (discriminated union variants, gate binding).
- `specs/contracts/selection.md` — Selection-policy module (precedence, skill overrides).
- `specs/contracts/adapter.md` — Adapter + dispatch resolution.
- `specs/contracts/continuity.md` — Continuity module (save/resume/clear, discriminant invariants).
- `specs/contracts/skill.md` — Skill registry + progressive disclosure.
- `specs/behavioral/session-hygiene.md` — CLAUDE.md size limit, cache stability, compaction disabled.
- `specs/behavioral/prose-yaml-parity.md` — structural enforcement; contract test.
- `specs/behavioral/cross-model-challenger.md` — narrow-scope usage policy.

Contract authorship proceeds in Tiny-Step-Ratcheting lane discipline:
- First batch (Discovery lane): draft `domain.md` + 3 core contracts (workflow, run, step).
- Second batch (Ratchet-Advance): the remaining contracts + behavioral tracks.
- Adversarial property-auditor (Codex) attacks contracts at the end of each batch.

---

## What This Evidence Spec Does NOT Do

- Does not choose an architecture. Contracts are authored in Phase 1, not Phase 0.
- Does not prescribe a migration from existing Circuit. That's a Phase 2+ concern.
- Does not close the 5 Unknowns. Those carry forward as labeled defaults.
- Does not replace the methodology decision at `specs/methodology/decision.md`. This spec is evidence that supports + constrains the methodology; the methodology itself is authoritative for process.

---

## Appendix: Source-Confidence Summary

- **High confidence (multi-stream convergence)**: invariants 1-10, seams 1-6, failure modes above.
- **Medium confidence (one stream, strong)**: invariants 11-14, seams 7-10.
- **Low confidence (inference from partial evidence)**: every `[unsupported]` and `[unknown]` item.
- **Carry-forward with skepticism**: anything from the 4 prior-art docs not corroborated by external + internal evidence.
