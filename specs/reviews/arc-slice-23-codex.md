---
review_target: slice-23
target_kind: arc
arc_target: phase-1-close-slice-23
arc_version: 0.1
reviewer_model: GPT-5 Codex
review_kind: adversarial slice-level lint (per-slice challenger under arc-review HIGH #1 going-forward rule)
review_date: 2026-04-19
verdict: REJECT → incorporated → ACCEPT
opening_verdict: REJECT pending HIGH fold-ins
closing_verdict: ACCEPT (after Slice 23 fold-ins)
authored_by: Codex
upstream_objection_refs:
  - specs/reviews/arc-phase-1-close-codex.md#HIGH-4
  - specs/reviews/arc-phase-1-close-codex.md#MED-15
commands_run:
  - git log --oneline slice-22..HEAD
  - npm run verify
  - npm run audit
  - targeted rg over Slice 23 diff
opened_scope:
  - specs/artifacts.json (Slice 23 diff surface)
  - scripts/audit.mjs (reverse-linkage helper)
  - tests/contracts/artifact-authority.test.ts
  - specs/adrs/ADR-0003-authority-graph-gate.md addendum
  - Slice 23 commit bodies
skipped_scope:
  - unrelated contract bodies (targeted pass)
  - bootstrap/ drafts
---

# Slice 23 Codex Challenger Review

Adversarial-lint pass on Slice 23's delivery of HIGH #4 (reverse authority-graph
check) and MED #15 (ADR-0003 addendum) from the Phase 1 close arc review.
Knight-Leveson framing applies: Claude and Codex share training distribution.
Challenger produces an objection list, not approval.

## Opening verdict

REJECT pending HIGH fold-ins. Fourteen objections returned: 6 HIGH, 6 MED, 2
LOW.

## Objection list (verbatim)

1. **HIGH: `contract` can be omitted or nulled to bypass HIGH #4.**
   `contract` is not in `ARTIFACT_REQUIRED_BASE_FIELDS`, and the new check
   only runs under `if (artifact.contract)`. An artifact with missing
   `contract`, `contract: null`, or `contract: ""` skips reverse reciprocation
   entirely.
   Remediation: make `contract` structurally required, and require either a
   real path or an explicit `contract_status: pre-contract | external |
   unknown-blocking` with a reason and audit rules.

2. **HIGH: Contract frontmatter is not checked for exact reverse binding.**
   The audit verifies artifact -> contract reciprocation and contract
   `artifact_ids` -> existing artifact ids, but it does not assert that every
   id listed in a contract points back to that same contract. A contract can
   list an artifact whose `artifact.contract` points elsewhere, and the graph
   can still pass if the artifact's chosen contract also lists it.
   Remediation: for each `specs/contracts/<x>.md`, assert
   `frontmatter.artifact_ids` exactly equals the set of artifact ids whose
   `contract === "specs/contracts/<x>.md"`.

3. **HIGH: The schema ledger does not actually cover `src/schemas/index.ts`.**
   Slice 22 scheduled a "schema-export coverage ledger test for
   `src/schemas/index.ts`," but Slice 23 explicitly excludes `index.ts` from
   the scan. A new schema file can be bound or allowlisted while missing from
   the public barrel export, and the ledger remains green.
   Remediation: parse `src/schemas/index.ts` and require one
   `export * from './<file>.js'` for every direct schema file that should be
   public, plus no stale exports to deleted files.

4. **HIGH: File-level allowlisting creates a blind spot for new exports.**
   `SCHEMA_FILE_ALLOWLIST` exempts entire files like `gate.ts`, `snapshot.ts`,
   `lane.ts`, and `event.ts`. The audit only checks unclaimed exports for
   artifact-bound files, so any new `export const` added to an allowlisted
   file is invisible. This is the same omitted-artifact class, just inside an
   already-exempt file.
   Remediation: make the allowlist symbol-level, not file-level: every export
   in an allowlisted file must be individually categorized as
   `shared-primitive`, `embedded-by:<artifact>`, or `pending-artifact`.

5. **HIGH: The named config miss is still laundered as `adapter.registry`.**
   Adding `CircuitOverride` to `adapter.registry.schema_exports` makes the
   ledger greener while preserving the known wrong ownership until Slice 26.
   There is no machine-visible "pending rehome" marker for `Config`,
   `ConfigLayer`, `LayeredConfig`, or `CircuitOverride`. If Slice 26 slips,
   audit has no remaining objection.
   Remediation: add `pending_rehome` metadata with `target_slice: 26` and
   `target_artifact_prefix: config.*`, or introduce a temporary
   `known_misbinding` ledger that fails once the due slice is reached.

