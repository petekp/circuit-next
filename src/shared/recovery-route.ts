export const RECOVERY_ROUTE_PRIORITY = [
  'retry',
  'revise',
  'ask',
  'stop',
  'handoff',
  'escalate',
] as const;

export type RecoveryRoute = (typeof RECOVERY_ROUTE_PRIORITY)[number];

export interface StepWithRoutes {
  readonly routes: Readonly<Record<string, unknown>>;
}

export function recoveryRouteForStep(
  step: StepWithRoutes,
  allowedRoutes: readonly RecoveryRoute[] = RECOVERY_ROUTE_PRIORITY,
): string | undefined {
  const allowed = new Set(allowedRoutes);
  return RECOVERY_ROUTE_PRIORITY.find(
    (route) => allowed.has(route) && Object.hasOwn(step.routes, route),
  );
}
