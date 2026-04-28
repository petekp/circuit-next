import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { RunResult } from '../schemas/result.js';

// RESULT-I1 — <run-folder>/reports/result.json is authored once at close
// and never mutated.
//
// This module is the ONLY path by which result.json comes into being.
// The shape is enforced by `RunResult` in src/schemas/result.ts; this
// writer re-parses through that schema before persisting so a caller
// cannot smuggle a structurally invalid result past the boundary.

export function resultPath(runFolder: string): string {
  return join(runFolder, 'reports', 'result.json');
}

export function writeResult(runFolder: string, candidate: unknown): RunResult {
  const parsed = RunResult.parse(candidate);
  const path = resultPath(runFolder);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(parsed, null, 2)}\n`);
  return parsed;
}
