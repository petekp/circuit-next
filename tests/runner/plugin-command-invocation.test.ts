import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Slice 56 (P2.11 plugin-wiring) — plan
// `specs/plans/p2-11-plugin-wiring.md` scope item 4. These tests assert that
// the two plugin command bodies — `.claude-plugin/commands/circuit-explore.md`
// and `.claude-plugin/commands/circuit-run.md` — are wired to the runtime
// rather than carrying placeholder "Not implemented yet" text AND that the
// runtime binding is demonstrated via an executable explore invocation in a
// fenced bash block (not merely a prose mention). Structural plugin-manifest
// + frontmatter requirements are covered by Check 23 +
// `tests/contracts/plugin-surface.test.ts`.
//
// Codex challenger fold-ins (specs/reviews/arc-slice-56-codex.md):
//   - HIGH 2: the safe-construction rule forbids the unsafe
//     `--goal "$ARGUMENTS"` double-quoted splice pattern; this file carries
//     a regression test that rejects that exact pattern AND asserts that all
//     fenced bash invocation examples use single-quoted --goal arguments.
//   - MED 1: tests over-relied on substring matches; this file now extracts
//     fenced bash blocks and asserts the invocation lives INSIDE a block
//     (not merely in prose). Anti-pattern negative fixtures exercise
//     prose-only mentions and P2.8-pointer-only bodies so regressions
//     cannot pass by keyword overlap.
//   - MED 2: manifest description consistency extended to assert that the
//     `circuit:run` description leads with routing behavior before any
//     classifier mention.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

const EXPLORE_COMMAND_PATH = resolve(REPO_ROOT, '.claude-plugin/commands/circuit-explore.md');
const RUN_COMMAND_PATH = resolve(REPO_ROOT, '.claude-plugin/commands/circuit-run.md');
const MANIFEST_PATH = resolve(REPO_ROOT, '.claude-plugin/plugin.json');

const PLACEHOLDER_STRING = 'Not implemented yet';

// Extract fenced ```bash ... ``` blocks from a markdown body. Returns an
// array of block contents (without the fence markers). Multiple blocks per
// body are supported.
function extractBashBlocks(body: string): string[] {
  const regex = /```bash\n([\s\S]*?)```/g;
  const blocks: string[] = [];
  for (const match of body.matchAll(regex)) {
    const block = match[1];
    if (block !== undefined) blocks.push(block);
  }
  return blocks;
}

// Does ANY fenced bash block in the body contain an executable explore
// invocation with the --goal flag? "Executable" means the block has the CLI
// identifier (npm run circuit:run OR node dist/cli/dogfood.js) followed on
// the same line by `explore`, AND the block has `--goal `. Prose mentions
// or negated ("do not run …") text in prose DO NOT satisfy because they are
// not inside a fenced bash block.
function hasExecutableExploreInvocation(body: string): boolean {
  const blocks = extractBashBlocks(body);
  for (const block of blocks) {
    const hasCli =
      /(npm run circuit:run[^\n]*explore|node dist\/cli\/dogfood\.js[^\n]*explore)/.test(block);
    const hasGoal = /--goal\s+/.test(block);
    if (hasCli && hasGoal) return true;
  }
  return false;
}

