---
name: compiled-recipe-runtime-bridge-codex-challenger-01
description: First Codex challenger pass for the compiled-recipe-runtime-bridge plan.
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: plan-challenger-review
review_date: 2026-04-25
verdict: REJECT-PENDING-FOLD-INS
authored_by: gpt-5.4 via codex exec
reviewed_plan:
  plan_slug: compiled-recipe-runtime-bridge
  plan_revision: 01
  plan_base_commit: dace8ac39edfb8b2f2059173fd0229733a70b414
  plan_content_sha256: not-bound-rejecting-pass
target: specs/plans/compiled-recipe-runtime-bridge.md
commands_run:
  - "codex exec -C /Users/petepetrash/Code/circuit-next --sandbox read-only --color never -m gpt-5.4 -"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: REJECT-PENDING-FOLD-INS
severity_counts:
  critical: 2
  high: 3
  med: 1
  low: 0
  meta: 0
---

# Compiled Recipe → Runtime Bridge Plan — Codex Challenger Pass 01

Codex returned **REJECT-PENDING-FOLD-INS** against revision 01.

This revision is not ready for challenger clearance. The main problem
is not polish; it is that the proposed seam is missing runtime-critical
information that the current compiler deliberately throws away, and the
later slices assume a runnable Fix substrate the repo explicitly does
not have yet. The plan also does not yet bind its own arc-close review
into the audit machinery, so even the ceremony path is softer than it
claims.

## Findings

1. **CRITICAL — The proposed `WorkflowRecipeDraft → Workflow` seam is structurally under-specified, and the current options bag is not enough to close the gap.**

   *Failure mode.* `compileWorkflowRecipeDraft` currently emits only `recipe_id`, `rigor`, `starts_at`, phase groupings, omitted phases, and per-item `{id, uses, phase, execution, output, edges}` (`src/schemas/workflow-recipe.ts:617-644`). A runtime `Workflow` requires far more: top-level `schema_version`, `version`, `purpose`, `entry`, `entry_modes`, `spine_policy`; phase `id` and `title`; and step `title`, `protocol`, `reads`, `writes`, `gate`, plus checkpoint policy or dispatch role (`src/schemas/workflow.ts`, `src/schemas/phase.ts`, `src/schemas/step.ts`). §5 even maps `draft.starts_at` into `Workflow.default_selection.start_at`, but `default_selection` has no `start_at` field at all (`src/schemas/selection-policy.ts`). This is not a small mapper problem; the draft has already dropped data the runtime needs.

   *Fold-in.* Do not open Slice A as "materializer + golden" yet. Either widen the compiler boundary to a runtime-ready intermediate that carries protocol ids, artifact bindings, reads, gate/policy data, phase titles, and spine-policy rationale, or change the seam so it compiles from the full recipe plus authoritative registries/tables rather than from `WorkflowRecipeDraft` alone. As written, Slice A is not the smallest proving unit; it needs a prior seam-definition / characterization slice.

   *Pointer.* §5, §8.1

2. **CRITICAL — Slice C assumes a live Fix runtime substrate that the repo explicitly says does not exist yet.**

   *Failure mode.* The Fix contract says it "does not wire a runnable Fix command or runtime behavior" (`specs/contracts/fix.md:29-30`). The workflow-kind policy tests say the "real Fix fixture waits for the artifact schemas and runtime substrate widenings" (`tests/contracts/workflow-kind-policy.test.ts:219-220`). The runner's live writers only know Build, Explore, and Review-specific artifacts today: registered synthesis writers exist for `build.*`, `explore.*`, and `review.*`; verification only supports `build.verification@v1`; checkpoint-owned artifact writing only supports `build.brief@v1` (`src/runtime/runner.ts:975-1208`). There are no Fix protocol ids in product fixtures, no Fix synthesis/verification/close writers, and no Fix checkpoint behavior. A compile path alone cannot make `fix.brief`, `fix.context`, `fix.diagnosis`, `fix.verification`, and `fix.result` materialize honestly.

   *Fold-in.* Narrow this arc to seam proof plus maybe non-live runner integration, or explicitly add prerequisite slices for Fix runtime substrate widening before any "live Fix execution" claim. If the intent is truly live proof, the plan must own Fix protocol naming, runtime writers, checkpoint behavior, verification execution, and close artifact generation, plus the invocation path that reaches them.

   *Pointer.* §3-§4, §8.2-§8.3

