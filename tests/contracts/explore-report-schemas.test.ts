import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ExploreAnalysis,
  ExploreAspect,
  ExploreBrief,
  ExploreCompose,
  ExploreComposeAspect,
  ExploreEvidenceCitation,
  ExploreResult,
  ExploreResultReportPointer,
  ExploreReviewVerdict,
  ExploreReviewVerdictValue,
} from '../../src/flows/explore/reports.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';

const EXPLORE_FIXTURE_PATH = resolve('generated/flows/explore/circuit.json');

function loadExploreCompiledFlow(): CompiledFlow {
  return CompiledFlow.parse(JSON.parse(readFileSync(EXPLORE_FIXTURE_PATH, 'utf8')));
}

describe('explore report schemas', () => {
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
      source: 'reports/brief.json',
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

  it('accepts the typed explore.compose shape', () => {
    const supportingAspect = ExploreComposeAspect.parse({
      aspect: 'runtime-risk',
      contribution: 'Identifies the runtime path most likely to affect users',
      evidence_refs: ['reports/analysis.json'],
    });

    expect(
      ExploreCompose.parse({
        verdict: 'accept',
        subject: 'Investigate the runtime',
        recommendation: 'Harden the report writer first',
        success_condition_alignment: 'The recommendation names the next action',
        supporting_aspects: [supportingAspect],
      }),
    ).toEqual({
      verdict: 'accept',
      subject: 'Investigate the runtime',
      recommendation: 'Harden the report writer first',
      success_condition_alignment: 'The recommendation names the next action',
      supporting_aspects: [supportingAspect],
    });
  });

  it('rejects explore.compose without a recommendation and supporting aspect', () => {
    expect(
      ExploreCompose.safeParse({
        verdict: 'accept',
        subject: 'Investigate the runtime',
        success_condition_alignment: 'The recommendation names the next action',
        supporting_aspects: [
          {
            aspect: 'runtime-risk',
            contribution: 'Identifies the runtime path most likely to affect users',
            evidence_refs: ['reports/analysis.json'],
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      ExploreCompose.safeParse({
        verdict: 'accept',
        subject: 'Investigate the runtime',
        recommendation: 'Harden the report writer first',
        success_condition_alignment: 'The recommendation names the next action',
        supporting_aspects: [],
      }).success,
    ).toBe(false);
  });

  it('rejects surplus keys in explore.compose and nested supporting aspects', () => {
    expect(
      ExploreCompose.safeParse({
        verdict: 'accept',
        subject: 'Investigate the runtime',
        recommendation: 'Harden the report writer first',
        success_condition_alignment: 'The recommendation names the next action',
        supporting_aspects: [
          {
            aspect: 'runtime-risk',
            contribution: 'Identifies the runtime path most likely to affect users',
            evidence_refs: ['reports/analysis.json'],
          },
        ],
        smuggled: true,
      }).success,
    ).toBe(false);

    expect(
      ExploreCompose.safeParse({
        verdict: 'accept',
        subject: 'Investigate the runtime',
        recommendation: 'Harden the report writer first',
        success_condition_alignment: 'The recommendation names the next action',
        supporting_aspects: [
          {
            aspect: 'runtime-risk',
            contribution: 'Identifies the runtime path most likely to affect users',
            evidence_refs: ['reports/analysis.json'],
            smuggled: true,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('rejects explore.compose supporting aspects without evidence references', () => {
    expect(
      ExploreComposeAspect.safeParse({
        aspect: 'runtime-risk',
        contribution: 'Identifies the runtime path most likely to affect users',
      }).success,
    ).toBe(false);
  });

  it('accepts the typed explore.review-verdict shape with empty objection lists', () => {
    expect(
      ExploreReviewVerdict.parse({
        verdict: 'accept',
        overall_assessment: 'The compose covers the requested scope',
        objections: [],
        missed_angles: [],
      }),
    ).toEqual({
      verdict: 'accept',
      overall_assessment: 'The compose covers the requested scope',
      objections: [],
      missed_angles: [],
    });
  });

  it('rejects invalid explore.review-verdict verdicts and surplus keys', () => {
    expect(
      ExploreReviewVerdict.safeParse({
        verdict: 'reject',
        overall_assessment: 'The compose misses the requested scope',
        objections: ['Missing evidence'],
        missed_angles: [],
      }).success,
    ).toBe(false);

    expect(
      ExploreReviewVerdict.safeParse({
        verdict: 'accept-with-fold-ins',
        overall_assessment: 'The compose is usable with a follow-up',
        objections: ['Clarify the migration risk'],
        missed_angles: ['Operational rollout'],
        smuggled: true,
      }).success,
    ).toBe(false);
  });

  it('keeps explore.review-verdict verdict vocabulary aligned with the fixture check', () => {
    const flow = loadExploreCompiledFlow();
    const reviewStep = flow.steps.find((step) => step.id === 'review-step');
    if (reviewStep?.kind !== 'relay') throw new Error('expected review-step relay');

    expect(reviewStep.check.pass).toEqual([...ExploreReviewVerdictValue.options]);
  });

  it('accepts the typed explore.result aggregate shape', () => {
    const pointers = [
      ExploreResultReportPointer.parse({
        report_id: 'explore.brief',
        path: 'reports/brief.json',
        schema: 'explore.brief@v1',
      }),
      ExploreResultReportPointer.parse({
        report_id: 'explore.analysis',
        path: 'reports/analysis.json',
        schema: 'explore.analysis@v1',
      }),
      ExploreResultReportPointer.parse({
        report_id: 'explore.compose',
        path: 'reports/compose.json',
        schema: 'explore.compose@v1',
      }),
      ExploreResultReportPointer.parse({
        report_id: 'explore.review-verdict',
        path: 'reports/review-verdict.json',
        schema: 'explore.review-verdict@v1',
      }),
    ];

    expect(
      ExploreResult.parse({
        summary: 'Explore recommendation: keep the aggregate deterministic',
        verdict_snapshot: {
          compose_verdict: 'accept',
          review_verdict: 'accept-with-fold-ins',
          objection_count: 1,
          missed_angle_count: 0,
        },
        evidence_links: pointers,
      }),
    ).toEqual({
      summary: 'Explore recommendation: keep the aggregate deterministic',
      verdict_snapshot: {
        compose_verdict: 'accept',
        review_verdict: 'accept-with-fold-ins',
        objection_count: 1,
        missed_angle_count: 0,
      },
      evidence_links: pointers,
    });
  });

  it('rejects explore.result with missing pointers, invalid review verdict, or surplus keys', () => {
    expect(
      ExploreResult.safeParse({
        summary: 'Missing one pointer',
        verdict_snapshot: {
          compose_verdict: 'accept',
          review_verdict: 'accept',
          objection_count: 0,
          missed_angle_count: 0,
        },
        evidence_links: [
          {
            report_id: 'explore.compose',
            path: 'reports/compose.json',
            schema: 'explore.compose@v1',
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      ExploreResult.safeParse({
        summary: 'Invalid review verdict',
        verdict_snapshot: {
          compose_verdict: 'accept',
          review_verdict: 'reject',
          objection_count: 0,
          missed_angle_count: 0,
        },
        evidence_links: [],
      }).success,
    ).toBe(false);

    expect(
      ExploreResult.safeParse({
        summary: 'Extra field',
        verdict_snapshot: {
          compose_verdict: 'accept',
          review_verdict: 'accept',
          objection_count: 0,
          missed_angle_count: 0,
        },
        evidence_links: [],
        smuggled: true,
      }).success,
    ).toBe(false);
  });

  it('rejects explore.result pointer duplicates and report/schema mismatches', () => {
    expect(
      ExploreResultReportPointer.safeParse({
        report_id: 'explore.brief',
        path: 'reports/brief.json',
        schema: 'explore.compose@v1',
      }).success,
    ).toBe(false);

    expect(
      ExploreResult.safeParse({
        summary: 'Duplicate pointer ids',
        verdict_snapshot: {
          compose_verdict: 'accept',
          review_verdict: 'accept',
          objection_count: 0,
          missed_angle_count: 0,
        },
        evidence_links: [
          {
            report_id: 'explore.brief',
            path: 'reports/brief.json',
            schema: 'explore.brief@v1',
          },
          {
            report_id: 'explore.brief',
            path: 'reports/brief-copy.json',
            schema: 'explore.brief@v1',
          },
          {
            report_id: 'explore.compose',
            path: 'reports/compose.json',
            schema: 'explore.compose@v1',
          },
          {
            report_id: 'explore.review-verdict',
            path: 'reports/review-verdict.json',
            schema: 'explore.review-verdict@v1',
          },
        ],
      }).success,
    ).toBe(false);
  });
});
