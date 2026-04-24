---
plan: build-workflow-parity
status: challenger-pending
revision: 02
opened_at: 2026-04-24
revised_at: 2026-04-24
opened_in_session: post-phase-2-parity-map
revised_in_session: build-workflow-parity-codex-challenger-01-foldins
base_commit: eb52089
target: build
authority:
  - specs/parity-map.md
  - specs/reference/legacy-circuit/build-characterization.md
  - specs/adrs/ADR-0003-authority-graph-gate.md
  - specs/adrs/ADR-0007-phase-2-close-criteria.md
  - specs/adrs/ADR-0010-arc-planning-readiness-gate.md
  - specs/contracts/explore.md
  - specs/contracts/review.md
  - scripts/policy/workflow-kind-policy.mjs
  - src/schemas/step.ts
  - src/runtime/runner.ts
artifact_ids:
  - build.brief
  - build.plan
  - build.implementation
  - build.verification
  - build.review
  - build.result
prior_challenger_passes:
  - specs/reviews/build-workflow-parity-codex-challenger-01.md
    (verdict REJECT-PENDING-FOLD-INS vs revision 01 — 1 CRITICAL,
    2 HIGH, 1 MED; revision 02 folds all four by correcting the base
    commit binding, making Work item 1 policy-only, pinning the
    verification command-execution contract, and budgeting public
    command-surface audit/test/manifest updates)
---

# Build Workflow Parity Plan

Build workflow parity targets the everyday "do the work" path after the
first working workflow spine and the parity map: plan a change, implement it,
verify it, review it, and close with a useful result.

Build is a successor-to-live surface. The old Circuit Build workflow is pinned
in `specs/reference/legacy-circuit/build-characterization.md`; this plan uses
that shape as reference evidence while keeping circuit-next's structured JSON
artifact direction.

## §Prior pass log

Revision 02 folds the first Codex challenger pass.

| Pass-01 # | Severity | Objection | Revision-02 fold-in |
|---|---|---|---|
| 1 | CRITICAL | Review binding mismatch: revision 01 frontmatter carried `base_commit: 129622e`, while the review was commissioned against `eb520893c3ce80a407f2c761c082b31382ec1d59`. | Frontmatter now carries `base_commit: eb52089`, matching the committed revision-01 plan base used for the folded revision. |
| 2 | HIGH | Work item 6 under-budgeted the public command surface. | Work item 6 now explicitly includes the audit command-closure check, plugin-surface tests, command-invocation tests, and `.claude-plugin/plugin.json` wired-state description. |
| 3 | HIGH | Verification command execution substrate lacked a typed non-shell contract. | §7 now defines the substrate-widening slice's verification command contract: argv array, direct exec, no shell wrapping or interpolation, project-root-contained cwd, explicit env, timeout and output limits, and shell-bypass tests. |
| 4 | MED | Work item 1 claimed a parsing Build fixture before the verification step substrate exists. | Work item 1 is now policy-only. The product fixture lands with Work item 4 after the verification step kind exists. |

## §1 — Evidence census

| # | Claim | Status | Source |
|---|---|---|---|
| E1 | Target selection confirmed: the parity map recommends Build next because it is the common implementation workflow and unlocks the path that Repair, Migrate, and Sweep reuse. | verified | `specs/parity-map.md` |
| E2 | Reference Build declares six steps: frame, plan, act, verify, review, close. | verified | `specs/reference/legacy-circuit/build-characterization.md` |
| E3 | Reference Build emits 6 workflow artifact outputs: brief, plan, implementation handoff, verification, review, and result. | verified | `specs/reference/legacy-circuit/build-characterization.md` |
| E4 | Reference Build has four entry modes: default, lite, deep, and autonomous. Lite still includes review. | verified | `specs/reference/legacy-circuit/build-characterization.md` |
| E5 | Current circuit-next workflow policy knows Explore and Review only; Build is not registered yet. | verified | `scripts/policy/workflow-kind-policy.mjs` |
| E6 | Current circuit-next step schema supports checkpoint, synthesis, and dispatch steps only. | verified | `src/schemas/step.ts` |
| E7 | Current synthesis writers can emit registered Explore and Review JSON artifacts, otherwise they fall back to placeholder JSON. Build needs registered writers rather than placeholder artifacts. | verified | `src/runtime/runner.ts` |
| E8 | Current dispatch artifact parsing is schema-registered and fail-closed for unknown dispatch-produced schemas. Build dispatch outputs need registered schemas before runtime proof. | verified | `src/runtime/artifact-schemas.ts` |
| E9 | Current router only routes to Explore and Review; Build shortcuts are absent. | verified | `src/runtime/router.ts` |
| E10 | The command surface currently exposes run, explore, and review; there is no `/circuit:build` command yet. | verified | `commands/` |
| E11 | Build verification requires command execution evidence. circuit-next does not yet have a dedicated runtime step kind for verification commands. | verified | `src/schemas/step.ts`, `src/runtime/runner.ts`, `specs/reference/legacy-circuit/build-characterization.md` |
| E12 | Current plugin command closure, plugin-surface tests, command-invocation tests, and `.claude-plugin/plugin.json` describe exactly run/explore/review. Build command wiring must update those surfaces together. | verified | `commands/`, `.claude-plugin/plugin.json`, `tests/contracts/plugin-surface.test.ts`, `tests/runner/plugin-command-invocation.test.ts`, `scripts/audit.mjs` |
| E13 | Existing adapter subprocess contracts treat direct argv execution and no shell interpolation as a safety boundary. The verification command execution substrate-widening slice must use the same kind of boundary. | verified | `specs/contracts/adapter.md` |
| E14 | Unknown-blocking: none. | unknown-blocking | Current gaps are known enough to plan slices. |

