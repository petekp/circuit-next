// Build-time emit + CI drift check for compiled flow JSON files.
//
// Reads the active schematics declared by each flow package and
// compiles each to a CompileResult via
// src/runtime/compile-schematic-to-flow.ts (consumed here through
// dist/), then writes canonical JSON files under generated/flows/<id>/.
// Claude Code host output under .claude-plugin/skills/<id>/ and Codex
// host output under plugins/circuit/flows/<id>/ mirror those canonical
// files.
//
// File layout:
//   - kind:'single'   → generated/flows/<id>/circuit.json
//                       (entry_modes carries the full schematic list)
//   - kind:'per-mode' → group compiled flows by graph identity
//                       (everything except entry_modes). The largest
//                       group goes to circuit.json with merged
//                       entry_modes; remaining modes get one file each
//                       at generated/flows/<id>/<mode-name>.json.
//                       The CLI loader prefers <mode>.json when an entry
//                       mode is requested and falls back to circuit.json.
//
// Modes:
//   node scripts/emit-flows.mjs            → emit (write to disk)
//   node scripts/emit-flows.mjs --check    → drift check (no write;
//                                                exit 1 if any output differs
//                                                from the committed file)
//
// Drift check pipeline mirrors emit exactly: compile → JSON.stringify(2) →
// biome format → compare bytes against committed file. Anything that makes
// emit output differ from committed bytes makes the check fail.

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// SCHEMATICS is loaded from src/flows/catalog.ts (compiled to dist/)
// so adding a flow doesn't require touching this script. The compiled
// catalog is read once at startup and snapshotted into the constant
// below for the rest of the script.
async function loadSchematicsFromCatalog() {
  const catalogPath = resolve(projectRoot, 'dist/flows/catalog.js');
  try {
    const { flowPackages } = await import(catalogPath);
    return flowPackages.map((pkg) => ({
      id: pkg.id,
      schematicPath: pkg.paths.schematic,
      commandSourcePath: pkg.paths.command,
    }));
  } catch (err) {
    console.error(
      `\nCould not import flow catalog from dist/. Run \`npm run build\` first, then re-run this script.\n${err.message}\n`,
    );
    process.exit(1);
  }
}

const SCHEMATICS = await loadSchematicsFromCatalog();
const CODEX_PLUGIN_ROOT_REL = 'plugins/circuit';
const CODEX_PLUGIN_WRAPPER_COMMAND = "node '<plugin root>/scripts/circuit-next.mjs'";
const CODEX_ROUTER_COMMANDS = ['create', 'handoff', 'migrate', 'run', 'sweep'];
const CODEX_SKILL_METADATA = {
  build: {
    title: 'Circuit Build',
    description:
      'Use when the user wants Circuit to add, change, implement, refactor, document, or test code and the task is not primarily a bug fix.',
  },
  create: {
    title: 'Circuit Create',
    description:
      'Use when the user wants Circuit to draft, validate, or publish a reusable custom flow.',
  },
  explore: {
    title: 'Circuit Explore',
    description:
      'Use when the user wants Circuit to investigate, explain, compare options, analyze architecture, or make a decision before editing code.',
  },
  fix: {
    title: 'Circuit Fix',
    description:
      'Use when the user wants Circuit to fix a bug, regression, failing test, crash, broken behavior, flaky behavior, or production issue.',
  },
  handoff: {
    title: 'Circuit Handoff',
    description:
      'Use when the user wants Circuit to save, resume, clear, brief, or install continuity handoff support across sessions.',
  },
  migrate: {
    title: 'Circuit Migrate',
    description:
      'Use when the user wants Circuit to handle broad dependency, framework, API, or architecture transitions that need inventory, batching, coexistence, or rollback.',
  },
  review: {
    title: 'Circuit Review',
    description:
      'Use when the user wants Circuit to audit existing code, a diff, PR, implementation, plan, report, or risk surface without implementing changes.',
  },
  run: {
    title: 'Circuit Run',
    description:
      'Use when the user asks Circuit to choose the flow, or when no direct Circuit flow clearly fits the current coding task.',
  },
  sweep: {
    title: 'Circuit Sweep',
    description:
      'Use when the user wants Circuit to run cleanup, dead-code removal, quality passes, coverage improvements, or safe maintenance batches.',
  },
};