describe('plugin command invocation binding (Slice 56 / P2.11)', () => {
  describe('real command bodies — positive assertions', () => {
    const exploreBody = readFileSync(EXPLORE_COMMAND_PATH, 'utf-8');
    const runBody = readFileSync(RUN_COMMAND_PATH, 'utf-8');

    it('circuit-explore.md has an executable explore invocation in a fenced bash block with --goal', () => {
      expect(hasExecutableExploreInvocation(exploreBody)).toBe(true);
    });

    it('circuit-run.md has an executable explore invocation in a fenced bash block with --goal', () => {
      expect(hasExecutableExploreInvocation(runBody)).toBe(true);
    });

    it('neither body contains "Not implemented yet"', () => {
      expect(exploreBody).not.toMatch(new RegExp(PLACEHOLDER_STRING));
      expect(runBody).not.toMatch(new RegExp(PLACEHOLDER_STRING));
    });

    it('circuit-run.md references /circuit:explore or the P2.8 pointer', () => {
      const hasRouteToExplore = /\/circuit:explore/.test(runBody);
      const hasP28Pointer = /P2\.8/.test(runBody);
      expect(hasRouteToExplore || hasP28Pointer).toBe(true);
    });
  });

  describe('HIGH 2 regression: --goal value is single-quoted (safe construction)', () => {
    const exploreBody = readFileSync(EXPLORE_COMMAND_PATH, 'utf-8');
    const runBody = readFileSync(RUN_COMMAND_PATH, 'utf-8');

    it('neither body contains the unsafe --goal "$ARGUMENTS" double-quoted splice', () => {
      // Double-quoting $ARGUMENTS expands $VAR, $(cmd), `cmd`, and \
      // sequences from user-controlled goal text — a shell-injection vector.
      // The Codex HIGH 2 fold-in forbids this literal pattern.
      expect(exploreBody).not.toMatch(/--goal "\$ARGUMENTS"/);
      expect(runBody).not.toMatch(/--goal "\$ARGUMENTS"/);
    });

    it('all fenced bash invocation blocks in circuit-explore.md use single-quoted --goal values', () => {
      const blocks = extractBashBlocks(exploreBody).filter(
        (b) => /explore/.test(b) && /--goal/.test(b),
      );
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        // --goal must be followed by a single-quoted argument; never
        // double-quoted (which would expand shell metacharacters).
        expect(block).toMatch(/--goal\s+'/);
        expect(block).not.toMatch(/--goal\s+"/);
      }
    });

    it('all fenced bash invocation blocks in circuit-run.md use single-quoted --goal values', () => {
      const blocks = extractBashBlocks(runBody).filter(
        (b) => /explore/.test(b) && /--goal/.test(b),
      );
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(block).toMatch(/--goal\s+'/);
        expect(block).not.toMatch(/--goal\s+"/);
      }
    });

    it('both bodies document the single-quote-with-escape rule for apostrophes', () => {
      // The safe construction documentation MUST mention the POSIX
      // single-quote escape sequence "'\''" so a future author does not
      // hand-reinvent an unsafe shape.
      expect(exploreBody).toMatch(/'\\''/);
      expect(runBody).toMatch(/'\\''/);
    });
  });

  describe('MED 1 negative fixtures: prose-only / P2.8-only / negated bodies', () => {
    it('rejects a body that mentions the CLI only in prose (not a bash block)', () => {
      const proseOnly = `---
name: circuit:explore
description: stub
---

The CLI npm run circuit:run is documented somewhere else; this body does not invoke it.
`;
      expect(hasExecutableExploreInvocation(proseOnly)).toBe(false);
    });

    it('rejects a body that only carries a P2.8 pointer without an invocation block', () => {
      const p28Only = `---
name: circuit:run
description: stub
---

# /circuit:run

The router classifier lands at plan slice P2.8. See /circuit:explore once it ships.
`;
      expect(hasExecutableExploreInvocation(p28Only)).toBe(false);
    });

    it('rejects a body with a bash block that does not include an explore invocation', () => {
      const wrongBlock = `---
name: circuit:explore
description: stub
---

\`\`\`bash
echo "no invocation here"
\`\`\`
`;
      expect(hasExecutableExploreInvocation(wrongBlock)).toBe(false);
    });

    it('accepts a body with a fenced bash block containing an explore invocation with --goal', () => {
      const goodBody = `---
name: circuit:explore
description: stub
---

\`\`\`bash
npm run circuit:run -- explore --goal 'find deprecated APIs'
\`\`\`
`;
      expect(hasExecutableExploreInvocation(goodBody)).toBe(true);
    });

    it('accepts a body using the compiled-JS path as the CLI identifier', () => {
      const compiledJsBody = `---
name: circuit:explore
description: stub
---

\`\`\`bash
node dist/cli/dogfood.js explore --goal 'find deprecated APIs'
\`\`\`
`;
      expect(hasExecutableExploreInvocation(compiledJsBody)).toBe(true);
    });
  });

  describe('manifest description consistency (MED 2 + ledger entry [6])', () => {
    const manifestBody = readFileSync(MANIFEST_PATH, 'utf-8');
    const manifest = JSON.parse(manifestBody) as {
      description: string;
      commands: Array<{ name: string; description: string }>;
    };

    it('manifest does not carry "scaffold" / "not yet implemented" language', () => {
      expect(manifestBody).not.toMatch(/P2\.2 scaffold entry/);
      expect(manifestBody).not.toMatch(/not-implemented notice/);
      expect(manifestBody).not.toMatch(/not yet implemented/i);
    });

    it('circuit:run description leads with routing behavior (MED 2 fold-in)', () => {
      // The description should lead with "Routes every task …" (wired
      // truth) before any "Classify a task …" or classifier language.
      // That front-matter phrase is what `/help` and model context
      // surface first; leading with unlanded behavior is misleading.
      const circuitRun = manifest.commands.find((c) => c.name === 'circuit:run');
      if (!circuitRun) throw new Error('circuit:run entry missing from manifest');
      const desc = circuitRun.description;
      const routesIdx = desc.search(/Routes every task/i);
      const classifyIdx = desc.search(/Classify a task/i);
      // Either "Routes every task" appears before "Classify a task", OR
      // "Classify a task" is not mentioned at all in the description.
      expect(routesIdx).toBeGreaterThanOrEqual(0);
      if (classifyIdx !== -1) {
        expect(routesIdx).toBeLessThan(classifyIdx);
      }
    });

    it('top-level manifest description mentions the wired `/circuit:explore` invocation path', () => {
      // The wired state should be visible in the top-level description
      // (not only in per-command descriptions).
      expect(manifest.description).toMatch(/\/circuit:explore/);
    });
  });
});
