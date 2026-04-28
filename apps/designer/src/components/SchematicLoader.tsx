import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Props = {
  flows: readonly string[];
  currentFlowId: string | null;
  dirty: boolean;
  saving: boolean;
  onPick: (id: string) => void;
  onSave: () => void;
};

export function SchematicLoader({
  flows,
  currentFlowId,
  dirty,
  saving,
  onPick,
  onSave,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <div className="flex items-baseline gap-3">
        <h1 className="text-sm font-semibold tracking-tight">Circuit Schematic Designer</h1>
        <span className="text-muted-foreground text-xs">design flows visually</span>
      </div>
      <div className="flex items-center gap-3">
        <Select value={currentFlowId ?? undefined} onValueChange={onPick}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Pick a flow…" />
          </SelectTrigger>
          <SelectContent>
            {flows.map((flow) => (
              <SelectItem key={flow} value={flow}>
                {flow}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={onSave} disabled={!dirty || saving} size="sm">
          {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
        </Button>
      </div>
    </div>
  );
}
