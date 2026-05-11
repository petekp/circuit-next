// Render a one-line JSON-shape skeleton from a Zod schema.
//
// Used by flow `relay-hints.ts` authors so the shape portion of a relay
// instruction is derived from the report's Zod schema rather than typed
// out by hand. Authors keep the task-specific guidance and the
// mechanical tail (no code fences, JSON.parse, validation) as authored
// prose — only the literal `{ "field": "<placeholder>", ... }` part is
// generated here.
//
// Field-level placeholders default to `<string>`, `<number>`, etc. An
// author can override the placeholder for any leaf field by calling
// `.describe('what the field carries')` on the Zod schema; the renderer
// renders that description as the placeholder text. Object and array
// shapes always recurse, so descriptions only matter on leaves.
//
// Limitations the renderer degrades on intentionally:
//   - ZodUnion (non-discriminated) renders each option separated by ` |
//     `. Authors usually want a more guided prose explanation for
//     unions, so this is a deliberately-bare default.
//   - ZodAny / ZodUnknown render as `<any>` / `<unknown>` placeholders
//     and rely on authored guidance.
//   - `.superRefine`-only invariants (e.g. "evidence must be non-empty
//     when status is X") are not visible to the renderer; those stay
//     in authored guidance prose.

import type { ZodTypeAny } from 'zod';

interface ZodDef {
  readonly typeName: string;
  readonly description?: string;
  readonly [key: string]: unknown;
}

function defOf(node: ZodTypeAny): ZodDef {
  return (node as unknown as { readonly _def: ZodDef })._def;
}

function leafDescriptionOr(node: ZodTypeAny, fallback: string): string {
  const description = defOf(node).description;
  if (typeof description === 'string' && description.length > 0) {
    return `"<${description}>"`;
  }
  return fallback;
}

export function renderShapeSkeleton(schema: ZodTypeAny): string {
  return renderNode(schema);
}

function renderNode(node: ZodTypeAny): string {
  const def = defOf(node);
  switch (def.typeName) {
    case 'ZodObject': {
      const shapeFn = def.shape as () => Record<string, ZodTypeAny>;
      const shape =
        typeof shapeFn === 'function'
          ? shapeFn()
          : (def.shape as unknown as Record<string, ZodTypeAny>);
      const entries = Object.entries(shape).map(([key, child]) => `"${key}": ${renderNode(child)}`);
      return `{ ${entries.join(', ')} }`;
    }
    case 'ZodArray': {
      const inner = renderNode(def.type as ZodTypeAny);
      return `[${inner}]`;
    }
    case 'ZodOptional':
    case 'ZodNullable':
    case 'ZodDefault':
    case 'ZodReadonly':
    case 'ZodBranded':
    case 'ZodCatch':
      return renderNode(def.innerType as ZodTypeAny);
    case 'ZodEffects':
      return renderNode(def.schema as ZodTypeAny);
    case 'ZodLiteral': {
      const value = def.value;
      return typeof value === 'string' ? `"${value}"` : JSON.stringify(value);
    }
    case 'ZodEnum': {
      const values = def.values as readonly string[];
      return `"<${values.join('|')}>"`;
    }
    case 'ZodNativeEnum': {
      const raw = def.values as Record<string, string | number>;
      const values = Object.values(raw).filter(
        (value): value is string => typeof value === 'string',
      );
      return `"<${values.join('|')}>"`;
    }
    case 'ZodString':
      return leafDescriptionOr(node, '"<string>"');
    case 'ZodNumber':
      return leafDescriptionOr(node, '<number>');
    case 'ZodBigInt':
      return leafDescriptionOr(node, '<bigint>');
    case 'ZodBoolean':
      return leafDescriptionOr(node, '<true|false>');
    case 'ZodDate':
      return leafDescriptionOr(node, '"<iso-date>"');
    case 'ZodNull':
      return 'null';
    case 'ZodUndefined':
      return '<undefined>';
    case 'ZodAny':
      return leafDescriptionOr(node, '<any>');
    case 'ZodUnknown':
      return leafDescriptionOr(node, '<unknown>');
    case 'ZodRecord':
      return `{ "<key>": ${renderNode(def.valueType as ZodTypeAny)} }`;
    case 'ZodMap':
      return `{ "<key>": ${renderNode(def.valueType as ZodTypeAny)} }`;
    case 'ZodTuple': {
      const items = (def.items as ZodTypeAny[]).map(renderNode);
      return `[${items.join(', ')}]`;
    }
    case 'ZodDiscriminatedUnion':
    case 'ZodUnion': {
      const options = def.options as ZodTypeAny[];
      return options.map(renderNode).join(' | ');
    }
    case 'ZodLazy': {
      const getter = def.getter as () => ZodTypeAny;
      return renderNode(getter());
    }
    case 'ZodIntersection': {
      const left = renderNode(def.left as ZodTypeAny);
      const right = renderNode(def.right as ZodTypeAny);
      return `${left} & ${right}`;
    }
    default:
      return `<${def.typeName}>`;
  }
}
