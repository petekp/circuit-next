---
name: phase-1-close-revised
description: Revised Phase 1 close plan — decomposes governance reform, moves runtime-boundary safety before dogfood-run-0, adds D10 review discipline, and makes Product Reality Gate evidence executable.
type: plan
date: 2026-04-20
supersedes_scope:
  - specs/plans/arc-remediation-plan-codex.md §Slice 26 through §Slice 28d
  - specs/plans/arc-remediation-plan-codex.md §Slice 30 pre-runtime-writes manifest/event-writer gate, only to the extent moved earlier into Slice 27c-runtime-boundary
does_not_supersede:
  - specs/plans/arc-remediation-plan-codex.md §Slice 29
  - specs/plans/arc-remediation-plan-codex.md §Slice 30 residual Phase 2 entry hardening after the minimal runtime-boundary gate lands
  - specs/plans/arc-remediation-plan-codex.md §Slice 31
  - specs/plans/arc-remediation-plan-codex.md §Slice 32 (v0.2 hygiene)
  - specs/plans/arc-remediation-plan-codex.md §Adversarial-pass cadence except where D10 later amends it
  - specs/plans/arc-remediation-plan-codex.md §Convergence Criteria except as amended by the Product Reality Gate
authored_by: claude-opus-4-7 + gpt-5-codex (joint, in-session) + operator
base_commit: 6d348cfb26b6aaa1352c85596eb4750ddaf52343
folds_in_review:
  artifact: specs/plans/phase-1-close-revised.md
  reviewer: gpt-5-codex
  verdict: ACCEPT-WITH-FOLD-INS
  counts: 7 HIGH / 5 MED / 3 LOW
---

# Phase 1 Close — Revised Plan (2026-04-20)

## Why this plan exists

The prior plan (`arc-remediation-plan-codex.md`) sequenced 14 slices to close
Phase 1. By Slice 25a landing (~30 total slices since scaffold), seven pitfalls
surfaced during an in-session reflective pass between Claude and Codex:

1. **Methodology runaway.** Each adversarial pass spawns fold-in slices; the
   old hard cap was prose in a plan file, not authoritative governance.
2. **The thing does not run.** Zero end-to-end `circuit:run`. `package.json`
   has no runner script. `src/index.ts` only re-exports schemas.
   `.claude-plugin/` contains only `.gitkeep`.
3. **Correlated-twin review.** Claude and Codex share training distribution
   (Knight & Leveson 1986). No structurally different third voice is currently
   required.
4. **Better specs, not yet better software.** The clear product bug caught
   (`run.projection` / `state.json` shape mismatch) was found by an adversarial
   Codex pass, not by ratchets.
5. **Cognitive load too high for a cold solo operator.** The lane/framing
   ritual is powerful but brittle when not backed by executable checks and
   small slices.
6. **Self-hosting over-serving the methodology.** Every plugin observation was
   becoming another methodology slice, delaying the plugin.
7. **No ship-early trigger.** The old plan had pause triggers but no shortcut
   to working product evidence.

This revised plan narrows the remaining Phase 1 close arc to the minimum
runner-critical path, installs only the governance deltas needed before that
path starts, and treats `dogfood-run-0` as the first real product proof. The
2026-05-04 date below is a forecast for planning pressure, not an acceptance
criterion and not a reason to shrink evidence.

## Review Fold-Ins

The adversarial review of the earlier draft returned 7 HIGH, 5 MED, and 3 LOW
findings. This plan accepts the verdict and folds them in as follows:

- **H1:** D1 gets a machine-readable `product_gate_exemptions` ledger at
  `specs/methodology/product-gate-exemptions.md` with YAML frontmatter (name,
  description, type=ledger) + a markdown table (columns: `phase_id | slice |
  reason | consumed`). The exemption cannot be used to amend D1 or D3
  themselves. Slice 25b is recorded as a one-time operator waiver (bootstrap
  exception), not proof that the new Product Reality Gate works.
- **H2:** Runtime writes move behind a pre-dogfood runtime-boundary slice.
  Slice 27c now lands the append-only event writer, reducer-derived snapshot,
  manifest snapshot contract, hash algorithm, and byte-match checks before
  Slice 27d may execute `dogfood-run-0`.
- **H3:** D3 no longer silently mutates ADR-0001. It is scheduled as an
  explicit ADR-0001 reopen/amendment slice. Until that lands, "Phase 1.5 Alpha
  Proof" is the planning nickname, not an authoritative methodology change.
- **H4:** D6 requires executable probes in addition to inventory: corrupt
  manifest bytes must fail, deleting an event must create a snapshot mismatch,
  and placeholder/empty/non-imported/non-executed inventory entries must fail.
