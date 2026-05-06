export function resolveDottedPath(root: unknown, path: string): unknown {
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

export function substituteItemPlaceholders(template: string, item: unknown): string {
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

export function expandTemplate<T>(template: T, item: unknown): T {
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
