import { type FanoutBranch, FanoutBranch as FanoutBranchSchema } from '../../schemas/step.js';
import { expandTemplate, resolveDottedPath } from '../../shared/fanout-branch-template.js';
import type { FanoutStepV2 } from '../manifest/executable-flow.js';
import type { RunFileStore } from '../run-files/run-file-store.js';
import type { ResolvedBranchV2 } from './types.js';

function resolveBranch(branch: FanoutBranch): ResolvedBranchV2 {
  if ('flow_ref' in branch) {
    return {
      kind: 'sub-run',
      branch_id: branch.branch_id,
      flowRef: branch.flow_ref.flow_id,
      entryMode: branch.flow_ref.entry_mode,
      ...(branch.flow_ref.version === undefined ? {} : { version: branch.flow_ref.version }),
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

export async function expandFanoutBranchesV2(
  step: FanoutStepV2,
  files: RunFileStore,
): Promise<readonly ResolvedBranchV2[]> {
  const branches = step.branches as
    | {
        readonly kind: 'static';
        readonly branches: readonly unknown[];
      }
    | {
        readonly kind: 'dynamic';
        readonly source_report: string;
        readonly items_path: string;
        readonly template: unknown;
        readonly max_branches: number;
      };

  if (branches.kind === 'static') {
    return branches.branches.map((branch) => resolveBranch(FanoutBranchSchema.parse(branch)));
  }

  const sourceRaw = await files.readJson(branches.source_report);
  const items = resolveDottedPath(sourceRaw, branches.items_path);
  if (!Array.isArray(items)) {
    throw new Error(
      `dynamic fanout: items_path '${branches.items_path}' did not resolve to an array (got ${typeof items})`,
    );
  }
  if (items.length > branches.max_branches) {
    throw new Error(
      `dynamic fanout expanded to ${items.length} items but max_branches is ${branches.max_branches}`,
    );
  }

  const seen = new Set<string>();
  const resolved: ResolvedBranchV2[] = [];
  for (const item of items) {
    const branch = FanoutBranchSchema.parse(expandTemplate(branches.template, item));
    if (seen.has(branch.branch_id)) {
      throw new Error(`dynamic fanout produced duplicate branch_id '${branch.branch_id}'`);
    }
    seen.add(branch.branch_id);
    resolved.push(resolveBranch(branch));
  }
  return resolved;
}
