#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const pluginRoot = resolve(repoRoot, 'plugins/circuit');

function parseArgs(argv) {
  const parsed = {
    check: false,
    marketplace: 'circuit-next-local',
    cachePath: undefined,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') {
      parsed.check = true;
    } else if (arg === '--marketplace') {
      parsed.marketplace = argv[++i];
    } else if (arg === '--cache-path') {
      parsed.cachePath = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/sync-codex-plugin-cache.mjs [--check] [--marketplace <name>] [--cache-path <path>]

Copies the repo-local Codex plugin package into Codex's local plugin cache.

Defaults:
  marketplace: circuit-next-local
  cache root:  $CODEX_HOME/plugins/cache or ~/.codex/plugins/cache

Options:
  --check       compare package bytes with the cache and exit non-zero on drift
  --cache-path  explicit target package path, useful for tests
`);
}

function readManifest() {
  const manifestPath = resolve(pluginRoot, '.codex-plugin/plugin.json');
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

function defaultCachePath(marketplace, manifest) {
  const codexHome = process.env.CODEX_HOME ?? resolve(homedir(), '.codex');
  return resolve(codexHome, 'plugins/cache', marketplace, manifest.name, manifest.version);
}

function assertSafePathSegment(value, label) {
  if (!/^[A-Za-z0-9._-]+$/.test(value) || value === '.' || value === '..') {
    throw new Error(`${label} must be a single safe path segment; got ${JSON.stringify(value)}`);
  }
}

function pathEndsWithSegments(path, suffix) {
  const parts = resolve(path)
    .split(/[\\/]+/)
    .filter(Boolean);
  if (parts.length < suffix.length) return false;
  return suffix.every((segment, index) => parts[parts.length - suffix.length + index] === segment);
}

function isPathInside(parent, child) {
  const rel = relative(parent, child);
  return rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel);
}

function assertSafeCacheTarget(target, args, manifest) {
  assertSafePathSegment(args.marketplace, 'marketplace');
  assertSafePathSegment(manifest.name, 'plugin name');
  assertSafePathSegment(manifest.version, 'plugin version');

  const expectedSuffix = ['plugins', 'cache', args.marketplace, manifest.name, manifest.version];
  if (!pathEndsWithSegments(target, expectedSuffix)) {
    throw new Error(
      `refusing to sync Codex plugin cache outside expected package path suffix: ${expectedSuffix.join('/')}`,
    );
  }

  if (args.cachePath === undefined) {
    const expectedDefault = defaultCachePath(args.marketplace, manifest);
    if (target !== expectedDefault) {
      throw new Error(`refusing to sync unexpected default cache target: ${target}`);
    }
    return;
  }

  const tempRoot = resolve(tmpdir());
  if (!isPathInside(tempRoot, target)) {
    throw new Error('refusing explicit --cache-path outside the system temp directory');
  }
}

function walkFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  const stack = [''];
  while (stack.length > 0) {
    const relDir = stack.pop();
    const absDir = resolve(root, relDir);
    for (const entry of readdirSync(absDir, { withFileTypes: true })) {
      const relPath = join(relDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(relPath);
      } else if (entry.isFile()) {
        files.push(relPath);
      }
    }
  }
  return files.sort();
}

function digestFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function treeDigest(root) {
  const files = walkFiles(root);
  return files.map((file) => `${file}\0${digestFile(resolve(root, file))}`).join('\n');
}

function treeStatus(source, target) {
  if (!existsSync(target)) return 'missing';
  if (!statSync(target).isDirectory()) return 'stale';
  return treeDigest(source) === treeDigest(target) ? 'ok' : 'stale';
}

function listDirs(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function summary(status, target) {
  return {
    status,
    source: pluginRoot,
    target,
    check_command: 'npm run check:codex-plugin-cache',
    local_sync_command: 'npm run sync:codex-plugin-cache',
    git_marketplace_refresh: 'codex plugin marketplace upgrade circuit-next-local',
    commands: walkCommandFiles(pluginRoot),
    skills: listDirs(resolve(pluginRoot, 'skills')),
  };
}

function walkCommandFiles(root) {
  return walkFiles(resolve(root, 'commands'))
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.replace(/\.md$/, ''))
    .sort();
}

try {
  const args = parseArgs(process.argv.slice(2));
  const manifest = readManifest();
  const target = args.cachePath
    ? resolve(args.cachePath)
    : defaultCachePath(args.marketplace, manifest);
  assertSafeCacheTarget(target, args, manifest);
  const beforeStatus = treeStatus(pluginRoot, target);

  if (args.check) {
    console.log(JSON.stringify(summary(beforeStatus, target), null, 2));
    process.exit(beforeStatus === 'ok' ? 0 : 1);
  }

  mkdirSync(dirname(target), { recursive: true });
  rmSync(target, { recursive: true, force: true });
  cpSync(pluginRoot, target, { recursive: true });
  console.log(JSON.stringify(summary('synced', target), null, 2));
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
}
