import { z } from 'zod';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };

export const JsonPrimitive = z.union([
  z.string(),
  z.number().refine((n) => Number.isFinite(n), {
    message: 'JSON numbers must be finite',
  }),
  z.boolean(),
  z.null(),
]);

export const JsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([JsonPrimitive, z.array(JsonValue), JsonObject]),
);

export const JsonObject: z.ZodType<JsonObject> = z.record(z.string(), JsonValue);
