import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ExploreAnalysis,
  ExploreAspect,
  ExploreBrief,
  ExploreEvidenceCitation,
  ExploreResult,
  ExploreResultArtifactPointer,
  ExploreReviewVerdict,
  ExploreReviewVerdictValue,
  ExploreSynthesis,
  ExploreSynthesisAspect,
} from '../../src/workflows/explore/artifacts.js';
import { Workflow } from '../../src/schemas/workflow.js';

const EXPLORE_FIXTURE_PATH = resolve('.claude-plugin/skills/explore/circuit.json');

function loadExploreWorkflow(): Workflow {
  return Workflow.parse(JSON.parse(readFileSync(EXPLORE_FIXTURE_PATH, 'utf8')));
}

describe('P2.10 — explore artifact schemas', () => {
  it('accepts the typed explore.brief shape', () => {
    expect(
      ExploreBrief.parse({
        subject: 'Investigate the runtime',
        task: 'Find the next risk',
        success_condition: 'A clear recommendation exists',
      }),
    ).toEqual({
      subject: 'Investigate the runtime',
      task: 'Find the next risk',
      success_condition: 'A clear recommendation exists',
    });
  });

  it('rejects surplus keys in explore.brief', () => {
    const parsed = ExploreBrief.safeParse({
      subject: 'Investigate the runtime',
      task: 'Find the next risk',
      success_condition: 'A clear recommendation exists',
      smuggled: true,
    });

    expect(parsed.success).toBe(false);
  });

  it('accepts evidence-backed explore.analysis aspects', () => {
    const evidence = ExploreEvidenceCitation.parse({
      source: 'artifacts/brief.json',
      summary: 'The brief asks for runtime risk analysis',
    });
    const aspect = ExploreAspect.parse({
      name: 'runtime-risk',
      summary: 'The runtime path is the relevant subject',
      evidence: [evidence],
    });

    expect(
      ExploreAnalysis.parse({
        subject: 'Investigate the runtime',
        aspects: [aspect],
      }),
    ).toEqual({
      subject: 'Investigate the runtime',
      aspects: [aspect],
    });
  });

  it('rejects explore.analysis without at least one aspect and one evidence citation', () => {
    expect(
      ExploreAnalysis.safeParse({
        subject: 'Investigate the runtime',
        aspects: [],
      }).success,
    ).toBe(false);

    expect(
      ExploreAnalysis.safeParse({
        subject: 'Investigate the runtime',
        aspects: [{ name: 'runtime-risk', summary: 'No evidence', evidence: [] }],
      }).success,
    ).toBe(false);
  });

  it('accepts the typed explore.synthesis shape', () => {
    const supportingAspect = ExploreSynthesisAspect.parse({
      aspect: 'runtime-risk',
      contribution: 'Identifies the runtime path most likely to affect users',
    });

    expect(
      ExploreSynthesis.parse({
        verdict: 'accept',
        subject: 'Investigate the runtime',
        recommendation: 'Harden the artifact writer first',
        success_condition_alignment: 'The recommendation names the next action',
        supporting_aspects: [supportingAspect],
      }),
    ).toEqual({
      verdict: 'accept',
      subject: 'Investigate the runtime',
      recommendation: 'Harden the artifact writer first',
      success_condition_alignment: 'The recommendation names the next action',
      supporting_aspects: [supportingAspect],
    });
  });

  it('rejects explore.synthesis without a recommendation and supporting aspect', () => {
    expect(
      ExploreSynthesis.safeParse({
        verdict: 'accept',
        subject: 'Investigate the runtime',
        success_condition_alignment: 'The recommendation names the next action',
        supporting_aspects: [
          {
            aspect: 'runtime-risk',
            contribution: 'Identifies the runtime path most likely to affect users',
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      ExploreSynthesis.safeParse({
        verdict: 'accept',
        subject: 'Investigate the runtime',
        recommendation: 'Harden the artifact writer first',
        success_condition_alignment: 'The recommendation names the next action',
        supporting_aspects: [],
      }).success,
    ).toBe(false);
  });

  it('rejects surplus keys in explore.synthesis and nested supporting aspects', () => {
    expect(
      ExploreSynthesis.safeParse({
        verdict: 'accept',
        subject: 'Investigate the runtime',
        recommendation: 'Harden the artifact writer first',
        success_condition_alignment: 'The recommendation names the next action',
        supporting_aspects: [
          {
            aspect: 'runtime-risk',
            contribution: 'Identifies the runtime path most likely to affect users',
          },
        ],
        smuggled: true,
      }).success,
    ).toBe(false);

    expect(
      ExploreSynthesis.safeParse({
        verdict: 'accept',
        subject: 'Investigate the runtime',
        recommendation: 'Harden the artifact writer first',
        success_condition_alignment: 'The recommendation names the next action',
        supporting_aspects: [
          {
            aspect: 'runtime-risk',
            contribution: 'Identifies the runtime path most likely to affect users',
            smuggled: true,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('accepts the typed explore.review-verdict shape with empty objection lists', () => {
    expect(
      ExploreReviewVerdict.parse({
        verdict: 'accept',
        overall_assessment: 'The synthesis covers the requested scope',
        objections: [],
        missed_angles: [],
      }),
    ).toEqual({
      verdict: 'accept',
      overall_assessment: 'The synthesis covers the requested scope',
      objections: [],
      missed_angles: [],
    });
  });

  it('rejects invalid explore.review-verdict verdicts and surplus keys', () => {
    expect(
      ExploreReviewVerdict.safeParse({
        verdict: 'reject',
        overall_assessment: 'The synthesis misses the requested scope',
        objections: ['Missing evidence'],
        missed_angles: [],
      }).success,
    ).toBe(false);

    expect(
      ExploreReviewVerdict.safeParse({
        verdict: 'accept-with-fold-ins',
        overall_assessment: 'The synthesis is usable with a follow-up',
        objections: ['Clarify the migration risk'],
        missed_angles: ['Operational rollout'],
        smuggled: true,
      }).success,
    ).toBe(false);
  });

  it('keeps explore.review-verdict verdict vocabulary aligned with the fixture gate', () => {
    const workflow = loadExploreWorkflow();
    const reviewStep = workflow.steps.find((step) => step.id === 'review-step');
    if (reviewStep?.kind !== 'dispatch') throw new Error('expected review-step dispatch');

    expect(reviewStep.gate.pass).toEqual([...ExploreReviewVerdictValue.options]);
  });

  it('accepts the typed explore.result aggregate shape', () => {
    const pointers = [
      ExploreResultArtifactPointer.parse({
        artifact_id: 'explore.brief',
        path: 'artifacts/brief.json',
        schema: 'explore.brief@v1',
      }),
      ExploreResultArtifactPointer.parse({
        artifact_id: 'explore.analysis',
        path: 'artifacts/analysis.json',
        schema: 'explore.analysis@v1',
      }),
      ExploreResultArtifactPointer.parse({
        artifact_id: 'explore.synthesis',
        path: 'artifacts/synthesis.json',
        schema: 'explore.synthesis@v1',
      }),
      ExploreResultArtifactPointer.parse({
        artifact_id: 'explore.review-verdict',
        path: 'artifacts/review-verdict.json',
        schema: 'explore.review-verdict@v1',
      }),
    ];

    expect(
      ExploreResult.parse({
        summary: 'Explore recommendation: keep the aggregate deterministic',
        verdict_snapshot: {
          synthesis_verdict: 'accept',
          review_verdict: 'accept-with-fold-ins',
          objection_count: 1,
          missed_angle_count: 0,
        },
        artifact_pointers: pointers,
      }),
    ).toEqual({
      summary: 'Explore recommendation: keep the aggregate deterministic',
      verdict_snapshot: {
        synthesis_verdict: 'accept',
        review_verdict: 'accept-with-fold-ins',
        objection_count: 1,
        missed_angle_count: 0,
      },
      artifact_pointers: pointers,
    });
  });

  it('rejects explore.result with missing pointers, invalid review verdict, or surplus keys', () => {
    expect(
      ExploreResult.safeParse({
        summary: 'Missing one pointer',
        verdict_snapshot: {
          synthesis_verdict: 'accept',
          review_verdict: 'accept',
          objection_count: 0,
          missed_angle_count: 0,
        },
        artifact_pointers: [
          {
            artifact_id: 'explore.synthesis',
            path: 'artifacts/synthesis.json',
            schema: 'explore.synthesis@v1',
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      ExploreResult.safeParse({
        summary: 'Invalid review verdict',
        verdict_snapshot: {
          synthesis_verdict: 'accept',
          review_verdict: 'reject',
          objection_count: 0,
          missed_angle_count: 0,
        },
        artifact_pointers: [],
      }).success,
    ).toBe(false);

    expect(
      ExploreResult.safeParse({
        summary: 'Extra field',
        verdict_snapshot: {
          synthesis_verdict: 'accept',
          review_verdict: 'accept',
          objection_count: 0,
          missed_angle_count: 0,
        },
        artifact_pointers: [],
        smuggled: true,
      }).success,
    ).toBe(false);
  });

  it('rejects explore.result pointer duplicates and artifact/schema mismatches', () => {
    expect(
      ExploreResultArtifactPointer.safeParse({
        artifact_id: 'explore.brief',
        path: 'artifacts/brief.json',
        schema: 'explore.synthesis@v1',
      }).success,
    ).toBe(false);

    expect(
      ExploreResult.safeParse({
        summary: 'Duplicate pointer ids',
        verdict_snapshot: {
          synthesis_verdict: 'accept',
          review_verdict: 'accept',
          objection_count: 0,
          missed_angle_count: 0,
        },
        artifact_pointers: [
          {
            artifact_id: 'explore.brief',
            path: 'artifacts/brief.json',
            schema: 'explore.brief@v1',
          },
          {
            artifact_id: 'explore.brief',
            path: 'artifacts/brief-copy.json',
            schema: 'explore.brief@v1',
          },
          {
            artifact_id: 'explore.synthesis',
            path: 'artifacts/synthesis.json',
            schema: 'explore.synthesis@v1',
          },
          {
            artifact_id: 'explore.review-verdict',
            path: 'artifacts/review-verdict.json',
            schema: 'explore.review-verdict@v1',
          },
        ],
      }).success,
    ).toBe(false);
  });
});
