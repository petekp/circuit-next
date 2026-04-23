---
doc: review-characterization
status: active
capture_date: 2026-04-24
characterized_by: claude-opus-4-7
source: live old-Circuit state on disk at ~/Code/circuit
authority: reference only; NOT runtime compatibility
---

# Legacy Circuit — Review Skill Characterization

This document characterizes the live on-disk `review` skill of
first-generation Circuit as observed on **2026-04-24**. It exists to
prevent blind design of circuit-next's forthcoming `review` workflow
surface (per ADR-0003 `successor-to-live` classification).

It is **reference evidence**, not a compatibility requirement.
circuit-next will **not** parse old Circuit `review.md` artifacts through
normal runtime paths, and will author its own contract fresh. The
characterization keeps invention honest by pinning the reference shape.

The flawed P2.9 plan draft (committed fixture at
`tests/fixtures/plan-lint/bad/p2-9-flawed-draft.md`) was authored without
this characterization in place, and invented 4 artifacts, a non-canonical
phase set, and runtime capabilities that do not exist. This document is
the corrective evidence base for the P2.9 restart.

## Source path inspected

```
~/Code/circuit/skills/review/SKILL.md
~/Code/circuit/.circuit/bin/dispatch        # the helper wrapper
~/Code/circuit/scripts/relay/dispatch.sh    # the relay
~/Code/circuit/scripts/runtime/bin/dispatch.js  # the CLI (bundled)
```

One skill file was inspected (160 lines). Supporting dispatch wiring was
inspected only enough to capture the dispatch-invocation surface the skill
declares. No fixtures committed; the characterization is sufficient for
`successor-to-live` per ADR-0003.

## Observed phases

**Four phases, in execution order:**

```
Intake → Independent Audit → Verification Rerun → Verdict
```

This is **not** the circuit-next canonical phase set
`{frame, analyze, act, review, close}` used by
`scripts/policy/workflow-kind-policy.mjs`. The reference review skill uses
its own workflow-kind-specific spine.

**Implication for circuit-next.** The P2.9 plan must either:

1. Declare a title→canonical map binding these four reference titles to the
   canonical set (e.g. `Intake→frame`, `Independent Audit→analyze`,
   `Verification Rerun→act`, `Verdict→close`), with explicit
   `spine_policy.omits` if any canonical title (e.g. `review`) is absent; or
2. Extend the canonical set via a separate ADR before authoring the
   contract.

Option 1 is lower-cost and is what `specs/contracts/explore.md` did for
`explore`'s workflow-kind-specific spine. The explore contract's
`workflow-kind-seam` pattern is the template.

## Observed artifacts

**One primary output artifact: `review.md`.**

The skill produces exactly one file that matters downstream:

| Artifact | Shape | Materialization |
|---|---|---|
| `review.md` | Markdown, model-synthesized | Verdict phase writes it |

Two step-internal intermediates exist but are not part of the artifact
registry (they live in `${RUN_ROOT}/phases/review/` and are not consumed
beyond the phase):

| Intermediate | Shape | Consumed by |
|---|---|---|
| `reports/review-report.md` | Markdown, model-authored by dispatched reviewer | Verdict phase (synthesized into review.md) |
| `last-messages/last-message.txt` | Raw dispatch stdout | Verdict phase (same as above) |

When the review skill is invoked inside a broader workflow (Build, Repair,
Migrate, Sweep), the final path shifts to `artifacts/review.md` — still
one artifact, different path.

**Implication for circuit-next.** The flawed P2.9 plan's 4-artifact model
(`review.scope`, `review.report`, `review.verification`, `review.result`)
is invention, not extraction. The reference surface emits **one** artifact;
the P2.9 restart must collapse the model. Any step-internal intermediates
remain scoped to the phase and do not register in `specs/artifacts.json`.

## Observed invariant candidates

The SKILL.md does not declare formal invariants, but two enforceable
properties are evident from the phase structure:

### Candidate REVIEW-I1 — reviewer identity separation

The Independent Audit phase dispatches the reviewer as a **fresh-context
subprocess** (line 62: "Dispatch a reviewer in a fresh context"). The
orchestrator synthesizing the Verdict is a different actor than the
reviewer writing `review-report.md`.

