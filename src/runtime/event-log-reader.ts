import { existsSync, readFileSync } from 'node:fs';
import { Event } from '../schemas/event.js';
import { RunLog } from '../schemas/run.js';
import { eventLogPath } from './event-writer.js';

// NDJSON reader for events.ndjson. Each non-empty line must parse as a
// single `Event`; the full array must parse as a `RunLog` (which enforces
// RUN-I1..I5: bootstrap-first, bootstrap-singleton, sequence contiguity,
// run_id consistency, at-most-one-close-last).
//
// MVP: malformed lines fail loudly. The reader rejects any malformed
// line (including the last one) because dogfood-run-0 writes all events
// through `appendEvent`, which parses and JSON-encodes atomically; a
// malformed line would indicate a crash mid-write, not a normal tail.

export function readEventLogRaw(runRoot: string): Event[] {
  const path = eventLogPath(runRoot);
  if (!existsSync(path)) return [];
  const text = readFileSync(path, 'utf8');
  if (text.length === 0) return [];
  const lines = text.split('\n');
  const events: Event[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (i === lines.length - 1 && line === '') continue; // trailing newline
    if (line === '') {
      throw new Error(
        `events.ndjson: blank line at index ${i} — only the trailing newline may be empty`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      throw new Error(`events.ndjson: line ${i} is not valid JSON: ${(err as Error).message}`);
    }
    const event = Event.parse(parsed);
    events.push(event);
  }
  return events;
}

export function readRunLog(runRoot: string): RunLog {
  const raw = readEventLogRaw(runRoot);
  return RunLog.parse(raw);
}
