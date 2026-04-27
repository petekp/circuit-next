// Pure derivation helpers that turn workflow packages into engine
// registries. Each registry file delegates to one of these so the
// derivation logic (with its duplicate-detection and default-package
// invariants) is testable in isolation against synthetic packages.

import type { z } from 'zod';
import type { WorkflowPackage, WorkflowRoutingMetadata } from '../workflows/types.js';
import type { CheckpointBriefBuilder } from './checkpoint-writers/types.js';
import type { CloseBuilder } from './close-writers/types.js';
import type { StructuralShapeHint } from './shape-hints/types.js';
import type { SynthesisBuilder } from './synthesis-writers/types.js';
import type { VerificationBuilder } from './verification-writers/types.js';

// Build a Map keyed by builder.resultSchemaName from one writer slot
// across all packages. Throws on duplicate keys with a message that
// names both the slot and the offending workflow id.
function buildBuilderRegistry<B extends { readonly resultSchemaName: string }>(
  packages: readonly WorkflowPackage[],
  slot: 'synthesis' | 'close' | 'verification' | 'checkpoint',
  pluck: (pkg: WorkflowPackage) => readonly B[],
): ReadonlyMap<string, B> {
  const map = new Map<string, B>();
  for (const pkg of packages) {
    for (const builder of pluck(pkg)) {
      if (map.has(builder.resultSchemaName)) {
        throw new Error(
          `duplicate ${slot} builder registered for schema '${builder.resultSchemaName}' (workflow ${pkg.id})`,
        );
      }
      map.set(builder.resultSchemaName, builder);
    }
  }
  return map;
}

export function buildSynthesisRegistry(
  packages: readonly WorkflowPackage[],
): ReadonlyMap<string, SynthesisBuilder> {
  return buildBuilderRegistry(packages, 'synthesis', (pkg) => pkg.writers.synthesis);
}

export function buildCloseRegistry(
  packages: readonly WorkflowPackage[],
): ReadonlyMap<string, CloseBuilder> {
  return buildBuilderRegistry(packages, 'close', (pkg) => pkg.writers.close);
}

export function buildVerificationRegistry(
  packages: readonly WorkflowPackage[],
): ReadonlyMap<string, VerificationBuilder> {
  return buildBuilderRegistry(packages, 'verification', (pkg) => pkg.writers.verification);
}

export function buildCheckpointRegistry(
  packages: readonly WorkflowPackage[],
): ReadonlyMap<string, CheckpointBriefBuilder> {
  return buildBuilderRegistry(packages, 'checkpoint', (pkg) => pkg.writers.checkpoint);
}

// Compose the dispatch-artifact zod registry from the catalog plus an
// optional fixtures map (used by tests). Throws when a schema name
// collides between fixtures and packages, or across packages.
export function buildArtifactSchemaRegistry(
  packages: readonly WorkflowPackage[],
  fixtures: Readonly<Record<string, z.ZodType<unknown>>> = {},
): Readonly<Record<string, z.ZodType<unknown>>> {
  const out: Record<string, z.ZodType<unknown>> = { ...fixtures };
  for (const pkg of packages) {
    for (const artifact of pkg.dispatchArtifacts) {
      if (Object.hasOwn(out, artifact.schemaName)) {
        throw new Error(
          `duplicate dispatch artifact schema '${artifact.schemaName}' registered (workflow ${pkg.id})`,
        );
      }
      out[artifact.schemaName] = artifact.schema;
    }
  }
  return Object.freeze(out);
}

// Schema-keyed dispatch shape hints. Throws on duplicates so a hint
// authoring error fails loudly at registry construction.
export function buildSchemaHintMap(
  packages: readonly WorkflowPackage[],
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const pkg of packages) {
    for (const artifact of pkg.dispatchArtifacts) {
      if (artifact.dispatchHint === undefined) continue;
      if (map.has(artifact.schemaName)) {
        throw new Error(
          `duplicate shape hint registered for schema '${artifact.schemaName}' (workflow ${pkg.id})`,
        );
      }
      map.set(artifact.schemaName, artifact.dispatchHint);
    }
  }
  return map;
}

export function buildStructuralHintList(
  packages: readonly WorkflowPackage[],
): readonly StructuralShapeHint[] {
  const list: StructuralShapeHint[] = [];
  const seen = new Set<string>();
  for (const pkg of packages) {
    if (pkg.structuralHints === undefined) continue;
    for (const hint of pkg.structuralHints) {
      if (seen.has(hint.id)) {
        throw new Error(`duplicate structural shape hint id '${hint.id}' (workflow ${pkg.id})`);
      }
      seen.add(hint.id);
      list.push(hint);
    }
  }
  return list;
}

export interface RoutablePackage {
  readonly pkg: WorkflowPackage;
  readonly routing: WorkflowRoutingMetadata;
}

// Walk packages, keep the routable ones (those with a routing block),
// and sort by routing.order ascending. Stable sort: input order breaks
// ties.
export function buildRoutablePackages(
  packages: readonly WorkflowPackage[],
): readonly RoutablePackage[] {
  const out: RoutablePackage[] = [];
  for (const pkg of packages) {
    if (pkg.routing === undefined) continue;
    out.push({ pkg, routing: pkg.routing });
  }
  return out.sort((a, b) => a.routing.order - b.routing.order);
}

// Find the unique default package across the routable set. Throws if
// no package or more than one package is marked isDefault.
export function findDefaultRoutablePackage(routables: readonly RoutablePackage[]): RoutablePackage {
  const defaults = routables.filter((entry) => entry.routing.isDefault === true);
  const [first, ...rest] = defaults;
  if (first === undefined) {
    throw new Error('no workflow package marked isDefault — router has no fallback');
  }
  if (rest.length > 0) {
    throw new Error(
      `more than one default workflow package: ${defaults.map((entry) => entry.pkg.id).join(', ')}`,
    );
  }
  return first;
}
