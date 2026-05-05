import { type FanoutBranch, FanoutBranch as FanoutBranchSchema } from '../../schemas/step.js';
import type { FanoutStepV2 } from '../manifest/executable-flow.js';
import type { RunFileStore } from '../run-files/run-file-store.js';
import type { ResolvedBranchV2 } from './types.js';

function resolveDottedPath(root: unknown, path: string): unknown {
  let cursor: unknown = root;
  for (const segment of path.split('.')) {
    if (cursor === null || typeof cursor !== 'object' || Array.isArray(cursor)) {
      throw new Error(`items_path '${path}' descended into a non-object at segment '${segment}'`);
    }
    cursor = (cursor as Record<string, unknown>)[segment];
    if (cursor === undefined) {
      throw new Error(`items_path '${path}' is missing at segment '${segment}'`);
    }
  }
  return cursor;
}

function substituteItemPlaceholders(template: string, item: unknown): string {
  if (template === '$item') return typeof item === 'string' ? item : JSON.stringify(item);
  const exactMatch = /^\$item\.([a-z_][a-z0-9_]*)$/i.exec(template);
  if (exactMatch !== null) {
    const key = exactMatch[1] as string;
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`'$item.${key}' substitution requires an object item`);
    }
    const value = (item as Record<string, unknown>)[key];
    if (value === undefined) {
      throw new Error(`'$item.${key}' substitution is missing the '${key}' field on the item`);
    }
    return typeof value === 'string' ? value : String(value);
  }
  return template.replace(/\$item\.([a-z_][a-z0-9_]*)/gi, (_match, key: string) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`'$item.${key}' substitution requires an object item`);
    }
    const value = (item as Record<string, unknown>)[key];
    if (value === undefined) {
      throw new Error(`'$item.${key}' substitution is missing the '${key}' field on the item`);
    }
    return typeof value === 'string' ? value : String(value);
  });
}

function expandTemplate<T>(template: T, item: unknown): T {
  if (typeof template === 'string') {
    return substituteItemPlaceholders(template, item) as unknown as T;
  }
  if (template === null || typeof template !== 'object') return template;
  if (Array.isArray(template)) {
    return template.map((entry) => expandTemplate(entry, item)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(template as Record<string, unknown>)) {
    out[key] = expandTemplate(value, item);
  }
  return out as T;
}

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
