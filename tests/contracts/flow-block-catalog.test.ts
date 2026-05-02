import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { FLOW_BLOCK_IDS, FlowBlockCatalog } from '../../src/schemas/flow-blocks.js';

const catalogPath = 'docs/flows/block-catalog.json';
const blocksDocPath = 'docs/flows/blocks.md';
const authoringModelDocPath = 'docs/flows/authoring-model.md';

function readCatalog() {
  return JSON.parse(readFileSync(catalogPath, 'utf8')) as unknown;
}

function parseCatalog() {
  return FlowBlockCatalog.parse(readCatalog());
}

function titleToId(title: string): string {
  return title
    .toLowerCase()
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function canonicalBlockTitlesFromMarkdown(): string[] {
  const markdown = readFileSync(blocksDocPath, 'utf8');
  const section = markdown.split('## Canonical Block List')[1]?.split('## Fix-Derived')[0];
  if (section === undefined) throw new Error('Canonical Block List section not found');
  return section
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.includes('---') && !line.startsWith('| Block'))
    .map((line) => line.split('|')[1]?.trim())
    .filter((title): title is string => title !== undefined && title.length > 0);
}

describe('flow block catalog', () => {
  it('parses the machine-readable catalog with the schema', () => {
    const parsed = parseCatalog();
    expect(parsed.schema_version).toBe('1');
    expect(parsed.blocks).toHaveLength(FLOW_BLOCK_IDS.length);
  });

  it('contains exactly the canonical block ids, in declared order', () => {
    const parsed = parseCatalog();
    expect(parsed.blocks.map((block) => block.id)).toEqual([...FLOW_BLOCK_IDS]);
  });

  it('stays aligned with the Markdown block inventory table', () => {
    const parsed = parseCatalog();
    const markdownTitles = canonicalBlockTitlesFromMarkdown();
    expect(markdownTitles).toEqual(parsed.blocks.map((block) => block.title));
    expect(markdownTitles.map(titleToId)).toEqual([...FLOW_BLOCK_IDS]);
  });

  it('keeps block outputs typed and unique', () => {
    const parsed = parseCatalog();
    const outputs = parsed.blocks.map((block) => block.output_contract);
    expect(new Set(outputs).size).toBe(outputs.length);
    for (const output of outputs) {
      expect(output).toMatch(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+@v[0-9]+$/);
    }
  });

  it('models Act as accepting either diagnosis-based or plan-based input', () => {
    const act = parseCatalog().blocks.find((block) => block.id === 'act');
    expect(act).toBeDefined();
    if (act === undefined) throw new Error('act block missing');
    expect(act.input_contracts).toEqual(['flow.brief@v1', 'diagnosis.result@v1']);
    expect(act.alternative_input_contracts).toEqual([
      ['flow.brief@v1', 'plan.strategy@v1'],
      ['flow.brief@v1', 'plan.strategy@v1', 'diagnosis.result@v1'],
    ]);
  });

  it('rejects duplicate contracts inside a block input set', () => {
    const raw = readCatalog() as {
      blocks: Array<{
        id: string;
        input_contracts?: string[];
      }>;
    };
    const act = raw.blocks.find((block) => block.id === 'act');
    if (act === undefined) throw new Error('act block missing');
    act.input_contracts = ['flow.brief@v1', 'flow.brief@v1'];
    const result = FlowBlockCatalog.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/duplicate input contract/);
    }
  });

  it('pins human decision as a host-mapped, mode-aware block', () => {
    const humanDecision = parseCatalog().blocks.find((block) => block.id === 'human-decision');
    expect(humanDecision).toBeDefined();
    if (humanDecision === undefined) throw new Error('human-decision missing');
    expect(humanDecision.action_surface).toBe('host');
    expect(humanDecision.human_interaction).toBe('mode-dependent');
    expect(humanDecision.host_capabilities.claude.join(' ')).toMatch(
      /AskUserQuestion|user-question/i,
    );
    expect(humanDecision.host_capabilities.codex.join(' ')).toMatch(/native.*question/i);
    expect(humanDecision.host_capabilities.non_interactive.join(' ')).toMatch(
      /default|pause|fail/i,
    );
  });

  it('keeps close and handoff as honest terminal shapes', () => {
    const parsed = parseCatalog();
    const close = parsed.blocks.find((block) => block.id === 'close-with-evidence');
    const handoff = parsed.blocks.find((block) => block.id === 'handoff');
    expect(close?.allowed_routes).toEqual(['complete', 'stop', 'handoff', 'escalate']);
    expect(close?.input_contracts).toEqual([
      'flow.brief@v1',
      'verification.result@v1',
      'review.verdict@v1',
    ]);
    expect(close?.alternative_input_contracts).toEqual([
      ['flow.brief@v1', 'verification.result@v1'],
      ['flow.brief@v1', 'review.verdict@v1'],
      ['flow.brief@v1'],
    ]);
    expect(close?.human_interaction).toBe('never');
    expect(handoff?.allowed_routes).toEqual(['complete', 'stop']);
    expect(handoff?.output_contract).toBe('continuity.record@v1');
  });

  it('has an authoring model that points schematics at the catalog, not freeform graphs', () => {
    const note = readFileSync(authoringModelDocPath, 'utf8');
    expect(note).toContain('docs/flows/block-catalog.json');
    expect(note).toMatch(/schematic/i);
    expect(note).toMatch(/freeform graph/i);
    expect(note).toMatch(/named outcomes/i);
  });
});