- **H5:** Phase close requires two different workflow fixtures or goals with
  differing result artifacts, verified loading of
  `.claude-plugin/skills/dogfood-run-0/circuit.json`, and snapshots derived by
  replaying `events.ndjson`, not written independently.
- **H6:** Before runtime-boundary work, status docs must gain structured
  `current_slice` and `status_epoch` checks, and the pinned ratchet floor must
  land. README and PROJECT_STATE being stale in the same way is never green.
- **H7:** 2026-05-04 is forecast language only. A fastest-falsifier checkpoint
  runs after Slice 26a; if the runner needs event/model/schema redesign, switch
  to one Discovery slice instead of silently thinning acceptance.
- **M1:** D2 gets a fifth hardening category: operator safety, data-loss, or
  security boundary failure on a runnable path. It requires a reproducer.
- **M2:** D5 gets a `self_hosting_capabilities` matrix in `TIER.md`. If a rule
  cannot yet be expressed by circuit-next, exactly one ADR with expiry may
  carry the exception.
- **M3:** D7 gets an emergency rollback/correction path distinct from normal
  amendment. It requires an operator note plus non-LLM evidence or a failing
  audit/test, and it blocks product work until resolved.
- **M4:** Slice 27b becomes baseline inventory; 27c and 27d acceptance assert
  the post-implementation delta rather than accepting a placeholder checklist.
- **M5:** A 60-minute read-only `spike/kernel-replay` mining pass runs before
  runtime-boundary implementation and may extract event/reducer/manifest
  lessons only. No code cherry-pick is allowed.
- **L1:** Every `TIER.md` claim must name an enforcing file path, planned slice,
  or explicit `not claimed`; audit must fail orphan claims.
- **L2:** A design-only Product Reality Gate proof requires an ADR naming the
  next executable proof and an expiry date. Expiry is bounded at 2 slices or 14
  calendar days from the recording ADR; renewal requires a second ADR with a
  named hardening event.
- **L3:** Non-LLM human review must be recorded at
  `specs/reviews/phase-1-close-reform-human.md` with `opened_scope`,
  `skipped_scope`, and at least one "I could not understand X" field, even if
  no objections are raised. If the operator cannot perform the non-LLM
  cold-read (asleep / unavailable / explicit delegation), Claude + Codex may
  stand in as LLM cold-readers, recorded at
  `reviewer_role: LLM-standin-for-human-cold-read`. Operator retains right to
  add a section on pickup, which takes precedence. This delegation is strictly
  weaker than a zero-context human drill and is recorded as such in the yield
  ledger for that pass.

## Methodology Deltas (Scheduled, Not Installed By This Planning Pass)

This file schedules methodology work. It does not itself amend
`specs/methodology/decision.md`, `specs/adrs/ADR-0001-methodology-adoption.md`,
or any contract. Those installations happen in the slices below.

### D1. Product Reality Gate

Target: `specs/methodology/decision.md`.

No methodology phase may close solely on authored governance artifacts
(contracts, ADRs, reviews, ledgers, audit rules, or tests). Each phase must
produce or preserve one executable product proof.

A product proof is one of:

- a user-facing command that runs against a non-methodology workflow;
- an end-to-end fixture that creates a run log and derives a snapshot;
- a design-only claim recorded by ADR, with named next executable proof and
  expiry date.

A design-only Product Reality Gate proof expires after 2 slices or 14 calendar
days from the recording ADR, whichever is sooner. Renewal requires a second ADR
naming a specific hardening event that justifies the extension.

`product_gate_exemptions` is a machine-readable ledger at
`specs/methodology/product-gate-exemptions.md` with YAML frontmatter (name,
description, type=ledger) + a markdown table (columns: `phase_id | slice |
reason | consumed`). Exemptions cannot amend D1 or D3. Slice 25b consumes a
one-time operator waiver (bootstrap exception) because it changes future
acceptance terms; it is not evidence that the Gate works.

### D2. Methodology Hardening Budget

Target: `specs/methodology/decision.md`, after the first alpha runner exists.

After the first alpha runner, methodology-only or audit-hardening work must
classify as one of:

- cloneability failure;
- false-green authority binding;
- silent ratchet regression;
- formal stabilization after a failed Product Reality Gate;
- operator safety, data-loss, or security boundary failure on a runnable path,
  backed by a reproducer rather than speculation.

Anything else is deferred to backlog.

### D3. Phase 1.5 Alpha Proof / ADR-0001 Reopen

Target: explicit ADR-0001 reopen/amendment slice.

