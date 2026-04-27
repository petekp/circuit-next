// Fix workflow package.

import { FixChange, FixContext, FixDiagnosis, FixReview } from '../../schemas/artifacts/fix.js';
import type { WorkflowPackage, WorkflowSignal } from '../types.js';
import { fixBriefSynthesisBuilder } from './writers/brief.js';
import { fixCloseBuilder } from './writers/close.js';
import { fixVerificationWriter } from './writers/verification.js';

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
    recipe: 'src/workflows/fix/recipe.json',
    command: 'src/workflows/fix/command.md',
    contract: 'src/workflows/fix/contract.md',
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
