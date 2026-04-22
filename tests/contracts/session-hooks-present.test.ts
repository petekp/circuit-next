import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { checkSessionHooksPresent } from '../../scripts/audit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

// Slice 46 (P2.7a, ADR-0007 §Decision.1 CC#P2-4 first-half binding) —
// contract tests for `scripts/audit.mjs` Check 33
// `checkSessionHooksPresent`. The check enforces:
//   (a) `.claude/hooks/SessionStart.sh` and `.claude/hooks/SessionEnd.sh`
//       exist on disk;
//   (b) both files are executable (any of owner/group/other +x bit);
//   (c) both files reference `circuit-engine continuity` in their body;
//   (d) `.claude/settings.json` declares both events with at least one
//       command pointing into the matching hook script, AND the
//       SessionStart entry's matcher covers `startup|resume|clear|compact`.

const VALID_SESSION_START_SCRIPT = `#!/usr/bin/env bash
# minimal valid SessionStart hook
.circuit/bin/circuit-engine continuity status --json >/dev/null 2>&1 || true
`;

const VALID_SESSION_END_SCRIPT = `#!/usr/bin/env bash
# minimal valid SessionEnd hook
.circuit/bin/circuit-engine continuity status >/dev/null 2>&1 || true
`;

const VALID_SETTINGS = {
  hooks: {
    SessionStart: [
      {
        matcher: 'startup|resume|clear|compact',
        hooks: [
          {
            type: 'command',
            command: '${CLAUDE_PROJECT_DIR}/.claude/hooks/SessionStart.sh',
          },
        ],
      },
    ],
    SessionEnd: [
      {
        hooks: [
          {
            type: 'command',
            command: '${CLAUDE_PROJECT_DIR}/.claude/hooks/SessionEnd.sh',
          },
        ],
      },
    ],
  },
};

function withTempRoot(fn: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'circuit-next-46-session-hooks-'));
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function scaffoldValidHookSurface(root: string) {
  const hooksDir = join(root, '.claude/hooks');
  mkdirSync(hooksDir, { recursive: true });
  const startPath = join(hooksDir, 'SessionStart.sh');
  const endPath = join(hooksDir, 'SessionEnd.sh');
  writeFileSync(startPath, VALID_SESSION_START_SCRIPT);
  writeFileSync(endPath, VALID_SESSION_END_SCRIPT);
  chmodSync(startPath, 0o755);
  chmodSync(endPath, 0o755);
  writeFileSync(join(root, '.claude/settings.json'), JSON.stringify(VALID_SETTINGS, null, 2));
}