The plan needs an executable proof before Phase 2, but it must not silently
rewrite ADR-0001's "Phase 1 = contract authorship / Phase 2 = implementation"
split through `decision.md` alone. Until the ADR reopen lands, call the new
concept **Phase 1.5 Alpha Proof** in planning prose.

### D4. Governance Authority Graph Rule

Target: `specs/methodology/decision.md`.

Standing methodology rules (hard caps, cadences, close criteria, convergence
criteria) may not live only in `specs/plans/`. They must be mirrored or hosted
in `specs/methodology/decision.md` or an ADR. Plans may operationalize or
schedule; they may not author durable standing rules by themselves.

### D5. Self-Hosting Sunset Rule

Target: new ADR and `TIER.md`, after `dogfood-run-0`.

After first successful `dogfood-run-0`, methodology evolution should be
implemented by circuit-next itself as workflow/config/tooling, not as
freestanding slice prose. `TIER.md` must include a `self_hosting_capabilities`
matrix that identifies which rule classes can be enforced by current tooling.
If a required rule cannot yet be expressed, one ADR with expiry may carry the
exception.

### D6. Non-LLM Evidence Requirement

Target: `specs/behavioral/cross-model-challenger.md`, once probes can execute.

Every broader adversarial pass must include at least one structurally different
signal:

- mechanical inventory diff plus executable probes;
- AST / schema-derived surface map;
- property / fuzz run;
- zero-context human drill.

Inventory alone is insufficient. The first executable probe set is:

- corrupt persisted manifest bytes and expect runtime-boundary failure;
- delete one event and expect a snapshot/replay mismatch;
- reject placeholder inventory entries that are empty, non-imported, or never
  executed.

### D7. Methodology Cooling And Emergency Correction

Target: `specs/methodology/decision.md`.

A normal methodology amendment may not be followed by another normal
methodology amendment within 3 slices where current rules bind. Operational
implementation of an already-landed amendment does not count as a new
amendment.

Emergency rollback/correction is distinct from amendment. It requires an
operator note plus either non-LLM evidence or a failing audit/test, and it
blocks product work until resolved.

### D8. Rollback Review

Target: `specs/methodology/decision.md`, at Phase 2 close.

Every methodology amendment (D1-D7 and D10 included) is subject to rollback
review at Phase 2 close. Default is "keep"; the mechanism exists so the reform
is not unilaterally permanent.

### D9. `TIER.md` Claim Matrix

Target: repo-root `TIER.md`.

`TIER.md` becomes the source of truth for what is enforced now, documented
only, deferred, or not claimed at each Tier. Every claim must include exactly
one of:

- an enforcing file path;
- a planned slice;
- explicit `not claimed`.

Example of a valid `not claimed` row: `container_isolation: status=not claimed,
rationale=Tier 2+ deferral per ADR-0001`. `not claimed` is culturally
permitted and does not count as orphan; the audit fails only on claims with no
file path, no planned slice, and no explicit `not claimed` declaration.

Audit must fail orphan claims and stale README/PROJECT_STATE/TIER agreement.

### D10. Adversarial Review Discipline

Target: `specs/methodology/decision.md`, with
`specs/reviews/adversarial-yield-ledger.md` as immediate data source.

1. **Pass-count cap.** Adversarial review on a single artifact is capped at 2
   passes for reversible work, 3 for governance changes, and 4 for
   irreversible artifacts such as schema breaks for external consumers,
   production migrations, or published APIs. Beyond the cap requires operator
   written justification naming the specific failure class being hunted.
2. **Compound stopping criterion.** Stop when all are true:
   - yield halved versus prior pass;
   - no HIGH severity appeared in the last pass;
   - the reviewer can name the specific defect class the next pass would hunt
     that the last pass missed;
   - a structurally different mode (runtime, human, fuzzer, property test) is
     available and cheaper than another review pass.

If no structurally different cheaper mode is available at the time of the
decision, the fourth clause is waived; the artifact must record the waiver
explicitly in the yield-ledger row for that pass.

3. **Mode-cycle rule.** After K review passes on an artifact, the next
   defect-discovery effort must come from a structurally different mode before
   another same-mode review is valid.
4. **Artifact-size signal.** If an artifact needs more than 3 adversarial
   passes to converge, treat that as evidence it is too large and decompose it.

The pass-cap values 2/3/4 are opinionated priors, not empirically tuned. Tune
them after 10-20 reviewed artifacts using the yield ledger.

## Slice Sequence From HEAD 6d348cf

All slices below use lane discipline (framing triplet + trajectory check) per
CLAUDE.md. Codex challenger dispatches still use `/codex` (CHALLENGER-I5).

