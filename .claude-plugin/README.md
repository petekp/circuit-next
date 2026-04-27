# .claude-plugin/ — Claude Code plugin manifest + skill output

This directory is the plugin surface the Claude Code loader reads.

## What lives here

- `plugin.json` — hand-authored plugin manifest (name, version,
  description, keywords).
- `skills/<workflow>/` — **generated** skill JSON files. One folder per
  workflow that registers a slash command. Each folder contains
  `circuit.json` (the default mode) and any per-mode variants
  (e.g. `lite.json`).
- `commands/` — empty placeholder. Slash-command markdown lives at the
  repo root under `commands/`; the plugin loader picks it up from
  there.

## Editing rules

- `plugin.json` — edit by hand.
- `skills/<workflow>/*.json` — **do not edit by hand**. Edit the
  workflow's recipe (`src/workflows/<id>/recipe.json`) and run
  `npm run emit-workflows`. The drift check (`npm run emit-workflows
  -- --check`) fails CI if a generated file diverges from the source.

## Why generated

The runtime composes a `Workflow` from each recipe via the catalog and
emit pipeline. This is the canonical source. Hand-edited skill JSON
would silently diverge from the recipe and break the runtime contract.
