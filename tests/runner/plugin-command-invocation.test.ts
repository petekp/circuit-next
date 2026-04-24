import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Slice 56 (P2.11 plugin-wiring) — plan
// `specs/plans/p2-11-plugin-wiring.md` scope item 4. These tests assert that
// the plugin command bodies under `.claude-plugin/commands/` are wired to the runtime
// rather than carrying placeholder "Not implemented yet" text AND that the
// runtime binding is demonstrated via an executable workflow invocation in a
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
//   - MED 2: manifest description consistency originally asserted the
//     pre-P2.8 "always explore" route. Slice 84 updates that assertion
//     to the deterministic classifier truth.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

const EXPLORE_COMMAND_PATH = resolve(REPO_ROOT, '.claude-plugin/commands/circuit-explore.md');
const RUN_COMMAND_PATH = resolve(REPO_ROOT, '.claude-plugin/commands/circuit-run.md');
const REVIEW_COMMAND_PATH = resolve(REPO_ROOT, '.claude-plugin/commands/circuit-review.md');
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
// as the CLI positional token after `npm run circuit:run --` or after
// `node dist/cli/dogfood.js`, AND the same line has `--goal `. Prose
// mentions, goal text, or negated ("do not run …") text DO NOT satisfy.
function hasExecutableWorkflowInvocation(body: string, workflow: string): boolean {
  const blocks = extractBashBlocks(body);
  const workflowPattern = workflow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const npmInvocation = new RegExp(`^\\s*npm run circuit:run -- ${workflowPattern}(?:\\s|$)`);
  const nodeInvocation = new RegExp(
    `^\\s*node dist\\/cli\\/dogfood\\.js ${workflowPattern}(?:\\s|$)`,
  );
  for (const block of blocks) {
    for (const line of block.split('\n')) {
      const hasCli = npmInvocation.test(line) || nodeInvocation.test(line);
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

function hasExecutableRouterInvocation(body: string): boolean {
  const blocks = extractBashBlocks(body);
  const npmInvocation = /^\s*npm run circuit:run -- --goal(?:\s|$)/;
  const nodeInvocation = /^\s*node dist\/cli\/dogfood\.js --goal(?:\s|$)/;
  for (const block of blocks) {
    for (const line of block.split('\n')) {
      if (npmInvocation.test(line) || nodeInvocation.test(line)) return true;
    }
  }
  return false;
}

describe('plugin command invocation binding (Slice 56 / P2.11)', () => {
  describe('real command bodies — positive assertions', () => {
    const exploreBody = readFileSync(EXPLORE_COMMAND_PATH, 'utf-8');
    const runBody = readFileSync(RUN_COMMAND_PATH, 'utf-8');
    const reviewBody = readFileSync(REVIEW_COMMAND_PATH, 'utf-8');

    it('circuit-explore.md has an executable explore invocation in a fenced bash block with --goal', () => {
      expect(hasExecutableExploreInvocation(exploreBody)).toBe(true);
    });

    it('circuit-run.md has an executable classifier invocation in a fenced bash block with --goal', () => {
      expect(hasExecutableRouterInvocation(runBody)).toBe(true);
    });

    it('circuit-review.md has an executable review invocation in a fenced bash block with --goal', () => {
      expect(hasExecutableReviewInvocation(reviewBody)).toBe(true);
    });

    it('no command body contains "Not implemented yet"', () => {
      expect(exploreBody).not.toMatch(new RegExp(PLACEHOLDER_STRING));
      expect(runBody).not.toMatch(new RegExp(PLACEHOLDER_STRING));
      expect(reviewBody).not.toMatch(new RegExp(PLACEHOLDER_STRING));
    });

    it('circuit-run.md documents the current explore/review router surface', () => {
      expect(runBody).toMatch(
        /Parse the CLI's JSON output and surface:[\s\S]*`selected_workflow`[\s\S]*`routed_by`[\s\S]*`router_reason`/,
      );
      expect(runBody).toMatch(/explore/);
      expect(runBody).toMatch(/review/);
    });
  });

  describe('HIGH 2 regression: --goal value is single-quoted (safe construction)', () => {
    const exploreBody = readFileSync(EXPLORE_COMMAND_PATH, 'utf-8');
    const runBody = readFileSync(RUN_COMMAND_PATH, 'utf-8');
    const reviewBody = readFileSync(REVIEW_COMMAND_PATH, 'utf-8');

    it('neither body contains the unsafe --goal "$ARGUMENTS" double-quoted splice', () => {
      // Double-quoting $ARGUMENTS expands $VAR, $(cmd), `cmd`, and \
      // sequences from user-controlled goal text — a shell-injection vector.
      // The Codex HIGH 2 fold-in forbids this literal pattern.
      expect(exploreBody).not.toMatch(/--goal "\$ARGUMENTS"/);
      expect(runBody).not.toMatch(/--goal "\$ARGUMENTS"/);
      expect(reviewBody).not.toMatch(/--goal "\$ARGUMENTS"/);
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
        (b) => /(?:npm run circuit:run|node dist\/cli\/dogfood\.js)/.test(b) && /--goal/.test(b),
      );
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(block).toMatch(/--goal\s+'/);
        expect(block).not.toMatch(/--goal\s+"/);
      }
    });

    it('all fenced bash invocation blocks in circuit-review.md use single-quoted --goal values', () => {
      const blocks = extractBashBlocks(reviewBody).filter(
        (b) => /review/.test(b) && /--goal/.test(b),
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
npm run circuit:run -- explore --goal 'review the latest change'
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

    it('circuit:run description leads with classifier behavior', () => {
      // P2.8 landed the deterministic classifier. The manifest should
      // now lead with the classifier truth instead of the old "always
      // explore" route.
      const circuitRun = manifest.commands.find((c) => c.name === 'circuit:run');
      if (!circuitRun) throw new Error('circuit:run entry missing from manifest');
      const desc = circuitRun.description;
      expect(desc).toMatch(/^Classifies free-form tasks/i);
      expect(desc).toMatch(/explore/i);
      expect(desc).toMatch(/review/i);
    });

    it('top-level manifest description mentions the wired `/circuit:explore` invocation path', () => {
      // The wired state should be visible in the top-level description
      // (not only in per-command descriptions).
      expect(manifest.description).toMatch(/\/circuit:explore/);
    });

    it('manifest includes circuit:review as an explicit workflow command', () => {
      const circuitReview = manifest.commands.find((c) => c.name === 'circuit:review');
      expect(circuitReview?.description).toMatch(/review workflow/i);
      expect(manifest.description).toMatch(/\/circuit:review/);
    });
  });
});