Enforcement vector in circuit-next terms: the Independent Audit step is a
dispatch step with `role: reviewer`; the Verdict step is an orchestrator-
authored synthesis step. `DispatchRole` already admits `reviewer` at
`src/schemas/step.ts:6` — no schema widening required.

REVIEW-I1 in enforceable form: **"The step producing `review.md` MUST be
preceded by a dispatch step with `role: reviewer` in the same phase
sequence."** This binds to `Workflow.steps[]` shape, not to runtime
adapter-identity tracking, so it is enforceable at contract parse time.

### Candidate REVIEW-I2 — verdict determinism

The Verdict phase declares a deterministic rule (lines 136–138):

> - **CLEAN:** No critical or high findings. Verification passes. Ship it.
> - **ISSUES FOUND:** At least one critical or high finding.

Three conditions must all hold for CLEAN:
1. Critical findings count = 0
2. High findings count = 0
3. Verification commands all pass

All three are load-bearing. The flawed P2.9 draft's rule omitted condition
3 — it proposed "CLEAN iff Critical=0 AND High=0" without the verification
clause, which would emit CLEAN on runs where test/lint commands failed.

REVIEW-I2 in enforceable form: **"Verdict CLEAN requires
(critical_count == 0) ∧ (high_count == 0) ∧ (verification_passes == true)."**

## Observed CLI surface

The SKILL.md itself does not dictate a CLI; it's a skill consumed by the
`/circuit:review` command in reference Circuit. The skill's scope
resolution is three-tier (SKILL.md lines 22–27):

1. Explicit scope from user (files, directories, diff target).
2. Uncommitted changes (current diff).
3. Most recent commit diff.

No `--scope` flag is prescribed by the skill. The flawed P2.9 plan
invented `--scope '<quoted>'` as the CLI surface, which does not exist in
either reference Circuit's `/circuit:review` bodies (inspected) or
circuit-next's `src/cli/dogfood.ts` (which accepts `--goal`, `--rigor`,
`--run-root`, `--fixture`, `--dry-run`).

**Implication for circuit-next.** `/circuit:review` in circuit-next should
pass user scope as `--goal` text (matching `/circuit:explore`'s pattern),
not introduce a new `--scope` flag. If a dedicated scope flag is later
wanted, that's a CLI-widening slice on its own, not a P2.9 sub-concern.

## Observed runtime capability requirements

The Verification Rerun phase **requires subprocess execution**. The skill
(lines 90–114) prescribes:

- Running `package.json` scripts (`test`, `check`, `lint`, `typecheck`).
- Running Makefile/justfile/Taskfile targets.
- Running language-specific test runners (`pytest`, `cargo test`,
  `go test ./...`).

Each of these requires the runtime to: (a) spawn a child process, (b)
capture stdout/stderr/exit code, (c) surface pass/fail into the Verdict.

**circuit-next's current runtime does not have this capability.** The
existing step kinds at `src/runtime/runner.ts` are `dispatch` and
`synthesis`; the latter writes placeholder JSON and does not shell out.
No step kind today executes subprocesses. This is a hard substrate gap.

**Implication for circuit-next.** P2.9 cannot land a live Verification
Rerun phase without either:

1. A substrate-widening slice introducing a new step kind (e.g.
   `verification-exec`) that runs subprocesses and captures outputs; or
2. A pivot of P2.9 scope — land `review` without the verification phase
   (i.e. Intake → Independent Audit → Verdict), with Verification deferred
   to a follow-on arc.

The flawed P2.9 draft assumed option 1 was in place without landing the
substrate slice. That's the gap plan-lint rule #20
(`verification-runtime-capability-assumed-without-substrate-slice`) now
catches mechanically.

## Observed markdown artifact materialization

`review.md` is Markdown, written by the orchestrator synthesizing a
template (SKILL.md lines 118–134). The reviewer dispatch output is also
Markdown-shaped.

**circuit-next's current dispatch emits JSON through a registered schema**
(`src/schemas/`). Markdown artifacts from dispatch don't have a
materialization path today. The flawed P2.9 draft's `review.report` (a
dispatch-emitted Markdown artifact) would fail at dispatch schema parse.

Two options for circuit-next:

1. Land a Markdown-artifact-materialization ADR + schema widening (new
   step kind or dispatch-result shape) before P2.9 authors the contract;
