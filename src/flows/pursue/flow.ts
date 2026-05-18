import { defineFlowFromFacts } from '../flow-definition.js';
import type { CompiledFlowSignal } from '../types.js';
import { pursueFacts } from './facts.js';
import { pursuitBatchShapeHint, pursuitReviewShapeHint } from './relay-hints.js';
import {
  PursuitBatch,
  PursuitContract,
  PursuitGraph,
  PursuitResult,
  PursuitReview,
  PursuitVerification,
  PursuitWavePlan,
} from './reports.js';
import { pursuitCloseBuilder } from './writers/close.js';
import { pursuitContractComposeBuilder } from './writers/contract.js';
import { pursuitGraphComposeBuilder } from './writers/graph.js';
import { pursuitVerificationWriter } from './writers/verification.js';
import { pursuitWavePlanComposeBuilder } from './writers/wave-plan.js';

const PURSUE_SIGNALS: readonly CompiledFlowSignal[] = [
  { label: 'pursue prefix', pattern: /^\s*pursue\s*:/i },
  {
    label: 'pursuit request',
    pattern:
      /^\s*(?:please\s+)?(?:pursue|coordinate|handle)\b.*\b(?:pursuit|pursuits|ideas|goals|tracks)\b/i,
  },
  {
    label: 'multiple autonomous goals',
    pattern:
      /^\s*(?:please\s+)?(?:run|execute|coordinate)\b.*\b(?:multiple|several|parallel)\b.*\b(?:goals|ideas|changes|tracks)\b/i,
  },
];

export const pursueFlowDefinition = defineFlowFromFacts({
  facts: pursueFacts,
  routing: {
    order: 25,
    signals: PURSUE_SIGNALS,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to Pursue flow`;
    },
  },
  reportDeclarations: [
    {
      schemaName: 'pursuit.batch@v1',
      channel: 'relay',
      schema: PursuitBatch,
      relayHint: pursuitBatchShapeHint.instruction,
    },
    {
      schemaName: 'pursuit.review@v1',
      channel: 'relay',
      schema: PursuitReview,
      relayHint: pursuitReviewShapeHint.instruction,
    },
    {
      schemaName: 'pursuit.contract@v1',
      channel: 'report',
      schema: PursuitContract,
      writers: { compose: [pursuitContractComposeBuilder] },
    },
    {
      schemaName: 'pursuit.graph@v1',
      channel: 'report',
      schema: PursuitGraph,
      writers: { compose: [pursuitGraphComposeBuilder] },
    },
    {
      schemaName: 'pursuit.wave-plan@v1',
      channel: 'report',
      schema: PursuitWavePlan,
      writers: { compose: [pursuitWavePlanComposeBuilder] },
    },
    {
      schemaName: 'pursuit.verification@v1',
      channel: 'report',
      schema: PursuitVerification,
      writers: { verification: [pursuitVerificationWriter] },
    },
    {
      schemaName: 'pursuit.result@v1',
      channel: 'report',
      schema: PursuitResult,
      writers: { close: [pursuitCloseBuilder] },
    },
  ],
});
