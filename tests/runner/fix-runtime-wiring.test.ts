// End-to-end runtime wiring for the lite Fix workflow.
//
// Loads `.claude-plugin/skills/fix/lite.json` (the compiled lite-mode
// Workflow) and runs it through `runWorkflow` with stubbed dispatchers
// for context/diagnose/act and a custom synthesisWriter that overrides
// fix-frame to produce a brief with a fast no-op verification command.
// Other synthesis steps fall through to the registered writer, so this
// is a real proof that fix.brief, fix.verify, and fix.result close
// writers compose correctly through the actual Workflow + runner.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AgentDispatchInput } from '../../src/runtime/adapters/agent.js';
import type { DispatchResult } from '../../src/runtime/adapters/shared.js';
import {
  type DispatchFn,
  type SynthesisWriterInput,
  runWorkflow,
  writeSynthesisArtifact,
} from '../../src/runtime/runner.js';
import { RunId } from '../../src/schemas/ids.js';
import type { LaneDeclaration } from '../../src/schemas/lane.js';
import { Workflow } from '../../src/schemas/workflow.js';
import { FixBrief, FixResult } from '../../src/workflows/fix/artifacts.js';

const FIX_LITE_FIXTURE_PATH = resolve('.claude-plugin', 'skills', 'fix', 'lite.json');

function loadLiteFixture(): { workflow: Workflow; bytes: Buffer } {
  const bytes = readFileSync(FIX_LITE_FIXTURE_PATH);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  return { workflow: Workflow.parse(raw), bytes };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function lane(): LaneDeclaration {
  return {
    lane: 'ratchet-advance',
    failure_mode: 'lite Fix had no end-to-end runtime proof through close',
    acceptance_evidence:
      'runWorkflow closes the lite Fix workflow via real Workflow with stubbed dispatchers and a fast verification command',
    alternate_framing:
      'defer until full Fix is wired — rejected because lite is the proving substrate per workflow-direction.md',
  };
}

// Custom synthesis writer for the e2e test: overrides fix-frame to
// produce a brief with a fast no-op verification command (so fix-verify
// runs in milliseconds instead of executing real `npm run verify`),
// and falls through to the standard writeSynthesisArtifact for every
// other synthesis step (notably fix-close-lite, which exercises the
// new fix.result close writer).
function frameOverrideSynthesisWriter(input: SynthesisWriterInput): void {
  if ((input.step.id as unknown as string) === 'fix-frame') {
    const brief = FixBrief.parse({
      problem_statement: input.goal,
      expected_behavior: `After fix: ${input.goal}`,
      observed_behavior: `Before fix: ${input.goal}`,
      scope: 'test scope',
      regression_contract: {
        expected_behavior: `After fix: ${input.goal}`,
        actual_behavior: `Before fix: ${input.goal}`,
        repro: {
          kind: 'not-reproducible',
          deferred_reason: 'e2e test — repro deferred',
        },
        regression_test: {
          status: 'deferred',
          deferred_reason: 'e2e test — regression test deferred',
        },
      },
      success_criteria: [`Verify exits 0 for: ${input.goal}`],
      verification_command_candidates: [
        {
          id: 'noop-verify',
          cwd: '.',
          argv: [process.execPath, '-e', 'process.exit(0)'],
          timeout_ms: 30_000,
          max_output_bytes: 200_000,
          env: {},
        },
      ],
    });
    const abs = join(input.runRoot, input.step.writes.artifact.path as unknown as string);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, `${JSON.stringify(brief, null, 2)}\n`);
    return;
  }
  writeSynthesisArtifact(input);
}

function dispatcher(): DispatchFn {
  return {
    adapterName: 'agent',
    dispatch: async (input: AgentDispatchInput): Promise<DispatchResult> => {
      const isContext = input.prompt.includes('Step: fix-gather-context');
      const isDiagnose = input.prompt.includes('Step: fix-diagnose');
      const isAct = input.prompt.includes('Step: fix-act');
      expect(isContext || isDiagnose || isAct).toBe(true);
      const body = isContext
        ? JSON.stringify({
            verdict: 'accept',
            sources: [{ kind: 'file', ref: 'src/test.ts:1', summary: 'stub source for e2e test' }],
            observations: ['Stubbed gather-context observation'],
            open_questions: [],
          })
        : isDiagnose
          ? JSON.stringify({
              verdict: 'accept',
              reproduction_status: 'reproduced',
              cause_summary: 'e2e test cause',
              confidence: 'high',
              evidence: ['Stubbed diagnose evidence'],
              residual_uncertainty: [],
            })
          : JSON.stringify({
              verdict: 'accept',
              summary: 'Stubbed change summary',
              diagnosis_ref: 'fix.diagnosis@v1',
              changed_files: ['src/test.ts'],
              evidence: ['Stubbed change evidence'],
            });
      return {
        request_payload: input.prompt,
        receipt_id: isContext
          ? 'stub-fix-context'
          : isDiagnose
            ? 'stub-fix-diagnose'
            : 'stub-fix-act',
        result_body: body,
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

let runRootBase: string;

beforeEach(() => {
  runRootBase = mkdtempSync(join(tmpdir(), 'circuit-next-fix-runtime-'));
});

afterEach(() => {
  rmSync(runRootBase, { recursive: true, force: true });
});

describe('Lite Fix runtime wiring', () => {
  it('runs the live lite Fix Workflow end-to-end and closes with a FixResult', async () => {
    const { workflow, bytes } = loadLiteFixture();
    const runRoot = join(runRootBase, 'lite-complete');

    const outcome = await runWorkflow({
      runRoot,
      workflow,
      workflowBytes: bytes,
      runId: RunId.parse('f1000000-0000-0000-0000-000000000000'),
      goal: 'fix off-by-one in pagination',
      rigor: 'lite',
      lane: lane(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 10, 0, 0)),
      dispatcher: dispatcher(),
      synthesisWriter: frameOverrideSynthesisWriter,
      projectRoot: resolve('.'),
    });

    if (outcome.result.outcome !== 'complete') {
      throw new Error(
        `lite Fix run did not complete: outcome=${outcome.result.outcome} reason=${outcome.result.reason ?? '<none>'} events=${outcome.events.map((e) => e.kind).join(',')}`,
      );
    }
    expect(outcome.result.outcome).toBe('complete');
    expect(existsSync(join(runRoot, 'artifacts/fix/brief.json'))).toBe(true);
    expect(existsSync(join(runRoot, 'artifacts/fix/context.json'))).toBe(true);
    expect(existsSync(join(runRoot, 'artifacts/fix/diagnosis.json'))).toBe(true);
    expect(existsSync(join(runRoot, 'artifacts/fix/change.json'))).toBe(true);
    expect(existsSync(join(runRoot, 'artifacts/fix/verification.json'))).toBe(true);
    expect(existsSync(join(runRoot, 'artifacts/fix-result.json'))).toBe(true);

    const result = FixResult.parse(
      JSON.parse(readFileSync(join(runRoot, 'artifacts/fix-result.json'), 'utf8')),
    );
    expect(result.review_status).toBe('skipped');
    expect(result.verification_status).toBe('passed');
    expect(['fixed', 'partial']).toContain(result.outcome);
    // Required pointers — review absent in lite.
    const ids = result.artifact_pointers.map((p) => p.artifact_id);
    expect(ids).toEqual([
      'fix.brief',
      'fix.context',
      'fix.diagnosis',
      'fix.change',
      'fix.verification',
    ]);
  });
});