### Slice 25b — Governance Reform, Shrunk

**Lane:** Ratchet-Advance.

**Scope:** install only the minimum governance needed before product work:
D1, D4, D9, D10, the yield ledger wiring, the Product Gate exemption ledger at
`specs/methodology/product-gate-exemptions.md`, the human-cold-read record
requirement, and one audit check. This slice does not install D2, D3, D5, D6,
D7, or D8.

**Product Reality Gate status:** one-time operator waiver (bootstrap exception)
recorded in `specs/methodology/product-gate-exemptions.md`; consumed
immediately; not reusable; cannot amend D1 or D3.

**Deliverables scheduled for the slice:**

- `specs/methodology/decision.md` amended only for D1, D4, and D10.
- `TIER.md` created with D9 claim matrix; each claim has enforcing file path,
  planned slice, or explicit `not claimed`.
- `specs/reviews/adversarial-yield-ledger.md` wired into methodology/audit as
  the D10 evidence source.
- Product Gate exemption ledger created at
  `specs/methodology/product-gate-exemptions.md` with YAML frontmatter (name,
  description, type=ledger) + a markdown table (columns: `phase_id | slice |
  reason | consumed`). Populated for Slice 25b with
  `phase_id: phase-1-pre-1.5-reopen`, `slice: 25b`,
  `reason: bootstrap exception — the slice that changes future acceptance terms cannot itself be proof those terms work`,
  `consumed: true`. When Slice 25d lands ADR-0001 reopen, the `phase_id`
  rewrites to `phase-1.5-alpha-proof`.
- `specs/reviews/phase-1-close-reform-human.md` required with
  `opened_scope`, `skipped_scope`, and "I could not understand X".
- Two `scripts/audit.mjs` checks: one for Product Reality Gate visibility
  (reads `specs/methodology/product-gate-exemptions.md` and flags any phase
  claim without a matching product-proof artifact or valid exemption row), one
  for TIER orphan-claim rejection (reads `TIER.md` and flags any claim row whose
  enforcing `file_path`, `planned_slice`, or `not claimed` declaration is
  absent or broken).
- No edits in this slice to `specs/adrs/ADR-0001-methodology-adoption.md`, any
  `specs/adrs/ADR-0006-*.md`, any file under `specs/contracts/`, or the
  `decision.md` sections that will host D2, D3, D5, D6, D7, or D8 when their
  respective triggers fire.

**Codex challenger:** review the drafted 25b doc set —
`specs/methodology/decision.md` amendments, `TIER.md`, the audit script changes,
and the two new ledgers — for Gate exemption abuse, D10 budget loopholes, and
TIER honesty theater. This is a pass on the drafted 25b doc set, which is a
distinct artifact from this plan; D10 pass counts start at 0 for that artifact.

### Slice 26 — Config Contract And Strict-Key Closure

Product-relevant: a runner cannot safely load config without `.strict()` at
`src/schemas/config.ts:115` and `:135`.

Unchanged from prior plan §Slice 26: author `specs/contracts/config.md`; add
`config.*` rows to `specs/artifacts.json`; remove
`adapter.registry pending_rehome`; strict `Config` + `LayeredConfig` + nested
`defaults`; negative surplus-key tests.

### Slice 26a — Run Snapshot Artifact Split

Product-relevant: `dogfood-run-0` must write `state.json`, and that file must
bind to the standalone `Snapshot` shape, not the in-memory `RunProjection`
wrapper.

Unchanged from prior plan §Slice 26a, except that the fastest-falsifier
checkpoint below now follows it.

### Fastest-Falsifier Checkpoint — After 26a, Before Runtime Work

This checkpoint is not a slice unless it fails. Ask whether the existing
schemas can support a thin vertical runner without redesigning the event
model.

**Tripwire:** the runner needs more than two new rows in
`specs/artifacts.json`, or more than two new `src/schemas/*.ts` files, or
simultaneous structural changes to `RunLog`, `Snapshot`, `Workflow`, and
`Step`, just to close a dry-run.

**If tripped:** switch to one Discovery slice for the minimum runtime
architecture scaffold. Do not silently shrink acceptance to hit 2026-05-04.

### Slice 26b — Status Epoch And Pinned Ratchet Floor

**Lane:** Ratchet-Advance.

**Purpose:** close the false-green audit gap before runtime writes start.

**Deliverables:**

- Structured `current_slice` and `status_epoch` checks for README,
  PROJECT_STATE, and TIER alignment.
- Audit fails when README and PROJECT_STATE agree on a stale story. "Both
  stale" is red, not green.