3. **HIGH — §6's authority story is internally inconsistent and misses the characterization-first gate.**

   *Failure mode.* The plan declares `workflow.definition`, `run.projection`, and `run.log` as successor-to-live in §6, but the current authority rows still classify those artifacts as greenfield in `specs/artifacts.json` (`workflow.definition`: lines 5-29; `run.log`: 185-214; `run.projection`: 216-240). ADR-0003 Addendum C says that once a plan declares successor-to-live and starts naming normative payload, characterization must land first (`specs/adrs/ADR-0003-authority-graph-gate.md:567-639`). This plan immediately declares a seam signature, mapping rules, fixture shape, compile path, and close behavior without a characterization slice. The frontmatter also cites a nonexistent ADR path (`specs/adrs/ADR-0013-fix-as-first-recipe.md`) instead of the real `ADR-0013-primitive-backed-workflow-recipes.md`.

   *Fold-in.* Pick one honest path. Either align §6 to the current authority graph and stop treating this arc as successor-to-live at the workflow-definition layer, or make the first slice a real characterization / authority-row update that lands before normative seam work. In either case, fix the ADR-0013 citation.

   *Pointer.* frontmatter authority, §6

4. **HIGH — The rigor story in §5 mixes compile-time graph resolution with runtime entry-mode rigor in a contradictory way.**

   *Failure mode.* The recipe compiler already proves that rigor is graph-shaping, not merely descriptive: `fix-verify.continue` resolves to `fix-review` at `standard` and `fix-close-lite` at `lite` (`tests/contracts/workflow-recipe.test.ts:203-217`). §5 then says `draft.rigor` is "informational" and should not be re-recorded on `Workflow`, while `entry_modes` still carry runtime rigor. That creates an incoherent surface: a rigor-resolved graph combined with runtime selectors that may claim different rigors. If multiple entry modes survive materialization, the generated workflow can say "lite" while still containing the standard route topology, or vice versa.

   *Fold-in.* Choose one binding rule. Either materialize a single-rigor workflow and make that explicit in the seam, or compile from projection per entry-mode/runtime selection and stop using `WorkflowRecipeDraft` as the runtime bridge artifact. The current "per-rigor draft plus caller-supplied entry_modes" hybrid is not stable.

   *Pointer.* §5

5. **HIGH — The ceremony slice is not mechanically enforceable in its current shape, and the lane claim is too soft for the work that is actually needed.**

   *Failure mode.* §8.4 and §11 lean on same-commit staging and a possible "generalized arc-ledger gate," but the plan never says Slice D will add a new `ARC_CLOSE_GATES` entry or update the gate tests. The current audit ledger has named entries for prior arcs only; there is no `compiled-recipe-runtime-bridge` entry in `scripts/audit.mjs`, so audit will not enforce this review by default. Prior privileged-runtime ceremony slices closed this by co-landing the new gate entry and tests. Without that, Slice D is not just a review-only Discovery slice; it is an unbound promise.

   *Fold-in.* Rewrite Slice D to explicitly add the arc-close gate entry, matching regex, ceremony slice id, and test updates, then classify the slice accordingly. Also tighten §11 so it names the actual enforcement shape that will exist after the ceremony, instead of conditionally inheriting the first-instance Check 26 language.

   *Pointer.* §8.4, §11

6. **MED — Slice A's "curated expected fixture" and Slice C's ratchet claim are not yet grounded by independent authority.**

   *Failure mode.* There is no authoritative `fix-candidate.workflow.json` today, and the repo explicitly treats Fix as policy-only until runtime substrate widening lands. If Slice A authors both the materializer and the expected workflow fixture, the structural-match test is self-referential. Separately, Slice C is labeled Ratchet-Advance, but §9's "recipe pipeline reach" is narrative, not a measurable ratchet in the repo's current machinery. That leaves both the golden and the lane/ratchet story weaker than the plan claims.

   *Fold-in.* For Slice A, prefer field-level assertions grounded in existing authorities: Fix canonical phase set, omitted `plan`, route topology, artifact path/schema tables from `src/schemas/artifacts/fix.ts`, and `Workflow.parse` invariants. Only add a full golden fixture after a separate slice establishes it as a real reference surface. For Slice C, either bind it to a real measurable ratchet or stop calling it Ratchet-Advance.

   *Pointer.* §8.1, §8.3, §9

## Closing verdict

**REJECT-PENDING-FOLD-INS.**

The two CRITICAL findings together imply the arc as framed cannot land
without either widening the compiler output or first building Fix
runtime substrate. The HIGH findings reinforce that the seam-shape and
authority story are not yet honest. Revision 02 must either:

- Reframe the arc as a *seam-proof-only* effort (no live Fix execution
  claim), with the authority graph aligned to greenfield, the rigor
  binding rule chosen, the ARC_CLOSE_GATES wiring named, and the golden
  fixture grounded outside Slice A; or

- Reframe the arc as a *Fix runtime substrate widening + bridge* effort
  with explicit prerequisite slices for Fix protocol naming, writers,
  checkpoint behavior, and invocation path, plus the same authority /
  rigor / gate fold-ins.

Either reframe is a major revision, not a small fold-in pass. The
operator-direction question (which reframe to take) sits above the
methodology layer and should be answered before revision 02.
