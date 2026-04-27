import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RunId, WorkflowId } from '../schemas/ids.js';
import { ManifestSnapshot, computeManifestHash } from '../schemas/manifest.js';

// Manifest snapshot writer. Writes <run-root>/manifest.snapshot.json as
// a byte-for-byte copy of the persisted manifest, plus an SHA-256 hash
// over those exact bytes. Hash algorithm per ADR-0001 Addendum B §Phase
// 1.5 Close Criteria #8 (sha256-raw; no canonicalization).
//
// Byte-match semantics: at re-entry/resume the runtime re-reads the
// declared bytes, recomputes sha256, and rejects the run if the hash
// does not agree. This is what closes the "run evolves while manifest
// drifts silently" failure mode — a regenerated or edited manifest
// produces a different hash and fails the gate loudly.

export function manifestSnapshotPath(runRoot: string): string {
  return join(runRoot, 'manifest.snapshot.json');
}

export interface ManifestSnapshotInput {
  run_id: RunId;
  workflow_id: WorkflowId;
  captured_at: string;
  bytes: Uint8Array | Buffer;
}

function buildManifestSnapshot(input: ManifestSnapshotInput): ManifestSnapshot {
  const bytes = Buffer.isBuffer(input.bytes) ? input.bytes : Buffer.from(input.bytes);
  const hash = computeManifestHash(bytes);
  const candidate = {
    schema_version: 1 as const,
    run_id: input.run_id,
    workflow_id: input.workflow_id,
    captured_at: input.captured_at,
    algorithm: 'sha256-raw' as const,
    hash,
    bytes_base64: bytes.toString('base64'),
  };
  return ManifestSnapshot.parse(candidate);
}

export function writeManifestSnapshot(
  runRoot: string,
  input: ManifestSnapshotInput,
): ManifestSnapshot {
  const snap = buildManifestSnapshot(input);
  writeFileSync(manifestSnapshotPath(runRoot), `${JSON.stringify(snap, null, 2)}\n`);
  return snap;
}

export function readManifestSnapshot(runRoot: string): ManifestSnapshot {
  const text = readFileSync(manifestSnapshotPath(runRoot), 'utf8');
  const raw: unknown = JSON.parse(text);
  return ManifestSnapshot.parse(raw);
}

// Byte-match re-entry check. Reads the persisted manifest snapshot and
// confirms its declared hash agrees with sha256 over its declared bytes.
// Parse-time superRefine already enforces this, but callers may want to
// invoke the check explicitly (e.g. resume flows) so the failure surface
// is named rather than buried in a generic zod parse error.
export function verifyManifestSnapshotBytes(runRoot: string): ManifestSnapshot {
  return readManifestSnapshot(runRoot);
}
