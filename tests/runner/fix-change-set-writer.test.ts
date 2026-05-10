// Unit tests for the fix.change-set@v1 writer's buildResult logic.
//
// loadCommands just emits the two git commands the runtime will spawn; the
// runtime's spawnSync loop is not interesting to retest here. What matters
// is that buildResult correctly:
//   - subtracts pre-fix dirty paths from the post-fix porcelain so observed
//     reflects only what the fix touched
//   - flags undeclared extras and missing declared files with status 'fail'
//     and a clear reason
//   - flags HEAD divergence as fail even when sets happen to align
//   - handles renames (`A -> B` porcelain entries) by treating B as the
//     observed path
//   - handles quoted porcelain paths

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { fixCompiledFlowPackage } from '../../src/flows/fix/index.js';
import type { FixBaselineSnapshot, FixChange, FixChangeSet } from '../../src/flows/fix/reports.js';
import type {
  VerificationBuildContext,
  VerificationBuilder,
  VerificationCommand,
  VerificationCommandObservation,
} from '../../src/flows/registries/verification-writers/types.js';
import type { CompiledFlow } from '../../src/schemas/compiled-flow.js';

function requireFixChangeSetWriter(): VerificationBuilder {
  const writer = fixCompiledFlowPackage.writers.verification.find(
    (w) => w.resultSchemaName === 'fix.change-set@v1',
  );
  if (writer === undefined) {
    throw new Error('fix.change-set@v1 verification writer is not registered');
  }
  return writer;
}

const fixChangeSetWriter = requireFixChangeSetWriter();

const tempRoots: string[] = [];

function tempRunFolder(): string {
  const root = mkdtempSync(join(tmpdir(), 'fix-change-set-writer-'));
  tempRoots.push(root);
  return root;
}

