import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type Artifact = {
  id: string;
  surface_class: string;
  compatibility_policy: string;
  reference_surfaces?: string[];
  reference_evidence?: string[];
  migration_policy?: string;
  legacy_parse_policy?: string;
};

type ArtifactsFile = {
  artifacts: Artifact[];
};

type ReferenceShape = {
  source_sha256: Record<string, string>;
  declared_reference_artifacts: string[];
  observed_completed_artifacts: string[];
  observed_missing_artifacts: string[];
  circuit_next_artifacts: string[];
  authority_mapping: Record<string, string[]>;
  greenfield_without_reference_counterpart: string[];
};

const REPO_ROOT = resolve('.');
const CHARACTERIZATION_PATH = join(
  REPO_ROOT,
  'specs/reference/legacy-circuit/explore-characterization.md',
);
const REFERENCE_SHAPE_PATH = join(
  REPO_ROOT,
  'tests/fixtures/reference/legacy-circuit/explore/reference-shape.json',
);
const MATRIX_PATH = join(REPO_ROOT, 'specs/reviews/phase-2-close-matrix.md');
const ADR_0007_PATH = join(REPO_ROOT, 'specs/adrs/ADR-0007-phase-2-close-criteria.md');
const ARTIFACTS_PATH = join(REPO_ROOT, 'specs/artifacts.json');

const CHARACTERIZATION = readFileSync(CHARACTERIZATION_PATH, 'utf8');
const REFERENCE_SHAPE = JSON.parse(readFileSync(REFERENCE_SHAPE_PATH, 'utf8')) as ReferenceShape;

function artifactsById(): Map<string, Artifact> {
  const parsed = JSON.parse(readFileSync(ARTIFACTS_PATH, 'utf8')) as ArtifactsFile;
  return new Map(parsed.artifacts.map((artifact) => [artifact.id, artifact]));
}

describe('legacy Circuit Explore characterization', () => {
  it('pins the live reference sources that were inspected', () => {
    expect(CHARACTERIZATION).toContain('~/Code/circuit/commands/explore.md');
    expect(CHARACTERIZATION).toContain('~/Code/circuit/skills/explore/SKILL.md');
    expect(CHARACTERIZATION).toContain('~/Code/circuit/skills/explore/circuit.yaml');
    expect(CHARACTERIZATION).toContain(
      '~/Code/circuit/.circuit/circuit-runs/smoke-explore-decide-plural/',
    );
  });

  it('records the reference Explore artifact set as Markdown-first', () => {
    for (const path of REFERENCE_SHAPE.declared_reference_artifacts) {
      expect(CHARACTERIZATION).toContain(path);
    }
    expect(CHARACTERIZATION).toContain('The reference Explore surface is Markdown-first');
  });

  it('records that the inspected run did not complete close', () => {
    expect(CHARACTERIZATION).toContain('status: "in_progress"');
    expect(CHARACTERIZATION).toContain('current_step: "close"');
    expect(CHARACTERIZATION).toContain('No `artifacts/result.md` was present');
  });

  it('compares the current circuit-next JSON artifact set against the Markdown reference', () => {
    for (const path of REFERENCE_SHAPE.circuit_next_artifacts) {
      expect(CHARACTERIZATION).toContain(path);
    }
    expect(CHARACTERIZATION).toMatch(/does\s+\*\*not\*\* prove byte-shape parity with old Circuit/);
  });

  it('keeps the Phase 2 close matrix honest about P2-1 remaining red', () => {
    const matrix = readFileSync(MATRIX_PATH, 'utf8');
    const row = matrix.split('\n').find((line) => line.startsWith('| P2-1 |'));
    expect(row).toBeDefined();
    expect(row).toContain('active — red');
    expect(row).toContain('specs/reference/legacy-circuit/explore-characterization.md');
    expect(row).toContain('not counted satisfied');
  });

  it('pins source checksums and observed legacy shape in a committed fixture', () => {
    expect(REFERENCE_SHAPE.source_sha256).toEqual({
      'skills/explore/circuit.yaml':
        '36779b6a631d4e8a45ae1a252edcc54f5eb8939f652c1405438b1891c67d9ae5',
      'skills/explore/SKILL.md': 'fa762f6d6a78d0b09208fe966de02d37d23eaa2b91eb664e097952a463f9a4fc',
      '.circuit/circuit-runs/smoke-explore-decide-plural/state.json':
        'ce9e2f494b3694ab23159627ddb64fd2b358913de2ca34e147bce576b2be9fca',
      '.circuit/circuit-runs/smoke-explore-decide-plural/events.ndjson':
        '4779bf5309f7db4e8f54293aef0144f2741fc12430ab44084fabff759efb9b94',
    });
    expect(REFERENCE_SHAPE.observed_completed_artifacts).toEqual([
      'artifacts/brief.md',
      'artifacts/analysis.md',
      'artifacts/plan.md',
      'artifacts/decision.md',
    ]);
    expect(REFERENCE_SHAPE.observed_missing_artifacts).toEqual(['artifacts/result.md']);
  });

  it('reconciles ADR-0007 with the active-red P2-1 status', () => {
    const adr = readFileSync(ADR_0007_PATH, 'utf8');
    expect(adr).toContain('Slice 98 reference-characterization correction');
    expect(adr).toMatch(/Effective\s+Slice 98, CC#P2-1 is \*\*active — red\*\*/);
    expect(adr).toContain('is superseded for Phase 2 close accounting');
  });
});

describe('explore artifact authority graph reference bindings', () => {
  const byId = artifactsById();
  const legacySuccessorIds = [
    'explore.brief',
    'explore.analysis',
    'explore.synthesis',
    'explore.result',
  ];

  it('classifies legacy-shaped Explore artifacts as clean-break successors', () => {
    for (const id of legacySuccessorIds) {
      const artifact = byId.get(id);
      expect(artifact, `${id} artifact row is missing`).toBeDefined();
      expect(artifact?.surface_class, `${id} must not be greenfield`).toBe('successor-to-live');
      expect(artifact?.compatibility_policy).toBe('clean-break');
      expect(artifact?.reference_surfaces).toEqual(REFERENCE_SHAPE.authority_mapping[id]);
      expect(artifact?.reference_evidence).toContain(
        'specs/reference/legacy-circuit/explore-characterization.md',
      );
      expect(artifact?.legacy_parse_policy).toBe('reject');
    }
  });

  it('keeps explore.review-verdict greenfield because old Explore has no review artifact', () => {
    const reviewVerdict = byId.get('explore.review-verdict');
    expect(REFERENCE_SHAPE.greenfield_without_reference_counterpart).toEqual([
      'explore.review-verdict',
    ]);
    expect(reviewVerdict?.surface_class).toBe('greenfield');
    expect(reviewVerdict?.reference_evidence ?? []).toHaveLength(0);
    expect(CHARACTERIZATION).toContain(
      'The reference workflow has no dedicated review-verdict artifact.',
    );
  });
});
