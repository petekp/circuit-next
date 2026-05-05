import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { RunResult } from '../schemas/result.js';
import { runResultPath } from '../shared/result-path.js';

// RESULT-I1 — <run-folder>/reports/result.json is authored once at close
// and never mutated.
//
// This module owns retained-runtime result.json writing.
// The shape is enforced by `RunResult` in src/schemas/result.ts; this
// writer re-parses through that schema before persisting so a caller
// cannot smuggle a structurally invalid result past the boundary.

export function resultPath(runFolder: string): string {
  return runResultPath(runFolder);
}

export function writeResult(runFolder: string, candidate: unknown): RunResult {
  const parsed = RunResult.parse(candidate);
  const path = resultPath(runFolder);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(parsed, null, 2)}\n`);
  return parsed;
}
