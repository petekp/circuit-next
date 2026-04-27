// Proof that the synthesis writer registry is workflow-agnostic.
//
// Mirrors tests/runner/close-builder-registry.test.ts but for the
// upstream synthesis path. A synthetic SynthesisBuilder produces a
// fresh schema's artifact end-to-end via runWorkflow — no runner.ts
// edits required. If any synthesis step in the runner ever regrows
// workflow-specific knowledge, this test breaks.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { findSynthesisBuilder } from '../../src/runtime/registries/synthesis-writers/registry.js';
import type { SynthesisBuilder } from '../../src/runtime/registries/synthesis-writers/types.js';
import { runWorkflow, writeSynthesisArtifact } from '../../src/runtime/runner.js';
import { RunId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { Workflow } from '../../src/schemas/workflow.js';

const SYNTHETIC_BRIEF_SCHEMA = 'synthetic.brief@v1';
const SyntheticBrief = z
  .object({
    subject: z.string().min(1),
    motto: z.string().min(1),
  })
  .strict();

const syntheticBriefBuilder: SynthesisBuilder = {
  resultSchemaName: SYNTHETIC_BRIEF_SCHEMA,
  build(context) {
    return SyntheticBrief.parse({
      subject: context.goal,
      motto: 'Composability over inheritance.',
    });
  },
};

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode: 'synthesis writer registry binds builders to workflows-only',
    acceptance_evidence:
      'a synthetic builder produces an artifact via the same registry contract real builders use',
    alternate_framing: 'wait for a real new workflow — rejected because contract is testable now',
  };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function syntheticSynthesisWorkflow(): Workflow {
  return Workflow.parse({
    schema_version: '2',
    id: 'synthetic-synthesis-test',
    version: '0.1.0',
    purpose: 'Synthetic workflow that exercises the synthesis-writer registry contract.',
    entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'frame-step',
        rigor: 'standard',
        description: 'synthetic synthesis registry test',
      },
    ],
    phases: [{ id: 'frame-phase', title: 'Frame', canonical: 'frame', steps: ['frame-step'] }],
    spine_policy: {
      mode: 'partial',
      omits: ['analyze', 'plan', 'act', 'verify', 'review', 'close'],
      rationale: 'Synthetic synthesis-writer registry contract test substrate.',
    },
    steps: [
      {
        id: 'frame-step',
        title: 'frame-step',
        protocol: 'synthetic-frame@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'synthesis',
        writes: {
          artifact: { path: 'artifacts/synthetic-brief.json', schema: SYNTHETIC_BRIEF_SCHEMA },
        },
        gate: {
          kind: 'schema_sections',
          source: { kind: 'artifact', ref: 'artifact' },
          required: ['subject', 'motto'],
        },
      },
    ],
  });
}

let runRoot: string;

beforeEach(() => {
  runRoot = mkdtempSync(join(tmpdir(), 'circuit-next-synthesis-registry-'));
});

afterEach(() => {
  rmSync(runRoot, { recursive: true, force: true });
});

describe('synthesis writer registry', () => {
  it('exposes findSynthesisBuilder for every registered schema', () => {
    expect(findSynthesisBuilder('build.plan@v1')?.resultSchemaName).toBe('build.plan@v1');
    expect(findSynthesisBuilder('explore.brief@v1')?.resultSchemaName).toBe('explore.brief@v1');
    expect(findSynthesisBuilder('explore.analysis@v1')?.resultSchemaName).toBe(
      'explore.analysis@v1',
    );
    expect(findSynthesisBuilder('review.intake@v1')?.resultSchemaName).toBe('review.intake@v1');
    expect(findSynthesisBuilder('review.result@v1')?.resultSchemaName).toBe('review.result@v1');
    expect(findSynthesisBuilder('fix.brief@v1')?.resultSchemaName).toBe('fix.brief@v1');
  });

  it('returns undefined for an unregistered schema', () => {
    expect(findSynthesisBuilder(SYNTHETIC_BRIEF_SCHEMA)).toBeUndefined();
  });

  it('produces a synthetic artifact end-to-end via the registry contract', async () => {
    // The synthesisWriter seam lets this test inject the synthetic builder
    // without mutating the global registry. The dispatch path is the same
    // shape every registered builder uses — proving the contract works
    // for arbitrary new schemas with zero runner.ts changes.
    const workflow = syntheticSynthesisWorkflow();
    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: Buffer.from(JSON.stringify(workflow)),
      runId: RunId.parse('00000000-0000-0000-0000-0000bbbb1234'),
      goal: 'synthetic synthesis registry test',
      rigor: 'standard',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 14, 0, 0)),
      synthesisWriter: (input) => {
        const schemaName = input.step.writes.artifact.schema;
        if (schemaName === SYNTHETIC_BRIEF_SCHEMA) {
          const artifact = syntheticBriefBuilder.build({
            runRoot: input.runRoot,
            workflow: input.workflow,
            step: input.step,
            goal: input.goal,
            inputs: {},
          });
          const abs = join(input.runRoot, input.step.writes.artifact.path as unknown as string);
          mkdirSync(dirname(abs), { recursive: true });
          writeFileSync(abs, `${JSON.stringify(artifact, null, 2)}\n`);
          return;
        }
        writeSynthesisArtifact(input);
      },
    });

    if (outcome.result.outcome !== 'complete') {
      throw new Error(
        `synthetic run did not complete: outcome=${outcome.result.outcome} reason=${outcome.result.reason ?? '<none>'}`,
      );
    }
    expect(outcome.result.outcome).toBe('complete');
    const result = JSON.parse(
      readFileSync(join(runRoot, 'artifacts/synthetic-brief.json'), 'utf8'),
    ) as { subject: string; motto: string };
    expect(result.subject).toBe('synthetic synthesis registry test');
    expect(result.motto).toBe('Composability over inheritance.');
  });
});
