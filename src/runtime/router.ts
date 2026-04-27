export const ROUTABLE_WORKFLOWS = ['explore', 'review', 'fix', 'build'] as const;

type RoutableWorkflow = (typeof ROUTABLE_WORKFLOWS)[number];

interface WorkflowRouteDecision {
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
    label: 'issue-finding request',
    pattern:
      /\b(?:find|surface|identify|spot|detect|look\s+for)\s+(?:an?\s+|any\s+)?(?:(?:issue|issues)(?!\s*(?:#|\d))|bug|bugs|defect|defects|problem|problems|regression|regressions|risk|risks)\b/i,
  },
  {
    label: 'risk-hunt request',
    pattern: /\blook\s+for\s+(?:bugs|issues|regressions|risks)\b/i,
  },
];

const FIX_SIGNALS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'fix prefix', pattern: /^\s*fix\s*:/i },
  { label: 'repair prefix', pattern: /^\s*repair\s*:/i },
  {
    label: 'fix request',
    pattern:
      /^\s*(?:please\s+)?(?:fix|repair|patch|debug|diagnose|reproduce)\s+(?:a\s+|an\s+|the\s+|this\s+|that\s+|my\s+|some\s+)?\S+/i,
  },
];

const BUILD_SIGNALS: Array<{ label: string; pattern: RegExp }> = [
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

const PLANNING_ARTIFACT_SIGNAL =
  /\b(?:proposal|plan|brief|matrix|evaluation\s+matrix|design\s+doc|design\s+document|spec|specification|rfc|memo|document|doc|guide|analysis|evaluation|selection|strategy|outline|report|comparison|recommendation|write-?up|options|approaches)\b/i;

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

  for (const signal of FIX_SIGNALS) {
    if (signal.pattern.test(taskText)) {
      if (PLANNING_ARTIFACT_SIGNAL.test(taskText)) {
        break;
      }
      return {
        workflowName: 'fix',
        source: 'classifier',
        matched_signal: signal.label,
        reason: `matched ${signal.label}; routed to Fix workflow`,
      };
    }
  }

  for (const signal of BUILD_SIGNALS) {
    if (signal.pattern.test(taskText)) {
      if (PLANNING_ARTIFACT_SIGNAL.test(taskText)) {
        break;
      }
      return {
        workflowName: 'build',
        source: 'classifier',
        matched_signal: signal.label,
        reason: `matched ${signal.label}; routed to implementation Build workflow`,
      };
    }
  }

  return {
    workflowName: 'explore',
    source: 'classifier',
    reason: 'no review/audit signal matched; routed to explore as the conservative default',
  };
}
