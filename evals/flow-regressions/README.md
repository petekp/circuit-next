# Flow Regression Evals

Status: local smoke and regression evals.

These evals make the remaining Circuit flow surfaces runnable without live
model calls. They are test-backed, not claim-grade. Their job is to keep flow
contracts, report wiring, proof evidence, and routing behavior from sliding
backward while stronger task-corpus evals are built.

Run all local flow evals:

```bash
node scripts/evals/run-flow-regression.mjs --all
```

Dry-run the plan without running tests:

```bash
node scripts/evals/run-flow-regression.mjs --all --dry-run
```

Run one eval:

```bash
node scripts/evals/run-flow-regression.mjs --eval-id build-proof-chain
```

## Registered Evals

| Eval | Level | Flow | What It Protects |
| --- | --- | --- | --- |
| `review-clean-control` | regression | Review | Clean and issue-found Review report paths, relay shape, and result schema. |
| `build-proof-chain` | regression | Build | Checkpoint, implementation, verification, review, and close proof chain. |
| `explore-grounding-contract` | regression | Explore | Evidence references, report composition, schemas, and tournament artifacts. |
| `runtime-proof-smoke` | smoke | Runtime Proof | Compose, relay, trace, report, and connector identity plumbing. |
| `flow-router-intent` | regression | Router / run | Natural-language routing and precedence behavior. |

## Claim Boundary

These evals cannot support "Circuit beats vanilla" claims. They have no
paired vanilla arm, held-out task split, or frozen claim rule. `fix-vs-vanilla`
remains the only claim-grade registered eval.
