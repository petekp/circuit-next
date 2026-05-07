import { RETIRED_RUNTIME_FRESH_INVOCATION_MESSAGE } from '../shared/retired-runtime-policy.js';
export { progressDisplay, reportProgress } from '../shared/progress-output.js';

function retiredRuntimeError(): never {
  throw new Error(RETIRED_RUNTIME_FRESH_INVOCATION_MESSAGE);
}

export function taskStatusesFromTrace(): never {
  return retiredRuntimeError();
}

export function reportTaskListProgress(): never {
  return retiredRuntimeError();
}

export function projectTraceEntryToProgress(): never {
  return retiredRuntimeError();
}
