import { AppShell } from '@/components/AppShell';
import { BlockLibrary } from '@/components/BlockLibrary';
import { FlowHeaderForm } from '@/components/FlowHeaderForm';
import { RouteMap } from '@/components/RouteMap';
import { SchematicLoader } from '@/components/SchematicLoader';
import { StepEditor } from '@/components/StepEditor';
import { StepList } from '@/components/StepList';
import * as api from '@/lib/api';
import type { Schematic, SchematicStep, ValidationIssue, ValidationResult } from '@/lib/types';
import { useEffect, useMemo, useState } from 'react';

export function App() {
  const [flows, setFlows] = useState<readonly string[]>([]);
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);
  const [schematic, setSchematic] = useState<Schematic | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listFlows()
      .then(setFlows)
      .catch((err) => setBootError(String(err)));
  }, []);

  useEffect(() => {
    if (!currentFlowId) return;
    let cancelled = false;
    api
      .loadSchematic(currentFlowId)
      .then((s) => {
        if (cancelled) return;
        setSchematic(s);
        setDirty(false);
        setValidation(null);
        setSelectedStepId(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setBootError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [currentFlowId]);

  function patchSchematic(patch: Partial<Schematic>) {
    setSchematic((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  }

  function patchStep(id: string, patch: Partial<SchematicStep>) {
    setSchematic((prev) => {
      if (!prev) return prev;
      const items = prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item));
      return { ...prev, items };
    });
    setDirty(true);
  }

  async function revalidate() {
    if (!schematic) return;
    const result = await api.validateSchematic(schematic);
    setValidation(result);
  }

  async function save() {
    if (!schematic || !currentFlowId) return;
    setSaving(true);
    const result = await api.saveSchematic(currentFlowId, schematic);
    setSaving(false);
    if (result.ok) {
      setDirty(false);
      setValidation({ ok: true, schemaErrors: [], compatibilityIssues: [] });
    } else {
      setValidation({
        ok: false,
        schemaErrors: (result.errors as ValidationIssue[]) ?? [],
        compatibilityIssues: [],
      });
    }
  }

  // Index header-level errors by their first path segment (e.g. "title", "purpose").
  const headerErrorsByPath = useMemo(() => {
    const map = new Map<string, ValidationIssue[]>();
    if (!validation) return map;
    for (const issue of validation.schemaErrors) {
      const head = issue.path?.[0];
      if (typeof head === 'string' && head !== 'items') {
        const arr = map.get(head) ?? [];
        arr.push(issue);
        map.set(head, arr);
      }
    }
    return map;
  }, [validation]);

  const selectedStep = useMemo(() => {
    if (!schematic || !selectedStepId) return null;
    return schematic.items.find((s) => s.id === selectedStepId) ?? null;
  }, [schematic, selectedStepId]);

  // Schema errors scoped to the selected step (path[0]==='items', path[1]===item-index).
  const errorsForSelectedStep = useMemo(() => {
    if (!validation || !selectedStep || !schematic) return [];
    const idx = schematic.items.findIndex((s) => s.id === selectedStep.id);
    if (idx < 0) return [];
    return validation.schemaErrors.filter((e) => e.path?.[0] === 'items' && e.path?.[1] === idx);
  }, [validation, selectedStep, schematic]);

  // Compatibility issues scoped to the selected step.
  const compatForSelectedStep = useMemo(() => {
    if (!validation || !selectedStep) return [];
    return validation.compatibilityIssues.filter((i) => i.item_id === selectedStep.id);
  }, [validation, selectedStep]);

  const allStepIds = schematic?.items?.map((s) => s.id) ?? [];

  return (
    <AppShell
      header={
        <SchematicLoader
          flows={flows}
          currentFlowId={currentFlowId}
          dirty={dirty}
          saving={saving}
          onPick={setCurrentFlowId}
          onSave={save}
        />
      }
      left={
        schematic ? (
          <StepList
            steps={schematic.items}
            selectedStepId={selectedStepId}
            onSelect={setSelectedStepId}
          />
        ) : (
          <div className="text-muted-foreground p-3 text-xs">
            {currentFlowId ? 'Loading…' : 'Pick a flow.'}
          </div>
        )
      }
      center={
        bootError ? (
          <div className="text-destructive p-5 text-sm">{bootError}</div>
        ) : !schematic ? (
          <div className="text-muted-foreground p-5 text-sm">
            {currentFlowId ? 'Loading…' : 'Pick a flow to start.'}
          </div>
        ) : (
          <div onBlur={revalidate}>
            <FlowHeaderForm
              schematic={schematic}
              errorsByPath={headerErrorsByPath}
              onPatch={patchSchematic}
            />
            {selectedStep && (
              <StepEditor
                step={selectedStep}
                allStepIds={allStepIds}
                errorsForItem={[
                  ...errorsForSelectedStep,
                  ...compatForSelectedStep.map((c) => ({
                    message: c.message,
                  })),
                ]}
                onPatch={(patch) => patchStep(selectedStep.id, patch)}
              />
            )}
            {validation?.compatibilityIssues && validation.compatibilityIssues.length > 0 && (
              <div className="border-destructive/50 bg-destructive/10 mx-5 mb-5 rounded-md border p-4">
                <h3 className="text-destructive text-sm font-semibold">
                  Compatibility issues ({validation.compatibilityIssues.length})
                </h3>
                <ul className="text-destructive mt-2 space-y-1 text-xs">
                  {validation.compatibilityIssues.map((issue) => (
                    <li key={`${issue.item_id ?? ''}:${issue.message}`}>
                      {issue.item_id && <span className="mr-2 font-mono">[{issue.item_id}]</span>}
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      }
      right={<BlockLibrary />}
      bottom={
        schematic ? (
          <RouteMap
            steps={schematic.items}
            selectedStepId={selectedStepId}
            onSelect={setSelectedStepId}
          />
        ) : null
      }
    />
  );
}