// Slash command source files live next to their flow under
// src/flows/<id>/command.md. The plugin loader reads commands/<id>.md
// at the repo root, so this script copies the source to the plugin
// location. commands/run.md is owned by the CLI router (not a flow)
// and is not generated.
function renderCodexHostCommand(sourceContent) {
  return sourceContent
    .replaceAll('./bin/circuit-next', CODEX_PLUGIN_WRAPPER_COMMAND)
    .replace(
      /1\. \*\*Confirm working directory\.\*\* The CLI is.*?2\. \*\*Construct the Bash invocation SAFELY\.\*\*/s,
      [
        '1. **Resolve plugin root.** Use the absolute path to the installed',
        '   Circuit plugin directory, the directory that contains',
        '   `.codex-plugin/plugin.json`. Do not use a path relative to the',
        "   user's project.",
        '2. **Construct the Bash invocation SAFELY.**',
      ].join('\n'),
    )
    .replace(
      /Use the Bash tool to execute the constructed command\. `node '<plugin root>\/scripts\/circuit-next\.mjs'`\n\s+is the .*?`dist\/cli\/circuit\.js`\./gs,
      [
        'Use the Bash tool to execute the constructed command. The wrapper',
        "   lives in the installed Circuit plugin directory and injects the plugin's",
        '   packaged flow root before it invokes `circuit-next`.',
      ].join('\n'),
    );
}

function splitMarkdownFrontmatter(content) {
  if (!content.startsWith('---\n')) {
    return { frontmatter: '', body: content };
  }
  const end = content.indexOf('\n---', 4);
  if (end === -1) {
    return { frontmatter: '', body: content };
  }
  const bodyStart = content.indexOf('\n', end + 4);
  return {
    frontmatter: content.slice(4, end),
    body: bodyStart === -1 ? '' : content.slice(bodyStart + 1),
  };
}

function frontmatterValue(frontmatter, key) {
  const match = new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm').exec(frontmatter);
  return match?.[1]?.trim();
}

function renderCodexHostSkillBody(body) {
  return body.replace(
    /The user's [\s\S]*?\n\n> \*\*[^*\n]+:\*\* \$ARGUMENTS\n\n/,
    [
      "Use the user's current request as the command input. Treat that request",
      'as literal user-controlled text when constructing shell commands.',
      '',
      '',
    ].join('\n'),
  );
}

