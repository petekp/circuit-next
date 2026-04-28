// Terminology regression test for product-facing prose.
//
// circuit-next teaches users a small layered vocabulary:
//
//   flow / schematic / block / route / relay / check / trace / report /
//   evidence / run folder / depth / mode / checkpoint
//
// Internal runtime/schema names (Workflow / Adapter / Artifact / Gate /
// Dispatch / Synthesis) may remain in low-level code, but they MUST NOT
// leak into product-facing prose: README, AGENTS, slash commands,
// per-flow command sources, per-flow contracts, or the workflow design
// notes. docs/terminology.md is the one place those internal names are
// allowed to appear in prose, because it documents the layered model.
//
// Scoped narrow on purpose. The intent is to keep the user-facing
// surface clean; deeper code-level renames (recipe → schematic file
// rename, primitive → block rename, etc.) are tracked elsewhere in
// todos/terminology-migration.md.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const BANNED: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }> = [
  { name: 'recipe', pattern: /\brecipe(s)?\b/i },
  { name: 'primitive', pattern: /\bprimitive(s)?\b/i },
  { name: 'dispatch', pattern: /\bdispatch(?:es|ed|ing)?\b/i },
  { name: 'synthesis', pattern: /\bsynthesis\b/i },
  { name: 'orchestrator-synthesis', pattern: /\borchestrator-synthesis\b/i },
  { name: 'artifact pointer', pattern: /\bartifact pointer(s)?\b/i },
  { name: 'canonical event log', pattern: /\bcanonical event log\b/i },
  { name: 'run root', pattern: /\brun root\b/i },
  { name: 'rigor', pattern: /\brigor\b/i },
  { name: 'lane', pattern: /\blane\b/i },
  { name: 'spine', pattern: /\bspine\b/i },
  { name: 'fixture', pattern: /\bfixture(s)?\b/i },
  { name: 'ADR-NNN id', pattern: /\bADR-[0-9]+\b/i },
  { name: 'Slice', pattern: /\bSlice\b/ },
  { name: 'CC#P[0-9]', pattern: /\bCC#P[0-9]/i },
  { name: 'placeholder-parity', pattern: /\bplaceholder-parity\b/i },
  { name: 'dogfood', pattern: /\bdogfood\b/i },
];

// Files where the banned vocabulary is allowed to appear in prose
// because the file documents the layered model itself.
const EXEMPT_FILES = new Set<string>(['docs/terminology.md']);

// Strip YAML frontmatter, fenced code blocks, and inline code spans.
// What remains is the prose surface that should teach the new vocabulary.
function stripCodeAndFrontmatter(source: string): string {
  let s = source;

  // Frontmatter at file head (--- ... ---). Only the first occurrence,
  // and only if the very first non-newline characters open it.
  if (s.startsWith('---\n')) {
    const end = s.indexOf('\n---', 4);
    if (end !== -1) {
      const lineBreak = s.indexOf('\n', end + 4);
      s = lineBreak === -1 ? '' : s.slice(lineBreak + 1);
    }
  }

  // Fenced code blocks. Matches ```lang? ... ```.
  s = s.replace(/```[\s\S]*?```/g, '');

  // Inline code spans. Single-backtick runs that don't span multiple
  // lines.
  s = s.replace(/`[^`\n]*`/g, '');

  // Markdown link targets — keep the link text, drop the URL/path.
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

  // HTML comments — these are doc-only markers, not prose.
  s = s.replace(/<!--[\s\S]*?-->/g, '');

  return s;
}

// Catalog the files this test guards. We list explicit roots and walk
// directories so adding a new flow or doc doesn't silently dodge the
// gate.
function listProductFacingFiles(): readonly string[] {
  const files: string[] = [];

  files.push('README.md');
  files.push('AGENTS.md');
  files.push('.claude-plugin/README.md');

  // Slash commands: hand-authored run.md plus generated per-flow files.
  for (const entry of readdirSync('commands')) {
    if (entry.endsWith('.md')) {
      files.push(join('commands', entry));
    }
  }

  // Per-flow command and contract sources.
  for (const id of readdirSync('src/workflows')) {
    const dir = join('src/workflows', id);
    let isDir = false;
    try {
      isDir = statSync(dir).isDirectory();
    } catch {
      isDir = false;
    }
    if (!isDir) continue;
    const command = join(dir, 'command.md');
    const contract = join(dir, 'contract.md');
    try {
      if (statSync(command).isFile()) files.push(command);
    } catch {
      // not present
    }
    try {
      if (statSync(contract).isFile()) files.push(contract);
    } catch {
      // not present
    }
  }

  // Flow design notes.
  for (const entry of readdirSync('docs/workflows')) {
    if (entry.endsWith('.md')) {
      files.push(join('docs/workflows', entry));
    }
  }

  return files.filter((f) => !EXEMPT_FILES.has(f));
}

describe('terminology — product-facing prose', () => {
  // Anti-vacuity floor: if file discovery breaks (wrong root, missing
  // workflow folders, etc.), this test would silently pass. Pin a
  // realistic minimum and surface a clear failure if it drops.
  it('discovers a non-trivial set of product-facing files', () => {
    const files = listProductFacingFiles();
    expect(
      files.length,
      'product-facing file discovery is unexpectedly small — the test would pass vacuously',
    ).toBeGreaterThanOrEqual(15);
  });

  it('product-facing prose uses the canonical Circuit vocabulary', () => {
    const offenders: {
      readonly file: string;
      readonly term: string;
      readonly line: number;
      readonly text: string;
    }[] = [];

    for (const file of listProductFacingFiles()) {
      const raw = readFileSync(file, 'utf8');
      const stripped = stripCodeAndFrontmatter(raw);
      const lines = stripped.split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        const text = lines[index];
        if (text === undefined) continue;
        for (const { name, pattern } of BANNED) {
          if (pattern.test(text)) {
            offenders.push({ file, term: name, line: index + 1, text: text.trim() });
          }
        }
      }
    }

    expect(
      offenders,
      [
        'Banned terminology found in product-facing prose.',
        'See docs/terminology.md for the canonical vocabulary;',
        'internal/runtime names belong inside backticks or fenced code,',
        'or in low-level engine modules, not in product surfaces.',
      ].join(' '),
    ).toEqual([]);
  });
});
