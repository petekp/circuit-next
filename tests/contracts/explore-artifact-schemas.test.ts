import { describe, expect, it } from 'vitest';

import {
  ExploreAnalysis,
  ExploreAspect,
  ExploreBrief,
  ExploreEvidenceCitation,
} from '../../src/schemas/artifacts/explore.js';

describe('P2.10a — explore.brief and explore.analysis artifact schemas', () => {
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
});
