// CompiledFlow router — derives routing from src/flows/catalog.ts via
// buildRoutablePackages + findDefaultRoutablePackage.
//
// Each CompiledFlowPackage may declare routing metadata (signals, order,
// optional skipOnPlanningReport guard, default-fallback flag). The
// router walks packages in `order` ascending; positive signal matches
// route directly to that package. When `skipOnPlanningReport` is set
// AND the request mentions a planning report, the match is treated
// as a non-match and routing falls through to subsequent packages.
// The package marked `isDefault` is selected when nothing matches.

import { flowPackages } from '../flows/catalog.js';
import type { CompiledFlowPackage } from '../flows/types.js';
import {
  type RoutablePackage,
  buildRoutablePackages,
  findDefaultRoutablePackage,
} from './catalog-derivations.js';

const ROUTABLE_PACKAGES = buildRoutablePackages(flowPackages);
const DEFAULT_PACKAGE = findDefaultRoutablePackage(ROUTABLE_PACKAGES);

export const ROUTABLE_WORKFLOWS: readonly string[] = Object.freeze(
  ROUTABLE_PACKAGES.map((entry) => entry.pkg.id),
);

interface CompiledFlowRouteDecision {
  flowName: string;
  source: 'classifier';
  reason: string;
  matched_signal?: string;
}

const PLANNING_ARTIFACT_SIGNAL =
  /\b(?:proposal|plan|brief|matrix|evaluation\s+matrix|design\s+doc|design\s+document|spec|specification|rfc|memo|document|doc|guide|analysis|evaluation|selection|strategy|outline|report|comparison|recommendation|write-?up|options|approaches)\b/i;

// Pure classifier: takes pre-derived routables and a default package.
// The exported classifyCompiledFlowTask is a thin wrapper that binds the
// live catalog. Pulling the logic out lets tests exercise routing
// invariants (order precedence, isDefault selection, planning-report
// suppression) against synthetic mini-catalogs without vi.mock churn.
export function classifyTaskAgainstRoutables(
  taskText: string,
  routables: readonly RoutablePackage[],
  defaultPackage: RoutablePackage,
): CompiledFlowRouteDecision {
  const hasPlanningReport = PLANNING_ARTIFACT_SIGNAL.test(taskText);
  for (const { pkg, routing } of routables) {
    if (routing.isDefault) continue;
    for (const signal of routing.signals) {
      if (!signal.pattern.test(taskText)) continue;
      if (routing.skipOnPlanningReport === true && hasPlanningReport) {
        // Match is suppressed by the planning-report guard. Fall
        // through to the next package's signals — preserves the
        // pre-catalog router's break-then-fall-through behavior.
        break;
      }
      return {
        flowName: pkg.id,
        source: 'classifier',
        matched_signal: signal.label,
        reason: routing.reasonForMatch(signal),
      };
    }
  }
  return {
    flowName: defaultPackage.pkg.id,
    source: 'classifier',
    reason:
      defaultPackage.routing.defaultReason ??
      `no signal matched; routed to ${defaultPackage.pkg.id} as the conservative default`,
  };
}

export function classifyCompiledFlowTask(taskText: string): CompiledFlowRouteDecision {
  return classifyTaskAgainstRoutables(taskText, ROUTABLE_PACKAGES, DEFAULT_PACKAGE);
}

// Test seam: build the routable + default pair from a synthetic
// package set so behavioral tests can exercise the classifier
// independent of the live catalog.
export function deriveRoutingForTesting(packages: readonly CompiledFlowPackage[]): {
  readonly routables: readonly RoutablePackage[];
  readonly defaultPackage: RoutablePackage;
} {
  const routables = buildRoutablePackages(packages);
  const defaultPackage = findDefaultRoutablePackage(routables);
  return { routables, defaultPackage };
}
