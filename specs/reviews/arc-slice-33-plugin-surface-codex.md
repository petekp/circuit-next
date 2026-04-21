---
name: arc-slice-33-plugin-surface-codex
description: Codex challenger objections on slice 33 (plan name P2.2) — plugin command surface scaffold. Adversarial lint per CLAUDE.md §Cross-model challenger protocol.
type: review
reviewer_model: gpt-5-codex
reviewer_model_id: gpt-5-codex
authorship_role: challenger
review_kind: challenger
review_date: 2026-04-21
verdict: REJECT PENDING FOLD-INS → incorporated → ACCEPT-WITH-FOLD-INS
authored_by: gpt-5-codex + claude-opus-4-7
target_kind: arc
target: slice-33
target_version: "2026-04-21 as-staged pre-ceremony"
review_target: arc-slice-33-plugin-surface-scaffold
arc_target: slice-33
arc_version: c51aa1b..HEAD (Slice 33 working tree, pre-commit)
opening_verdict: REJECT PENDING FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
severity_counts:
  HIGH: 3
  MED: 4
  LOW: 0
  META: 1
commands_run:
  - read .claude-plugin/plugin.json (slice-33 manifest shape)
  - read .claude-plugin/commands/circuit-run.md (router placeholder)
  - read .claude-plugin/commands/circuit-explore.md (target workflow placeholder)
  - read scripts/audit.mjs checkPluginCommandClosure (Check 23 implementation)
  - read tests/contracts/plugin-surface.test.ts (contract-test fixture coverage)
  - read scripts/audit.d.mts (new export declarations)
  - read specs/adrs/ADR-0007-phase-2-close-criteria.md §Decision.1 CC#P2-3 (binding source)
  - read specs/plans/phase-2-implementation.md §P2.2 (slice framing)
opened_scope:
  - .claude-plugin/plugin.json
  - .claude-plugin/commands/circuit-run.md
  - .claude-plugin/commands/circuit-explore.md
  - scripts/audit.mjs
  - scripts/audit.d.mts
  - tests/contracts/plugin-surface.test.ts
  - specs/adrs/ADR-0007-phase-2-close-criteria.md
  - specs/plans/phase-2-implementation.md
skipped_scope:
  - src/schemas/* (no runtime-shape changes in slice-33; plugin-manifest schema deferred to a future src/ file or inline in tests)
  - specs/contracts/* (slice-33 is a plugin-surface scaffold, not a contract authorship slice)
fold_in_disposition: all HIGH + MED + META folded into slice-33 working tree via tightened `checkPluginCommandClosure` (anchor-to-file binding, grammar strictness, symlink rejection, YAML-aware empty detection, recursive orphan walk) and expanded contract tests; LOW is vacuous (none raised). Fold-in detail in ADR/slice-body appendix below; closing verdict ACCEPT-WITH-FOLD-INS.
---

# Codex challenger objection list — slice P2.2

## Opening verdict: REJECT PENDING FOLD-INS

## Objections

### 1. HIGH — Required anchors are presence-checked, not identity-bound to their files

`checkPluginCommandClosure` only adds `commands[].name` values to `manifestNames` and later checks that `circuit:run` and `circuit:explore` are present (`scripts/audit.mjs:2455-2469`, `scripts/audit.mjs:2532-2539`). It never compares the manifest name to the command file's frontmatter `name`, and it never binds each anchor to its canonical file. A manifest with `circuit:run` pointing at `commands/circuit-explore.md` and `circuit:explore` pointing at `commands/circuit-run.md` returns green as long as both files exist and have non-empty frontmatter. That is a silent-rename loophole: ADR-0007 binds one router command and one target-workflow command, but the ratchet can be satisfied by swapped wiring.

**Remediation:** Require `frontmatter.name === entry.name`, require unique command names and files, and pin the two P2.2 anchors to their canonical paths: `circuit:run -> commands/circuit-run.md` and `circuit:explore -> commands/circuit-explore.md`. Add a red fixture where the two anchor files are swapped.

### 2. HIGH — Manifest entries can point outside `.claude-plugin/commands/*.md`

ADR-0007 says manifest entries correspond to existing `.claude-plugin/commands/*.md` files (`specs/adrs/ADR-0007-phase-2-close-criteria.md:163-173`), and the P2.2 plan says the audit checks closure with `.claude-plugin/commands/*.md` filenames (`specs/plans/phase-2-implementation.md:202-207`). The implementation only rejects absolute paths and `..` substrings, then joins the path under `.claude-plugin/` (`scripts/audit.mjs:2480-2495`). A manifest whose anchors point to `elsewhere/circuit-run.md` and `elsewhere/circuit-explore.md` under `.claude-plugin/` returns green, and the success message still claims closure with `.claude-plugin/commands/*.md`. That weakens the command-surface ratchet from "commands directory closure" to "any frontmatter-bearing file under the plugin directory."

**Remediation:** Reject every `commands[].file` that does not match `commands/<basename>.md` with no nested or alternate directory unless the ADR explicitly broadens the command-file grammar. Add a red fixture for `file: "elsewhere/circuit-run.md"` and for non-`.md` files.

### 3. HIGH — Symlink traversal defeats the no-path-escape invariant

The path check is lexical, but the file read follows symlinks (`scripts/audit.mjs:2480-2496`). A file named `.claude-plugin/commands/circuit-run.md` can be a symlink to a markdown file outside `.claude-plugin/`, and the check still returns green because `existsSync` and `readFileSync` resolve the symlink target. The audit file already imports `lstatSync` and `readlinkSync` (`scripts/audit.mjs:15`), but this check does not use them. The user-facing requirement says "no path escape"; symlink escape is still path escape.

**Remediation:** For each manifest file and each discovered command file, `lstatSync` the path and reject symlinks outright, or resolve realpaths and require the real target to remain under `.claude-plugin/commands/`. Add red fixtures for symlink-to-outside and symlink-to-plugin-but-outside-commands.

### 4. MED — Orphan detection is shallow and misses nested command files

The orphan scan uses `readdirSync(commandsDir).filter((f) => f.endsWith('.md'))` (`scripts/audit.mjs:2519-2529`), so it only examines immediate children of `.claude-plugin/commands/`. A future `.claude-plugin/commands/experimental/review.md` or `.claude-plugin/commands/nested/circuit-review.md` is invisible unless a manifest entry points at it. If nested command files are unsupported, the audit should reject nested directories; if nested command files are supported, the audit should walk recursively. Today it does neither.

**Remediation:** Decide the grammar. For flat-only command surfaces, fail when `.claude-plugin/commands/` contains a directory or non-manifest `.md` at any depth. For recursive command surfaces, walk `commands/**/*.md` and compare normalized relative paths against `commands[].file`.

### 5. MED — Frontmatter validation is regex-shaped, not YAML-shaped

The check treats any non-empty regex capture as a non-empty YAML value (`scripts/audit.mjs:2495-2516`). That accepts `name: ""` and `description: ""` as non-empty because the captured string contains quote characters, even though the YAML values are empty strings. It also accepts YAML syntax markers such as `description: >` without checking the folded value. This is a false-green risk for the exact fields ADR-0007 requires to be non-empty (`specs/adrs/ADR-0007-phase-2-close-criteria.md:167-170`).

**Remediation:** Parse frontmatter with a YAML parser or a deliberately tiny frontmatter parser that handles quoted scalars, comments, folded scalars, and empty values. Add red fixtures for `name: ""`, `description: ""`, `name: # comment`, and empty folded scalars.