describe('Check 33 — session hooks present (Slice 46 / ADR-0007 CC#P2-4 first-half)', () => {
  it('green on the live repo (real session hooks land in this slice)', () => {
    const result = checkSessionHooksPresent(REPO_ROOT);
    expect(result.level).toBe('green');
    expect(result.detail).toContain('SessionStart.sh');
    expect(result.detail).toContain('SessionEnd.sh');
    expect(result.detail).toContain('startup|resume|clear|compact');
  });

  it('green on a synthetic minimal-valid hook surface (scaffold sanity)', () => {
    withTempRoot((root) => {
      scaffoldValidHookSurface(root);
      const result = checkSessionHooksPresent(root);
      expect(result.level).toBe('green');
    });
  });

  it('red when SessionStart.sh is missing', () => {
    withTempRoot((root) => {
      scaffoldValidHookSurface(root);
      rmSync(join(root, '.claude/hooks/SessionStart.sh'));
      const result = checkSessionHooksPresent(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/SessionStart\.sh missing/);
    });
  });

  it('red when SessionEnd.sh is missing', () => {
    withTempRoot((root) => {
      scaffoldValidHookSurface(root);
      rmSync(join(root, '.claude/hooks/SessionEnd.sh'));
      const result = checkSessionHooksPresent(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/SessionEnd\.sh missing/);
    });
  });

  it('red when SessionStart.sh exists but is not executable', () => {
    withTempRoot((root) => {
      scaffoldValidHookSurface(root);
      chmodSync(join(root, '.claude/hooks/SessionStart.sh'), 0o644);
      const result = checkSessionHooksPresent(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/SessionStart\.sh is not executable/);
    });
  });

  it('red when SessionEnd.sh exists but is not executable', () => {
    withTempRoot((root) => {
      scaffoldValidHookSurface(root);
      chmodSync(join(root, '.claude/hooks/SessionEnd.sh'), 0o644);
      const result = checkSessionHooksPresent(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/SessionEnd\.sh is not executable/);
    });
  });

  it('red when SessionStart.sh does not reference circuit-engine continuity', () => {
    withTempRoot((root) => {
      scaffoldValidHookSurface(root);
      writeFileSync(join(root, '.claude/hooks/SessionStart.sh'), '#!/usr/bin/env bash\necho hi\n');
      chmodSync(join(root, '.claude/hooks/SessionStart.sh'), 0o755);
      const result = checkSessionHooksPresent(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(
        /SessionStart\.sh does not reference 'circuit-engine continuity'/,
      );
    });
  });

  it('red when SessionEnd.sh does not reference circuit-engine continuity', () => {
    withTempRoot((root) => {
      scaffoldValidHookSurface(root);
      writeFileSync(join(root, '.claude/hooks/SessionEnd.sh'), '#!/usr/bin/env bash\necho bye\n');
      chmodSync(join(root, '.claude/hooks/SessionEnd.sh'), 0o755);
      const result = checkSessionHooksPresent(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(
        /SessionEnd\.sh does not reference 'circuit-engine continuity'/,
      );
    });
  });

  it('red when settings.json is missing entirely', () => {
    withTempRoot((root) => {
      scaffoldValidHookSurface(root);
      rmSync(join(root, '.claude/settings.json'));
      const result = checkSessionHooksPresent(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/settings\.json read\/parse failed/);
    });
  });

  it('red when settings.json is malformed JSON', () => {
    withTempRoot((root) => {
      scaffoldValidHookSurface(root);
      writeFileSync(join(root, '.claude/settings.json'), '{ not valid json');
      const result = checkSessionHooksPresent(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/settings\.json read\/parse failed/);
    });
  });

  it('red when settings.json has no hooks.SessionStart entries', () => {
    withTempRoot((root) => {
      scaffoldValidHookSurface(root);
      const settings = structuredClone(VALID_SETTINGS) as typeof VALID_SETTINGS;
      settings.hooks.SessionStart = [];
      writeFileSync(join(root, '.claude/settings.json'), JSON.stringify(settings, null, 2));
      const result = checkSessionHooksPresent(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/missing 'hooks\.SessionStart' entries/);
    });
  });

  it('red when settings.json has no hooks.SessionEnd entries', () => {
    withTempRoot((root) => {
      scaffoldValidHookSurface(root);
      const settings = structuredClone(VALID_SETTINGS) as typeof VALID_SETTINGS;
      settings.hooks.SessionEnd = [];
      writeFileSync(join(root, '.claude/settings.json'), JSON.stringify(settings, null, 2));
      const result = checkSessionHooksPresent(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/missing 'hooks\.SessionEnd' entries/);
    });
  });

  it('red when SessionStart matcher is missing one of {startup, resume, clear, compact}', () => {
    withTempRoot((root) => {
      scaffoldValidHookSurface(root);
      const settings = structuredClone(VALID_SETTINGS) as typeof VALID_SETTINGS;
      const startEntry = settings.hooks.SessionStart[0];
      if (!startEntry) throw new Error('test fixture invariant: SessionStart[0] must exist');
      startEntry.matcher = 'startup|resume';
      writeFileSync(join(root, '.claude/settings.json'), JSON.stringify(settings, null, 2));
      const result = checkSessionHooksPresent(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(/matcher does not cover all required reasons/);
    });
  });

  it('red when settings.json points to a different SessionStart script', () => {
    withTempRoot((root) => {
      scaffoldValidHookSurface(root);
      const settings = structuredClone(VALID_SETTINGS) as typeof VALID_SETTINGS;
      const startEntry = settings.hooks.SessionStart[0];
      const startHook = startEntry?.hooks[0];
      if (!startHook)
        throw new Error('test fixture invariant: SessionStart[0].hooks[0] must exist');
      startHook.command = '/some/other/script.sh';
      writeFileSync(join(root, '.claude/settings.json'), JSON.stringify(settings, null, 2));
      const result = checkSessionHooksPresent(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(
        /no entry contains a command pointing into .claude\/hooks\/SessionStart\.sh/,
      );
    });
  });

  it('red when settings.json points to a different SessionEnd script', () => {
    withTempRoot((root) => {
      scaffoldValidHookSurface(root);
      const settings = structuredClone(VALID_SETTINGS) as typeof VALID_SETTINGS;
      const endEntry = settings.hooks.SessionEnd[0];
      const endHook = endEntry?.hooks[0];
      if (!endHook) throw new Error('test fixture invariant: SessionEnd[0].hooks[0] must exist');
      endHook.command = '/some/other/script.sh';
      writeFileSync(join(root, '.claude/settings.json'), JSON.stringify(settings, null, 2));
      const result = checkSessionHooksPresent(root);
      expect(result.level).toBe('red');
      expect(result.detail).toMatch(
        /no entry contains a command pointing into .claude\/hooks\/SessionEnd\.sh/,
      );
    });
  });
});