## §2 — Why this plan exists

`circuit-next` now proves a real command path, Explore, Review, JSON artifacts,
model/effort config plumbing, and live adapter smoke coverage. That is enough
for a first working workflow spine, but it is not full first-generation Circuit
parity.

Build is the next smallest useful product expansion because it exercises the
normal mutating workflow users will expect most often. It also establishes the
shape that later Repair, Migrate, and Sweep work can reuse.

## §3 — Scope

Target Build surface:

- `/circuit:build` exists as a direct command.
- `/circuit:run develop:` and clear build-like tasks can route to Build.
- Build has the canonical phase set `{frame, plan, act, verify, review, close}`
  and `spine_policy.omits: {analyze}`.
- Build emits structured JSON successor artifacts for all six reference
  artifact roles.
- Implementation and review dispatches use registered JSON schemas.
- Verification runs explicit commands through a runtime-widening slice and
  records pass/fail evidence before review.

This plan declares 6 new artifact ids for a successor-to-live surface. The
reference surface emits 6 artifacts, mapped one-for-one by role while changing
the persisted format from Markdown to structured JSON.

## §4 — Non-goals

- Do not recreate old Circuit's Markdown artifact bytes.
- Do not implement Repair, Migrate, Sweep, Create, or Handoff in this arc.
- Do not make custom workflow authoring part of Build.
- Do not claim full Circuit parity at Build close.
- Do not add broad autonomous overnight behavior beyond Build's reference entry
  mode shape.

## §5 — Target Build shape

Build's circuit-next fixture should use these phases:

| Phase title | Canonical phase | Step kind | Role |
|---|---|---|---|
| Frame | frame | checkpoint or synthesis | Define objective, scope, success criteria, and verification commands. |
| Plan | plan | synthesis | Produce concrete implementation slices and verification commands. |
| Act | act | dispatch | Implementer makes the change and returns structured implementation evidence. |
| Verify | verify | verification command execution | Runtime runs the planned commands and records pass/fail evidence. |
| Review | review | dispatch | Reviewer inspects the changed work and verification evidence. |
| Close | close | synthesis | Runtime writes the final Build result artifact. |

The canonical phase set is `{frame, plan, act, verify, review, close}`.
`spine_policy.omits` is `{analyze}` because Build plans and acts rather than
running a separate investigation phase.

## §6 — Artifact map

| Reference role | circuit-next artifact id | Schema |
|---|---|---|
| Brief | `build.brief` | `build.brief@v1` |
| Plan | `build.plan` | `build.plan@v1` |
| Implementation handoff/result | `build.implementation` | `build.implementation@v1` |
| Verification | `build.verification` | `build.verification@v1` |
| Review | `build.review` | `build.review@v1` |
| Result | `build.result` | `build.result@v1` |

Each artifact is a clean-break structured JSON successor to the reference
Markdown role. The result artifact should point back to the prior Build
artifacts so users and tooling can understand what happened without reading
every intermediate file.

## §7 — Verification substrate

Build cannot honestly close without verification evidence. A synthesis step
that merely writes text about commands is not enough.

This arc therefore includes a runtime-widening slice for verification command
execution. The likely shape is a new step kind, for example
`verification-exec`, that:

