import type { ResolvedSelection } from '../schemas/selection-policy.js';

export function selectedModelForProvider(
  connectorName: string,
  selection: ResolvedSelection | undefined,
  expectedProvider: NonNullable<ResolvedSelection['model']>['provider'],
): string | undefined {
  const model = selection?.model;
  if (model === undefined) return undefined;
  if (model.provider !== expectedProvider) {
    throw new Error(
      `${connectorName} connector cannot honor model provider '${model.provider}' for model '${model.model}'; expected provider '${expectedProvider}'`,
    );
  }
  return model.model;
}

// Tolerant JSON-object extraction. Workers occasionally narrate status
// in prose before or after their JSON response despite the shape-hint
// instruction telling them not to ("Type check passes.\n\n{...}",
// "{...}\n\nDone."). Without tolerance the downstream JSON.parse aborts
// the relay on the first non-JSON character.
//
// Algorithm: walk forward from the first `{`, balance-match braces while
// tracking string state, and try JSON.parse on the candidate. If it
// parses, return that substring. If not, advance past the candidate and
// try the next `{`. If no candidate parses (or no `{` exists), return
// the original text unchanged so downstream JSON.parse surfaces the
// real error message.
//
// Idempotent on clean JSON: a string that starts with `{` and is fully
// balanced is returned verbatim after one parse attempt.
export function extractJsonObject(text: string): string {
  let cursor = 0;
  while (cursor < text.length) {
    const start = text.indexOf('{', cursor);
    if (start === -1) break;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (inString) {
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end === -1) break;
    const candidate = text.slice(start, end);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      cursor = start + 1;
    }
  }
  return text;
}
