import type { Event } from '../schemas/event.js';
import type { Snapshot } from '../schemas/snapshot.js';
import { appendEvent } from './event-writer.js';
import { writeDerivedSnapshot } from './snapshot-writer.js';

export interface AppendResult {
  snapshot: Snapshot;
}

export function appendAndDerive(runRoot: string, event: Event): AppendResult {
  appendEvent(runRoot, event);
  const snapshot = writeDerivedSnapshot(runRoot);
  return { snapshot };
}
