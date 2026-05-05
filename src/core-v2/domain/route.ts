import type { StepId } from './step.js';

export type RouteName = string;

export type TerminalTarget = '@complete' | '@stop' | '@handoff' | '@escalate';

export const TERMINAL_TARGETS: readonly TerminalTarget[] = [
  '@complete',
  '@stop',
  '@handoff',
  '@escalate',
] as const;

export type RouteTarget =
  | { readonly kind: 'step'; readonly stepId: StepId }
  | { readonly kind: 'terminal'; readonly target: TerminalTarget };

export type RoutesV2 = Readonly<Record<RouteName, RouteTarget>>;
