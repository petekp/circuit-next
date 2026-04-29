import type { ReactNode } from 'react';

type AppShellProps = {
  header: ReactNode;
  main: ReactNode;
  drawer?: ReactNode;
  rightPanel?: ReactNode;
};

// Recipe workspace shell. The main column scrolls; the right inspector
// floats as a side panel when a step is selected. The "drawer" slot is
// reserved for the hidden Blocks / Learn drawer.
export function AppShell({ header, main, drawer, rightPanel }: AppShellProps) {
  return (
    <div className="bg-background text-foreground flex h-screen flex-col">
      <header className="border-border border-b">{header}</header>
      <div className="grid min-h-0 flex-1 grid-cols-[1fr] lg:grid-cols-[1fr_420px]">
        <main className="min-h-0 overflow-auto">{main}</main>
        {rightPanel ? (
          <aside className="border-border min-h-0 overflow-hidden border-l">{rightPanel}</aside>
        ) : (
          <aside className="border-border bg-muted/30 hidden min-h-0 overflow-hidden border-l p-6 lg:block">
            <div className="text-foreground/75 text-sm">
              Pick a step on the left to see how it works or adjust it.
            </div>
          </aside>
        )}
      </div>
      {drawer}
    </div>
  );
}