- Pinned ratchet floor lands before dogfood. Moving-window ratchets may remain
  secondary, but no close gate may depend only on `HEAD~1` comparison.

### Slice 25d — D3 ADR-0001 Reopen

**Lane:** Ratchet-Advance.

**Purpose:** install D3 without silent methodology mutation.

**Deliverables:**

- Explicit ADR-0001 reopen/amendment naming "Phase 1.5 Alpha Proof" or another
  accepted term.
- `decision.md` amended only after the ADR reopen records the changed phase
  semantics.
- Acceptance states that decision.md alone cannot redefine Phase 1.

### Slice 27 — Workflow v0.2, Narrowed

Scope: only what `dogfood-run-0` needs. Any workflow-v0.2 issue not needed for
dogfood is deferred to Phase 2+ or v0.2. Purpose changes from "make
workflow.md prettier" to "define enough workflow contract to run the first
workflow."

### Slice 27a — 60-Minute Spike Mining

**Lane:** Discovery.

**Scope:** read-only mining of `spike/kernel-replay` before runtime-boundary
implementation.

**Allowed output:** a short inventory of event/reducer/manifest lessons that
can inform 27c.

**Forbidden output:** code cherry-picks, architecture adoption by inertia, or
any claim that the spike is product evidence.

### Slice 27b — Product-Surface Inventory Baseline

**Lane:** Ratchet-Advance.

This is a baseline, not final proof. It records what is present before the
runtime-boundary and dogfood implementation.

**Deliverables:**

- `scripts/inventory.mjs`.
- `npm run inventory`.
- Inputs: `package.json` scripts, `.claude-plugin/**`, `src/index.ts`,
  `src/**` runtime modules, `specs/artifacts.json`, `tests/**`, `TIER.md`.
- Outputs: `reports/product-surface.inventory.json` and
  `reports/product-surface.inventory.md`.
- Baseline report covers: `circuit:run` script, plugin manifest,
  dogfood workflow fixture, runner entrypoint, event writer, snapshot writer,
  manifest snapshot, runner smoke test, event-log round-trip test,
  README/PROJECT_STATE/TIER status alignment.

**Delta rule:** 27c and 27d acceptance must rerun inventory and assert the
expected new runtime surfaces. Placeholder rows are not accepted.

### Slice 27c — Runtime Boundary Before Dogfood

**Lane:** Ratchet-Advance.

**Why split from dogfood:** the old Slice 30 explicitly blocked runtime
writes/resume until manifest byte-match or an explicit no-snapshot ADR existed.
Combining that with dogfood would let the first product proof write
`events.ndjson`, `state.json`, and `manifest.snapshot.json` through the very
gap it is supposed to close. **Running `dogfood-run-0` before Slice 27c lands is
therefore unsafe evidence — this sequencing is structural, not ceremonial.**
Splitting makes boundary safety fail fast before workflow execution.

**Deliverables:**

- Minimal event-writer/runtime-boundary contract sufficient for dry-run
  `dogfood-run-0`.
- Append-only event writer.
- Reducer-derived snapshot writer; `state.json` is derived by replaying
  `events.ndjson`, never independently authored.
- `manifest.snapshot.json` writer with byte-copy semantics.
- Manifest hash algorithm named explicitly: SHA-256 over the exact persisted
  manifest snapshot bytes unless the slice lands a stricter ADR.
- Byte-for-byte manifest snapshot check on re-entry/resume boundary.
- Post-27b inventory diff proving the writer/reducer/manifest surfaces are
  imported and executed.

**Acceptance:**

- Corrupt manifest snapshot bytes and expect failure.
- Append-only writer test proves no overwrite/truncation of prior events.
- Reducer-derived snapshot test proves deleting one event creates mismatch.
- Byte-for-byte manifest snapshot test proves persisted bytes match the hash.
- Placeholder/empty/non-imported/non-executed inventory entries fail.
- `events.ndjson` parses as `RunLog`.
- `state.json` parses as `Snapshot`, not `RunProjection`.
- `RunProjection.safeParse({ log, snapshot })` succeeds in test.
- Acceptance requires Slice 27b landed first; the post-27b inventory diff is
  the delta signal, not a placeholder checklist.

### Slice 27d — Dogfood-Run-0 Alpha Product Proof

**Lane:** Ratchet-Advance.

**Name:** `dogfood-run-0`.

**Command:**

```bash
npm run circuit:run -- dogfood-run-0 --goal "prove circuit-next can close one run" --rigor standard --dry-run
```

**Workflow:** load workflow fixture → bootstrap run → execute one
synthesis/check step locally → execute one dispatch step through dry-run
`agent` adapter → evaluate gates → close run.

