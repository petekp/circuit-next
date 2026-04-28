import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Snapshot } from '../schemas/snapshot.js';
import { reduce } from './reducer.js';
import { readRunTrace } from './trace-reader.js';

// Reducer-derived snapshot writer. state.json is NEVER authored
// independently: it is always the output of `reduce(readRunTrace(runFolder))`.
// This writer is the only path by which state.json comes into being.
// A separate path (e.g. a step executor writing state.json directly)
// would break RUN-I7 (trace_entries_consumed === log.length) on the next read.

export function snapshotPath(runFolder: string): string {
  return join(runFolder, 'state.json');
}

export function deriveSnapshot(runFolder: string): Snapshot {
  const log = readRunTrace(runFolder);
  return reduce(log);
}

export function writeDerivedSnapshot(runFolder: string): Snapshot {
  const snapshot = deriveSnapshot(runFolder);
  const body = `${JSON.stringify(snapshot, null, 2)}\n`;
  writeFileSync(snapshotPath(runFolder), body);
  return snapshot;
}
