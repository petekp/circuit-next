import type { ProgressDisplay, ProgressEvent } from '../schemas/progress-event.js';
import type { ProgressReporter } from './relay-runtime-types.js';

const MAX_PROGRESS_DISPLAY_TEXT_CHARS = 240;

export function reportProgress(progress: ProgressReporter | undefined, event: ProgressEvent): void {
  if (progress === undefined) return;
  try {
    progress(event);
  } catch {
    // Progress is a host-facing side channel. A broken renderer must not
    // corrupt the run or change terminal behavior.
  }
}

export function progressDisplay(
  text: string,
  importance: ProgressDisplay['importance'],
  tone: ProgressDisplay['tone'],
): ProgressDisplay {
  if (text.length <= MAX_PROGRESS_DISPLAY_TEXT_CHARS) return { text, importance, tone };
  return {
    text: `${text.slice(0, MAX_PROGRESS_DISPLAY_TEXT_CHARS - 14)} [truncated]`,
    importance,
    tone,
  };
}
