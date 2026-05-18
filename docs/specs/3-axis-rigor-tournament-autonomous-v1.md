# 3-axis spec: Rigor × Tournament × Autonomous (v1)

Status: draft target spec, code-reconciled on 2026-05-18. Not implementation-current.
Scope: cross-cutting. Public flows (Review, Fix, Build, Explore, Pursue) and the internal Runtime Proof flow reconcile to this spec.

Read this as the target design plus a current-code reconciliation. The main body keeps the 31 locked grill decisions intact. Appendix A records what the code does today with file:line evidence. Appendix B records the locked decisions and whether current code already matches them. Appendix C is the misalignment report.

Current implementation still uses a flat `Depth` enum (`src/schemas/depth.ts:3`) and `entry_modes` in compiled flow fixtures (`src/schemas/compiled-flow.ts:18-40`). The functional/declarative move is real, but it moved flow ownership into `FlowData`/`FlowDefinition` packages and the catalog, not into this 3-axis schema yet (`src/flows/flow-definition.ts:67-86`, `src/flows/catalog.ts:18-27`, `src/flows/types.ts:1-11`).

## 0. Why this spec exists

Today `src/schemas/depth.ts` is a flat enum: `lite | standard | deep | tournament | autonomous` (`src/schemas/depth.ts:3`). The CLI carries `--mode` and `--depth` as aliases for one thoroughness level (`src/cli/circuit.ts:101-123`, `src/cli/circuit.ts:397-425`). Runtime support is declared as per-flow 1:1 `(entryModeName, depth)` rows derived from schematic `entry_modes` (`src/flows/flow-definition.ts:240-249`, `src/cli/circuit.ts:458-475`).

This shape conflates three things that are not the same:
- **How careful** the run is (rigor).
- **Whether the flow fans out** multiple option strands for comparison (tournament).
- **Whether the operator is present** to resolve checkpoints (autonomous).

Conflating these means tournament-of-fixes is impossible (because tournament is a depth, not a shape), lite-with-autonomy is impossible (because autonomous is a depth, not a posture), and deep-tournament-autonomous can't be expressed at all.

The 3-axis model separates them. Each axis is independently configured. Each flow declares which axis combinations it supports.

---

## 1. The three axes

### Rigor

```
Rigor = lite | standard | deep
```

A rigor knob per stage. **The stage path is canonical and immutable**: every rigor level traverses the same stages. Rigor changes density inside each stage, not the shape of the run.

- **Lite** = one pass per stage with a permissive quality bar.
- **Standard** = default rigor; the baseline every flow targets.
- **Deep** = iterate within each stage until a per-stage rubric is satisfied, or a budget cap fires.

Rigor never adds or removes stages. Rigor never adds or removes checkpoints. Rigor only affects how much work happens inside each stage. (Renamed from `Depth` to keep semantics tight; "depth" is overloaded in CS contexts.)

### Tournament

```
Tournament = false | true
TournamentN = integer ≥ 2 (default 3)
```

A stage-local fan-out + winner-select mechanism. When tournament is on:

