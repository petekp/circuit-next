---
review_target: ADR-0009 / Slice 41 (adapter invocation pattern — subprocess-per-adapter for v0)
target_kind: arc
arc_target: slice-41-adapter-invocation-pattern-adr-0009
arc_version: Slice 41
reviewer_model: gpt-5-codex
review_kind: arc-review
review_date: 2026-04-21
authored_by: challenger
verdict: ACCEPT-WITH-FOLD-INS
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT-WITH-FOLD-INS
commands_run:
  - sed -n / nl -ba / rg reads over specs/adrs/ADR-0009-adapter-invocation-pattern.md, specs/contracts/adapter.md, specs/adrs/ADR-0007-phase-2-close-criteria.md, scripts/audit.mjs, scripts/audit.d.mts, tests/contracts/adapter-invocation-discipline.test.ts, specs/ratchet-floor.json, specs/plans/phase-2-implementation.md, PROJECT_STATE.md, CLAUDE.md
  - rg / git searches for FORBIDDEN_ADAPTER_SDK_DEPS, PACKAGE_JSON_DEP_FIELDS, subprocess-per-adapter, agent, codex, @anthropic-ai/sdk, ai, @ai-sdk, @langchain, same-process, in-process
  - git diff --cached --name-status / git status (staging state inspection for HIGH 3)
  - npx vitest run tests/contracts/adapter-invocation-discipline.test.ts (6/6 pass against pre-fold-in implementation)
  - node --check scripts/audit.mjs (parse-OK after Check 28 addition)
  - npm run check (pass) / npm run lint (sandbox limitations noted in META)
