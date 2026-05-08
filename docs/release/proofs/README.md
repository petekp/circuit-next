# Release Proofs

`runs/` contains committed release proof files captured by the release proof
scripts. These are not casual examples. They are fixtures that back public
release claims and are parsed by the release infrastructure tests.

Update them with:

```bash
npm run capture-proofs:golden-runs
```

The release tests enforce that proof paths stay under `docs/release/proofs/runs`
and that the old `examples/runs` location does not come back.

## Lifecycle

Every scenario in `index.yaml` has a `status`. Only `verified_current` proofs
back public claims. Any other status is treated as planned and blocks the
readiness IDs that scenario references.

**When to regenerate.** Run `npm run capture-proofs:golden-runs` whenever you
change something a proof asserts:

- runtime control flow, recovery routes, or terminal outcomes
- a flow's stage path, report schema, or operator-summary shape
- checkpoint envelope content or the resume contract
- a scenario's command, expected flow, or expected outcome in `index.yaml`
- a new public claim or readiness ID that needs evidence behind it

If you only edited code no scenario exercises, you do not need to regenerate.

**How to review the diff.** Capture writes scrubbed output. Diff each touched
file before committing:

- `run/reports/**` — expect structural diffs only; IDs, paths, and timestamps
  are scrubbed. A real shape change should be intended.
- `operator-summary.md` — read it as a user would. If the wording got worse,
  the product regressed; do not paper over it by committing the new bytes.
- `result.json` — compare verdict, outcome, and next-action fields against
  the scenario's `summary_contract` in `index.yaml`.

**When missing or stale proofs block release.** `npm run check-release-infra`
fails on:

- declared `required_files` missing on disk
- a scenario referenced by a public claim or readiness ID whose status is
  not `verified_current`
- untracked files inside `runs/` (capture should write only declared paths)

Fix by regenerating, not by downgrading the scenario's status.
