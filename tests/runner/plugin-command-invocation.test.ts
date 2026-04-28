import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// These tests assert that the plugin command bodies under root
// `commands/` are wired to the runtime rather than carrying placeholder
// "Not implemented yet" text AND that the runtime binding is
// demonstrated via an executable workflow invocation in a fenced bash
// block (not merely a prose mention). Structural plugin-manifest +
// frontmatter requirements are covered by Check 23 +
// `tests/contracts/plugin-surface.test.ts`.
//
// Safe-construction: the unsafe `--goal "$ARGUMENTS"` double-quoted
// splice pattern is forbidden; a regression test rejects that exact
// pattern AND asserts that all fenced bash invocation examples use
// single-quoted --goal arguments. Tests extract fenced bash blocks and
// assert the invocation lives INSIDE a block (not merely in prose).
// Anti-pattern negative fixtures exercise prose-only mentions and
// P2.8-pointer-only bodies so regressions cannot pass by keyword
// overlap. Manifest description consistency tracks the deterministic
// classifier truth.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

const EXPLORE_COMMAND_PATH = resolve(REPO_ROOT, 'commands/explore.md');
const RUN_COMMAND_PATH = resolve(REPO_ROOT, 'commands/run.md');
const REVIEW_COMMAND_PATH = resolve(REPO_ROOT, 'commands/review.md');
const BUILD_COMMAND_PATH = resolve(REPO_ROOT, 'commands/build.md');
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

// Does ANY fenced bash block in the body contain an executable workflow
// invocation with the --goal flag? "Executable" means the workflow appears
// as the CLI positional token after `./bin/circuit-next` or after
// `node dist/cli/circuit.js`, AND the same line has `--goal `. Prose
// mentions, goal text, or negated ("do not run …") text DO NOT satisfy.
function hasExecutableWorkflowInvocation(body: string, workflow: string): boolean {
  const blocks = extractBashBlocks(body);
  const workflowPattern = workflow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const binInvocation = new RegExp(`^\\s*\\.\\/bin\\/circuit-next ${workflowPattern}(?:\\s|$)`);
  const nodeInvocation = new RegExp(
    `^\\s*node dist\\/cli\\/circuit\\.js ${workflowPattern}(?:\\s|$)`,
  );
  for (const block of blocks) {
    for (const line of block.split('\n')) {
      const hasCli = binInvocation.test(line) || nodeInvocation.test(line);
      const hasGoal = /--goal\s+/.test(line);
      if (hasCli && hasGoal) return true;
    }
  }
  return false;
}

function hasExecutableExploreInvocation(body: string): boolean {
  return hasExecutableWorkflowInvocation(body, 'explore');
}

function hasExecutableReviewInvocation(body: string): boolean {
  return hasExecutableWorkflowInvocation(body, 'review');
}

function hasExecutableBuildInvocation(body: string): boolean {
  return hasExecutableWorkflowInvocation(body, 'build');
}

function hasExecutableRouterInvocation(body: string): boolean {
  const blocks = extractBashBlocks(body);
  const binInvocation = /^\s*\.\/bin\/circuit-next --goal(?:\s|$)/;
  const nodeInvocation = /^\s*node dist\/cli\/circuit\.js --goal(?:\s|$)/;
  for (const block of blocks) {
    for (const line of block.split('\n')) {
      if (binInvocation.test(line) || nodeInvocation.test(line)) return true;
    }
  }
  return false;
}

function hasEntryModeAndRigorInvocation(body: string): boolean {
  const blocks = extractBashBlocks(body);
  for (const block of blocks) {
    for (const line of block.split('\n')) {
      if (
        /\.\/bin\/circuit-next/.test(line) &&
        /--goal\s+'/.test(line) &&
        /--entry-mode\s+(?:default|lite|deep|autonomous)\b/.test(line) &&
        /--rigor\s+(?:lite|standard|deep|autonomous)\b/.test(line)
      ) {
        return true;
      }
    }
  }
  return false;
}

