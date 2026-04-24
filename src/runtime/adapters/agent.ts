import { type ChildProcess, spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import type { Effort } from '../../schemas/selection-policy.js';
import {
  type AdapterDispatchInput,
  type DispatchResult,
  selectedModelForProvider,
  sha256Hex,
} from './shared.js';

export { sha256Hex };

// Slice 42 — P2.4 real agent adapter. Invokes the Claude Code CLI as a
// subprocess of the Node.js runtime per ADR-0009 §1 (subprocess-per-adapter
// for v0). No external SDK dependency; Node stdlib only
// (`node:child_process` + `node:perf_hooks` here; `node:crypto` via
// `./shared.ts` for the shared `sha256Hex` helper).
//
// Capability boundary (Slice 40 HIGH 3 + ADR-0009 §2.v + Slice 41 Codex
// HIGH 4 + Slice 42 Codex HIGH 2 runtime-binding fold-in). The subprocess
// ships with NO repo-write tool capability at v0. Enforcement is
// two-layered:
//   (a) Flag combo (AGENT_NO_WRITE_FLAGS below) configures the subprocess
//       to emit an init event reporting empty tool / MCP / slash-command
//       surfaces.
//   (b) parseAgentStdout() is fail-closed: the subprocess's init event
//       must report `tools: []`, `mcp_servers: []`, `slash_commands: []`
//       at every dispatch. A future flag regression that silently widens
//       any of those three surfaces is caught by the parse-time assertion
//       before the adapter result reaches any downstream event-writer.
// Each flag in AGENT_NO_WRITE_FLAGS is load-bearing:
//   --tools ""             — zeroes the built-in tool surface (Write, Edit,
//                            Bash, MultiEdit, NotebookEdit, Read, Grep, Glob,
//                            WebFetch, etc. all removed).
//   --strict-mcp-config    — empty MCP server list; no remote-write paths
//                            via MCP (Gmail, Notion, Slack, etc. all removed).
//   --disable-slash-commands — zero skill/slash surface; no skill can
//                            re-introduce a write-tool path.
//   --setting-sources ''   — skip user, project, and local settings files.
//                            Prevents operator-configured hooks from firing
//                            inside the adapter subprocess (e.g. the
//                            project's Stop hook that runs
//                            `.claude/hooks/auto-handoff-guard.sh`, which
//                            would otherwise deadlock the subprocess via
//                            hook-feedback retry loops when spawned from
//                            within circuit-next). Capability-relevant:
//                            user hooks can carry arbitrary shell commands,
//                            so inheriting them would re-import a write
//                            surface below the --tools "" gate.
//   --settings '{}'        — explicit empty inline settings override so
//                            nothing (including keychain reads for stray
//                            settings) reintroduces a hook registration.
//   --output-format stream-json — NDJSON event stream (one object per line).
//                            Codex Slice 42 HIGH 1 fold-in: the documented
//                            `json` format is labelled "single result" in
//                            the CLI help, while observed behaviour returns
//                            an array; `stream-json` is the explicitly
//                            documented streaming protocol and is robust
//                            against future format-shape drift.
//                            `stream-json` requires `--verbose`.
//   --verbose              — required by `--output-format stream-json`.
//   --no-session-persistence — ephemeral session; no resumable session file
//                            written under ~/.claude/projects/** per run.
// Auto-memory writes under ~/.claude/projects/<cwd>/memory/ happen outside
// the repo working tree and do not violate the no-repo-write boundary.
// If any of these assumptions change upstream (Claude CLI version bump
// changes flag semantics, new write-capable tool added to the default
// surface, or capability boundary slips for any reason), ADR-0009 §6
// reopen trigger 5 fires.
export const AGENT_NO_WRITE_FLAGS = [
  '-p',
  '--tools',
  '',
  '--strict-mcp-config',
  '--disable-slash-commands',
  '--setting-sources',
  '',
  '--settings',
  '{}',
  '--output-format',
  'stream-json',
  '--verbose',
  '--no-session-persistence',
] as const;

export const AGENT_CLAUDE_EXECUTABLE = 'claude';
export const AGENT_SUPPORTED_EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const;

// Default wall-clock budget for a single dispatch. A step's
// `budgets.wall_clock_ms` (per src/schemas/step.ts StepBase.budgets)
// overrides this when present.
const DEFAULT_TIMEOUT_MS = 120_000;

// Grace period between SIGTERM and SIGKILL per Codex Slice 42 HIGH 4
// subprocess-kill hygiene fold-in. SIGTERM gives the subprocess a chance
// to close cleanly; if it is still alive after this window, SIGKILL is
// delivered and we resolve only after `close` actually fires.
const SIGTERM_TO_SIGKILL_GRACE_MS = 2_000;

// stdout / stderr caps per Codex Slice 42 HIGH 4. A misbehaving subprocess
// emitting an unbounded byte stream should not exhaust adapter memory.
// Real dispatch transcripts for v0 are well under these bounds (the
// smoke test produces ~30 KB). 16 MiB stdout + 1 MiB stderr is the
// current ceiling; ADR-0009 §6 reopen trigger 5 covers ceiling adjustment
// if a legitimate dispatch needs more.
const STDOUT_MAX_BYTES = 16 * 1024 * 1024;
const STDERR_MAX_BYTES = 1024 * 1024;

export interface AgentDispatchInput extends AdapterDispatchInput {}

// The `AgentDispatchResult` name is retained as the adapter-specific
// alias for call sites that want a name bound to the `agent` adapter's
// producer contract. Slice 45 (P2.6) extracted the shape to
// `./shared.ts` `DispatchResult` so the `codex` adapter produces the
// same shape and the materializer consumes it uniformly.
export type AgentDispatchResult = DispatchResult;

function assertAgentEffort(
  effort: Effort,
): asserts effort is (typeof AGENT_SUPPORTED_EFFORTS)[number] {
  if (!(AGENT_SUPPORTED_EFFORTS as readonly string[]).includes(effort)) {
    throw new Error(
      `agent adapter cannot honor effort '${effort}'; supported efforts: ${AGENT_SUPPORTED_EFFORTS.join(', ')}`,
    );
  }
}

export function buildAgentArgs(input: AgentDispatchInput): string[] {
  const args: string[] = [...AGENT_NO_WRITE_FLAGS];
  const model = selectedModelForProvider('agent', input.resolvedSelection, 'anthropic');
  if (model !== undefined) {
    args.push('--model', model);
  }
  const effort = input.resolvedSelection?.effort;
  if (effort !== undefined) {
    assertAgentEffort(effort);
    args.push('--effort', effort);
  }
  args.push(input.prompt);
  return args;
}

export async function dispatchAgent(input: AgentDispatchInput): Promise<DispatchResult> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const args = buildAgentArgs(input);
  const start = performance.now();
  return await new Promise<DispatchResult>((resolve, reject) => {
    let child: ChildProcess;
    try {
      // stdin is `ignore` (connected to /dev/null) not `pipe`: the claude
      // CLI in `-p` mode may otherwise block reading stdin when spawned
      // without a controlling terminal. Closing stdin at the
      // stdio-inheritance layer is more reliable than opening the pipe
      // and calling .end() because there is no race between spawn and
      // first-byte read.
      //
      // `detached: true` puts the subprocess in its own process group so
      // the timeout-kill path can signal the group (Codex Slice 42 HIGH 4
      // subprocess-containment fold-in); if claude itself spawns helper
      // processes, they are killed via the group kill.
      child = spawn(AGENT_CLAUDE_EXECUTABLE, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        // Inherit the parent process's environment explicitly. Some test
        // harnesses (vitest workers) launch children through a process-
        // pool whose env may not be identical to the top-level node
        // process's env; passing `process.env` directly makes the
        // auth/session inheritance unambiguous.
        env: process.env,
        detached: true,
      });
    } catch (err) {
      reject(new Error(`agent subprocess spawn failed: ${(err as Error).message}`));
      return;
    }
    let stdout = '';
    let stdoutBytes = 0;
    let stderr = '';
    let stderrBytes = 0;
    let stdoutCapped = false;
    let stderrCapped = false;
    let timedOut = false;
    let killGroupSucceeded = false;

    const killProcessGroup = (signal: NodeJS.Signals): boolean => {
      // `child.pid` is undefined until spawn succeeds. With detached:true,
      // the negative pid addresses the process group (POSIX).
      const pid = child.pid;
      if (typeof pid !== 'number') return false;
      try {
        process.kill(-pid, signal);
        return true;
      } catch {
        // Fallback: direct signal to the child itself.
        try {
          child.kill(signal);
          return true;
        } catch {
          return false;
        }
      }
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killGroupSucceeded = killProcessGroup('SIGTERM');
      // Escalate to SIGKILL after the grace window. We do NOT reject here —
      // resolution / rejection is deferred to the `close` handler so the
      // promise settles only after the subprocess has actually exited.
      setTimeout(() => {
        killProcessGroup('SIGKILL');
      }, SIGTERM_TO_SIGKILL_GRACE_MS);
    }, timeoutMs);

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      if (stdoutBytes + chunk.length > STDOUT_MAX_BYTES) {
        stdoutCapped = true;
        // Keep the head; drop the overflow. 16 MiB is already enough
        // context for any v0-era parse error; further bytes would just
        // slow us down without improving signal.
        return;
      }
      stdout += chunk;
      stdoutBytes += chunk.length;
    });
    child.stderr?.on('data', (chunk: string) => {
      if (stderrBytes + chunk.length > STDERR_MAX_BYTES) {
        stderrCapped = true;
        return;
      }
      stderr += chunk;
      stderrBytes += chunk.length;
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`agent subprocess spawn error: ${err.message}`));
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const duration_ms = performance.now() - start;
      if (timedOut) {
        reject(
          new Error(
            `agent subprocess timed out after ${timeoutMs}ms; group-kill ${killGroupSucceeded ? 'sent' : 'failed'}; final signal=${signal ?? 'none'}; stderr[:500]=${stderr.slice(0, 500)}`,
          ),
        );
        return;
      }
      if (code !== 0) {
        reject(
          new Error(
            `agent subprocess exited with code ${code}${signal ? ` (signal ${signal})` : ''}; stderr[:500]=${stderr.slice(0, 500)}`,
          ),
        );
        return;
      }
      if (stdoutCapped) {
        reject(
          new Error(
            `agent subprocess stdout exceeded ${STDOUT_MAX_BYTES} bytes; capability-boundary check cannot be evaluated on truncated stream`,
          ),
        );
        return;
      }
      try {
        resolve(parseAgentStdout(stdout, input.prompt, duration_ms));
      } catch (err) {
        const stderrSuffix = stderrCapped ? ' [stderr capped]' : '';
        reject(
          new Error(
            `agent subprocess: ${(err as Error).message}; stdout[:500]=${stdout.slice(0, 500)}; stderr[:200]=${stderr.slice(0, 200)}${stderrSuffix}`,
          ),
        );
      }
    });
  });
}

