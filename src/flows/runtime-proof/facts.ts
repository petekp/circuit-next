import { defineDeclarativeFlowFacts } from '../declarative-flow-facts.js';
import type { FlowFact } from '../flow-definition.js';

export const runtimeProofFacts = defineDeclarativeFlowFacts({
  id: 'runtime-proof',
  title: 'Runtime Proof Schematic',
  purpose:
    'Runtime Proof flow: exercise one compose step and one relay step end-to-end so the runtime boundary can be observed closing a real run.',
  status: 'active',
  version: '0.1.0',
  visibility: 'internal',
  startsAt: 'compose-step',
  stagePathPolicy: {
    mode: 'partial',
    omits: ['frame', 'analyze', 'verify', 'review', 'close'],
    rationale:
      'Runtime Proof is a narrow proof flow; only plan and act are needed to exercise compose and relay through the runtime boundary.',
  },
  canonicalStagePolicy: {
    enforcement: 'exempt',
    reason: 'partial-stage path, recorded',
  },
  paths: {
    schematic: 'src/flows/runtime-proof/schematic.json',
  },
  entry: {
    include: ['runtime-proof', 'alpha-proof'],
    exclude: [],
    intentPrefixes: ['runtime-proof'],
  },
  modes: [
    {
      name: 'runtime-proof',
      depth: 'standard',
      description: 'Default runtime-proof entry mode; seeds the run at the compose step.',
    },
  ],
  initialContracts: ['flow.brief@v1'],
  stages: [
    {
      stageId: 'plan-stage',
      canonical: 'plan',
      title: 'Plan',
    },
    {
      stageId: 'act-stage',
      canonical: 'act',
      title: 'Act',
    },
  ],
  steps: [
    {
      id: 'compose-step',
      title: 'Compose runtime proof report',
      stage: 'plan',
      block: 'plan',
      input: {
        brief: 'flow.brief@v1',
      },
      output: 'plan.strategy@v1',
      evidenceRequirements: ['ordered steps', 'risk notes', 'proof strategy'],
      execution: {
        kind: 'compose',
      },
      protocol: 'runtime-proof-compose@v1',
      writes: {
        report_path: 'reports/compose.json',
      },
      check: {
        required: ['summary'],
      },
      routes: {
        continue: 'relay-step',
      },
    },
    {
      id: 'relay-step',
      title: 'Relay dry-run connector',
      stage: 'act',
      block: 'act',
      input: {
        brief: 'flow.brief@v1',
        plan: 'plan.strategy@v1',
      },
      output: 'change.evidence@v1',
      evidenceRequirements: ['changed files', 'change rationale', 'declared follow-up proof'],
      execution: {
        kind: 'relay',
        role: 'implementer',
      },
      protocol: 'runtime-proof-relay@v1',
      writes: {
        request_path: 'reports/relay.request.json',
        receipt_path: 'reports/relay.receipt.json',
        result_path: 'reports/relay.result.json',
      },
      check: {
        pass: ['ok'],
      },
      routes: {
        continue: '@complete',
      },
    },
  ],
  reports: [
    {
      schemaName: 'runtime-proof.compose@v1',
      channel: 'report',
    },
  ],
  writerBindings: {
    compose: ['plan.strategy@v1'],
  },
}) satisfies readonly FlowFact[];
