import { existsSync, readFileSync } from 'node:fs';
import { RunTrace } from '../schemas/run.js';
import { TraceEntry } from '../schemas/trace-entry.js';
import { trace_entryLogPath } from './trace-writer.js';

// NDJSON reader for trace.ndjson. Each non-empty line must parse as a
// single `TraceEntry`; the full array must parse as a `RunTrace` (which enforces
// RUN-I1..I5: bootstrap-first, bootstrap-singleton, sequence contiguity,
// run_id consistency, at-most-one-close-last).
//
// MVP: malformed lines fail loudly. The reader rejects any malformed
// line (including the last one) because runtime-proof writes all trace_entrys
// through `appendTraceEntry`, which parses and JSON-encodes atomically; a
// malformed line would indicate a crash mid-write, not a normal tail.

export function readTraceEntryLogRaw(runFolder: string): TraceEntry[] {
  const path = trace_entryLogPath(runFolder);
  if (!existsSync(path)) return [];
  const text = readFileSync(path, 'utf8');
  if (text.length === 0) return [];
  const lines = text.split('\n');
  const trace_entrys: TraceEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (i === lines.length - 1 && line === '') continue; // trailing newline
    if (line === '') {
      throw new Error(
        `trace.ndjson: blank line at index ${i} — only the trailing newline may be empty`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      throw new Error(`trace.ndjson: line ${i} is not valid JSON: ${(err as Error).message}`);
    }
    const trace_entry = TraceEntry.parse(parsed);
    trace_entrys.push(trace_entry);
  }
  return trace_entrys;
}

export function readRunTrace(runFolder: string): RunTrace {
  const raw = readTraceEntryLogRaw(runFolder);
  return RunTrace.parse(raw);
}
