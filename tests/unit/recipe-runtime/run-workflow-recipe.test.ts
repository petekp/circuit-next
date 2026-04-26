import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  type RecipeDispatcher,
  isKnownRecipeWorkflowId,
  runWorkflowAsRecipe,
} from '../../../src/runtime/recipe-runtime/index.js';

let runRoot: string;

beforeEach(() => {
  runRoot = mkdtempSync(join(tmpdir(), 'recipe-bridge-'));
});

afterEach(() => {
  rmSync(runRoot, { recursive: true, force: true });
});

function readArtifact(path: string): {
  recipe_id: string;
  outcome: string;
  trace: readonly { uses: string }[];
  evidence: Record<string, unknown>;
} {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('runWorkflowAsRecipe bridge', () => {
  it('classifies build, explore, and review as known recipe workflows', () => {
    expect(isKnownRecipeWorkflowId('build')).toBe(true);
    expect(isKnownRecipeWorkflowId('explore')).toBe(true);
    expect(isKnownRecipeWorkflowId('review')).toBe(true);
    expect(isKnownRecipeWorkflowId('fix')).toBe(false);
    expect(isKnownRecipeWorkflowId('unknown')).toBe(false);
  });

  it('runs the build workflow as a recipe and persists recipe-run.json under the run root', async () => {
    const result = await runWorkflowAsRecipe({
      workflowId: 'build',
      runRoot,
      goal: 'Wire the recipe substrate into the build entry point',
      verificationCommands: ['npm run check'],
    });

    expect(result.runRoot).toBe(runRoot);
    expect(result.artifactPath).toBe(join(runRoot, 'recipe-run.json'));
    expect(result.result.outcome).toBe('complete');

    const persisted = readArtifact(result.artifactPath);
    expect(persisted.recipe_id).toBe('build');
    expect(persisted.outcome).toBe('complete');
    expect(persisted.trace.map((entry) => entry.uses)).toEqual([
      'frame',
      'plan',
      'act',
      'run-verification',
      'review',
      'close-with-evidence',
    ]);
    expect(persisted.evidence['workflow.result@v1']).toBeDefined();
  });

  it('runs the explore workflow without verification', async () => {
    const result = await runWorkflowAsRecipe({
      workflowId: 'explore',
      runRoot,
      goal: 'Investigate flaky payment test',
      contextPacket: {
        source_list: ['tests/payments/checkout.test.ts'],
        observations: ['Flake repros on CI only'],
        confidence_notes: 'seeded',
      },
    });

    expect(result.result.outcome).toBe('complete');
    const persisted = readArtifact(result.artifactPath);
    expect(persisted.recipe_id).toBe('explore');
    expect(persisted.trace.map((entry) => entry.uses)).toEqual([
      'frame',
      'diagnose',
      'act',
      'review',
      'close-with-evidence',
    ]);
  });

  it('runs the audit-only review workflow', async () => {
    const result = await runWorkflowAsRecipe({
      workflowId: 'review',
      runRoot,
      goal: 'Audit recipe substrate cutover plan',
    });

    expect(result.result.outcome).toBe('complete');
    const persisted = readArtifact(result.artifactPath);
    expect(persisted.recipe_id).toBe('review');
    expect(persisted.trace.map((entry) => entry.uses)).toEqual([
      'frame',
      'review',
      'close-with-evidence',
    ]);
  });

  it('routes dispatch-kind items through an injected dispatcher when supplied', async () => {
    const calls: string[] = [];
    const dispatcher: RecipeDispatcher = ({ item }) => {
      calls.push(item.uses);
      switch (item.uses) {
        case 'plan':
          return {
            output: {
              schema_version: 1,
              ordered_steps: ['injected-step-1', 'injected-step-2'],
              risk_notes: ['injected risk'],
              proof_strategy: 'injected proof',
            },
            outcome: 'continue' as const,
            summary: 'injected plan',
          };
        case 'act':
          return {
            output: {
              schema_version: 1,
              changed_files: ['src/injected.ts'],
              change_rationale: 'injected change',
              declared_follow_up_proof: 'injected proof',
            },
            outcome: 'continue' as const,
            summary: 'injected act',
          };
        case 'review':
          return {
            output: {
              schema_version: 1,
              verdict: 'accept',
              findings: [],
              confidence: 'high',
              required_fixes: [],
            },
            outcome: 'continue' as const,
            summary: 'injected review',
          };
        default:
          throw new Error(`unexpected dispatch primitive: ${item.uses}`);
      }
    };

    const result = await runWorkflowAsRecipe({
      workflowId: 'build',
      runRoot,
      goal: 'Bridge dispatcher injection through the build recipe',
      dispatcher,
    });

    expect(result.result.outcome).toBe('complete');
    expect(calls).toEqual(['plan', 'act', 'review']);
  });
});
