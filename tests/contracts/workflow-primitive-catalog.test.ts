import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  WORKFLOW_PRIMITIVE_IDS,
  WorkflowPrimitiveCatalog,
} from '../../src/schemas/workflow-primitives.js';

const catalogPath = 'docs/workflows/primitive-catalog.json';
const primitivesDocPath = 'docs/workflows/primitives.md';
const compositionDocPath = 'docs/workflows/flow-schematics.md';

function readCatalog() {
  return JSON.parse(readFileSync(catalogPath, 'utf8')) as unknown;
}

function parseCatalog() {
  return WorkflowPrimitiveCatalog.parse(readCatalog());
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

function canonicalPrimitiveTitlesFromMarkdown(): string[] {
  const markdown = readFileSync(primitivesDocPath, 'utf8');
  const section = markdown.split('## Canonical Block List')[1]?.split('## Fix-Derived')[0];
  if (section === undefined) throw new Error('Canonical Block List section not found');
  return section
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.includes('---') && !line.startsWith('| Block'))
    .map((line) => line.split('|')[1]?.trim())
    .filter((title): title is string => title !== undefined && title.length > 0);
}

describe('workflow primitive catalog', () => {
  it('parses the machine-readable catalog with the schema', () => {
    const parsed = parseCatalog();
    expect(parsed.schema_version).toBe('1');
    expect(parsed.primitives).toHaveLength(WORKFLOW_PRIMITIVE_IDS.length);
  });

  it('contains exactly the canonical primitive ids, in declared order', () => {
    const parsed = parseCatalog();
    expect(parsed.primitives.map((primitive) => primitive.id)).toEqual([...WORKFLOW_PRIMITIVE_IDS]);
  });

  it('stays aligned with the Markdown primitive inventory table', () => {
    const parsed = parseCatalog();
    const markdownTitles = canonicalPrimitiveTitlesFromMarkdown();
    expect(markdownTitles).toEqual(parsed.primitives.map((primitive) => primitive.title));
    expect(markdownTitles.map(titleToId)).toEqual([...WORKFLOW_PRIMITIVE_IDS]);
  });

  it('keeps primitive outputs typed and unique', () => {
    const parsed = parseCatalog();
    const outputs = parsed.primitives.map((primitive) => primitive.output_contract);
    expect(new Set(outputs).size).toBe(outputs.length);
    for (const output of outputs) {
      expect(output).toMatch(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+@v[0-9]+$/);
    }
  });

  it('models Act as accepting either diagnosis-based or plan-based input', () => {
    const act = parseCatalog().primitives.find((primitive) => primitive.id === 'act');
    expect(act).toBeDefined();
    if (act === undefined) throw new Error('act primitive missing');
    expect(act.input_contracts).toEqual(['workflow.brief@v1', 'diagnosis.result@v1']);
    expect(act.alternative_input_contracts).toEqual([
      ['workflow.brief@v1', 'plan.strategy@v1'],
      ['workflow.brief@v1', 'plan.strategy@v1', 'diagnosis.result@v1'],
    ]);
  });

  it('rejects duplicate contracts inside a primitive input set', () => {
    const raw = readCatalog() as {
      primitives: Array<{
        id: string;
        input_contracts?: string[];
      }>;
    };
    const act = raw.primitives.find((primitive) => primitive.id === 'act');
    if (act === undefined) throw new Error('act primitive missing');
    act.input_contracts = ['workflow.brief@v1', 'workflow.brief@v1'];
    const result = WorkflowPrimitiveCatalog.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toMatch(/duplicate input contract/);
    }
  });

  it('pins human decision as a host-mapped, mode-aware primitive', () => {
    const humanDecision = parseCatalog().primitives.find(
      (primitive) => primitive.id === 'human-decision',
    );
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
    const close = parsed.primitives.find((primitive) => primitive.id === 'close-with-evidence');
    const handoff = parsed.primitives.find((primitive) => primitive.id === 'handoff');
    expect(close?.allowed_routes).toEqual(['complete', 'stop', 'handoff', 'escalate']);
    expect(close?.input_contracts).toEqual([
      'workflow.brief@v1',
      'verification.result@v1',
      'review.verdict@v1',
    ]);
    expect(close?.alternative_input_contracts).toEqual([
      ['workflow.brief@v1', 'verification.result@v1'],
      ['workflow.brief@v1', 'review.verdict@v1'],
      ['workflow.brief@v1'],
    ]);
    expect(close?.human_interaction).toBe('never');
    expect(handoff?.allowed_routes).toEqual(['complete', 'stop']);
    expect(handoff?.output_contract).toBe('continuity.record@v1');
  });

  it('has a composition note that points schematics at the catalog, not freeform graphs', () => {
    const note = readFileSync(compositionDocPath, 'utf8');
    expect(note).toContain('docs/workflows/primitive-catalog.json');
    expect(note).toMatch(/schematic/i);
    expect(note).toMatch(/freeform graph/i);
    expect(note).toMatch(/named outcomes/i);
  });
});
