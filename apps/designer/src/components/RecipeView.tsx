import { Badge } from '@/components/ui/badge';
import type { DesignerCircuit, DesignerStep } from '@/lib/designer-model';
import { cn } from '@/lib/utils';
import { ModePreviewBanner } from './ModePreviewBanner';
import { RunnerBadge } from './RunnerBadge';

type Props = {
  circuit: DesignerCircuit;
  selectedStepId: string | null;
  onSelectStep: (id: string) => void;
};

export function RecipeView({ circuit, selectedStepId, onSelectStep }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <header className="mb-6">
        <div className="text-foreground/55 text-xs">Circuit</div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{circuit.title}</h2>
        <p className="text-foreground/80 mt-1.5 text-sm leading-relaxed">{circuit.purpose}</p>
      </header>

      <ModePreviewBanner mode={circuit.activeMode} />

      <div className="space-y-5">
        {circuit.stages.map((stage) => (
          <section
            key={stage.id}
            className="border-border/70 bg-card/40 rounded-xl border px-4 pt-4 pb-3"
          >
            <div className="text-foreground/70 mb-3 text-sm font-medium">{stage.title}</div>
            <ul className="divide-border/60 -mx-2 divide-y">
              {stage.steps.map((step) => (
                <li key={step.id}>
                  <StepRow
                    step={step}
                    selected={step.id === selectedStepId}
                    onSelect={() => onSelectStep(step.id)}
                  />
                </li>
              ))}
              {stage.steps.length === 0 && (
                <li className="text-muted-foreground px-2 py-2 text-xs italic">
                  No steps in this section.
                </li>
              )}
            </ul>
          </section>
        ))}
      </div>

      <footer className="mt-10 border-t border-dashed pt-5">
        <div className="text-muted-foreground text-xs">Coming soon</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <FutureChip label="Add a step that asks you" />
          <FutureChip label="Create a new circuit" />
        </div>
      </footer>
    </div>
  );
}

function StepRow({
  step,
  selected,
  onSelect,
}: {
  step: DesignerStep;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'hover:bg-accent/50 w-full rounded-md px-3 py-3 text-left transition-colors',
        selected && 'bg-accent ring-ring/60 ring-1',
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold leading-tight">{step.title}</h4>
        <RunnerBadge runner={step.runner} />
      </div>
      <p className="text-foreground/75 mt-1.5 text-xs leading-snug">{step.runnerSummary}</p>
      <p className="text-foreground/65 mt-1 text-xs leading-snug">{step.nextStepSummary}</p>
      {step.routeOverrides.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {step.routeOverrides.map((override) => (
            <Badge
              key={`${override.routeName}:${override.modeName}`}
              variant="secondary"
              className="text-[10px] font-normal"
            >
              Different in {override.modeName} mode
            </Badge>
          ))}
        </div>
      )}
      {step.asksOperator && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
          Pauses to ask you
        </div>
      )}
    </button>
  );
}

function FutureChip({ label }: { label: string }) {
  return (
    <span
      className="text-muted-foreground border-border/60 cursor-not-allowed rounded-full border border-dashed px-2.5 py-1 text-xs"
      title="Coming soon — not wired up yet."
    >
      {label}
    </span>
  );
}