function writeJson(runFolder: string, relPath: string, body: unknown): void {
  const fullPath = join(runFolder, relPath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
}

function makeFixture(options: {
  baseline: FixBaselineSnapshot;
  change: FixChange;
}): { runFolder: string; context: VerificationBuildContext } {
  const runFolder = tempRunFolder();
  writeJson(runFolder, 'reports/fix/baseline-snapshot.json', options.baseline);
  writeJson(runFolder, 'reports/fix/change.json', options.change);
  // Minimal CompiledFlow stub: only the `steps` lookup that
  // reportPathForSchemaInCompiledFlow uses needs to resolve. The lookup
  // walks step.writes.report to find the path for a given schema, so a tiny
  // hand-built flow is enough.
  const flow = {
    steps: [
      {
        id: 'fix-baseline-snapshot',
        kind: 'verification',
        writes: {
          report: {
            schema: 'fix.baseline-snapshot@v1',
            path: 'reports/fix/baseline-snapshot.json',
          },
        },
      },
      {
        id: 'fix-act',
        kind: 'relay',
        writes: {
          report: {
            schema: 'fix.change@v1',
            path: 'reports/fix/change.json',
          },
        },
      },
      {
        id: 'fix-change-set',
        kind: 'verification',
        writes: {
          report: {
            schema: 'fix.change-set@v1',
            path: 'reports/fix/change-set.json',
          },
        },
      },
    ],
  } as unknown as CompiledFlow;
  const step = {
    id: 'fix-change-set',
    kind: 'verification',
    reads: ['reports/fix/baseline-snapshot.json', 'reports/fix/change.json'],
    writes: {
      report: { schema: 'fix.change-set@v1', path: 'reports/fix/change-set.json' },
    },
  } as unknown as VerificationBuildContext['step'];
  return { runFolder, context: { runFolder, flow, step } };
}

function gitObservation(
  command: VerificationCommand,
  stdout: string,
): VerificationCommandObservation {
  return {
    command,
    exit_code: 0,
    status: 'passed',
    duration_ms: 1,
    stdout_summary: stdout,
    stderr_summary: '',
  };
}

function loadCommandsForContext(context: VerificationBuildContext): readonly VerificationCommand[] {
  return fixChangeSetWriter.loadCommands(context);
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const HEAD_BEFORE = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const HEAD_AFTER_SAME = HEAD_BEFORE;
const HEAD_AFTER_MOVED = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

describe('fixChangeSetWriter.loadCommands', () => {
  it('emits the two git commands the runtime needs', () => {
    const { context } = makeFixture({
      baseline: { overall_status: 'passed', head_sha: HEAD_BEFORE, working_tree_porcelain: [] },
      change: {
        verdict: 'accept',
        summary: 'noop',
        diagnosis_ref: 'fix.diagnosis@v1',
        changed_files: ['src/a.ts'],
        evidence: ['noop'],
      },
    });
    const commands = loadCommandsForContext(context);
    expect(commands.map((c) => c.argv)).toEqual([
      ['git', 'rev-parse', 'HEAD'],
      ['git', 'status', '--porcelain'],
    ]);
  });

  it('rejects schematics that do not declare reads on the required inputs', () => {
    const { context } = makeFixture({
      baseline: { overall_status: 'passed', head_sha: HEAD_BEFORE, working_tree_porcelain: [] },
      change: {
        verdict: 'accept',
        summary: 'noop',
        diagnosis_ref: 'fix.diagnosis@v1',
        changed_files: ['src/a.ts'],
        evidence: ['noop'],
      },
    });
    const stepWithoutReads = {
      ...context.step,
      reads: [],
    } as VerificationBuildContext['step'];
    expect(() => fixChangeSetWriter.loadCommands({ ...context, step: stepWithoutReads })).toThrow(
      /requires step .* to read/,
    );
  });
});

describe('fixChangeSetWriter.buildResult', () => {
  it('returns pass when declared exactly matches observed', () => {
    const { context } = makeFixture({
      baseline: { overall_status: 'passed', head_sha: HEAD_BEFORE, working_tree_porcelain: [] },
      change: {
        verdict: 'accept',
        summary: 'pass case',
        diagnosis_ref: 'fix.diagnosis@v1',
        changed_files: ['src/a.ts'],
        evidence: ['ok'],
      },
    });
    const [revParse, status] = loadCommandsForContext(context);
    const result = fixChangeSetWriter.buildResult(
      [
        gitObservation(revParse as VerificationCommand, `${HEAD_AFTER_SAME}\n`),
        gitObservation(status as VerificationCommand, ' M src/a.ts\n'),
      ],
      context,
    ) as FixChangeSet;
    expect(result.status).toBe('pass');
    expect(result.observed).toEqual(['src/a.ts']);
    expect(result.undeclared_extras).toEqual([]);
    expect(result.missing_declared).toEqual([]);
  });

  it('flags undeclared extras as fail', () => {
    const { context } = makeFixture({
      baseline: { overall_status: 'passed', head_sha: HEAD_BEFORE, working_tree_porcelain: [] },
      change: {
        verdict: 'accept',
        summary: 'lying about scope',
        diagnosis_ref: 'fix.diagnosis@v1',
        changed_files: ['src/a.ts'],
        evidence: ['ok'],
      },
    });
    const [revParse, status] = loadCommandsForContext(context);
    const result = fixChangeSetWriter.buildResult(
      [
        gitObservation(revParse as VerificationCommand, `${HEAD_AFTER_SAME}\n`),
        gitObservation(status as VerificationCommand, ' M src/a.ts\n M src/extra.ts\n'),
      ],
      context,
    ) as FixChangeSet;
    expect(result.status).toBe('fail');
    expect(result.undeclared_extras).toEqual(['src/extra.ts']);
    expect(result.missing_declared).toEqual([]);
    expect(result.reason).toMatch(/undeclared extras: src\/extra\.ts/);
  });

  it('flags missing declared as fail', () => {
    const { context } = makeFixture({
      baseline: { overall_status: 'passed', head_sha: HEAD_BEFORE, working_tree_porcelain: [] },
      change: {
        verdict: 'accept',
        summary: 'declared but never edited',
        diagnosis_ref: 'fix.diagnosis@v1',
        changed_files: ['src/a.ts', 'src/b.ts'],
        evidence: ['ok'],
      },
    });
    const [revParse, status] = loadCommandsForContext(context);
    const result = fixChangeSetWriter.buildResult(
      [
        gitObservation(revParse as VerificationCommand, `${HEAD_AFTER_SAME}\n`),
        gitObservation(status as VerificationCommand, ' M src/a.ts\n'),
      ],
      context,
    ) as FixChangeSet;
    expect(result.status).toBe('fail');
    expect(result.missing_declared).toEqual(['src/b.ts']);
    expect(result.reason).toMatch(/missing declared: src\/b\.ts/);
  });

  it('subtracts pre-fix dirty paths from observed', () => {
    // The user already had src/preexisting.ts dirty before the fix started.
    // The fix touched src/a.ts. The change-set should NOT count
    // src/preexisting.ts as part of the fix — it belongs to the baseline.
    const { context } = makeFixture({
      baseline: {
        overall_status: 'passed',
        head_sha: HEAD_BEFORE,
        working_tree_porcelain: [' M src/preexisting.ts'],
      },
      change: {
        verdict: 'accept',
        summary: 'pass when pre-existing dirt is subtracted',
        diagnosis_ref: 'fix.diagnosis@v1',
        changed_files: ['src/a.ts'],
        evidence: ['ok'],
      },
    });
    const [revParse, status] = loadCommandsForContext(context);
    const result = fixChangeSetWriter.buildResult(
      [
        gitObservation(revParse as VerificationCommand, `${HEAD_AFTER_SAME}\n`),
        gitObservation(status as VerificationCommand, ' M src/preexisting.ts\n M src/a.ts\n'),
      ],
      context,
    ) as FixChangeSet;
    expect(result.status).toBe('pass');
    expect(result.observed).toEqual(['src/a.ts']);
  });

  it('flags HEAD divergence as fail even when set differences are clean', () => {
    const { context } = makeFixture({
      baseline: { overall_status: 'passed', head_sha: HEAD_BEFORE, working_tree_porcelain: [] },
      change: {
        verdict: 'accept',
        summary: 'committed mid-run',
        diagnosis_ref: 'fix.diagnosis@v1',
        // Empty declared so set-equality alone would be clean if observed is also empty;
        // we still want the writer to fail on HEAD movement.
        changed_files: ['src/a.ts'],
        evidence: ['ok'],
      },
    });
    const [revParse, status] = loadCommandsForContext(context);
    // Working tree is clean post-commit, so observed will be empty. Declared
    // has src/a.ts, so missing_declared would already drive a fail — to
    // isolate the HEAD-divergence path we check the reason explicitly.
    const result = fixChangeSetWriter.buildResult(
      [
        gitObservation(revParse as VerificationCommand, `${HEAD_AFTER_MOVED}\n`),
        gitObservation(status as VerificationCommand, ''),
      ],
      context,
    ) as FixChangeSet;
    expect(result.status).toBe('fail');
    expect(result.reason).toMatch(/HEAD moved during the fix run/);
    expect(result.baseline_head_sha).toBe(HEAD_BEFORE);
    expect(result.head_sha).toBe(HEAD_AFTER_MOVED);
  });

  it('handles rename porcelain entries by taking the destination path', () => {
    const { context } = makeFixture({
      baseline: { overall_status: 'passed', head_sha: HEAD_BEFORE, working_tree_porcelain: [] },
      change: {
        verdict: 'accept',
        summary: 'rename declared as the new path',
        diagnosis_ref: 'fix.diagnosis@v1',
        changed_files: ['src/new.ts'],
        evidence: ['ok'],
      },
    });
    const [revParse, status] = loadCommandsForContext(context);
    const result = fixChangeSetWriter.buildResult(
      [
        gitObservation(revParse as VerificationCommand, `${HEAD_AFTER_SAME}\n`),
        gitObservation(status as VerificationCommand, 'R  src/old.ts -> src/new.ts\n'),
      ],
      context,
    ) as FixChangeSet;
    expect(result.observed).toEqual(['src/new.ts']);
    expect(result.status).toBe('pass');
  });

  it('strips quoting from porcelain paths', () => {
    const { context } = makeFixture({
      baseline: { overall_status: 'passed', head_sha: HEAD_BEFORE, working_tree_porcelain: [] },
      change: {
        verdict: 'accept',
        summary: 'path with spaces declared',
        diagnosis_ref: 'fix.diagnosis@v1',
        changed_files: ['src/has space.ts'],
        evidence: ['ok'],
      },
    });
    const [revParse, status] = loadCommandsForContext(context);
    const result = fixChangeSetWriter.buildResult(
      [
        gitObservation(revParse as VerificationCommand, `${HEAD_AFTER_SAME}\n`),
        gitObservation(status as VerificationCommand, ' M "src/has space.ts"\n'),
      ],
      context,
    ) as FixChangeSet;
    expect(result.observed).toEqual(['src/has space.ts']);
    expect(result.status).toBe('pass');
  });
});
