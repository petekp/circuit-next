import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { checkPluginCommandClosure } from '../../scripts/audit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

// Minimal plugin-manifest schema (Codex MED 6 fold-in). Kept inline so the
// test exercises an INDEPENDENT shape definition — if helper/schema diverge,
// the test catches the disagreement. Schema is intentionally conservative:
// it matches the current P2.2 scaffold shape and will need amending when
// manifest semantics broaden (e.g. per-command rigor hints at P2.8+).
const PluginCommandEntry = z
  .object({
    name: z.string().min(1),
    file: z.string().regex(/^commands\/[A-Za-z0-9_-]+\.md$/, {
      message: 'file must match commands/<basename>.md (flat grammar)',
    }),
    description: z.string().min(1),
  })
  .strict();
const PluginManifest = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1),
    description: z.string().min(1),
    keywords: z.array(z.string()),
    commands: z.array(PluginCommandEntry).min(2),
  })
  .strict();

// These tests exercise checkPluginCommandClosure (audit.mjs Check 23,
// introduced by slice P2.2) against constructed temp-dir fixtures. They
// encode ADR-0007 CC#P2-3 binding requirements: plugin.json carries a
// `commands` array whose entries correspond to `.claude-plugin/commands/*.md`
// files with non-empty YAML frontmatter `name` + `description` and a
// non-empty body; required anchor commands `circuit:run` and
// `circuit:explore` are present; no orphan command files exist on disk.

function withTempRepo(fn: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'circuit-next-plugin-surface-'));
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeRel(root: string, rel: string, body: string) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
}

const VALID_COMMAND_FILE_BODY = (name: string, desc: string) => `---
name: ${name}
description: ${desc}
---

# /${name} scaffold

Non-empty body for plugin-command-closure audit check validation.
`;

function writeValidScaffold(root: string) {
  writeRel(
    root,
    '.claude-plugin/plugin.json',
    JSON.stringify(
      {
        name: 'test-plugin',
        version: '0.0.1',
        description: 'test fixture',
        keywords: ['test'],
        commands: [
          {
            name: 'circuit:run',
            file: 'commands/circuit-run.md',
            description: 'Router placeholder description (ADR-0007 CC#P2-3 anchor).',
          },
          {
            name: 'circuit:explore',
            file: 'commands/circuit-explore.md',
            description: 'Explore placeholder description (ADR-0007 CC#P2-1 target).',
          },
        ],
      },
      null,
      2,
    ),
  );
  writeRel(
    root,
    '.claude-plugin/commands/circuit-run.md',
    VALID_COMMAND_FILE_BODY('circuit:run', 'Router placeholder'),
  );
  writeRel(
    root,
    '.claude-plugin/commands/circuit-explore.md',
    VALID_COMMAND_FILE_BODY('circuit:explore', 'Explore placeholder'),
  );
}

