import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { DesignerCircuit, DesignerEntryMode, DesignerStep } from '@/lib/designer-model';
import type { SchematicStep } from '@/lib/types';
import { useMemo } from 'react';

type Props = {
  circuit: DesignerCircuit;
  step: DesignerStep;
  rawStep: SchematicStep;
  // Patches the underlying schematic item. The inspector only ever
  // touches safe-edit fields — title, evidence_requirements, selection,
  // routes, route_overrides, checkpoint_policy.
  onPatch: (patch: Partial<SchematicStep>) => void;
  onClose: () => void;
};

const TERMINAL_TARGETS = ['@complete', '@stop', '@handoff', '@escalate'] as const;

const TERMINAL_LABELS: Record<(typeof TERMINAL_TARGETS)[number], string> = {
  '@complete': 'Done',
  '@stop': 'Stop here',
  '@handoff': 'Hand off for help',
  '@escalate': 'Ask for help',
};

export function StepInspector({ circuit, step, rawStep, onPatch, onClose }: Props) {
  const stepTargets = useMemo(
    () => circuit.steps.map((s) => ({ id: s.id, title: s.title })),
    [circuit.steps],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <div className="text-foreground/55 text-xs">Step</div>
          <h3 className="mt-0.5 truncate text-base font-semibold leading-tight">{step.title}</h3>
          <p className="text-foreground/70 mt-1 text-xs">{step.runnerSummary}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close">
          ×
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <Tabs defaultValue="overview" className="px-5 py-4">
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tune">Adjust</TabsTrigger>
            {step.asksOperator && <TabsTrigger value="human">Your input</TabsTrigger>}
            <TabsTrigger value="advanced">Behind the scenes</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4">
            <OverviewTab step={step} rawStep={rawStep} onPatch={onPatch} />
          </TabsContent>
          <TabsContent value="tune" className="mt-4">
            <TuneTab
              step={step}
              rawStep={rawStep}
              stepTargets={stepTargets}
              modes={circuit.entryModes}
              activeMode={circuit.activeMode}
              onPatch={onPatch}
            />
          </TabsContent>
          {step.asksOperator && (
            <TabsContent value="human" className="mt-4">
              <HumanTab step={step} rawStep={rawStep} onPatch={onPatch} />
            </TabsContent>
          )}
          <TabsContent value="advanced" className="mt-4">
            <AdvancedTab step={step} />
          </TabsContent>
        </Tabs>
      </ScrollArea>
    </div>
  );
}

function OverviewTab({
  step,
  rawStep,
  onPatch,
}: {
  step: DesignerStep;
  rawStep: SchematicStep;
  onPatch: (patch: Partial<SchematicStep>) => void;
}) {
  return (
    <div className="space-y-4">
      <FieldRow label="Step title">
        <Input value={rawStep.title} onChange={(event) => onPatch({ title: event.target.value })} />
      </FieldRow>
      <SectionLabel>What this step does</SectionLabel>
      <p className="text-foreground/80 -mt-2 text-sm leading-relaxed">
        {step.blockPurpose ?? 'No description for this step type.'}
      </p>
      <Separator />
      <SectionLabel>Section</SectionLabel>
      <p className="-mt-2 text-sm capitalize">{step.stage}</p>
      <Separator />
      <SectionLabel>What you get back</SectionLabel>
      <EvidenceEditor
        evidence={step.evidence}
        onChange={(next) =>
          onPatch({ evidence_requirements: next as unknown as readonly string[] })
        }
      />
      <Separator />
      <SectionLabel>Preview</SectionLabel>
      <div className="bg-muted/40 -mt-2 rounded-md p-3 text-sm leading-relaxed">
        <div className="text-foreground/60 mb-1 text-xs font-medium">{step.prompt.label}</div>
        <p>{step.prompt.oneLine}</p>
      </div>
    </div>
  );
}

