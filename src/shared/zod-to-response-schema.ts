// Convert a Zod report schema into the JSON Schema object that the
// claude-code and codex CLIs accept via their structured-output flags
// (`--json-schema` and `--output-schema` respectively).
//
// Why this lives in shared/: the connector-side wiring needs the
// converted schema, and the runtime-side wiring needs to call this
// before building the relay input. Putting it in shared/ keeps it
// out of the runtime executors and out of the connectors themselves,
// neither of which should depend on Zod or on `zod-to-json-schema`.
//
// Conversion rules are intentionally conservative:
//   - target: JSON Schema draft-07 (the format both CLIs document).
//   - $refStrategy: 'none' — both CLIs accept fully inlined schemas,
//     and inline schemas are easier to debug when a CLI rejection
//     happens.
//   - definitionPath omitted (no $defs / definitions block).
// If a flow's schema can't be expressed in draft-07 without $ref,
// `zod-to-json-schema` will still emit a usable schema; the strictness
// is best-effort, not load-bearing.

import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export type ResponseJsonSchema = Record<string, unknown>;

export function responseJsonSchemaFromZod(schema: ZodTypeAny): ResponseJsonSchema {
  const result = zodToJsonSchema(schema, {
    target: 'jsonSchema7',
    $refStrategy: 'none',
  });
  if (typeof result !== 'object' || result === null) {
    throw new Error('zod-to-json-schema returned a non-object value');
  }
  return result as ResponseJsonSchema;
}
