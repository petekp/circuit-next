export {
  type ManifestSnapshotInput,
  manifestSnapshotPath,
  readManifestSnapshot,
  verifyManifestSnapshotBytes,
  writeManifestSnapshot,
} from '../shared/manifest-snapshot.js';

// Runtime compatibility surface. Manifest snapshot byte-match semantics now
// live in `src/shared/manifest-snapshot.ts`; retained runtime callers can keep
// importing the old path while ownership narrows out of `src/runtime/`.
