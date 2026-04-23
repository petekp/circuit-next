---
name: arc-clean-clone-reality-composition-review-codex
description: Codex cross-model challenger prong for the Clean-Clone Reality Tranche arc-close composition review over Slices 52-54. Paired with the Claude composition-adversary prong in the same ceremony commit. Focused on cross-slice dispatch/materializer composition and arc-close gate enforcement.
type: review
reviewer_model: gpt-5-codex
reviewer_model_id: gpt-5-codex
authorship_role: challenger
review_kind: arc-close-composition-review
review_date: 2026-04-23
verdict: ACCEPT-WITH-FOLD-INS
authored_by: gpt-5-codex
review_target: arc-clean-clone-reality-tranche-slices-52-to-54
target_kind: arc
target: clean-clone-reality-tranche
target_version: "HEAD=cc47f2f (post-Slice-54) -> <ceremony-SHA-at-Slice-55-landing>"
arc_target: clean-clone-reality-tranche
arc_version: "d02cb4d..cc47f2f (Slice 52 d02cb4d -> Slice 52a fa88d5c -> Slice 53 f12c6c2 -> Slice 54 cc47f2f)"
opening_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  high: 1
  med: 2
  low: 1
  meta: 0
commands_run:
  - sed -n 1,220p /Users/petepetrash/Code/claude-code-setup/skills/exhaustive-systems-analysis/SKILL.md
  - git status --short
  - sed -n 1,240p CLAUDE.md
  - sed -n 1,260p specs/plans/clean-clone-reality-tranche.md
  - sed -n 1,240p specs/reviews/arc-clean-clone-reality-composition-review-claude.md
  - sed -n over specs/reviews/arc-slice-52-codex.md, arc-slice-53-codex.md, arc-slice-54-codex.md
  - sed -n over tests/contracts/cross-model-challenger.test.ts and specs/behavioral/cross-model-challenger.md review-record rules
  - sed -n over src/runtime/runner.ts, src/runtime/adapters/dispatch-materializer.ts, src/runtime/artifact-schemas.ts
  - sed -n over tests/runner/gate-evaluation.test.ts and tests/runner/materializer-schema-parse.test.ts
  - sed -n over package.json and scripts/clean-clone-smoke.sh
  - sed -n over scripts/audit.mjs ARC_CLOSE_GATES and evaluateArcCloseGate regions
  - rg -n clean-clone-reality, ARC_CLOSE_GATES, arc-clean-clone-reality across scripts/audit.mjs, specs/reviews, specs/plans, PROJECT_STATE.md
  - rg -n clean-clone-smoke and AGENT_ADAPTER_SOURCE_PATHS/CODEX_ADAPTER_SOURCE_PATHS across scripts, tests, specs
  - npm run test -- tests/runner/gate-evaluation.test.ts tests/runner/materializer-schema-parse.test.ts tests/contracts/artifact-backing-path-integrity.test.ts
  - npm run check
  - npm run audit
  - npm run verify
  - npm run circuit:run -- --help
  - stat -f '%Sp %N' scripts/clean-clone-smoke.sh
  - git ls-files --stage scripts/clean-clone-smoke.sh src/runtime/artifact-schemas.ts specs/reviews/arc-clean-clone-reality-composition-review-codex.md
  - js_repl composition-proof attempt (blocked by js_repl local-module static node: import limitation)
  - node --input-type=module composition proof for verdict-not-in-pass, unparseable, parseable-no-verdict, and schema-invalid artifact body (all assertions passed)
  - node --input-type=module stale preexisting-artifact reproduction for explicit runRoot (artifact remained after aborted run)
  - npm run test -- tests/contracts/cross-model-challenger.test.ts tests/contracts/artifact-backing-path-integrity.test.ts
  - npm run lint
  - git log --oneline -5
  - git show --stat --oneline d02cb4d fa88d5c f12c6c2 cc47f2f
opened_scope:
  - CLAUDE.md Cross-slice composition review cadence and same-commit staging discipline
  - specs/plans/clean-clone-reality-tranche.md
  - specs/reviews/arc-clean-clone-reality-composition-review-claude.md
  - specs/reviews/arc-slice-52-codex.md
  - specs/reviews/arc-slice-53-codex.md
  - specs/reviews/arc-slice-54-codex.md
  - src/runtime/runner.ts dispatch gate and schema-parse branch
  - src/runtime/adapters/dispatch-materializer.ts transcript and artifact writes
  - src/runtime/artifact-schemas.ts registry and parseArtifact helper
  - src/runtime/result-writer.ts and src/schemas/result.ts RESULT-I4 reason mirror
  - src/schemas/event.ts gate, dispatch, abort, close event shapes
  - src/cli/dogfood.ts --run-root behavior and default run root
  - tests/runner/gate-evaluation.test.ts
  - tests/runner/materializer-schema-parse.test.ts
  - tests/contracts/artifact-backing-path-integrity.test.ts ARC_CLOSE_GATES assertions
  - tests/contracts/cross-model-challenger.test.ts review-record schema
  - package.json verify/build/circuit:run bindings
  - scripts/clean-clone-smoke.sh
  - scripts/audit.mjs Check 26 / ARC_CLOSE_GATES / adapter fingerprint lists
  - scripts/audit.d.mts exported audit declarations
  - .claude-plugin/skills/dogfood-run-0/circuit.json
  - .claude-plugin/skills/explore/circuit.json dispatch artifact schema names
