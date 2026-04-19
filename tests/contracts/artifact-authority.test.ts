import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const ARTIFACTS_PATH = join(REPO_ROOT, 'specs', 'artifacts.json');

const SURFACE_CLASSES = new Set([
  'greenfield',
  'successor-to-live',
  'legacy-compatible',
  'migration-source',
  'external-protocol',
  'unknown-blocking',
]);

const COMPATIBILITY_POLICIES = new Set(['n/a', 'clean-break', 'parse-legacy', 'unknown']);

const REQUIRED_BASE_FIELDS = [
  'id',
  'surface_class',
  'compatibility_policy',
  'description',
  'schema_file',
  'schema_exports',
  'writers',
  'readers',
  'backing_paths',
  'identity_fields',
  'dangerous_sinks',
  'trust_boundary',
];

const NON_GREENFIELD_REQUIRED = [
  'reference_surfaces',
  'reference_evidence',
  'migration_policy',
  'legacy_parse_policy',
];

type Artifact = {
  id: string;
  surface_class: string;
  compatibility_policy: string;
  description: string;
  contract: string | null;
  schema_file: string | null;
  schema_exports: string[];
  writers: string[];
  readers: string[];
  resolvers?: string[];
  backing_paths: string[];
  identity_fields: string[];
  path_derived_fields?: string[];
  dangerous_sinks: string[];
  trust_boundary: string;
  reference_surfaces?: string[];
  reference_evidence?: string[];
  migration_policy?: string;
  legacy_parse_policy?: string;
  dangling_reference_policy?: string;
};

type ArtifactsFile = {
  version: number;
  artifacts: Artifact[];
};

function loadArtifacts(): ArtifactsFile {
  const raw = readFileSync(ARTIFACTS_PATH, 'utf-8');
  return JSON.parse(raw);
}

describe('specs/artifacts.json — authority graph shape', () => {
  const file = loadArtifacts();

  it('parses as JSON', () => {
    expect(file).toBeDefined();
    expect(file.version).toBe(1);
    expect(Array.isArray(file.artifacts)).toBe(true);
    expect(file.artifacts.length).toBeGreaterThan(0);
  });

  it('has unique artifact ids', () => {
    const ids = file.artifacts.map((a) => a.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('uses only known surface_class values', () => {
    for (const artifact of file.artifacts) {
      expect(
        SURFACE_CLASSES.has(artifact.surface_class),
        `${artifact.id} has unknown surface_class ${artifact.surface_class}`,
      ).toBe(true);
    }
  });

  it('uses only known compatibility_policy values', () => {
    for (const artifact of file.artifacts) {
      expect(
        COMPATIBILITY_POLICIES.has(artifact.compatibility_policy),
        `${artifact.id} has unknown compatibility_policy ${artifact.compatibility_policy}`,
      ).toBe(true);
    }
  });

  it('every artifact has required base fields', () => {
    for (const artifact of file.artifacts) {
      for (const field of REQUIRED_BASE_FIELDS) {
        expect(
          Object.hasOwn(artifact, field),
          `${artifact.id} is missing required base field ${field}`,
        ).toBe(true);
      }
    }
  });

  it('schema_exports is a non-empty array for every artifact with a schema_file', () => {
    for (const artifact of file.artifacts) {
      if (artifact.schema_file) {
        expect(Array.isArray(artifact.schema_exports)).toBe(true);
        expect(artifact.schema_exports.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('specs/artifacts.json — class-conditional fields', () => {
  const file = loadArtifacts();

  it('every non-greenfield / non-external-protocol artifact declares reference + migration fields', () => {
    for (const artifact of file.artifacts) {
      if (
        artifact.surface_class === 'greenfield' ||
        artifact.surface_class === 'external-protocol'
      ) {
        continue;
      }
      for (const field of NON_GREENFIELD_REQUIRED) {
        expect(
          Object.hasOwn(artifact, field),
          `${artifact.id} (${artifact.surface_class}) missing ${field}`,
        ).toBe(true);
      }
      expect(
        artifact.compatibility_policy,
        `${artifact.id} has compatibility_policy=unknown which blocks contract authorship`,
      ).not.toBe('unknown');
    }
  });

  it('successor-to-live artifacts declare a non-empty reference characterization', () => {
    for (const artifact of file.artifacts) {
      if (artifact.surface_class !== 'successor-to-live') continue;
      expect(
        artifact.reference_surfaces?.length ?? 0,
        `${artifact.id} has empty reference_surfaces`,
      ).toBeGreaterThan(0);
      expect(
        artifact.reference_evidence?.length ?? 0,
        `${artifact.id} has empty reference_evidence`,
      ).toBeGreaterThan(0);
    }
  });

  it('every declared reference_evidence file exists on disk', () => {
    for (const artifact of file.artifacts) {
      if (!artifact.reference_evidence) continue;
      for (const relPath of artifact.reference_evidence) {
        const abs = join(REPO_ROOT, relPath);
        expect(existsSync(abs), `${artifact.id}: reference_evidence missing — ${relPath}`).toBe(
          true,
        );
      }
    }
  });
});

describe('specs/artifacts.json — continuity is successor-to-live clean-break', () => {
  const file = loadArtifacts();
  const byId = new Map(file.artifacts.map((a) => [a.id, a]));

  it('contains continuity.record', () => {
    expect(byId.has('continuity.record')).toBe(true);
  });

  it('contains continuity.index', () => {
    expect(byId.has('continuity.index')).toBe(true);
  });

  it('continuity.record is NOT greenfield', () => {
    const record = byId.get('continuity.record');
    expect(record?.surface_class).not.toBe('greenfield');
  });

  it('continuity.index is NOT greenfield', () => {
    const index = byId.get('continuity.index');
    expect(index?.surface_class).not.toBe('greenfield');
  });

  it('continuity.record has compatibility_policy=clean-break', () => {
    expect(byId.get('continuity.record')?.compatibility_policy).toBe('clean-break');
  });

  it('continuity.index has compatibility_policy=clean-break', () => {
    expect(byId.get('continuity.index')?.compatibility_policy).toBe('clean-break');
  });

  it('continuity.record and continuity.index have legacy_parse_policy=reject', () => {
    expect(byId.get('continuity.record')?.legacy_parse_policy).toBe('reject');
    expect(byId.get('continuity.index')?.legacy_parse_policy).toBe('reject');
  });

  it('continuity.record uses record_id as path_derived_field', () => {
    const record = byId.get('continuity.record');
    expect(record?.path_derived_fields).toContain('record_id');
    expect(record?.identity_fields).toContain('record_id');
  });
});
