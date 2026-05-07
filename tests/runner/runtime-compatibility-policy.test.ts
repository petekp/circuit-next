import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  GENERATED_FLOW_MIRROR_ROOT_ENV,
  RUNTIME_POLICY_REASONS,
  type RuntimeSupportDecision,
  applyCandidateFixturePolicy,
  applyComposeWriterPolicy,
  assertStrictV2FreshRunSupported,
  disableDefaultV2Runtime,
  disabledV2Decision,
  fixtureEligibleForCandidateV2,
  runtimeOutputFields,
  showRuntimeDecision,
  useV2Runtime,
} from '../../src/cli/runtime-compatibility-policy.js';

const supportedDecision: RuntimeSupportDecision = {
  kind: 'v2-supported',
  flowId: 'review',
  entryModeName: 'default',
  depth: 'standard',
  reason: "v2 supports fresh review entry mode 'default' at depth 'standard'",
};

const unsupportedDecision: RuntimeSupportDecision = {
  kind: 'old-runtime-required',
  flowId: 'review',
  entryModeName: 'custom',
  depth: 'standard',
  reason: "fresh review entry mode 'custom' at depth 'standard' is not v2-proven yet",
};

const ORIGINAL_ENV = {
  CIRCUIT_V2_RUNTIME: process.env.CIRCUIT_V2_RUNTIME,
  CIRCUIT_SHOW_RUNTIME_DECISION: process.env.CIRCUIT_SHOW_RUNTIME_DECISION,
  CIRCUIT_V2_RUNTIME_CANDIDATE: process.env.CIRCUIT_V2_RUNTIME_CANDIDATE,
  CIRCUIT_DISABLE_V2_RUNTIME: process.env.CIRCUIT_DISABLE_V2_RUNTIME,
  [GENERATED_FLOW_MIRROR_ROOT_ENV]: process.env[GENERATED_FLOW_MIRROR_ROOT_ENV],
};

function restoreEnv(): void {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe('runtime compatibility policy', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('marks composeWriter decisions as retired-runtime requirements without changing non-v2 decisions', () => {
    expect(applyComposeWriterPolicy(supportedDecision, { hasComposeWriter: true })).toMatchObject({
      kind: 'old-runtime-required',
      reason: RUNTIME_POLICY_REASONS.composeWriter,
    });

    expect(applyComposeWriterPolicy(supportedDecision, { hasComposeWriter: false })).toBe(
      supportedDecision,
    );
    expect(applyComposeWriterPolicy(unsupportedDecision, { hasComposeWriter: true })).toBe(
      unsupportedDecision,
    );
  });

  it('fails strict v2 with the retired composeWriter reason', () => {
    const composeWriterDecision = applyComposeWriterPolicy(supportedDecision, {
      hasComposeWriter: true,
    });

    expect(() => assertStrictV2FreshRunSupported(composeWriterDecision)).toThrow(
      RUNTIME_POLICY_REASONS.composeWriter,
    );
  });

  it('applies rollback only to default routing decisions', () => {
    expect(disabledV2Decision(supportedDecision)).toMatchObject({
      kind: 'old-runtime-required',
      reason: RUNTIME_POLICY_REASONS.rollback,
    });
    expect(() => assertStrictV2FreshRunSupported(supportedDecision)).not.toThrow();
  });

  it('marks arbitrary fixtures and custom roots as retired-runtime requirements by default', () => {
    const generatedRoot = join(process.cwd(), 'generated', 'flows');
    const externalFixture = join(process.cwd(), '.tmp', 'review-copy.json');

    expect(
      fixtureEligibleForCandidateV2({
        args: { fixturePath: externalFixture },
        fixturePath: externalFixture,
        generatedFlowsRoot: generatedRoot,
      }),
    ).toBe(false);

    expect(
      applyCandidateFixturePolicy(supportedDecision, {
        args: { fixturePath: externalFixture },
        fixturePath: externalFixture,
      }),
    ).toMatchObject({
      kind: 'old-runtime-required',
      reason: RUNTIME_POLICY_REASONS.externalFixtureOrRoot,
    });
  });

  it('allows generated fixtures under generated/flows', () => {
    const generatedRoot = join(process.cwd(), 'generated', 'flows');
    const generatedFixture = join(generatedRoot, 'review', 'circuit.json');

    expect(
      fixtureEligibleForCandidateV2({
        args: { fixturePath: generatedFixture },
        fixturePath: generatedFixture,
        generatedFlowsRoot: generatedRoot,
      }),
    ).toBe(true);
    expect(
      applyCandidateFixturePolicy(supportedDecision, {
        args: { fixturePath: generatedFixture },
        fixturePath: generatedFixture,
      }),
    ).toBe(supportedDecision);
  });

  it('trusts generated mirrors only when the marker matches the flow root exactly', () => {
    const mirrorRoot = join(process.cwd(), 'plugins', 'circuit', 'flows');
    const fixturePath = join(mirrorRoot, 'review', 'circuit.json');

    expect(
      fixtureEligibleForCandidateV2({
        args: { fixturePath, flowRoot: mirrorRoot },
        fixturePath,
        generatedFlowsRoot: join(process.cwd(), 'generated', 'flows'),
        generatedFlowMirrorRoot: mirrorRoot,
      }),
    ).toBe(true);

    expect(
      fixtureEligibleForCandidateV2({
        args: { fixturePath, flowRoot: mirrorRoot },
        fixturePath,
        generatedFlowsRoot: join(process.cwd(), 'generated', 'flows'),
        generatedFlowMirrorRoot: join(process.cwd(), 'other-mirror'),
      }),
    ).toBe(false);
  });

  it('marks custom flow roots as retired-runtime requirements unless strict v2 handles the decision elsewhere', () => {
    const customRoot = join(process.cwd(), '.circuit-next', 'custom-flows');
    const customFixture = join(customRoot, 'review', 'circuit.json');

    expect(
      applyCandidateFixturePolicy(supportedDecision, {
        args: { flowRoot: customRoot },
        fixturePath: customFixture,
      }),
    ).toMatchObject({
      kind: 'old-runtime-required',
      reason: RUNTIME_POLICY_REASONS.externalFixtureOrRoot,
    });
  });

  it('reports runtime fields only when diagnostics ask for them', () => {
    expect(
      runtimeOutputFields({
        include: false,
        runtime: 'v2',
        decision: supportedDecision,
      }),
    ).toEqual({});
    expect(
      runtimeOutputFields({
        include: true,
        runtime: 'retired',
        decision: disabledV2Decision(supportedDecision),
      }),
    ).toEqual({
      runtime: 'retired',
      runtime_reason: RUNTIME_POLICY_REASONS.rollback,
    });
  });

  it('centralizes runtime environment switches', () => {
    process.env.CIRCUIT_V2_RUNTIME = '1';
    process.env.CIRCUIT_SHOW_RUNTIME_DECISION = undefined;
    process.env.CIRCUIT_V2_RUNTIME_CANDIDATE = '1';
    process.env.CIRCUIT_DISABLE_V2_RUNTIME = '1';

    expect(useV2Runtime()).toBe(true);
    expect(showRuntimeDecision()).toBe(true);
    expect(disableDefaultV2Runtime()).toBe(true);
  });
});