- reads the planned command list from `build.plan@v1`,
- represents each command as a typed argv object, not a shell string,
- requires a non-empty argv array of non-empty strings,
- runs commands with direct exec only; no `/bin/sh -c`, no shell wrapping, no
  shell interpolation, and no environment-variable expansion by the runtime,
- rejects known shell executables as the command binary unless a later ADR
  explicitly reopens the boundary,
- constrains cwd to the project root or an explicitly declared
  project-relative subdirectory that cannot escape the project root,
- uses an explicit environment policy instead of inheriting arbitrary shell
  state by accident,
- applies per-command timeout and output-byte limits,
- captures command, exit code, stdout/stderr summary, and duration,
- writes `build.verification@v1`,
- fails closed when any required command fails,
- records enough event evidence that later audit and close artifacts can
  distinguish "commands passed" from "commands were not run".

If the challenger finds a smaller substrate that proves the same behavior, use
that smaller substrate. The plan must not replace command execution with a
placeholder synthesis artifact.

Required negative tests for this substrate include: a single shell-style string
with spaces where an argv vector is required; shell binaries with `-c`;
project-root escape through cwd; missing timeout; unbounded output; and a
metacharacter-bearing argument proving the runtime passes it as a literal argv
element rather than interpreting it through a shell.

## §8 — Slices

### Work item 1 — Build policy only

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Build could be treated as a router label without a
workflow shape, letting later slices invent phases locally.

**Deliverables:**

- Add Build to the workflow-kind policy table with canonicals
  `{frame, plan, act, verify, review, close}` and omitted `{analyze}`.
- Add policy tests using shaped fixture objects that prove the Build canonical
  set and omitted Analyze phase.
- Do not add the product `.claude-plugin/skills/build/circuit.json` fixture in
  this work item. The target Build fixture needs the verification command
  execution step kind, which does not exist yet.

**Acceptance evidence:**

- Policy tests prove Build has exactly the intended canonical phase set.
- Policy tests reject malformed Build phase sets.
- `npm run verify` passes.
- `npm run audit` reports 0 red and no new unaccounted yellows.

**Why this not adjacent:**

Starting with command wiring would expose `/circuit:build` before there is a
workflow shape behind it. Starting with schemas would let artifact names drift
without a registered spine. A runnable fixture would force a fake Verify step
before the verification substrate exists, so the smallest safe first move is a
policy-only Build shape.

### Work item 2 — Build artifact schemas and authority rows

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Build could copy old artifact names or placeholder
JSON without a typed successor contract.

**Deliverables:**

- Add `src/schemas/artifacts/build.ts`.
- Add authority rows for the six Build artifact ids in `specs/artifacts.json`.
- Add contract tests for strict parse/reject behavior and reference cardinality.
- Add or update a Build contract file if the artifact rows need a contract
  home before runtime wiring.

**Acceptance evidence:**

- All six Build artifact schemas accept a minimal valid object and reject
  missing required fields or surplus keys.
- Authority graph tests prove each Build artifact row has a backing path,
  schema file, schema export, writer, reader, and reference evidence.
- `npm run verify` passes.
- `npm run audit` reports 0 red and no new unaccounted yellows.

**Why this not adjacent:**

Runtime writers should not land before the artifact contracts exist. The schema
slice gives later runtime work a stable target.

### Work item 3 — Build synthesis writers

**Lane:** Ratchet-Advance.

**Failure mode addressed:** The current fallback synthesis writer can produce
placeholder JSON that looks like progress but is not a useful Build artifact.

**Deliverables:**

- Register synthesis writers for `build.brief@v1`, `build.plan@v1`, and
  `build.result@v1`.
- Add tests proving the Build close writer reads prior Build artifacts and
  writes a schema-valid result.
- Ensure placeholder fallback cannot satisfy Build result acceptance.

**Acceptance evidence:**

- Runner tests prove frame, plan, and close Build synthesis artifacts are
  schema-valid through the default runtime path.
- A malformed or missing prior Build artifact aborts close instead of writing a
  false success result.
- `npm run verify` passes.
- `npm run audit` reports 0 red and no new unaccounted yellows.

**Why this not adjacent:**

Dispatch and verification need typed inputs and outputs to read. The
orchestrator-owned artifacts are the stable base for those later steps.

### Work item 4 — Verification command execution substrate

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Build requires verification, but the current
runtime cannot prove commands were run.

**Deliverables:**

- Add the smallest runtime step kind or equivalent runtime widening needed to
  execute bounded verification commands.
