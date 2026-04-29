import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DesignerEntryMode, DesignerHealth } from '@/lib/designer-model';
import { cn } from '@/lib/utils';

type Props = {
  flows: readonly string[];
  currentFlowId: string | null;
  onPickFlow: (id: string) => void;
  modes: readonly DesignerEntryMode[];
  activeMode: DesignerEntryMode | null;
  onPickMode: (modeName: string) => void;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  health: DesignerHealth | null;
  view: 'recipe' | 'step-types';
  onShowStepTypes: () => void;
  onShowRecipe: () => void;
};

export function TopBar({
  flows,
  currentFlowId,
  onPickFlow,
  modes,
  activeMode,
  onPickMode,
  dirty,
  saving,
  onSave,
  health,
  view,
  onShowStepTypes,
  onShowRecipe,
}: Props) {
  const isStepTypes = view === 'step-types';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold tracking-tight">Circuit Designer</h1>
        <Select
          value={currentFlowId ?? undefined}
          onValueChange={(id) => {
            if (id !== null) onPickFlow(id);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Pick a circuit…" />
          </SelectTrigger>
          <SelectContent>
            {flows.map((flow) => (
              <SelectItem key={flow} value={flow}>
                {flow}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {modes.length > 1 && activeMode && !isStepTypes && (
          <ModeSegmented modes={modes} activeMode={activeMode} onPick={onPickMode} />
        )}
      </div>
      <div className="flex items-center gap-3">
        {health && !isStepTypes && <HealthPill health={health} />}
        {isStepTypes ? (
          <Button type="button" size="sm" variant="ghost" onClick={onShowRecipe}>
            ← Back to circuit
          </Button>
        ) : (
          <Button type="button" size="sm" variant="ghost" onClick={onShowStepTypes}>
            Step types
          </Button>
        )}
        <Button onClick={onSave} disabled={!dirty || saving || isStepTypes} size="sm">
          {saving ? 'Saving…' : dirty ? 'Save changes' : 'All saved'}
        </Button>
      </div>
    </div>
  );
}

function ModeSegmented({
  modes,
  activeMode,
  onPick,
}: {
  modes: readonly DesignerEntryMode[];
  activeMode: DesignerEntryMode;
  onPick: (modeName: string) => void;
}) {
  return (
    <div className="border-border bg-muted/40 inline-flex h-8 items-center rounded-md border p-0.5">
      {modes.map((mode) => {
        const active = mode.name === activeMode.name;
        return (
          <button
            key={mode.name}
            type="button"
            onClick={() => onPick(mode.name)}
            className={cn(
              'px-2.5 py-1 text-xs font-medium capitalize rounded-[4px] transition-colors',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-foreground/65 hover:text-foreground',
            )}
            title={mode.description}
          >
            {mode.name}
          </button>
        );
      })}
    </div>
  );
}

function HealthPill({ health }: { health: DesignerHealth }) {
  const tone =
    health.status === 'ok'
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : health.status === 'warn'
        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : 'bg-destructive/10 text-destructive';
  return (
    <div
      className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', tone)}
      title={health.detail}
    >
      {health.label}
    </div>
  );
}
