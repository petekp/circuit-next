const RECOVERY_ROUTE_PRIORITY = ['retry', 'revise', 'ask', 'stop', 'handoff', 'escalate'] as const;
type RecoveryRoute = (typeof RECOVERY_ROUTE_PRIORITY)[number];

export function recoveryRouteForStep(
  step: { readonly routes: Record<string, string> },
  allowedRoutes: readonly RecoveryRoute[] = RECOVERY_ROUTE_PRIORITY,
): string | undefined {
  const allowed = new Set(allowedRoutes);
  return RECOVERY_ROUTE_PRIORITY.find(
    (route) => allowed.has(route) && Object.hasOwn(step.routes, route),
  );
}
