import type { StepOutcome } from '../domain/step.js';

export type StepExecutionResult =
  | {
      readonly kind: 'outcome';
      readonly outcome: StepOutcome;
    }
  | {
      readonly kind: 'failed';
      readonly reason: string;
      readonly error: Error;
    };

function errorFromUnknown(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function stepExecutionOutcome(outcome: StepOutcome): StepExecutionResult {
  return { kind: 'outcome', outcome };
}

export function stepExecutionFailed(reason: string, error?: Error): StepExecutionResult {
  return { kind: 'failed', reason, error: error ?? new Error(reason) };
}

export function stepExecutionFailedFrom(error: unknown): StepExecutionResult {
  const normalized = errorFromUnknown(error);
  return stepExecutionFailed(normalized.message, normalized);
}

export function unwrapStepExecutionResult(result: StepExecutionResult): StepOutcome {
  if (result.kind === 'failed') throw result.error;
  return result.outcome;
}
