// Review flow package.

import type { CompiledFlowPackage, CompiledFlowSignal } from '../types.js';
import { reviewRelayShapeHint } from './relay-hints.js';
import { reviewIntakeComposeBuilder } from './writers/intake.js';
import { reviewResultComposeBuilder } from './writers/result.js';

const REVIEW_SIGNALS: readonly CompiledFlowSignal[] = [
  { label: 'code review', pattern: /\bcode\s+review\b/i },
  {
    label: 'change review request',
    pattern:
      /\breview\s+(?:this\s+|the\s+|my\s+|a\s+)?(?:change|diff|patch|commit|pr|pull\s+request|code|report|file)\b/i,
  },
  { label: 'audit request', pattern: /\baudit\b/i },
  { label: 'critique request', pattern: /\bcritique\b/i },
  {
    label: 'change inspection request',
    pattern:
      /\binspect\s+(?:this\s+|the\s+|my\s+|a\s+)?(?:change|diff|patch|commit|pr|pull\s+request|code|report|file)\b/i,
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

export const reviewCompiledFlowPackage: CompiledFlowPackage = {
  id: 'review',
  paths: {
    schematic: 'src/flows/review/schematic.json',
    command: 'src/flows/review/command.md',
    contract: 'src/flows/review/contract.md',
  },
  routing: {
    order: 0,
    signals: REVIEW_SIGNALS,
    reasonForMatch(signal) {
      return `matched ${signal.label}; routed to audit-only review flow`;
    },
  },
  relayReports: [],
  writers: {
    compose: [reviewIntakeComposeBuilder, reviewResultComposeBuilder],
    close: [],
    verification: [],
    checkpoint: [],
  },
  structuralHints: [reviewRelayShapeHint],
};
