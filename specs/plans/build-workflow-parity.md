---
plan: build-workflow-parity
status: challenger-pending
revision: 05
opened_at: 2026-04-24
revised_at: 2026-04-24
opened_in_session: post-phase-2-parity-map
revised_in_session: build-workflow-parity-codex-challenger-04-foldins
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
  - specs/reviews/build-workflow-parity-codex-challenger-02.md
    (verdict REJECT-PENDING-FOLD-INS vs revision 02 — 1 HIGH,
    2 MED; revision 03 folds all three by moving the first product
    Build fixture to the dispatch slice, declaring entry-mode scope,
    and requiring a Build-specific two-dispatch policy row)
  - specs/reviews/build-workflow-parity-codex-challenger-03.md
    (verdict REJECT-PENDING-FOLD-INS vs revision 03 — 2 HIGH;
    revision 04 folds both by binding build.result to
    artifacts/build-result.json and adding a product entry-mode
    selection slice)
  - specs/reviews/build-workflow-parity-codex-challenger-04.md
    (verdict REJECT-PENDING-FOLD-INS vs revision 04 — 2 HIGH;
    revision 05 folds both by requiring selected entry modes to drive
    run rigor and by adding a checkpoint substrate slice before the
    first product Build fixture)
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

Revision 02 folds the first Codex challenger pass. Revision 03 folds the
second Codex challenger pass. Revision 04 folds the third Codex challenger
pass. Revision 05 folds the fourth Codex challenger pass.

| Pass-01 # | Severity | Objection | Revision-02 fold-in |
|---|---|---|---|
| 1 | CRITICAL | Review binding mismatch: revision 01 frontmatter carried `base_commit: 129622e`, while the review was commissioned against `eb520893c3ce80a407f2c761c082b31382ec1d59`. | Frontmatter now carries `base_commit: eb52089`, matching the committed revision-01 plan base used for the folded revision. |
| 2 | HIGH | The public command-surface work was under-budgeted. | The command/router work now explicitly includes the audit command-closure check, plugin-surface tests, command-invocation tests, and `.claude-plugin/plugin.json` wired-state description. |
| 3 | HIGH | Verification command execution substrate lacked a typed non-shell contract. | §7 now defines the substrate-widening slice's verification command contract: argv array, direct exec, no shell wrapping or interpolation, project-root-contained cwd, explicit env, timeout and output limits, and shell-bypass tests. |
| 4 | MED | Work item 1 claimed a parsing Build fixture before the verification step substrate exists. | Work item 1 is now policy-only. Later revisions move the first product fixture to the dispatch slice so it lands only after the required substrates and dispatch steps exist. |

| Pass-02 # | Severity | Objection | Revision-03 fold-in |
|---|---|---|---|
| 1 | HIGH | The verification substrate slice added the first product Build fixture before the dispatch steps that the existing audit gate requires. | The product fixture now lands in the dispatch slice with both `act` and `review` dispatch steps. The verification substrate keeps tests local to the runtime step kind. |
| 2 | MED | Entry-mode parity was cited as evidence without saying whether this arc lands or defers the old Build modes. | §3 and §5 now declare that this arc lands `default`, `lite`, `deep`, and `autonomous` entry modes, with Lite still reaching Review. |
| 3 | MED | The plan wanted two Build dispatch steps but did not bind that shape to audit policy. | The dispatch slice now requires a Build-specific dispatch-policy row and tests that enforce both `act` and `review`. |

| Pass-03 # | Severity | Objection | Revision-04 fold-in |
|---|---|---|---|
| 1 | HIGH | `build.result` was not bound to a path distinct from the engine-authored `run.result` at `artifacts/result.json`. | §6 now binds `build.result@v1` to `<run-root>/artifacts/build-result.json`, and Work items 2-3 require path-collision tests and a path-distinct close writer. |
| 2 | HIGH | The plan landed four entry modes but did not make non-default modes reachable through the product path. | The entry-mode selection slice wires entry-mode selection through the runtime/CLI path and proves a non-default mode is reachable. |

| Pass-04 # | Severity | Objection | Revision-05 fold-in |
|---|---|---|---|
| 1 | HIGH | Entry-mode selection could still leave Lite, Deep, and Autonomous semantically inert because the plan only required `start_at` selection. | §3, §5, and the entry-mode slice now require the selected mode's `rigor` to become the default run rigor when no explicit invocation rigor is supplied, with runner and CLI tests proving non-default modes affect recorded run state. |
| 2 | HIGH | The plan weakened legacy Build's checkpointed Frame into "checkpoint or synthesis," even though autonomous parity depends on real checkpoint behavior and the current runner cannot execute checkpoint steps. | §5 now requires Frame to be a checkpoint, §8 adds a checkpoint substrate, and the first product Build fixture waits until both checkpoint and verification substrates exist. |

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
- Build declares and exposes the four reference entry modes: `default`, `lite`,
  `deep`, and `autonomous`; all four use the fixed Build graph, selected modes
  drive run rigor by default, and Lite still reaches Review.
