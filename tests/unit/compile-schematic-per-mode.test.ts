// Unit tests for the per-mode behavior of compileSchematicToWorkflow:
// reachability with route_overrides, dead-step elimination per mode,
// auto-omitted canonicals in spine_policy, and the dropped-outcomes
// (handoff/escalate) handling. Byte-equivalence against committed
// compiled flows is covered separately by
// tests/contracts/compile-schematic-to-workflow.test.ts.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { compileSchematicToWorkflow } from '../../src/runtime/compile-schematic-to-workflow.js';
import { FlowSchematic } from '../../src/schemas/flow-schematic.js';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function loadBuildSchematic() {
  return FlowSchematic.parse(readJson('src/workflows/build/schematic.json'));
}

describe('compileSchematicToWorkflow — per-mode emission', () => {
  it('returns kind:single when no item declares route_overrides', () => {
    const schematic = loadBuildSchematic();
    const result = compileSchematicToWorkflow(schematic);
    expect(result.kind).toBe('single');
    if (result.kind !== 'single') return;
    expect(result.workflow.entry_modes.map((m) => m.name)).toEqual([
      'default',
      'lite',
      'deep',
      'autonomous',
    ]);
  });

  it('returns kind:per-mode when an item declares route_overrides; lite mode drops unreachable items', () => {
    const schematic = loadBuildSchematic();
    const items = schematic.items.map((item) =>
      (item.id as unknown as string) === 'review-step'
        ? { ...item, route_overrides: { continue: { lite: '@complete' as const } } }
        : item,
    );
    const mutated = { ...schematic, items } as typeof schematic;

    const result = compileSchematicToWorkflow(mutated);
    expect(result.kind).toBe('per-mode');
    if (result.kind !== 'per-mode') return;

    const lite = result.workflows.get('lite');
    const def = result.workflows.get('default');
    expect(lite).toBeDefined();
    expect(def).toBeDefined();
    if (lite === undefined || def === undefined) return;

    // Reachable steps differ. Lite skips close-step entirely because
    // review-step's continue edge now lands on the @complete terminal.
    const liteIds = lite.steps.map((s) => s.id as unknown as string);
    const defIds = def.steps.map((s) => s.id as unknown as string);
    expect(liteIds).not.toContain('close-step');
    expect(defIds).toContain('close-step');

    // The review-step's own pass edge differs by mode.
    const liteReview = lite.steps.find((s) => (s.id as unknown as string) === 'review-step');
    const defReview = def.steps.find((s) => (s.id as unknown as string) === 'review-step');
    expect(liteReview?.routes.pass).toBe('@complete');
    expect(defReview?.routes.pass).toBe('close-step');

    // Each per-mode compiled flow lists only that mode in entry_modes.
    expect(lite.entry_modes.map((m) => m.name)).toEqual(['lite']);
    expect(def.entry_modes.map((m) => m.name)).toEqual(['default']);
  });

  it('auto-omits canonicals that have no reachable items in a given mode', () => {
    const schematic = loadBuildSchematic();
    const items = schematic.items.map((item) =>
      (item.id as unknown as string) === 'review-step'
        ? { ...item, route_overrides: { continue: { lite: '@complete' as const } } }
        : item,
    );
    const mutated = { ...schematic, items } as typeof schematic;

    const result = compileSchematicToWorkflow(mutated);
    if (result.kind !== 'per-mode') {
      throw new Error('expected per-mode result');
    }
    const lite = result.workflows.get('lite');
    if (lite === undefined) throw new Error('expected lite compiled flow');

    // close-step's canonical phase is 'close'. Lite drops it; the compiled
    // spine_policy must auto-omit 'close' so the Workflow validator's
    // spine completeness rule still passes.
    expect(lite.spine_policy.mode).toBe('partial');
    if (lite.spine_policy.mode !== 'partial') return;
    expect(lite.spine_policy.omits).toContain('close');
    expect(lite.spine_policy.rationale).toMatch(/lite/);
  });

  it('drops handoff and escalate outcomes at compile without erroring', () => {
    const schematic = loadBuildSchematic();
    const items = schematic.items.map((item) =>
      (item.id as unknown as string) === 'close-step'
        ? {
            ...item,
            routes: {
              ...item.routes,
              handoff: '@handoff' as const,
              escalate: '@escalate' as const,
            },
          }
        : item,
    );
    const mutated = { ...schematic, items } as typeof schematic;

    const result = compileSchematicToWorkflow(mutated);
    expect(result.kind).toBe('single');
    if (result.kind !== 'single') return;
    const close = result.workflow.steps.find((s) => (s.id as unknown as string) === 'close-step');
    expect(close).toBeDefined();
    // The compiled close-step should only carry the pass edge; handoff /
    // escalate outcomes are author-intent and live only in the schematic.
    expect(Object.keys(close?.routes ?? {})).toEqual(['pass']);
  });
});
