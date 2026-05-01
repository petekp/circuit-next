// Fix flow package.

import type { CompiledFlowPackage, CompiledFlowSignal } from '../types.js';
import { FixChange, FixContext, FixDiagnosis, FixReview } from './reports.js';
import { fixBriefComposeBuilder } from './writers/brief.js';
import { fixCloseBuilder } from './writers/close.js';
import { fixVerificationWriter } from './writers/verification.js';

const FIX_SIGNALS: readonly CompiledFlowSignal[] = [
  { label: 'fix prefix', pattern: /^\s*fix\s*:/i },
  { label: 'quick fix prefix', pattern: /^\s*(?:quick|small|tiny|simple)\s+fix\s*:/i },
  {
    label: 'fix request',
    pattern:
      /^\s*(?:please\s+)?(?:fix|patch|debug|diagnose|reproduce)\s+(?:a\s+|an\s+|the\s+|this\s+|that\s+|my\s+|some\s+)?\S+/i,
  },
];

export const fixCompiledFlowPackage: CompiledFlowPackage = {
  id: 'fix',
  visibility: 'public',
  paths: {
    schematic: 'src/flows/fix/schematic.json',
    command: 'src/flows/fix/command.md',
    contract: 'src/flows/fix/contract.md',
  },
  routing: {
    order: 20,
    signals: FIX_SIGNALS,
    skipOnPlanningReport: true,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to Fix flow`;
    },
  },
  // Fix relay workers currently rely on the generic shape
  // instruction (no per-schema relayHint). Preserved here so
  // refactoring this is an explicit decision later.
  relayReports: [
    { schemaName: 'fix.context@v1', schema: FixContext },
    { schemaName: 'fix.diagnosis@v1', schema: FixDiagnosis },
    { schemaName: 'fix.change@v1', schema: FixChange },
    { schemaName: 'fix.review@v1', schema: FixReview },
  ],
  writers: {
    compose: [fixBriefComposeBuilder],
    close: [fixCloseBuilder],
    verification: [fixVerificationWriter],
    checkpoint: [],
  },
};
