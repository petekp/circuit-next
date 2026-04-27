// Tests the pure derivation helpers that turn workflow packages into
// engine registries. Synthetic mini-catalogs let us exercise the
// duplicate-detection and default-package invariants in isolation
// without touching the real workflow set.

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  buildArtifactSchemaRegistry,
  buildCheckpointRegistry,
  buildCloseRegistry,
  buildRoutablePackages,
  buildSchemaHintMap,
  buildStructuralHintList,
  buildSynthesisRegistry,
  buildVerificationRegistry,
  findDefaultRoutablePackage,
} from '../../src/runtime/catalog-derivations.js';
import type { CheckpointBriefBuilder } from '../../src/runtime/registries/checkpoint-writers/types.js';
import type { CloseBuilder } from '../../src/runtime/registries/close-writers/types.js';
import type { StructuralShapeHint } from '../../src/runtime/registries/shape-hints/types.js';
import type { SynthesisBuilder } from '../../src/runtime/registries/synthesis-writers/types.js';
import type { VerificationBuilder } from '../../src/runtime/registries/verification-writers/types.js';
import type { WorkflowPackage } from '../../src/workflows/types.js';

function fakePackage(opts: Partial<WorkflowPackage> & { readonly id: string }): WorkflowPackage {
  return {
    id: opts.id,
    paths: opts.paths ?? { recipe: `synthetic/${opts.id}.recipe.json` },
    ...(opts.routing === undefined ? {} : { routing: opts.routing }),
    dispatchArtifacts: opts.dispatchArtifacts ?? [],
    writers: opts.writers ?? { synthesis: [], close: [], verification: [], checkpoint: [] },
    ...(opts.structuralHints === undefined ? {} : { structuralHints: opts.structuralHints }),
    ...(opts.engineFlags === undefined ? {} : { engineFlags: opts.engineFlags }),
  };
}

const fakeSynthesisBuilder = (schema: string): SynthesisBuilder => ({
  resultSchemaName: schema,
  build: () => ({}),
});

const fakeCloseBuilder = (schema: string): CloseBuilder => ({
  resultSchemaName: schema,
  reads: [],
  build: () => ({}),
});

const fakeVerificationBuilder = (schema: string): VerificationBuilder => ({
  resultSchemaName: schema,
  loadCommands: () => [],
  buildResult: () => ({}),
});

const fakeCheckpointBuilder = (schema: string): CheckpointBriefBuilder => ({
  resultSchemaName: schema,
  build: () => ({}),
});

const fakeStructuralHint = (id: string): StructuralShapeHint => ({
  kind: 'structural',
  id,
  match: () => true,
  instruction: `instruction for ${id}`,
});