describe('plugin command invocation binding', () => {
  describe('real command bodies — positive assertions', () => {
    const exploreBody = readFileSync(EXPLORE_COMMAND_PATH, 'utf-8');
    const runBody = readFileSync(RUN_COMMAND_PATH, 'utf-8');
    const reviewBody = readFileSync(REVIEW_COMMAND_PATH, 'utf-8');
    const buildBody = readFileSync(BUILD_COMMAND_PATH, 'utf-8');

    it('commands/explore.md has an executable explore invocation in a fenced bash block with --goal', () => {
      expect(hasExecutableExploreInvocation(exploreBody)).toBe(true);
    });

    it('commands/run.md has an executable classifier invocation in a fenced bash block with --goal', () => {
      expect(hasExecutableRouterInvocation(runBody)).toBe(true);
    });

    it('commands/review.md has an executable review invocation in a fenced bash block with --goal', () => {
      expect(hasExecutableReviewInvocation(reviewBody)).toBe(true);
    });

    it('commands/build.md has an executable build invocation in a fenced bash block with --goal', () => {
      expect(hasExecutableBuildInvocation(buildBody)).toBe(true);
    });

    it('no command body contains "Not implemented yet"', () => {
      expect(exploreBody).not.toMatch(new RegExp(PLACEHOLDER_STRING));
      expect(runBody).not.toMatch(new RegExp(PLACEHOLDER_STRING));
      expect(reviewBody).not.toMatch(new RegExp(PLACEHOLDER_STRING));
      expect(buildBody).not.toMatch(new RegExp(PLACEHOLDER_STRING));
    });

    it('commands/run.md documents the current explore/review/build router surface', () => {
      expect(runBody).toMatch(
        /Parse the CLI's JSON output and surface:[\s\S]*`selected_workflow`[\s\S]*`routed_by`[\s\S]*`router_reason`/,
      );
      expect(runBody).toMatch(/`result_path` when present/);
      expect(runBody).toMatch(/explore/);
      expect(runBody).toMatch(/review/);
      expect(runBody).toMatch(/build/);
      expect(runBody).toMatch(/artifacts\/build-result\.json/);
    });

    it('Build command docs follow build.implementation before summarizing changed files and evidence', () => {
      for (const body of [buildBody, runBody]) {
        expect(body).toMatch(/artifact_pointers/);
        expect(body).toMatch(/build\.implementation/);
        expect(body).toMatch(/changed files and evidence/);
      }
    });

    it('Build command docs include same-invocation entry-mode and rigor examples', () => {
      expect(hasEntryModeAndRigorInvocation(buildBody)).toBe(true);
      expect(hasEntryModeAndRigorInvocation(runBody)).toBe(true);
    });

    it('Build waiting docs surface checkpoint details and resume command without treating result_path as available', () => {
      for (const body of [buildBody, runBody]) {
        expect(body).toMatch(/checkpoint_waiting/);
        expect(body).toMatch(/checkpoint\.request_path/);
        expect(body).toMatch(/checkpoint\.allowed_choices/);
        expect(body).toMatch(
          /\.\/bin\/circuit-next resume --run-root '<run_root>' --checkpoint-choice '<choice>'/,
        );
      }
      expect(runBody).not.toMatch(
        /surface:[\s\S]*`run_root`, `result_path`,\s+and `events_observed`/,
      );
      expect(runBody).toMatch(/selected_workflow/);
      expect(runBody).toMatch(/routed_by/);
      expect(runBody).toMatch(/router_reason/);
    });

    it('command bodies use the direct Circuit launcher, not the npm-script bridge or old dogfood path', () => {
      for (const body of [exploreBody, runBody, reviewBody, buildBody]) {
        expect(body).toMatch(/\.\/bin\/circuit-next/);
        expect(body).not.toMatch(/npm run circuit:run/);
        expect(body).not.toMatch(/dist\/cli\/dogfood\.js/);
      }
    });
  });

  describe('HIGH 2 regression: --goal value is single-quoted (safe construction)', () => {
    const exploreBody = readFileSync(EXPLORE_COMMAND_PATH, 'utf-8');
    const runBody = readFileSync(RUN_COMMAND_PATH, 'utf-8');
    const reviewBody = readFileSync(REVIEW_COMMAND_PATH, 'utf-8');
    const buildBody = readFileSync(BUILD_COMMAND_PATH, 'utf-8');

    it('neither body contains the unsafe --goal "$ARGUMENTS" double-quoted splice', () => {
      // Double-quoting $ARGUMENTS expands $VAR, $(cmd), `cmd`, and \
      // sequences from user-controlled goal text — a shell-injection vector.
      // This literal pattern is forbidden.
      expect(exploreBody).not.toMatch(/--goal "\$ARGUMENTS"/);
      expect(runBody).not.toMatch(/--goal "\$ARGUMENTS"/);
      expect(reviewBody).not.toMatch(/--goal "\$ARGUMENTS"/);
      expect(buildBody).not.toMatch(/--goal "\$ARGUMENTS"/);
    });

    it('all fenced bash invocation blocks in commands/explore.md use single-quoted --goal values', () => {
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

    it('all fenced bash invocation blocks in commands/run.md use single-quoted --goal values', () => {
      const blocks = extractBashBlocks(runBody).filter(
        (b) => /(?:\.\/bin\/circuit-next|node dist\/cli\/circuit\.js)/.test(b) && /--goal/.test(b),
      );
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(block).toMatch(/--goal\s+'/);
        expect(block).not.toMatch(/--goal\s+"/);
      }
    });

    it('all fenced bash invocation blocks in commands/review.md use single-quoted --goal values', () => {
      const blocks = extractBashBlocks(reviewBody).filter(
        (b) => /review/.test(b) && /--goal/.test(b),
      );
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(block).toMatch(/--goal\s+'/);
        expect(block).not.toMatch(/--goal\s+"/);
      }
    });

    it('all fenced bash invocation blocks in commands/build.md use single-quoted --goal values', () => {
      const blocks = extractBashBlocks(buildBody).filter(
        (b) => /build/.test(b) && /--goal/.test(b),
      );
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(block).toMatch(/--goal\s+'/);
        expect(block).not.toMatch(/--goal\s+"/);
      }
    });

    it('all command bodies document the single-quote-with-escape rule for apostrophes', () => {
      // The safe construction documentation MUST mention the POSIX
      // single-quote escape sequence "'\''" so a future author does not
      // hand-reinvent an unsafe shape.
      expect(exploreBody).toMatch(/'\\''/);
      expect(runBody).toMatch(/'\\''/);
      expect(reviewBody).toMatch(/'\\''/);
      expect(buildBody).toMatch(/'\\''/);
    });
  });

  describe('MED 1 negative fixtures: prose-only / P2.8-only / negated bodies', () => {
    it('rejects a body that mentions the CLI only in prose (not a bash block)', () => {
      const proseOnly = `---
name: circuit:explore
description: stub
---

The CLI ./bin/circuit-next is documented somewhere else; this body does not invoke it.
`;
      expect(hasExecutableExploreInvocation(proseOnly)).toBe(false);
    });

    it('rejects a body that only carries a classifier pointer without an invocation block', () => {
      const p28Only = `---
name: circuit:run
description: stub
---

# /circuit:run

The router classifier chooses explore or review. See /circuit:explore for direct use.
`;
      expect(hasExecutableRouterInvocation(p28Only)).toBe(false);
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

    it('rejects review appearing only inside the goal text instead of as the workflow token', () => {
      const wrongWorkflow = `---
name: circuit:review
description: stub
---

\`\`\`bash
./bin/circuit-next explore --goal 'review the latest change'
\`\`\`
`;
      expect(hasExecutableReviewInvocation(wrongWorkflow)).toBe(false);
    });

    it('accepts a body with a fenced bash block containing an explore invocation with --goal', () => {
      const goodBody = `---
name: circuit:explore
description: stub
---

\`\`\`bash
./bin/circuit-next explore --goal 'find deprecated APIs'
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
node dist/cli/circuit.js explore --goal 'find deprecated APIs'
\`\`\`
`;
      expect(hasExecutableExploreInvocation(compiledJsBody)).toBe(true);
    });
  });

  describe('manifest description consistency (MED 2 + ledger entry [6])', () => {
    const manifestBody = readFileSync(MANIFEST_PATH, 'utf-8');
    const manifest = JSON.parse(manifestBody) as {
      name: string;
      description: string;
    };

    it('manifest does not carry "scaffold" / "not yet implemented" language', () => {
      expect(manifestBody).not.toMatch(/P2\.2 scaffold entry/);
      expect(manifestBody).not.toMatch(/not-implemented notice/);
      expect(manifestBody).not.toMatch(/not yet implemented/i);
    });

    it('manifest name creates the public /circuit:* namespace', () => {
      expect(manifest.name).toBe('circuit');
      expect(manifestBody).not.toMatch(/"commands"\s*:/);
    });

    it('top-level manifest description mentions the wired `/circuit:explore` invocation path', () => {
      // The wired state should be visible in the top-level description
      // (not only in per-command descriptions).
      expect(manifest.description).toMatch(/\/circuit:explore/);
    });

    it('manifest includes circuit:review as an explicit workflow command', () => {
      expect(manifest.description).toMatch(/\/circuit:review/);
      expect(readFileSync(REVIEW_COMMAND_PATH, 'utf-8')).toMatch(/review workflow/i);
    });

    it('manifest includes circuit:build as an explicit workflow command', () => {
      expect(manifest.description).toMatch(/\/circuit:build/);
      expect(readFileSync(BUILD_COMMAND_PATH, 'utf-8')).toMatch(/Build workflow/);
    });
  });
});
