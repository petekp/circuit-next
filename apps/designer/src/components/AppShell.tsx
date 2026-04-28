import type { ReactNode } from 'react';

type AppShellProps = {
  header: ReactNode;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  bottom?: ReactNode;
};

export function AppShell({ header, left, center, right, bottom }: AppShellProps) {
  return (
    <div className="bg-background text-foreground flex h-screen flex-col">
      <header className="border-border border-b">{header}</header>
      <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr_320px]">
        <aside className="border-border min-h-0 overflow-hidden border-r">{left}</aside>
        <main className="min-h-0 overflow-auto">{center}</main>
        <aside className="border-border min-h-0 overflow-hidden border-l">{right}</aside>
      </div>
      {bottom && (
        <div className="border-border h-[220px] shrink-0 overflow-auto border-t">{bottom}</div>
      )}
    </div>
  );
}
