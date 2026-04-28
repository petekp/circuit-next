# .claude-plugin/ — Claude Code plugin manifest + skill output

This directory is the plugin surface the Claude Code loader reads.

## What lives here

- `plugin.json` — hand-authored plugin manifest (name, version,
  description, keywords).
- `skills/<flow>/` — **generated** skill JSON files. One folder per
  flow that registers a slash command. Each folder contains
  `circuit.json` (the default mode) and any per-mode variants
  (e.g. `lite.json`).
- `commands/` — empty placeholder. Slash-command markdown lives at the
  repo root under `commands/`; the plugin loader picks it up from
  there.

## Editing rules

- `plugin.json` — edit by hand.
- `skills/<flow>/*.json` — **do not edit by hand**. Edit the
  flow's schematic (`src/flows/<id>/schematic.json`) and run
  `npm run emit-flows`. The drift check
  (`npm run emit-flows -- --check`) fails CI if a generated file
  diverges from the source.

## Why generated

The runtime composes a compiled flow from each schematic via the catalog
and emit pipeline. This is the canonical source. Hand-edited skill JSON
would silently diverge from the schematic and break the runtime contract.