// Parsing is extracted so contract tests can exercise the parse branch
// without spawning a real subprocess. The claude CLI emits one JSON
// object per line (NDJSON) under `--output-format stream-json --verbose`.
// We need:
//   - the `{type:'system', subtype:'init'}` event (for session_id + the
//     tool-surface assertion);
//   - the terminal `{type:'result'}` event (for the text result).
// Fail-closed contract (Codex Slice 42 HIGH 2 runtime-binding fold-in):
// the init event MUST report `tools: []`, `mcp_servers: []`,
// `slash_commands: []`. If any of those three arrays is non-empty at
// parse time, the dispatch is rejected — the capability-boundary claim
// is bound at every runtime call, not just at test time.
export function parseAgentStdout(
  stdout: string,
  prompt: string,
  duration_ms: number,
): DispatchResult {
  const lines = stdout.split('\n').filter((line) => line.length > 0);
  if (lines.length === 0) {
    throw new Error('stream-json stdout is empty');
  }
  const events: Array<Record<string, unknown>> = [];
  for (const [idx, line] of lines.entries()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      throw new Error(
        `stream-json line ${idx + 1} is not valid JSON: ${(err as Error).message}; line[:200]=${line.slice(0, 200)}`,
      );
    }
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error(`stream-json line ${idx + 1} is not a JSON object`);
    }
    events.push(parsed as Record<string, unknown>);
  }

  // Filter strictly for `subtype === 'init'` per Codex Slice 42 MED 4.
  const initEvent = events.find((e) => e.type === 'system' && e.subtype === 'init');
  // Take the LAST result event (terminal), not the first, per Codex
  // Slice 42 MED 4. `stream-json` emits a single terminal result event at
  // v0, but depending on future CLI changes multiple result events could
  // appear; the terminal one is authoritative.
  const resultEvents = events.filter((e) => e.type === 'result');
  const resultEvent = resultEvents[resultEvents.length - 1];

  if (initEvent === undefined) {
    throw new Error('system/init event missing from subprocess stdout');
  }
  if (resultEvent === undefined) {
    throw new Error('result event missing from subprocess stdout');
  }
  if (resultEvent.is_error === true) {
    const message = typeof resultEvent.result === 'string' ? resultEvent.result : '<no message>';
    throw new Error(`subprocess reported is_error: ${message}`);
  }

  // --- Capability-boundary runtime assertion (HIGH 2 fold-in) -----------
  // The init event enumerates every tool/MCP/slash surface available to
  // the subprocess. If any of these three arrays is non-empty, a
  // write-capable tool path MIGHT have been available to the dispatch —
  // the ADR-0009 §2.v capability-boundary claim is violated at runtime,
  // regardless of whether any tool was actually invoked. Fail closed.
  const tools = initEvent.tools;
  const mcpServers = initEvent.mcp_servers;
  const slashCommands = initEvent.slash_commands;
  if (!Array.isArray(tools) || tools.length !== 0) {
    throw new Error(
      `capability-boundary violation: init.tools must be []; got ${JSON.stringify(tools)}. ADR-0009 §2.v + Slice 41 Codex HIGH 4 require zero tool surface. Check AGENT_NO_WRITE_FLAGS.`,
    );
  }
  if (!Array.isArray(mcpServers) || mcpServers.length !== 0) {
    throw new Error(
      `capability-boundary violation: init.mcp_servers must be []; got ${JSON.stringify(mcpServers)}. ADR-0009 §2.v + Slice 41 Codex HIGH 4 require zero MCP surface.`,
    );
  }
  if (!Array.isArray(slashCommands) || slashCommands.length !== 0) {
    throw new Error(
      `capability-boundary violation: init.slash_commands must be []; got ${JSON.stringify(slashCommands)}. ADR-0009 §2.v + Slice 41 Codex HIGH 4 require zero slash-command surface.`,
    );
  }

  const receipt_id = initEvent.session_id;
  const result_body = resultEvent.result;
  const cli_version = initEvent.claude_code_version;
  if (typeof receipt_id !== 'string' || receipt_id.length === 0) {
    throw new Error('init.session_id missing or empty');
  }
  if (typeof result_body !== 'string') {
    throw new Error('result.result missing or not a string');
  }
  if (typeof cli_version !== 'string' || cli_version.length === 0) {
    throw new Error('init.claude_code_version missing or empty');
  }
  return {
    request_payload: prompt,
    receipt_id,
    result_body,
    duration_ms,
    cli_version,
  };
}