2. Restructure the `review.md` artifact as orchestrator-authored-markdown
   (synthesis step, not dispatch step), with the reviewer's Markdown output
   treated as a step-internal intermediate that the synthesis step reads
   from the step directory.

Option 2 preserves the reference shape without requiring runtime widening.
The Independent Audit dispatch step emits a JSON envelope with a path
reference to its step-internal `review-report.md`; the Verdict synthesis
step reads the markdown, assembles findings, and writes `review.md`.

## Observed dispatch surface (reference)

The reference skill's dispatch invocation shape (SKILL.md lines 83–88):

```
.circuit/bin/dispatch \
  --prompt "${step_dir}/prompt.md" \
  --output "${step_dir}/last-messages/last-message.txt" \
  --circuit review \
  --role reviewer
```

Four flags: `--prompt`, `--output`, `--circuit`, `--role`. The reference
CLI is internal to reference Circuit; circuit-next has its own dispatch
adapter surface (`src/runtime/adapters/`). The shape is cited here for
reference, not as a compatibility target.

## Observed verdict template

The Verdict phase's `review.md` template (SKILL.md lines 121–134):

```markdown
# Review: <scope description>
## Contract Compliance
<if brief.md/plan.md exist: does implementation match?>
<if no contract: N/A -- standalone review>
## Findings
### Critical (must fix before ship)
### High (should fix)
### Low (acceptable debt)
## Verification Rerun
<command outputs, pass/fail>
## Verdict: CLEAN | ISSUES FOUND
```

Four sections: Contract Compliance, Findings, Verification Rerun, Verdict.
The severity taxonomy is `{Critical, High, Low}` — **three tiers**, not the
`{Critical, High, Medium, Low}` four-tier taxonomy used elsewhere in
circuit-next review artifacts. This is a reference-surface quirk worth
noting but not binding.

## Explicit clean-break posture

circuit-next's `review` workflow **will not** consume reference Circuit's
`review.md` artifacts. It will author its own artifact shape under
`specs/artifacts.json` with `compatibility_policy: clean-break`,
`legacy_parse_policy: reject`, `reference_evidence: this document`, and
`reference_surfaces: legacy-circuit-review-skill`.

If at some future point operator wants to import legacy `review.md` files,
the path is identical to the continuity import path in ADR-0003:

1. New artifact id in `specs/artifacts.json` with
   `surface_class: migration-source`.
2. Sanitized fixtures under `tests/fixtures/reference/legacy-circuit/review/`.
3. Separate importer contract (`specs/contracts/review-import.md`).
4. Runtime `review.md` schema stays strict; importer normalizes or rejects.

## What this document does NOT do

- It does not make reference Circuit's review shape normative for
  circuit-next.
- It does not commit fixtures of reference `review.md` outputs.
- It does not promise forward compatibility.
- It does not drive tests under `tests/contracts/`.
- It does not authorize any specific P2.9 scope decision — it provides
  the evidence base; scope selection belongs in the plan itself under an
  §Evidence census section.

It exists solely to satisfy ADR-0003's `successor-to-live` requirement that
the live surface be **characterized** before a new contract is drafted,
thereby preventing the imagine-and-draft failure mode that the Planning-
Readiness Meta-Arc (Slices 57–62) is empirically proven to block when the
evidence is in hand.

## Summary table — what P2.9 must inherit vs. what it may choose

| Aspect | Reference shape | P2.9 must inherit? | If not, alternative |
|---|---|---|---|
| Phase count | 4 | No | May add/remove phases with canonical map |
| Primary artifact | `review.md` (1) | Yes (cardinality) | Cannot invent more without evidence |
| Artifact shape | Markdown | No | May restructure via synthesis-over-dispatch |
| Reviewer separation | Fresh-context dispatch | Yes (invariant-bearing) | REVIEW-I1 enforces this |
| Verdict rule | CLEAN iff C=0 ∧ H=0 ∧ verification-passes | Yes (all three clauses) | REVIEW-I2 enforces this |
| Severity taxonomy | 3-tier {Critical, High, Low} | No | May adopt 4-tier if consistent internally |
| Verification-command execution | Yes (hard runtime dep) | Only if substrate lands first | May defer via scope pivot |
| CLI flag shape | None prescribed | N/A | Reuse `--goal`; no `--scope` |

This table is the minimum extraction; a fresh P2.9 plan draft may fold
additional observations once authored.
