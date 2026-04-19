import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  planeIsValid,
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

  it('rejects `export function <name>` form (defining, but not `export const`)', () => {
    // Intentional v0.1 scope: only `export const` is matched. Extending to
    // cover function/class/type forms is a Slice-11 v0.2 scope item.
    const src = 'export function helper() {}\n';
    expect(schemaExportPresent(src, 'helper')).toBe(false);
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
      'operator-local at user-global/project/invocation layers; plugin-author-signed at the defaults layer; engine validates .strict() key closure and ghost-provenance rejection at parse time. Composition produces selection.resolution (separate artifact).',
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
