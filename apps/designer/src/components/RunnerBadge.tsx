import type { StepRunner } from '@/lib/designer-model';
import { cn } from '@/lib/utils';
import {
  Bot,
  ClipboardCheck,
  Layers,
  type LucideIcon,
  PenLine,
  Search,
  Sparkles,
  User,
} from 'lucide-react';

type RunnerStyle = {
  label: string;
  icon: LucideIcon;
  // Tailwind classes for bg + text. Each role gets a soft tint that
  // reads in light and dark mode without being loud.
  className: string;
};

const RUNNER_STYLES: Record<StepRunner, RunnerStyle> = {
  human: {
    label: 'You',
    icon: User,
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  'ai-researcher': {
    label: 'AI researcher',
    icon: Search,
    className: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  'ai-implementer': {
    label: 'AI writer',
    icon: PenLine,
    className: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
  'ai-reviewer': {
    label: 'AI reviewer',
    icon: ClipboardCheck,
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  circuit: {
    label: 'Circuit',
    icon: Sparkles,
    className: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
  },
  'sub-circuit': {
    label: 'Nested circuit',
    icon: Layers,
    className: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  },
  unknown: {
    label: 'AI',
    icon: Bot,
    className: 'bg-muted text-muted-foreground',
  },
};

export function RunnerBadge({ runner }: { runner: StepRunner }) {
  const style = RUNNER_STYLES[runner];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        style.className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {style.label}
    </span>
  );
}