describe('checkPluginCommandClosure (ADR-0007 CC#P2-3 enforcement, P2.2)', () => {
  it('passes on a valid scaffold with both anchor commands', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/anchors circuit:run \+ circuit:explore present/);
    });
  });

  it('reds when plugin.json is missing', () => {
    withTempRepo((root) => {
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/plugin\.json missing/);
    });
  });

  it('reds when plugin.json fails to parse as JSON', () => {
    withTempRepo((root) => {
      writeRel(root, '.claude-plugin/plugin.json', '{ invalid json :::');
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/failed to parse/);
    });
  });

  it('reds when plugin.json omits the commands array', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        '.claude-plugin/plugin.json',
        JSON.stringify({ name: 't', version: '0', description: 'd', keywords: [] }),
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/missing `commands` array/);
    });
  });

  it('reds when commands entry references a missing file', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      // Remove the circuit-run.md file but leave the manifest entry.
      rmSync(join(root, '.claude-plugin/commands/circuit-run.md'));
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/circuit-run\.md does not exist/);
    });
  });

  it('reds when a commands/*.md file exists on disk without a manifest entry (orphan)', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(
        root,
        '.claude-plugin/commands/circuit-orphan.md',
        VALID_COMMAND_FILE_BODY('circuit:orphan', 'Orphan placeholder'),
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/orphan command file commands\/circuit-orphan\.md/);
    });
  });

  it('reds when the required anchor circuit:run is missing', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        '.claude-plugin/plugin.json',
        JSON.stringify({
          name: 't',
          version: '0',
          description: 'd',
          keywords: [],
          commands: [
            {
              name: 'circuit:explore',
              file: 'commands/circuit-explore.md',
              description: 'Explore placeholder description.',
            },
          ],
        }),
      );
      writeRel(
        root,
        '.claude-plugin/commands/circuit-explore.md',
        VALID_COMMAND_FILE_BODY('circuit:explore', 'Explore placeholder'),
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/required anchor command `circuit:run` missing/);
    });
  });

  it('reds when the required anchor circuit:explore is missing', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        '.claude-plugin/plugin.json',
        JSON.stringify({
          name: 't',
          version: '0',
          description: 'd',
          keywords: [],
          commands: [
            {
              name: 'circuit:run',
              file: 'commands/circuit-run.md',
              description: 'Router placeholder description.',
            },
          ],
        }),
      );
      writeRel(
        root,
        '.claude-plugin/commands/circuit-run.md',
        VALID_COMMAND_FILE_BODY('circuit:run', 'Router placeholder'),
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/required anchor command `circuit:explore` missing/);
    });
  });

  it('reds when a commands entry has an empty description', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      const manifestPath = join(root, '.claude-plugin/plugin.json');
      const bad = {
        name: 't',
        version: '0',
        description: 'd',
        keywords: [],
        commands: [
          {
            name: 'circuit:run',
            file: 'commands/circuit-run.md',
            description: '',
          },
          {
            name: 'circuit:explore',
            file: 'commands/circuit-explore.md',
            description: 'Explore placeholder description.',
          },
        ],
      };
      writeFileSync(manifestPath, JSON.stringify(bad));
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/missing non-empty string `description`/);
    });
  });

  it('reds when a command file frontmatter has an empty name', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(
        root,
        '.claude-plugin/commands/circuit-run.md',
        '---\nname: \ndescription: has body\n---\n\nbody\n',
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/frontmatter missing non-empty `name` field/);
    });
  });

  it('reds when a command file body is empty', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(
        root,
        '.claude-plugin/commands/circuit-run.md',
        '---\nname: circuit:run\ndescription: desc\n---\n\n   \n',
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/body is empty/);
    });
  });

  it('reds when a commands entry file path escapes the plugin directory', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      const manifestPath = join(root, '.claude-plugin/plugin.json');
      const bad = {
        name: 't',
        version: '0',
        description: 'd',
        keywords: [],
        commands: [
          {
            name: 'circuit:run',
            file: '../outside.md',
            description: 'Should be rejected on grammar violation (HIGH 2 fold-in).',
          },
          {
            name: 'circuit:explore',
            file: 'commands/circuit-explore.md',
            description: 'Explore placeholder description.',
          },
        ],
      };
      writeFileSync(manifestPath, JSON.stringify(bad));
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      // After Codex HIGH 2 fold-in, parent-traversal paths are rejected by
      // the grammar check (which fires first) rather than the old lexical
      // "escapes" message. The grammar is stricter than the prior check.
      expect(result.detail).toMatch(/violates grammar/);
    });
  });

  it('passes the live repo plugin surface (end-to-end self-check)', () => {
    // Exercises the real .claude-plugin/ in this repo. Makes the test suite
    // a living smoke test: regressing the manifest or removing a required
    // anchor flips this test red in the same run as the audit red.
    const result = checkPluginCommandClosure();
    expect(result.level).toBe('green');
  });

  // ── Codex HIGH 1 fold-in: anchor-to-file binding + duplicate rejection.

  it('reds when anchor files are swapped (silent-rename loophole)', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        '.claude-plugin/plugin.json',
        JSON.stringify({
          name: 't',
          version: '0',
          description: 'd',
          keywords: [],
          commands: [
            {
              name: 'circuit:run',
              file: 'commands/circuit-explore.md',
              description: 'Swapped — pointing at explore file.',
            },
            {
              name: 'circuit:explore',
              file: 'commands/circuit-run.md',
              description: 'Swapped — pointing at run file.',
            },
          ],
        }),
      );
      // Files exist with ORIGINAL frontmatter names so swap is detected.
      writeRel(
        root,
        '.claude-plugin/commands/circuit-run.md',
        VALID_COMMAND_FILE_BODY('circuit:run', 'Original run desc'),
      );
      writeRel(
        root,
        '.claude-plugin/commands/circuit-explore.md',
        VALID_COMMAND_FILE_BODY('circuit:explore', 'Original explore desc'),
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/does not match manifest entry name/);
    });
  });

  it('reds when the same command name is used twice in manifest', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        '.claude-plugin/plugin.json',
        JSON.stringify({
          name: 't',
          version: '0',
          description: 'd',
          keywords: [],
          commands: [
            {
              name: 'circuit:run',
              file: 'commands/circuit-run.md',
              description: 'First.',
            },
            {
              name: 'circuit:run',
              file: 'commands/circuit-explore.md',
              description: 'Duplicate name.',
            },
            {
              name: 'circuit:explore',
              file: 'commands/circuit-explore.md',
              description: 'Explore anchor.',
            },
          ],
        }),
      );
      writeRel(
        root,
        '.claude-plugin/commands/circuit-run.md',
        VALID_COMMAND_FILE_BODY('circuit:run', 'run'),
      );
      writeRel(
        root,
        '.claude-plugin/commands/circuit-explore.md',
        VALID_COMMAND_FILE_BODY('circuit:explore', 'explore'),
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/duplicate command name `circuit:run`/);
    });
  });

  it('reds when circuit:run anchor points at a non-canonical file', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        '.claude-plugin/plugin.json',
        JSON.stringify({
          name: 't',
          version: '0',
          description: 'd',
          keywords: [],
          commands: [
            {
              name: 'circuit:run',
              file: 'commands/router.md',
              description: 'Non-canonical file name.',
            },
            {
              name: 'circuit:explore',
              file: 'commands/circuit-explore.md',
              description: 'Explore anchor.',
            },
          ],
        }),
      );
      writeRel(
        root,
        '.claude-plugin/commands/router.md',
        VALID_COMMAND_FILE_BODY('circuit:run', 'Router content'),
      );
      writeRel(
        root,
        '.claude-plugin/commands/circuit-explore.md',
        VALID_COMMAND_FILE_BODY('circuit:explore', 'explore'),
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(
        /`circuit:run` points at `commands\/router\.md` instead of canonical/,
      );
    });
  });

  // ── Codex HIGH 2 fold-in: grammar strictness.

  it('reds when a commands[] entry points outside the commands/ directory', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        '.claude-plugin/plugin.json',
        JSON.stringify({
          name: 't',
          version: '0',
          description: 'd',
          keywords: [],
          commands: [
            {
              name: 'circuit:run',
              file: 'elsewhere/circuit-run.md',
              description: 'Outside commands/.',
            },
            {
              name: 'circuit:explore',
              file: 'commands/circuit-explore.md',
              description: 'Explore anchor.',
            },
          ],
        }),
      );
      writeRel(
        root,
        '.claude-plugin/elsewhere/circuit-run.md',
        VALID_COMMAND_FILE_BODY('circuit:run', 'Outside commands/'),
      );
      writeRel(
        root,
        '.claude-plugin/commands/circuit-explore.md',
        VALID_COMMAND_FILE_BODY('circuit:explore', 'explore'),
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/violates grammar.*commands\/<basename>\.md/);
    });
  });

  it('reds when a commands[] entry uses a non-.md extension', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        '.claude-plugin/plugin.json',
        JSON.stringify({
          name: 't',
          version: '0',
          description: 'd',
          keywords: [],
          commands: [
            {
              name: 'circuit:run',
              file: 'commands/circuit-run.txt',
              description: 'Wrong extension.',
            },
            {
              name: 'circuit:explore',
              file: 'commands/circuit-explore.md',
              description: 'Explore anchor.',
            },
          ],
        }),
      );
      writeRel(
        root,
        '.claude-plugin/commands/circuit-run.txt',
        VALID_COMMAND_FILE_BODY('circuit:run', 'Wrong ext'),
      );
      writeRel(
        root,
        '.claude-plugin/commands/circuit-explore.md',
        VALID_COMMAND_FILE_BODY('circuit:explore', 'explore'),
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/violates grammar/);
    });
  });

  // ── Codex HIGH 3 fold-in: symlink rejection.

  it('reds when a command file is a symlink (even to a valid target inside commands/)', () => {
    withTempRepo((root) => {
      writeRel(
        root,
        '.claude-plugin/plugin.json',
        JSON.stringify({
          name: 't',
          version: '0',
          description: 'd',
          keywords: [],
          commands: [
            {
              name: 'circuit:run',
              file: 'commands/circuit-run.md',
              description: 'Run (symlinked).',
            },
            {
              name: 'circuit:explore',
              file: 'commands/circuit-explore.md',
              description: 'Explore anchor.',
            },
          ],
        }),
      );
      // Real target file, then replace circuit-run.md with symlink to it.
      writeRel(
        root,
        '.claude-plugin/commands/circuit-explore.md',
        VALID_COMMAND_FILE_BODY('circuit:explore', 'explore'),
      );
      const targetPath = join(root, '.claude-plugin/commands/_hidden.md');
      writeFileSync(targetPath, VALID_COMMAND_FILE_BODY('circuit:run', 'symlinked target'));
      symlinkSync('_hidden.md', join(root, '.claude-plugin/commands/circuit-run.md'));
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      // Either the manifest-iterator symlink rejection or the walker symlink
      // rejection may fire first; both are acceptable.
      expect(result.detail).toMatch(/symlink/i);
    });
  });

  // ── Codex MED 4 fold-in: nested-directory + non-.md file rejection.

  it('reds when commands/ contains a nested directory', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(
        root,
        '.claude-plugin/commands/nested/circuit-extra.md',
        VALID_COMMAND_FILE_BODY('circuit:extra', 'Nested orphan'),
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/nested directory|flat-only grammar rejects nesting/);
    });
  });

  it('reds when commands/ contains a non-.md file (flat-grammar rejects)', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(root, '.claude-plugin/commands/README.txt', 'text');
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/non-\.md file/);
    });
  });

  // ── Codex MED 5 fold-in: YAML-aware empty-value detection.

  it('reds when a command file frontmatter `name` is YAML-empty (double quotes)', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(
        root,
        '.claude-plugin/commands/circuit-run.md',
        '---\nname: ""\ndescription: has desc\n---\n\nbody\n',
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/frontmatter missing non-empty `name`/);
    });
  });

  it('reds when a command file frontmatter `description` is YAML-empty (single quotes)', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(
        root,
        '.claude-plugin/commands/circuit-run.md',
        "---\nname: circuit:run\ndescription: ''\n---\n\nbody\n",
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/frontmatter missing non-empty `description`/);
    });
  });

  it('reds when a command file frontmatter `name` is an inline comment only', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(
        root,
        '.claude-plugin/commands/circuit-run.md',
        '---\nname: # just a comment\ndescription: has desc\n---\n\nbody\n',
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/frontmatter missing non-empty `name`/);
    });
  });

  it('reds when `description` is an empty folded scalar (> with no continuation)', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(
        root,
        '.claude-plugin/commands/circuit-run.md',
        '---\nname: circuit:run\ndescription: >\n---\n\nbody\n',
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/frontmatter missing non-empty `description`/);
    });
  });

  // ── Codex MED 6 fold-in: schema-level validation of the live manifest.

  it('live manifest parses under the independent plugin-manifest Zod schema', () => {
    const manifestText = readFileSync(join(REPO_ROOT, '.claude-plugin', 'plugin.json'), 'utf-8');
    const parsed = JSON.parse(manifestText);
    const result = PluginManifest.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `Live .claude-plugin/plugin.json failed Zod validation:\n${result.error.issues
          .map((i) => `  ${i.path.join('.')}: ${i.message}`)
          .join('\n')}`,
      );
    }
    // Both anchors must be present and bound to canonical files.
    const run = result.data.commands.find((c) => c.name === 'circuit:run');
    const explore = result.data.commands.find((c) => c.name === 'circuit:explore');
    expect(run?.file).toBe('commands/circuit-run.md');
    expect(explore?.file).toBe('commands/circuit-explore.md');
  });

  // ── Slice 56 (P2.11 plugin-wiring) fold-in: rule (g) placeholder rejection.
  // Pre-Slice-56 both command bodies carried "Not implemented yet" intentionally
  // because the runtime was unreachable from the plugin surface. Slice 56 wired
  // the commands to the CLI; the rule prevents regression that would silently
  // unwire without any structural audit failure.

  it('reds when a command body contains "Not implemented yet" (Slice 56 rule g)', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      // Overwrite circuit-explore.md with a body that contains the literal
      // placeholder substring the rule rejects.
      writeRel(
        root,
        '.claude-plugin/commands/circuit-explore.md',
        `---
name: circuit:explore
description: Explore placeholder description.
---

# /circuit:explore

Status: Not implemented yet. This file is a pre-Slice-56 scaffold.
`,
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/"Not implemented yet" placeholder/);
      expect(result.detail).toMatch(/Slice 56 \/ P2\.11/);
    });
  });

  it('passes when a command body is non-empty and does not contain the placeholder', () => {
    // Positive control — the valid scaffold body written by VALID_COMMAND_FILE_BODY
    // already contains neither the empty-body condition nor the placeholder
    // substring, so a scaffold with that body should still land green.
    withTempRepo((root) => {
      writeValidScaffold(root);
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('green');
    });
  });
});
