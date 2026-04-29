import * as api from '@/lib/api';
import type { Block, BlockCatalog } from '@/lib/types';
import {
  Boxes,
  Circle,
  ClipboardCheck,
  ClipboardList,
  Frame,
  Hammer,
  Inbox,
  ListOrdered,
  type LucideIcon,
  PackageCheck,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Split,
  Stethoscope,
  UserCog,
} from 'lucide-react';
import { useEffect, useState } from 'react';

// Saturated palette, hand-picked so adjacent rows don't clash. Each
// block id hashes to a stable slot so a given step type keeps the same
// color across renders and sessions.
const BLOCK_COLORS: { bg: string; fg: string }[] = [
  { bg: '#0055aa', fg: '#ffffff' },
  { bg: '#ee8800', fg: '#ffffff' },
  { bg: '#aa0044', fg: '#ffffff' },
  { bg: '#008855', fg: '#ffffff' },
  { bg: '#5522aa', fg: '#ffffff' },
  { bg: '#aa5500', fg: '#ffffff' },
  { bg: '#00aa88', fg: '#000000' },
  { bg: '#dd2200', fg: '#ffffff' },
  { bg: '#ffcc00', fg: '#000000' },
  { bg: '#0099cc', fg: '#ffffff' },
  { bg: '#88cc00', fg: '#000000' },
  { bg: '#cc55aa', fg: '#ffffff' },
];

function colorFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return BLOCK_COLORS[Math.abs(hash) % BLOCK_COLORS.length];
}

// Hand-picked lucide icon per block id. Anything missing falls back to
// a neutral circle so new blocks render until they get their own icon.
const BLOCK_ICONS: Record<string, LucideIcon> = {
  intake: Inbox,
  route: Split,
  frame: Frame,
  'human-decision': UserCog,
  'gather-context': Search,
  diagnose: Stethoscope,
  plan: ClipboardList,
  act: Hammer,
  'run-verification': ShieldCheck,
  review: ClipboardCheck,
  queue: ListOrdered,
  batch: Boxes,
  'risk-rollback-check': ShieldAlert,
  'close-with-evidence': PackageCheck,
  handoff: Send,
};

function iconFor(id: string): LucideIcon {
  return BLOCK_ICONS[id] ?? Circle;
}

export function StepTypesPage() {
  const [catalog, setCatalog] = useState<BlockCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .loadBlocks()
      .then(setCatalog)
      .catch((err) => setError(String(err)));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <header className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">Step types</h2>
        <p className="text-foreground/75 mt-1.5 text-sm leading-relaxed">
          The kinds of steps a circuit can be built from.
        </p>
      </header>

      {error && <p className="text-destructive text-sm">Couldn't load step types: {error}</p>}
      {!catalog && !error && <p className="text-foreground/70 text-sm">Loading…</p>}

      {catalog && (
        <ul className="space-y-2">
          {catalog.blocks.map((block) => (
            <li key={block.id}>
              <BlockRow block={block} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BlockRow({ block }: { block: Block }) {
  const color = colorFor(block.id);
  const Icon = iconFor(block.id);
  return (
    <div className="flex items-center gap-4 py-2">
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: color.bg, color: color.fg }}
      >
        <Icon className="h-6 w-6" aria-hidden="true" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold leading-tight">{block.title}</h3>
        <p className="text-foreground/75 mt-1 text-xs leading-snug">{block.purpose}</p>
      </div>
    </div>
  );
}
