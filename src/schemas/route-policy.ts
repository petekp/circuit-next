export const RUNTIME_SUCCESS_ROUTE = 'pass' as const;

export const SCHEMATIC_SUCCESS_ROUTE_ALIASES = ['continue', 'complete'] as const;

export type SchematicSuccessRouteAlias = (typeof SCHEMATIC_SUCCESS_ROUTE_ALIASES)[number];

const SUCCESS_ROUTE_ALIAS_SET: ReadonlySet<string> = new Set(SCHEMATIC_SUCCESS_ROUTE_ALIASES);

export function schematicOutcomeToRuntimeRoute(
  outcome: string,
): typeof RUNTIME_SUCCESS_ROUTE | undefined {
  if (!SUCCESS_ROUTE_ALIAS_SET.has(outcome)) return undefined;
  return RUNTIME_SUCCESS_ROUTE;
}