describe('catalog-derivations: builder registries', () => {
  it('flattens synthesis builders across packages by resultSchemaName', () => {
    const packages = [
      fakePackage({
        id: 'a',
        writers: {
          synthesis: [fakeSynthesisBuilder('a.one@v1'), fakeSynthesisBuilder('a.two@v1')],
          close: [],
          verification: [],
          checkpoint: [],
        },
      }),
      fakePackage({
        id: 'b',
        writers: {
          synthesis: [fakeSynthesisBuilder('b.one@v1')],
          close: [],
          verification: [],
          checkpoint: [],
        },
      }),
    ];
    const registry = buildSynthesisRegistry(packages);
    expect(registry.size).toBe(3);
    expect(registry.get('a.one@v1')).toBeDefined();
    expect(registry.get('a.two@v1')).toBeDefined();
    expect(registry.get('b.one@v1')).toBeDefined();
  });

  it('throws when two packages register synthesis builders for the same schema', () => {
    const packages = [
      fakePackage({
        id: 'a',
        writers: {
          synthesis: [fakeSynthesisBuilder('shared@v1')],
          close: [],
          verification: [],
          checkpoint: [],
        },
      }),
      fakePackage({
        id: 'b',
        writers: {
          synthesis: [fakeSynthesisBuilder('shared@v1')],
          close: [],
          verification: [],
          checkpoint: [],
        },
      }),
    ];
    expect(() => buildSynthesisRegistry(packages)).toThrow(
      /duplicate synthesis builder registered for schema 'shared@v1' \(workflow b\)/,
    );
  });

  it('throws on duplicate close builders', () => {
    const packages = [
      fakePackage({
        id: 'a',
        writers: {
          synthesis: [],
          close: [fakeCloseBuilder('shared.result@v1')],
          verification: [],
          checkpoint: [],
        },
      }),
      fakePackage({
        id: 'b',
        writers: {
          synthesis: [],
          close: [fakeCloseBuilder('shared.result@v1')],
          verification: [],
          checkpoint: [],
        },
      }),
    ];
    expect(() => buildCloseRegistry(packages)).toThrow(/duplicate close builder/);
  });

  it('throws on duplicate verification builders', () => {
    const packages = [
      fakePackage({
        id: 'a',
        writers: {
          synthesis: [],
          close: [],
          verification: [fakeVerificationBuilder('v@v1')],
          checkpoint: [],
        },
      }),
      fakePackage({
        id: 'b',
        writers: {
          synthesis: [],
          close: [],
          verification: [fakeVerificationBuilder('v@v1')],
          checkpoint: [],
        },
      }),
    ];
    expect(() => buildVerificationRegistry(packages)).toThrow(/duplicate verification builder/);
  });

  it('throws on duplicate checkpoint builders', () => {
    const packages = [
      fakePackage({
        id: 'a',
        writers: {
          synthesis: [],
          close: [],
          verification: [],
          checkpoint: [fakeCheckpointBuilder('c@v1')],
        },
      }),
      fakePackage({
        id: 'b',
        writers: {
          synthesis: [],
          close: [],
          verification: [],
          checkpoint: [fakeCheckpointBuilder('c@v1')],
        },
      }),
    ];
    expect(() => buildCheckpointRegistry(packages)).toThrow(/duplicate checkpoint builder/);
  });
});

describe('catalog-derivations: artifact schema registry', () => {
  it('combines fixtures and per-package dispatch artifacts', () => {
    const fixture = z.object({ verdict: z.string() });
    const real = z.object({ verdict: z.string(), summary: z.string() });
    const registry = buildArtifactSchemaRegistry(
      [
        fakePackage({
          id: 'a',
          dispatchArtifacts: [{ schemaName: 'a.one@v1', schema: real }],
        }),
      ],
      { 'fixture@v1': fixture },
    );
    expect(Object.hasOwn(registry, 'fixture@v1')).toBe(true);
    expect(Object.hasOwn(registry, 'a.one@v1')).toBe(true);
    expect(registry['a.one@v1']).toBe(real);
  });

  it('throws on duplicate schema between two packages', () => {
    const schema = z.object({ verdict: z.string() });
    const packages = [
      fakePackage({
        id: 'a',
        dispatchArtifacts: [{ schemaName: 'shared@v1', schema }],
      }),
      fakePackage({
        id: 'b',
        dispatchArtifacts: [{ schemaName: 'shared@v1', schema }],
      }),
    ];
    expect(() => buildArtifactSchemaRegistry(packages, {})).toThrow(
      /duplicate dispatch artifact schema 'shared@v1' registered \(workflow b\)/,
    );
  });

  it('throws on collision between fixtures and a package artifact', () => {
    const schema = z.object({ verdict: z.string() });
    expect(() =>
      buildArtifactSchemaRegistry(
        [
          fakePackage({
            id: 'a',
            dispatchArtifacts: [{ schemaName: 'fixture@v1', schema }],
          }),
        ],
        { 'fixture@v1': schema },
      ),
    ).toThrow(/duplicate dispatch artifact schema 'fixture@v1'/);
  });

  it('returns a frozen map', () => {
    const registry = buildArtifactSchemaRegistry([], {});
    expect(Object.isFrozen(registry)).toBe(true);
  });
});

