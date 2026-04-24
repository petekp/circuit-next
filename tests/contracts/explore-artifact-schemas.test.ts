import { describe, expect, it } from 'vitest';

import {
  ExploreAnalysis,
  ExploreAspect,
  ExploreBrief,
  ExploreEvidenceCitation,
  ExploreSynthesis,
  ExploreSynthesisAspect,
} from '../../src/schemas/artifacts/explore.js';

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
});
