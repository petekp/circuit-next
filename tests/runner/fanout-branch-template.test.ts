import { describe, expect, it } from 'vitest';

import {
  expandTemplate,
  resolveDottedPath,
  substituteItemPlaceholders,
} from '../../src/shared/fanout-branch-template.js';

describe('fanout branch template helpers', () => {
  it('resolves dotted paths through nested objects', () => {
    const items = [{ id: 'a' }, { id: 'b' }];

    expect(resolveDottedPath({ batches: { items } }, 'batches.items')).toBe(items);
  });

  it('fails loudly when dotted paths leave objects or miss segments', () => {
    expect(() => resolveDottedPath({ batches: [] }, 'batches.items')).toThrow(
      "items_path 'batches.items' descended into a non-object at segment 'items'",
    );
    expect(() => resolveDottedPath({ batches: {} }, 'batches.items')).toThrow(
      "items_path 'batches.items' is missing at segment 'items'",
    );
  });

  it('substitutes exact and inline item placeholders', () => {
    const item = { id: 'a', index: 2 };

    expect(substituteItemPlaceholders('$item.id', item)).toBe('a');
    expect(substituteItemPlaceholders('branch-$item.index', item)).toBe('branch-2');
    expect(substituteItemPlaceholders('$item', item)).toBe(JSON.stringify(item));
  });

  it('expands nested template objects without changing structure', () => {
    expect(
      expandTemplate(
        {
          branch_id: '$item.id',
          goal: 'inspect $item.path',
          execution: {
            kind: 'relay',
            tags: ['$item.id', 'static'],
          },
        },
        { id: 'candidate-1', path: 'src/index.ts' },
      ),
    ).toEqual({
      branch_id: 'candidate-1',
      goal: 'inspect src/index.ts',
      execution: {
        kind: 'relay',
        tags: ['candidate-1', 'static'],
      },
    });
  });
});
