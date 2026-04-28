// Build workflow package.

import type { WorkflowPackage, WorkflowSignal } from '../types.js';
import { BuildImplementation, BuildReview } from './artifacts.js';
import { buildImplementationShapeHint, buildReviewShapeHint } from './dispatch-hints.js';
import { buildBriefCheckpointBuilder } from './writers/checkpoint-brief.js';
import { buildCloseBuilder } from './writers/close.js';
import { buildPlanSynthesisBuilder } from './writers/plan.js';
import { buildVerificationWriter } from './writers/verification.js';

const BUILD_SIGNALS: readonly WorkflowSignal[] = [
  { label: 'develop prefix', pattern: /^\s*develop\s*:/i },
  {
    label: 'build implementation request',
    pattern:
      /^\s*(?:please\s+)?(?:build|implement|develop|add|create|ship)\s+(?:a\s+|an\s+|the\s+|this\s+|that\s+)?(?:new\s+)?(?:feature|change|fix|implementation|endpoint|component|command|tool|integration)\b/i,
  },
  {
    label: 'make change request',
    pattern: /^\s*(?:please\s+)?make\s+(?:a\s+|the\s+|this\s+|that\s+)?(?:focused\s+)?change\b/i,
  },
];

export const buildWorkflowPackage: WorkflowPackage = {
  id: 'build',
  paths: {
    schematic: 'src/workflows/build/schematic.json',
    command: 'src/workflows/build/command.md',
    contract: 'src/workflows/build/contract.md',
  },
  routing: {
    order: 30,
    signals: BUILD_SIGNALS,
    skipOnPlanningArtifact: true,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to implementation Build workflow`;
    },
  },
  dispatchArtifacts: [
    {
      schemaName: 'build.implementation@v1',
      schema: BuildImplementation,
      dispatchHint: buildImplementationShapeHint.instruction,
    },
    {
      schemaName: 'build.review@v1',
      schema: BuildReview,
      dispatchHint: buildReviewShapeHint.instruction,
    },
  ],
  writers: {
    synthesis: [buildPlanSynthesisBuilder],
    close: [buildCloseBuilder],
    verification: [buildVerificationWriter],
    checkpoint: [buildBriefCheckpointBuilder],
  },
  engineFlags: {
    bindsExecutionRigorToDispatchSelection: true,
  },
};