6. **HIGH: Export discovery is too narrow for an authority ledger.**
   `collectSchemaExports` only sees `export const <Name>`. It misses
   `export type`, `export interface`, `export class`, `export function`,
   `export default`, and re-exports. Current real examples include exported
   type-only surfaces like `JsonObject` and `AppliedEntry` in
   `selection-policy.ts`, which are public API but outside the ledger.
   Remediation: use the TypeScript compiler API to enumerate exports, then
   classify each export as `zod_schema`, `type_alias`, `runtime_constant`,
   `helper`, or `reexport`; require explicit ledger treatment for each public
   surface.

7. **MED: Runtime constants and schemas are conflated.**
   Because every `export const` in a bound schema file must be claimed,
   constants like `CANONICAL_PHASES`, `RESERVED_ADAPTER_NAMES`, and
   `SELECTION_PRECEDENCE` are treated the same as schemas. That prevents some
   omissions, but it also pressures authors to stuff non-schema constants
   into `schema_exports` just to satisfy the ledger.
   Remediation: rename the field or split it into `schema_exports` and
   `supporting_runtime_exports`; require each claimed export to declare why
   it is artifact-authoritative.

8. **MED: `_` prefix is an unaudited bypass.**
   Any `_`-prefixed export is ignored, and the convention appears documented
   only in this helper/comment plus the new ADR text. A real exported schema
   named `_InternalPolicy` would silently escape the authority graph.
   Remediation: replace the broad prefix exemption with an exact allowlist or
   strict pattern like `_compileTime.*Parity`, and add a test that any `_`
   export outside that pattern fails.

9. **MED: `pending-artifact` has no expiry or ADR coupling.**
   `event.ts` is `pending-artifact`, but the type only requires
   `{ category, reason }`, and tests only require a non-empty reason. Nothing
   prevents a future pending entry from becoming permanent prose debt.
   Remediation: require `tracking_slice`, `review_objection`, `expires_before`,
   and `adr_or_review_ref`; audit should fail expired pending entries.

10. **MED: ADR Addendum A is partly non-operational.**
    The schema-file and export checks are machine-enforced, but "runtime
    writer/reader surfaces without an artifact id" remains prose-level in
    ADR-0003. There is no acceptance evidence shape for manually recognizing
    that trigger before Slice 30.
    Remediation: define a temporary commit-body checklist now, and define
    Slice 30's exact machine target: a runtime-surface inventory plus audit
    rules mapping backing paths, writer functions, reader functions, and
    event payloads to artifact ids.

11. **MED: Audit can pass against unstaged fixes while the commit is broken.**
    `scripts/audit.mjs` reads the working tree directly. In concurrent
    authorship or partial staging, a reciprocal contract fix can exist
    unstaged, `npm run audit` passes, and the staged commit can still
    contain only the broken half.
    Remediation: add `npm run audit -- --staged` using a temporary index
    tree, or require a clean worktree before commit. CI should run the same
    authority graph checks on the committed tree.

12. **MED: Slice 22 fold-ins were incomplete.**
    Spot-check: `phase.md` looks corrected around phase-level selection, but
    `workflow.md` still says `selection.md, future` at line 84 and says
    prose-yaml parity is future at line 93. Behavioral docs also still say
    tests are "not yet authored" or v0.2-future despite Slice 22 claiming
    MED #12 was folded in, for example `session-hygiene.md` line 121 and
    `cross-model-challenger.md` line 131.
    Remediation: run a targeted stale-state sweep for `future`, `not yet
    authored`, and `land tests` in the four contracts plus three behavioral
    tracks; add a ratchet for known-obsolete phrases.

13. **LOW: Helper API is permissive and parser-shaped, not YAML-shaped.**
    `readFrontmatter` silently ignores malformed frontmatter lines and
    returns `Record<string, unknown>`; `contractReciprocatesArtifact` only
    checks `Array.isArray` plus `includes`. Empty `artifact_ids: []` correctly
    returns false, but duplicate ids, non-string ids, and malformed YAML are
    not distinguished.
    Remediation: validate parsed frontmatter with a small schema:
    `artifact_ids: nonempty unique string[]`; report duplicate, malformed,
    and missing as separate errors.

14. **LOW: Trajectory check is not yet a real gate.**
    The CLAUDE.md addendum is a ritual with "no new artifact," and audit
    still checks only the framing triplet. A slice can say "no earlier slice
    obsoletes this" while ignoring that an earlier slice changed the target.
    Remediation: add an audit check for `Trajectory check:` in
    Ratchet-Advance commit bodies, and require at least one concrete
    dependency citation to the arc disposition table or PROJECT_STATE.

