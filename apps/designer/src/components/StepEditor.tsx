import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { FLOW_ROUTES, TERMINAL_TARGETS } from '@/lib/spine';
import type { SchematicStep, ValidationIssue } from '@/lib/types';
import { cn } from '@/lib/utils';

type Props = {
  step: SchematicStep;
  allStepIds: readonly string[];
  errorsForItem: readonly ValidationIssue[];
  onPatch: (patch: Partial<SchematicStep>) => void;
};

export function StepEditor({ step, allStepIds, errorsForItem, onPatch }: Props) {
  const routeEntries = Object.entries(step.routes);

  function setRoute(name: string, target: string) {
    onPatch({ routes: { ...step.routes, [name]: target } });
  }

  function removeRoute(name: string) {
    const next = { ...step.routes };
    delete next[name];
    onPatch({ routes: next });
  }

  function renameRoute(oldName: string, newName: string) {
    if (oldName === newName) return;
    const target = step.routes[oldName];
    if (target === undefined) return;
    const next = { ...step.routes };
    delete next[oldName];
    next[newName] = target;
    onPatch({ routes: next });
  }

  function addRoute() {
    const used = new Set(Object.keys(step.routes));
    const name = FLOW_ROUTES.find((r) => !used.has(r)) ?? 'continue';
    setRoute(name, '@stop');
  }

  return (
    <Card className="m-5 mt-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <span>Step</span>
          <Badge variant="outline" className="font-mono">{step.id}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input
            value={step.title}
            onChange={(e) => onPatch({ title: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <ReadOnly label="Block" value={step.block} mono />
          <ReadOnly label="Stage" value={step.stage} mono />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <ReadOnly label="Output contract" value={step.output} mono />
          <ReadOnly
            label="Execution"
            value={
              step.execution?.role
                ? `${step.execution.kind} · ${step.execution.role}`
                : (step.execution?.kind ?? '—')
            }
            mono
          />
        </div>
        {Array.isArray(step.evidence_requirements) &&
          step.evidence_requirements.length > 0 && (
            <ReadOnly
              label="Evidence requirements"
              value=""
              renderValue={
                <div className="flex flex-wrap gap-1">
                  {step.evidence_requirements.map((req) => (
                    <Badge key={req} variant="secondary" className="text-[10px]">
                      {req}
                    </Badge>
                  ))}
                </div>
              }
            />
          )}
        <Separator />
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Routes</Label>
            <Button type="button" size="sm" variant="outline" onClick={addRoute}>
              Add route
            </Button>
          </div>
          {routeEntries.length === 0 ? (
            <p className="text-muted-foreground text-xs">No routes declared.</p>
          ) : (
            <div className="space-y-2">
              {routeEntries.map(([name, target]) => (
                <div key={name} className="flex items-center gap-2">
                  <Select
                    value={name}
                    onValueChange={(newName) => renameRoute(name, newName)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FLOW_ROUTES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground text-xs">→</span>
                  <Select
                    value={target}
                    onValueChange={(t) => setRoute(name, t)}
                  >
                    <SelectTrigger className="flex-1 font-mono text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allStepIds.map((id) => (
                        <SelectItem key={id} value={id} className="font-mono text-xs">
                          {id}
                        </SelectItem>
                      ))}
                      {TERMINAL_TARGETS.map((t) => (
                        <SelectItem key={t} value={t} className="font-mono text-xs">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeRoute(name)}
                    className="h-7 w-7 p-0"
                    aria-label={`Remove route ${name}`}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        {errorsForItem.length > 0 && (
          <div className="border-destructive/50 bg-destructive/10 rounded-md border p-3">
            <h4 className="text-destructive text-xs font-semibold">
              Issues for this step
            </h4>
            <ul className="text-destructive mt-1.5 space-y-1 text-xs">
              {errorsForItem.map((e, i) => (
                <li key={i}>
                  {e.path && (
                    <span className="mr-1.5 font-mono opacity-70">
                      {e.path.slice(2).join('.')}:
                    </span>
                  )}
                  {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReadOnly({
  label,
  value,
  mono,
  renderValue,
}: {
  label: string;
  value: string;
  mono?: boolean;
  renderValue?: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-muted-foreground text-[10px] uppercase tracking-wider">
        {label}
      </Label>
      {renderValue ?? (
        <div className={cn('text-sm break-all', mono && 'font-mono')}>{value}</div>
      )}
    </div>
  );
}
