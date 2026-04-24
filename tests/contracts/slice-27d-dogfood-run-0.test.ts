import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildInventory } from '../../scripts/inventory.mjs';
import { Workflow } from '../../src/schemas/workflow.js';

// Slice 27d — dogfood-run-0 Alpha Product Proof contract assertions.
//
// This file is the narrow id-flip oracle for 27d, companion to the 27c
// boundary test at tests/contracts/slice-27c-runtime-boundary.test.ts.
// It asserts the four remaining inventory rows flip from
// `present: false` to `present: true` and that the Alpha Proof
// deliverables exist at HEAD.
//
// Per `specs/plans/phase-1-close-revised.md` §Slice 27d and
// ADR-0001 Addendum B §Phase 1.5 Close Criteria #4/#5/#6/#7/#13.

const EXPECTED_27D_FLIPS = [
  'runner.cli_script',
  'plugin.manifest',
  'plugin.dogfood_workflow_fixture',
  'tests.runner_smoke',
] as const;

describe('Slice 27d — inventory row flips', () => {
  it('flips the four 27d target rows to present:true', () => {
    const { surfaces } = buildInventory();
    for (const id of EXPECTED_27D_FLIPS) {
      const row = surfaces.find((s) => s.id === id);
      if (!row) throw new Error(`missing surface ${id}`);
      expect(row.present, `${id} expected present:true at 27d HEAD (${row.evidence_summary})`).toBe(
        true,
      );
    }
  });

  it('all 10 inventory rows report present:true at 27d HEAD (Alpha Proof full-green)', () => {
    const { surfaces, summary } = buildInventory();
    const absent = surfaces.filter((s) => !s.present);
    expect(
      absent,
      `expected all inventory rows present; still absent: ${absent.map((s) => s.id).join(', ')}`,
    ).toHaveLength(0);
    expect(summary.present).toBe(summary.total);
  });
});

describe('Slice 27d — plugin surface artifacts', () => {
  it('.claude-plugin/plugin.json declares non-empty name and version', () => {
    const path = '.claude-plugin/plugin.json';
    expect(existsSync(path)).toBe(true);
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    expect(typeof raw.name).toBe('string');
    expect((raw.name as string).length).toBeGreaterThan(0);
    expect(typeof raw.version).toBe('string');
    expect((raw.version as string).length).toBeGreaterThan(0);
  });

  it('dogfood-run-0 workflow fixture parses through the production Workflow schema', () => {
    const fixturePath = '.claude-plugin/skills/dogfood-run-0/circuit.json';
    expect(existsSync(fixturePath)).toBe(true);
    const raw: unknown = JSON.parse(readFileSync(fixturePath, 'utf8'));
    const parsed = Workflow.safeParse(raw);
    expect(
      parsed.success,
      `workflow fixture failed to parse: ${
        parsed.success ? '' : JSON.stringify(parsed.error.issues, null, 2)
      }`,
    ).toBe(true);
    if (parsed.success) {
      expect(parsed.data.id).toBe('dogfood-run-0');
      // Alpha Proof exercises at least one synthesis + one dispatch step.
      const kinds = new Set(parsed.data.steps.map((s) => s.kind));
      expect(kinds.has('synthesis')).toBe(true);
      expect(kinds.has('dispatch')).toBe(true);
    }
  });
});

describe('Slice 27d — CLI + runner modules', () => {
  it('src/cli/dogfood.ts exists and exports a main(argv) function', async () => {
    const cliPath = 'src/cli/dogfood.ts';
    expect(existsSync(cliPath)).toBe(true);
    const mod: unknown = await import('../../src/cli/dogfood.js');
    if (mod === null || typeof mod !== 'object') {
      throw new Error('CLI module did not load as an object');
    }
    const exported = mod as Record<string, unknown>;
    expect(typeof exported.main).toBe('function');
  });

  it('src/cli/circuit.ts exists and exports the first-class main(argv) function', async () => {
    const cliPath = 'src/cli/circuit.ts';
    expect(existsSync(cliPath)).toBe(true);
    const mod: unknown = await import('../../src/cli/circuit.js');
    if (mod === null || typeof mod !== 'object') {
      throw new Error('Circuit CLI module did not load as an object');
    }
    const exported = mod as Record<string, unknown>;
    expect(typeof exported.main).toBe('function');
  });

  it('bin/circuit-next exists as the executable first-class launcher', () => {
    const launcherPath = 'bin/circuit-next';
    expect(existsSync(launcherPath)).toBe(true);
    expect(readFileSync(launcherPath, 'utf8')).toMatch(
      /^#!\/usr\/bin\/env node\n[\s\S]*dist\/cli\/circuit\.js/,
    );
    expect(statSync(launcherPath).mode & 0o111).not.toBe(0);
  });

  it('src/runtime/result-writer.ts exports writeResult and resultPath', async () => {
    const modPath = 'src/runtime/result-writer.ts';
    expect(existsSync(modPath)).toBe(true);
    const mod: unknown = await import('../../src/runtime/result-writer.js');
    if (mod === null || typeof mod !== 'object') {
      throw new Error('result-writer module did not load as an object');
    }
    const exported = mod as Record<string, unknown>;
    expect(typeof exported.writeResult).toBe('function');
    expect(typeof exported.resultPath).toBe('function');
  });

  it('src/runtime/runner.ts exports runDogfood composing the runtime boundary', async () => {
    const mod: unknown = await import('../../src/runtime/runner.js');
    if (mod === null || typeof mod !== 'object') {
      throw new Error('runner module did not load as an object');
    }
    const exported = mod as Record<string, unknown>;
    expect(typeof exported.runDogfood).toBe('function');
    expect(typeof exported.bootstrapRun).toBe('function');
    expect(typeof exported.appendAndDerive).toBe('function');
  });
});

describe('Slice 27d — package.json wiring', () => {
  it('scripts.circuit:run is a non-placeholder command invoking the CLI', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const cmd = pkg.scripts?.['circuit:run'];
    expect(typeof cmd).toBe('string');
    expect(cmd).toBe('./bin/circuit-next');
    // Inventory rejects echo/true/noop; assert directly that we didn't
    // regress to a placeholder here.
    expect(/^(echo|true|:)\b/.test(cmd ?? '')).toBe(false);
  });
});

describe('Slice 27d — result writer wiring (run.result artifact row)', () => {
  it('specs/artifacts.json run.result row names a writer authored by Slice 27d', () => {
    const artifacts = JSON.parse(readFileSync(join('specs', 'artifacts.json'), 'utf8')) as {
      artifacts: Array<{
        id: string;
        schema_file?: string;
        writers?: string[];
      }>;
    };
    const row = artifacts.artifacts.find((a) => a.id === 'run.result');
    expect(row, 'run.result row must exist at specs/artifacts.json').toBeDefined();
    expect(row?.schema_file).toBe('src/schemas/result.ts');
    // The writer description lands in 27c pointing forward to 27d.
    // 27d's product evidence IS that forward promise kept; we read the
    // writer bound-in-code by import, not by string inspection — but
    // we assert the row continues to name a writer entry.
    const writers = row?.writers ?? [];
    expect(writers.length).toBeGreaterThan(0);
  });
});
