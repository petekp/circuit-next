import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { checkPluginCommandClosure } from '../../scripts/audit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

const PluginManifest = z
  .object({
    name: z.literal('circuit'),
    version: z.string().min(1),
    description: z.string().min(1),
    author: z.object({ name: z.string().min(1) }).optional(),
    keywords: z.array(z.string()).optional(),
  })
  .passthrough()
  .refine((manifest) => !Object.prototype.hasOwnProperty.call(manifest, 'commands'), {
    message: 'Claude Code derives plugin commands from root commands/*.md, not manifest.commands',
    path: ['commands'],
  });

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

const VALID_COMMAND_FILE_BODY = (desc: string) => `---
description: ${desc}
argument-hint: <task>
---

# Command scaffold

Non-empty body for plugin-command-closure audit check validation.
`;

function writeValidScaffold(root: string) {
  writeRel(
    root,
    '.claude-plugin/plugin.json',
    JSON.stringify(
      {
        name: 'circuit',
        version: '0.0.1',
        description: 'test fixture',
        author: { name: 'Test Author' },
        keywords: ['test'],
      },
      null,
      2,
    ),
  );
  writeRel(root, 'commands/run.md', VALID_COMMAND_FILE_BODY('Router placeholder'));
  writeRel(root, 'commands/explore.md', VALID_COMMAND_FILE_BODY('Explore placeholder'));
  writeRel(root, 'commands/review.md', VALID_COMMAND_FILE_BODY('Review placeholder'));
  writeRel(root, 'commands/build.md', VALID_COMMAND_FILE_BODY('Build placeholder'));
}

