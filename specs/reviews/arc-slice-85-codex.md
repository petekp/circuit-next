---
name: arc-slice-85-codex
description: Cross-model challenger pass over Slice 85 (P2-MODEL-EFFORT runtime selection resolver). Per-slice review per AGENTS.md hard invariant #6 for ratchet-advance runtime selection work. Returns objection list per CHALLENGER-I1 and satisfies scripts/audit.mjs Check 35 for the Slice 85 commit.
type: review
reviewer_model: gpt-5.4 via codex exec
reviewer_model_id: gpt-5.4
authorship_role: challenger
review_kind: per-slice-challenger-review
review_date: 2026-04-24
verdict: ACCEPT
authored_by: gpt-5.4 via codex exec
review_target: slice-85-p2-model-effort-runtime-selection-resolver
target_kind: arc
target: slice-85
target_version: "Base HEAD=34e554c (Slice 84 router first pass); draft working tree reviewed before Slice 85 commit"
arc_target: p2-model-effort
arc_version: "Actual repository Slice 85; lands the runtime selection resolver and dispatch-evidence seam while product-path config discovery and adapter model/effort handling remain pending"
opening_verdict: REJECT-PENDING-FOLD-INS
closing_verdict: ACCEPT
severity_counts:
  high: 2
  med: 0
  low: 0
  meta: 0
commands_run:
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (opening attempt inside app sandbox; failed on Codex session-file permission)"
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (opening pass over draft Slice 85 diff; verdict REJECT-PENDING-FOLD-INS)"
  - "parent session folded both HIGH findings by narrowing P2-5 status and adapter/model-validation claims"
  - "npm run check"
  - "npm run lint"
  - "npm run test -- tests/contracts/workflow-model-effort.test.ts tests/contracts/schema-parity.test.ts tests/contracts/artifact-authority.test.ts tests/runner/runner-dispatch-provenance.test.ts"
  - "codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never (follow-up pass over folded Slice 85 diff; verdict ACCEPT)"
opened_scope:
  - src/runtime/selection-resolver.ts
  - src/runtime/runner.ts
  - src/runtime/adapters/dispatch-materializer.ts
  - src/schemas/selection-policy.ts
  - tests/contracts/workflow-model-effort.test.ts
  - specs/contracts/selection.md
  - specs/contracts/config.md
  - specs/artifacts.json
  - specs/plans/phase-1-close-revised.md
  - specs/plans/phase-2-implementation.md
  - PROJECT_STATE.md
  - PROJECT_STATE-chronicle.md
  - README.md
  - TIER.md
skipped_scope:
  - user-global and project config file discovery/loading in the product CLI path
  - built-in adapter use of resolved model and effort values
  - adapter-owned validation of provider/model availability
  - generated property harness coverage beyond the focused contract/runtime tests
  - full npm run verify inside the read-only Codex sandbox; parent session owns final verification
authority:
  - AGENTS.md Hard invariants #6
  - AGENTS.md Cross-model challenger protocol
  - specs/plans/phase-2-implementation.md P2-MODEL-EFFORT
  - specs/contracts/selection.md
  - specs/contracts/config.md
  - scripts/audit.mjs Check 35
---

# Slice 85 - P2-MODEL-EFFORT Runtime Selection Resolver - Codex Challenger Pass

This records the Codex cross-model challenger pass for the slice that
replaces the runner's old workflow-plus-step selection helper with the
full runtime resolver for already-supplied selection config layers.

The landed claim is intentionally narrow: dispatch evidence now records
the effective selection after the default, user-global, project,
workflow, phase, step, and invocation layers are folded. The product CLI
still does not discover or load user/project config files, and the
built-in adapters do not yet change their subprocess arguments based on
model or effort.

## Wrapper Note

The first sandboxed Codex CLI attempt could not access its own
`~/.codex/sessions` files from inside the app sandbox. The challenger was
rerun with the Codex CLI outside the app sandbox, still using
`codex exec -m gpt-5.4 --sandbox read-only --ephemeral --color never`.

## Opening Verdict

**REJECT-PENDING-FOLD-INS.** Codex found two HIGH issues. Both were
scope-honesty problems rather than objections to the resolver mechanics:
the first draft overstated P2-5 progress, and the docs implied adapter
model validation that the current built-in adapters do not perform.

## Objection List and Dispositions

### HIGH 1 - P2-5 was marked satisfied before the product path supplies config layers

The first draft treated the resolver seam as satisfying the broader
model/effort work even though `src/cli/dogfood.ts` still says there is
no user-global or project config layer, and the product invocation path
does not populate `selectionConfigLayers`.

Disposition: **folded in.** `specs/plans/phase-2-implementation.md`
now keeps P2-5 active/red and explicitly says Slice 85 lands only the
runtime resolver/evidence seam. The same plan names config discovery and
adapter model/effort handling as remaining work before P2-5 can be
called satisfied.

### HIGH 2 - Adapter-level model validation was overclaimed

The first draft's docs suggested adapter-specific code validates known
model strings. The actual built-in adapters accept dispatch prompts and
do not currently validate or honor the resolved `model` or `effort`
values. The focused test proves the schema rule only: provider is closed,
model ids remain open strings.

Disposition: **folded in.** `specs/contracts/selection.md`,
`specs/contracts/config.md`, `specs/plans/phase-1-close-revised.md`, and
`src/schemas/selection-policy.ts` now say adapter-specific code owns
provider/model handling, while current built-ins do not yet provide that
behavior. The Slice 85 tests stay scoped to provider enum closure, open
model ids, resolver precedence, and dispatch evidence.

## Follow-up Verdict

**ACCEPT.** Codex found no remaining HIGH, MED, or LOW objections after
the two fold-ins. The follow-up pass specifically confirmed that the
P2-5 overclaim and adapter-validation drift were corrected, and that the
runtime/test changes match the narrowed Slice 85 claim.

Codex could not run the Vitest target inside its read-only sandbox
because Vitest attempted to create temp/cache files and hit `EPERM`; the
parent session ran the focused tests locally.

## Verification Owned By Parent Session

- `npm run check`
- `npm run lint`
- `npm run test -- tests/contracts/workflow-model-effort.test.ts tests/contracts/schema-parity.test.ts tests/contracts/artifact-authority.test.ts tests/runner/runner-dispatch-provenance.test.ts`

Final `npm run verify` and `npm run audit` are owned by the Slice 85
landing session after this review file is committed with the slice.