**Input:** `.claude-plugin/skills/dogfood-run-0/circuit.json`. Invocation-layer
config only for v0: `goal`, `rigor`, `dry-run` flag. No user-global or project
config layer yet.

The file `.claude-plugin/skills/dogfood-run-0/circuit.json` is authored by this
slice. Acceptance verifies the CLI loads a file this slice creates, not that the
file existed before 27d landed.

**Outputs:**

- `.circuit-next/runs/<run_id>/events.ndjson`
- `.circuit-next/runs/<run_id>/state.json`
- `.circuit-next/runs/<run_id>/manifest.snapshot.json`
- `.circuit-next/runs/<run_id>/artifacts/result.json`

**Acceptance:**

- CLI verifiably loads `.claude-plugin/skills/dogfood-run-0/circuit.json`.
- Two different workflow fixtures or goals run from clean checkout and produce
  differing `result.json` artifacts.
- Snapshots are derived by replaying `events.ndjson`, not written
  independently.
- Event sequence is contiguous.
- `run.closed` appears once and last.
- `result.json` is user-visible and says what happened.
- Post-run inventory diff confirms the expected runtime surfaces execute.
- Acceptance requires Slice 27b landed first; the post-run inventory diff is
  the delta signal, not a placeholder checklist.

**Close-gate commands (added per Slice 26b Codex META-1 fold-in):**

- `npm run audit` must exit 0 (all checks green, including Check 17 status-epoch
  alignment, Check 18 status docs current, Check 19 pinned ratchet floor). A
  red audit rejects `dogfood-run-0`'s own evidence; the close gate depends on
  the pinned floor at `specs/ratchet-floor.json`, not on the moving-window
  `HEAD~1` comparison (Check 6). This is the 27d-level encoding of the
  machine surface Slice 26b installed; do not accept dogfood-run-0 evidence
  while audit is red.
- `npm run verify` must exit 0 (tsc --strict + biome + vitest).

**Scope boundaries:** no real Claude/Codex dispatch yet. No isolation substrate
yet. No hidden tests yet. This milestone proves the spine.

### Slice 25c — D2 Hardening Budget

**Lane:** Ratchet-Advance.

**Trigger:** after first successful alpha runner exists.

**Deliverables:** install D2, including the fifth runnable-path safety category
and reproducer requirement. This slice proves the first declined/deferred
methodology objection feels uncomfortable rather than easy.

### Slice 25e — D6 Probes And D7 Emergency Correction

**Lane:** Ratchet-Advance.

**Trigger:** after runtime-boundary probes exist.

**Deliverables:** install D6 with executable probes and install D7 with both
normal cooling period and emergency rollback/correction path.

### Slice 25f — D5 Self-Hosting Sunset Capability Matrix

**Lane:** Ratchet-Advance.

**Trigger:** after `dogfood-run-0`.

**Deliverables:** install D5 and add `self_hosting_capabilities` to `TIER.md`.
Any rule that cannot yet be expressed by circuit-next gets at most one ADR
with expiry.

### Slice DOG+1 — `circuit:review` D10 Operationalization

**Lane:** Product / Ratchet-Advance, implemented by circuit-next.

**Position:** after `dogfood-run-0`, per D5 self-hosting sunset. This is not
another freestanding methodology spec slice.

**Desired behavior:**

- Bind adversarial budget to rigor profile: Lite 0 / Standard 1 / Deep 2 /
  Tournament 3 with non-LLM mode required before pass 3 / Autonomous inherits.
- Enforce review-execution alternation in Deep and Tournament workflows.
- Add a "Why continue?" checkpoint between passes requiring the next-pass
  hunter to name the specific failure class. If vague, transition to execution
  mode.
- Write every pass to `specs/reviews/adversarial-yield-ledger.md`.

### Slice DOG+2 — `slice:doctor`

Runs after DOG+1 unless the operator explicitly reprioritizes. It is another
self-hosting proof: circuit-next helps the cold operator start the next slice.

**Deliverable:** `npm run slice:doctor` prints current HEAD, next slice from
PROJECT_STATE, required lane/framing literals including exact
`Alternate framing:` form, files likely involved, required verification
commands, product ratchets currently passing/failing, and suggested
commit-message skeleton.

### Slice P2-MODEL-EFFORT — workflow v0.3: explicit model + effort assignment

**Lane:** Product / Ratchet-Advance (Phase 2).

**Trigger:** Phase 2 open (after Phase 1.5 close ceremony). Scheduled here
so the concern is not lost; not unblocked by any Phase 1.5 work.

