// Build-time emit + CI drift check for compiled Workflow fixtures.
//
// Reads the active recipes under specs/workflow-recipes/, compiles each
// to a Workflow via src/runtime/compile-recipe-to-workflow.ts (consumed
// here through dist/), and writes the JSON to
// .claude-plugin/skills/<id>/circuit.json. Then runs `biome format --write`
// on the emitted files so they match the surrounding formatting.
//
// Modes:
//   node scripts/emit-workflows.mjs            → emit (write to disk)
//   node scripts/emit-workflows.mjs --check    → drift check (no write;
//                                                exit 1 if any output differs
//                                                from the committed file)
//
// Drift check pipeline mirrors emit exactly: compile → JSON.stringify(2) →
// biome format → compare bytes against committed file. Anything that makes
// emit output differ from committed bytes makes the check fail.

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const RECIPES = [
  {
    id: 'build',
    recipePath: 'specs/workflow-recipes/build.recipe.json',
    outPath: '.claude-plugin/skills/build/circuit.json',
  },
  {
    id: 'explore',
    recipePath: 'specs/workflow-recipes/explore.recipe.json',
    outPath: '.claude-plugin/skills/explore/circuit.json',
  },
  {
    id: 'review',
    recipePath: 'specs/workflow-recipes/review.recipe.json',
    outPath: '.claude-plugin/skills/review/circuit.json',
  },
];

function loadCompilerModule() {
  // dist/runtime/compile-recipe-to-workflow.js is produced by `npm run build`.
  // The emit script depends on a fresh dist/, so callers should run `npm run
  // build` first (the verify pipeline does this in order).
  const distPath = resolve(projectRoot, 'dist/runtime/compile-recipe-to-workflow.js');
  return import(distPath).catch((err) => {
    console.error(
      `\nCould not import compiler from dist/. Run \`npm run build\` first, then re-run this script.\n${err.message}\n`,
    );
    process.exit(1);
  });
}

function loadRecipeSchemaModule() {
  const distPath = resolve(projectRoot, 'dist/schemas/workflow-recipe.js');
  return import(distPath);
}

async function compileOne(recipePath) {
  const [{ compileRecipeToWorkflow }, { WorkflowRecipe }] = await Promise.all([
    loadCompilerModule(),
    loadRecipeSchemaModule(),
  ]);
  const raw = JSON.parse(readFileSync(resolve(projectRoot, recipePath), 'utf8'));
  const recipe = WorkflowRecipe.parse(raw);
  return compileRecipeToWorkflow(recipe);
}

function stringifyWorkflow(workflow) {
  return `${JSON.stringify(workflow, null, 2)}\n`;
}

function biomeFormatInPlace(absolutePath) {
  execFileSync('npx', ['biome', 'format', '--write', absolutePath], {
    cwd: projectRoot,
    stdio: 'pipe',
  });
}

async function emitMode() {
  for (const entry of RECIPES) {
    const workflow = await compileOne(entry.recipePath);
    const outAbs = resolve(projectRoot, entry.outPath);
    mkdirSync(dirname(outAbs), { recursive: true });
    writeFileSync(outAbs, stringifyWorkflow(workflow));
    biomeFormatInPlace(outAbs);
    console.log(`emitted ${entry.outPath}`);
  }
}

async function checkMode() {
  const tmpDir = mkdtempSync(join(tmpdir(), 'workflow-drift-'));
  let drifted = false;
  try {
    for (const entry of RECIPES) {
      const workflow = await compileOne(entry.recipePath);
      const tmpFile = join(tmpDir, `${entry.id}.json`);
      writeFileSync(tmpFile, stringifyWorkflow(workflow));
      biomeFormatInPlace(tmpFile);
      const compiledBytes = readFileSync(tmpFile, 'utf8');
      const committedBytes = readFileSync(resolve(projectRoot, entry.outPath), 'utf8');
      if (compiledBytes === committedBytes) {
        console.log(`✓ ${entry.outPath} is in sync with ${entry.recipePath}`);
      } else {
        console.error(`✗ ${entry.outPath} drifted from compiled output of ${entry.recipePath}`);
        console.error('  Run `npm run emit-workflows` to regenerate, then commit the diff.');
        drifted = true;
      }
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
  if (drifted) process.exit(1);
}

const isCheck = process.argv.includes('--check');
if (isCheck) {
  await checkMode();
} else {
  await emitMode();
}