- Add the typed command representation described in §7.
- Add the schema and event surfaces needed to materialize
  `build.verification@v1`.
- Add tests for pass, fail, timeout/budget, and command-output capture.
- Add negative tests for shell-string input, shell-binary bypass, cwd escape,
  missing timeout, and output limit enforcement.
- Add the first product Build fixture under `.claude-plugin/skills/build/`
  once the verification step kind can parse honestly.
- Keep command execution scoped to the project root and existing run safety
  rules.

**Acceptance evidence:**

- Product Build fixture parses through the workflow schema with the real
  verification step kind.
- A Build verification step runs a harmless command in test and records pass
  evidence.
- A failing command aborts or blocks the Build run honestly and cannot close as
  complete.
- Verification output parses as `build.verification@v1`.
- `npm run verify` passes.
- `npm run audit` reports 0 red and no new unaccounted yellows.

**Why this not adjacent:**

The implementation dispatch can make changes, but Build is not trustworthy
until verification can record real pass/fail evidence. This substrate should
land before a user-facing Build command exists.

### Work item 5 — Build implementation and review dispatch

**Lane:** Ratchet-Advance.

**Failure mode addressed:** A Build workflow without implementer and reviewer
dispatches would be a scripted summary, not the old product's work loop.

**Deliverables:**

- Register dispatch schemas for `build.implementation@v1` and
  `build.review@v1`.
- Add fixture steps for Act and Review with implementer and reviewer roles.
- Add tests proving dispatch result parsing, gate behavior, and review failure
  handling.

**Acceptance evidence:**

- Implementer dispatch can pass only with an accepted implementation verdict.
- Reviewer dispatch can pass only with an accepted review verdict.
- Failing or malformed dispatch output aborts or blocks honestly.
- `npm run verify` passes.
- `npm run audit` reports 0 red and no new unaccounted yellows.

**Why this not adjacent:**

Dispatch should land after the schemas and verification substrate so the work
loop can produce and consume real evidence instead of placeholders.

### Work item 6 — Build command and router wiring

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Users cannot invoke Build directly, and the router
does not recognize build-like tasks.

**Deliverables:**

- Add `commands/build.md`.
- Teach the CLI and router to select Build for `/circuit:build` and clear
  build-like `/circuit:run` inputs such as `develop:`.
- Update the plugin command-closure audit check so Build is an expected public
  command, not an unexpected extra file.
- Update plugin-surface tests and command-invocation tests for the four-command
  set: run, explore, review, and build.
- Update `.claude-plugin/plugin.json` so its description no longer says the
  wired command state is only run/explore/review.
- Add plugin command tests and router tests.

**Acceptance evidence:**

- `/circuit:build` command body invokes `./bin/circuit-next` directly.
- Audit accepts the expanded command set without weakening the closure check.
- Plugin manifest and tests agree that Build is now wired.
- Router tests prove build-like prompts select Build without regressing Review
  and Explore routing.
- `npm run verify` passes.
- `npm run audit` reports 0 red and no new unaccounted yellows.

**Why this not adjacent:**

The command should be exposed only after the runtime can execute the Build
fixture honestly enough for users to try it.

### Work item 7 — Live Build proof and close review

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Build could pass unit tests but fail through the
real plugin command path.

**Deliverables:**

- Live Build proof through the command path with a small harmless task.
- Proof artifact under `specs/reviews/`.
- Required composition review for the multi-slice runtime arc, bound to the
  existing arc-close audit machinery if needed.
- Closed plan frontmatter after proof and review evidence exists.

**Acceptance evidence:**

- Live proof reaches the Build workflow and writes schema-valid Build artifacts.
- Composition review evidence exists before any later privileged runtime arc.
- Plan frontmatter advances to `closed` with `closed_at` and
  `closed_in_slice`.
- `npm run verify` passes.
- `npm run audit` reports 0 red and no new unaccounted yellows.

**Why this not adjacent:**

Closing without a live command proof would repeat the old mistake of proving
only internals. The last slice should prove the user-visible route.

## §9 — Close criteria

Build is done for this arc when:

1. The Build fixture parses and runs through the product runtime.
2. Build writes all six structured JSON successor artifacts.
3. Verification command evidence is real and can fail the run honestly.
4. Direct `/circuit:build` and router-selected Build both reach the runtime.
5. The plan is closed with live command proof and composition review evidence.

This close would mean "Build parity path exists" for circuit-next. It would not
mean full first-generation Circuit parity, because Repair, Migrate, Sweep,
Create, Handoff, and configuration polish would still remain.
