// Build flow package.

import type { CompiledFlowPackage, CompiledFlowSignal } from '../types.js';
import { buildImplementationShapeHint, buildReviewShapeHint } from './relay-hints.js';
import { BuildImplementation, BuildReview } from './reports.js';
import { buildBriefCheckpointBuilder } from './writers/checkpoint-brief.js';
import { buildCloseBuilder } from './writers/close.js';
import { buildPlanComposeBuilder } from './writers/plan.js';
import { buildVerificationWriter } from './writers/verification.js';

const BUILD_SIGNALS: readonly CompiledFlowSignal[] = [
  { label: 'develop prefix', pattern: /^\s*develop\s*:/i },
  {
    label: 'build implementation request',
    pattern:
      /^\s*(?:please\s+)?(?:build|implement|develop|add|create|ship)\s+(?:a\s+|an\s+|the\s+|this\s+|that\s+)?(?:new\s+|missing\s+)?(?:feature|change|fix|implementation|endpoint|component|command|tool|integration|helper|export|function|method|behavior)\b/i,
  },
  {
    label: 'missing implementation request',
    pattern:
      /^\s*(?:please\s+)?(?:add|implement|create|ship)\s+(?:the\s+)?missing\s+(?:[\w.-]+\s+)?(?:helper|export|function|method|component|command|endpoint|behavior)\b/i,
  },
  {
    label: 'test-passing implementation request',
    pattern:
      /^\s*(?:please\s+)?(?:add|implement|create|ship|make)\b.*\b(?:helper|export|function|method|component|command|endpoint|behavior)\b.*\b(?:test|tests|check|build|verification)\b.*\b(?:pass|passes|green)\b/i,
  },
  {
    label: 'make change request',
    pattern: /^\s*(?:please\s+)?make\s+(?:a\s+|the\s+|this\s+|that\s+)?(?:focused\s+)?change\b/i,
  },
];

export const buildCompiledFlowPackage: CompiledFlowPackage = {
  id: 'build',
  visibility: 'public',
  paths: {
    schematic: 'src/flows/build/schematic.json',
    command: 'src/flows/build/command.md',
    contract: 'src/flows/build/contract.md',
  },
  routing: {
    order: 30,
    signals: BUILD_SIGNALS,
    skipOnPlanningReport: true,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to implementation Build flow`;
    },
  },
  relayReports: [
    {
      schemaName: 'build.implementation@v1',
      schema: BuildImplementation,
      relayHint: buildImplementationShapeHint.instruction,
    },
    {
      schemaName: 'build.review@v1',
      schema: BuildReview,
      relayHint: buildReviewShapeHint.instruction,
    },
  ],
  writers: {
    compose: [buildPlanComposeBuilder],
    close: [buildCloseBuilder],
    verification: [buildVerificationWriter],
    checkpoint: [buildBriefCheckpointBuilder],
  },
  engineFlags: {
    bindsExecutionDepthToRelaySelection: true,
  },
};