### 6. MED — The contract tests mirror the helper instead of the plugin-manifest schema

ADR-0007's non-substitutable binding says `tests/contracts/plugin-surface.test.ts` parses `.claude-plugin/plugin.json` with the plugin-manifest schema and asserts the workflow command is registered (`specs/adrs/ADR-0007-phase-2-close-criteria.md:174-182`). The new test imports only `checkPluginCommandClosure` (`tests/contracts/plugin-surface.test.ts:6`) and then asserts helper outputs over handwritten JSON fixtures. That catches the helper's current behavior, but it does not validate against any independent manifest schema and therefore does not catch helper/schema disagreement. It also lacks red fixtures for the concrete bypasses above: swapped anchor files, files outside `commands/`, symlink escapes, nested orphans, duplicate command names/files, and YAML-empty frontmatter values.

**Remediation:** Introduce or import a plugin-manifest schema for `plugin.json`, run the live manifest through it, and keep `checkPluginCommandClosure` tests as additional ratchet tests. Add negative tests for every bypass named in this review.

### 7. MED — The test-count ratchet is not pinned to the P2.2 addition

The slice adds 13 runtime tests, but `specs/ratchet-floor.json` still pins `contract_test_count` at 574 from Slice 26b (`specs/ratchet-floor.json:3-8`). In this checkout, `npm run audit` reports the static contract-test ratchet as `701 tests at HEAD (HEAD~1: 701, Δ +0)` because `countTests` only reads git-tracked test files (`scripts/audit.mjs:409-435`) and the new test file is not tracked yet. After ceremony, the moving-window delta may show the +13 once, but the pinned floor will still allow later deletion to slide out of the window. That is the exact moving-window hole the pinned floor was introduced to close.

**Remediation:** Ensure `tests/contracts/plugin-surface.test.ts` is in the landing commit, then either advance `specs/ratchet-floor.json` to the new static floor as part of this Ratchet-Advance slice or explicitly document why the P2.2 test addition is not eligible to advance the pinned floor. Do not claim the +13 as a durable ratchet while the pinned floor remains at 574.

### 8. META — This reviewer could not independently reproduce full verify green in the sandbox

The targeted P2.2 test file passes, `npm run check` passes, `biome check` passes on the touched surfaces, and `checkPluginCommandClosure()` returns green on the live repo. However, `npm run audit` and the full `npm run test` were red in this sandbox because the pre-existing `tests/runner/dogfood-smoke.test.ts` CLI subprocess invokes `node_modules/.bin/tsx`, which fails here with `listen EPERM` on the tsx IPC pipe under `/var/folders/.../T/tsx-501/*.pipe`. That appears environmental and not caused by P2.2, but it means this review cannot be cited as independent full-verify-green evidence.

**Remediation:** Run `npm run audit` and `npm run verify` in the operator environment before ceremony, and include the exact green results in the landing evidence. The commit body still needs the Phase 2 protected-path posture string: `Isolation: policy-compliant (no implementer separation required)`, plus citations to ADR-0007 CC#P2-3 and `specs/plans/phase-2-implementation.md §P2.2`.
