# v2 Phase 6 Notes

## 1. Generated Surfaces Mapped

`docs/generated-surfaces.md` is generated from `scripts/emit-flows.mjs` and now
includes an explicit surface inventory with:

- surface;
- source of truth;
- generator;
- human-editability;
- expected destinations;
- validation/drift check;
- notes.

The map covers flow-owned commands, root/router commands, generated flow
manifests, Claude host flow mirrors, Codex flow mirrors, Codex command mirrors,
Codex skill surfaces, and the currently absent command README surface.

## 2. Stale References Fixed

Stale references to `docs/contracts/flow.md` were replaced with
`docs/contracts/compiled-flow.md` in specs and v2 architecture notes.

## 3. Headers Added or Intentionally Omitted

`docs/generated-surfaces.md` carries a generated-file header.

Generated headers remain intentionally omitted from JSON manifests and host
command/skill mirrors because those surfaces are parsed by host tooling and
checked as mirrors of their sources.

## 4. Drift Tests Updated

`tests/contracts/catalog-completeness.test.ts` now checks that the generated
surface map includes the explicit surface inventory and command README status.

Existing emit-flow drift tests still cover stale generated siblings, stale
internal host mirrors, command mirrors, host mirrors, and the generated surface
map itself.

## 5. Generated Outputs Changed

Only `docs/generated-surfaces.md` changed as a generated output.

No compiled flow manifests, command mirrors, Claude host mirrors, or Codex host
mirrors changed.

## 6. Remaining Ambiguity

There is no `commands/README.md` today. The generated surface map now documents
that absence rather than implying a hidden source.
