---
name: recipe-runtime-substrate-codex-challenger-04
description: Fourth Codex challenger pass for the recipe-runtime-substrate plan, revision 04 (post-pass-03 fold-in).
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: plan-challenger-review
review_date: 2026-04-25
verdict: REJECT-PENDING-FOLD-INS
authored_by: gpt-5.4 via codex exec
reviewed_plan:
  plan_slug: recipe-runtime-substrate
  plan_revision: 04
  plan_base_commit: 1e2cd40be580979f1a56f6bd4777128d4881c786
  plan_content_sha256: 1eb2717839c19fa31644115cb84595385b3bbe309edc953523151c83836b017b
target: specs/plans/recipe-runtime-substrate.md
commands_run:
  - "codex exec -C /Users/petepetrash/Code/circuit-next --sandbox read-only --color never -m gpt-5.4 -"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: REJECT-PENDING-FOLD-INS
severity_counts:
  critical: 0
  high: 1
  med: 2
  low: 0
  meta: 0
---

Codex returns **REJECT-PENDING-FOLD-INS**. This is a **bound pass**: the on-disk plan SHA matches `1eb2717839c19fa31644115cb84595385b3bbe309edc953523151c83836b017b`, and the plan self-declares `base_commit: 1e2cd40be580979f1a56f6bd4777128d4881c786`, matching the reviewed packet. The pass-03 fold-ins are real in broad shape (F1 anti-drift invariants exist; F2 prerequisite-arc citation exists; F3 acceptance narrowing exists), but three remaining issues are mechanical and structural-but-fold-inable: §11 close criteria let this arc declare F2-closed even before the prerequisite arc Slice A is live in code (F1 HIGH); the F2 prerequisite-arc citation binds to the wrong base_commit (F2 MED); and the Fix-table parity test surface lacks a concrete authoritative binding (F3 MED).

## Findings

1. **HIGH — §11 can close the substrate arc before the prerequisite checkpoint-widening slice is live in code.**

   *Failure mode.* The plan correctly says, in §4 and §5, that the checkpoint `write_target` seam is only honest once the prerequisite arc's Slice A widening of `src/schemas/step.ts:176-191` is live in code. But §11 never makes that a close precondition. As written, this arc can satisfy its own Slice A, land Slice D, mark itself `closed`, and declare the bridge "unblocked" even while the runtime `Step` parser still rejects a Fix checkpoint artifact like `fix.no-repro-decision@v1`. That is a false-green close on the exact sink F2 was supposed to fence.

   *Fold-in.* Add an explicit close criterion, and matching Slice A acceptance language, that this arc cannot close or unblock bridge revision 03 until the prerequisite arc's Slice A has landed in code: the checkpoint artifact restriction at `src/schemas/step.ts:176-191` must be widened, and the Workflow-layer parse proof required by the prerequisite plan must be green on disk. If you want the dependency to remain external, say this arc is `blocked pending prerequisite close` rather than saying the bridge is unblocked.

   *Pointer.* Plan: `specs/plans/recipe-runtime-substrate.md:324-339`, `specs/plans/recipe-runtime-substrate.md:543-552`, `specs/plans/recipe-runtime-substrate.md:947-976`. Source: `specs/plans/runtime-checkpoint-artifact-widening.md:35-49`, `specs/plans/runtime-checkpoint-artifact-widening.md:133-145`, `specs/plans/runtime-checkpoint-artifact-widening.md:173-183`, `src/schemas/step.ts:176-191`.

2. **MED — The F2 prerequisite-arc citation is misbound to the wrong base commit.**

   *Failure mode.* The substrate plan names the prerequisite arc as `status challenger-cleared, revision 04, base_commit 1e2cd40`. On disk, the prerequisite plan's own frontmatter and its ACCEPT-class challenger record bind revision 04 to `base_commit 190122d00ba47a0fe34caef2a2a1d28128b585e5`. Under ADR-0010, `base_commit` is part of the plan identity that challenger clearance binds. So the dependency note currently points at a cleared predecessor instance that does not exist on disk.

   *Fold-in.* Replace the cited prerequisite `base_commit` with `190122d00ba47a0fe34caef2a2a1d28128b585e5` wherever this dependency is named, or drop the `base_commit` claim and point directly to the ACCEPT review artifact that carries the binding. Keep the dependency anchored to the actual cleared prerequisite instance.

   *Pointer.* Plan: `specs/plans/recipe-runtime-substrate.md:330-332`, `specs/plans/recipe-runtime-substrate.md:546-548`. Source: `specs/plans/runtime-checkpoint-artifact-widening.md:1-9`, `specs/reviews/runtime-checkpoint-artifact-widening-codex-challenger-04.md:12-18`, `specs/reviews/runtime-checkpoint-artifact-widening-codex-challenger-04.md:34`, `specs/adrs/ADR-0010-arc-planning-readiness-gate.md:140-169`, `specs/adrs/ADR-0010-arc-planning-readiness-gate.md:263-269`.

3. **MED — The Fix-table parity half of F1 still lacks a concrete authoritative test hook.**

   *Failure mode.* The plan says the second anti-drift rule is enforced by a Fix-specific contract test comparing `runtime_step.write_target.{path,schema}` against `FIX_RESULT_*[fix_artifact_id]`. But on disk those tables are file-local `const`s in `src/schemas/artifacts/fix.ts`, not exported, while the plan also says the tables remain unchanged and then reopens whether parity is parser-enforced or test-enforced. As written, the named test surface has no stated authoritative way to read the named tables, so the implementer can only duplicate literals, scrape source text, or silently widen the export surface ad hoc. That weakens the "single authority" proof F1 was meant to add.

   *Fold-in.* Choose and name one binding surface. Either budget an exported read-only resolver/table from `src/schemas/artifacts/fix.ts` so the contract test can bind to source authority, or move Fix-table parity into parser-side code and keep the contract test as proof only. Then remove the `Slice A picks the enforcement surface` escape hatch so §5 and §8.1 say the same thing.

   *Pointer.* Plan: `specs/plans/recipe-runtime-substrate.md:302-307`, `specs/plans/recipe-runtime-substrate.md:518-526`, `specs/plans/recipe-runtime-substrate.md:772-804`. Source: `src/schemas/artifacts/fix.ts:4-22`, `tests/contracts/workflow-recipe.test.ts:1-13`.

## Bottom line

Revision 04 is bound, and the pass-03 fold-ins are real in broad shape, but it is not ready to advance to `challenger-cleared` yet. The blocking issue is structural: the close criteria still let this arc declare victory before the prerequisite checkpoint-widening slice is live in code. After that is fixed, the remaining work is to rebind the prerequisite citation to the actual cleared artifact and make the Fix-table parity proof surface explicit rather than implied.
