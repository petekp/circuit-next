---
name: build-live-proof-slice-125
description: Live Build command proof for Slice 125.
type: evidence
review_date: 2026-04-25
target: build-workflow-parity-work-item-9
target_kind: live-proof
workflow: build
command: "./bin/circuit-next build --goal 'No code change required: produce a schema-valid Build proof result that reports no files changed and evidence that this live Build command path completed.' --entry-mode lite --run-root .circuit-next/runs/slice-125-live-build-proof-2"
outcome: complete
run_root: .circuit-next/runs/slice-125-live-build-proof-2
run_id: f00c5649-5861-49dc-ba75-5aab0e5a53e6
events_observed: 37
schema_validation: passed
---

# Build Live Proof - Slice 125

This proof ran the direct Build command through the repo-local launcher:

```bash
./bin/circuit-next build --goal 'No code change required: produce a schema-valid Build proof result that reports no files changed and evidence that this live Build command path completed.' --entry-mode lite --run-root .circuit-next/runs/slice-125-live-build-proof-2
```

The CLI returned:

- `workflow_id: build`
- `selected_workflow: build`
- `routed_by: explicit`
- `outcome: complete`
- `events_observed: 37`
- `result_path: .circuit-next/runs/slice-125-live-build-proof-2/artifacts/result.json`

The run wrote all six Build artifacts:

- `artifacts/build/brief.json`
- `artifacts/build/plan.json`
- `artifacts/build/implementation.json`
- `artifacts/build/verification.json`
- `artifacts/build/review.json`
- `artifacts/build-result.json`

Schema validation was checked with the built artifacts:

```bash
node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BuildBrief, BuildImplementation, BuildPlan, BuildResult, BuildReview, BuildVerification } from './dist/schemas/artifacts/build.js';
const root = '.circuit-next/runs/slice-125-live-build-proof-2/artifacts';
const read = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
BuildBrief.parse(read('build/brief.json'));
BuildPlan.parse(read('build/plan.json'));
BuildImplementation.parse(read('build/implementation.json'));
BuildVerification.parse(read('build/verification.json'));
BuildReview.parse(read('build/review.json'));
BuildResult.parse(read('build-result.json'));
console.log('schema validation passed for all six Build artifacts');
NODE
```

Result: `schema validation passed for all six Build artifacts`.

The first live attempt, `.circuit-next/runs/slice-125-live-build-proof`,
reached Build but aborted at `act-step` because Claude Code 2.1.119 reports a
passive `PushNotification` tool even with `--tools ""`. Slice 125 folded that
CLI drift by admitting only `PushNotification` as a passive allowlisted tool
while still rejecting every unknown or write-capable tool name.
