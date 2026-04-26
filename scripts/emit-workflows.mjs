// Build-time emit + CI drift check for compiled Workflow fixtures.
//
// Reads the active recipes under specs/workflow-recipes/, compiles each
// to a CompileResult via src/runtime/compile-recipe-to-workflow.ts
// (consumed here through dist/), and writes the JSON files under
// .claude-plugin/skills/<id>/. Then runs `biome format --write` on the
// emitted files so they match the surrounding formatting.
//
// File layout:
//   - kind:'single'   → .claude-plugin/skills/<id>/circuit.json
//                       (entry_modes carries the full recipe list)
//   - kind:'per-mode' → group compiled Workflows by graph identity
//                       (everything except entry_modes). The largest
//                       group goes to circuit.json with merged
//                       entry_modes; remaining modes get one file each
//                       at .claude-plugin/skills/<id>/<mode-name>.json.
//                       The CLI loader prefers <mode>.json when an entry
//                       mode is requested and falls back to circuit.json.
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
  },
  {
    id: 'explore',
    recipePath: 'specs/workflow-recipes/explore.recipe.json',
  },
  {
    id: 'review',
    recipePath: 'specs/workflow-recipes/review.recipe.json',
  },
  {
    id: 'fix',
    recipePath: 'specs/workflow-recipes/fix.recipe.json',
  },
];

async function loadCompilerModule() {
  // dist/runtime/compile-recipe-to-workflow.js is produced by `npm run build`.
  // The emit script depends on a fresh dist/, so callers should run `npm run
  // build` first (the verify pipeline does this in order).
  const distPath = resolve(projectRoot, 'dist/runtime/compile-recipe-to-workflow.js');
  try {
    return await import(distPath);
  } catch (err) {
    console.error(
      `\nCould not import compiler from dist/. Run \`npm run build\` first, then re-run this script.\n${err.message}\n`,
    );
    process.exit(1);
  }
}

async function loadRecipeSchemaModule() {
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

// Stable structural identity for grouping per-mode Workflows. Two compiled
// Workflows belong to the same group when their stringified form (with
// entry_modes stripped) is byte-identical. JSON.stringify is deterministic
// for our object construction order.
function graphIdentityHash(workflow) {
  const { entry_modes: _entryModes, ...rest } = workflow;
  return JSON.stringify(rest);
}

// Decide the per-recipe file plan: what to write, where, and with which
// entry_modes payload. Exposed so the emit and check paths share the
// same logic.
function planRecipeFiles(id, result) {
  if (result.kind === 'single') {
    return [
      {
        outRel: `.claude-plugin/skills/${id}/circuit.json`,
        workflow: result.workflow,
      },
    ];
  }
  // per-mode
  const groups = new Map(); // hash → { modes: string[], workflow }
  for (const [modeName, workflow] of result.workflows) {
    const hash = graphIdentityHash(workflow);
    const existing = groups.get(hash);
    if (existing === undefined) {
      groups.set(hash, { modes: [modeName], workflow });
    } else {
      existing.modes.push(modeName);
    }
  }
  // Sort by group size descending, then by first mode name for deterministic
  // tie-breaking.
  const ordered = [...groups.values()].sort((a, b) => {
    if (b.modes.length !== a.modes.length) return b.modes.length - a.modes.length;
    return a.modes[0].localeCompare(b.modes[0]);
  });
  const plan = [];
  // Largest group → circuit.json, with entry_modes spanning all modes in
  // that group. Read each mode's compiled entry_modes[0] from the original
  // result so per-mode rigor/description survive.
  const main = ordered[0];
  const mainEntryModes = main.modes.map((m) => result.workflows.get(m).entry_modes[0]);
  plan.push({
    outRel: `.claude-plugin/skills/${id}/circuit.json`,
    workflow: { ...main.workflow, entry_modes: mainEntryModes },
  });
  // Remaining groups → one file per mode in those groups, with single-mode
  // entry_modes (already shaped that way by the compiler).
  for (let i = 1; i < ordered.length; i++) {
    for (const modeName of ordered[i].modes) {
      const workflow = result.workflows.get(modeName);
      plan.push({
        outRel: `.claude-plugin/skills/${id}/${modeName}.json`,
        workflow,
      });
    }
  }
  return plan;
}

async function emitMode() {
  for (const entry of RECIPES) {
    const result = await compileOne(entry.recipePath);
    const plan = planRecipeFiles(entry.id, result);
    for (const { outRel, workflow } of plan) {
      const outAbs = resolve(projectRoot, outRel);
      mkdirSync(dirname(outAbs), { recursive: true });
      writeFileSync(outAbs, stringifyWorkflow(workflow));
      biomeFormatInPlace(outAbs);
      console.log(`emitted ${outRel}`);
    }
  }
}

async function checkMode() {
  const tmpDir = mkdtempSync(join(tmpdir(), 'workflow-drift-'));
  let drifted = false;
  try {
    for (const entry of RECIPES) {
      const result = await compileOne(entry.recipePath);
      const plan = planRecipeFiles(entry.id, result);
      for (const { outRel, workflow } of plan) {
        const tmpFile = join(tmpDir, outRel.replace(/[/]/g, '_'));
        writeFileSync(tmpFile, stringifyWorkflow(workflow));
        biomeFormatInPlace(tmpFile);
        const compiledBytes = readFileSync(tmpFile, 'utf8');
        const committedAbs = resolve(projectRoot, outRel);
        let committedBytes;
        try {
          committedBytes = readFileSync(committedAbs, 'utf8');
        } catch (_err) {
          console.error(
            `✗ ${outRel} is missing on disk but the recipe compiles to it. Run \`npm run emit-workflows\` to regenerate, then commit.`,
          );
          drifted = true;
          continue;
        }
        if (compiledBytes === committedBytes) {
          console.log(`✓ ${outRel} is in sync with ${entry.recipePath}`);
        } else {
          console.error(`✗ ${outRel} drifted from compiled output of ${entry.recipePath}`);
          console.error('  Run `npm run emit-workflows` to regenerate, then commit the diff.');
          drifted = true;
        }
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
