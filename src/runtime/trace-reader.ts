import { existsSync, readFileSync } from 'node:fs';
import { RunTrace } from '../schemas/run.js';
import { TraceEntry } from '../schemas/trace-entry.js';
import { traceEntryLogPath } from './trace-writer.js';

// NDJSON reader for trace.ndjson. Each non-empty line must parse as a
// single `TraceEntry`; the full array must parse as a `RunTrace`, which
// enforces the log-level invariants (bootstrap-first, bootstrap-singleton,
// sequence contiguity, run_id consistency, at-most-one-close-last).
//
// Malformed lines fail loudly. The runtime writes every entry through
// `appendTraceEntry`, which parses and JSON-encodes atomically; a
// malformed line indicates a crash mid-write, not a normal tail, and
// must not be silently skipped.

export function readTraceEntryLogRaw(runFolder: string): TraceEntry[] {
  const path = traceEntryLogPath(runFolder);
  if (!existsSync(path)) return [];
  const text = readFileSync(path, 'utf8');
  if (text.length === 0) return [];
  const lines = text.split('\n');
  const trace_entries: TraceEntry[] = [];
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
    trace_entries.push(trace_entry);
  }
  return trace_entries;
}

export function readRunTrace(runFolder: string): RunTrace {
  const raw = readTraceEntryLogRaw(runFolder);
  return RunTrace.parse(raw);
}
