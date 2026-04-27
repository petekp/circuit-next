// Fix workflow package.

import { fixCloseBuilder } from '../../runtime/close-writers/fix.js';
import { fixBriefSynthesisBuilder } from '../../runtime/synthesis-writers/fix-brief.js';
import { fixVerificationWriter } from '../../runtime/verification-writers/fix-verification.js';
import { FixChange, FixContext, FixDiagnosis, FixReview } from '../../schemas/artifacts/fix.js';
import type { WorkflowPackage, WorkflowSignal } from '../types.js';

const FIX_SIGNALS: readonly WorkflowSignal[] = [
  { label: 'fix prefix', pattern: /^\s*fix\s*:/i },
  {
    label: 'fix request',
    pattern:
      /^\s*(?:please\s+)?(?:fix|patch|debug|diagnose|reproduce)\s+(?:a\s+|an\s+|the\s+|this\s+|that\s+|my\s+|some\s+)?\S+/i,
  },
];

export const fixWorkflowPackage: WorkflowPackage = {
  id: 'fix',
  paths: {
    recipe: 'specs/workflow-recipes/fix.recipe.json',
    command: 'commands/fix.md',
    contract: 'specs/contracts/fix.md',
  },
  routing: {
    order: 20,
    signals: FIX_SIGNALS,
    skipOnPlanningArtifact: true,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to Fix workflow`;
    },
  },
  // Fix dispatch workers currently rely on the generic shape
  // instruction (no per-schema dispatchHint). Preserved here so
  // refactoring this is an explicit decision later.
  dispatchArtifacts: [
    { schemaName: 'fix.context@v1', schema: FixContext },
    { schemaName: 'fix.diagnosis@v1', schema: FixDiagnosis },
    { schemaName: 'fix.change@v1', schema: FixChange },
    { schemaName: 'fix.review@v1', schema: FixReview },
  ],
  writers: {
    synthesis: [fixBriefSynthesisBuilder],
    close: [fixCloseBuilder],
    verification: [fixVerificationWriter],
    checkpoint: [],
  },
};
