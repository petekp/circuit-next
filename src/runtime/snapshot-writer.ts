import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Snapshot } from '../schemas/snapshot.js';
import { readRunLog } from './event-log-reader.js';
import { reduce } from './reducer.js';

// Reducer-derived snapshot writer. state.json is NEVER authored
// independently: it is always the output of `reduce(readRunLog(runRoot))`.
// This writer is the only path by which state.json comes into being.
// A separate path (e.g. a step executor writing state.json directly)
// would break RUN-I7 (events_consumed === log.length) on the next read.

export function snapshotPath(runRoot: string): string {
  return join(runRoot, 'state.json');
}

export function deriveSnapshot(runRoot: string): Snapshot {
  const log = readRunLog(runRoot);
  return reduce(log);
}

export function writeDerivedSnapshot(runRoot: string): Snapshot {
  const snapshot = deriveSnapshot(runRoot);
  const body = `${JSON.stringify(snapshot, null, 2)}\n`;
  writeFileSync(snapshotPath(runRoot), body);
  return snapshot;
}
