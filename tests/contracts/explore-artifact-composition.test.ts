import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseArtifact } from '../../src/runtime/artifact-schemas.js';
import { Workflow } from '../../src/schemas/workflow.js';

const REPO_ROOT = resolve('.');
const EXPLORE_FIXTURE_PATH = join(REPO_ROOT, '.claude-plugin/skills/explore/circuit.json');
const ARTIFACTS_PATH = join(REPO_ROOT, 'specs/artifacts.json');
const RUNNER_PATH = join(REPO_ROOT, 'src/runtime/runner.ts');

type ArtifactRow = {
  id: string;
  description: string;
  schema_file: string;
  schema_exports: string[];
};

type ArtifactsFile = {
  artifacts: ArtifactRow[];
};

type StepWithArtifact = Workflow['steps'][number] & {
  writes: { artifact: { path: string; schema: string } };
  gate: { required?: string[]; pass?: string[] };
};

const LANDED_ARTIFACTS = [
  {
    artifactId: 'explore.brief',
    stepId: 'frame-step',
    schemaName: 'explore.brief@v1',
    schemaExports: ['ExploreBrief'],
    requiredFields: ['subject', 'success_condition'],
  },
  {
    artifactId: 'explore.analysis',
    stepId: 'analyze-step',
    schemaName: 'explore.analysis@v1',
    schemaExports: ['ExploreAnalysis', 'ExploreAspect', 'ExploreEvidenceCitation'],
    requiredFields: ['aspects'],
  },
  {
    artifactId: 'explore.synthesis',
    stepId: 'synthesize-step',
    schemaName: 'explore.synthesis@v1',
    schemaExports: ['ExploreSynthesis', 'ExploreSynthesisAspect'],
    passVerdicts: ['accept'],
    validBody: {
      verdict: 'accept',
      subject: 'Composition check',
      recommendation: 'Keep the landed schema surfaces bound together',
      success_condition_alignment: 'The proof names the cross-slice seam',
      supporting_aspects: [
        {
          aspect: 'schema-binding',
          contribution: 'The fixture, artifact ledger, and registry agree',
        },
      ],
    },
  },
  {
    artifactId: 'explore.review-verdict',
    stepId: 'review-step',
    schemaName: 'explore.review-verdict@v1',
    schemaExports: ['ExploreReviewVerdict', 'ExploreReviewVerdictValue'],
    passVerdicts: ['accept', 'accept-with-fold-ins'],
    validBody: {
      verdict: 'accept-with-fold-ins',
      overall_assessment: 'The synthesis is usable with a follow-up note',
      objections: ['Clarify close-result ownership before the next slice'],
      missed_angles: [],
    },
  },
] as const;

function loadArtifacts(): ArtifactRow[] {
  return (JSON.parse(readFileSync(ARTIFACTS_PATH, 'utf8')) as ArtifactsFile).artifacts;
}

function artifactById(rows: ArtifactRow[], id: string): ArtifactRow {
  const artifact = rows.find((row) => row.id === id);
  if (artifact === undefined) throw new Error(`artifact row not found: ${id}`);
  return artifact;
}

function loadExploreWorkflow(): Workflow {
  return Workflow.parse(JSON.parse(readFileSync(EXPLORE_FIXTURE_PATH, 'utf8')));
}

function stepById(workflow: Workflow, stepId: string): StepWithArtifact {
  const step = workflow.steps.find((candidate) => candidate.id === stepId);
  if (step === undefined) throw new Error(`step not found: ${stepId}`);
  return step as StepWithArtifact;
}

describe('P2.10 artifact-schema composition seam', () => {
  it('binds landed explore artifact schemas across fixture, ledger, and runtime validation', () => {
    const artifacts = loadArtifacts();
    const workflow = loadExploreWorkflow();
    const runnerSource = readFileSync(RUNNER_PATH, 'utf8');

    for (const spec of LANDED_ARTIFACTS) {
      const row = artifactById(artifacts, spec.artifactId);
      expect(row.schema_file).toBe('src/schemas/artifacts/explore.ts');
      expect(row.schema_exports).toEqual([...spec.schemaExports]);

      const step = stepById(workflow, spec.stepId);
      expect(step.writes.artifact.schema).toBe(spec.schemaName);

      if ('requiredFields' in spec) {
        expect(step.gate.required).toEqual([...spec.requiredFields]);
        expect(runnerSource).toContain(`schemaName === '${spec.schemaName}'`);
        expect(parseArtifact(spec.schemaName, '{}').kind).toBe('fail');
      }

      if ('passVerdicts' in spec) {
        expect(step.gate.pass).toEqual([...spec.passVerdicts]);
        expect(parseArtifact(spec.schemaName, JSON.stringify(spec.validBody)).kind).toBe('ok');
      }
    }

    const resultRow = artifactById(artifacts, 'explore.result');
    expect(resultRow.schema_file).toBe('');
    expect(resultRow.schema_exports).toEqual([]);
    expect(resultRow.description).toMatch(/placeholder-parity epoch/);
    expect(resultRow.description).toMatch(
      /does not yet consume brief, analysis, synthesis, or review-verdict/,
    );

    const closeStep = stepById(workflow, 'close-step');
    expect(closeStep.writes.artifact.schema).toBe('explore.result@v1');
    expect(closeStep.gate.required).toEqual(['summary', 'verdict_snapshot']);
    expect(runnerSource).not.toContain("schemaName === 'explore.result@v1'");
    expect(parseArtifact('explore.result@v1', '{"summary":"x","verdict_snapshot":"y"}').kind).toBe(
      'fail',
    );
  });
});