**Motivation:** Operator intent (recorded 2026-04-20 conversation) — workflows
should let the operator (or a future selector) pick the best model and
effort level per step. Codex is better at refactors; Opus is better at
prose; reasoning-capable models support graded effort. Two concerns,
separate slices:

1. **Explicit assignment (this slice).** Extend
   `specs/contracts/workflow.md` to v0.3 with per-step `selection.model`
   (provider enum schema-validated via `ProviderScopedModel`'s
   `provider: ['openai', 'anthropic', 'gemini', 'custom']`; the
   provider-scoped `model` string is intentionally open-ended at the
   schema layer and adapter-validated against the live model list per
   `src/schemas/selection-policy.ts:5` design comment — Slice 47a
   Codex challenger LOW 1 fold-in: earlier text overclaimed
   schema-allowlist validation of the model id) and `selection.effort`
   (`Effort` enum: `none | minimal | low | medium | high | xhigh`;
   only honored when the resolved adapter's model supports it). The schema already exposes these as first-class
   `SelectionOverride` fields per `src/schemas/selection-policy.ts:70-79`
   (Slice 47a comprehensive review CONVERGENT HIGH B fold-in — earlier
   plan wording placed `model` / `effort` under `invocation_options`,
   which mismatched the actual schema; corrected here so this slice
   wires the existing first-class fields through resolution rather than
   re-introducing the nested form). Cascade resolution: user-global
   default → workflow-level default → step-level override (per
   `SELECTION_PRECEDENCE` in `selection-policy.ts`).
   `dispatch.started.resolved_selection` carries the resolved
   `model` + `effort` + `skills` + `rigor` + `invocation_options` (each
   as separate first-class fields per `ResolvedSelection`). Backwards-
   additive — existing fixtures without `selection` overrides continue
   to resolve to the user-global default. Slice 47a landed the runner-
   side derivation seam (`deriveResolvedSelection` in `runner.ts`)
   composing workflow + step selections right-biased; this slice
   replaces that v0 helper with the full SEL-precedence resolver and
   widens to the user-global / project / phase / invocation layers
   the helper does not yet honor.
2. **Intelligent routing (later; explicitly postponed).** A selector that
   inspects task characteristics (lane, step role, artifact kind,
   historical success-rate) and picks a model. Requires (a) Phase 2
   usage data on which models actually work for which tasks, (b) a
   characterization layer, (c) its own contract + property tests. Land
   as a separate Phase 2+ slice after the explicit slice is in use.

**Deliverables (explicit slice):** selection-resolution runtime wiring;
schema parity / contract tests; migration note for existing v0.2 fixtures;
parse-time guard that unknown providers fail while provider-scoped model
ids remain open strings for adapter-owned handling (SEL-I4). Runtime
config discovery and adapter model/effort honoring are follow-on work; the
resolver can compose those layers once supplied.

### Slice 25g — D8 Rollback Review

**Lane:** Ratchet-Advance.

**Trigger:** Phase 2 close planning. Installs and performs the rollback review
for D1-D7 and D10 after enough product experience exists.

## Demoted / Deferred / Replaced

| Slice | Fate | Rationale |
|---|---|---|
| 27a (old spike/kernel-replay disposition) | Replaced by 27a 60-minute read-only mining | Keeps runtime evidence lessons without adopting spike code or direction by inertia. |
| 28a (audit/doc hardening batch) | Split | Status epoch + pinned ratchet floor move before dogfood; unrelated docs hardening defers. |
| 28b (behavioral enforcement matrix) | Deferred to Phase 2+ | D6 probes and TIER honesty are enough for Phase 1.5 Alpha Proof. |
| 28c (pinned ratchet floor) | Moved before dogfood as 26b | Audit remains a gate, so known false-green flaws must be fixed before product proof. |
| 28d (Phase 1 close ceremony + broader pass) | Replaced by Product Reality Gate close | Close semantics require executable product proof, non-LLM evidence, and D10 review budget discipline. |
| 30 (minimal manifest/event-writer precondition) | Pulled forward into 27c | Runtime writes cannot precede manifest byte-match or explicit no-snapshot ADR. Residual Phase 2 event-writer hardening remains in Slice 30. |
| 32 (v0.2 review frontmatter normalization) | Deferred to Phase 2+ | Governance-only work; blocked by D2 after dogfood unless a hardening category applies. |

## Product Ratchets

After dogfood lands, these replace count-based contract-test movement as the
headline audit signal. Count ratchets may remain secondary.

- `runner_smoke_present`
- `workflow_fixture_runs`
- `event_log_round_trip`
- `snapshot_derived_from_log`
- `manifest_snapshot_byte_match`
- `status_docs_current`
- `tier_claims_current`
- `current_slice_status_epoch_current`
- `pinned_ratchet_floor_current`
- `adversarial_yield_ledger_current` — green when at least one yield-ledger row
  exists for every adversarial review pass recorded in the last 3 slices and no
  row has `verdict: PENDING`.

## Dated Forecasts

These are forecasts, not acceptance pressure.

| By | Milestone |
|---|---|
| **Mon 2026-05-04** | Forecast: 25b / 26 / 26a / fastest-falsifier checkpoint / 26b / 25d / 27 / 27a / 27b / 27c / 27d complete if the existing schemas hold. If the fastest-falsifier trips, this date yields to the Discovery slice. |
| **Mon 2026-05-18** | Forecast: Phase 1.5 Alpha Proof can close only if Product Reality Gate is green, runtime-boundary probes are green, broader pass includes non-LLM evidence, D10 stopping criteria are satisfied, and no HIGH remains in the last pass. |
| **Mon 2026-06-01** | Forecast: DOG+1 and slice:doctor live, product ratchets in `npm run audit`, `dogfood-run-0` runnable daily from clean checkout, spike lessons mined and archived. |

## Phase 1.5 Alpha Proof Close Criteria

*This section is now a **mirror** of
`specs/adrs/ADR-0001-methodology-adoption.md` §Addendum B §Phase 1.5 Close
Criteria (authored by Slice 25d). The ADR is authoritative; this list is
operational reference. If the two disagree, the ADR wins and this section
must be corrected. Do not amend close criteria here alone — per D4,
standing rules cannot live only in plans.*

Phase 1.5 Alpha Proof may close when all of the following hold:

- D1, D4, D9, and D10 are authoritatively installed; D2/D3/D5/D6/D7/D8 are
  either installed according to their triggers or explicitly not yet triggered.
- The Product Gate exemption ledger at
  `specs/methodology/product-gate-exemptions.md` records Slice 25b as a
  consumed one-time operator waiver (bootstrap exception); no exemption is used
  to amend D1 or D3.
- ADR-0001 is explicitly reopened/amended before any authoritative Phase 1
  semantic change is claimed.
- `dogfood-run-0` has run successfully at least twice from clean checkout
  state using two different fixtures or goals with differing result artifacts.
- CLI loading of `.claude-plugin/skills/dogfood-run-0/circuit.json` is tested.
- `state.json` is reducer-derived from `events.ndjson`; deleting one event
  creates a mismatch.
- Manifest snapshot byte-match uses a named hash algorithm and fails on byte
  corruption.
- Pinned ratchet floor and structured `current_slice` / `status_epoch` checks
  are green before dogfood evidence is accepted.
- README / PROJECT_STATE / TIER cannot all be stale and still pass.
- Every `TIER.md` claim names an enforcing file path, planned slice, or
  explicit `not claimed`.
- Any design-only Product Reality Gate proof has an ADR with next executable
  proof and expiry.
- Broader adversarial pass includes at least one non-LLM evidence artifact.
- `specs/reviews/phase-1-close-reform-human.md` exists with `opened_scope`,
  `skipped_scope`, and "I could not understand X".
- No Phase 1.5 close criterion depends solely on Claude + Codex agreement.
- Remaining 28a / 28b / 32 work is tagged Phase 2+ or v0.2 and not falsely
  claimed in `TIER.md`.

## Highest-Risk Assumption

**The existing schemas are sufficient to support a thin vertical runner without
redesigning the event model.**

**Fastest falsifier:** after Slice 26a, the runner needs more than two new
artifact types, or simultaneous changes to `RunLog`, `Snapshot`, `Workflow`,
and `Step`, just to close a dry-run.

**If falsified:** run one Discovery slice for the minimum runtime architecture
scaffold. Do not return to broad methodology hardening. The product is telling
you the contracts were incomplete; listen to the product, not the ceremony.

## Authorship And Provenance

This plan was authored jointly across:

- Claude Opus 4.7 (reflective pass + synthesis + delta proposal).
- GPT-5 Codex via `/codex` skill (critical-question answers, methodology
  proposal, detailed plan, adversarial fold-ins).
- Operator (directive to persist the plan, then directive to fold in the
  adversarial findings before commit).

The authorship conversation transcript is not committed. Slice 25b's eventual
commit body must therefore include the key decision rationale: Product Gate
exemption ledger at `specs/methodology/product-gate-exemptions.md` and waiver
(bootstrap exception) shape, D10 pass-budget priors, TIER honesty guard, and
why the runtime-boundary gate was split ahead of dogfood.