- Build Frame is a real checkpoint. Non-autonomous runs pause or record an
  unresolved checkpoint according to the checkpoint substrate; Autonomous may
  auto-resolve only declared safe checkpoint choices and fails closed when no
  safe auto choice exists.
- Build emits structured JSON successor artifacts for all six reference
  artifact roles. The workflow-specific close artifact is
  `<run-root>/artifacts/build-result.json`, not the engine-authored
  `<run-root>/artifacts/result.json`.
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
  mode shape and narrowly declared checkpoint auto-resolution.

## §5 — Target Build shape

Build's circuit-next fixture should use these phases:

| Phase title | Canonical phase | Step kind | Role |
|---|---|---|---|
| Frame | frame | checkpoint | Define objective, scope, success criteria, and verification commands. |
| Plan | plan | synthesis | Produce concrete implementation slices and verification commands. |
| Act | act | dispatch | Implementer makes the change and returns structured implementation evidence. |
| Verify | verify | verification command execution | Runtime runs the planned commands and records pass/fail evidence. |
| Review | review | dispatch | Reviewer inspects the changed work and verification evidence. |
| Close | close | synthesis | Runtime writes the final Build result artifact. |

The Frame and Verify steps do not assume capabilities the runtime already has.
Frame lands only through the §8 checkpoint substrate slice. Verify lands only
through the §7 verification runtime widening substrate slice.

The canonical phase set is `{frame, plan, act, verify, review, close}`.
`spine_policy.omits` is `{analyze}` because Build plans and acts rather than
running a separate investigation phase.

Build's entry-mode scope for this arc is the full reference set:
`default`, `lite`, `deep`, and `autonomous`. The modes differ through runtime
behavior, not metadata alone. The selected entry mode's `rigor` becomes the
run rigor unless an explicit invocation rigor is supplied, in which case the
explicit invocation value wins and is recorded as such. The modes must not
skip the Review phase. Lite still reaches Review. This is a product
reachability and behavior claim: a later slice in this arc must let the
product path select a named entry mode instead of always executing
`entry_modes[0]`, and must prove non-default modes affect recorded run state.

Autonomous mode is limited to the Build reference shape for this arc. Its
checkpoint behavior is narrow: it can auto-resolve a checkpoint only when the
checkpoint declares an allowed safe default or safe auto choice. Missing or
unsafe auto choices fail closed rather than silently continuing.

## §6 — Artifact map

| Reference role | circuit-next artifact id | Schema | Backing path |
|---|---|---|---|
| Brief | `build.brief` | `build.brief@v1` | `<run-root>/artifacts/brief.json` |
| Plan | `build.plan` | `build.plan@v1` | `<run-root>/artifacts/plan.json` |
| Implementation handoff/result | `build.implementation` | `build.implementation@v1` | `<run-root>/artifacts/implementation.json` |
| Verification | `build.verification` | `build.verification@v1` | `<run-root>/artifacts/verification.json` |
| Review | `build.review` | `build.review@v1` | `<run-root>/artifacts/review.json` |
| Result | `build.result` | `build.result@v1` | `<run-root>/artifacts/build-result.json` |

Each artifact is a clean-break structured JSON successor to the reference
Markdown role. The result artifact should point back to the prior Build
artifacts so users and tooling can understand what happened without reading
every intermediate file.

`build.result` must stay path-distinct from `run.result`. The engine-authored
universal run result remains `<run-root>/artifacts/result.json`; the
workflow-specific Build close artifact is `<run-root>/artifacts/build-result.json`.

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

## §8 — Checkpoint substrate

Build cannot claim its reference mode set honestly while Frame is a synthesis
stand-in. The old Build workflow begins with a checkpoint, and Autonomous mode
is meaningful only if that checkpoint can be resolved by declared safe policy
rather than by user pause.

This arc therefore includes a checkpoint substrate slice before the first
product Build fixture. The likely shape is the smallest runner capability that:

- parses checkpoint steps through the existing step schema without throwing,
- records `checkpoint.requested` evidence when a checkpoint is reached,
- materializes a checkpoint artifact or state entry with prompt, allowed
  choices, selected choice when present, and resolution source,
- pauses or closes as waiting/unresolved for non-autonomous runs when no
  explicit resolution is supplied,
- accepts only declared allowed choices when a checkpoint is resolved,
- lets Autonomous mode auto-resolve only a declared safe default or safe auto
  choice,
