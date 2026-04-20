import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { RunResult } from '../schemas/result.js';

// RESULT-I1 — <run-root>/artifacts/result.json is authored once at close
// and never mutated. The writer is wired at Slice 27d (dogfood-run-0)
// per ADR-0001 Addendum B §Phase 1.5 Close Criteria #5.
//
// This module is the ONLY path by which result.json comes into being.
// The shape is enforced by `RunResult` in src/schemas/result.ts; this
// writer re-parses through that schema before persisting so a caller
// cannot smuggle a structurally invalid result past the boundary.

export function resultPath(runRoot: string): string {
  return join(runRoot, 'artifacts', 'result.json');
}

export function writeResult(runRoot: string, candidate: unknown): RunResult {
  const parsed = RunResult.parse(candidate);
  const path = resultPath(runRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(parsed, null, 2)}\n`);
  return parsed;
}
