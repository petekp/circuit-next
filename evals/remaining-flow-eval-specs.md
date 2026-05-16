# Eval Specs For Remaining Flows

Status: implemented local smoke/regression layer plus future claim specs.

This document scopes evals for the compiled flows that do not yet have a
claim-grade benchmark. It now separates the runnable local eval layer from
future claim-grade candidates. The current compiled flow catalog is:

- `fix`
- `review`
- `build`
- `explore`
- `runtime-proof`

`fix-vs-vanilla` is already the only claim-grade eval. The first remaining-flow
implementation is the local `flow-regressions` suite, which is CI-safe and
test-backed. The longer-term work is to make Review, Build, and Explore
claim-measurable without blurring regression checks, discovery work, and
product claims. `runtime-proof` is internal runtime plumbing and should stay
smoke-only.

`create`, `handoff`, and `run` are command surfaces rather than compiled flow
packages. They can have host-surface or routing evals, but they are not counted
as remaining compiled flows in this spec.

## Current Coverage Snapshot

| Surface | Current registered eval coverage | Gap this spec covers |
| --- | --- | --- |
| `fix` | `fix-vs-vanilla` is claim-grade; `false-done-fix` is regression. | None for this spec. |
| `review` | `verdict-correctness` is registered as a Review regression eval, but its runner uses historical Explore review requests and the Explore review-verdict schema. `review-clean-control` is a local test-backed Review regression. Neither is a standalone Review product claim. | Standalone Review defect corpus. |
| `build` | `build-proof-chain` is a local test-backed regression eval. | Build-vs-vanilla claim-grade candidate. |
| `explore` | `circuit-vs-vanilla` is discovery-only for read-only review, planning, and synthesis tasks. `explore-grounding-contract` is a local test-backed regression eval. | Grounded source-packet evals and narrow Explore-vs-vanilla claims. |
| `runtime-proof` | `runtime-proof-smoke` is a local smoke eval. | None; keep smoke-only. |
| router / `run` | `flow-router-intent` is a local test-backed regression eval. | Optional flow-selector UX discovery. |

## Shared Eval Rules

Every flow eval should use the same ladder:

| Level | Purpose | Default verification |
| --- | --- | --- |
| Smoke | Prove the runner and fixtures work. | CI-safe, no live model calls |
| Regression | Protect known behavior and past failures. | CI-safe when possible; live only when explicitly invoked |
| Discovery | Tune prompts, scorers, task shape, and operator evidence. | Ad hoc |
| Claim-grade | Support a narrow product claim on held-out tasks. | Release or milestone runs only |

Claim-grade flow evals must follow the same rules as Fix:

- Strong vanilla baseline, not a weak prompt.
- Same model, tool surface, repo commit, permissions, and time budget.
- Discovery, regression, and held-out splits kept separate.
- Held-out tasks never used for tuning.
- Objective scoring where the task allows it.
- Blinded human review only where objective scoring is not enough.
- Primary metric, claim rule, task split, and minimum sample size declared
  before measurement.
- Raw result folders ignored by git.
- Live model calls excluded from default verification.

Do not add proposed future evals to `evals/registry.json` until they have a
runnable dry-run or test-backed command.

## Review Flow

### Product Question

Does Circuit Review catch more real review issues than a strong vanilla agent
without increasing false alarms or requiring more operator interpretation?

### Implemented And Future Eval IDs

| Eval | Level | Purpose |
| --- | --- | --- |
| `review-clean-control` | implemented regression | Ensure clean and issue-found Review report paths stay schema-valid with local fixtures. |
| `verdict-correctness` | existing regression | Protect Explore's adversarial review step, not the standalone Review product claim. |
| `review-defect-corpus` | future claim-grade candidate | Pair Circuit Review against vanilla on frozen review fixtures with known defects. |

### Task Fixtures

Use small repos or patch bundles where the expected review answer is known.
Each task should include:

- Starting repo fixture.
- Review scope.
- Patch or working tree state to review.
- Defect manifest with required findings.
- Clean-control flag when no medium+ finding should be reported.
- Allowed severity range per defect.
- Relevant file refs.

Good task families:

- Generated-surface drift.
- Missing schema or report contract update.
- Unsafe shell quoting in host command docs.
- Untracked-content evidence omissions.
- Public-claim or release-proof drift.
- Clean mechanical docs change with no blocking issue.

### Arms

| Arm | Meaning |
| --- | --- |
| `circuit-review-<provider>` | `bin/circuit-next run review`, producing `review-result.json`. |
| `vanilla-review-<provider>` | Same provider CLI with a strong review prompt, no Circuit commands. |

