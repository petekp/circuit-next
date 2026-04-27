// Review workflow package.
//
// Source files (recipe, command, contract) currently live at the
// pre-reorg paths; they will move into this directory in Phase 2.
// Writers also still live in src/runtime/*-writers/ — they will move
// alongside in Phase 2. The catalog refactor decouples the engine from
// these locations so the moves are mechanical.

import { reviewDispatchShapeHint } from '../../runtime/shape-hints/review.js';
import { reviewIntakeSynthesisBuilder } from '../../runtime/synthesis-writers/review-intake.js';
import { reviewResultSynthesisBuilder } from '../../runtime/synthesis-writers/review-result.js';
import type { WorkflowPackage, WorkflowSignal } from '../types.js';

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
    recipe: 'specs/workflow-recipes/review.recipe.json',
    command: 'commands/review.md',
    contract: 'specs/contracts/review.md',
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