opened_scope:
  - specs/adrs/ADR-0009-adapter-invocation-pattern.md
  - specs/contracts/adapter.md (ADAPTER-I1 agent-semantics bullet)
  - specs/adrs/ADR-0007-phase-2-close-criteria.md (CC#P2-2 block)
  - scripts/audit.mjs (Check 28 checkAdapterInvocationDiscipline + FORBIDDEN_ADAPTER_SDK_DEPS + PACKAGE_JSON_DEP_FIELDS)
  - scripts/audit.d.mts (Check 28 type declarations)
  - tests/contracts/adapter-invocation-discipline.test.ts (6 pre-fold-in tests)
  - specs/ratchet-floor.json
  - tests/contracts/status-epoch-ratchet-floor.test.ts
  - specs/plans/phase-2-implementation.md §P2.4 (Alternate framing + invocation-pattern authority subsection)
  - PROJECT_STATE.md / README.md / TIER.md (current_slice=41 markers + Slice 41 block)
  - specs/reviews/adversarial-yield-ledger.md (Slice 41 row with tbd counts pending this pass)
  - CLAUDE.md (Hard invariants #5 / #6; §Cross-model challenger protocol)
  - package.json (dep-field shape for Check 28)
  - src/schemas/adapter.ts (ResolvedAdapter + CustomAdapterDescriptor schema surface)
  - src/schemas/event.ts (dispatch transcript variants per ADR-0009 §2.ii)
  - specs/reviews/arc-slice-38-dispatch-granularity-adr-0008-codex.md (frontmatter shape + non-precedent template)
skipped_scope:
  - src/runtime/adapters/** — does not exist at Slice 41 (adapter code lands at Slice 42 / P2.4)
  - ~/Code/circuit reference implementation — Slice 41 does not claim reference-artifact parity; reference citation is prose-level
  - specs/adrs/ADR-0001, ADR-0003, ADR-0004, ADR-0005, ADR-0006 — not touched by Slice 41
---

## §Opening verdict

**REJECT-PENDING-FOLD-INS.** The ADR's subprocess-per-adapter direction is structurally right given the operator product constraint and the four grounds, but the pre-fold-in slice state has (1) authority-surface contradictions (adapter.md + ADR-0007 still say "same-process" / "in-process Anthropic subagent"), (2) a Check 28 bypass hole (wrapper/provider SDKs like `ai`, `@ai-sdk/*`, `@langchain/*` route in-process without tripping the eight-identifier list), (3) incomplete commit staging (only the test file is staged; ADR + audit + plan + floor + status docs are unstaged), and (4) an unproven CLI no-write capability boundary that is load-bearing for the Slice 40 HIGH 3 constraint.

## §HIGH objections (4)

### HIGH 1 — Authority surfaces still contradict the subprocess decision.

**Claim challenged.** ADR-0009 says all v0 built-ins invoke by subprocess at `specs/adrs/ADR-0009-adapter-invocation-pattern.md:115`, but `specs/contracts/adapter.md:75` still defines `agent` as the Claude Code **Agent tool** ("Same-process") and `specs/adrs/ADR-0007-phase-2-close-criteria.md:120` still says "`agent` in-process Anthropic subagent or `codex` cross-process." ADR-0009 §Context also claims this is just a widening (`specs/adrs/ADR-0009-adapter-invocation-pattern.md:92`), but the amendment *changes explicit prior semantics*.

**Why false / load-bearing.** P2.4 readers receive three incompatible instructions for how to implement `agent`: same-process Agent tool (adapter.md), in-process Anthropic subagent (ADR-0007), or `claude` CLI subprocess (ADR-0009). Without inline amendment blocks to adapter.md and ADR-0007, the three surfaces drift — and the ADR-0007 §6 applicability analysis is reading the change as a pure widening when it is actually a narrowing-with-semantic-amendment.

**Concrete fix.** (1) Amend `specs/contracts/adapter.md` ADAPTER-I1 agent-bullet inline, replacing "same-process" / "Claude Code Agent tool" with "subprocess `claude -p`" + ADR-0009 §1 citation. (2) Amend ADR-0007 CC#P2-2 inline, replacing "`agent` in-process Anthropic subagent or `codex` cross-process" with "`agent` as headless `claude` CLI subprocess (per ADR-0009 §1) or `codex` as `codex exec` subprocess" + ADR-0009 amendment disclosure. (3) Rewrite ADR-0009 §Context §6 applicability to acknowledge this as a narrowing-with-semantic-amendment (not pure widening): §6.4 substitute = partial (prior semantics substituted inline); §6.7 disclosure = §What-changes covers the three amended surfaces.

### HIGH 2 — Check 28 can be bypassed by wrapper/provider SDK packages.

**Claim challenged.** ADR-0009 says the eight identifiers are "currently known to circumvent" the decision (`specs/adrs/ADR-0009-adapter-invocation-pattern.md:385`) and that future slices cannot silently add a forbidden dep (`:554`). `scripts/audit.mjs:3506` exact-matches only the eight direct-vendor names.

**Why false / load-bearing.** A future slice can add a provider-wrapper SDK — `ai` (Vercel AI SDK), `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`, `@langchain/anthropic`, `@langchain/openai`, `@langchain/google-genai` — and route built-in adapters through in-process SDK-style APIs without tripping Check 28. The guard also scans only root `package.json` fields, not lockfile packages or workspace manifests.

**Concrete fix.** (1) Expand `FORBIDDEN_ADAPTER_SDK_DEPS` to include wrapper/provider SDKs as a named Part B extension to the pre-fold-in Part A list. (2) Document the scope limitation explicitly in ADR-0009 §4 — the check is root-`package.json`-only; lockfile and workspace scanning are out of scope at v0. (3) Promote the Slice 42 import-level scan over `src/runtime/adapters/**` from "MAY add" to **mandatory at Slice 42** — it is the complement to the dep-level check and closes the transitive-install bypass.

### HIGH 3 — The pre-commit staging state does not represent Slice 41.

**Claim challenged.** Slice 41 says it lands ADR, audit, docs, floor, and tests (`specs/adrs/ADR-0009-adapter-invocation-pattern.md:486`). Same-commit staging discipline is the relevant governance pattern at `CLAUDE.md:215` (ratchet + docs + test advanced in one commit so the audit sees them simultaneously).

**Why false / load-bearing.** `git diff --cached --name-status` shows only `tests/contracts/adapter-invocation-discipline.test.ts` staged. The ADR is untracked; `scripts/audit.mjs`, `scripts/audit.d.mts`, plan amendment, `specs/ratchet-floor.json`, `PROJECT_STATE.md`, `README.md`, `TIER.md`, `specs/reviews/adversarial-yield-ledger.md`, `specs/reviews/arc-slice-41-adapter-invocation-pattern-codex.md`, and `tests/contracts/status-epoch-ratchet-floor.test.ts` changes are all unstaged. A commit in this state would land the test file in isolation, importing functions that do not exist in HEAD — immediate red.

**Concrete fix.** Stage the complete coherent Slice 41 payload after fold-ins: ADR, audit implementation + types, the test file, plan amendment, ratchet floor, live status-epoch pin, status docs (PROJECT_STATE + README + TIER), yield ledger, and this review record. Do not land the test alone.

### HIGH 4 — The subprocess decision depends on an unproven no-write capability boundary.

**Claim challenged.** ADR-0009 defines subprocess mechanics at `specs/adrs/ADR-0009-adapter-invocation-pattern.md:132`, while the plan requires "no repo-write tool capability" at `specs/plans/phase-2-implementation.md:273` and `:281` (Slice 40 HIGH 3 constraint).

**Why unsupported.** The ADR never proves or records that `claude -p` can be invoked headlessly with per-invocation tool restrictions strong enough to satisfy the Slice 40 capability boundary. If CLI print mode inherits write-capable Claude Code tools unconditionally, the subprocess choice can violate P2.4's core safety constraint, and SDK/B2 may become materially safer.

**Concrete fix.** (1) Add a §2 ground (numbered 2.v) that explicitly surfaces the capability-boundary deferral: the subprocess decision is conditional on the P2.4 acceptance-evidence proof that `claude -p` can enforce the no-write boundary. (2) Add a §6 reopen trigger: if the CLI cannot enforce the no-write boundary, ADR-0009 reopens BEFORE P2.4 can land against the subprocess choice. (3) Amend `specs/plans/phase-2-implementation.md §P2.4` acceptance evidence to require the proof artifact (either a documented `--allowed-tools`-style flag or a demonstrable subprocess-level mechanism) in the P2.4 Codex challenger review file.

## §MED objections (6)

### MED 1 — §2.ii overstates the transcript-schema argument.

**Claim challenged.** `specs/adrs/ADR-0009-adapter-invocation-pattern.md:167` says SDK invocation "would force a schema-widening slice." A minimal SDK path could still hash a final response into `dispatch.result`; SDK-specific streaming/tool/caching metadata only forces widening if the project *chooses* to preserve it.

**Concrete fix.** Reword to acknowledge the collapsing path: "SDK would either collapse SDK-specific metadata into the current transcript or require schema widening if those semantics become load-bearing." The collapsed shape is byte-equivalent to subprocess stdout; the SDK then buys nothing at v0. Option A reopen trigger #2 already names the load-bearing-capability forcing function.

### MED 2 — Check 28 tests do not pin the claimed dep-field and forbidden-list surface.

**Claim challenged.** Tests claim coverage of four dep fields at `tests/contracts/adapter-invocation-discipline.test.ts:15`; implementation scans `peerDependencies` at `scripts/audit.mjs:3517`. But tests cover `dependencies`, `devDependencies`, and `optionalDependencies` only — not `peerDependencies`. Structural invariant only requires a non-empty list (`:95`); removing five of eight entries would still pass.

**Concrete fix.** (1) Add a `peerDependencies` negative test. (2) Add a set-equality test pinning the exact forbidden identifiers from ADR-0009 §4 — any add/remove without ADR-0009 reopen trips the test.

### MED 3 — `.claude/skills/codex/` is not a tracked repo authority.

**Claim challenged.** ADR references `.claude/skills/codex/` at `:13`, `:53`, and `:573`. The repo has tracked `.claude-plugin/**`, but no tracked `.claude/skills/codex/`; the current `.claude/` is untracked local state. The actual tracked authority for `/codex` is `CLAUDE.md:173-179` and behavioral docs/tests.

**Concrete fix.** Replace the `.claude/skills/codex/` citations with `CLAUDE.md:173-179` §Cross-model challenger protocol + the 32+ `specs/reviews/*-codex.md` records that exercise the `codex exec` subprocess pattern.

### MED 4 — §6 reopen conditions miss direct operational breakages of the chosen CLI path.

**Claim challenged.** ADR reopen list at `:446` has four triggers but omits: (a) CLI headless-mode removal; (b) auth/session incompatibility with the CLI path; (c) inability to disable write tools; (d) discovery of wrapper/transitive SDK bypasses (closely related to HIGH 2). These should reopen this ADR even if Options A / B2 / C / D are not otherwise triggered.

**Concrete fix.** Add three new reopen triggers: (5) CLI contract failure — headless mode cannot enforce no-write capability boundary; (6) forbidden-dep bypass discovery — new wrapper SDK identifier not in the current forbidden list; (7) auth/session incompatibility with the parent-session inheritance assumption.

### MED 5 — Option A trigger #4 is too broad.

**Claim challenged.** `:249` says if `@anthropic-ai/sdk` is already present for unrelated work, the SDK-path cost/benefit "inverts." Dependency presence alone does not solve the strongest ADR objections: auth path, billing path, transcript semantics, and adapter uniformity.

**Concrete fix.** Tighten the trigger from "transitive-dep presence" to "an already-accepted Anthropic SDK runtime path with the same auth/billing/transcript assumptions." Block the accidental-reopen path where a new library carries `@anthropic-ai/sdk` transitively without any deliberate SDK runtime integration.

### MED 6 — ADR status/provenance is premature.

**Claim challenged.** Frontmatter says `status: Accepted` at `:4` while author says "objections pending" at `:6` and the required review file is listed as a future change at `:541`. A governance ratchet should not read Accepted before the required challenger objections are folded or dispositioned.

**Concrete fix.** Either (a) mark status as `Draft/Pending` until fold-ins land, or (b) update provenance after this pass and commit the review record with final dispositions in the same commit. Precedent: Slice 38 updated the ADR-0008 author line to name Codex + fold-in state post-fold-in.

## §LOW objections (3)

### LOW 1 — "Forbidden-SDK allowlist" is backwards terminology.

`specs/adrs/ADR-0009-adapter-invocation-pattern.md:369` calls the forbidden set an *allowlist*. Use "denylist," "blocklist," or "forbidden list." The constant name `FORBIDDEN_ADAPTER_SDK_DEPS` is correct; the prose around it is not.

### LOW 2 — `@anthropic-ai/tokenizer` rationale is under-explained.

It is not an invocation SDK by itself (`scripts/audit.mjs:3508`). If it is banned for vendor dep-surface growth parity with the full SDK, say that explicitly; otherwise it looks misclassified relative to the "subprocess-per-adapter" framing. The fold-in adds a per-entry rationale bullet in §4.

### LOW 3 — Option C pooling assumes a reusable print-mode process.

`:315` describes long-lived `claude -p` pipes. Add a caveat that pooling requires a stable multi-request CLI protocol; otherwise pooling is a different option (build a multi-request protocol first), not a pure performance optimization over v0.

## §Meta objections

1. **Tense drift in the ADR narrative.** The pre-fold-in ADR mixed "status: Accepted," author "objections pending," and Slice 41-ceremony-commit framing — all in the same document before the fold-in had landed. Fixed by MED 6 fold-in (status/provenance post-fold-in refresh).
2. **Verification scope.** The new 6-test contract file passes 6/6 locally. Full `npm test` and `node scripts/audit.mjs` were not confirmed green in the sandbox pre-fold-in because (a) a pre-existing `tsx` CLI smoke test fails with `listen EPERM` on temp IPC pipes in restricted sandboxes, and (b) the Status-docs-current audit check correctly reports red until the Slice 41 commit lands. Neither counts as Slice 41 evidence either way.

## §Scope I did not open this pass

- `src/runtime/adapters/**` — not yet written at Slice 41; adapter code is a Slice 42 deliverable.
- `~/Code/circuit` reference implementation — Slice 41 does not claim reference parity; references to it are prose-level at ADR §Provenance.
- Other Phase 2 ADRs (0001/0003/0004/0005/0006) — not touched by Slice 41.

## §Recommended fold-ins (author-side disposition matrix)

| # | Class | Disposition (at fold-in commit) |
|---|---|---|
| HIGH 1 | authority-surface amendment | Fold into adapter.md ADAPTER-I1 + ADR-0007 CC#P2-2 + ADR-0009 §Context §6 applicability rewrite. |
| HIGH 2 | forbidden-list bypass + scope | Expand FORBIDDEN_ADAPTER_SDK_DEPS with wrapper SDKs (Part B). Document root-package.json scope + mandatory Slice 42 import scan. |
| HIGH 3 | staging discipline | Stage complete payload at ceremony commit. |
| HIGH 4 | CLI no-write proof | Add §2.v ground + §6 reopen trigger 5 + P2.4 acceptance evidence amendment. |
| MED 1 | transcript rationale reword | Inline §2.ii reword. |
| MED 2 | test coverage | Add peerDependencies negative + set-equality tests. |
| MED 3 | `.claude/skills/codex/` citations | Replace with CLAUDE.md:173-179 + specs/reviews/*-codex.md authorities. |
| MED 4 | reopen-trigger completeness | Add triggers 5 / 6 / 7. |
| MED 5 | Option A trigger #4 | Tighten to "accepted SDK runtime path," not "transitive dep presence." |
| MED 6 | ADR status/provenance | Update frontmatter to "Accepted (post-Codex-Slice-41-fold-in)" + amended `amends:` block. |
| LOW 1 | terminology | Rename "allowlist" → "forbidden list" in §4 prose; §4 terminology note added. |
| LOW 2 | tokenizer rationale | Per-entry rationale bullet in §4 Part A. |
| LOW 3 | Option C caveat | Add multi-request CLI protocol prerequisite bullet to §3.c. |

## §Fold-in record (post-pass, author side — all HIGH + all MED + all LOW folded in)

### HIGH fold-ins

- **HIGH 1 — authority-surface amendment.** `specs/contracts/adapter.md` ADAPTER-I1 agent-bullet rewritten (subprocess `claude -p` invocation + ADR-0009 §1 citation + superseded-prior-wording disclosure). `specs/adrs/ADR-0007-phase-2-close-criteria.md` CC#P2-2 rewritten ("`agent` as headless `claude` CLI subprocess (per ADR-0009 §1) or `codex` as `codex exec` subprocess" + amendment disclosure paragraph). `specs/adrs/ADR-0009-adapter-invocation-pattern.md` §Context §6 applicability rewritten as narrowing-with-semantic-amendment (§6.4 partial-substitute disclosure + §6.7 §What-changes coverage). Frontmatter `amends:` block extended with adapter.md + ADR-0007 entries.
- **HIGH 2 — forbidden-list bypass + scope.** `FORBIDDEN_ADAPTER_SDK_DEPS` extended with seven Part B wrapper/provider SDK entries (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`, `@langchain/anthropic`, `@langchain/openai`, `@langchain/google-genai`). List now has 15 entries. ADR-0009 §4 rewritten with Part A (direct-vendor) + Part B (wrapper/provider) split + per-entry rationale + explicit root-package.json scope disclosure. Slice 42 import-level scan promoted from "MAY" to **mandatory at Slice 42 pre-adapter-code** binding.
- **HIGH 3 — staging discipline.** Addressed at commit time: this review file documents the staging discipline, and the author stages the full coherent payload (ADR + audit impl + audit types + test + plan + floor + status docs + yield ledger + review file + status-epoch pin) in a single `git add` batch before `git commit`.
- **HIGH 4 — CLI no-write proof.** New §2.v capability-boundary-deferral ground added to ADR-0009 explicitly stating the subprocess decision is conditional on P2.4 empirical proof. New §6 reopen trigger 5 (CLI contract failure). `specs/plans/phase-2-implementation.md §P2.4` acceptance evidence extended with the CLI no-write capability proof requirement (either documented flag or demonstrable subprocess-level mechanism) + P2.4 Codex challenger review proof-artifact binding.

### MED fold-ins

- **MED 1 — transcript rationale reword.** ADR-0009 §2.ii rewritten to acknowledge the SDK-collapsing path ("SDK would either collapse SDK-specific metadata or force schema widening"); collapsing buys nothing at v0 (byte-equivalent to subprocess stdout).
- **MED 2 — test coverage hardening.** `tests/contracts/adapter-invocation-discipline.test.ts` gained two new tests: (a) `peerDependencies` negative test with `@langchain/anthropic`; (b) set-equality pin against the 15-entry expected forbidden set. Total new-test count in this file: 8 (pre-fold-in 6 + 2 Codex-pass-driven).
- **MED 3 — `.claude/skills/codex/` citations.** Three occurrences in ADR-0009 replaced with `CLAUDE.md:173-179` §Cross-model challenger protocol + `specs/reviews/*-codex.md` authorities.
- **MED 4 — reopen-trigger completeness.** Three new reopen triggers added to §6: trigger 5 (CLI contract failure — HIGH 4 link); trigger 6 (forbidden-dep bypass discovery — HIGH 2 link); trigger 7 (auth/session incompatibility).
- **MED 5 — Option A trigger #4 tightening.** Trigger rewritten from "transitive-dep presence" to "already-accepted Anthropic SDK runtime path with the same auth/billing/transcript assumptions."
- **MED 6 — ADR status/provenance.** Frontmatter `status` updated to `Accepted (post-Codex-Slice-41-fold-in)`; `author` line updated to reflect Codex pass completion + fold-in state; `amends:` block extended with adapter.md + ADR-0007 inline amendments (per HIGH 1).

### LOW fold-ins

- **LOW 1 — "allowlist" terminology.** §4 prose renamed "forbidden-SDK allowlist" → "forbidden-SDK forbidden list"; a terminology note added at end of §4 documenting the rename.
- **LOW 2 — `@anthropic-ai/tokenizer` rationale.** Per-entry rationale added in ADR-0009 §4 Part A enumerated list: "`@anthropic-ai/tokenizer` — banned for vendor dep-surface growth parity with the SDK; a future slice using just tokenization still commits to the vendor dep-surface treadmill per §Hard invariant #7."
- **LOW 3 — Option C pooling prerequisite.** New bullet added to ADR-0009 §3.c naming the multi-request-CLI-protocol prerequisite: if `claude -p` and `codex exec` are single-shot-only, "pooling" is not a performance optimization but a different option that requires establishing a multi-request CLI protocol first.

### Cross-slice / meta

- Verification at fold-in completion (author-side): `npm run check` pass; `npm run lint` pass; `npx vitest run tests/contracts/adapter-invocation-discipline.test.ts` 8/8 pass after MED 2 fold-in; full `npm test` confirmation happens pre-commit. `npm run audit` status-docs-current red before commit is expected and resolves when the Slice 41 commit lands.
- Ratchet-floor advance: pre-fold-in target was 835 → 841 (+6 for the initial 6 tests). Post-fold-in: 835 → 844 (+9 for 6 initial + 3 fold-in tests — peerDependencies, `ai` bypass-guard, set-equality pin).

## §Closing verdict

**ACCEPT-WITH-FOLD-INS.**

All 4 HIGH / 6 MED / 3 LOW objections folded in across `specs/adrs/ADR-0009-adapter-invocation-pattern.md`, `specs/contracts/adapter.md`, `specs/adrs/ADR-0007-phase-2-close-criteria.md`, `scripts/audit.mjs` (Check 28 + FORBIDDEN_ADAPTER_SDK_DEPS 8 → 15 entries), `scripts/audit.d.mts` (type declarations stable), `tests/contracts/adapter-invocation-discipline.test.ts` (+3 new tests: peerDependencies + `ai` bypass-guard + set-equality), `specs/plans/phase-2-implementation.md §P2.4` (CLI no-write capability proof requirement), `specs/ratchet-floor.json` (835 → 844), `tests/contracts/status-epoch-ratchet-floor.test.ts` (live pin '40' → '41'), `PROJECT_STATE.md` / `README.md` / `TIER.md` (current_slice=41 + Slice 41 block), `specs/reviews/adversarial-yield-ledger.md` (Slice 41 row counts 4/6/3 + closing verdict). Yield-ledger row class = `governance` per ADR-0007 §6.6.

Subprocess-per-adapter is the right v0 invocation pattern given the operator product constraint ("Claude Code out-of-box, no Codex required") and the four grounds (existing schema surface / single transcript path / no new dep surface / product-constraint binding). The four deferred options (Option A direct SDK, Option B2 runner pause/resume + native Task, Option C pooling, Option D streaming) are recorded with named reopen triggers per the operator's 2026-04-21 "don't-forget" request. P2.4 (Slice 42) opens against a decided invocation pattern, now with the HIGH 4 CLI no-write capability proof as a stated acceptance-evidence requirement.
