// Canonical stage order — matches CANONICAL_STAGES in src/schemas/stage.ts.
export const STAGE_ORDER = [
  'frame',
  'analyze',
  'plan',
  'act',
  'verify',
  'review',
  'close',
] as const;

export type Stage = (typeof STAGE_ORDER)[number];

export const TERMINAL_TARGETS = ['@complete', '@stop', '@handoff', '@escalate'] as const;
export type TerminalTarget = (typeof TERMINAL_TARGETS)[number];

// Route names from FlowRoute enum in src/schemas/flow-blocks.ts.
export const FLOW_ROUTES = [
  'continue',
  'retry',
  'revise',
  'ask',
  'split',
  'stop',
  'handoff',
  'escalate',
  'complete',
] as const;

export type FlowRouteName = (typeof FLOW_ROUTES)[number];

export function groupStepsByStage<T extends { stage: string }>(
  steps: readonly T[],
): { stage: string; steps: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const stage of STAGE_ORDER) groups.set(stage, []);
  for (const step of steps) {
    const arr = groups.get(step.stage);
    if (arr) {
      arr.push(step);
    } else {
      groups.set(step.stage, [step]);
    }
  }
  return [...groups.entries()]
    .filter(([, items]) => items.length > 0)
    .map(([stage, items]) => ({ stage, steps: items }));
}

export function isTerminalTarget(value: string): value is TerminalTarget {
  return (TERMINAL_TARGETS as readonly string[]).includes(value);
}
