---
name: arc-slice-60-codex
description: Codex challenger pass over Slice 60 (retroactive plan-lint proof on flawed P2.9 draft + rule #4 stale-ownership strengthening). Ratchet-advance lane; Planning-Readiness Meta-Arc.
type: review
reviewer_model: gpt-5.4
reviewer_model_id: gpt-5-codex
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-23
verdict: ACCEPT-WITH-FOLD-INS
authored_by: gpt-5-codex
review_target: slice-60-plan-lint-retroactive-proof
target_kind: arc
target: slice-60
target_version: "HEAD=f3262452e15b79de24fbd6b957a20c286a67543a"
arc_target: planning-readiness-meta-arc
arc_version: "revision 08 / Slice 60 retroactive proof"
opening_verdict: ACCEPT-WITH-FOLD-INS
closing_verdict: "ACCEPT (all 4 findings folded at slice-60a)"
severity_counts:
  critical: 0
  high: 0
  med: 3
  low: 1
commands_run:
  - git rev-parse HEAD && git status --short
  - git show --stat --oneline --decorate --no-renames HEAD
  - read specs/reviews/arc-slice-57-codex.md frontmatter shape
  - read git diff HEAD^ HEAD scripts/plan-lint.mjs
  - read git diff HEAD^ HEAD tests/scripts/plan-lint.test.ts
  - read specs/reviews/p2-9-plan-lint-retroactive-run.md
  - read specs/reviews/p2-9-plan-draft-content-challenger.md
  - read specs/plans/planning-readiness-meta-arc.md Slice 60 threshold text
  - read specs/adrs/ADR-0010-arc-planning-readiness-gate.md rule inventory
  - read scripts/policy/workflow-kind-policy.mjs and scripts/audit.mjs ownership comments
  - cmp byte-identical p2-9 plan vs fixture
  - node scripts/plan-lint.mjs specs/plans/p2-9-second-workflow.md (22 red / 0 yellow)
  - node scripts/plan-lint.mjs specs/plans/planning-readiness-meta-arc.md (GREEN)
  - npm test -- tests/scripts/plan-lint.test.ts (44 passed)
  - scratch plan-lint probe scripts/audit.d.mts::AuditCheckResult reproduced false positive
  - npm run verify GREEN 1188 passed / 19 skipped
opened_scope:
  - scripts/plan-lint.mjs
  - tests/scripts/plan-lint.test.ts
  - tests/fixtures/plan-lint/bad/p2-9-flawed-draft.md
  - specs/plans/p2-9-second-workflow.md (untracked; byte-identical)
  - specs/reviews/p2-9-plan-lint-retroactive-run.md
  - specs/reviews/p2-9-plan-draft-content-challenger.md
  - specs/plans/planning-readiness-meta-arc.md
  - specs/adrs/ADR-0010-arc-planning-readiness-gate.md
  - scripts/policy/workflow-kind-policy.mjs
  - scripts/audit.mjs
  - scripts/audit.d.mts
skipped_scope:
  - npm run audit not rerun; Check 35 expected red until this challenger review file is committed
fold_in_status:
  MED-1: "resolved-in-slice-60a (rule #4 patterns extended for export type/interface/enum + regression tests)"
  MED-2: "resolved-in-slice-60a (ADR-0010 + meta-arc plan rule #4 prose updated to defined/owned semantics)"
  MED-3: "resolved-in-slice-60a (retroactive review prose softened: not-in-current-scope vs not-catchable)"
  LOW-1: "resolved-in-slice-60a (JSON-key support documented as opportunistic key-presence; nested-ownership left as future strengthening)"
findings:
  - id: MED-1
    severity: MED
    title: Rule #4 definition heuristic omits TypeScript type/interface/enum definitions
  - id: MED-2
    severity: MED
    title: Rule #4 semantics changed but ADR/plan rule inventories still say symbol-present
  - id: MED-3
    severity: MED
    title: Retroactive gap analysis overstates structurally-uncatchable claims
  - id: LOW-1
    severity: LOW
    title: JSON-key support is key-presence only and should be documented as partial
---

# Slice 60 — Codex Challenger Pass

## Verdict

**ACCEPT-WITH-FOLD-INS.**

The empirical proof clears the Slice 60 acceptance bar. The flawed P2.9 draft is byte-identical to the committed fixture, plan-lint emits the recorded 22 red / 0 yellow, all 6 HIGH ledger findings map to rules, and the combined ledger ratio reaches 10/13. The rule #4 re-export call is principled: `export { X }` is not an ownership definition.

Four fold-ins should land before treating the strengthened rule as generally hardened.

## Findings

### MED-1 — Rule #4 definition heuristic omits TypeScript type/interface/enum definitions

`rule4StaleSymbolCitation` requires a definition pattern at `scripts/plan-lint.mjs:490-508`, but the accepted patterns cover only `const/let/var/function/class`. The rule scans `.ts/.tsx/.mts/.cts` files, where exported `type`, `interface`, and `enum` declarations are real definitions. Scratch proof: citing `scripts/audit.d.mts::AuditCheckResult` fires stale-symbol red even though `scripts/audit.d.mts:22` defines `export type AuditCheckResult = ...`.

**Fold-in:** add definition patterns and regression tests for `export type`, `type`, `export interface`, `interface`, `export enum`, `enum`, and `export default function/class Name`. Keep `export { X }` excluded.

### MED-2 — Rule #4 semantics changed but ADR/plan rule inventories still say symbol-present

ADR-0010 still defines rule #4 as rejecting a reference where the symbol is "not present" at `specs/adrs/ADR-0010-arc-planning-readiness-gate.md:231`. The meta-arc plan repeats the same contract at `specs/plans/planning-readiness-meta-arc.md:439`. The implementation now rejects symbols that are present but not defined/owned at that file.

**Fold-in:** update ADR-0010 and the meta-arc rule table to "file missing OR symbol not defined/owned at cited location"; explicitly say re-exports/import-only appearances do not satisfy rule #4, and JSON support is key-presence only unless strengthened.

### MED-3 — Retroactive gap analysis overstates structurally-uncatchable claims

`specs/reviews/p2-9-plan-lint-retroactive-run.md:88-120` repeatedly says MED 9/10/13 are not mechanically catchable. Plan-lint already performs repo cross-checks (rule #4, rule #13, schemas, JSON vocab, runtime capability). Those rules may be too brittle to add for MED 9/10/13, but that is a scope choice, not impossibility.

**Fold-in:** rephrase to "not selected for generic plan-lint coverage in Slice 60" / "outside current durable static-anchor rule set" instead of "not mechanically catchable." Preserve the 10/13 ratio.

### LOW-1 — JSON-key support is key-presence only and should be documented as partial

The JSON branch at `scripts/plan-lint.mjs:458-472` regex-checks any `"symbol":` occurrence in the file. That is useful for citations like `specs/invariants.json::enforcement_state_semantics`, but it does not prove top-level ownership and can pass if the same key exists elsewhere in a large JSON/schema file.

**Fold-in:** document the JSON check as opportunistic key-presence only, or parse JSON and require top-level key presence. Slice 60a takes the doc-only route; nested-ownership strengthening is deferred.

## Direct Answers

1. Rule #4 is principled, not hacky, in its core ownership move. Correct call.
2. The 77% threshold does not double-count dishonestly. MED 11 and MED 12 are separate pre-existing ledger findings with the same mechanical symptom.
3. The three uncaught findings are not all literally uncatchable. They are outside the current durable rule set.
4. The retroactive-run file is honest on arithmetic, but should soften gap-analysis language.
5. JSON-key support is shallow. Document or tighten.

## Sign-off

ACCEPT-WITH-FOLD-INS. Slice 60 advances on the empirical threshold evidence, with the fold-ins required to keep rule #4's new ownership semantics and the retroactive proof language as rigorous as the gate they defend.