1. One specific stage (the flow's declared `tournament_fan_out_stage`) generates N independent strands in parallel.
2. Each strand runs in isolation. Strands do **not** see each other during generation.
3. Each strand runs at the same rigor as the overall run. Deep + tournament = N deep strands.
4. A structured winner-select checkpoint chooses one strand. The remaining stages run once over the winner.
5. If a strand fails mid-generation: continue if survivors ≥ 2; otherwise abort with `tournament collapsed: <reason>`.

Tournament never adds stages outside its fan-out. The winner-select checkpoint is part of the fan-out stage.

### Autonomous

```
Autonomous = false | true
```

A checkpoint-resolution policy. When autonomous is on:

1. Stages and checkpoints exist exactly as in interactive runs.
2. At each checkpoint, instead of waiting for the operator, the checkpoint's declared auto-resolution rule fires.
3. Every auto-resolution is recorded in the canonical artifact's Auto-resolutions section.
4. Ambient interactive UI is suppressed (auto-open HTML, prompt waits). Trace output (progress prints, file writes, auto-resolve events) is kept.

Autonomous never removes checkpoints from the schematic. The rule fires *instead of* waiting.

---

## 2. Composition

The three axis types are independent. Any `(rigor, tournament, autonomous)` tuple is parseable at the CLI layer. Per-flow schematics declare which tuples are valid for that flow.

**Default-deny.** A flow that does not advertise support for an axis combination rejects it at parse time with the allow-list in the error message.

**Cross-axis constraints live in flows, not in the axis spec.** The axis spec does not declare e.g. "tournament requires standard rigor". If a flow can't run tournament at lite, that's a flow constraint, declared in the flow's schematic.

---

## 3. Per-flow allow-lists

In the target design, each flow's schematic carries:

```jsonc
{
  "axes": {
    "allowed_rigors": ["lite", "standard", "deep"],
    "supports_tournament": false,
    "supports_autonomous": false,
    "default": { "rigor": "standard", "tournament": false, "autonomous": false, "tournament_n": 3 },
    "tournament_fan_out_stage": "<stage-id>"  // only when supports_tournament: true
  }
}
```

Axis-level defaults (used when a flow omits `default`): `rigor=standard`, `tournament=false`, `autonomous=false`, `tournament_n=3`.

**Starting target allow-lists for the existing flows** (projected from today's `entry_modes`; per-flow specs can revise):

| Flow | allowed_rigors | supports_tournament | supports_autonomous |
|---|---|---|---|
| Review | `[standard]` | no | no |
| Fix | `[lite, standard, deep]` | no | yes |
| Build | `[lite, standard, deep]` | no | yes |
| Explore | `[lite, standard, deep]` | **yes** | yes |
| Pursue | `[standard]` | no | yes |
| Runtime Proof (internal) | `[standard]` | no | no |

Current code does not yet carry this table as an `axes` block. It derives runtime support from schematic `entry_modes` and flow runtime surfaces (`src/flows/flow-definition.ts:240-249`, `src/flows/flow-definition.ts:279-293`, `tests/contracts/catalog-completeness.test.ts:125-148`).

---

## 4. CLI surface

The target CLI has three flags, one per axis.

```
--rigor {lite|standard|deep}
--tournament              # boolean; presence = on, absence = off
--tournament-n N          # optional N; default 3 when --tournament passed
--autonomous              # boolean
```

Examples:

```
circuit-next explore --goal "..."                                         # defaults
circuit-next explore --goal "..." --rigor deep                            # deep, no tournament, not autonomous
circuit-next explore --goal "..." --tournament                            # tournament, N=3
circuit-next explore --goal "..." --tournament --tournament-n 4 --rigor deep
circuit-next build --goal "..." --autonomous
```

`--mode` is **removed**. The alias validators (`entryModeForDepth`, `depthForEntryMode`, `validateModeDepthAliasConsistency`) and mode/depth runtime support rows go with it.

Error shape on unsupported tuples mirrors today's `--depth` rejection: name the unsupported axis value and list the flow's allow-list inline (`src/cli/circuit.ts:466-475`).

---

## 5. Auto-resolution policies

In the target design, each checkpoint in a schematic declares one of four policies:

| Policy | Behavior |
|---|---|
| `accept-as-is` | Take the model's proposed value as the resolution. |
| `highest-score` | Pick the option with the highest score on a typed rubric. Records the winning score and margin. |
| `first-acceptable` | Pick the first option meeting a minimum-bar predicate. |
| `refuse` | Cannot be auto-resolved. Hitting this checkpoint in autonomous mode is a hard failure. |

**Static validation at fixture-load.** A flow that declares `supports_autonomous: true` and contains any `refuse` checkpoint reachable in its stage path is rejected at fixture-load time. Authors must fix the schematic.

The tournament winner-select checkpoint uses `highest-score` by convention when autonomous; per-flow declaration can pick a different policy.

---

## 6. Tournament internals

Target behavior:

| Property | Value |
|---|---|
| Fan-out point | Per-flow declared `tournament_fan_out_stage` (must exist in the flow's stage list). |
| Strand count | Runtime parameter `tournament_n`. Default 3. Lower bound 2. No upper bound (operator owns cost). |
| Strand isolation | Fully independent. No cross-strand awareness during generation. |
| Strand rigor | Inherits run rigor. Deep + tournament = N deep strands. |
| Winner-select shape | Pick one of N. Losing strands surfaced as Options in the canonical artifact alongside the winning Recommendation. |
| Strand failure | Continue if survivors ≥ 2; otherwise abort with `tournament collapsed: <reason>`. |

---

## 7. Autonomous internals

Target behavior:

| Surface | Behavior when autonomous=true |
|---|---|
| Stages | Same as interactive. |
| Checkpoints | Same checkpoints exist. Each fires its declared auto-resolution policy. |
| Auto-open HTML at flow close | Suppressed. |
| Checkpoint wait events | Replaced by auto-resolve events. |
| Progress prints to stdout | Kept (so tail-logging operators see real-time activity). |
| Operator-summary surfaces (JSON / MD / HTML) | All three still written. |
| Validation | Static at fixture-load: no `refuse` checkpoint may be reachable. |

---

## 8. Rigor internals

Target behavior:

| Property | Value |
|---|---|
| Stage path | Canonical and immutable per flow. Rigor does not change the stage set. |
| Per-stage effect | Lite: one pass, permissive quality bar. Standard: default rigor. Deep: iterate to satisfy a per-stage rubric or hit a budget cap. |
| Rubric computation | Always, at every rigor. Lite runs report rubric scores too — they're just allowed to be lower. |
| Model awareness | The model never sees a `rigor=lite` label. Runtime drives behavior via prompt structure: iteration count, sub-prompt content, stage configuration. The model just responds to what's asked. |

---

## 9. Rubric provenance

In the target design, every rubric dimension is **hybrid**: a runtime-computed necessary-condition check plus a model judgment.

```
Per dim: {
  runtime_signal: "met" | "missing",
  model_judgment: "pass" | "concern" | "fail",
  final_score:    "pass" | "concern" | "fail"
}
```

**Combine rule: runtime-veto.** If `runtime_signal === "missing"`, `final_score = fail` regardless of model judgment. If `runtime_signal === "met"`, `final_score = model_judgment`. Runtime can force fail; runtime cannot force pass. Matches the Proof-Carrying Fix authority pattern.

The runtime signal for each Explore rubric dim:

| Dim | Runtime signal |
|---|---|
| Evidence rigor | `evidence_refs` non-empty and well-formed |
| Project-specificity | (no runtime signal; model judgment only) |
| Insight density | (no runtime signal; model judgment only) |
| Actionability | `next_action` present and structured |
| Honest calibration | (no runtime signal; model judgment only) |
| Coverage adequacy | Every `must_answer` item mapped to a Finding or Option |
| Scope discipline | No writes outside run folder; no out-of-scope file reads recorded |
| Branch distinctness (tournament only) | (no runtime signal; model judgment only) |

Dims with no runtime signal: `model_judgment` is authoritative. Their `runtime_signal` field is `"n/a"`.

---

## 10. Auto-resolutions section in the canonical artifact

Target tiered recording.

**Markdown / HTML** (operator-facing prose):

> **Auto-resolutions**
> - Frame: accepted as-is by policy `accept-as-is`.
> - Tournament tradeoff: strand B selected by policy `highest-score` (score 7.2; margin +0.8 over runner-up).

**JSON** (full provenance, one row per checkpoint resolved):

```jsonc
{
  "auto_resolutions": [
    {
      "checkpoint_id": "frame-checkpoint",
      "policy": "accept-as-is",
      "resolved_value": "<model-proposed-frame>",
      "alternatives_available": [],
      "runtime_or_model": "runtime",
      "resolved_at": "2026-05-11T12:34:56Z"
    },
    {
      "checkpoint_id": "tournament-tradeoff",
      "policy": "highest-score",
      "resolved_value": "strand-b",
      "alternatives_available": ["strand-a", "strand-c"],
      "scores": { "strand-a": 6.4, "strand-b": 7.2, "strand-c": 6.1 },
      "runtime_or_model": "runtime",
      "resolved_at": "2026-05-11T12:36:42Z"
    }
  ]
}
```

---

## 11. Migration plan

Sliced, Proof-Carrying-Fix style. Each slice ships independently with full tests and a regenerated plugin bundle.

### Slice 1 — schema layer

- Rename `src/schemas/depth.ts` → `src/schemas/rigor.ts`. Type becomes `Rigor = z.enum(['lite','standard','deep'])`.
- Add `src/schemas/tournament.ts` and `src/schemas/autonomous.ts` (or a combined `src/schemas/axes.ts`).
- Replace `CONSEQUENTIAL_RIGORS` constant with a helper `isConsequentialAxes({ rigor, tournament, autonomous })` returning `rigor === 'deep' || tournament || autonomous`.
- No CLI or schematic changes yet. Old code paths still compile against compatibility re-exports if needed; otherwise tests are touched in this slice.
- **No fixture regeneration.**

### Slice 2 — CLI layer

- Update CLI parsing to accept `--rigor`, `--tournament`, `--tournament-n`, `--autonomous`.
- Drop `--mode`. Drop `entryModeForDepth`, `depthForEntryMode`, `validateModeDepthAliasConsistency`, `validateFlowDepth`, and mode/depth runtime support rows.
- New per-tuple validation reads the per-flow allow-list from the compiled fixture.
- Static fixture-load validation: refuse-policy checkpoint + `supports_autonomous: true` → reject.
- Update CLI router and `cli-router.test.ts`.
- **No fixture regeneration yet.** Compiled fixtures still carry the old `entry_modes` shape; this slice adds a transitional reader that maps old shape to allow-list at load. Reader is removed in Slice 4.

### Slice 3 — per-flow schematic + fixture updates

For each public flow (Review, Fix, Build, Explore, Pursue) and then Runtime Proof if it remains an emitted internal fixture:

- Rewrite `src/flows/<flow>/schematic.json`: remove `entry_modes`, add the `axes` block.
- Regenerate `generated/flows/<flow>/circuit.json`.
- Update flow's contract.md to reference axes.
- Regenerate plugin runtime bundles (`plugins/circuit/runtime/`, `plugins/claude/runtime/`).
- Refresh golden run proofs.
- Update flow-specific tests.

### Slice 4 — drop dead code

- Drop the Slice-2 transitional reader.
- Drop any remaining shims, compat re-exports, or alias code.
- Drop `entry_modes` from `CompiledFlow` schema.
- Drop tests pinning the old alias behavior.

### Historical data

Hard break. Old run folders are not parseable by new code. Old fixtures regenerated in Slice 3. No migration tooling for run folders.

---

## 12. Edge cases (locked)

| Case | Behavior |
|---|---|
| `--tournament-n 1` or lower | Parse-time error: "Tournament requires at least 2 strands". |
| `--tournament` on a flow with `supports_tournament: false` | Parse-time error with flow's allow-list. |
| `--autonomous` on a flow with `supports_autonomous: false` | Parse-time error with flow's allow-list. |
| Flow with `supports_autonomous: true` containing a `refuse` checkpoint | Fixture-load rejection. |
| Operator passes axis flags + the flow has different defaults | Operator flags override per-axis. Unspecified axes use flow defaults; flow defaults fall back to axis defaults. |
| Autonomous on a flow with zero checkpoints | Valid (no-op for checkpoint resolution). All other autonomous behaviors still apply. |
| Tournament strand failure (1 of N fails) | Continue with N-1 if ≥ 2 survivors. |
| Tournament strand failure (>1 of N fails, < 2 survivors) | Abort with `tournament collapsed: <reason>`. |
| Lite + tournament | Valid. N lite strands. Cheap-and-diverse use case. |
| Deep + tournament + autonomous | Valid. N deep strands, winner auto-selected. |

---

## 13. Cross-cutting interactions (deferred to their own grills)

- **`--from-run`** — interaction with axes (can `--from-run` change axes vs the original run?) is part of the `--from-run` spec, not this one.
- **Checkpoint protocol** — the exact wire shape of `user_input.requested` events and how host adapters render them is part of the checkpoint protocol spec.
- **Config layer** — whether user-global or project config can override per-flow allow-lists is deferred to the config spec. This 3-axis spec is config-agnostic.

---

## 14. Acceptance criteria

Implementation matches this spec when:

1. `src/schemas/rigor.ts` exports `Rigor = z.enum(['lite','standard','deep'])`. No `tournament` or `autonomous` values in the rigor enum.
2. `CompiledFlow` schema declares an `axes` block; no `entry_modes` array.
3. CLI parses `--rigor`, `--tournament`, `--tournament-n`, `--autonomous`. Rejects `--mode` as unknown.
4. The five public flows and the internal Runtime Proof fixture carry the allow-lists in §3.
5. A flow with `supports_autonomous: true` and a `refuse` checkpoint fails fixture load.
6. Each rubric dim emits `{ runtime_signal, model_judgment, final_score }`. Runtime-veto rule observable.
7. Auto-resolutions section appears in operator-summary JSON with full provenance and in MD/HTML with summary lines.
8. Tournament strand failure handling: ≥ 2 survivors continue; < 2 survivors abort.
9. Plugin runtime bundles regenerated per slice. CI green throughout.

---

## 15. Open questions for downstream specs

- Frame checkpoint shape — defined in `explore-intent-v1.md`; this spec assumes it.
- Branch-distinctness scoring (tournament-only rubric dim) — needs a non-trivial similarity heuristic to gain a runtime signal; deferred.
- Operator-summary display tuning (which axis values are always shown vs conditionally) — implementation detail.
- Schematic schema_version bump — likely yes; resolved during Slice 1.

---

## Appendix A. Current-code reconciliation (2026-05-18)

This appendix is the current implementation snapshot. It is intentionally separate from the target spec above so target decisions do not read as shipped behavior.

### A1. Architecture and source of truth

| Surface | Current code fact | Evidence | Status |
|---|---|---|---|
| Flow ownership | Flows are authored as `FlowData`/`FlowDefinition` packages and compiled through `flowPackages`; engine registries derive from the catalog. | `src/flows/flow-definition.ts:67-86`, `src/flows/flow-definition.ts:316-339`, `src/flows/flow-definition.ts:374-388`, `src/flows/catalog.ts:18-27` | Spec corrected here. |
| Engine boundary | The engine is not supposed to import individual flow modules directly; adding a flow means adding a package and appending it to the catalog. | `src/flows/types.ts:1-11`, `src/flows/catalog.ts:1-6` | Spec corrected here. |
| Runtime surfaces | Public operator/runtime metadata is carried on each package as `runtimeSurface.supportedEntryModes`, primary result, and progress metadata. | `src/flows/types.ts:140-166`, `src/flows/flow-definition.ts:279-293` | Spec corrected here. |

### A2. Schemas and compiled fixture shape

| Claim area | Current code fact | Evidence | Status |
|---|---|---|---|
| Axis schema | There is no shipped `Rigor`, `Tournament`, `Autonomous`, or `Axes` schema. The shipped enum is still `Depth = lite | standard | deep | tournament | autonomous`. | `src/schemas/depth.ts:3-11` | Code must change to match spec. |
| Compiled fixtures | `CompiledFlow` requires `entry_modes`; no `axes` block exists. | `src/schemas/compiled-flow.ts:18-40` | Code must change to match spec. |
| Flow schematics | Active schematics still declare `entry_modes`, `stage_path_policy`, and `stages`; no `axes` block exists. Source schematic mirrors show the same entry-mode shape for Review, Fix, Build, Explore, and Pursue. | `src/schemas/flow-schematic.ts:424-434`, `src/schemas/flow-schematic.ts:463-480`, `src/flows/review/schematic.json:124-130`, `src/flows/fix/schematic.json:578-599`, `src/flows/build/schematic.json:252-273`, `src/flows/explore/schematic.json:470-496`, `src/flows/pursue/schematic.json:283-294` | Code must change to match spec. |
| Checkpoint policies | Checkpoints declare `choices`, optional `safe_default_choice`, optional `safe_autonomous_choice`, and optional `report_template`; they do not declare `accept-as-is`, `highest-score`, `first-acceptable`, or `refuse`. | `src/schemas/step.ts:68-111` | Code must change to match spec. |
| Fanout limits | Static fanout caps branches at 64. Dynamic fanout has a positive `max_branches` capped at 256 and defaulted to 16. Bounded concurrency is capped at 64. | `src/schemas/step.ts:300-350` | Spec target differs; see decision conflict C3. |

### A3. CLI surface and fixture-load validation

| Claim area | Current code fact | Evidence | Status |
|---|---|---|---|
| CLI flags | The CLI accepts `--depth`, `--entry-mode`, and `--mode`; usage text documents `--mode` and `--depth` aliases. | `src/cli/circuit.ts:101-123`, `src/cli/circuit.ts:203-224` | Code must change to match spec. |
| Target flags | Unknown flags throw. Since `--rigor`, `--tournament`, `--tournament-n`, and `--autonomous` are not parsed, they are unknown today. | `src/cli/circuit.ts:203-224`, `src/cli/circuit.ts:284-285` | Code must change to match spec. |
| Alias validators | `entryModeForDepth`, `depthForEntryMode`, and `validateModeDepthAliasConsistency` still exist. | `src/cli/circuit.ts:397-425` | Code must change to match spec. |
| Runtime support validation | The CLI validates by supported `(entryModeName, depth)` rows from flow runtime surfaces, not by axis tuples. | `src/cli/circuit.ts:458-475`, `src/cli/circuit.ts:576-648` | Code must change to match spec. |
| Fixture load | `loadFixture` parses `CompiledFlow` and validates flow-kind stage policy. It does not validate `supports_autonomous` plus reachable `refuse` checkpoints. | `src/cli/circuit.ts:477-490` | Code must change to match spec. |

### A4. Checkpoints, autonomous behavior, and presentation

| Claim area | Current code fact | Evidence | Status |
|---|---|---|---|
| Checkpoint resolution | `deep` and `tournament` wait. `autonomous` requires `safe_autonomous_choice`. Other depths require `safe_default_choice`. | `src/runtime/executors/checkpoint.ts:43-65` | Code must change to match spec. |
| Missing safe choice | Missing safe choices fail during runtime execution and are recorded in trace; they do not fail fixture load. | `src/runtime/executors/checkpoint.ts:181-191`, `tests/runtime/control-loop.test.ts:849-912` | Code must change to match spec. |
| Checkpoint request body | Request JSON records prompt, allowed choices, safe defaults, and execution context. | `src/runtime/executors/checkpoint.ts:67-94` | Spec corrected here. |
| Auto-resolved trace | `checkpoint.requested` and `checkpoint.resolved` trace entries include `auto_resolved`. | `src/runtime/executors/checkpoint.ts:149-158`, `src/runtime/executors/checkpoint.ts:200-215` | Partially supports target. |
| Run boundary presentation hook | The run boundary wires a progress projector into the trace store, so presentation events are derived from trace append events. | `src/runtime/run/run-boundary.ts:86-113` | Spec corrected here. |
| Progress presentation | Progress projection suppresses waiting UI for auto-resolved checkpoint requests; non-auto-resolved checkpoints emit `checkpoint.waiting` and `user_input.requested`. | `src/runtime/projections/progress.ts:673-755` | Spec corrected here. |
| Operator summary | JSON, Markdown, and optionally HTML summaries are written, but there is no `auto_resolutions` section. | `src/shared/operator-summary-writer.ts:178-207`, `src/shared/operator-summary-writer.ts:341-375` | Code must change to match spec. |

### A5. Tournament behavior

| Claim area | Current code fact | Evidence | Status |
|---|---|---|---|
| Tournament as entry mode | Explore has a `tournament` entry mode whose depth is `tournament`; tournament is not a separate axis. | `src/flows/explore/data.ts:111-140`, `generated/flows/explore/tournament.json:13-20` | Code must change to match spec. |
| Fan-out stage | Explore tournament drafts options, then dynamically fans out option cases in the Plan/Decision stage. | `src/flows/explore/data.ts:289-357`, `generated/flows/explore/tournament.json:35-45` | Partially supports target. |
| Strand count | Explore tournament is bounded by the report schema's four option ids and the fanout's `max_branches: 4`; there is no runtime `tournament_n`. | `src/flows/explore/data.ts:347-353`, `src/flows/explore/data.ts:403-430`, `src/runtime/fanout/branch-expansion.ts:61-65` | Decision conflict; see C3. |
| Failure policy | Explore tournament uses `on_child_failure: abort-all` and `join.policy: aggregate-only`; aggregate-only requires every branch to close complete with a parseable result body. | `src/flows/explore/data.ts:347-357`, `src/shared/fanout-join-policy.ts:90-112`, `src/runtime/executors/fanout.ts:122-170` | Decision conflict; see C3. |
| Join output | Runtime writes a fanout aggregate and appends `fanout.joined` with completed and failed branch counts. | `src/runtime/executors/fanout.ts:198-241` | Spec corrected here. |

### A6. Current per-flow support projection

| Flow | Visibility | Current entry modes/depths | Target-axis projection | Evidence | Status |
|---|---|---|---|---|---|
| Review | public | `default/standard` | `[standard]`, no tournament, no autonomous | `src/flows/review/data.ts:38-91` | Spec corrected here. |
| Fix | public | `default/standard`, `lite/lite`, `deep/deep`, `autonomous/autonomous` | `[lite, standard, deep]`, no tournament, autonomous yes | `src/flows/fix/data.ts:141-165` | Projection is valid, but lite conflicts with D03/D07; see C3. |
| Build | public | `default/standard`, `lite/lite`, `deep/deep`, `autonomous/autonomous` | `[lite, standard, deep]`, no tournament, autonomous yes | `src/flows/build/data.ts:100-121`, `generated/flows/build/circuit.json:13-38` | Spec corrected here. |
| Explore | public | `default/standard`, `lite/lite`, `deep/deep`, `tournament/tournament`, `autonomous/autonomous` | `[lite, standard, deep]`, tournament yes, autonomous yes | `src/flows/explore/data.ts:111-140`, `generated/flows/explore/tournament.json:13-20` | Projection is valid, but tournament details conflict; see C3. |
| Pursue | public | `default/standard`, `autonomous/autonomous` | `[standard]`, no tournament, autonomous yes | `src/flows/pursue/data.ts:34-39`, `src/flows/pursue/data.ts:98-109`, `generated/flows/pursue/circuit.json:13-26` | Spec corrected here. |
| Runtime Proof | internal | `runtime-proof/standard` | `[standard]`, no tournament, no autonomous | `src/flows/runtime-proof/data.ts:5-35`, `generated/flows/runtime-proof/circuit.json:13-20` | Spec corrected here. |

## Appendix B. Locked grill decision ledger (31)

None of these decisions were silently changed. Rows marked "operator decision needed" are preserved as target decisions even though current code conflicts with them.

| # | Locked decision | Reconciliation status |
|---|---|---|
| D01 | Split flat depth into rigor, tournament, and autonomous axes. | Preserved target; code still uses flat `Depth` (`src/schemas/depth.ts:3`). |
| D02 | Rigor vocabulary is `lite`, `standard`, `deep`. | Preserved target; code still includes `tournament` and `autonomous` in `Depth` (`src/schemas/depth.ts:3`). |
| D03 | Rigor must not alter the canonical stage path. | Operator decision needed: Fix lite omits Review today (`src/flows/fix/data.ts:143-152`, `generated/flows/fix/lite.json:59-63`). |
| D04 | Lite means one pass per stage with a permissive bar. | Preserved target; not represented as a typed runtime policy today. |
| D05 | Standard is the baseline. | Preserved target; current `default` entry modes map to `standard` depth (`src/cli/circuit.ts:397-412`). |
| D06 | Deep iterates within each stage until rubric pass or budget cap. | Preserved target; current code has `deep` depth but no generic typed iteration policy in the audited surfaces. |
| D07 | Rigor never adds or removes checkpoints. | Operator decision needed: Fix lite removes the review relay path and closes through `fix-close-lite` (`src/flows/fix/data.ts:443-510`). |
| D08 | Tournament is boolean plus N integer lower bound 2, default 3. | Operator decision needed: current Explore tournament is a mode with max 4 options, not a runtime `tournament_n` axis (`src/flows/explore/data.ts:130-134`, `src/flows/explore/data.ts:347-353`). |
| D09 | Tournament fan-out happens at a flow-declared stage. | Partially matched: Explore fans out in Plan/Decision, but declaration is route shape, not an `axes.tournament_fan_out_stage` field (`src/flows/explore/data.ts:289-357`). |
| D10 | Tournament strands are isolated during generation. | Partially matched for relay branches; fanout runs branch-specific outputs and branch directories (`src/runtime/executors/fanout.ts:127-170`). |
| D11 | Tournament strands inherit run rigor. | Preserved target; current tournament is its own depth, so there is no combined `rigor+tournament` tuple. |
| D12 | Tournament winner-select checkpoint chooses one strand and later stages run once. | Partially matched: Explore has a tradeoff checkpoint and then decision/close steps (`src/flows/explore/data.ts:390-435`). |
| D13 | Tournament branch failure continues with survivors >= 2 and aborts below 2. | Operator decision needed: current Explore uses `abort-all` plus `aggregate-only` (`src/flows/explore/data.ts:347-357`, `src/shared/fanout-join-policy.ts:90-112`). |
| D14 | Tournament does not add stages outside fanout. | Partially matched: Explore embeds tournament work in Plan/Decision and Close (`generated/flows/explore/tournament.json:35-56`). |
| D15 | Autonomous is a checkpoint-resolution policy. | Preserved target; current autonomous is a `Depth` value whose checkpoint resolver uses safe choices (`src/runtime/executors/checkpoint.ts:43-65`). |
| D16 | Autonomous keeps the same stages/checkpoints as interactive. | Mostly matched for current autonomous entry modes, but not yet represented as an axis. |
| D17 | Autonomous fires declared auto-resolution instead of waiting. | Partially matched: current code fires `safe_autonomous_choice`, not one of the four target policies (`src/runtime/executors/checkpoint.ts:47-55`). |
| D18 | Auto-resolutions are recorded in the canonical artifact. | Code follow-up: trace records auto-resolved checkpoints, but operator-summary JSON has no `auto_resolutions` field (`src/runtime/executors/checkpoint.ts:206-215`, `src/shared/operator-summary-writer.ts:341-375`). |
| D19 | Autonomous suppresses ambient interactive UI but keeps trace/progress/writes. | Partially matched: progress suppresses waiting UI for auto-resolved checkpoint requests (`src/runtime/projections/progress.ts:673-755`). |
| D20 | CLI parses any axis tuple before flow validation. | Code follow-up: target flags are unknown today (`src/cli/circuit.ts:203-224`, `src/cli/circuit.ts:284-285`). |
| D21 | Unsupported tuple is default-denied with an allow-list in the error. | Code follow-up: current rejection is depth/entry-mode based (`src/cli/circuit.ts:466-475`, `src/cli/circuit.ts:576-648`). |
| D22 | Cross-axis constraints are flow-owned, not global. | Preserved target; current flow-owned support is expressed through runtime surfaces derived from entry modes (`src/flows/flow-definition.ts:240-249`). |
| D23 | Schematics carry an `axes` block with allow-list/default/fanout stage. | Code follow-up: schematics carry `entry_modes`, not `axes` (`src/schemas/flow-schematic.ts:424-480`). |
| D24 | Axis defaults are standard/false/false/3. | Preserved target; no typed axis defaults exist today. |
| D25 | `--mode` is removed in target; alias validators and support matrix go away. | Code follow-up: `--mode` and alias validators still exist (`src/cli/circuit.ts:101-123`, `src/cli/circuit.ts:397-425`). |
| D26 | Target CLI flags are `--rigor`, `--tournament`, `--tournament-n`, `--autonomous`. | Code follow-up: these flags are not parsed today (`src/cli/circuit.ts:203-224`, `src/cli/circuit.ts:284-285`). |
| D27 | Auto-resolution policies are `accept-as-is`, `highest-score`, `first-acceptable`, `refuse`. | Code follow-up: current checkpoint policy has safe choices only (`src/schemas/step.ts:68-111`). |
| D28 | `supports_autonomous` plus reachable `refuse` fails fixture-load validation. | Code follow-up: fixture load parses `CompiledFlow` and flow-kind policy only (`src/cli/circuit.ts:477-490`). |
| D29 | Autonomous tournament winner-select uses `highest-score` unless a flow declares otherwise. | Operator decision needed: Explore tradeoff checkpoint has only `safe_default_choice`, no `safe_autonomous_choice` or score policy (`src/flows/explore/data.ts:403-430`). |
| D30 | Rubric provenance uses runtime signal, model judgment, final score, and runtime-veto. | Code follow-up: this shape was not found in the audited schemas; current reports use flow-specific schemas. Probe: `rg -n "runtime_signal|model_judgment|final_score" src tests generated docs --glob '!docs/specs/3-axis-rigor-tournament-autonomous-v1.md'` returned no matches. |
| D31 | Operator artifacts include auto-resolutions in JSON plus Markdown/HTML summaries. | Code follow-up: summaries are written, but no `auto_resolutions` section exists (`src/shared/operator-summary-writer.ts:178-207`, `src/shared/operator-summary-writer.ts:341-375`). |

## Appendix C. Misalignment report

### C1. Spec corrected here

| Finding | Resolution |
|---|---|
| Flow count and scope were stale after Migrate/Sweep removal and Pursue/Runtime Proof addition. | Updated scope and §3/§14 tables to five public flows plus the internal Runtime Proof fixture. Evidence: `src/flows/catalog.ts:18-27`, `src/flows/pursue/data.ts:34-39`, `src/flows/runtime-proof/data.ts:5-35`. |
| The spec did not explain the functional/declarative refactor. | Added current architecture notes showing `FlowData`, `compileFlowDefinitions`, and catalog-derived registries. Evidence: `src/flows/flow-definition.ts:67-86`, `src/flows/flow-definition.ts:374-388`, `src/flows/catalog.ts:1-27`. |
| The per-flow allow-list table was target-only but looked like current implementation. | Reframed it as a target projection and added Appendix A6 with current entry mode evidence. |
| Runtime presentation claims were too broad. | Recorded current progress behavior: auto-resolved checkpoint requests do not emit waiting UI; waiting checkpoints emit `checkpoint.waiting` and `user_input.requested`. Evidence: `src/runtime/projections/progress.ts:673-755`. |
| Fixture-load validation claims were target behavior, not current behavior. | Recorded that current fixture loading parses `CompiledFlow` and flow-kind policy only. Evidence: `src/cli/circuit.ts:477-490`. |
| Tournament behavior lacked current-code details. | Recorded current Explore tournament as dynamic fanout with max 4, bounded concurrency 2, abort-all, and aggregate-only join. Evidence: `src/flows/explore/data.ts:289-357`. |

### C2. Code must change to match spec (operator follow-up)

| Gap | Required code change |
|---|---|
| Axis schemas are absent. | Add typed rigor/tournament/autonomous or axes schemas and migrate off flat `Depth` (`src/schemas/depth.ts:3`). |
| Compiled fixtures lack `axes`. | Replace `entry_modes` with an `axes` block in `CompiledFlow` and schematic schemas (`src/schemas/compiled-flow.ts:18-40`, `src/schemas/flow-schematic.ts:424-480`). |
| CLI still uses `--mode`/`--depth`. | Add target axis flags and remove alias inference/validation (`src/cli/circuit.ts:101-123`, `src/cli/circuit.ts:397-425`). |
| Flow support is mode/depth rows. | Replace runtime-surface support rows with axis tuple allow-lists (`src/flows/flow-definition.ts:240-249`, `src/cli/circuit.ts:458-475`). |
| Checkpoint auto-resolution vocabulary is still safe-choice based. | Add `accept-as-is`, `highest-score`, `first-acceptable`, and `refuse` policies (`src/schemas/step.ts:68-111`, `src/runtime/executors/checkpoint.ts:43-65`). |
| Autonomous fixture-load rejection does not exist. | Add static validation for reachable `refuse` checkpoints when autonomous is supported (`src/cli/circuit.ts:477-490`). |
| Auto-resolution artifact section does not exist. | Add `auto_resolutions` provenance to operator summary JSON and Markdown/HTML rendering (`src/shared/operator-summary-writer.ts:178-207`, `src/shared/operator-summary-writer.ts:341-375`). |
| Runtime rubric provenance is not represented in the audited schemas. | Add `{ runtime_signal, model_judgment, final_score }` where the relevant flow report schemas need it. Probe: `rg -n "runtime_signal|model_judgment|final_score" src tests generated docs --glob '!docs/specs/3-axis-rigor-tournament-autonomous-v1.md'` returned no matches. |

### C3. Decision conflict - needs operator

| Conflict | Current evidence | Choices on the table | Operator input needed |
|---|---|---|---|
| Lite stage/checkpoint invariance vs Fix lite skipping Review. | Fix lite is described as skipping the review relay, routes from verification to `fix-close-lite`, and the generated lite fixture omits `review`. Evidence: `src/flows/fix/data.ts:143-152`, `src/flows/fix/data.ts:443-510`, `generated/flows/fix/lite.json:59-63`. | A. Keep locked decision and change Fix lite to keep Review. B. Amend D03/D07 so lite may remove review if a flow declares it. C. Split "rigor" from "shortcut mode" and keep current Fix lite outside the rigor axis. | Decide whether target rigor invariance beats current Fix lite behavior. |
| Tournament N cap/no-cap vs current max 4. | Explore options and checkpoint choices are fixed to option 1-4, and fanout has `max_branches: 4`. Evidence: `src/flows/explore/data.ts:347-353`, `src/flows/explore/data.ts:403-430`. | A. Keep no upper bound and redesign Explore option schema/checkpoint rendering. B. Set a product cap, likely 4, and amend D08/§6/§12. C. Allow flow-specific caps while keeping global lower bound/default. | Decide whether `tournament_n` is uncapped, globally capped, or flow-capped. |
| Tournament survivor policy vs current abort-all/aggregate-only. | Current Explore tournament aborts remaining work on first inadmitted child and aggregate-only fails unless all branches complete with parseable bodies. Evidence: `src/flows/explore/data.ts:347-357`, `src/shared/fanout-join-policy.ts:90-112`, `src/runtime/executors/fanout.ts:122-170`. | A. Keep survivor policy and change fanout failure/join behavior. B. Amend target to fail on any branch failure. C. Make survivor policy flow-specific. | Decide whether survivor semantics are required for v1 tournament. |
| Autonomous + tournament winner selection vs current tradeoff checkpoint. | Current tradeoff checkpoint has `safe_default_choice: option-1` but no `safe_autonomous_choice` and no score policy. Evidence: `src/flows/explore/data.ts:403-430`, `src/runtime/executors/checkpoint.ts:47-55`. | A. Add `highest-score` autonomous selection. B. Refuse autonomous tournament until scorer exists. C. Require operator checkpoint for tournament even in autonomous runs. | Decide whether deep/tournament/autonomous must be valid in v1 or deferred. |

## Appendix D. Six prior Codex adversarial-review finding statuses

No list naming the six prior Codex findings was present in this spec or found in current repo docs during this pass. The table below tracks the six review finding classes implied by the goal and resolved by this reconciliation. If there is an external review artifact, copy its exact finding names into this table before implementation work starts.

| Prior finding class | Resolution status |
|---|---|
| 1. Flow inventory and allow-list drift. | Resolved in spec: §3, §14, and Appendix A6 now include Review, Fix, Build, Explore, Pursue, and internal Runtime Proof with current-code evidence. |
| 2. Target 3-axis design read as current shipped behavior. | Resolved in spec: status note and Appendix A separate target design from current implementation. |
| 3. CLI surface mismatch. | Documented as code follow-up: current `--mode`/`--depth` aliases remain; target flags are absent. Evidence: `src/cli/circuit.ts:101-123`, `src/cli/circuit.ts:203-224`, `src/cli/circuit.ts:397-425`. |
| 4. Schematic and compiled fixture shape mismatch. | Documented as code follow-up: current shape is `entry_modes`, not `axes`. Evidence: `src/schemas/compiled-flow.ts:18-40`, `src/schemas/flow-schematic.ts:424-480`. |
| 5. Checkpoint policy and fixture-load validation mismatch. | Documented as code follow-up: current safe-choice checkpoint policy and runtime missing-safe-choice failures differ from target policy/refuse load validation. Evidence: `src/schemas/step.ts:68-111`, `src/runtime/executors/checkpoint.ts:43-65`, `tests/runtime/control-loop.test.ts:849-912`. |
| 6. Tournament runtime mismatch. | Documented as decision conflict and code follow-up: current Explore tournament is max-4, abort-all, aggregate-only, and not composable with autonomous. Evidence: `src/flows/explore/data.ts:347-357`, `src/flows/explore/data.ts:403-430`, `src/shared/fanout-join-policy.ts:90-112`. |