The vanilla prompt must require findings first, severity, file refs, evidence
checked, confidence limitations, and an explicit clean verdict when no medium+
issues are found.

### Metrics

Primary:

- `missed_required_defect_rate`: required defects not found at medium+ severity.

Secondary:

- `false_alarm_rate`: medium+ findings on clean controls.
- `severity_calibration_rate`: required defects reported at an acceptable severity.
- `file_ref_accuracy_rate`: findings cite the affected file or patch region.
- `evidence_quality`: inspected files, commands, and limitations are named.
- `operator_actionability`: blinded human pass/fail on whether the finding is clear enough to act on.
- `wallclock_ms`.

### Claim Rule

Circuit Review can claim a Review win only when, on held-out tasks:

- Circuit has a lower `missed_required_defect_rate` than vanilla.
- Circuit's `false_alarm_rate` is no worse than vanilla by more than a small
  pre-declared margin.
- Circuit's evidence quality is at least as good as vanilla.

Discovery or `verdict-correctness` wins do not support this claim.

## Build Flow

### Product Question

Does Circuit Build ship verified changes with fewer false-complete outcomes and
cleaner operator evidence than a strong vanilla coding agent?

Build is not Fix. The task set should emphasize additive implementation,
small refactors, and feature slices, not reproducible bug fixes that belong in
`fix-vs-vanilla`.

### Implemented And Future Eval IDs

| Eval | Level | Purpose |
| --- | --- | --- |
| `build-proof-chain` | implemented regression | Protect checkpoint, implementation, verification, review, and close evidence on fake connectors. |
| `build-vs-vanilla` | future claim-grade candidate | Pair Circuit Build against vanilla on deterministic implementation tasks. |
| `build-mode-matrix` | future discovery | Compare `lite`, `default`, `deep`, and `autonomous` entry modes on the same task set. |

### Task Fixtures

Each task should be a small repo with deterministic acceptance checks:

- Starting repo fixture.
- User goal.
- Expected behavior.
- Objective check commands.
- Allowed changed files or allowed directories.
- Forbidden files or blast-radius constraints.
- Optional reviewer trap, such as a tempting but incomplete implementation.

Good task families:

- Add a parser option with unit tests.
- Add a small CLI flag.
- Implement a missing export.
- Update a generated manifest check.
- Add a narrow docs validation rule.
- Refactor a helper while preserving behavior.

### Arms

| Arm | Meaning |
| --- | --- |
| `circuit-build-<provider>` | `bin/circuit-next run build` with the selected entry mode. |
| `vanilla-build-<provider>` | Same provider CLI with a strong implementation prompt, no Circuit commands. |

Both arms get identical acceptance checks and permissions. If Circuit uses a
checkpoint, record it as operator interaction rather than hiding it.

### Metrics

Primary:

- `false_complete_rate`: agent claims completion but objective checks fail,
  required output is missing, or review rejects the result.

Secondary:

- `objective_success_rate`: all objective checks pass.
- `verified_complete_rate`: checks pass and final report includes proof.
- `review_accept_rate`: review verdict is `accept`.
- `operator_interaction_count`: checkpoints, retries, or clarification loops.
- `diff_scope`: changed files outside the allowed set.
- `proof_quality`: selected command provenance, pre-change or initial check
  result when relevant, post-change command result, bounded output, and report
  links.
- `wallclock_ms`.

### Claim Rule

Circuit Build can claim a Build win only when, on held-out tasks:

- Circuit has a lower `false_complete_rate` than vanilla.
- Circuit's `objective_success_rate` is at least as high as vanilla's.
- Circuit's proof quality is higher, or equal with no higher operator
  interaction count.

If Build wins only by being slower and more procedural, the report should say
that plainly. That may still be a good tradeoff for parallel agent operation,
but it is a different claim from raw speed.

## Explore Flow

### Product Question

Does Circuit Explore produce more grounded, useful decisions or investigation
outputs than a strong vanilla agent?

Explore is harder to score objectively. Start with regression and discovery
evals, then promote a narrow task family to claim-grade only after the rubric is
stable.

Each Explore eval must predeclare exactly one primary metric before measurement.
The candidate metrics below are options for different task families, not a menu
to choose from after seeing results.

### Implemented And Future Eval IDs

