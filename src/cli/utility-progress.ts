import { randomUUID } from 'node:crypto';
import type { WriteStream } from 'node:tty';
import type { CompiledFlowId, RunId } from '../schemas/ids.js';
import { ProgressEvent } from '../schemas/progress-event.js';

export interface UtilityProgress {
  readonly runId: RunId;
  readonly flowId: CompiledFlowId;
  readonly emit: (event: Record<string, unknown>) => void;
}

export function utilityProgress(input: {
  readonly enabled: boolean;
  readonly flowId: string;
  readonly now: () => Date;
  readonly stream?: NodeJS.WriteStream | WriteStream;
}): UtilityProgress | undefined {
  if (!input.enabled) return undefined;
  const runId = randomUUID() as RunId;
  const flowId = input.flowId as CompiledFlowId;
  const stream = input.stream ?? process.stderr;
  return {
    runId,
    flowId,
    emit(event) {
      const parsed = ProgressEvent.parse({
        schema_version: 1,
        run_id: runId,
        flow_id: flowId,
        ...event,
      });
      stream.write(`${JSON.stringify(parsed)}\n`);
    },
  };
}
