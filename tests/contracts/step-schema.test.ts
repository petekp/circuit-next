// Step discriminated-union schema — STEP-I1..I9 from
// docs/contracts/step.md v0.1.
//
// Split from the original `schema-parity.test.ts` mega-file as part
// of FU-T09.

import { describe, expect, it } from 'vitest';
import { Step } from '../../src/index.js';
import { expectSchemaRejects } from '../helpers/failure-message.js';

describe('Step discriminated union', () => {
  const checkpointPolicy = (choices: string[] = ['continue', 'revise']) => ({
    prompt: 'Frame the work',
    choices: choices.map((id) => ({ id })),
    safe_default_choice: choices[0],
  });

  const baseSynthesis = {
    id: 'frame',
    title: 'Frame',
    executor: 'orchestrator' as const,
    kind: 'synthesis' as const,
    protocol: 'build-frame@v1',
    reads: [],
    writes: { artifact: { path: 'artifacts/brief.md', schema: 'brief@v1' } },
    gate: {
      kind: 'schema_sections' as const,
      source: { kind: 'artifact' as const, ref: 'artifact' },
      required: ['Objective'],
    },
    routes: { pass: '@complete' },
  };

  it('synthesis step is legal', () => {
    expect(Step.safeParse(baseSynthesis).success).toBe(true);
  });

  it('verification step is legal and uses schema_sections artifact gating', () => {
    const ok = Step.safeParse({
      ...baseSynthesis,
      id: 'verify',
      title: 'Verify',
      kind: 'verification',
      protocol: 'build-verify@v1',
      writes: {
        artifact: { path: 'artifacts/build/verification.json', schema: 'build.verification@v1' },
      },
      gate: {
        kind: 'schema_sections',
        source: { kind: 'artifact', ref: 'artifact' },
        required: ['overall_status', 'commands'],
      },
    });
    expect(ok.success).toBe(true);
  });

  it('worker + dispatch requires a dispatch role', () => {
    const noRole = Step.safeParse({
      ...baseSynthesis,
      executor: 'worker',
      kind: 'dispatch',
      writes: {
        request: 'r.json',
        receipt: 'c.json',
        result: 's.json',
      },
      gate: {
        kind: 'result_verdict',
        source: { kind: 'dispatch_result', ref: 'result' },
        pass: ['ok'],
      },
    });
    expect(noRole.success).toBe(false);

    const ok = Step.safeParse({
      ...baseSynthesis,
      executor: 'worker',
      kind: 'dispatch',
      role: 'researcher',
      writes: {
        request: 'r.json',
        receipt: 'c.json',
        result: 's.json',
      },
      gate: {
        kind: 'result_verdict',
        source: { kind: 'dispatch_result', ref: 'result' },
        pass: ['ok'],
      },
    });
    expect(ok.success).toBe(true);
  });

  it('STEP-I1 — rejects orchestrator + dispatch kind/gate/writes mismatch', () => {
    expectSchemaRejects(
      Step,
      {
        ...baseSynthesis,
        kind: 'dispatch',
        writes: { request: 'r.json', receipt: 'c.json', result: 's.json' },
        gate: {
          kind: 'result_verdict',
          source: { kind: 'dispatch_result', ref: 'result' },
          pass: ['ok'],
        },
      },
      'STEP-I1: orchestrator role is incompatible with dispatch step kind/gate/writes shape',
    );
  });

  it('STEP-I1 — checkpoint step requires checkpoint_selection gate', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      kind: 'checkpoint',
      policy: checkpointPolicy(['continue']),
      writes: { request: 'req.json', response: 'resp.json' },
      gate: {
        kind: 'schema_sections',
        source: { kind: 'artifact', ref: 'artifact' },
        required: ['y'],
      },
    });
    expect(bad.success).toBe(false);
  });

  it('STEP-I1 — verification step requires schema_sections gate', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      kind: 'verification',
      writes: {
        artifact: { path: 'artifacts/build/verification.json', schema: 'build.verification@v1' },
      },
      gate: {
        kind: 'checkpoint_selection',
        source: { kind: 'checkpoint_response', ref: 'response' },
        allow: ['continue'],
      },
    });
    expect(bad.success).toBe(false);
  });

  it('STEP-I6 — verification step rejects dispatch role', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      kind: 'verification',
      writes: {
        artifact: { path: 'artifacts/build/verification.json', schema: 'build.verification@v1' },
      },
      role: 'implementer',
    });
    expect(bad.success).toBe(false);
  });

  it('STEP-I2 — rejects empty routes map', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      routes: {},
    });
    expect(bad.success).toBe(false);
  });

  it('STEP-I5 — rejects invalid budget bounds', () => {
    for (const budgets of [
      { max_attempts: 0 },
      { max_attempts: 11 },
      { max_attempts: 1.5 },
      { max_attempts: 1, wall_clock_ms: 0 },
      { max_attempts: 1, wall_clock_ms: 1.5 },
    ]) {
      expect(Step.safeParse({ ...baseSynthesis, budgets }).success).toBe(false);
    }
  });

  it('STEP-I7 — rejects a step without protocol', () => {
    const { protocol: _protocol, ...withoutProtocol } = baseSynthesis;
    const bad = Step.safeParse(withoutProtocol);
    expect(bad.success).toBe(false);
  });

  it('SynthesisStep rejects gate.source.ref naming a missing writes slot (STEP-I3)', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      gate: {
        kind: 'schema_sections' as const,
        source: { kind: 'artifact' as const, ref: 'missing-slot' },
        required: ['Objective'],
      },
    });
    expect(bad.success).toBe(false);
  });

  it('CheckpointStep rejects gate.source.ref naming a missing writes slot (STEP-I3)', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      kind: 'checkpoint',
      policy: checkpointPolicy(['continue']),
      writes: { request: 'req.json', response: 'resp.json' },
      gate: {
        kind: 'checkpoint_selection',
        source: { kind: 'checkpoint_response', ref: 'nope' },
        allow: ['continue'],
      },
    });
    expect(bad.success).toBe(false);
  });

  it('DispatchStep rejects gate.source.ref naming a missing writes slot (STEP-I3)', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      executor: 'worker',
      kind: 'dispatch',
      role: 'researcher',
      writes: {
        request: 'r.json',
        receipt: 'c.json',
        result: 's.json',
      },
      gate: {
        kind: 'result_verdict',
        source: { kind: 'dispatch_result', ref: 'ghost' },
        pass: ['ok'],
      },
    });
    expect(bad.success).toBe(false);
  });

  it('CheckpointStep accepts ref naming a real writes slot (positive pair for STEP-I3)', () => {
    const ok = Step.safeParse({
      ...baseSynthesis,
      kind: 'checkpoint',
      policy: checkpointPolicy(),
      writes: { request: 'req.json', response: 'resp.json' },
      gate: {
        kind: 'checkpoint_selection',
        source: { kind: 'checkpoint_response', ref: 'response' },
        allow: ['continue', 'revise'],
      },
    });
    expect(ok.success).toBe(true);
  });

  it('STEP-I9 — checkpoint policy safe choices must be declared choices', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      kind: 'checkpoint',
      policy: { ...checkpointPolicy(['continue']), safe_autonomous_choice: 'ghost' },
      writes: { request: 'req.json', response: 'resp.json' },
      gate: {
        kind: 'checkpoint_selection',
        source: { kind: 'checkpoint_response', ref: 'response' },
        allow: ['continue'],
      },
    });
    expect(bad.success).toBe(false);
  });

  it('STEP-I9 — checkpoint gate allow list must match policy choices', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      kind: 'checkpoint',
      policy: checkpointPolicy(['continue', 'revise']),
      writes: { request: 'req.json', response: 'resp.json' },
      gate: {
        kind: 'checkpoint_selection',
        source: { kind: 'checkpoint_response', ref: 'response' },
        allow: ['continue'],
      },
    });
    expect(bad.success).toBe(false);
  });

  it('STEP-I9 — checkpoint artifact writing is restricted to typed Build brief policy', () => {
    const missingTemplate = Step.safeParse({
      ...baseSynthesis,
      kind: 'checkpoint',
      policy: checkpointPolicy(['continue']),
      writes: {
        request: 'req.json',
        response: 'resp.json',
        artifact: { path: 'artifacts/build/brief.json', schema: 'build.brief@v1' },
      },
      gate: {
        kind: 'checkpoint_selection',
        source: { kind: 'checkpoint_response', ref: 'response' },
        allow: ['continue'],
      },
    });
    expect(missingTemplate.success).toBe(false);

    const unsupportedArtifact = Step.safeParse({
      ...baseSynthesis,
      kind: 'checkpoint',
      policy: {
        ...checkpointPolicy(['continue']),
        build_brief: {
          scope: 'x',
          success_criteria: ['y'],
          verification_command_candidates: [
            {
              id: 'verify',
              cwd: '.',
              argv: ['node', '--version'],
              timeout_ms: 1_000,
              max_output_bytes: 20_000,
              env: {},
            },
          ],
        },
      },
      writes: {
        request: 'req.json',
        response: 'resp.json',
        artifact: { path: 'artifacts/other.json', schema: 'other@v1' },
      },
      gate: {
        kind: 'checkpoint_selection',
        source: { kind: 'checkpoint_response', ref: 'response' },
        allow: ['continue'],
      },
    });
    expect(unsupportedArtifact.success).toBe(false);
  });

  // Prototype-chain `in` operator attack.
  // With `ref` as a Zod literal per source kind, these fail at parse.
  it('rejects artifact source with ref "toString" (prototype-chain attack, STEP-I3)', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      gate: {
        kind: 'schema_sections',
        source: { kind: 'artifact', ref: 'toString' },
        required: ['Objective'],
      },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects artifact source with ref "__proto__" (prototype-chain attack, STEP-I3)', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      gate: {
        kind: 'schema_sections',
        source: { kind: 'artifact', ref: '__proto__' },
        required: ['Objective'],
      },
    });
    expect(bad.success).toBe(false);
  });

  // source.kind must semantically pair with the correct writes slot, not just
  // any existing slot. `ref` literal enforces this.
  it('rejects checkpoint_response source with ref "request" (cross-slot drift, STEP-I4)', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      kind: 'checkpoint',
      policy: checkpointPolicy(['continue']),
      writes: { request: 'req.json', response: 'resp.json' },
      gate: {
        kind: 'checkpoint_selection',
        source: { kind: 'checkpoint_response', ref: 'request' },
        allow: ['continue'],
      },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects dispatch_result source with ref "receipt" (cross-slot drift, STEP-I4)', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      executor: 'worker',
      kind: 'dispatch',
      role: 'researcher',
      writes: {
        request: 'r.json',
        receipt: 'c.json',
        result: 's.json',
      },
      gate: {
        kind: 'result_verdict',
        source: { kind: 'dispatch_result', ref: 'receipt' },
        pass: ['ok'],
      },
    });
    expect(bad.success).toBe(false);
  });

  // STEP-I6: `.strict()` rejects surplus keys.
  it('rejects SynthesisStep with surplus top-level key (STEP-I6 strict)', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      role: 'implementer',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects gate source with surplus key (STEP-I6 strict on source objects)', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      gate: {
        kind: 'schema_sections',
        source: { kind: 'artifact', ref: 'artifact', stray: true },
        required: ['Objective'],
      },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects gate top-level with surplus key (STEP-I6 strict on gate variants)', () => {
    const bad = Step.safeParse({
      ...baseSynthesis,
      gate: {
        kind: 'schema_sections',
        source: { kind: 'artifact', ref: 'artifact' },
        required: ['Objective'],
        extra: 'field',
      },
    });
    expect(bad.success).toBe(false);
  });

  it('STEP-I8 — rejects non-run-relative paths on every workflow-controlled Step path surface', () => {
    const invalidPaths = [
      '../escaped.json',
      'artifacts/../../escaped.json',
      '/tmp/escaped.json',
      'C:\\escaped.json',
      'artifacts\\escaped.json',
      'artifacts//x.json',
      './x.json',
      'artifacts/./x.json',
      '',
    ];
    const invalidCases = [
      (path: string) => ({
        ...baseSynthesis,
        reads: [path],
      }),
      (path: string) => ({
        ...baseSynthesis,
        writes: { artifact: { path, schema: 'brief@v1' } },
      }),
      (path: string) => ({
        ...baseSynthesis,
        kind: 'checkpoint' as const,
        policy: checkpointPolicy(['continue']),
        writes: { request: path, response: 'resp.json' },
        gate: {
          kind: 'checkpoint_selection' as const,
          source: { kind: 'checkpoint_response' as const, ref: 'response' as const },
          allow: ['continue'],
        },
      }),
      (path: string) => ({
        ...baseSynthesis,
        kind: 'checkpoint' as const,
        policy: checkpointPolicy(['continue']),
        writes: { request: 'req.json', response: path },
        gate: {
          kind: 'checkpoint_selection' as const,
          source: { kind: 'checkpoint_response' as const, ref: 'response' as const },
          allow: ['continue'],
        },
      }),
      (path: string) => ({
        ...baseSynthesis,
        kind: 'checkpoint' as const,
        policy: checkpointPolicy(['continue']),
        writes: {
          request: 'req.json',
          response: 'resp.json',
          artifact: { path, schema: 'brief@v1' },
        },
        gate: {
          kind: 'checkpoint_selection' as const,
          source: { kind: 'checkpoint_response' as const, ref: 'response' as const },
          allow: ['continue'],
        },
      }),
      (path: string) => ({
        ...baseSynthesis,
        executor: 'worker' as const,
        kind: 'dispatch' as const,
        role: 'researcher' as const,
        writes: { request: path, receipt: 'receipt.json', result: 'result.json' },
        gate: {
          kind: 'result_verdict' as const,
          source: { kind: 'dispatch_result' as const, ref: 'result' as const },
          pass: ['ok'],
        },
      }),
      (path: string) => ({
        ...baseSynthesis,
        executor: 'worker' as const,
        kind: 'dispatch' as const,
        role: 'researcher' as const,
        writes: { request: 'request.json', receipt: path, result: 'result.json' },
        gate: {
          kind: 'result_verdict' as const,
          source: { kind: 'dispatch_result' as const, ref: 'result' as const },
          pass: ['ok'],
        },
      }),
      (path: string) => ({
        ...baseSynthesis,
        executor: 'worker' as const,
        kind: 'dispatch' as const,
        role: 'researcher' as const,
        writes: { request: 'request.json', receipt: 'receipt.json', result: path },
        gate: {
          kind: 'result_verdict' as const,
          source: { kind: 'dispatch_result' as const, ref: 'result' as const },
          pass: ['ok'],
        },
      }),
      (path: string) => ({
        ...baseSynthesis,
        executor: 'worker' as const,
        kind: 'dispatch' as const,
        role: 'researcher' as const,
        writes: {
          request: 'request.json',
          receipt: 'receipt.json',
          result: 'result.json',
          artifact: { path, schema: 'brief@v1' },
        },
        gate: {
          kind: 'result_verdict' as const,
          source: { kind: 'dispatch_result' as const, ref: 'result' as const },
          pass: ['ok'],
        },
      }),
    ];

    for (const path of invalidPaths) {
      for (const makeStep of invalidCases) {
        expect(Step.safeParse(makeStep(path)).success, `path ${JSON.stringify(path)}`).toBe(false);
      }
    }
  });
});