| Eval | Level | Purpose |
| --- | --- | --- |
| `explore-grounding-contract` | implemented regression | Protect evidence refs, report composition, schemas, and tournament artifacts with local fixtures. |
| `explore-grounding-corpus` | future regression first, claim-grade later | Check evidence grounding on frozen investigation tasks with known source material. |
| `explore-decision-tournament` | future discovery first, claim-grade later | Test whether tournament mode improves option quality and final decisions. |
| `explore-vs-vanilla` | future claim-grade candidate | Blinded pairwise comparison after the grounding rubric is calibrated. |

### Task Fixtures

Use frozen source packets, not live web or moving repos:

- Source documents or repo snapshots.
- User question.
- Required facts or constraints.
- Distractor facts that should not be cited.
- Acceptable decision options where applicable.
- Known critical considerations.

Good task families:

- Architecture choice from a bounded codebase slice.
- Release-readiness assessment from fixed docs and run artifacts.
- Product tradeoff memo from fixed source notes.
- Migration plan from source APIs and constraints.
- Tournament decision where two options are tempting but one violates a stated constraint.

### Arms

| Arm | Meaning |
| --- | --- |
| `circuit-explore-<provider>` | `bin/circuit-next run explore`, with mode recorded. |
| `vanilla-explore-<provider>` | Same provider CLI with a strong investigation prompt, no Circuit commands. |

Run default Explore and tournament Explore as separate eval rows. Do not mix
them in one headline score.

### Metrics

Primary options, depending on task family:

- `critical_fact_coverage_rate`: required facts or constraints present.
- `unsupported_claim_rate`: material claims not supported by source packets.
- `decision_acceptability_rate`: selected option is in the predeclared acceptable set.
- `blind_preference_win_rate`: human reviewers prefer one artifact over the other.

Secondary:

- `evidence_citation_validity`: cited evidence resolves to source material.
- `missed_critical_consideration_rate`.
- `false_certainty_rate`.
- `operator_actionability`: can the operator act without follow-up translation?
- `next_step_quality`.
- `wallclock_ms`.

### Claim Rule

Circuit Explore should not get a broad "better research" claim at first.
Claims should be narrow:

- "Circuit Explore improves grounded architecture-decision memos on this frozen
  repo-task family."
- "Circuit tournament mode improves option coverage on this decision-task
  family."

For either claim:

- Circuit must win held-out tasks.
- Unsupported claims must be lower than or equal to vanilla.
- Blind preference must favor Circuit or objective acceptability must improve.
- Discovery tasks cannot count.

## Runtime-Proof Flow

### Product Question

Does the runtime still execute a minimal compose-to-relay flow and preserve
trace/report contracts?

This is not product-facing. It should not become claim-grade.

### Implemented Eval ID

| Eval | Level | Purpose |
| --- | --- | --- |
| `runtime-proof-smoke` | implemented smoke | Exercise `runtime-proof` with fake connectors and assert report, trace, and connector identity shape. |

### Metrics

Primary:

- `runtime_smoke_passed`: compose report exists, relay request/receipt/result
  exist, final run completes, trace is schema-valid.

Secondary:

- report path correctness.
- connector identity preservation.
- no raw internal IDs in operator summary.

### Claim Rule

None. Runtime Proof is infrastructure evidence only.

## Router And Run Surface

`run` is a command surface, not a compiled flow, but it needs a separate eval
because all flow claims depend on correct flow selection.

`create` and `handoff` should be handled by host-surface smoke or regression
checks, not by the flow-claim ladder here, unless they become compiled flow
packages later.

### Implemented And Future Eval IDs

| Eval | Level | Purpose |
| --- | --- | --- |
| `flow-router-intent` | implemented regression | Confirm realistic prompts route to the intended flow and entry mode. |
| `flow-selector-ux` | future discovery | Check whether natural-language flow selection feels predictable to operators. |

Primary metric:

- `routing_accuracy`: expected flow and mode selected.

Secondary metrics:

- `dangerous_misroute_rate`: implementation request routed to Explore, review
  request routed to Build, or bug-fix task routed away from Fix.
- explanation quality for route decisions.

## Suggested Build Order

1. Keep the implemented `flow-regressions` suite green in `npm run check-evals`.
2. Implement `review-defect-corpus` next. It is closest to the existing
   `verdict-correctness` machinery and gives a clean objective scorer.
3. Implement `build-vs-vanilla` after that. Build is the highest-value
   remaining user-facing flow after Fix.
4. Add `explore-grounding-corpus` before any broad Explore-vs-vanilla claim.
   Explore needs source-packet discipline before judge or human-review scoring
   will be trustworthy.
5. Keep `runtime-proof-smoke` and `flow-router-intent` as CI-safe regression
   guards, not product-claim evals.
