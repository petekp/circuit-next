import type { DesignerEntryMode } from '@/lib/designer-model';
import { Compass } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type Props = {
  mode: DesignerEntryMode;
};

// Shows a transient banner explaining the current mode whenever the
// active mode changes. Mounts hidden on first render so the initial load
// stays quiet; appears for ~6s on subsequent mode switches.
export function ModePreviewBanner({ mode }: Props) {
  const [visible, setVisible] = useState(false);
  const [shownMode, setShownMode] = useState(mode);
  const lastModeRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip the very first paint — we don't want a banner on initial load.
    if (lastModeRef.current === null) {
      lastModeRef.current = mode.name;
      return;
    }
    if (lastModeRef.current === mode.name) return;
    lastModeRef.current = mode.name;
    setShownMode(mode);
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 6000);
    return () => window.clearTimeout(timer);
  }, [mode]);

  if (!visible) return null;

  return (
    <output
      aria-live="polite"
      className="border-border bg-card mb-5 flex items-start gap-3 rounded-md border px-3 py-2.5 shadow-sm"
    >
      <Compass className="text-foreground/60 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <div className="text-sm font-medium leading-tight">
          Switched to <span className="capitalize">{shownMode.name}</span> mode
        </div>
        <p className="text-foreground/70 mt-0.5 text-xs leading-snug">{shownMode.description}</p>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground -mr-1 -mt-1 ml-auto rounded p-1 text-sm leading-none"
      >
        ×
      </button>
    </output>
  );
}