**Cross-model correlated-miss meta-check:** the single thing most likely
missed by both of us is the file-level allowlist blind spot. It looks
disciplined because every exempt file has a reason, but it quietly converts
whole schema modules into export black boxes. That is exactly the shape of
the original config miss, only one level deeper.

## Operator disposition (CHALLENGER-I4, per-objection)

Applied within Slice 23. Each objection disposed to one of: **incorporated
this slice** / **scoped v0.2** / **scoped elsewhere**. No rejections.

| # | Severity | Disposition | Where landed / tracked |
|---|---|---|---|
| 1 | HIGH | **Incorporated** | `scripts/audit.mjs` ARTIFACT_REQUIRED_BASE_FIELDS + explicit non-empty-string check + test `specs/artifacts.json — contract field discipline` |
| 2 | HIGH | **Incorporated** | `scripts/audit.mjs` contract-file loop: per-id contract-match + symmetric "artifact points here → id listed" check; test `every id in a contract artifact_ids maps back...` + `every artifact whose contract points at a contract file appears...` |
| 3 | HIGH | **Incorporated** | `scripts/audit.mjs` barrel-export check + test `src/schemas/index.ts — barrel export coverage (Codex HIGH #3)` (2 assertions) |
| 4 | HIGH | **Incorporated** | `SCHEMA_FILE_ALLOWLIST` entries gain `known_exports` list; symbol-level coverage runs on allowlisted files; test `every allowlisted file defines exactly the exports its entry lists` |
| 5 | HIGH | **Incorporated** | `adapter.registry.pending_rehome` block + audit validation + test `specs/artifacts.json — pending_rehome discipline` (4 assertions + 1 pinned-instance) |
| 6 | HIGH | **Incorporated (regex-level)**; Full TS AST **scoped v0.2** | `schemaExportPresent` + `collectSchemaExports` regex broadened to `export (const\|type\|function\|class)`. TS compiler API tracked v0.2 |
| 7 | MED | **Scoped v0.2** | Separate `supporting_runtime_exports` field is organizational; current conflation catches correctness. Document in v0.2 scope. |
| 8 | MED | **Incorporated** | `COMPILE_TIME_GUARD_PATTERN` exported + strict match `/^_compileTime[A-Z]\w*Parity$/`; test `INCLUDES '_'-prefixed names that do not match the guard pattern` |
| 9 | MED | **Incorporated** | `tracking_slice` + `tracking_objection` required on pending-artifact entries; audit rejects missing; test `every pending-artifact entry has tracking_slice and tracking_objection` |
| 10 | MED | **Incorporated (checklist)**; machine enforcement **scoped Slice 30** | ADR-0003 Addendum A "Manual recognition checklist (v0.1, pre-Slice-30)" subsection — 5-item checklist with explicit retirement trigger at Slice 30 |
| 11 | MED | **Scoped v0.2** (mitigation: require clean worktree; CI mitigation tracked) | `npm run audit -- --staged` mode is a non-trivial refactor; CI-level audit against committed tree is the primary mitigation. Document in v0.2 scope. |
| 12 | MED | **Incorporated** | Fixed stale drift at `specs/contracts/workflow.md:86` (removed `, future`), `specs/behavioral/session-hygiene.md:123` (landed Slice 14), `specs/behavioral/cross-model-challenger.md:133` (landed Slice 16). Stale-state ratchet tracked v0.2 |
| 13 | LOW | **Scoped v0.2** | Schema-validating `readFrontmatter` is a loose → tight transition; v0.1 behavior is defensive. Document. |
| 14 | LOW | **Scoped Slice 28** | Trajectory-check audit dimension fits the Slice 28 audit-fold-ins pass (MED #13 audit count fix + MED #14 canary rename). Tracking ref in PROJECT_STATE.md Slice 28 schedule |

**Meta-check accepted.** The file-level → symbol-level allowlist transition
closes the named concern. `known_exports` is required on every entry and
validated against actual `collectSchemaExports` output.

## Closing verdict

ACCEPT. Six HIGH + four MED + zero LOW were folded into Slice 23; two MED +
two LOW were scoped forward per CHALLENGER-I4. The machine-checked invariants
pinned by this slice now include reverse reciprocation, exact contract-artifact
set equality, barrel-export coverage, symbol-level allowlist, pending_rehome
metadata, and broadened export discovery. Pending-artifact entries require
tracking citations; `_`-prefix bypasses are blocked to a strict pattern.

Test count 445 → 482 (+37 over Slice 22 baseline). Audit 10 green / 0 yellow /
0 red.

Slice 23 is accepted as the first per-slice Codex pass under the HIGH #1
going-forward rule from the arc review (per-slice challenger for any
Ratchet-Advance slice pinning machine-checked invariants).
