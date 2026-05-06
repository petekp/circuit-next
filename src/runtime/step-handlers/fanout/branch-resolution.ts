import { readFileSync } from 'node:fs';
import { type FanoutBranch, FanoutBranch as FanoutBranchSchema } from '../../../schemas/step.js';
import { expandTemplate, resolveDottedPath } from '../../../shared/fanout-branch-template.js';
import { resolveRunRelative } from '../../../shared/run-relative-path.js';
import type { FanoutStepNarrow, ResolvedBranch } from './types.js';

function resolveBranch(branch: FanoutBranch): ResolvedBranch {
  if ('flow_ref' in branch) {
    return {
      kind: 'sub-run',
      branch_id: branch.branch_id,
      flow_ref: branch.flow_ref,
      goal: branch.goal,
      depth: branch.depth,
      ...(branch.selection === undefined ? {} : { selection: branch.selection }),
    };
  }
  return {
    kind: 'relay',
    branch_id: branch.branch_id,
    role: branch.execution.role,
    goal: branch.execution.goal,
    report_schema: branch.execution.report_schema,
    ...(branch.execution.provenance_field === undefined
      ? {}
      : { provenance_field: branch.execution.provenance_field }),
    ...(branch.selection === undefined ? {} : { selection: branch.selection }),
  };
}

export function resolveBranches(
  step: FanoutStepNarrow,
  runFolder: string,
): readonly ResolvedBranch[] {
  if (step.branches.kind === 'static') {
    return step.branches.branches.map((b) => resolveBranch(b));
  }
  const sourceAbs = resolveRunRelative(runFolder, step.branches.source_report);
  const sourceRaw: unknown = JSON.parse(readFileSync(sourceAbs, 'utf8'));
  const items = resolveDottedPath(sourceRaw, step.branches.items_path);
  if (!Array.isArray(items)) {
    throw new Error(
      `dynamic fanout: items_path '${step.branches.items_path}' did not resolve to an array (got ${typeof items})`,
    );
  }
  const cap = step.branches.max_branches;
  if (items.length > cap) {
    throw new Error(`dynamic fanout expanded to ${items.length} items but max_branches is ${cap}`);
  }
  const expanded: ResolvedBranch[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const expandedRaw = expandTemplate(step.branches.template, item);
    const branch: FanoutBranch = FanoutBranchSchema.parse(expandedRaw);
    if (seen.has(branch.branch_id)) {
      throw new Error(
        `dynamic fanout produced duplicate branch_id '${branch.branch_id}'; template substitution must yield unique ids`,
      );
    }
    seen.add(branch.branch_id);
    expanded.push(resolveBranch(branch));
  }
  return expanded;
}
