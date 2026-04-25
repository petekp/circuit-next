# Prune Audit - 2026-04-25

Scope: tracked files and repo-local generated/status artifacts in `circuit-next`.

This report started as a cleanup audit and now records what was handled in the
cleanup pass.

## Handled

### Redundant `.gitkeep` files removed

These directories already contain tracked files, so their placeholder files were
removed:

- `.claude-plugin/.gitkeep`
- `tests/contracts/.gitkeep`
- `tests/properties/visible/.gitkeep`
- `tests/unit/.gitkeep`

Kept deliberately:

- `tests/properties/hidden/.gitkeep` because the empty hidden-test directory is
  named in the methodology docs.
- `docs/.gitkeep` because old references still reserve a future docs/archive
  location, and deleting it would save almost nothing.

### `tsx` removed from package metadata

`tsx` was still listed as a dev dependency, but the live launcher now goes
through `./bin/circuit-next` and compiled JavaScript. It was removed from
`package.json` and `package-lock.json`.

Historical references to the old `tsx` failure remain in specs, reviews, and
test comments because they explain why the launcher changed.

### Product-surface inventory reports refreshed and clarified

`reports/product-surface.inventory.json` and
`reports/product-surface.inventory.md` were regenerated. They now show the
current launcher, plugin metadata, and current slice.

The inventory report now also carries a note explaining that `slice: 27b` names
the original report format, while generated time, HEAD, and evidence summaries
reflect the current checkout.

### `AGENTS.md` / `CLAUDE.md` consolidated

`AGENTS.md` is now the active agent guide. `CLAUDE.md` is kept as a short
compatibility pointer for Claude Code and older tools that still look for that
filename.

Tests, doctor output, README layout, and active audit messaging were updated so
new agents do not have to guess which file is authoritative.

## Still Worth Considering Later

### Huge raw transcript

`specs/reviews/p2-foundation-composition-review-codex-transcript.md` is about
1.5 MB and 14,895 lines. The main review summary is only 220 lines, and later
composition review text says the raw transcript was archival.

Best next move: define an archive policy before changing this. Good options:

- replace the transcript with a short pointer plus checksum/session id; or
- move raw transcripts out of the main repo while keeping the summary review in
  `specs/reviews/`.

I did not change it in this pass because removing review evidence is more
consequential than deleting placeholders or refreshing generated reports.

## Keep For Now

### `.circuit/circuit-runs/phase-1-step-contract-authorship/`

This looks odd because `.circuit/` is usually ignored, but it is explicitly
preserved as historical audit trail. Both the clean-clone smoke script and
session-hygiene test know about this one allowlisted run. Do not delete it
casually.

### `bootstrap/`

The bootstrap evidence files are still cited by specs, contracts, and reviews.
They are old, but they are source evidence rather than accidental leftovers.

### `src/types/README.md`

This directory has no TypeScript files yet, only a README explaining when
hand-written types should live there. It is tiny. We can remove it if we want a
stricter "no empty placeholders" posture, but it is not currently harmful.

### `src/schemas/role.ts`

This is only a 6-line alias for `DispatchRole`, and a prior review already
called it out as inline-able. It is still part of the exported schema surface
and is used by schema parity tests and artifact export checks, so removing it is
possible but not a good first prune.

### `dogfood-run-0`

The name is old, but the fixture is still referenced by runtime tests and
policy exemptions. It is internal test/proof infrastructure, not a public
workflow to advertise, but it is not dead yet.
