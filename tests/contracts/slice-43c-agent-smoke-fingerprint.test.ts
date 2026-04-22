import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  AGENT_ADAPTER_SOURCE_PATHS,
  checkAgentSmokeFingerprint,
  computeAgentAdapterSourceSha256,
} from '../../scripts/audit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

// Slice 43c (P2.5 CC#P2-1 + CC#P2-2) — contract tests for
// scripts/audit.mjs Check 30 `checkAgentSmokeFingerprint`. The check
// binds ADR-0007 CC#P2-2 CI-skip semantics at the audit surface: when
// tests/fixtures/agent-smoke/last-run.json exists, its commit_sha must
// resolve in-repo and be an ancestor of HEAD; missing file is yellow
// (acceptable until Phase 2 close); malformed JSON or non-ancestor SHA
// is red.

function withTempRepo(fn: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'circuit-next-43c-fingerprint-'));
  try {
    execSync('git init -q', { cwd: root, stdio: 'ignore' });
    execSync('git config user.email test@example.com', { cwd: root, stdio: 'ignore' });
    execSync('git config user.name test', { cwd: root, stdio: 'ignore' });
    execSync('git commit -q --allow-empty -m "root"', { cwd: root, stdio: 'ignore' });
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeFingerprint(root: string, body: unknown) {
  const abs = join(root, 'tests/fixtures/agent-smoke/last-run.json');
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, typeof body === 'string' ? body : JSON.stringify(body));
}

describe('Check 30 — AGENT_SMOKE fingerprint commit-ancestor (Slice 43c / ADR-0007 CC#P2-2)', () => {
  it('yellow when the live-repo fingerprint file is absent OR points to an ancestor (initial landing: yellow → green after AGENT_SMOKE run)', () => {
    const result = checkAgentSmokeFingerprint(REPO_ROOT);
    // On the live repo at slice-43c landing, the fingerprint either does
    // not yet exist (yellow) or was produced in-slice with commit_sha
    // matching an ancestor of HEAD (green). Both are valid terminal
    // states; red would be invalid.
    expect(['yellow', 'green']).toContain(result.level);
  });

  it('yellow when the fingerprint file is absent (ADR-0007 CC#P2-2 CI-skip semantics)', () => {
    withTempRepo((root) => {
      const result = checkAgentSmokeFingerprint(root);
      expect(result.level).toBe('yellow');
      expect(result.detail).toMatch(/absent/);
    });
  });

  it('red when the fingerprint is malformed JSON', () => {
    withTempRepo((root) => {
      writeFingerprint(root, '{ not valid json');
      const result = checkAgentSmokeFingerprint(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/not valid JSON/);
    });
  });

  it('red when the fingerprint is JSON but not an object (array, string, number, null)', () => {
    withTempRepo((root) => {
      writeFingerprint(root, ['not', 'an', 'object']);
      const result = checkAgentSmokeFingerprint(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/not a JSON object/);
    });
  });

  it('red when commit_sha is missing', () => {
    withTempRepo((root) => {
      writeFingerprint(root, {
        schema_version: 1,
        result_sha256: 'a'.repeat(64),
      });
      const result = checkAgentSmokeFingerprint(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/commit_sha/);
    });
  });

  it('red when commit_sha is not a valid git SHA format', () => {
    withTempRepo((root) => {
      writeFingerprint(root, {
        schema_version: 1,
        commit_sha: 'not-a-sha',
        result_sha256: 'a'.repeat(64),
      });
      const result = checkAgentSmokeFingerprint(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/not a valid git SHA/);
    });
  });

  it('red when result_sha256 is missing or malformed', () => {
    withTempRepo((root) => {
      const headSha = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
      writeFingerprint(root, {
        schema_version: 1,
        commit_sha: headSha,
        result_sha256: 'not-a-hash',
      });
      const result = checkAgentSmokeFingerprint(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/result_sha256/);
    });
  });

  it('red when commit_sha does not resolve in the repository', () => {
    withTempRepo((root) => {
      writeFingerprint(root, {
        schema_version: 1,
        commit_sha: '0'.repeat(40),
        result_sha256: 'a'.repeat(64),
      });
      const result = checkAgentSmokeFingerprint(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/does not resolve/);
    });
  });

  it('red when commit_sha is a valid commit but not an ancestor of HEAD', () => {
    withTempRepo((root) => {
      // Create an orphan commit on a separate branch so it exists as a
      // resolvable commit but is NOT an ancestor of HEAD.
      execSync('git checkout -q --orphan orphan', { cwd: root, stdio: 'ignore' });
      execSync('git commit -q --allow-empty -m "orphan"', { cwd: root, stdio: 'ignore' });
      const orphanSha = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
      execSync('git checkout -q master 2>/dev/null || git checkout -q main', {
        cwd: root,
        stdio: 'ignore',
      });
      writeFingerprint(root, {
        schema_version: 1,
        commit_sha: orphanSha,
        result_sha256: 'a'.repeat(64),
      });
      const result = checkAgentSmokeFingerprint(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/not an ancestor of HEAD/);
    });
  });

  it('green when commit_sha resolves and is an ancestor of HEAD + result_sha256 is well-formed', () => {
    withTempRepo((root) => {
      const headSha = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
      writeFingerprint(root, {
        schema_version: 1,
        commit_sha: headSha,
        result_sha256: 'a'.repeat(64),
      });
      const result = checkAgentSmokeFingerprint(root);
      expect(result.level).toBe('green');
      expect(result.detail).toContain(headSha.slice(0, 12));
    });
  });
});

