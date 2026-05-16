# Circuit Evals

Circuit evals have explicit claim levels:

| Level | Meaning | Product claim? |
| --- | --- | --- |
| `smoke` | Proves eval plumbing or a tiny behavior slice still runs. | No |
| `regression` | Prevents known behavior from sliding backward. | No fresh claim |
| `discovery` | Finds product gaps or promising directions. | No |
| `claim-grade` | Uses held-out tasks, objective scoring, and a frozen claim rule. | Yes, if the claim gate passes |

Only claim-grade held-out runs can support public or product-facing claims such
as "Circuit beats vanilla." Discovery and regression evals can guide work, but
they must not be cited as measurement wins.

## Current Registry

Run:

```bash
npm run evals:list
```

The registry check is part of `npm run check-evals`, `verify:fast`, and
`verify`, so eval claim levels and README links should not drift silently.

## Remaining Flow Coverage

See [remaining-flow-eval-specs.md](remaining-flow-eval-specs.md) for the
eval ladder for Review, Build, Explore, Runtime Proof, and the router surface.
The first local smoke/regression layer is implemented in
[flow-regressions/](flow-regressions/) and registered in `evals/registry.json`.
Those entries are not claim-grade.

## Default Checks

```bash
npm run check-evals
```

This command uses temporary output directories for eval dry-runs and runs the
local flow-regression tests. It does not invoke live models.
