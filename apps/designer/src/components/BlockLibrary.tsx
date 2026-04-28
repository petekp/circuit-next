import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as api from '@/lib/api';
import type { Block, BlockCatalog } from '@/lib/types';
import { useEffect, useState } from 'react';

export function BlockLibrary() {
  const [catalog, setCatalog] = useState<BlockCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .loadBlocks()
      .then(setCatalog)
      .catch((err) => setError(String(err)));
  }, []);

  if (error) {
    return <p className="text-destructive p-3 text-xs">{error}</p>;
  }
  if (!catalog) {
    return <p className="text-muted-foreground p-3 text-xs">Loading…</p>;
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-3">
        <h3 className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
          Blocks ({catalog.blocks.length})
        </h3>
        {catalog.blocks.map((block) => (
          <BlockCard key={block.id} block={block} />
        ))}
      </div>
    </ScrollArea>
  );
}

function BlockCard({ block }: { block: Block }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium leading-tight">{block.title}</h4>
          <Badge variant="outline" className="font-mono text-[10px] shrink-0">
            {block.id}
          </Badge>
        </div>
        <p className="text-muted-foreground text-xs leading-snug">{block.purpose}</p>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-[10px]">
            {block.action_surface}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {block.human_interaction}
          </Badge>
        </div>
        <div className="text-muted-foreground font-mono text-[10px]">
          routes: {block.allowed_routes.join(', ')}
        </div>
      </CardContent>
    </Card>
  );
}