// Slice 47a (Codex HIGH 4 fold-in) — schema_version 2 promotion +
// adapter-surface drift detection. Symmetric with the Check 32
// (codex) drift check that landed in Slice 45 HIGH 4 fold-in. The
// drift check fires only when the live agent fingerprint path is
// being checked AND when the adapter source files actually exist
// under the root (synthetic temp repos without scaffolded sources
// keep exercising base behavior).
function scaffoldAdapterSources(root: string) {
  for (const rel of AGENT_ADAPTER_SOURCE_PATHS) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, `// scaffold: ${rel}\n`);
  }
}

describe('Check 30 — AGENT_SMOKE schema_version 2 + drift detection (Slice 47a / Codex HIGH 4)', () => {
  it('yellow when fingerprint is schema_version 1 but adapter sources are present (stale-schema signal)', () => {
    withTempRepo((root) => {
      scaffoldAdapterSources(root);
      const headSha = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
      writeFingerprint(root, {
        schema_version: 1,
        commit_sha: headSha,
        result_sha256: 'a'.repeat(64),
      });
      const result = checkAgentSmokeFingerprint(root);
      expect(result.level).toBe('yellow');
      expect(result.detail).toMatch(/schema_version 1 is stale/);
      expect(result.detail).toMatch(/AGENT_SMOKE=1 UPDATE_AGENT_FINGERPRINT=1/);
    });
  });

  it('yellow when fingerprint is schema_version 2 but adapter_source_sha256 is missing', () => {
    withTempRepo((root) => {
      scaffoldAdapterSources(root);
      const headSha = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
      writeFingerprint(root, {
        schema_version: 2,
        commit_sha: headSha,
        result_sha256: 'a'.repeat(64),
        // adapter_source_sha256 absent
        cli_version: 'claude 2.1.117',
      });
      const result = checkAgentSmokeFingerprint(root);
      expect(result.level).toBe('yellow');
      expect(result.detail).toMatch(/missing or malformed 'adapter_source_sha256'/);
    });
  });

  it('yellow when adapter_source_sha256 mismatches the current adapter surface (drift)', () => {
    withTempRepo((root) => {
      scaffoldAdapterSources(root);
      const headSha = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
      writeFingerprint(root, {
        schema_version: 2,
        commit_sha: headSha,
        result_sha256: 'a'.repeat(64),
        adapter_source_sha256: 'b'.repeat(64), // wrong on purpose
        cli_version: 'claude 2.1.117',
      });
      const result = checkAgentSmokeFingerprint(root);
      expect(result.level).toBe('yellow');
      expect(result.detail).toMatch(/adapter_source_sha256 mismatch/);
      expect(result.detail).toMatch(/agent adapter surface has changed/);
    });
  });

  it('green when adapter_source_sha256 matches the current adapter surface', () => {
    withTempRepo((root) => {
      scaffoldAdapterSources(root);
      const headSha = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
      const currentSha = computeAgentAdapterSourceSha256(root);
      writeFingerprint(root, {
        schema_version: 2,
        commit_sha: headSha,
        result_sha256: 'a'.repeat(64),
        adapter_source_sha256: currentSha,
        cli_version: 'claude 2.1.117',
      });
      const result = checkAgentSmokeFingerprint(root);
      expect(result.level).toBe('green');
      expect(result.detail).toContain('matches current surface');
      expect(result.detail).toContain('cli_version=claude 2.1.117');
    });
  });

  // Slice 47a Codex challenger HIGH 2 fold-in — cli_version is
  // load-bearing on a v2 fingerprint. Empty / missing / sentinel
  // values are rejected yellow with a precise remediation message.
  it('yellow when schema_version 2 fingerprint has missing cli_version', () => {
    withTempRepo((root) => {
      scaffoldAdapterSources(root);
      const headSha = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
      const currentSha = computeAgentAdapterSourceSha256(root);
      writeFingerprint(root, {
        schema_version: 2,
        commit_sha: headSha,
        result_sha256: 'a'.repeat(64),
        adapter_source_sha256: currentSha,
        // cli_version absent
      });
      const result = checkAgentSmokeFingerprint(root);
      expect(result.level).toBe('yellow');
      expect(result.detail).toMatch(/missing or empty 'cli_version'/);
    });
  });

  it('yellow when schema_version 2 fingerprint has empty cli_version', () => {
    withTempRepo((root) => {
      scaffoldAdapterSources(root);
      const headSha = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
      const currentSha = computeAgentAdapterSourceSha256(root);
      writeFingerprint(root, {
        schema_version: 2,
        commit_sha: headSha,
        result_sha256: 'a'.repeat(64),
        adapter_source_sha256: currentSha,
        cli_version: '',
      });
      const result = checkAgentSmokeFingerprint(root);
      expect(result.level).toBe('yellow');
      expect(result.detail).toMatch(/missing or empty 'cli_version'/);
    });
  });

  it('yellow when schema_version 2 fingerprint has unknown-sentinel cli_version', () => {
    withTempRepo((root) => {
      scaffoldAdapterSources(root);
      const headSha = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
      const currentSha = computeAgentAdapterSourceSha256(root);
      writeFingerprint(root, {
        schema_version: 2,
        commit_sha: headSha,
        result_sha256: 'a'.repeat(64),
        adapter_source_sha256: currentSha,
        cli_version: 'claude (unknown)',
      });
      const result = checkAgentSmokeFingerprint(root);
      expect(result.level).toBe('yellow');
      expect(result.detail).toMatch(/unknown-sentinel pattern/);
    });
  });

  it('AGENT_ADAPTER_SOURCE_PATHS includes the four adapter-surface files Codex HIGH 4 named', () => {
    expect(AGENT_ADAPTER_SOURCE_PATHS).toEqual([
      'src/runtime/adapters/agent.ts',
      'src/runtime/adapters/shared.ts',
      'src/runtime/adapters/dispatch-materializer.ts',
      'src/runtime/runner.ts',
    ]);
  });

  it('computeAgentAdapterSourceSha256 produces a stable 64-char lowercase hex', () => {
    const sha = computeAgentAdapterSourceSha256();
    expect(sha).toMatch(/^[0-9a-f]{64}$/);
    // Idempotent — same inputs, same output.
    expect(computeAgentAdapterSourceSha256()).toBe(sha);
  });

  // Slice 47a Codex challenger HIGH 3 fold-in — CODEX_ADAPTER_SOURCE_PATHS
  // is symmetric with AGENT_ADAPTER_SOURCE_PATHS w.r.t. the runner
  // surface. Slice 47a's runner-side selection/provenance derivation
  // participates in BOTH adapters' transcripts via the
  // materializeDispatch call site; excluding `runner.ts` from the
  // CODEX list would let a runner edit silently invalidate the codex
  // fingerprint without tripping drift, while the same edit trips the
  // agent one.
  it('CODEX_ADAPTER_SOURCE_PATHS includes runner.ts for symmetry with AGENT (HIGH 3 fold-in)', async () => {
    const mod = await import('../../scripts/audit.mjs');
    expect(mod.CODEX_ADAPTER_SOURCE_PATHS).toContain('src/runtime/runner.ts');
    // Pin the full set so a future trim of the path list trips this test.
    expect(mod.CODEX_ADAPTER_SOURCE_PATHS).toEqual([
      'src/runtime/adapters/codex.ts',
      'src/runtime/adapters/shared.ts',
      'src/runtime/adapters/dispatch-materializer.ts',
      'src/runtime/runner.ts',
    ]);
  });
});
