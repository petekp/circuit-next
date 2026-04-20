import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Event } from '../schemas/event.js';
import type { RunId, WorkflowId } from '../schemas/ids.js';
import type { Snapshot } from '../schemas/snapshot.js';
import { appendEvent, eventLogPath } from './event-writer.js';
import {
  type ManifestSnapshotInput,
  manifestSnapshotPath,
  writeManifestSnapshot,
} from './manifest-snapshot-writer.js';
import { writeDerivedSnapshot } from './snapshot-writer.js';

// Minimal runner boundary for Slice 27c. The full dogfood-run-0
// execution loop lands in Slice 27d; this module exists to (a) satisfy
// the 27b inventory's `runner.entrypoint` detection by providing a
// non-placeholder src/runtime/ export and (b) give 27d a single place
// to compose the writer/reducer/manifest surfaces without reaching into
// their individual modules.

export interface RunRootInit {
  runRoot: string;
}

export function initRunRoot({ runRoot }: RunRootInit): void {
  mkdirSync(runRoot, { recursive: true });
  // Touch the directory the event log will live in. `eventLogPath`
  // returns a file path; its parent is the run root we just created.
  mkdirSync(dirname(eventLogPath(runRoot)), { recursive: true });
}

export interface BootstrapInput {
  runRoot: string;
  manifest: ManifestSnapshotInput;
  bootstrapEvent: Event;
}

export interface BootstrapResult {
  manifestSnapshotPath: string;
  eventLogPath: string;
  snapshot: Snapshot;
}

// Compose bootstrap: write manifest snapshot (byte-match), append the
// run.bootstrapped event, derive-and-write state.json. The caller is
// responsible for constructing a validated Event; this function does
// NOT generate identities. 27d will wire in identity construction.
export function bootstrapRun(input: BootstrapInput): BootstrapResult {
  initRunRoot({ runRoot: input.runRoot });
  writeManifestSnapshot(input.runRoot, input.manifest);
  appendEvent(input.runRoot, input.bootstrapEvent);
  const snapshot = writeDerivedSnapshot(input.runRoot);
  return {
    manifestSnapshotPath: manifestSnapshotPath(input.runRoot),
    eventLogPath: eventLogPath(input.runRoot),
    snapshot,
  };
}

export interface AppendResult {
  snapshot: Snapshot;
}

// Append an event and re-derive the snapshot in one step. 27d's step
// executor will call this once per runtime event.
export function appendAndDerive(runRoot: string, event: Event): AppendResult {
  appendEvent(runRoot, event);
  const snapshot = writeDerivedSnapshot(runRoot);
  return { snapshot };
}

export type { RunId, WorkflowId };
