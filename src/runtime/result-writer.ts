import type { RunResult } from '../schemas/result.js';
import { runResultPath } from '../shared/result-path.js';
import { RETIRED_RUNTIME_FRESH_INVOCATION_MESSAGE } from '../shared/retired-runtime-policy.js';

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

export function writeResult(): RunResult {
  throw new Error(RETIRED_RUNTIME_FRESH_INVOCATION_MESSAGE);
}
