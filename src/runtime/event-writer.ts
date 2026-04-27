import { closeSync, openSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { Event } from '../schemas/event.js';

// Append-only writer for events.ndjson. The writer's contract:
//   1. Every append is a full-line atomic write: one JSON object, one "\n".
//   2. The writer opens with O_APPEND (node's "a" flag) so concurrent
//      appends land at the logical end of file without truncation or
//      overwrite. The append-only property is a WRITER property, not a
//      schema property — a test that only parses the resulting NDJSON
//      cannot see overwrites that left a well-formed tail behind.
//   3. `sequence` is the authoritative ordering key; the writer does NOT
//      validate sequence contiguity across appends (that is a RunLog
//      property checked at read time). The writer DOES re-parse the event
//      through the `Event` schema before writing, so structurally invalid
//      events never touch disk.

export function eventLogPath(runRoot: string): string {
  return join(runRoot, 'events.ndjson');
}

export function appendEvent(runRoot: string, event: Event): void {
  const parsed = Event.parse(event);
  const line = `${JSON.stringify(parsed)}\n`;
  const path = eventLogPath(runRoot);
  const fd = openSync(path, 'a');
  try {
    writeSync(fd, line);
  } finally {
    closeSync(fd);
  }
}
