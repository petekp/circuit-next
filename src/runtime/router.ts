export const ROUTABLE_WORKFLOWS = ['explore', 'review'] as const;

export type RoutableWorkflow = (typeof ROUTABLE_WORKFLOWS)[number];

export interface WorkflowRouteDecision {
  workflowName: RoutableWorkflow;
  source: 'classifier';
  reason: string;
  matched_signal?: string;
}

const REVIEW_SIGNALS: Array<{ label: string; pattern: RegExp }> = [
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
    label: 'risk-hunt request',
    pattern: /\blook\s+for\s+(?:bugs|issues|regressions|risks)\b/i,
  },
];

export function classifyWorkflowTask(taskText: string): WorkflowRouteDecision {
  for (const signal of REVIEW_SIGNALS) {
    if (signal.pattern.test(taskText)) {
      return {
        workflowName: 'review',
        source: 'classifier',
        matched_signal: signal.label,
        reason: `matched ${signal.label}; routed to audit-only review workflow`,
      };
    }
  }

  return {
    workflowName: 'explore',
    source: 'classifier',
    reason: 'no review/audit signal matched; routed to explore as the conservative default',
  };
}
