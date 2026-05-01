import { readFileSync } from 'node:fs';
import { type FanoutBranch, FanoutBranch as FanoutBranchSchema } from '../../../schemas/step.js';
import { resolveRunRelative } from '../../run-relative-path.js';
import type { FanoutStepNarrow, ResolvedBranch } from './types.js';

// Resolve dotted path segments against an unknown root. `path` like
// `batches.items` walks `root.batches.items`. Returns the iterable
// array if found; throws on missing or wrong-typed segment.
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

// Substitute `$item` and `$item.<key>` placeholders in a string against
// a single item value. Returns the substituted string. When the entire
// string IS exactly `$item` or `$item.<key>` and the substitution
// resolves to a non-string, the literal value is converted via String().
// Inline patterns are always stringified.
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

// Recursively walk a template object, substituting `$item.<key>`
// placeholders in any string-typed leaf. Object structure is preserved.
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