function EvidenceEditor({
  evidence,
  onChange,
}: {
  evidence: readonly string[];
  onChange: (next: string[]) => void;
}) {
  function patch(idx: number, value: string) {
    const next = [...evidence];
    next[idx] = value;
    onChange(next);
  }
  function add() {
    onChange([...evidence, '']);
  }
  function remove(idx: number) {
    onChange(evidence.filter((_, i) => i !== idx));
  }
  return (
    <div className="space-y-2">
      {evidence.map((item, idx) => (
        <div key={`${idx}-${item}`} className="flex items-center gap-2">
          <Input
            value={item}
            placeholder="e.g. summary of the change"
            onChange={(event) => patch(idx, event.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => remove(idx)}
            aria-label={`Remove item ${idx + 1}`}
          >
            ×
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={add}>
        Add an item
      </Button>
    </div>
  );
}

function TuneTab({
  step,
  rawStep,
  stepTargets,
  modes,
  activeMode,
  onPatch,
}: {
  step: DesignerStep;
  rawStep: SchematicStep;
  stepTargets: { id: string; title: string }[];
  modes: readonly DesignerEntryMode[];
  activeMode: DesignerEntryMode;
  onPatch: (patch: Partial<SchematicStep>) => void;
}) {
  const allTargets = useMemo(
    () => [
      ...stepTargets.map((t) => ({ value: t.id, label: t.title, kind: 'step' as const })),
      ...TERMINAL_TARGETS.map((t) => ({
        value: t,
        label: TERMINAL_LABELS[t],
        kind: 'terminal' as const,
      })),
    ],
    [stepTargets],
  );

  function setRoute(name: string, target: string) {
    onPatch({ routes: { ...rawStep.routes, [name]: target } });
  }

  function setOverride(routeName: string, modeDepth: string, target: string | null) {
    const current = ((rawStep as { route_overrides?: Record<string, Record<string, string>> })
      .route_overrides ?? {}) as Record<string, Record<string, string>>;
    const next: Record<string, Record<string, string>> = {};
    for (const [name, perDepth] of Object.entries(current)) {
      next[name] = { ...perDepth };
    }
    if (target === null) {
      if (next[routeName]) {
        delete next[routeName][modeDepth];
        if (Object.keys(next[routeName]).length === 0) {
          delete next[routeName];
        }
      }
    } else {
      next[routeName] = { ...(next[routeName] ?? {}), [modeDepth]: target };
    }
    onPatch({ route_overrides: next as unknown as Record<string, never> });
  }

  return (
    <div className="space-y-5">
      <SectionLabel>AI settings</SectionLabel>
      <p className="text-foreground/80 -mt-2 text-sm">{step.selection.oneLine}</p>
      {step.selection.fields.length > 0 && (
        <ul className="text-foreground/75 -mt-1 space-y-0.5 text-sm">
          {step.selection.fields.map((field) => (
            <li key={field.label}>
              <span className="font-medium">{field.label}: </span>
              {field.value}
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground -mt-1 text-xs italic">
        These settings live in the circuit file. Your project or workspace settings can also chip in
        when the circuit runs.
      </p>

      <Separator />
      <SectionLabel>What happens next</SectionLabel>
      <p className="text-foreground/80 -mt-2 text-sm">
        After this step finishes, what happens next depends on how it went. The outcome names are
        fixed by the step type — you can pick where each one leads.
      </p>
      <div className="space-y-3">
        {step.routes.map((route) => (
          <div key={route.name} className="rounded-md border bg-card p-3">
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{route.name}</div>
                <div className="text-foreground/70 mt-0.5 text-xs">{route.plainEnglish}</div>
              </div>
              {route.overriddenForMode && (
                <Badge variant="secondary" className="text-xs">
                  Different in {activeMode.depth}
                </Badge>
              )}
            </div>
            <div className="mt-2.5">
              <Label className="text-xs">Default next step</Label>
              <Select
                value={route.authoredTarget}
                onValueChange={(value) => {
                  if (value !== null) setRoute(route.name, value);
                }}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allTargets.map((target) => (
                    <SelectItem key={target.value} value={target.value}>
                      {target.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-3 space-y-2">
              <Label className="text-xs">When in a different mode</Label>
              {modes.map((mode) => {
                const overrideTarget =
                  (rawStep as { route_overrides?: Record<string, Record<string, string>> })
                    .route_overrides?.[route.name]?.[mode.depth] ?? null;
                return (
                  <div key={mode.name} className="flex items-center gap-2">
                    <span className="text-foreground/70 w-20 text-xs capitalize">{mode.name}</span>
                    <Select
                      value={overrideTarget ?? '__none__'}
                      onValueChange={(value) => {
                        if (value === null) return;
                        if (value === '__none__') {
                          setOverride(route.name, mode.depth, null);
                        } else {
                          setOverride(route.name, mode.depth, value);
                        }
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— same as default —</SelectItem>
                        {allTargets.map((target) => (
                          <SelectItem key={target.value} value={target.value}>
                            {target.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HumanTab({
  step,
  rawStep,
  onPatch,
}: {
  step: DesignerStep;
  rawStep: SchematicStep;
  onPatch: (patch: Partial<SchematicStep>) => void;
}) {
  const policy = (rawStep as { checkpoint_policy?: Record<string, unknown> }).checkpoint_policy;
  if (!policy) {
    return (
      <p className="text-foreground/75 text-sm">This step doesn't pause to ask you anything.</p>
    );
  }

  function patchPolicy(patch: Record<string, unknown>) {
    onPatch({
      checkpoint_policy: { ...(policy as Record<string, unknown>), ...patch } as never,
    });
  }

  const choices = step.checkpoint?.choices ?? [];

  return (
    <div className="space-y-4">
      <FieldRow label="Question for you">
        <Textarea
          value={typeof policy.prompt === 'string' ? policy.prompt : ''}
          rows={3}
          onChange={(event) => patchPolicy({ prompt: event.target.value })}
        />
      </FieldRow>
      <SectionLabel>Choices you can pick</SectionLabel>
      {choices.length === 0 ? (
        <p className="text-muted-foreground -mt-2 text-sm">No choices set.</p>
      ) : (
        <ul className="-mt-2 space-y-1.5">
          {choices.map((choice) => (
            <li key={choice.id} className="text-sm">
              <span className="font-medium">{choice.label || choice.id}</span>
              {choice.label && choice.label !== choice.id && (
                <span className="text-muted-foreground ml-2 text-xs">({choice.id})</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <Separator />
      <FieldRow label="If you skip the question">
        <Select
          value={
            typeof policy.safe_default_choice === 'string' ? policy.safe_default_choice : '__none__'
          }
          onValueChange={(value) => {
            if (value === null) return;
            patchPolicy({
              safe_default_choice: value === '__none__' ? undefined : value,
            });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— wait for an answer —</SelectItem>
            {choices.map((choice) => (
              <SelectItem key={choice.id} value={choice.id}>
                {choice.label || choice.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>
      <FieldRow label="If running unattended">
        <Select
          value={
            typeof policy.safe_autonomous_choice === 'string'
              ? policy.safe_autonomous_choice
              : '__none__'
          }
          onValueChange={(value) => {
            if (value === null) return;
            patchPolicy({
              safe_autonomous_choice: value === '__none__' ? undefined : value,
            });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— wait for an answer —</SelectItem>
            {choices.map((choice) => (
              <SelectItem key={choice.id} value={choice.id}>
                {choice.label || choice.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>
      <p className="text-muted-foreground text-xs italic">
        Adding or removing choices is coming soon — they're part of the circuit's wiring.
      </p>
    </div>
  );
}

function AdvancedTab({ step }: { step: DesignerStep }) {
  return (
    <div className="space-y-5">
      <p className="text-muted-foreground text-xs italic">
        These are the under-the-hood details. Edit them in the circuit file.
      </p>
      <SectionLabel>AI instructions (full)</SectionLabel>
      <div className="bg-muted/40 -mt-2 rounded-md p-3 text-sm leading-relaxed">
        <div className="text-foreground/60 mb-1 text-xs font-medium">{step.prompt.label}</div>
        {step.prompt.body.map((line) => (
          <p key={line} className="mt-1 first:mt-0">
            {line}
          </p>
        ))}
        {step.prompt.responseShape && (
          <p className="text-foreground/65 mt-2 text-xs italic">{step.prompt.responseShape}</p>
        )}
      </div>

      {step.advanced.map((group) => (
        <div key={group.id} className="space-y-2">
          <SectionLabel>{group.title}</SectionLabel>
          <ul className="text-foreground/75 -mt-1 space-y-0.5 text-xs">
            {group.fields.map((field) => (
              <li key={`${group.id}-${field.label}`}>
                <span className="text-foreground font-medium">{field.label}: </span>
                <span>{field.value}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-foreground/55 text-xs font-medium">{children}</Label>;
}
