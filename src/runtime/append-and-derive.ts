import type { Snapshot } from '../schemas/snapshot.js';
import type { TraceEntry } from '../schemas/trace-entry.js';
import { writeDerivedSnapshot } from './snapshot-writer.js';
import { appendTraceEntry } from './trace-writer.js';

export interface AppendResult {
  snapshot: Snapshot;
}

export function appendAndDerive(runFolder: string, trace_entry: TraceEntry): AppendResult {
  appendTraceEntry(runFolder, trace_entry);
  const snapshot = writeDerivedSnapshot(runFolder);
  return { snapshot };
}