describe('catalog-derivations: schema and structural hint maps', () => {
  it('maps schema name to dispatchHint and skips artifacts with no hint', () => {
    const schema = z.object({ verdict: z.string() });
    const packages = [
      fakePackage({
        id: 'a',
        dispatchArtifacts: [
          { schemaName: 'with-hint@v1', schema, dispatchHint: 'use this shape' },
          { schemaName: 'no-hint@v1', schema },
        ],
      }),
    ];
    const map = buildSchemaHintMap(packages);
    expect(map.size).toBe(1);
    expect(map.get('with-hint@v1')).toBe('use this shape');
    expect(map.has('no-hint@v1')).toBe(false);
  });

  it('throws on duplicate schema hint across two packages', () => {
    const schema = z.object({ verdict: z.string() });
    const packages = [
      fakePackage({
        id: 'a',
        dispatchArtifacts: [{ schemaName: 'shared@v1', schema, dispatchHint: 'a' }],
      }),
      fakePackage({
        id: 'b',
        dispatchArtifacts: [{ schemaName: 'shared@v1', schema, dispatchHint: 'b' }],
      }),
    ];
    expect(() => buildSchemaHintMap(packages)).toThrow(
      /duplicate shape hint registered for schema 'shared@v1' \(workflow b\)/,
    );
  });

  it('builds the structural hint list and preserves package order', () => {
    const packages = [
      fakePackage({ id: 'a', structuralHints: [fakeStructuralHint('a.struct@v1')] }),
      fakePackage({ id: 'b', structuralHints: [fakeStructuralHint('b.struct@v1')] }),
    ];
    const list = buildStructuralHintList(packages);
    expect(list.map((h) => h.id)).toEqual(['a.struct@v1', 'b.struct@v1']);
  });

  it('throws on duplicate structural hint id', () => {
    const packages = [
      fakePackage({ id: 'a', structuralHints: [fakeStructuralHint('shared@v1')] }),
      fakePackage({ id: 'b', structuralHints: [fakeStructuralHint('shared@v1')] }),
    ];
    expect(() => buildStructuralHintList(packages)).toThrow(
      /duplicate structural shape hint id 'shared@v1' \(workflow b\)/,
    );
  });
});

describe('catalog-derivations: routable packages and default selection', () => {
  it('keeps only packages with routing and sorts by routing.order ascending', () => {
    const packages = [
      fakePackage({
        id: 'sub-only',
        // no routing → not routable
      }),
      fakePackage({
        id: 'late',
        routing: {
          order: 30,
          signals: [],
          reasonForMatch: () => 'late',
        },
      }),
      fakePackage({
        id: 'early',
        routing: {
          order: 10,
          signals: [],
          reasonForMatch: () => 'early',
        },
      }),
      fakePackage({
        id: 'middle',
        routing: {
          order: 20,
          signals: [],
          reasonForMatch: () => 'middle',
        },
      }),
    ];
    const routables = buildRoutablePackages(packages);
    expect(routables.map((r) => r.pkg.id)).toEqual(['early', 'middle', 'late']);
  });

  it('throws when no routable package is marked isDefault', () => {
    const routables = buildRoutablePackages([
      fakePackage({
        id: 'a',
        routing: {
          order: 10,
          signals: [],
          reasonForMatch: () => 'a',
        },
      }),
    ]);
    expect(() => findDefaultRoutablePackage(routables)).toThrow(
      /no workflow package marked isDefault/,
    );
  });

  it('throws when more than one routable package is marked isDefault', () => {
    const routables = buildRoutablePackages([
      fakePackage({
        id: 'a',
        routing: {
          order: 10,
          signals: [],
          reasonForMatch: () => 'a',
          isDefault: true,
          defaultReason: 'a default',
        },
      }),
      fakePackage({
        id: 'b',
        routing: {
          order: 20,
          signals: [],
          reasonForMatch: () => 'b',
          isDefault: true,
          defaultReason: 'b default',
        },
      }),
    ]);
    expect(() => findDefaultRoutablePackage(routables)).toThrow(
      /more than one default workflow package: a, b/,
    );
  });

  it('returns the unique default package when exactly one is marked isDefault', () => {
    const routables = buildRoutablePackages([
      fakePackage({
        id: 'normal',
        routing: { order: 10, signals: [], reasonForMatch: () => 'normal' },
      }),
      fakePackage({
        id: 'fallback',
        routing: {
          order: 99,
          signals: [],
          reasonForMatch: () => 'fallback',
          isDefault: true,
          defaultReason: 'fell through',
        },
      }),
    ]);
    const def = findDefaultRoutablePackage(routables);
    expect(def.pkg.id).toBe('fallback');
  });
});