skipped_scope:
  - bootstrap/** (Phase 0 evidence loop, frozen)
  - prior-gen Circuit at ~/Code/circuit (read-only reference; not needed for Slices 52-54 composition)
  - tests/properties/** (Tier 2+ deferred per CLAUDE.md hard invariants)
  - full project-holistic 40-finding ledger body (Claude prong owns the disposition ledger; this prong sampled only items that affect Slices 52-54 composition)
  - live AGENT_SMOKE/CODEX_SMOKE promotion runs (audit yellows intentionally require operator-local adapter promotion)
  - bash scripts/clean-clone-smoke.sh full execution (would run npm ci in a cloned checkout; this pass inspected and verified executable/binding surfaces instead)
authority:
  - CLAUDE.md §Cross-model challenger protocol (objection list, not approval)
  - CLAUDE.md §Cross-slice composition review cadence (arc spanning >=3 slices and privileged runtime requires two-prong arc-close review)
  - CLAUDE.md §Same-commit staging discipline (prong files and current_slice advance must land together)
  - specs/plans/clean-clone-reality-tranche.md §Slice 55 acceptance evidence
  - specs/reviews/arc-slice-53-codex.md §META 2 (composed dispatch failure story verification)
  - specs/reviews/phase-project-holistic-2026-04-22-codex.md §HIGH 14 and §HIGH 15 (originating dispatch/materializer findings)
  - specs/adrs/ADR-0008-dispatch-granularity-modeling.md §Decision.3a
  - tests/contracts/cross-model-challenger.test.ts CHALLENGER-I3 review-record shape
fold_in_disposition: |
  Closing verdict: ACCEPT-WITH-FOLD-INS. The runtime composition itself is accepted: on a fresh run root, all four bad-output shapes leave request/receipt/result transcript files, withhold the canonical artifact slot, omit step.completed for the dispatch step, and preserve the same reason string across gate.evaluated, step.aborted, run.closed, and RunResult.reason. One HIGH fold-in remains for the ceremony commit: add the clean-clone-reality-tranche entry to ARC_CLOSE_GATES and update the length/behavior tests that currently pin three gates. Two MED items should be recorded with named triggers: clarify or enforce the fresh-run-root precondition for literal artifact absence, and add audit binding for clean-clone-smoke freshness/executability when audit coverage next moves. One LOW item notes the test-only strict schema in the product registry.
---

# Clean-Clone Reality Tranche - Codex composition challenger

This is the Codex cross-model challenger prong for the Clean-Clone Reality Tranche arc close. I read the Claude prong for conflict awareness, but this pass is not a concurrence memo. It is an objection list over the code, tests, scripts, and ceremony machinery now present at `HEAD=cc47f2f`.

## Required dispatch failure verification

The Slice 55 brief required an end-to-end verification of this composed invariant:

Bad model output - verdict not in `gate.pass`, unparseable body, parseable body with no verdict, or schema-invalid artifact body - must produce durable `request` / `receipt` / `result` transcript files, no canonical artifact at `writes.artifact.path`, no `step.completed` for the failed dispatch step, and `run.closed outcome=aborted` with the reason byte-identical across `gate.evaluated`, `step.aborted`, `run.closed`, and `RunResult.reason`.

I verified that invariant in three ways.

First, by code walk:

- `evaluateDispatchGate` parses adapter `result_body`, rejects invalid JSON, non-object JSON, missing/non-string/empty `verdict`, and verdicts outside `step.gate.pass` (`src/runtime/runner.ts:176-210`).
- The dispatch branch then runs `parseArtifact` only after the verdict gate passes and only if `writes.artifact` exists (`src/runtime/runner.ts:535-546`).
- The materializer call strips the artifact slot whenever the combined evaluation is not pass (`src/runtime/runner.ts:559-573`).
- `materializeDispatch` always writes the request, receipt, and result transcript slots, and writes the canonical artifact only if the caller supplied `writes.artifact` (`src/runtime/adapters/dispatch-materializer.ts:138-151`).
- On failure, the runner emits `gate.evaluated outcome=fail` and `step.aborted` from the same `evaluation.reason`, sets `closeReason` from that same value, breaks before the dispatch step can complete, and mirrors `closeReason` into `run.closed` and `RunResult.reason` (`src/runtime/runner.ts:619-708`).

Second, by checked-in tests:

- `tests/runner/gate-evaluation.test.ts:124-330` covers verdict-not-in-pass, unparseable JSON, and parseable-no-verdict with no dispatch-step completion and byte-identical reasons.
- `tests/runner/gate-evaluation.test.ts:410-477` covers gate failure with a declared artifact path: transcript files exist and the canonical artifact is absent.
- `tests/runner/materializer-schema-parse.test.ts:167-322` covers schema-invalid and schema-missing artifact bodies with absent canonical artifact, present transcripts, no dispatch-step completion, byte-identical reasons, and `result.json` reason mirroring.
- `tests/runner/materializer-schema-parse.test.ts:324-371` covers the Slice 53/Slice 54 ordering seam: a bad verdict wins failure attribution before schema parsing.

Third, by an independent `node --input-type=module` proof against the built `dist/` runtime. The proof mutated the dogfood dispatch step to declare `writes.artifact`, then ran all four bad-output shapes through `runDogfood`. Each case passed the same assertions: outcome aborted, request/receipt/result transcript files present, canonical artifact absent, no `step.completed` for `dispatch-step`, `gate.evaluated` fail, `step.aborted`, `run.closed` aborted, reason identity across all four reason surfaces, and expected `dispatch.completed.verdict` (`reject`, `<no-verdict>`, `<no-verdict>`, `ok` respectively).

Result: the composed dispatch failure story is honest on fresh run roots. MED 1 below narrows that statement: literal "no artifact exists at path" still depends on a clean run root or an explicit stale-file policy.

Verification commands:

- Targeted cluster: `76 passed (76)` across `gate-evaluation`, `materializer-schema-parse`, and `artifact-backing-path-integrity`.
- Full verify: `1125 passed | 19 skipped`; `tsc`, `biome`, build, and Vitest all green.
- Audit: `32 green / 2 yellow / 0 red`; yellows are the known AGENT_SMOKE/CODEX_SMOKE fingerprint drift pair.
- CLI help: `npm run circuit:run -- --help` exits 0 through the compiled-JS binding.

## HIGH

### HIGH 1 - Check 26 does not bind this arc, and the test suite pins the omission

`scripts/audit.mjs:3185-3214` still enumerates only three `ARC_CLOSE_GATES` entries:

- `phase-2-foundation-foldins-slices-35-to-40`
- `phase-2-p2.4-p2.5-arc-slices-41-to-43`
- `slice-47-hardening-foldins`

There is no `clean-clone-reality-tranche` entry, even though `specs/plans/clean-clone-reality-tranche.md` exists and Slice 55 explicitly requires both arc-close prongs to land with the slice marker advance. `checkArcCloseCompositionReviewPresence` only considers plan files named by `ARC_CLOSE_GATES` (`scripts/audit.mjs:3230-3232`), so this arc is invisible to the mechanical gate. The fresh `npm run audit` output confirms it: Check 26 reports the three older arcs as satisfied and says nothing about Clean-Clone Reality.

This has one extra mechanical wrinkle beyond "add the object": `tests/contracts/artifact-backing-path-integrity.test.ts:698-715` currently asserts `ARC_CLOSE_GATES` has length 3 and names exactly those three arcs. Adding the gate without updating that test will fail the test suite; leaving the test as-is means the suite is actively pinning the ceremony blind spot.

Impact: a Slice 55 commit could advance `current_slice` to 55 without either prong file and still pass Check 26. That reduces the cadence rule to honor-system precisely at the boundary where the repo says it is mechanically enforced.

Remediation for the ceremony commit:

- Add a fourth `ARC_CLOSE_GATES` entry:
  - `arc_id: 'clean-clone-reality-tranche'`
  - `ceremony_slice: 55`
  - `plan_path: 'specs/plans/clean-clone-reality-tranche.md'`
  - `review_file_regex: /arc-clean-clone-reality-composition-review/i`
- Update `tests/contracts/artifact-backing-path-integrity.test.ts` to expect four gates and to assert the clean-clone arc is due at `current_slice=55`, red with missing prongs, red with one prong, and green with both ACCEPT/ACCEPT-WITH-FOLD-INS prongs.

Disposition: FOLD IN before the Slice 55 ceremony commit closes.

## MED

### MED 1 - The "no canonical artifact exists" invariant depends on a fresh run root

The composed failure story is true in the normal proof surface: CLI default run roots are unique by `runId` (`src/cli/dogfood.ts:168-170`), and the tests use fresh temp roots. But the runtime does not enforce a fresh run root. `initRunRoot` only `mkdir -p`s the root and event-log directory (`src/runtime/runner.ts:36-39`), and the CLI exposes `--run-root` directly (`src/cli/dogfood.ts:79-83`).

I reproduced the stale-file edge:

1. Create a run root with a preexisting `artifacts/dispatch-canonical.json`.
2. Run a dispatch step with `writes.artifact.path` pointing at that file.
3. Return a schema-valid but verdict-rejected adapter body.

The run aborted correctly, but the canonical artifact path still existed afterward with the stale body:

```json
{
  "outcome": "aborted",
  "artifactExistsAfterFail": true,
  "artifactBody": "stale artifact from before this run"
}
```

This does not contradict the fresh-root proof, and it is not caused by Slices 53/54. It is a boundary condition the arc-close invariant should not overstate. "The failed dispatch does not materialize the canonical artifact" is currently stronger than "no file exists at that path" unless the run root is fresh.

Impact: an operator using explicit `--run-root` can inspect a stale downstream-readable artifact after an aborted dispatch. The event log says aborted; the filesystem can still present old bytes at the canonical path.

Remediation: either enforce a fresh/empty run root before `runDogfood` starts, or amend the runtime contract to say the absence guarantee is scoped to fresh run roots and add a guard/diagnostic for explicit `--run-root` reuse. Trigger: the next slice touching run-root lifecycle, resume/retry semantics, or CLI `--run-root` behavior.

Disposition: DEFER-WITH-NAMED-TRIGGER unless the ceremony commit chooses the cheap prose fold-in now.

### MED 2 - `scripts/clean-clone-smoke.sh` is executable and well-shaped, but not audit-bound

Slice 52 made `scripts/clean-clone-smoke.sh` the operator-facing reproducibility artifact. I verified the file is tracked with executable mode (`100755`) and its body exercises the intended four-command path with scrubbed env: `npm ci`, `npm run verify`, `npm run audit`, and `npm run circuit:run -- --help`.

There is still no audit check binding its existence, mode, or command shape. A future edit could remove the `npm run audit` leg, drop env scrubbing, or lose executable mode without tripping `npm run audit`; the only backstop would be someone remembering to run the script manually.

Impact: this is not a current runtime bug. It is an evidence freshness gap: the tranche's first slice created a reproducibility proof, but the repo's normal drift machinery does not protect that proof from silent erosion.

Remediation: add a small audit check or contract test that verifies:

- `scripts/clean-clone-smoke.sh` exists and is executable.
- It contains the four required commands in order.
- It rejects sourcing and preserves env isolation knobs (`env -i`, isolated `HOME`, `NPM_CONFIG_USERCONFIG=/dev/null`, `NPM_CONFIG_CACHE`).

Trigger: next audit-coverage-extending slice, or the next edit to `scripts/clean-clone-smoke.sh`.

Disposition: DEFER-WITH-NAMED-TRIGGER.

## LOW

### LOW 1 - `dogfood-strict@v1` is labeled test-only but lives in the product artifact-schema registry

`src/runtime/artifact-schemas.ts` says `dogfood-strict@v1` is a test-only strict shape used by `tests/runner/materializer-schema-parse.test.ts`, but it is registered in the same product `REGISTRY` as `dogfood-canonical@v1`, `explore.synthesis@v1`, and `explore.review-verdict@v1`.

This is harmless at v0.3 and useful for a focused independent schema-fail test. The edge is semantic: a real workflow can now name a schema the source comment calls test-only. That blurs registry intent as soon as schemas become more meaningful than minimal verdict shapes.

Remediation: when the next schema-registry slice lands real artifact schemas, either move test-only schemas behind a test fixture helper or explicitly mark `dogfood-strict@v1` as a supported internal diagnostic schema.

Disposition: ACCEPT-AS-OBSERVATION with a named future cleanup trigger.

## Closing verdict

ACCEPT-WITH-FOLD-INS.

The runtime composition across Slice 53 and Slice 54 is accepted. The required bad-output story is verified end-to-end on fresh run roots, with both checked-in tests and an independent runtime proof. The arc should not close without folding in HIGH 1, because the current audit machinery does not enforce this arc-close ceremony at all and the contract test currently pins that omission.

The MED/LOW items do not block closure if recorded with the triggers above. They are boundary honesty items: make clear that artifact absence is a fresh-run-root guarantee unless a stale-file guard lands, and bind the clean-clone smoke artifact before it becomes another manual ritual.