- fails closed when a checkpoint has no safe auto choice in Autonomous mode,
- records enough run-state evidence that default/lite/deep checkpoint behavior
  can be distinguished from autonomous auto-resolution.

Required tests for this substrate include: parsing and reaching a checkpoint
step; non-autonomous unresolved checkpoint behavior; rejected undeclared
checkpoint choice; autonomous safe auto-resolution; autonomous fail-closed
when no safe auto choice exists; and event/state/result agreement for each
terminal outcome.

## §9 — Slices

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
  execution and checkpoint substrates, which do not exist yet.

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
- Add backing-path tests proving `build.result` uses
  `<run-root>/artifacts/build-result.json` and does not collide with
  `run.result` at `<run-root>/artifacts/result.json`.
- Add or update a Build contract file if the artifact rows need a contract
  home before runtime wiring.

**Acceptance evidence:**

- All six Build artifact schemas accept a minimal valid object and reject
  missing required fields or surplus keys.
- Authority graph tests prove each Build artifact row has a backing path,
  schema file, schema export, writer, reader, and reference evidence.
- Authority graph or artifact tests prove no workflow-specific Build artifact
  is registered at `<run-root>/artifacts/result.json`.
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
  writes a schema-valid result at `artifacts/build-result.json`.
- Ensure placeholder fallback cannot satisfy Build result acceptance.

**Acceptance evidence:**

- Runner tests prove frame, plan, and close Build synthesis artifacts are
  schema-valid through the default runtime path.
- Runner tests prove `build.result@v1` is written to
  `artifacts/build-result.json`, while `artifacts/result.json` remains the
  engine-authored run summary.
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
- Keep product fixture registration out of this work item. Runtime tests may
  use local fixtures or direct runner setup to prove the verification step
  kind, but the registered Build fixture must wait until checkpoint execution
  also exists and the dispatch slice can include both required dispatch steps.
- Keep command execution scoped to the project root and existing run safety
  rules.

**Acceptance evidence:**

- The verification step kind parses and runs through focused runtime tests.
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

### Work item 5 — Checkpoint execution substrate

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Build could replace the reference Frame checkpoint
with a synthesis placeholder while still claiming full entry-mode parity.

**Deliverables:**

- Add the smallest runner support needed for checkpoint steps to execute
  without throwing.
- Add the checkpoint event, state, and artifact surfaces described in §8.
- Add fail-closed resolution checks for undeclared checkpoint choices.
- Add Autonomous-mode safe auto-resolution only for declared safe choices.
- Keep the product Build fixture out of this work item. Local runtime fixtures
  may prove checkpoint behavior, but the registered Build fixture must wait
  until both checkpoint and verification substrates exist.

**Acceptance evidence:**

- Runner tests prove a checkpoint step can be reached and recorded.
- Runner tests prove default/lite/deep non-autonomous runs do not silently
  auto-resolve the checkpoint.
- Runner tests prove Autonomous resolves a safe declared checkpoint choice and
  fails closed when no safe auto choice exists.
- Event, state, and result surfaces agree for unresolved, resolved, and failed
  checkpoint outcomes.
- `npm run verify` passes.
- `npm run audit` reports 0 red and no new unaccounted yellows.

**Why this not adjacent:**

The Build fixture needs a real Frame checkpoint. Adding the fixture before the
checkpoint substrate would force a fake first step or a runtime throw, so the
smallest honest move is to teach the runner checkpoint behavior first.

### Work item 6 — Build implementation and review dispatch

**Lane:** Ratchet-Advance.

**Failure mode addressed:** A Build workflow without implementer and reviewer
dispatches would be a scripted summary, not the old product's work loop.

**Deliverables:**

- Register dispatch schemas for `build.implementation@v1` and
  `build.review@v1`.
- Add the first product Build fixture under `.claude-plugin/skills/build/`
  with all six phases, including a Frame checkpoint plus Act and Review
  dispatch steps with implementer and reviewer roles.
- Add a Build-specific dispatch-policy row and tests proving audit enforces
  both required dispatch steps: `act` and `review`.
- Add entry-mode tests proving the product fixture declares `default`, `lite`,
  `deep`, and `autonomous`, and that Lite still reaches Review.
- Add tests proving dispatch result parsing, gate behavior, and review failure
  handling.

**Acceptance evidence:**

- Implementer dispatch can pass only with an accepted implementation verdict.
- Reviewer dispatch can pass only with an accepted review verdict.
- Audit rejects a registered Build fixture missing either the `act` dispatch or
  the `review` dispatch.
