---
contract: review
status: draft
version: 0.1
schema_source: .claude-plugin/skills/review/circuit.json + src/schemas/artifacts/review.ts
last_updated: 2026-04-24
depends_on: [workflow, phase, step, adapter]
artifact_ids:
  - review.result
invariant_ids:
  - REVIEW-I1
  - REVIEW-I2
property_ids: []
---

# Review Workflow Contract

The **Review** workflow is the P2.9 second-workflow target. It is an
audit-only review variant with three phases:

| Workflow title | Canonical phase | Role |
|---|---|---|
| Intake | `frame` | Resolve the review scope from the run goal. |
| Independent Audit | `analyze` | Dispatch a reviewer and collect findings. |
| Verdict | `close` | Aggregate findings into the final `review.result` artifact. |

The workflow deliberately omits `plan`, `act`, `verify`, and nested
`review`. The previous-generation review skill has a verification rerun
phase; P2.9 does not. A verification-bearing variant would be a separate
workflow kind.

## Scope Note

This is a workflow-specific contract over the base `Workflow` schema, the
same kind of discipline layer as `src/workflows/explore/contract.md`. The fixture
is validated by `src/schemas/workflow.ts`; the final artifact shape is
validated by `src/schemas/artifacts/review.ts`.

At v0.2, the default runtime synthesis writer has a narrow review
registration: `review.intake@v1` writes the scoped intake object and
`review.result@v1` reads the analyze-phase dispatch result to produce the
typed close artifact. Other synthesis schemas keep the placeholder fallback
until their own schema-specific writers land.

## Artifact

This workflow registers one primary artifact:

- `review.result` — the close-phase result artifact, persisted at
  `<run-root>/artifacts/review-result.json`. It carries:
  - `scope`: string
  - `findings`: array of `{severity, id, text, file_refs}`
  - `verdict`: `CLEAN | ISSUES_FOUND`

The Intake artifact and analyze dispatch result are internal workflow
files, not authority-graph artifacts.

## Invariants

<a id="REVIEW-I1"></a>

- **REVIEW-I1 — Reviewer identity separation.** The step that writes the
  `review` workflow's primary artifact at canonical phase `close` MUST be
  preceded in `steps[]` by a dispatch step with `role: "reviewer"` at
  canonical phase `analyze`.

  Enforced today by the review-specific policy check in
  `scripts/policy/workflow-kind-policy.mjs` and by
  `tests/properties/visible/review-i1.test.ts`. The fixture satisfies this
  with `audit-step` before `verdict-step`.

<a id="REVIEW-I2"></a>

- **REVIEW-I2 — Verdict determinism.** The `review.result` artifact MUST
  carry `verdict: "CLEAN"` if and only if the findings contain zero
  `critical` findings and zero `high` findings. Any critical or high
  finding makes the verdict `ISSUES_FOUND`.

  Enforced by `src/schemas/artifacts/review.ts` and
  `tests/properties/visible/review-i2.test.ts`.

## Fixture Binding

The fixture at `.claude-plugin/skills/review/circuit.json` binds this
contract as follows:

| Phase | Step | Kind | Output |
|---|---|---|---|
| Intake / `frame` | `intake-step` | `synthesis` | internal `review.intake@v1` scope artifact |
| Independent Audit / `analyze` | `audit-step` | `dispatch`, `role: "reviewer"` | raw reviewer JSON at `phases/analyze/review-raw-findings.json` |
| Verdict / `close` | `verdict-step` | `synthesis` | registered `review.result@v1` artifact |

The analyze dispatch step uses:

- `writes.result = "phases/analyze/review-raw-findings.json"`
- `gate.source = {kind: "dispatch_result", ref: "result"}`
- `gate.pass = ["NO_ISSUES_FOUND", "ISSUES_FOUND"]`
- its JSON body uses `NO_ISSUES_FOUND` iff `findings.length === 0`;
  otherwise it uses `ISSUES_FOUND`. The final close-phase `review.result`
  verdict remains severity-based per REVIEW-I2.

Those literals are pinned in
`tests/contracts/review-dispatch-shape.test.ts`.

## Pre-Conditions

- The fixture parses under the base `Workflow` schema.
- The fixture top-level `id` is `review`.
- The canonical phase set is exactly `{frame, analyze, close}`.
- `spine_policy.mode` is `partial` with omits `{plan, act, verify,
  review}`.
- The close-phase artifact schema is `review.result@v1`.

## Post-Conditions

After the fixture is accepted:

- The review workflow cannot claim a final artifact writer unless the
  analyze-phase reviewer dispatch precedes it structurally.
- The final artifact schema exists and computes the verdict
  deterministically from findings.
- Runtime wiring is intentionally narrow: only the audit-only review
  intake/result synthesis artifacts have a default registered writer.

## Reopen Conditions

This contract reopens if any of:

1. The review workflow gains a verification rerun phase. That is a new
   workflow kind or a contract-breaking amendment.
2. The final artifact path or schema id changes away from
   `artifacts/review-result.json` / `review.result@v1`.
3. The analyze dispatch gate vocabulary changes away from
   `NO_ISSUES_FOUND` / `ISSUES_FOUND`.
4. The generic runtime synthesis writer is widened beyond the audit-only
   review registration to produce typed artifacts for additional workflow
   kinds. This contract should then name any shared registry contract it
   starts depending on.

## Authority

- `specs/plans/p2-9-second-workflow.md §3` (canonical phase set)
- `specs/plans/p2-9-second-workflow.md §4` (REVIEW-I1 / REVIEW-I2)
- `specs/plans/p2-9-second-workflow.md §5` (artifact model and dispatch
  shape)
- `src/schemas/artifacts/review.ts` (artifact schemas)
- `.claude-plugin/skills/review/circuit.json` (runtime fixture)