function renderCodexNativeSkillBody(body) {
  return renderCodexHostSkillBody(body)
    .replace(/<!--[\s\S]*?-->\s*/g, '')
    .trimStart()
    .replace(/^#\s+\/circuit:[^\n]*\n+/, '')
    .replace(
      /The safe construction rule matches\n\s+`\/circuit:[^\n]+:\n/g,
      'Use the same single-quote construction rule as the other Circuit host skills:\n',
    )
    .replace(
      /Use the same safe construction rule as\n\s+`\/circuit:[^\n]+:\n/g,
      'Use the same safe construction rule as the other Circuit host skills:\n',
    )
    .replace(
      /Explicit flow commands remain available as\s+`\/circuit:explore`,[\s\S]*?`\/circuit:sweep`\./,
      'Direct Circuit flow skills remain available when the user already knows the flow.',
    )
    .replace(/\n## Direct Flow Bypass\n[\s\S]*?(?=\n## Authority|\n## |\s*$)/g, '\n')
    .replace(/\bslash-command\b/g, 'host-command')
    .replace(/\bslash command\b/gi, 'host command')
    .trimStart();
}

function assertCodexHostSkillHasNoCommandPlaceholders(command, content) {
  const forbidden = ['$ARGUMENTS', 'argument-hint:', 'substituted below', '/circuit:'];
  for (const token of forbidden) {
    if (content.includes(token)) {
      throw new Error(
        `generated Codex skill '${command}' still contains slash-command placeholder '${token}'`,
      );
    }
  }
}

function renderCodexHostSkill(command, sourceContent) {
  const codexParts = splitMarkdownFrontmatter(renderCodexHostCommand(sourceContent));
  const sourceParts = splitMarkdownFrontmatter(sourceContent);
  const metadata = CODEX_SKILL_METADATA[command] ?? {
    title: `Circuit ${command}`,
    description:
      frontmatterValue(sourceParts.frontmatter, 'description') ??
      `Use when the user wants Circuit to run the ${command} flow from Codex.`,
  };
  const nativeBody = renderCodexNativeSkillBody(codexParts.body);
  const content = [
    '---',
    `name: ${command}`,
    `description: ${JSON.stringify(metadata.description)}`,
    '---',
    '',
    `# ${metadata.title}`,
    '',
    '## When to Use This Skill',
    '',
    metadata.description,
    '',
    '## Codex Host Invocation',
    '',
    '`<plugin root>` means the absolute path to the installed Circuit plugin directory,',
    "the directory that contains `.codex-plugin/plugin.json`. Do not use a path relative to the user's project.",
    '',
    nativeBody,
  ].join('\n');
  assertCodexHostSkillHasNoCommandPlaceholders(command, content);
  return content;
}

function copyMarkdownFile(sourceRel, destRel, label, transform = (content) => content) {
  const sourceAbs = resolve(projectRoot, sourceRel);
  const destAbs = resolve(projectRoot, destRel);
  const sourceContent = transform(readFileSync(sourceAbs, 'utf8'));
  mkdirSync(dirname(destAbs), { recursive: true });
  writeFileSync(destAbs, sourceContent);
  console.log(`emitted ${destRel} (${label})`);
}

function checkMarkdownMirror(sourceRel, destRel, label, transform = (content) => content) {
  const sourceAbs = resolve(projectRoot, sourceRel);
  const destAbs = resolve(projectRoot, destRel);
  let sourceContent;
  try {
    sourceContent = transform(readFileSync(sourceAbs, 'utf8'));
  } catch (_err) {
    console.error(`✗ ${sourceRel} is missing on disk but ${label} references it.`);
    return true;
  }
  let destContent;
  try {
    destContent = readFileSync(destAbs, 'utf8');
  } catch (_err) {
    console.error(
      `✗ ${destRel} is missing on disk; run \`npm run emit-flows\` to regenerate, then commit.`,
    );
    return true;
  }
  if (sourceContent === destContent) {
    console.log(`✓ ${destRel} is in sync with ${sourceRel}`);
    return false;
  }
  console.error(`✗ ${destRel} drifted from ${sourceRel}; run \`npm run emit-flows\`.`);
  return true;
}

function emitCommandFile(entry) {
  if (entry.commandSourcePath === undefined) return;
  copyMarkdownFile(
    entry.commandSourcePath,
    `commands/${entry.id}.md`,
    `from ${entry.commandSourcePath}`,
  );
  copyMarkdownFile(
    entry.commandSourcePath,
    `${CODEX_PLUGIN_ROOT_REL}/commands/${entry.id}.md`,
    `codex host command from ${entry.commandSourcePath}`,
    renderCodexHostCommand,
  );
  copyMarkdownFile(
    entry.commandSourcePath,
    `${CODEX_PLUGIN_ROOT_REL}/skills/${entry.id}/SKILL.md`,
    `codex host skill from ${entry.commandSourcePath}`,
    (content) => renderCodexHostSkill(entry.id, content),
  );
}

function emitCodexRouterCommand() {
  for (const command of CODEX_ROUTER_COMMANDS) {
    copyMarkdownFile(
      `commands/${command}.md`,
      `${CODEX_PLUGIN_ROOT_REL}/commands/${command}.md`,
      `codex host ${command} command`,
      renderCodexHostCommand,
    );
    copyMarkdownFile(
      `commands/${command}.md`,
      `${CODEX_PLUGIN_ROOT_REL}/skills/${command}/SKILL.md`,
      `codex host ${command} skill`,
      (content) => renderCodexHostSkill(command, content),
    );
  }
}

function checkCommandFile(entry) {
  if (entry.commandSourcePath === undefined) return false;
  const rootDrifted = checkMarkdownMirror(
    entry.commandSourcePath,
    `commands/${entry.id}.md`,
    `${entry.id} root command`,
  );
  const codexDrifted = checkMarkdownMirror(
    entry.commandSourcePath,
    `${CODEX_PLUGIN_ROOT_REL}/commands/${entry.id}.md`,
    `${entry.id} codex host command`,
    renderCodexHostCommand,
  );
  const codexSkillDrifted = checkMarkdownMirror(
    entry.commandSourcePath,
    `${CODEX_PLUGIN_ROOT_REL}/skills/${entry.id}/SKILL.md`,
    `${entry.id} codex host skill`,
    (content) => renderCodexHostSkill(entry.id, content),
  );
  return rootDrifted || codexDrifted || codexSkillDrifted;
}

function checkCodexRouterCommand() {
  return CODEX_ROUTER_COMMANDS.some((command) => {
    const commandDrifted = checkMarkdownMirror(
      `commands/${command}.md`,
      `${CODEX_PLUGIN_ROOT_REL}/commands/${command}.md`,
      `codex host ${command} command`,
      renderCodexHostCommand,
    );
    const skillDrifted = checkMarkdownMirror(
      `commands/${command}.md`,
      `${CODEX_PLUGIN_ROOT_REL}/skills/${command}/SKILL.md`,
      `codex host ${command} skill`,
      (content) => renderCodexHostSkill(command, content),
    );
    return commandDrifted || skillDrifted;
  });
}

function expectedCodexSkillIds() {
  return new Set([
    ...SCHEMATICS.filter((entry) => entry.commandSourcePath !== undefined).map((entry) => entry.id),
    ...CODEX_ROUTER_COMMANDS,
  ]);
}

function findStaleCodexSkillDirs(expected) {
  const skillsRoot = resolve(projectRoot, `${CODEX_PLUGIN_ROOT_REL}/skills`);
  if (!existsSync(skillsRoot)) return [];
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !expected.has(entry.name))
    .map((entry) => `${CODEX_PLUGIN_ROOT_REL}/skills/${entry.name}`);
}

async function loadCompilerModule() {
  // dist/runtime/compile-schematic-to-flow.js is produced by `npm run
  // build`. The emit script depends on a fresh dist/, so callers should
  // run `npm run build` first (the verify pipeline does this in order).
  const distPath = resolve(projectRoot, 'dist/runtime/compile-schematic-to-flow.js');
  try {
    return await import(distPath);
  } catch (err) {
    console.error(
      `\nCould not import compiler from dist/. Run \`npm run build\` first, then re-run this script.\n${err.message}\n`,
    );
    process.exit(1);
  }
}

async function loadSchematicSchemaModule() {
  const distPath = resolve(projectRoot, 'dist/schemas/flow-schematic.js');
  return import(distPath);
}

async function compileOneSchematic(schematicPath) {
  const [{ compileSchematicToCompiledFlow }, { FlowSchematic }] = await Promise.all([
    loadCompilerModule(),
    loadSchematicSchemaModule(),
  ]);
  const raw = JSON.parse(readFileSync(resolve(projectRoot, schematicPath), 'utf8'));
  const schematic = FlowSchematic.parse(raw);
  return compileSchematicToCompiledFlow(schematic);
}

function stringifyCompiledFlow(flow) {
  return `${JSON.stringify(flow, null, 2)}\n`;
}

function biomeFormatInPlace(absolutePath) {
  execFileSync('npx', ['biome', 'format', '--write', absolutePath], {
    cwd: projectRoot,
    stdio: 'pipe',
  });
}

// Stable structural identity for grouping per-mode flows. Two compiled
// flows belong to the same group when their stringified form (with
// entry_modes stripped) is byte-identical. JSON.stringify is deterministic
// for our object construction order.
function graphIdentityHash(flow) {
  const { entry_modes: _entryModes, ...rest } = flow;
  return JSON.stringify(rest);
}

// Decide the per-schematic file plan: what to write, where, and with which
// entry_modes payload. Exposed so the emit and check paths share the
// same logic.
function planSchematicFiles(id, result) {
  if (result.kind === 'single') {
    return [
      {
        outRel: `generated/flows/${id}/circuit.json`,
        flow: result.flow,
      },
    ];
  }
  // per-mode
  const groups = new Map(); // hash → { modes: string[], flow }
  for (const [modeName, flow] of result.flows) {
    const hash = graphIdentityHash(flow);
    const existing = groups.get(hash);
    if (existing === undefined) {
      groups.set(hash, { modes: [modeName], flow });
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
  // result so per-mode depth/description survive.
  const main = ordered[0];
  const mainEntryModes = main.modes.map((m) => result.flows.get(m).entry_modes[0]);
  plan.push({
    outRel: `generated/flows/${id}/circuit.json`,
    flow: { ...main.flow, entry_modes: mainEntryModes },
  });
  // Remaining groups → one file per mode in those groups, with single-mode
  // entry_modes (already shaped that way by the compiler).
  for (let i = 1; i < ordered.length; i++) {
    for (const modeName of ordered[i].modes) {
      const flow = result.flows.get(modeName);
      plan.push({
        outRel: `generated/flows/${id}/${modeName}.json`,
        flow,
      });
    }
  }
  return plan;
}

function claudeHostRel(canonicalRel) {
  return canonicalRel.replace(/^generated\/flows\//, '.claude-plugin/skills/');
}

function claudeHostPlan(plan) {
  return plan.map((p) => ({ ...p, outRel: claudeHostRel(p.outRel) }));
}

function codexHostRel(canonicalRel) {
  return canonicalRel.replace(/^generated\/flows\//, `${CODEX_PLUGIN_ROOT_REL}/flows/`);
}

function codexHostPlan(plan) {
  return plan.map((p) => ({ ...p, outRel: codexHostRel(p.outRel) }));
}

// Returns the set of unexpected `*.json` files in a generated flow directory:
// anything on disk under `<rootRel>/<id>/` that ends in `.json`
// but isn't in the emit plan. These are stale per-mode siblings from a
// renamed/collapsed entry mode.
function findStaleSiblings(id, plan, rootRel) {
  const skillDirAbs = resolve(projectRoot, `${rootRel}/${id}`);
  if (!existsSync(skillDirAbs)) return [];
  const expected = new Set(plan.map((p) => basename(p.outRel)));
  return readdirSync(skillDirAbs)
    .filter((name) => name.endsWith('.json') && !expected.has(name))
    .map((name) => `${rootRel}/${id}/${name}`);
}

async function emitMode() {
  const expectedSkills = expectedCodexSkillIds();
  for (const entry of SCHEMATICS) {
    const result = await compileOneSchematic(entry.schematicPath);
    const plan = planSchematicFiles(entry.id, result);
    for (const { outRel, flow } of plan) {
      const outAbs = resolve(projectRoot, outRel);
      mkdirSync(dirname(outAbs), { recursive: true });
      writeFileSync(outAbs, stringifyCompiledFlow(flow));
      biomeFormatInPlace(outAbs);
      console.log(`emitted ${outRel}`);
      const hostRel = claudeHostRel(outRel);
      const hostAbs = resolve(projectRoot, hostRel);
      mkdirSync(dirname(hostAbs), { recursive: true });
      writeFileSync(hostAbs, readFileSync(outAbs, 'utf8'));
      console.log(`emitted ${hostRel} (claude-code host output)`);
      const codexRel = codexHostRel(outRel);
      const codexAbs = resolve(projectRoot, codexRel);
      mkdirSync(dirname(codexAbs), { recursive: true });
      writeFileSync(codexAbs, readFileSync(outAbs, 'utf8'));
      console.log(`emitted ${codexRel} (codex host output)`);
    }
    // Stale `<mode>.json` siblings would otherwise survive emit and silently
    // drive runtime behavior via the CLI loader. Treat them as stale outputs
    // of this build step and remove them.
    for (const stale of [
      ...findStaleSiblings(entry.id, plan, 'generated/flows'),
      ...findStaleSiblings(entry.id, claudeHostPlan(plan), '.claude-plugin/skills'),
      ...findStaleSiblings(entry.id, codexHostPlan(plan), `${CODEX_PLUGIN_ROOT_REL}/flows`),
    ]) {
      unlinkSync(resolve(projectRoot, stale));
      console.log(`removed stale ${stale}`);
    }
    emitCommandFile(entry);
  }
  emitCodexRouterCommand();
  for (const stale of findStaleCodexSkillDirs(expectedSkills)) {
    rmSync(resolve(projectRoot, stale), { recursive: true, force: true });
    console.log(`removed stale ${stale}`);
  }
}

async function checkMode() {
  const tmpDir = mkdtempSync(join(tmpdir(), 'flow-drift-'));
  let drifted = false;
  const expectedSkills = expectedCodexSkillIds();
  try {
    for (const entry of SCHEMATICS) {
      const result = await compileOneSchematic(entry.schematicPath);
      const plan = planSchematicFiles(entry.id, result);
      for (const { outRel, flow } of plan) {
        const tmpFile = join(tmpDir, outRel.replace(/[/]/g, '_'));
        writeFileSync(tmpFile, stringifyCompiledFlow(flow));
        biomeFormatInPlace(tmpFile);
        const compiledBytes = readFileSync(tmpFile, 'utf8');
        const committedAbs = resolve(projectRoot, outRel);
        let committedBytes;
        try {
          committedBytes = readFileSync(committedAbs, 'utf8');
        } catch (_err) {
          console.error(
            `✗ ${outRel} is missing on disk but the schematic compiles to it. Run \`npm run emit-flows\` to regenerate, then commit.`,
          );
          drifted = true;
          continue;
        }
        if (compiledBytes === committedBytes) {
          console.log(`✓ ${outRel} is in sync with ${entry.schematicPath}`);
        } else {
          console.error(`✗ ${outRel} drifted from compiled output of ${entry.schematicPath}`);
          console.error('  Run `npm run emit-flows` to regenerate, then commit the diff.');
          drifted = true;
        }
        const hostRel = claudeHostRel(outRel);
        let hostBytes;
        try {
          hostBytes = readFileSync(resolve(projectRoot, hostRel), 'utf8');
        } catch (_err) {
          console.error(
            `✗ ${hostRel} is missing on disk but the claude-code host compiles to it. Run \`npm run emit-flows\` to regenerate, then commit.`,
          );
          drifted = true;
          continue;
        }
        if (compiledBytes === hostBytes) {
          console.log(`✓ ${hostRel} mirrors ${outRel}`);
        } else {
          console.error(`✗ ${hostRel} drifted from canonical ${outRel}`);
          console.error('  Run `npm run emit-flows` to regenerate, then commit the diff.');
          drifted = true;
        }
        const codexRel = codexHostRel(outRel);
        let codexBytes;
        try {
          codexBytes = readFileSync(resolve(projectRoot, codexRel), 'utf8');
        } catch (_err) {
          console.error(
            `✗ ${codexRel} is missing on disk but the codex host compiles to it. Run \`npm run emit-flows\` to regenerate, then commit.`,
          );
          drifted = true;
          continue;
        }
        if (compiledBytes === codexBytes) {
          console.log(`✓ ${codexRel} mirrors ${outRel}`);
        } else {
          console.error(`✗ ${codexRel} drifted from canonical ${outRel}`);
          console.error('  Run `npm run emit-flows` to regenerate, then commit the diff.');
          drifted = true;
        }
      }
      // Stale `<mode>.json` siblings in this skill dir would silently drive
      // runtime behavior via the CLI loader, while the byte-by-byte check
      // above only ranges over files in the current emit plan.
      const stale = [
        ...findStaleSiblings(entry.id, plan, 'generated/flows'),
        ...findStaleSiblings(entry.id, claudeHostPlan(plan), '.claude-plugin/skills'),
        ...findStaleSiblings(entry.id, codexHostPlan(plan), `${CODEX_PLUGIN_ROOT_REL}/flows`),
      ];
      for (const rel of stale) {
        console.error(
          `✗ ${rel} is not in the emit plan for ${entry.schematicPath}. Run \`npm run emit-flows\` to clean up stale siblings, then commit the deletion.`,
        );
        drifted = true;
      }
      if (checkCommandFile(entry)) {
        drifted = true;
      }
    }
    if (checkCodexRouterCommand()) {
      drifted = true;
    }
    for (const stale of findStaleCodexSkillDirs(expectedSkills)) {
      console.error(
        `✗ ${stale} is not an expected Codex skill. Run \`npm run emit-flows\` to clean up stale skills, then commit the deletion.`,
      );
      drifted = true;
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
