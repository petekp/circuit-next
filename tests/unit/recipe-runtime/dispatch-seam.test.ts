import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  type RecipeDispatcher,
  defaultOrchestratorHandlers,
  dispatchedWorkerHandlers,
  mergeHandlerRegistries,
  runRecipe,
} from '../../../src/runtime/recipe-runtime/index.js';
import type { WorkflowPrimitiveContractRef } from '../../../src/schemas/workflow-primitives.js';
import {
  WorkflowRecipe,
  compileWorkflowRecipeDraft,
  projectWorkflowRecipeForCompiler,
} from '../../../src/schemas/workflow-recipe.js';

const fixLiteRecipePath = 'tests/fixtures/recipe-runtime/fix-lite.recipe.json';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function fixLiteInitialEvidence(): Map<WorkflowPrimitiveContractRef, unknown> {
  return new Map<WorkflowPrimitiveContractRef, unknown>([
    ['user.goal@v1' as WorkflowPrimitiveContractRef, 'Diagnose dispatcher seam smoke'],
    ['workflow.catalog@v1' as WorkflowPrimitiveContractRef, ['fix'] as readonly string[]],
    ['context.request@v1' as WorkflowPrimitiveContractRef, { targets: ['src/dispatch-seam.ts'] }],
    ['verification.plan@v1' as WorkflowPrimitiveContractRef, { commands: ['npm run check'] }],
  ]);
}

describe('recipe runtime dispatcher seam', () => {
  it('routes dispatch-kind items through the injected dispatcher', async () => {
    const recipe = WorkflowRecipe.parse(readJson(fixLiteRecipePath));
    const projection = projectWorkflowRecipeForCompiler(recipe);
    const draft = compileWorkflowRecipeDraft(projection, 'standard');

    const calls: { itemId: string; primitive: string; role: string }[] = [];
    const dispatcher: RecipeDispatcher = ({ item, role }) => {
      calls.push({
        itemId: item.id as unknown as string,
        primitive: item.uses,
        role,
      });
      // Return a deterministic shape that satisfies downstream readers.
      switch (item.uses) {
        case 'gather-context':
          return {
            output: {
              schema_version: 1,
              source_list: ['stub-source'],
              observations: ['stub observation'],
              confidence_notes: 'stub-dispatched',
            },
            outcome: 'continue',
            summary: 'stub gather-context dispatched',
          };
        case 'diagnose':
          return {
            output: {
              schema_version: 1,
              cause_hypothesis: 'stub cause',
              confidence: 'low',
              reproduction_status: 'unknown',
              diagnostic_path: ['stub'],
            },
            outcome: 'continue',
            summary: 'stub diagnose dispatched',
          };
        case 'act':
          return {
            output: {
              schema_version: 1,
              changed_files: ['stub.ts'],
              change_rationale: 'stub change',
              declared_follow_up_proof: 'stub proof',
            },
            outcome: 'continue',
            summary: 'stub act dispatched',
          };
        default:
          throw new Error(`unexpected dispatch primitive: ${item.uses}`);
      }
    };

    const handlers = mergeHandlerRegistries(
      defaultOrchestratorHandlers(),
      // Verification still synthesizes; only worker primitives go through
      // the dispatcher seam so we can prove routing without bringing the
      // verifier through the seam too.
      new Map([
        [
          'run-verification',
          (ctx) => {
            const proof = ctx.inputs.byBinding.get('proof') as { commands: readonly string[] };
            return {
              output: {
                schema_version: 1,
                command_list: proof.commands,
                exit_status: proof.commands.map(() => 0),
                bounded_output: proof.commands.map((c) => `[stub] ${c} ok`),
                pass_or_fail: 'pass' as const,
              },
              outcome: 'continue' as const,
            };
          },
        ],
      ]),
      dispatchedWorkerHandlers(dispatcher),
    );

    const result = await runRecipe({
      recipe,
      draft,
      handlers,
      initialEvidence: fixLiteInitialEvidence(),
    });

    expect(result.outcome).toBe('complete');
    expect(calls).toEqual([
      { itemId: 'lite-gather', primitive: 'gather-context', role: 'researcher' },
      { itemId: 'lite-diagnose', primitive: 'diagnose', role: 'researcher' },
      { itemId: 'lite-act', primitive: 'act', role: 'implementer' },
    ]);

    const dispatched = result.trace.filter((entry) =>
      ['gather-context', 'diagnose', 'act'].includes(entry.uses),
    );
    expect(dispatched.map((entry) => entry.summary)).toEqual([
      'stub gather-context dispatched',
      'stub diagnose dispatched',
      'stub act dispatched',
    ]);
  });

  it('rejects when dispatchHandler is invoked on a non-dispatch item', async () => {
    const recipe = WorkflowRecipe.parse(readJson(fixLiteRecipePath));
    const projection = projectWorkflowRecipeForCompiler(recipe);
    const draft = compileWorkflowRecipeDraft(projection, 'standard');

    // Wire the dispatcher to the orchestrator-only `frame` primitive (which
    // is execution.kind='synthesis') to prove the safety check fires.
    const dispatcher: RecipeDispatcher = () => ({
      output: { schema_version: 1, scope_boundary: 'x', constraints: [], proof_plan: 'x' },
      outcome: 'continue',
    });
    const wronglyAssigned = mergeHandlerRegistries(
      defaultOrchestratorHandlers(),
      new Map([
        [
          'frame',
          (await import('../../../src/runtime/recipe-runtime/dispatch.js')).dispatchHandler(
            dispatcher,
          ),
        ],
      ]),
      dispatchedWorkerHandlers(() => ({
        output: {
          schema_version: 1,
          source_list: [],
          observations: [],
          confidence_notes: '',
        },
        outcome: 'continue',
      })),
    );

    await expect(
      runRecipe({
        recipe,
        draft,
        handlers: wronglyAssigned,
        initialEvidence: fixLiteInitialEvidence(),
      }),
    ).rejects.toThrow(/is not a dispatch-execution item/);
  });
});
