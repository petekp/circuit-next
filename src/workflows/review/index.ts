// Review workflow package.

import type { WorkflowPackage, WorkflowSignal } from '../types.js';
import { reviewDispatchShapeHint } from './dispatch-hints.js';
import { reviewIntakeSynthesisBuilder } from './writers/intake.js';
import { reviewResultSynthesisBuilder } from './writers/result.js';

const REVIEW_SIGNALS: readonly WorkflowSignal[] = [
  { label: 'code review', pattern: /\bcode\s+review\b/i },
  {
    label: 'change review request',
    pattern:
      /\breview\s+(?:this\s+|the\s+|my\s+|a\s+)?(?:change|diff|patch|commit|pr|pull\s+request|code|artifact|file)\b/i,
  },
  { label: 'audit request', pattern: /\baudit\b/i },
  { label: 'critique request', pattern: /\bcritique\b/i },
  {
    label: 'change inspection request',
    pattern:
      /\binspect\s+(?:this\s+|the\s+|my\s+|a\s+)?(?:change|diff|patch|commit|pr|pull\s+request|code|artifact|file)\b/i,
  },
  {
    label: 'change-check request',
    pattern: /\bcheck\s+(?:this\s+)?(?:change|diff|patch|commit|pr|pull\s+request)\b/i,
  },
  {
    label: 'issue-finding request',
    pattern:
      /\b(?:find|surface|identify|spot|detect|look\s+for)\s+(?:an?\s+|any\s+)?(?:(?:issue|issues)(?!\s*(?:#|\d))|bug|bugs|defect|defects|problem|problems|regression|regressions|risk|risks)\b/i,
  },
  {
    label: 'risk-hunt request',
    pattern: /\blook\s+for\s+(?:bugs|issues|regressions|risks)\b/i,
  },
];

export const reviewWorkflowPackage: WorkflowPackage = {
  id: 'review',
  paths: {
    schematic: 'src/workflows/review/schematic.json',
    command: 'src/workflows/review/command.md',
    contract: 'src/workflows/review/contract.md',
  },
  routing: {
    order: 0,
    signals: REVIEW_SIGNALS,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to audit-only review workflow`;
    },
  },
  dispatchArtifacts: [],
  writers: {
    synthesis: [reviewIntakeSynthesisBuilder, reviewResultSynthesisBuilder],
    close: [],
    verification: [],
    checkpoint: [],
  },
  structuralHints: [reviewDispatchShapeHint],
};
