import type { CompiledFlow } from '../schemas/compiled-flow.js';

const WRITE_CAPABLE_FLOW_IDS = new Set(['build', 'fix', 'migrate', 'sweep']);

export const WRITE_CAPABLE_WORKER_DISCLOSURE =
  'This flow may invoke a write-capable Claude Code worker. Circuit will verify and review the result, but the worker can edit files in this checkout.';

export function flowMayInvokeWriteCapableWorker(flowId: string): boolean {
  return WRITE_CAPABLE_FLOW_IDS.has(flowId);
}

export function compiledFlowMayInvokeWriteCapableWorker(flow: CompiledFlow): boolean {
  return (
    flowMayInvokeWriteCapableWorker(flow.id as unknown as string) ||
    flow.steps.some((step) => step.kind === 'relay' && step.role === 'implementer')
  );
}
