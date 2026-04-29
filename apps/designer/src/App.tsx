import { AppShell } from '@/components/AppShell';
import { RecipeView } from '@/components/RecipeView';
import { StepInspector } from '@/components/StepInspector';
import { StepTypesPage } from '@/components/StepTypesPage';
import { TopBar } from '@/components/TopBar';
import * as api from '@/lib/api';
import { deriveDesignerModel } from '@/lib/designer-model';
import type { BlockCatalog, Schematic, SchematicStep, ValidationIssue } from '@/lib/types';
import { useEffect, useMemo, useState } from 'react';

export function App() {
  const [flows, setFlows] = useState<readonly string[]>([]);
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);
  const [schematic, setSchematic] = useState<Schematic | null>(null);
  const [catalog, setCatalog] = useState<BlockCatalog | null>(null);
  const [activeModeName, setActiveModeName] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<readonly ValidationIssue[] | null>(null);
  const [view, setView] = useState<'recipe' | 'step-types'>('recipe');

  useEffect(() => {
    api
      .listFlows()
      .then(setFlows)
      .catch((err) => setBootError(String(err)));
    api
      .loadBlocks()
      .then(setCatalog)
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
        setSelectedStepId(null);
        setActiveModeName(null);
        setSaveError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setBootError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [currentFlowId]);

  const designer = useMemo(() => {
    if (!schematic || !catalog) return null;
    return deriveDesignerModel({
      schematic,
      catalog,
      modeName: activeModeName ?? undefined,
    });
  }, [schematic, catalog, activeModeName]);

  const selectedStep = useMemo(
    () => designer?.steps.find((step) => step.id === selectedStepId) ?? null,
    [designer, selectedStepId],
  );
  const selectedRawStep = useMemo<SchematicStep | null>(
    () => schematic?.items.find((step) => step.id === selectedStepId) ?? null,
    [schematic, selectedStepId],
  );

  function patchStep(id: string, patch: Partial<SchematicStep>) {
    setSchematic((prev) => {
      if (!prev) return prev;
      const items = prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item));
      return { ...prev, items };
    });
    setDirty(true);
  }

  async function save() {
    if (!schematic || !currentFlowId) return;
    setSaving(true);
    setSaveError(null);
    const result = await api.saveSchematic(currentFlowId, schematic);
    setSaving(false);
    if (result.ok) {
      setDirty(false);
    } else {
      setSaveError((result.errors as ValidationIssue[]) ?? []);
    }
  }

  const showStepTypes = view === 'step-types';

  return (
    <AppShell
      header={
        <TopBar
          flows={flows}
          currentFlowId={currentFlowId}
          onPickFlow={setCurrentFlowId}
          modes={designer?.entryModes ?? []}
          activeMode={designer?.activeMode ?? null}
          onPickMode={setActiveModeName}
          dirty={dirty}
          saving={saving}
          onSave={save}
          health={designer?.health ?? null}
          view={view}
          onShowStepTypes={() => setView('step-types')}
          onShowRecipe={() => setView('recipe')}
        />
      }
      main={
        showStepTypes ? (
          <StepTypesPage />
        ) : bootError ? (
          <div className="text-destructive p-5 text-sm">{bootError}</div>
        ) : !designer ? (
          <div className="text-foreground/75 p-5 text-sm">
            {currentFlowId ? 'Loading…' : 'Pick a circuit above to get started.'}
          </div>
        ) : (
          <>
            {saveError && saveError.length > 0 && (
              <div className="border-destructive/50 bg-destructive/10 mx-6 mt-6 rounded-md border p-3">
                <h4 className="text-destructive text-sm font-semibold">Couldn't save</h4>
                <ul className="text-destructive mt-1 space-y-0.5 text-xs">
                  {saveError.map((err) => (
                    <li key={`${err.path?.join('.') ?? ''}:${err.message}`}>{err.message}</li>
                  ))}
                </ul>
              </div>
            )}
            <RecipeView
              circuit={designer}
              selectedStepId={selectedStepId}
              onSelectStep={setSelectedStepId}
            />
          </>
        )
      }
      rightPanel={
        !showStepTypes && designer && selectedStep && selectedRawStep ? (
          <StepInspector
            circuit={designer}
            step={selectedStep}
            rawStep={selectedRawStep}
            onPatch={(patch) => patchStep(selectedStep.id, patch)}
            onClose={() => setSelectedStepId(null)}
          />
        ) : undefined
      }
    />
  );
}
