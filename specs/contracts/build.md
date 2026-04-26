---
contract: build
status: draft
version: 0.1
schema_source: src/schemas/artifacts/build.ts
reference_evidence: specs/reference/legacy-circuit/build-characterization.md
last_updated: 2026-04-25
depends_on: [workflow, phase, step, adapter]
artifact_ids:
  - build.brief
  - build.plan
  - build.implementation
  - build.verification
  - build.review
  - build.result
invariant_ids: []
property_ids: []
---

# Build Workflow Contract

The **Build** workflow is the first broader parity target after the first
working workflow spine. It is a clean-break structured JSON successor to the
first-generation Build workflow described in
`specs/reference/legacy-circuit/build-characterization.md`.

This contract starts as the artifact home for the six Build outputs:

| Artifact | Role | Backing path |
|---|---|---|
| `build.brief` | Frame checkpoint brief | `<run-root>/artifacts/build/brief.json` |
| `build.plan` | Plan plus verification commands | `<run-root>/artifacts/build/plan.json` |
| `build.implementation` | Worker implementation result | `<run-root>/artifacts/build/implementation.json` |
| `build.verification` | Executed verification evidence | `<run-root>/artifacts/build/verification.json` |
| `build.review` | Independent review result | `<run-root>/artifacts/build/review.json` |
| `build.result` | Close summary | `<run-root>/artifacts/build-result.json` |

Build role artifacts live under `artifacts/build/` so they do not collide with
Explore or Review artifact names. The workflow-specific Build result is
`artifacts/build-result.json`; the universal engine result remains
`artifacts/result.json`.

Any persisted path carried inside a Build artifact is treated as a
`RunRelativePath`-style value: it must stay inside the run root and must not
use absolute, home-directory, parent-directory, Windows absolute, or UNC path
forms. Work item 2 enforces this immediately for verification command `cwd`;
checkpoint and artifact-pointer path fields are registered here so later
runtime writers can bind them to the same path-safe primitive before execution.

`build.plan@v1` carries direct-argv verification commands. It does not accept
shell command strings, shell `-c` execution, project-root escaping `cwd`,
missing timeouts, or unbounded output.
