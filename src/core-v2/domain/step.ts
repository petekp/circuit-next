import type { RouteName } from './route.js';

export type StepId = string;

export type StepKindV2 = 'compose' | 'verification' | 'checkpoint' | 'relay' | 'sub-run' | 'fanout';

export interface StepOutcomeV2 {
  readonly route: RouteName;
  readonly details?: Record<string, unknown>;
}
