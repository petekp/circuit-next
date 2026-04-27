---
contract: fix
status: draft
version: 0.1
schema_source: src/schemas/artifacts/fix.ts
reference_evidence: specs/reference/legacy-circuit/repair-characterization.md
last_updated: 2026-04-25
depends_on: [workflow, workflow-primitives, workflow-recipe, step, adapter]
artifact_ids:
  - fix.brief
  - fix.context
  - fix.diagnosis
  - fix.no-repro-decision
  - fix.change
  - fix.verification
  - fix.review
  - fix.result
invariant_ids: []
property_ids: []
---

# Fix Artifact Contract

Fix is the clearer v1 successor to the old Repair evidence. Its job is to take
a concrete problem, understand it, make the smallest safe change, prove it, and
close with evidence.

This contract starts as the artifact home for the Fix recipe draft. It does not
wire a runnable Fix command or runtime behavior.

| Artifact | Role | Backing path |
|---|---|---|
| `fix.brief` | Problem boundary and proof target | `<run-root>/artifacts/fix/brief.json` |
| `fix.context` | Evidence gathered before diagnosis | `<run-root>/artifacts/fix/context.json` |
| `fix.diagnosis` | Cause, reproduction status, and uncertainty | `<run-root>/artifacts/fix/diagnosis.json` |
| `fix.no-repro-decision` | Operator or mode-policy choice when evidence is uncertain | `<run-root>/artifacts/fix/no-repro-decision.json` |
| `fix.change` | Focused change evidence | `<run-root>/artifacts/fix/change.json` |
| `fix.verification` | Executed proof evidence | `<run-root>/artifacts/fix/verification.json` |
| `fix.review` | Independent review result when the mode requires it | `<run-root>/artifacts/fix/review.json` |
| `fix.result` | Close summary | `<run-root>/artifacts/fix-result.json` |

Fix role artifacts live under `artifacts/fix/` so they do not collide with
Explore, Review, or Build artifacts. The workflow-specific Fix result is
`artifacts/fix-result.json`; the universal engine result remains
`artifacts/result.json`.

Any persisted path carried inside a Fix artifact is treated as a
`RunRelativePath`-style value: it must stay inside the run root and must not
use absolute, home-directory, parent-directory, Windows absolute, or UNC path
forms. This applies to context source refs, diagnosis refs, verification command
ids, and result artifact pointers registered as path-derived fields in the
authority graph.

`fix.verification@v1` carries direct-argv verification results and reuses the
safe verification command shape already proven for Build. It does not accept
shell command strings, shell `-c` execution, project-root escaping `cwd`,
missing timeouts, or unbounded output.

`fix.diagnosis@v1` must be honest about uncertainty. If the problem was not
cleanly reproduced, it must carry residual uncertainty instead of closing as if
the problem were proven.

`fix.brief@v1` carries a regression contract: expected behavior, actual
behavior, a reproduction command or recipe when available, and either a
failing-before-fix regression test or an explicit deferral reason when the bug
is not yet reproducible.

`fix.result@v1` cannot report `fixed` unless verification passed and the
regression contract is proved. A `not-reproduced` result must point at the
human-decision artifact that records how the run chose to stop or continue.

Independent review is conditional. When review runs, `fix.result@v1` must carry
a review verdict and a pointer to `fix.review`. When review is skipped, the
result must carry explicit skipped-review evidence instead of fabricating a
review artifact pointer.
