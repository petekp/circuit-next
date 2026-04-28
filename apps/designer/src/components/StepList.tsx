import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { groupStepsByStage } from '@/lib/spine';
import type { SchematicStep } from '@/lib/types';
import { cn } from '@/lib/utils';

type Props = {
  steps: readonly SchematicStep[];
  selectedStepId: string | null;
  onSelect: (id: string) => void;
};

export function StepList({ steps, selectedStepId, onSelect }: Props) {
  const groups = groupStepsByStage(steps);
  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-3">
        <h3 className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
          Steps ({steps.length})
        </h3>
        {groups.length === 0 && <p className="text-muted-foreground text-xs">No steps yet.</p>}
        {groups.map(({ stage, steps: stageSteps }) => (
          <div key={stage} className="space-y-1.5">
            <h4 className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
              {stage}
            </h4>
            <ul className="space-y-1">
              {stageSteps.map((step) => (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(step.id)}
                    className={cn(
                      'border-border hover:bg-accent w-full rounded-md border px-2.5 py-1.5 text-left transition-colors',
                      selectedStepId === step.id && 'bg-accent border-ring',
                    )}
                  >
                    <div className="text-xs font-medium leading-tight">{step.title}</div>
                    <div className="text-muted-foreground mt-1 flex items-center gap-1.5">
                      <Badge variant="outline" className="h-4 px-1 font-mono text-[9px]">
                        {step.block}
                      </Badge>
                      <span className="text-[10px]">{step.execution?.kind}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