describe('checkPluginCommandClosure (ADR-0007 CC#P2-3 enforcement)', () => {
  it('passes on a valid Claude Code plugin layout with the current command set', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('green');
      expect(result.detail).toMatch(/commands\/\{run,explore,review,build\}\.md/);
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

  it('reds when plugin.json is a symlink', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      rmSync(join(root, '.claude-plugin/plugin.json'));
      writeRel(root, '.claude-plugin/manifest-target.json', JSON.stringify({ name: 'circuit' }));
      symlinkSync('manifest-target.json', join(root, '.claude-plugin/plugin.json'));
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/plugin\.json is a symlink/);
    });
  });

  it('reds when plugin.json parses to a non-object', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(root, '.claude-plugin/plugin.json', '["circuit"]');
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/must parse to a JSON object/);
    });
  });

  it('reds when plugin.json has an empty name', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(
        root,
        '.claude-plugin/plugin.json',
        JSON.stringify({ name: '', version: '0', description: 'd' }),
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/missing non-empty string `name`/);
    });
  });

  it('reds when plugin.json names a namespace other than circuit', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(
        root,
        '.claude-plugin/plugin.json',
        JSON.stringify({ name: 'circuit-next', version: '0', description: 'd' }),
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/expected `circuit`/);
    });
  });

  it('reds when plugin.json is missing a version', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(
        root,
        '.claude-plugin/plugin.json',
        JSON.stringify({ name: 'circuit', description: 'd' }),
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/missing non-empty string `version`/);
    });
  });

  it('reds when plugin.json has an empty version string', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(
        root,
        '.claude-plugin/plugin.json',
        JSON.stringify({ name: 'circuit', version: '   ', description: 'd' }),
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/missing non-empty string `version`/);
    });
  });

  it('reds when plugin.json is missing a description', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(
        root,
        '.claude-plugin/plugin.json',
        JSON.stringify({ name: 'circuit', version: '0' }),
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/missing non-empty string `description`/);
    });
  });

  it('reds when plugin.json carries the obsolete commands array', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(
        root,
        '.claude-plugin/plugin.json',
        JSON.stringify({
          name: 'circuit',
          version: '0',
          description: 'd',
          commands: [{ name: 'circuit:run', file: 'commands/run.md' }],
        }),
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(
        /Claude Code derives plugin commands from root `commands\/\*\.md`/,
      );
    });
  });

  it('reds when the root commands directory is missing', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      rmSync(join(root, 'commands'), { recursive: true, force: true });
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/root commands\/ directory missing/);
    });
  });

  it('reds when the root commands path is a symlink', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      rmSync(join(root, 'commands'), { recursive: true, force: true });
      mkdirSync(join(root, 'commands-target'));
      symlinkSync('commands-target', join(root, 'commands'));
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/commands\/ directory is a symlink/);
    });
  });

  it('reds when the root commands path is a file', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      rmSync(join(root, 'commands'), { recursive: true, force: true });
      writeRel(root, 'commands', 'not a directory');
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/commands\/ exists but is not a directory/);
    });
  });

  it('reds when a required command file is missing', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      rmSync(join(root, 'commands/run.md'));
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/required command file commands\/run\.md missing/);
    });
  });

  it('reds when an unexpected public command file is present', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(root, 'commands/orphan.md', VALID_COMMAND_FILE_BODY('Orphan placeholder'));
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/unexpected public command file commands\/orphan\.md/);
    });
  });

  it('reds when a command filename violates the flat basename grammar', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(root, 'commands/bad name.md', VALID_COMMAND_FILE_BODY('Bad name placeholder'));
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/violates grammar/);
    });
  });

  it('reds when commands/ contains a nested directory', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(root, 'commands/nested/extra.md', VALID_COMMAND_FILE_BODY('Nested placeholder'));
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/nested directory/);
    });
  });

  it('reds when commands/ contains a non-.md file', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(root, 'commands/README.txt', 'text');
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/non-\.md file/);
    });
  });

  it('reds when a command file is a symlink', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      rmSync(join(root, 'commands/run.md'));
      writeRel(root, 'commands/_target.md', VALID_COMMAND_FILE_BODY('symlink target'));
      symlinkSync('_target.md', join(root, 'commands/run.md'));
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/symlink/i);
    });
  });

  it('reds when a command file frontmatter declares name', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(
        root,
        'commands/run.md',
        '---\nname: circuit:run\ndescription: has body\n---\n\nbody\n',
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/frontmatter declares `name`/);
    });
  });

  it('reds when a command file is missing YAML frontmatter', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(root, 'commands/run.md', '# /circuit:run\n\nbody\n');
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/missing YAML frontmatter/);
    });
  });

  it('reds when a command file frontmatter has an empty description', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(root, 'commands/run.md', '---\ndescription: ""\n---\n\nbody\n');
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/missing non-empty `description`/);
    });
  });

  it('reds when a command file frontmatter has an empty argument hint', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(root, 'commands/run.md', '---\ndescription: desc\nargument-hint: ""\n---\n\nbody\n');
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/empty `argument-hint`/);
    });
  });

  it('reds when a command file body is empty', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(root, 'commands/run.md', '---\ndescription: desc\n---\n\n   \n');
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/body is empty/);
    });
  });

  it('reds when a command body contains "Not implemented yet"', () => {
    withTempRepo((root) => {
      writeValidScaffold(root);
      writeRel(
        root,
        'commands/explore.md',
        `---
description: Explore placeholder description.
---

# /circuit:explore

Status: Not implemented yet. This file is a pre-Slice-56 scaffold.
`,
      );
      const result = checkPluginCommandClosure(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/"Not implemented yet" placeholder/);
    });
  });

  it('passes the live repo plugin surface (end-to-end self-check)', () => {
    const result = checkPluginCommandClosure();
    expect(result.level).toBe('green');
  });

  it('live manifest parses under the independent Claude plugin-manifest Zod schema', () => {
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
    expect(readFileSync(join(REPO_ROOT, 'commands', 'run.md'), 'utf-8')).toContain('/circuit:run');
    expect(readFileSync(join(REPO_ROOT, 'commands', 'explore.md'), 'utf-8')).toContain(
      '/circuit:explore',
    );
    expect(readFileSync(join(REPO_ROOT, 'commands', 'review.md'), 'utf-8')).toContain(
      '/circuit:review',
    );
    expect(readFileSync(join(REPO_ROOT, 'commands', 'build.md'), 'utf-8')).toContain(
      '/circuit:build',
    );
  });
});
