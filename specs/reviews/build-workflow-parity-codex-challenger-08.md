---
review: build-workflow-parity-codex-challenger-08
review_date: 2026-04-25
reviewer_model: gpt-5.4
reviewer_model_id: gpt-5.4
authored_by: gpt-5.4
plan_slug: build-workflow-parity
plan_revision: 08
plan_base_commit: eb52089
plan_content_sha256: da583befff5a001983c3930b2142f0a5faa84da135800bac6cba258aeebe91d7
plan_status_at_review: challenger-pending
verdict: REJECT-PENDING-FOLD-INS
---

# Build Workflow Parity Codex Challenger 08

## Verdict

REJECT-PENDING-FOLD-INS.

The reviewed tuple matched on disk:
`plan=build-workflow-parity`, `revision=08`, `base_commit=eb52089`,
`plan_content_sha256:
da583befff5a001983c3930b2142f0a5faa84da135800bac6cba258aeebe91d7`,
and `committed_at=d385dbcb263aa78eae2efcae2b3c83f9ee7d1f15`.

## Fold Status

- Pass 01: folded.
- Pass 02: folded.
- Pass 03: folded.
- Pass 04: folded.
- Pass 05: folded.
- Pass 06: folded.
- Pass 07: folded. Revision 08 makes the Frame/checkpoint path own
  `build.brief@v1` on both waiting and resolved paths, and it preserves
  router metadata in `checkpoint_waiting`.
- No earlier finding still looks only partially folded in its original form.
  The remaining objections are new seams against the live repo contracts.

## Findings

1. HIGH - `build.brief` currently lands on a path that the repo's
   artifact-authority checks already reserve for `explore.brief`. The plan
   binds `build.brief` to `<run-root>/artifacts/brief.json`, but
   `specs/artifacts.json` already binds `explore.brief` to the same backing
   path. The live `checkArtifactBackingPathIntegrity` helper fails red on the
   temporary `{build.brief, explore.brief}` collision. Minimum fold-in: give
   `build.brief` a distinct persisted path, or explicitly budget the
   artifact-authority/audit change that allows this workflow-scoped reuse and
   its tests.

2. HIGH - The public entry-mode surface is still under-specified. The live CLI
   only exposes `[workflow-name] --goal --rigor --run-root --fixture`.
   Revision 08 says a CLI entry-mode selector will exist and command bodies
   will pass Build mode requests through, but it never pins the actual public
   syntax. Minimum fold-in: name the public selector now, wire it into Work
   items 7 and 8, and require CLI/command tests that show entry mode and
   `--rigor` can be set independently on the same invocation.

3. MED - `build.plan@v1` still does not have its verification-command contract
   pinned early enough. Section 7 says Verify reads a typed argv command list
   from `build.plan@v1`, but Work items 2 and 3 do not explicitly require that
   structure before the verification runtime slice opens. Minimum fold-in:
   make Work items 2 and 3 explicitly require `build.plan@v1` to carry the
   exact typed verification-command structure that Work item 4 will execute,
   with schema and writer tests pinned before the verification runtime slice.

## Bottom Line

Revision 08 clears the pass-07 blockers, but it is not ready to clear. One
planned artifact path would be rejected by the current audit, the public Build
mode selector is still too vague, and the typed verification command payload
needs to be pinned before runtime command execution starts.