describe('catalog-derivations: real catalog invariants', () => {
  // These run against the actual src/workflows/catalog.ts so the
  // behavioral guarantees apply to the live engine state, not just
  // synthetic fixtures.
  it('the live catalog has exactly one isDefault routable package', async () => {
    const { workflowPackages } = await import('../../src/workflows/catalog.js');
    const routables = buildRoutablePackages(workflowPackages);
    const defaults = routables.filter((r) => r.routing.isDefault === true);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.pkg.id).toBe('explore');
  });

  it('the live catalog has no duplicate workflow ids', async () => {
    const { workflowPackages } = await import('../../src/workflows/catalog.js');
    const ids = workflowPackages.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the live catalog has no duplicate dispatch artifact schema names', async () => {
    const { workflowPackages } = await import('../../src/workflows/catalog.js');
    // buildArtifactSchemaRegistry would throw if there were duplicates.
    // This is a smoke that the live state hasn't drifted into a broken
    // shape.
    expect(() => buildArtifactSchemaRegistry(workflowPackages, {})).not.toThrow();
  });

  it('every catalog writer resolves through its registry by resultSchemaName', async () => {
    // Phase 4 audit gap: the architecture-boundary test is purely
    // static. This is the runtime parity check — for every writer
    // declared on a WorkflowPackage, the live registry's find function
    // returns exactly that builder. Catches: a writer accidentally
    // dropped from a registry-build path; a registry that returns a
    // different instance (identity matters because the runner uses
    // builder methods directly).
    const { workflowPackages } = await import('../../src/workflows/catalog.js');

    // Floor: at least 6 packages and at least one writer overall, so
    // the for-loop body must execute. Without this the test would
    // pass vacuously against an emptied catalog or empty writer arrays.
    expect(workflowPackages.length).toBeGreaterThanOrEqual(6);
    const totalWriters = workflowPackages.reduce(
      (n, pkg) =>
        n +
        pkg.writers.synthesis.length +
        pkg.writers.close.length +
        pkg.writers.verification.length +
        pkg.writers.checkpoint.length,
      0,
    );
    expect(totalWriters).toBeGreaterThan(0);
    const { findSynthesisBuilder } = await import(
      '../../src/runtime/registries/synthesis-writers/registry.js'
    );
    const { findCloseBuilder } = await import(
      '../../src/runtime/registries/close-writers/registry.js'
    );
    const { findVerificationWriter } = await import(
      '../../src/runtime/registries/verification-writers/registry.js'
    );
    const { findCheckpointBriefBuilder } = await import(
      '../../src/runtime/registries/checkpoint-writers/registry.js'
    );

    for (const pkg of workflowPackages) {
      for (const builder of pkg.writers.synthesis) {
        expect(
          findSynthesisBuilder(builder.resultSchemaName),
          `synthesis builder for ${builder.resultSchemaName} (workflow ${pkg.id}) does not resolve`,
        ).toBe(builder);
      }
      for (const builder of pkg.writers.close) {
        expect(
          findCloseBuilder(builder.resultSchemaName),
          `close builder for ${builder.resultSchemaName} (workflow ${pkg.id}) does not resolve`,
        ).toBe(builder);
      }
      for (const builder of pkg.writers.verification) {
        expect(
          findVerificationWriter(builder.resultSchemaName),
          `verification builder for ${builder.resultSchemaName} (workflow ${pkg.id}) does not resolve`,
        ).toBe(builder);
      }
      for (const builder of pkg.writers.checkpoint) {
        expect(
          findCheckpointBriefBuilder(builder.resultSchemaName),
          `checkpoint builder for ${builder.resultSchemaName} (workflow ${pkg.id}) does not resolve`,
        ).toBe(builder);
      }
    }
  });
});
