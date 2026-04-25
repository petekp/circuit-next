---
review: build-workflow-parity-codex-challenger-09
review_date: 2026-04-25
reviewer_model: gpt-5.4
reviewer_model_id: gpt-5.4
authored_by: gpt-5.4
plan_slug: build-workflow-parity
plan_revision: 09
plan_base_commit: eb52089
plan_content_sha256: 103f840a48a91c6413c8ded8248974a5a1cc811a0b882c573a06b5a4821c2d66
plan_status_at_review: challenger-pending
verdict: REJECT-PENDING-FOLD-INS
---

## Verdict

**REJECT-PENDING-FOLD-INS.**

The reviewed tuple matched exactly, and `npm run plan:lint -- --context=committed specs/plans/build-workflow-parity.md` was green. Revision 09 fully folds the pass-08 artifact-path finding and the `build.plan@v1` typed-payload finding, and I did not find an earlier pass 01-07 objection still open in its original form. One pass-08 HIGH seam remains: the same-invocation `--entry-mode` + `--rigor` guarantee is explicit on the CLI side, but not yet explicitly bound to plugin-command tests.

## Tuple Check

- `git rev-parse HEAD` matched the commissioned `committed_at`: `c686a30478fe6c9821528803779a086fd087e3ec`.
- `shasum -a 256 specs/plans/build-workflow-parity.md` matched the commissioned content hash: `103f840a48a91c6413c8ded8248974a5a1cc811a0b882c573a06b5a4821c2d66`.
- `git show c686a30478fe6c9821528803779a086fd087e3ec:specs/plans/build-workflow-parity.md | shasum -a 256` matched the same hash.
- The file on disk is `status: challenger-pending`, `revision: 09`, `base_commit: eb52089`.
- `npm run plan:lint -- --context=committed specs/plans/build-workflow-parity.md` returned green.

## Fold Status

- **Pass 08 HIGH artifact-path collision:** folded. `specs/plans/build-workflow-parity.md:281-300` moves Build role artifacts to distinct `artifacts/build/*.json` paths and keeps `build.result` at `artifacts/build-result.json`; Work item 2 binds path-distinct tests at `specs/plans/build-workflow-parity.md:513-518`. Against the live repo, the current conflicting Explore paths are still the flat files at `specs/artifacts.json:595-684`, and the audit check only reds on exact normalized backing-path collisions (`scripts/audit.mjs:3518-3612`). On that live rule, `artifacts/build/*.json` is clean and does not need a new allowlist or tracked-collision exception.
- **Pass 08 HIGH public entry-mode selector:** partially folded. The selector is now named in `specs/plans/build-workflow-parity.md:262-272`, and Work item 7 explicitly requires CLI same-invocation coverage at `specs/plans/build-workflow-parity.md:731-763`.
- **Pass 08 MED `build.plan@v1` typed payload:** folded. The exact direct-argv structure is pinned in `specs/plans/build-workflow-parity.md:310-332`, then required at schema time in Work item 2 (`specs/plans/build-workflow-parity.md:504-527`) and writer time in Work item 3 (`specs/plans/build-workflow-parity.md:549-562`) before the verification runtime slice opens.
- **Passes 01-07:** no still-open finding found in its original form. The previously challenged seams around `build.result` path split, checkpoint-owned `build.brief`, real pause/resume, resolved-rigor precedence, dispatch-policy enforcement, and routed waiting-envelope metadata are all now explicitly budgeted in `§6-§8` and Work items 2, 5, 6, 7, and 8.

## Findings

1. **HIGH** — Pass-08's public-entry-mode fold-in is still incomplete on the plugin-command side. Work item 7 explicitly requires CLI proof that `--entry-mode` and `--rigor` can appear on the same invocation (`specs/plans/build-workflow-parity.md:755-763`). Work item 8 wires both knobs into the public command bodies (`specs/plans/build-workflow-parity.md:798-803`) and broadens plugin tests generally (`specs/plans/build-workflow-parity.md:814-820`), but the only command-side same-invocation requirement is a documentation/example bullet (`specs/plans/build-workflow-parity.md:827-828`). The explicit command-invocation test bullets that follow cover Build routing, close-artifact path, waiting-envelope handling, and routed metadata (`specs/plans/build-workflow-parity.md:838-843`), not the combined `--entry-mode` + `--rigor` case. In this repo, plugin-command guarantees are usually bound by narrow command-body tests rather than generic presence checks (`tests/runner/plugin-command-invocation.test.ts:94-180`, `tests/contracts/plugin-surface.test.ts:73-80`, `scripts/audit.mjs:3194-3288`). As written, revision 09 still leaves room for the CLI to get the combined-case proof while the public slash-command docs/tests stay weaker than pass 08 asked for.

Minimum fold-in: add an explicit Work item 8 deliverable and acceptance bullet that command-invocation tests must prove both `commands/build.md` and `commands/run.md` include a same-invocation example carrying both `--entry-mode` and `--rigor`, preserving the independence of the two knobs on the public command surface.

## Bottom Line

Revision 09 is close, but it is not ready to become challenger-cleared yet. The artifact-backing-path collision is honestly resolved without an audit exception, the typed `build.plan@v1` verification payload is pinned early enough, and I did not find an unclosed blocker from passes 01-07. The remaining blocker is narrow but real: Work item 8 still needs an explicit plugin-command test binding for the same-invocation `--entry-mode` + `--rigor` case.
