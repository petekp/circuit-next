// Workflow router — derives routing from src/workflows/catalog.ts.
//
// Each WorkflowPackage may declare routing metadata (signals, order,
// optional skipOnPlanningArtifact guard, default-fallback flag). The
// router walks packages in `order` ascending; positive signal matches
// route directly to that package. When `skipOnPlanningArtifact` is set
// AND the request mentions a planning artifact, the match is treated
// as a non-match and routing falls through to subsequent packages.
// The package marked `isDefault` is selected when nothing matches.

import { workflowPackages } from '../workflows/catalog.js';
import type { WorkflowPackage, WorkflowRoutingMetadata } from '../workflows/types.js';

interface RoutablePackage {
  readonly pkg: WorkflowPackage;
  readonly routing: WorkflowRoutingMetadata;
}

const ROUTABLE_PACKAGES: readonly RoutablePackage[] = (() => {
  const out: RoutablePackage[] = [];
  for (const pkg of workflowPackages) {
    if (pkg.routing === undefined) continue;
    out.push({ pkg, routing: pkg.routing });
  }
  return out.sort((a, b) => a.routing.order - b.routing.order);
})();

export const ROUTABLE_WORKFLOWS: readonly string[] = Object.freeze(
  ROUTABLE_PACKAGES.map((entry) => entry.pkg.id),
);

interface WorkflowRouteDecision {
  workflowName: string;
  source: 'classifier';
  reason: string;
  matched_signal?: string;
}

const PLANNING_ARTIFACT_SIGNAL =
  /\b(?:proposal|plan|brief|matrix|evaluation\s+matrix|design\s+doc|design\s+document|spec|specification|rfc|memo|document|doc|guide|analysis|evaluation|selection|strategy|outline|report|comparison|recommendation|write-?up|options|approaches)\b/i;

const DEFAULT_PACKAGE: RoutablePackage = (() => {
  const defaults = ROUTABLE_PACKAGES.filter((entry) => entry.routing.isDefault === true);
  const [first, ...rest] = defaults;
  if (first === undefined) {
    throw new Error('no workflow package marked isDefault — router has no fallback');
  }
  if (rest.length > 0) {
    throw new Error(
      `more than one default workflow package: ${defaults.map((entry) => entry.pkg.id).join(', ')}`,
    );
  }
  return first;
})();

export function classifyWorkflowTask(taskText: string): WorkflowRouteDecision {
  const hasPlanningArtifact = PLANNING_ARTIFACT_SIGNAL.test(taskText);
  for (const { pkg, routing } of ROUTABLE_PACKAGES) {
    if (routing.isDefault) continue;
    for (const signal of routing.signals) {
      if (!signal.pattern.test(taskText)) continue;
      if (routing.skipOnPlanningArtifact === true && hasPlanningArtifact) {
        // Match is suppressed by the planning-artifact guard. Fall
        // through to the next package's signals — preserves the
        // pre-catalog router's break-then-fall-through behavior.
        break;
      }
      return {
        workflowName: pkg.id,
        source: 'classifier',
        matched_signal: signal.label,
        reason: routing.reasonForMatch(signal),
      };
    }
  }
  return {
    workflowName: DEFAULT_PACKAGE.pkg.id,
    source: 'classifier',
    reason:
      DEFAULT_PACKAGE.routing.defaultReason ??
      `no signal matched; routed to ${DEFAULT_PACKAGE.pkg.id} as the conservative default`,
  };
}
