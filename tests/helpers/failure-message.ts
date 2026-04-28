// Failure-message helpers that name the violated invariant in the
// assertion message itself. Designed to make agent (and human) repair
// faster — when a test fails, the message states which rule was
// violated and what that rule says, not just which value mismatched.
//
// Convention for the `rule` argument:
//   - When a contract invariant ID exists in `specs/invariants.json`,
//     pass `"<INVARIANT-ID>: <claim>"`.
//     Example: `"WF-I10: pass routes must target canonical outcome ids"`.
//   - When the rule is a runtime / handler discipline that has no
//     ledger entry, pass plain prose with a domain-prefixed claim.
//     Example: `"dispatch handler: result_body that is not valid JSON
//     aborts with a parse-failure reason"`.
//
// FU-T07. Imported lazily by tests as files are touched. The
// step-handler assertion helpers double as `asserts result is ...`
// type narrows so callers can read `.reason` / `.checkpoint` without a
// manual `if (result.kind !== ...) throw` preamble.

import { expect } from 'vitest';
import type { ZodType } from 'zod';

import type { StepHandlerResult } from '../../src/runtime/step-handlers/types.js';

export function invariantMessage(rule: string, detail?: string): string {
  return detail === undefined ? rule : `${rule} — ${detail}`;
}

export function expectSchemaRejects(schema: ZodType, input: unknown, rule: string): void {
  const result = schema.safeParse(input);
  expect(result.success, invariantMessage(rule, 'expected schema parse to fail')).toBe(false);
}

export function expectSchemaAccepts<T>(schema: ZodType<T>, input: unknown, rule: string): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ');
    expect.fail(invariantMessage(rule, `expected schema parse to succeed; zod issues: ${issues}`));
  }
  return result.data;
}

export function expectStepAborted(
  result: StepHandlerResult,
  rule: string,
  options?: { readonly reason?: RegExp | string },
): asserts result is Extract<StepHandlerResult, { kind: 'aborted' }> {
  if (result.kind !== 'aborted') {
    throw new Error(
      invariantMessage(rule, `expected step-handler result kind=aborted, got '${result.kind}'`),
    );
  }
  if (options?.reason !== undefined) {
    expect(
      result.reason,
      invariantMessage(rule, 'aborted reason did not match expected pattern'),
    ).toMatch(options.reason);
  }
}

export function expectStepAdvance(
  result: StepHandlerResult,
  rule: string,
): asserts result is Extract<StepHandlerResult, { kind: 'advance' }> {
  if (result.kind !== 'advance') {
    throw new Error(
      invariantMessage(rule, `expected step-handler result kind=advance, got '${result.kind}'`),
    );
  }
}

export function expectStepWaitingCheckpoint(
  result: StepHandlerResult,
  rule: string,
): asserts result is Extract<StepHandlerResult, { kind: 'waiting_checkpoint' }> {
  if (result.kind !== 'waiting_checkpoint') {
    throw new Error(
      invariantMessage(
        rule,
        `expected step-handler result kind=waiting_checkpoint, got '${result.kind}'`,
      ),
    );
  }
}
