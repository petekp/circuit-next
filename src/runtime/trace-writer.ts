import { closeSync, openSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { TraceEntry } from '../schemas/trace-entry.js';

// Append-only writer for trace.ndjson. The writer's contract:
//   1. Every append is a full-line atomic write: one JSON object, one "\n".
//   2. The writer opens with O_APPEND (node's "a" flag) so concurrent
//      appends land at the logical end of file without truncation or
//      overwrite. The append-only property is a WRITER property, not a
//      schema property — a test that only parses the resulting NDJSON
//      cannot see overwrites that left a well-formed tail behind.
//   3. `sequence` is the authoritative ordering key; the writer does NOT
//      validate sequence contiguity across appends (that is a RunTrace
//      property checked at read time). The writer DOES re-parse the trace_entry
//      through the `TraceEntry` schema before writing, so structurally invalid
//      trace_entries never touch disk.

export function traceEntryLogPath(runFolder: string): string {
  return join(runFolder, 'trace.ndjson');
}

export function appendTraceEntry(runFolder: string, trace_entry: TraceEntry): void {
  const parsed = TraceEntry.parse(trace_entry);
  const line = `${JSON.stringify(parsed)}\n`;
  const path = traceEntryLogPath(runFolder);
  const fd = openSync(path, 'a');
  try {
    writeSync(fd, line);
  } finally {
    closeSync(fd);
  }
}
