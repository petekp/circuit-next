import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  SCHEMA_FILE_ALLOWLIST,
  collectSchemaExports,
  contractReciprocatesArtifact,
  planeIsValid,
  readFrontmatter,
  schemaExportPresent,
  trustBoundaryHasOriginToken,
} from '../../scripts/audit.mjs';

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
  plane?: string;
  description: string;
  contract: string;
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
    expect(file.version).toBe(2);
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

  // Slice 11 — schema_exports existence hardening.
  it('every schema_exports name is actually `export const <name>`d from its schema_file', () => {
    for (const artifact of file.artifacts) {
      if (!artifact.schema_file) continue;
      const schemaAbs = join(REPO_ROOT, artifact.schema_file);
      const src = readFileSync(schemaAbs, 'utf-8');
      for (const name of artifact.schema_exports) {
        expect(
          schemaExportPresent(src, name),
          `${artifact.id}: schema_exports names "${name}" but it is not export const-d from ${artifact.schema_file}`,
        ).toBe(true);
      }
    }
  });
});

describe('schema_exports existence checker — constructed-violation guard (Slice 11)', () => {
  it('accepts names that appear as `export const <name>`', () => {
    const src = 'export const Foo = 1;\nexport const Bar = 2;\n';
    expect(schemaExportPresent(src, 'Foo')).toBe(true);
    expect(schemaExportPresent(src, 'Bar')).toBe(true);
  });

  it('rejects names that do not appear at all', () => {
    const src = 'export const Foo = 1;\n';
    expect(schemaExportPresent(src, 'Missing')).toBe(false);
  });

  it('rejects names that appear only as export {name} re-exports (not the defining site)', () => {
    const src = "export { Foo } from './other.js';\n";
    expect(schemaExportPresent(src, 'Foo')).toBe(false);
  });

  it('rejects substring matches (word-boundary enforced)', () => {
    const src = 'export const FooBar = 1;\n';
    expect(schemaExportPresent(src, 'Foo')).toBe(false);
    expect(schemaExportPresent(src, 'Bar')).toBe(false);
  });

  it('accepts name at end of file (trailing newline not required)', () => {
    const src = 'export const Foo = 1';
    expect(schemaExportPresent(src, 'Foo')).toBe(true);
  });

  it('accepts name on its own line even when other exports surround it', () => {
    const src = '// header\n\nexport const Alpha = z.string();\nexport const Beta = z.number();\n';
    expect(schemaExportPresent(src, 'Alpha')).toBe(true);
    expect(schemaExportPresent(src, 'Beta')).toBe(true);
  });

  // Slice 23 (Codex HIGH #6 fold-in): regex was broadened from `export const`
  // only to `export (const|type|function|class)` so that type-only exports
  // like `AppliedEntry` and `JsonObject` are not silently outside the
  // ledger. Full TS AST-based coverage remains v0.2 scope.
  it('accepts `export function <name>` defining form', () => {
    const src = 'export function helper() {}\n';
    expect(schemaExportPresent(src, 'helper')).toBe(true);
  });

  it('accepts `export type <name>` defining form (type-only alias)', () => {
    const src = 'export type AppliedEntry = { layer: string };\n';
    expect(schemaExportPresent(src, 'AppliedEntry')).toBe(true);
  });

  it('accepts `export class <name>` defining form', () => {
    const src = 'export class Helper {}\n';
    expect(schemaExportPresent(src, 'Helper')).toBe(true);
  });

  it('rejects when `export const` is commented out', () => {
    const src = '// export const Foo = 1\n';
    expect(schemaExportPresent(src, 'Foo')).toBe(false);
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

// Slice 12 (ADR-0004) — plane classifier + data-plane trust-boundary-detail rule.
// v2 (ADR-0005): plane is structurally required on every artifact; no deferral allowlist.
describe('specs/artifacts.json — plane classifier (ADR-0004, v2 per ADR-0005)', () => {
  const file = loadArtifacts();
  const byId = new Map(file.artifacts.map((a) => [a.id, a]));

  it('every artifact declares plane (v2 required)', () => {
    for (const artifact of file.artifacts) {
      expect(
        Object.hasOwn(artifact, 'plane'),
        `${artifact.id}: must declare plane (v2 structurally required — ADR-0005)`,
      ).toBe(true);
    }
  });

  it('every declared plane is in the closed set {control-plane, data-plane}', () => {
    for (const artifact of file.artifacts) {
      expect(
        planeIsValid(artifact.plane),
        `${artifact.id}: plane "${artifact.plane}" is not in the closed set`,
      ).toBe(true);
    }
  });

  it('every data-plane artifact declares an origin token in trust_boundary', () => {
    for (const artifact of file.artifacts) {
      if (artifact.plane !== 'data-plane') continue;
      expect(
        trustBoundaryHasOriginToken(artifact.trust_boundary),
        `${artifact.id} (data-plane): trust_boundary does not name an origin token — got "${artifact.trust_boundary}"`,
      ).toBe(true);
    }
  });

  // Slice 12 + ADR-0005 v2 — pinned classifications. Positive assertions on exemplar
  // artifacts from each category so a rename or typo fails a named test rather than
  // hiding inside the generic "plane is valid" assertion.
  it('workflow.definition is classified control-plane', () => {
    expect(byId.get('workflow.definition')?.plane).toBe('control-plane');
  });

  it('skill.descriptor is classified control-plane', () => {
    expect(byId.get('skill.descriptor')?.plane).toBe('control-plane');
  });

  it('run.log is classified data-plane', () => {
    expect(byId.get('run.log')?.plane).toBe('data-plane');
  });

  it('continuity.record is classified data-plane', () => {
    expect(byId.get('continuity.record')?.plane).toBe('data-plane');
  });

  it('continuity.index is classified data-plane', () => {
    expect(byId.get('continuity.index')?.plane).toBe('data-plane');
  });

  // ADR-0005 — the three artifacts deferred at v1 are now classified data-plane under
  // the worst-case-producer rule. Pinned positively so a future accidental flip back to
  // missing/deferred surfaces as a named failure.
  it('selection.override is classified data-plane (ADR-0005)', () => {
    expect(byId.get('selection.override')?.plane).toBe('data-plane');
  });

  it('adapter.registry is classified data-plane (ADR-0005)', () => {
    expect(byId.get('adapter.registry')?.plane).toBe('data-plane');
  });

  it('adapter.reference is classified data-plane (ADR-0005)', () => {
    expect(byId.get('adapter.reference')?.plane).toBe('data-plane');
  });
});

describe('plane classifier helper — constructed-violation guard (Slice 12)', () => {
  it('planeIsValid accepts control-plane and data-plane', () => {
    expect(planeIsValid('control-plane')).toBe(true);
    expect(planeIsValid('data-plane')).toBe(true);
  });

  it('planeIsValid rejects unknown values', () => {
    expect(planeIsValid('config-plane')).toBe(false);
    expect(planeIsValid('mixed')).toBe(false);
    expect(planeIsValid('')).toBe(false);
    expect(planeIsValid('CONTROL-PLANE')).toBe(false);
  });

  it('planeIsValid rejects non-string values', () => {
    expect(planeIsValid(undefined)).toBe(false);
    expect(planeIsValid(null)).toBe(false);
    expect(planeIsValid(0)).toBe(false);
    expect(planeIsValid({})).toBe(false);
  });
});

describe('trust-boundary origin-token helper — constructed-violation guard (Slice 12)', () => {
  it('accepts prose containing operator-local', () => {
    expect(trustBoundaryHasOriginToken('operator-local persisted state; append-only')).toBe(true);
  });

  it('accepts prose containing engine-computed', () => {
    expect(trustBoundaryHasOriginToken('engine-computed projection of the event log')).toBe(true);
  });

  it('accepts prose containing model-authored', () => {
    expect(trustBoundaryHasOriginToken('may carry model-authored narrative')).toBe(true);
  });

  // Codex fold-in HIGH #3 (ADR-0004): `mixed` is a cardinality of origins, not an
  // origin. A data-plane artifact whose trust_boundary says "mixed" and nothing else
  // fails the rule. ADR-0005 v2 classifies the three previously-deferred artifacts
  // as data-plane under the worst-case-producer rule; their trust_boundary prose no
  // longer begins with "mixed;".
  it('rejects prose containing only "mixed" (mixed is not an origin)', () => {
    expect(
      trustBoundaryHasOriginToken('mixed; plugin-layer is author-signed, operator layers differ'),
    ).toBe(false);
  });

  it('accepts prose with multiple origin tokens', () => {
    expect(
      trustBoundaryHasOriginToken(
        'operator-local persisted state; may contain model-authored narrative',
      ),
    ).toBe(true);
  });

  it('rejects prose with no origin token', () => {
    expect(trustBoundaryHasOriginToken('plugin-authored static definition; loaded read-only')).toBe(
      false,
    );
    expect(trustBoundaryHasOriginToken('author-signed static catalog projection')).toBe(false);
  });

  it('rejects empty or non-string inputs', () => {
    expect(trustBoundaryHasOriginToken('')).toBe(false);
    expect(trustBoundaryHasOriginToken(undefined)).toBe(false);
    expect(trustBoundaryHasOriginToken(null)).toBe(false);
    expect(trustBoundaryHasOriginToken(0)).toBe(false);
  });

  // Case-insensitive match — origin tokens are lowercased before comparison. Documented here
  // because the rule is prose-based and a case-bump in trust_boundary should still pass.
  it('matches case-insensitively', () => {
    expect(trustBoundaryHasOriginToken('Operator-Local persisted state')).toBe(true);
    expect(trustBoundaryHasOriginToken('ENGINE-COMPUTED projection')).toBe(true);
  });

  // Codex fold-in HIGH #2: naive substring matching would accept "never operator-local"
  // because `operator-local` is a substring. The negation-window check rejects origin-token
  // matches whose immediate left-context ends in "not ", "non-", "no ", or "never ".
  it('rejects "not X" — negated single-clause origin', () => {
    expect(trustBoundaryHasOriginToken('not operator-local; author-signed only')).toBe(false);
  });

  it('rejects "never X" — negated single-clause origin', () => {
    expect(trustBoundaryHasOriginToken('never operator-local; author-signed only')).toBe(false);
  });

  it('rejects "no X" — negated single-clause origin', () => {
    expect(trustBoundaryHasOriginToken('no operator-local writes; author-signed')).toBe(false);
  });

  it('rejects "non-X" — negated single-clause origin', () => {
    expect(trustBoundaryHasOriginToken('non-operator-local content only')).toBe(false);
  });

  // Positive-after-negative: the first clause negates, but a second clause affirms. The
  // rule is per-match; as long as ONE unnegated origin token appears, the prose passes.
  it('accepts prose where a later clause affirms an origin after earlier negation', () => {
    expect(
      trustBoundaryHasOriginToken(
        'never read from remote; operator-local persisted state authoritative',
      ),
    ).toBe(true);
  });

  // Defense-in-depth check: the real-world prose for run.projection says "operator-local
  // derived state; always recomputable from run.log; never authoritative over the log".
  // The "never" here refers to authority, not to "operator-local". The rule must pass.
  it('accepts run.projection-style prose (late-clause "never" does not negate early-clause origin)', () => {
    expect(
      trustBoundaryHasOriginToken(
        'operator-local derived state; always recomputable from run.log; never authoritative over the log',
      ),
    ).toBe(true);
  });
});

// ADR-0005 v2 — the deferral allowlist from Slice 12 is removed. `plane` is structurally
// required on every artifact. This block replaces the v1 deferral tests with a total-
// coverage assertion (back-stopped by the positive classifications above) and Codex
// MED #5 fold-in: a broader guard against reintroducing an escape hatch under any name.
describe('specs/artifacts.json — plane coverage (ADR-0005 v2)', () => {
  const file = loadArtifacts();

  it('every artifact has a plane (no deferrals)', () => {
    for (const artifact of file.artifacts) {
      expect(
        Object.hasOwn(artifact, 'plane'),
        `${artifact.id}: v2 requires plane on every artifact (ADR-0005). No deferral allowlist exists.`,
      ).toBe(true);
    }
  });

  // Codex MED #5 fold-in — the v1 escape hatch was named `plane_deferred` in the draft
  // and `PLANE_DEFERRED_IDS` in audit.mjs. A future regression might reintroduce the
  // concept under a different name. This test bans the most plausible aliases on every
  // artifact row, plus any key matching the pattern `plane_*defer*` case-insensitively.
  // If a genuine new field is needed, rename it to something that does not match the
  // pattern or write a superseding ADR.
  const DEFERRAL_ALIAS_FIELDS = [
    'plane_deferred',
    'plane_pending',
    'plane_status',
    'plane_rationale',
    'plane_exception',
    'plane_exempt',
  ];

  it('no artifact reintroduces a known deferral-alias field', () => {
    for (const artifact of file.artifacts) {
      const rec = artifact as unknown as Record<string, unknown>;
      for (const alias of DEFERRAL_ALIAS_FIELDS) {
        expect(
          Object.hasOwn(rec, alias),
          `${artifact.id}: ${alias} field is not part of the v2 schema — remove it or write a superseding ADR`,
        ).toBe(false);
      }
    }
  });

  it('no artifact has a field matching /plane.*defer|plane.*exempt|plane.*pending/i', () => {
    const pattern = /plane.*(?:defer|exempt|pending)/i;
    for (const artifact of file.artifacts) {
      const rec = artifact as unknown as Record<string, unknown>;
      for (const key of Object.keys(rec)) {
        expect(
          pattern.test(key),
          `${artifact.id}: field "${key}" matches a deferral-alias pattern; the v2 schema has no deferral escape hatch`,
        ).toBe(false);
      }
    }
  });
});

// Codex LOW #9 fold-in — pin the exact v2 trust_boundary strings for the three
// worst-case-classified artifacts. The token-match helper only asserts *an* origin
// appears; these tests assert the **specific** strings ADR-0005 committed to, so a
// silent prose edit that drops an origin or reintroduces "mixed;" would fail a named
// test rather than hide behind the generic token-match.
describe('specs/artifacts.json — v2 trust_boundary prose pinned (ADR-0005, Codex LOW #9)', () => {
  const file = loadArtifacts();
  const byId = new Map(file.artifacts.map((a) => [a.id, a]));

  const EXPECTED_TRUST_BOUNDARIES: Record<string, string> = {
    'selection.override':
      'operator-local at user-global/project layers and future invocation-layer projection; plugin-author-signed at the defaults layer; engine validates .strict() key closure and ghost-provenance rejection at parse time. Composition produces selection.resolution (separate artifact).',
    'adapter.registry':
      'operator-local at user-global/project/invocation layers; plugin-author-signed at the defaults layer; engine validates reserved-name disjointness, own-property closure, and registry-key/descriptor-name parity at parse time.',
    'adapter.reference':
      'operator-local at user-global/project/invocation layers; plugin-author-signed at the defaults layer; engine validates named-ref registry closure during resolution. MUST NOT appear in run.log (resolved-form-only per ADAPTER-I10).',
  };

  for (const [id, expected] of Object.entries(EXPECTED_TRUST_BOUNDARIES)) {
    it(`${id} trust_boundary matches the v2 pinned string`, () => {
      const artifact = byId.get(id);
      expect(artifact).toBeDefined();
      expect(artifact?.trust_boundary).toBe(expected);
    });
  }
});

// Codex fold-in MED #6: control-plane artifacts must not derive identity from filesystem
// paths. Plugin-authored static content's identity is determined by the plugin author at
// build time, not by filename.
describe('specs/artifacts.json — control-plane path-derivation ban (ADR-0004, Codex fold-in)', () => {
  const file = loadArtifacts();

  it('no control-plane artifact declares path_derived_fields', () => {
    for (const artifact of file.artifacts) {
      if (artifact.plane !== 'control-plane') continue;
      const pdf = artifact.path_derived_fields ?? [];
      expect(
        pdf.length,
        `${artifact.id} (control-plane): path_derived_fields must be empty; got [${pdf.join(', ')}]`,
      ).toBe(0);
    }
  });
});

// Slice 23 — reverse reciprocation check (HIGH #4, arc-phase-1-close-codex.md).
// An artifact row that names a contract file must be reciprocated: the contract's
// frontmatter `artifact_ids` list must include the artifact's id. Catches the
// failure mode where an artifact points at a contract that no longer claims it
// back (rename drift, copy-paste mistake, or dropped id during reorganization).
describe('specs/artifacts.json — contract reciprocation (ADR-0003, HIGH #4)', () => {
  const file = loadArtifacts();

  it('every artifact.contract points to an existing file', () => {
    for (const artifact of file.artifacts) {
      if (!artifact.contract) continue;
      const abs = join(REPO_ROOT, artifact.contract);
      expect(
        existsSync(abs),
        `${artifact.id}: contract "${artifact.contract}" does not exist on disk`,
      ).toBe(true);
    }
  });

  it("every artifact.contract's frontmatter lists the artifact id back in artifact_ids", () => {
    for (const artifact of file.artifacts) {
      if (!artifact.contract) continue;
      const abs = join(REPO_ROOT, artifact.contract);
      const { ok, frontmatter, error } = readFrontmatter(abs);
      expect(ok, `${artifact.id}: contract frontmatter unreadable — ${error ?? ''}`).toBe(true);
      if (!ok) continue;
      expect(
        contractReciprocatesArtifact(frontmatter, artifact.id),
        `${artifact.id}: contract "${artifact.contract}" does not reciprocate — its artifact_ids frontmatter does not contain "${artifact.id}"`,
      ).toBe(true);
    }
  });
});

describe('contractReciprocatesArtifact — constructed-violation guard (Slice 23)', () => {
  it('returns true when artifact_ids contains the id', () => {
    expect(contractReciprocatesArtifact({ artifact_ids: ['foo.bar'] }, 'foo.bar')).toBe(true);
  });

  it('returns true when artifact_ids lists several ids including the target', () => {
    expect(
      contractReciprocatesArtifact({ artifact_ids: ['a.one', 'b.two', 'c.three'] }, 'b.two'),
    ).toBe(true);
  });

  it('returns false when artifact_ids omits the id', () => {
    expect(contractReciprocatesArtifact({ artifact_ids: ['a.one'] }, 'b.two')).toBe(false);
  });

  it('returns false when artifact_ids is missing', () => {
    expect(contractReciprocatesArtifact({}, 'foo.bar')).toBe(false);
  });

  it('returns false when artifact_ids is not an array', () => {
    expect(contractReciprocatesArtifact({ artifact_ids: 'foo.bar' }, 'foo.bar')).toBe(false);
  });

  it('returns false when frontmatter is null or undefined', () => {
    expect(contractReciprocatesArtifact(null, 'foo.bar')).toBe(false);
    expect(contractReciprocatesArtifact(undefined, 'foo.bar')).toBe(false);
  });
});

// Slice 23 — schema-export coverage ledger (HIGH #4, arc-phase-1-close-codex.md).
// Every non-index file in src/schemas/ must be either bound to an artifact.schema_file
// OR explicitly allowlisted in SCHEMA_FILE_ALLOWLIST with a category + reason. Every
// `export const <Name>` in a bound file must appear in the owning artifact's
// schema_exports. This is the ledger that would have flagged config.ts schemas being
// absorbed by adapter.registry.schema_exports without a first-class config.* artifact
// (MED #18, named Knight-Leveson correlated miss tracked to Slice 26).
describe('src/schemas/ — schema-export coverage ledger (ADR-0003, HIGH #4)', () => {
  const file = loadArtifacts();
  const schemasDir = join(REPO_ROOT, 'src', 'schemas');
  const schemaFiles = readdirSync(schemasDir)
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
    .map((f) => `src/schemas/${f}`)
    .sort();
  const artifactSchemaFiles = new Set(
    file.artifacts.map((a) => a.schema_file).filter((v): v is string => typeof v === 'string'),
  );

  it('every non-index schema file is either bound to an artifact or on the allowlist', () => {
    for (const relPath of schemaFiles) {
      const bound = artifactSchemaFiles.has(relPath);
      const allowlisted = Object.hasOwn(SCHEMA_FILE_ALLOWLIST, relPath);
      expect(
        bound || allowlisted,
        `${relPath}: neither bound to an artifact nor in SCHEMA_FILE_ALLOWLIST — add an artifact row or allowlist with a reason`,
      ).toBe(true);
    }
  });

  it('no schema file is both bound to an artifact AND on the allowlist', () => {
    for (const relPath of schemaFiles) {
      const bound = artifactSchemaFiles.has(relPath);
      const allowlisted = Object.hasOwn(SCHEMA_FILE_ALLOWLIST, relPath);
      expect(
        bound && allowlisted,
        `${relPath}: remove from SCHEMA_FILE_ALLOWLIST (artifact binding wins)`,
      ).toBe(false);
    }
  });

  it('every allowlist entry has a recognized category and non-empty reason', () => {
    for (const [relPath, entry] of Object.entries(SCHEMA_FILE_ALLOWLIST)) {
      expect(['shared-primitive', 'pending-artifact']).toContain(entry.category);
      expect(entry.reason.length, `${relPath}: empty allowlist reason`).toBeGreaterThan(0);
    }
  });

  // Slice 23 Codex HIGH #4 fold-in: every allowlisted file must carry a
  // known_exports list, and every runtime export must appear in it. Closes
  // the "allowlisted file is a black box" gap named by the challenger.
  it('every allowlist entry has a non-empty known_exports list', () => {
    for (const [relPath, entry] of Object.entries(SCHEMA_FILE_ALLOWLIST)) {
      expect(
        Array.isArray(entry.known_exports) && entry.known_exports.length > 0,
        `${relPath}: known_exports must be a non-empty array`,
      ).toBe(true);
    }
  });

  it('every allowlisted file defines exactly the exports its entry lists', () => {
    for (const [relPath, entry] of Object.entries(SCHEMA_FILE_ALLOWLIST)) {
      const src = readFileSync(join(REPO_ROOT, relPath), 'utf-8');
      const defined = collectSchemaExports(src);
      const known = new Set(entry.known_exports);
      for (const name of defined) {
        expect(known.has(name), `${relPath}: defines ${name} but it is not in known_exports`).toBe(
          true,
        );
      }
      for (const name of known) {
        expect(
          defined.has(name),
          `${relPath}: known_exports lists ${name} but file does not define it`,
        ).toBe(true);
      }
    }
  });

  // Slice 23 Codex MED #9 fold-in: pending-artifact entries require
  // tracking_slice + tracking_objection fields so the TODO cannot rot.
  it('every pending-artifact entry has tracking_slice and tracking_objection', () => {
    for (const [relPath, entry] of Object.entries(SCHEMA_FILE_ALLOWLIST)) {
      if (entry.category !== 'pending-artifact') continue;
      expect(
        typeof entry.tracking_slice === 'number' && entry.tracking_slice > 0,
        `${relPath}: tracking_slice must be a positive integer`,
      ).toBe(true);
      expect(
        typeof entry.tracking_objection === 'string' && entry.tracking_objection.length > 0,
        `${relPath}: tracking_objection must be a non-empty citation`,
      ).toBe(true);
    }
  });

  it('every `export const <Name>` in a bound schema file is claimed by some artifact.schema_exports', () => {
    for (const relPath of schemaFiles) {
      if (!artifactSchemaFiles.has(relPath)) continue;
      const src = readFileSync(join(REPO_ROOT, relPath), 'utf-8');
      const defined = collectSchemaExports(src);
      const claimed = new Set<string>();
      for (const artifact of file.artifacts) {
        if (artifact.schema_file !== relPath) continue;
        if (!Array.isArray(artifact.schema_exports)) continue;
        for (const name of artifact.schema_exports) claimed.add(name);
      }
      for (const name of defined) {
        expect(
          claimed.has(name),
          `${relPath}: \`export const ${name}\` is not claimed by any artifact.schema_exports — add it to the owning artifact or refactor`,
        ).toBe(true);
      }
    }
  });
});

describe('collectSchemaExports — constructed-violation guard (Slice 23)', () => {
  it('collects top-level `export const <Name>` identifiers', () => {
    const src = 'export const Foo = 1;\nexport const Bar = 2;\n';
    const names = collectSchemaExports(src);
    expect(names.has('Foo')).toBe(true);
    expect(names.has('Bar')).toBe(true);
    expect(names.size).toBe(2);
  });

  // Slice 23 Codex MED #8 fold-in: the `_` filter was tightened from a broad
  // `!name.startsWith('_')` to a strict match on
  // `/^_compileTime[A-Z][A-Za-z0-9_]*Parity$/`. A non-guard `_`-prefixed name
  // is now INCLUDED in the set so the ledger can catch it — otherwise any
  // `_Foo` export would silently escape classification.
  it('excludes `_compileTime<Foo>Parity` compile-time parity guards', () => {
    const src = [
      'export const Real = 1;',
      'export const _compileTimeFooParity = 2;',
      'export const _compileTimeOutcomeStatusParity = 3;',
    ].join('\n');
    const names = collectSchemaExports(src);
    expect(names.has('Real')).toBe(true);
    expect(names.has('_compileTimeFooParity')).toBe(false);
    expect(names.has('_compileTimeOutcomeStatusParity')).toBe(false);
  });

  it('INCLUDES `_`-prefixed names that do not match the guard pattern', () => {
    const src = [
      'export const _Foo = 1;',
      'export const _compileTimeNoParitySuffix = 2;',
      'export const _internal = 3;',
    ].join('\n');
    const names = collectSchemaExports(src);
    expect(names.has('_Foo')).toBe(true);
    expect(names.has('_compileTimeNoParitySuffix')).toBe(true);
    expect(names.has('_internal')).toBe(true);
  });

  it('does not collect `export { Foo } from` re-exports', () => {
    const src = "export { Foo } from './other.js';\n";
    const names = collectSchemaExports(src);
    expect(names.has('Foo')).toBe(false);
  });

  it('collects `export type` declarations (Codex HIGH #6 fold-in)', () => {
    const src = 'export type Foo = number;\n';
    const names = collectSchemaExports(src);
    expect(names.has('Foo')).toBe(true);
  });

  it('does not collect commented-out exports', () => {
    const src = '// export const Foo = 1;\n';
    const names = collectSchemaExports(src);
    expect(names.has('Foo')).toBe(false);
  });

  it('returns an empty set for source with no defining exports', () => {
    const src = 'const Local = 1;\n// commented export const C = 2;\n';
    const names = collectSchemaExports(src);
    expect(names.size).toBe(0);
  });
});

// Slice 23 Codex HIGH #1 + HIGH #2 fold-ins: contract structurally required
// + exact contract-artifact reciprocation. Every artifact row MUST have a
// non-empty string `contract` path, and the set of artifact ids listed in a
// contract's frontmatter MUST equal the set of artifacts pointing at that
// contract. This closes the "false claim" drift where contract A.md lists
// an artifact that actually belongs to contract B.md.
describe('specs/artifacts.json — contract field discipline (Codex HIGH #1, HIGH #2)', () => {
  const file = loadArtifacts();

  it('every artifact has a non-empty string contract field', () => {
    for (const artifact of file.artifacts) {
      expect(
        Object.hasOwn(artifact, 'contract'),
        `${artifact.id}: contract field is structurally required`,
      ).toBe(true);
      expect(
        typeof artifact.contract === 'string' && (artifact.contract as string).length > 0,
        `${artifact.id}: contract must be a non-empty string path`,
      ).toBe(true);
    }
  });

  it('every id in a contract artifact_ids maps back to an artifact whose contract points here', () => {
    const contractsDir = join(REPO_ROOT, 'specs', 'contracts');
    const contractFiles = readdirSync(contractsDir).filter((f) => f.endsWith('.md'));
    const byId = new Map(file.artifacts.map((a) => [a.id, a]));
    for (const cf of contractFiles) {
      const result = readFrontmatter(join(contractsDir, cf));
      expect(result.ok, `${cf}: frontmatter unreadable`).toBe(true);
      if (!result.ok) continue;
      const ids = result.frontmatter.artifact_ids;
      if (!Array.isArray(ids)) continue;
      const expectedContract = `specs/contracts/${cf}`;
      for (const id of ids) {
        const art = byId.get(id as string);
        expect(art, `${cf}: artifact_ids references ${id} not in graph`).toBeDefined();
        if (!art) continue;
        expect(
          art.contract,
          `${cf}: claims ${id} but artifact's contract is ${JSON.stringify(art.contract)} (expected ${expectedContract})`,
        ).toBe(expectedContract);
      }
    }
  });

  it('every artifact whose contract points at a contract file appears in that file artifact_ids', () => {
    const contractsDir = join(REPO_ROOT, 'specs', 'contracts');
    for (const artifact of file.artifacts) {
      const result = readFrontmatter(join(REPO_ROOT, artifact.contract));
      expect(result.ok, `${artifact.id}: contract frontmatter unreadable`).toBe(true);
      if (!result.ok) continue;
      const ids = result.frontmatter.artifact_ids as string[] | undefined;
      expect(
        Array.isArray(ids) && ids.includes(artifact.id),
        `${artifact.id}: contract "${artifact.contract}" does not list ${artifact.id} in artifact_ids`,
      ).toBe(true);
      // unused variable — reserved for future additional assertion on
      // reciprocation symmetry beyond includes().
      void contractsDir;
    }
  });
});

// Slice 23 Codex HIGH #5 fold-in: pending_rehome metadata. A known
// misbinding (e.g. Config schemas temporarily claimed by adapter.registry
// until Slice 26 lands config.* artifact rows) must be machine-visible via
// a `pending_rehome: { target_slice, target_artifact_prefix, target_objection,
// items }` block on the hosting artifact. Audit + test assert shape.
describe('specs/artifacts.json — pending_rehome discipline (Codex HIGH #5)', () => {
  const file = loadArtifacts();

  it('every pending_rehome entry has target_slice (positive integer)', () => {
    for (const artifact of file.artifacts) {
      const pr = (artifact as { pending_rehome?: Record<string, unknown> }).pending_rehome;
      if (!pr) continue;
      expect(typeof pr.target_slice === 'number' && (pr.target_slice as number) > 0).toBe(true);
    }
  });

  it('every pending_rehome entry has target_artifact_prefix (non-empty string)', () => {
    for (const artifact of file.artifacts) {
      const pr = (artifact as { pending_rehome?: Record<string, unknown> }).pending_rehome;
      if (!pr) continue;
      expect(
        typeof pr.target_artifact_prefix === 'string' &&
          (pr.target_artifact_prefix as string).length > 0,
      ).toBe(true);
    }
  });

  it('every pending_rehome entry has non-empty items list', () => {
    for (const artifact of file.artifacts) {
      const pr = (artifact as { pending_rehome?: Record<string, unknown> }).pending_rehome;
      if (!pr) continue;
      expect(Array.isArray(pr.items) && (pr.items as unknown[]).length > 0).toBe(true);
    }
  });

  it('every pending_rehome entry has target_objection (non-empty citation)', () => {
    for (const artifact of file.artifacts) {
      const pr = (artifact as { pending_rehome?: Record<string, unknown> }).pending_rehome;
      if (!pr) continue;
      expect(
        typeof pr.target_objection === 'string' && (pr.target_objection as string).length > 0,
      ).toBe(true);
    }
  });

  // Slice 26 landing — the adapter.registry pending_rehome (Slice 26 / config.*)
  // rehome is complete. adapter.registry no longer carries a pending_rehome
  // block; the three config.* rows (config.root, config.layered,
  // config.circuit-override) now home the rehomed schemas. Pinned here so a
  // regression (accidentally re-adding pending_rehome, or deleting a config.*
  // row) surfaces as a named test failure.
  it('adapter.registry pending_rehome rehome is complete (Slice 26 landing)', () => {
    const art = file.artifacts.find((a) => a.id === 'adapter.registry') as
      | { pending_rehome?: unknown; schema_exports?: string[] }
      | undefined;
    expect(art, 'adapter.registry must still exist after Slice 26').toBeDefined();
    expect(
      art?.pending_rehome,
      'adapter.registry.pending_rehome must be absent after Slice 26 rehome',
    ).toBeUndefined();
    expect(
      art?.schema_exports,
      'adapter.registry.schema_exports narrowed to adapter-dispatch primitives only',
    ).toEqual(['DispatchConfig', 'AdapterReference']);
  });

  it('config.* rehome targets (config.root / config.layered / config.circuit-override) exist with correct contract binding', () => {
    for (const id of ['config.root', 'config.layered', 'config.circuit-override']) {
      const art = file.artifacts.find((a) => a.id === id) as
        | { contract?: string; schema_file?: string }
        | undefined;
      expect(art, `${id} must exist as a Slice 26 config.* rehome target`).toBeDefined();
      expect(art?.contract, `${id}.contract binds to specs/contracts/config.md`).toBe(
        'specs/contracts/config.md',
      );
      expect(art?.schema_file, `${id}.schema_file points at src/schemas/config.ts`).toBe(
        'src/schemas/config.ts',
      );
    }
  });

  // Codex MED #2 fold-in — pin exact schema_exports split on the three
  // config.* rehome targets so the semantic decomposition (which schemas
  // live under which artifact) cannot drift silently. A reshuffle of
  // e.g. `CircuitOverride` from `config.circuit-override` into
  // `config.root` would otherwise pass the existence+contract+schema_file
  // gate above.
  it('config.* rehome schema_exports split is exactly as documented in specs/contracts/config.md', () => {
    const expectedExports: Record<string, string[]> = {
      'config.root': ['Config'],
      'config.layered': ['LayeredConfig', 'ConfigLayer'],
      'config.circuit-override': ['CircuitOverride'],
    };
    for (const [id, expected] of Object.entries(expectedExports)) {
      const art = file.artifacts.find((a) => a.id === id) as
        | { schema_exports?: string[] }
        | undefined;
      expect(art?.schema_exports, `${id}.schema_exports`).toEqual(expected);
    }
  });
});

// Slice 23 Codex HIGH #3 fold-in: src/schemas/index.ts barrel-export check.
// Every non-index schema file must be re-exported via `export * from './<n>.js';`.
// No stale re-exports to deleted files.
describe('src/schemas/index.ts — barrel export coverage (Codex HIGH #3)', () => {
  const schemasDir = join(REPO_ROOT, 'src', 'schemas');
  const indexSrc = readFileSync(join(schemasDir, 'index.ts'), 'utf-8');
  const schemaFiles = readdirSync(schemasDir)
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
    .sort();

  it('every non-index schema file is re-exported via `export * from`', () => {
    for (const file of schemaFiles) {
      const stem = file.replace(/\.ts$/, '');
      const pattern = new RegExp(`^export \\* from '\\./${stem}\\.js';?\\s*$`, 'm');
      expect(
        pattern.test(indexSrc),
        `src/schemas/index.ts: missing \`export * from './${stem}.js';\``,
      ).toBe(true);
    }
  });

  it('no barrel re-export points at a non-existent file', () => {
    const reExportPattern = /^export \* from '\.\/([A-Za-z0-9_-]+)\.js';?\s*$/gm;
    const referenced = new Set<string>();
    let m = reExportPattern.exec(indexSrc);
    while (m !== null) {
      referenced.add(`${m[1]}.ts`);
      m = reExportPattern.exec(indexSrc);
    }
    for (const file of referenced) {
      expect(schemaFiles.includes(file), `src/schemas/index.ts: stale re-export for ${file}`).toBe(
        true,
      );
    }
  });
});

// Slice 23 Codex MED #8 fold-in: COMPILE_TIME_GUARD_PATTERN is imported so
// constructed-violation guards can pin the exact shape. Any future guard
// MUST conform to `_compileTime<Word>Parity`; an underscore-prefixed export
// that does not match is caught by the coverage ledger.
describe('COMPILE_TIME_GUARD_PATTERN — constructed-violation guard (Codex MED #8)', () => {
  it('matches valid compile-time parity guard names', async () => {
    const { COMPILE_TIME_GUARD_PATTERN } = await import('../../scripts/audit.mjs');
    expect(COMPILE_TIME_GUARD_PATTERN.test('_compileTimeOutcomeStatusParity')).toBe(true);
    expect(COMPILE_TIME_GUARD_PATTERN.test('_compileTimeSelectionSourceParity')).toBe(true);
    expect(COMPILE_TIME_GUARD_PATTERN.test('_compileTimeFooParity')).toBe(true);
  });

  it('rejects plain underscore-prefixed names', async () => {
    const { COMPILE_TIME_GUARD_PATTERN } = await import('../../scripts/audit.mjs');
    expect(COMPILE_TIME_GUARD_PATTERN.test('_Foo')).toBe(false);
    expect(COMPILE_TIME_GUARD_PATTERN.test('_internal')).toBe(false);
    expect(COMPILE_TIME_GUARD_PATTERN.test('_compileTimeNoParitySuffix')).toBe(false);
    expect(COMPILE_TIME_GUARD_PATTERN.test('_helper')).toBe(false);
  });

  it('rejects names missing the uppercase letter after _compileTime', async () => {
    const { COMPILE_TIME_GUARD_PATTERN } = await import('../../scripts/audit.mjs');
    expect(COMPILE_TIME_GUARD_PATTERN.test('_compileTimeParity')).toBe(false);
    expect(COMPILE_TIME_GUARD_PATTERN.test('_compileTimefooParity')).toBe(false);
  });
});

// Slice 26a — persisted-wrapper binding guard (ADR-0003 Addendum B).
//
// The arc-progress Codex pass (specs/reviews/arc-progress-codex.md HIGH #1)
// surfaced a new correlated-miss class: an artifact row claiming a
// wrapper-aggregate schema export (e.g. RunProjection = { log, snapshot })
// while binding a persisted path whose actual on-disk bytes carry only one
// leaf (Snapshot at state.json). The forward-only authority-graph gate
// stayed green because every dimension it checked was satisfied. This slice
// splits the artifact (run.projection stays in-memory, new run.snapshot
// owns state.json) and installs a structural guard against recurrence.
describe('run.snapshot + run.projection split (Slice 26a — ADR-0003 Addendum B)', () => {
  const file = loadArtifacts();
  const byId = new Map(file.artifacts.map((a) => [a.id, a]));

  it('run.snapshot artifact exists and binds Snapshot to state.json', () => {
    const snap = byId.get('run.snapshot');
    expect(snap, 'run.snapshot row missing from specs/artifacts.json').toBeDefined();
    expect(snap?.schema_file).toBe('src/schemas/snapshot.ts');
    expect(snap?.schema_exports).toEqual(['Snapshot', 'SnapshotStatus', 'StepState', 'StepStatus']);
    expect(snap?.backing_paths).toEqual(['<circuit-next-run-root>/state.json']);
    expect(snap?.contract).toBe('specs/contracts/run.md');
    expect(snap?.plane).toBe('data-plane');
    expect(snap?.surface_class).toBe('greenfield');
  });

  it('run.projection is reframed as in-memory wrapper with no backing path', () => {
    const proj = byId.get('run.projection');
    expect(proj).toBeDefined();
    expect(proj?.schema_file).toBe('src/schemas/run.ts');
    expect(proj?.schema_exports).toEqual(['RunProjection']);
    expect(
      proj?.backing_paths,
      'run.projection MUST NOT bind any persisted path; state.json now belongs to run.snapshot',
    ).toEqual([]);
  });

  it('src/schemas/snapshot.ts is no longer in SCHEMA_FILE_ALLOWLIST', () => {
    expect(
      Object.hasOwn(SCHEMA_FILE_ALLOWLIST, 'src/schemas/snapshot.ts'),
      'snapshot.ts was promoted to first-class artifact binding in Slice 26a — the shared-primitive allowlist entry must be removed',
    ).toBe(false);
  });

  it('run.md frontmatter includes run.snapshot in artifact_ids', () => {
    const contractPath = join(REPO_ROOT, 'specs/contracts/run.md');
    const fm = readFrontmatter(contractPath);
    expect(fm.ok, fm.ok ? '' : fm.error).toBe(true);
    const ids = (fm.ok ? (fm.frontmatter.artifact_ids as string[] | undefined) : undefined) ?? [];
    expect(ids).toContain('run.snapshot');
    expect(ids).toContain('run.projection');
    expect(ids).toContain('run.log');
  });
});

describe('detectWrapperAggregateBinding — constructed-violation guard (Slice 26a)', () => {
  it('flags an artifact that binds a wrapper-aggregate export to a persisted path', async () => {
    const { detectWrapperAggregateBinding } = await import('../../scripts/audit.mjs');
    const result = detectWrapperAggregateBinding({
      id: 'bad.fixture',
      schema_exports: ['RunProjection'],
      backing_paths: ['<circuit-next-run-root>/state.json'],
    });
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.wrapper_export).toBe('RunProjection');
    expect(result.backing_paths).toEqual(['<circuit-next-run-root>/state.json']);
  });

  it('accepts an artifact that claims the aggregate but persists nothing', async () => {
    const { detectWrapperAggregateBinding } = await import('../../scripts/audit.mjs');
    const result = detectWrapperAggregateBinding({
      id: 'ok.fixture',
      schema_exports: ['RunProjection'],
      backing_paths: [],
    });
    expect(result).toBeNull();
  });

  it('accepts an artifact whose exports include no known wrapper aggregate', async () => {
    const { detectWrapperAggregateBinding } = await import('../../scripts/audit.mjs');
    const result = detectWrapperAggregateBinding({
      id: 'leaf.fixture',
      schema_exports: ['Snapshot', 'SnapshotStatus'],
      backing_paths: ['<circuit-next-run-root>/state.json'],
    });
    expect(result).toBeNull();
  });

  it('flags a fixture even when the aggregate is not the first claimed export', async () => {
    const { detectWrapperAggregateBinding } = await import('../../scripts/audit.mjs');
    const result = detectWrapperAggregateBinding({
      id: 'mixed.fixture',
      schema_exports: ['SomeLeaf', 'RunProjection', 'AnotherLeaf'],
      backing_paths: ['/some/persisted/path'],
    });
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.wrapper_export).toBe('RunProjection');
  });

  it('returns null for malformed input rather than throwing', async () => {
    const { detectWrapperAggregateBinding } = await import('../../scripts/audit.mjs');
    expect(detectWrapperAggregateBinding(null)).toBeNull();
    expect(detectWrapperAggregateBinding(undefined)).toBeNull();
    expect(detectWrapperAggregateBinding({})).toBeNull();
    expect(detectWrapperAggregateBinding({ schema_exports: null, backing_paths: null })).toBeNull();
  });

  it('allowlist currently enumerates exactly {RunProjection}', async () => {
    const { WRAPPER_AGGREGATE_EXPORTS } = await import('../../scripts/audit.mjs');
    expect(Object.keys(WRAPPER_AGGREGATE_EXPORTS).sort()).toEqual(['RunProjection']);
    const entry = WRAPPER_AGGREGATE_EXPORTS.RunProjection;
    expect(entry).toBeDefined();
    expect(entry?.added_in_slice).toBe('26a');
    expect(entry?.adr_addendum).toBe('ADR-0003 Addendum B');
  });
});

describe('checkPersistedWrapperBinding — live check on specs/artifacts.json (Slice 26a)', () => {
  it('is green on the current authority graph', async () => {
    const { checkPersistedWrapperBinding } = await import('../../scripts/audit.mjs');
    const result = checkPersistedWrapperBinding();
    expect(result.level, result.detail).toBe('green');
  });

  // Slice 26a Codex MED 4 fold-in: a green-only live test cannot catch a
  // regression that inerts the check (stops loading artifacts.json, stops
  // iterating, always returns green). A red-fixture test drives the check
  // against a constructed artifacts.json carrying a known violation and
  // asserts it fires.
  it('returns level=red on a fixture artifacts.json that reintroduces the binding', async () => {
    const { checkPersistedWrapperBinding } = await import('../../scripts/audit.mjs');
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const tempRoot = mkdtempSync(join(tmpdir(), 'slice-26a-redfixture-'));
    try {
      mkdirSync(join(tempRoot, 'specs'), { recursive: true });
      const badGraph = {
        version: 2,
        artifacts: [
          {
            id: 'run.projection',
            surface_class: 'greenfield',
            compatibility_policy: 'n/a',
            plane: 'data-plane',
            description: 'fixture row that re-introduces the HIGH #1 binding',
            contract: 'specs/contracts/run.md',
            schema_file: 'src/schemas/run.ts',
            schema_exports: ['RunProjection'],
            writers: [],
            readers: [],
            resolvers: [],
            backing_paths: ['<circuit-next-run-root>/state.json'],
            identity_fields: ['run_id'],
            path_derived_fields: [],
            dangerous_sinks: [],
            trust_boundary: 'fixture',
            reference_surfaces: [],
            reference_evidence: [],
            migration_policy: 'n/a',
            legacy_parse_policy: 'n/a',
            dangling_reference_policy: 'n/a',
          },
        ],
      };
      writeFileSync(join(tempRoot, 'specs', 'artifacts.json'), JSON.stringify(badGraph, null, 2));
      const result = checkPersistedWrapperBinding(tempRoot);
      expect(result.level).toBe('red');
      expect(result.detail).toContain('run.projection');
      expect(result.detail).toContain('RunProjection');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