- Product Build fixture parses with all four reference entry modes.
- Product Build fixture uses a checkpoint Frame step, not a synthesis stand-in.
- Failing or malformed dispatch output aborts or blocks honestly.
- `npm run verify` passes.
- `npm run audit` reports 0 red and no new unaccounted yellows.

**Why this not adjacent:**

Dispatch should land after the schemas, verification substrate, and checkpoint
substrate so the work loop can produce and consume real evidence instead of
placeholders.

### Work item 7 — Build entry-mode selection

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Build could declare Lite, Deep, and Autonomous
entry modes without making them reachable through the product path.

**Deliverables:**

- Add the smallest runtime and CLI entry-mode selector needed for a named
  workflow entry mode to choose the run start point and default run rigor
  instead of always using `entry_modes[0]`.
- Bind the selected entry mode's `rigor` into invocation and recorded run
  state when no explicit invocation rigor is supplied.
- Preserve explicit invocation rigor precedence when a caller supplies it, and
  record that the explicit invocation value won.
- Fail closed when a requested entry mode does not exist for the selected
  workflow.
- Add tests proving `default`, `lite`, `deep`, and `autonomous` select the
  intended entry mode and recorded rigor, and that non-default modes reach the
  runtime through the product CLI path.
- Add a Lite-mode regression test proving Review still runs.
- Add an Autonomous-mode checkpoint test proving safe auto-resolution occurs
  only through the checkpoint substrate's declared safe choice.

**Acceptance evidence:**

- Product CLI tests prove a non-default Build entry mode is reachable.
- Runner tests prove requested entry modes select the corresponding
  `entry_modes[*].start_at` and default rigor instead of unconditionally
  taking `entry_modes[0]`.
- Runner and CLI tests prove Lite, Deep, and Autonomous affect recorded run
  state when no explicit invocation rigor is supplied.
- Tests prove explicit invocation rigor overrides entry-mode rigor when
  supplied.
- Unknown entry-mode names fail before the run starts.
- `npm run verify` passes.
- `npm run audit` reports 0 red and no new unaccounted yellows.

**Why this not adjacent:**

The fixture can declare the four modes before the command is public, but the
plan should not close with inert mode metadata. Selection wiring belongs before
the public command proof.

### Work item 8 — Build command and router wiring

**Lane:** Ratchet-Advance.

**Failure mode addressed:** Users cannot invoke Build directly, and the router
does not recognize build-like tasks.

**Deliverables:**

- Add `commands/build.md`.
- Teach the CLI and router to select Build for `/circuit:build` and clear
  build-like `/circuit:run` inputs such as `develop:`.
- Teach the public command body how to pass through an explicit Build entry
  mode request when the user asks for Lite, Deep, or Autonomous Build.
- Update the plugin command-closure audit check so Build is an expected public
  command, not an unexpected extra file.
- Update plugin-surface tests and command-invocation tests for the four-command
  set: run, explore, review, and build.
- Update `.claude-plugin/plugin.json` so its description no longer says the
  wired command state is only run/explore/review.
- Add plugin command tests and router tests.

**Acceptance evidence:**

- `/circuit:build` command body invokes `./bin/circuit-next` directly.
- `/circuit:build` can reach at least one non-default Build entry mode through
  the product path.
- Audit accepts the expanded command set without weakening the closure check.
- Plugin manifest and tests agree that Build is now wired.
- Router tests prove build-like prompts select Build without regressing Review
  and Explore routing.
- `npm run verify` passes.
- `npm run audit` reports 0 red and no new unaccounted yellows.

**Why this not adjacent:**

The command should be exposed only after the runtime can execute the Build
fixture honestly enough for users to try it.

### Work item 9 — Live Build proof and close review

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

## §10 — Close criteria

Build is done for this arc when:

1. The Build fixture parses and runs through the product runtime.
2. Build writes all six structured JSON successor artifacts.
3. Verification command evidence is real and can fail the run honestly.
4. Direct `/circuit:build` and router-selected Build both reach the runtime.
5. Build writes its workflow-specific close artifact to
   `artifacts/build-result.json`, distinct from the engine-authored
   `artifacts/result.json`.
6. Build exposes the four reference entry modes through the product path:
   `default`, `lite`, `deep`, and `autonomous`, with selected mode rigor
   reflected in recorded run state and Lite still reaching Review.
7. Build Frame is a real checkpoint. Autonomous mode proves safe checkpoint
   auto-resolution in a narrow declared case, and non-autonomous modes do not
   silently auto-resolve checkpoints.
8. Audit enforces both required Build dispatch steps: Act and Review.
9. The plan is closed with live command proof and composition review evidence.

This close would mean "Build parity path exists" for circuit-next. It would not
mean full first-generation Circuit parity, because Repair, Migrate, Sweep,
Create, Handoff, and configuration polish would still remain.
