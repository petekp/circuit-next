import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import YAML from 'yaml';

export const projectRoot = resolve(new URL('../..', import.meta.url).pathname);

export function readText(relPath) {
  return readFileSync(resolve(projectRoot, relPath), 'utf8');
}

export function readJson(relPath) {
  return JSON.parse(readText(relPath));
}

export function readYaml(relPath) {
  return YAML.parse(readText(relPath));
}

export function loadYamlWithSchema(relPath, schema) {
  return schema.parse(readYaml(relPath));
}

export function loadJsonWithSchema(relPath, schema) {
  return schema.parse(readJson(relPath));
}

export function pathExists(relPath) {
  return existsSync(resolve(projectRoot, relPath));
}

export function listFiles(relDir, predicate = () => true) {
  const abs = resolve(projectRoot, relDir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((entry) => predicate(entry))
    .sort()
    .map((entry) => `${relDir}/${entry}`);
}

export function listMarkdownBasenames(relDir) {
  return listFiles(relDir, (entry) => entry.endsWith('.md')).map((file) =>
    file.slice(file.lastIndexOf('/') + 1, -'.md'.length),
  );
}

export function fileIsPresent(relPath) {
  try {
    return statSync(resolve(projectRoot, relPath)).isFile();
  } catch {
    return false;
  }
}

export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function formatWithBiome(relPath, content) {
  return execFileSync('npx', ['biome', 'format', '--stdin-file-path', relPath], {
    cwd: projectRoot,
    input: content,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

export function writeOrCheck(relPath, content, check) {
  const abs = resolve(projectRoot, relPath);
  if (check) {
    if (!existsSync(abs)) {
      throw new Error(`${relPath} is missing; run the matching emit command`);
    }
    const current = readFileSync(abs, 'utf8');
    if (current !== content) {
      throw new Error(`${relPath} drifted; run the matching emit command`);
    }
    console.log(`✓ ${relPath} is in sync`);
    return;
  }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  console.log(`emitted ${relPath}`);
}

export function formatMarkdown(content) {
  return `${content.replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

export async function loadReleaseSchemas() {
  return import(resolve(projectRoot, 'dist/release/schemas.js'));
}

export async function loadReleaseChecks() {
  return import(resolve(projectRoot, 'dist/release/checks.js'));
}

export async function loadCurrentCatalog() {
  return import(resolve(projectRoot, 'dist/flows/catalog.js'));
}

export async function loadRouter() {
  return import(resolve(projectRoot, 'dist/runtime/router.js'));
}

export async function loadConnectorSchemas() {
  return import(resolve(projectRoot, 'dist/schemas/connector.js'));
}

export function runBiomeFormat(relPath) {
  execFileSync('npx', ['biome', 'format', '--write', resolve(projectRoot, relPath)], {
    cwd: projectRoot,
    stdio: 'pipe',
  });
}
