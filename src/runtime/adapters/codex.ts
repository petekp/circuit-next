import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import type { Effort } from '../../schemas/selection-policy.js';
import type { AdapterDispatchInput, DispatchResult } from './shared.js';
import { extractJsonObject, selectedModelForProvider } from './shared.js';

// Slice 45 — P2.6 real codex adapter. Invokes the Codex CLI as a
// subprocess of the Node.js runtime per ADR-0009 §1 (subprocess-per-
// adapter for v0). Mirrors the Slice 42 `agent.ts` template: no external
// SDK dependency, Node stdlib only (`node:child_process` +
// `node:perf_hooks`; `node:crypto` via `./shared.ts`).
//
// Capability boundary — OS-level sandbox, different mechanism from
// `agent`. Where the `agent` adapter layers the `claude -p` declarative
// tool-list flags (`--tools ""`, `--strict-mcp-config`,
// `--disable-slash-commands`) with a parse-time assertion against the
// subprocess's init event, the `codex` adapter's boundary is enforced
// by Codex's OS-level sandbox (Seatbelt on macOS, Landlock on Linux)
// via `codex exec -s read-only`. The sandbox gates write syscalls at
// the process level, not at the declarative-tool level, so the
// parse-time assertion shape does not transfer — Codex's `--json`
// stream does not emit an init event enumerating tool surfaces.
//
// The P2.6 capability-boundary proof is therefore two-layered:
//   (a) Argv-constant assertion at spawn time — `CODEX_NO_WRITE_FLAGS`
//       MUST include `-s read-only` AND MUST NOT include
//       `--dangerously-bypass-approvals-and-sandbox`. Both facts are
//       provable at module-load time (the assertions fire in a
//       frozen constant) and bound by contract tests at
//       `tests/contracts/slice-45-codex-adapter.test.ts`.
//   (b) Event-stream capability discipline — `parseCodexStdout()` is
//       fail-closed against missing `thread.started` events (no session
//       identifier available), missing / malformed terminal
//       `agent_message`, or `item.completed` events carrying
//       unexpected `item.type` values. A future Codex CLI version that
//       reintroduces a write-capable tool event would surface as an
//       unexpected item type and be rejected rather than silently
//       passed through.
//
// Each flag in `CODEX_NO_WRITE_FLAGS` is load-bearing:
//   'exec'                      — subcommand selecting non-interactive
//                                 run.
//   '--json'                    — JSONL events on stdout (one object
//                                 per line). Pure stream; stderr carries
//                                 Codex's skills-loader tracing noise
//                                 separately.
//   '-s', 'read-only'           — sandbox policy. The capability-
//                                 boundary anchor. `workspace-write`
//                                 and `danger-full-access` are the two
//                                 other values; both are forbidden
//                                 under this adapter's invariant.
//   '--ephemeral'               — no session file persisted under
//                                 `~/.codex/sessions/**`. Analog of the
//                                 agent adapter's `--no-session-
//                                 persistence`.
//   '--skip-git-repo-check'     — allow running outside a git repo
//                                 (the subprocess-cwd passed by the
//                                 runtime may or may not be a git
//                                 worktree; Codex's default is to
//                                 refuse non-repo cwd).
//
// If any of these assumptions change upstream (Codex CLI version bump
// changes flag semantics; sandbox policy enum grows a new value that
// bypasses read-only; `--json` format changes shape), ADR-0009 §6
// reopen trigger 5 (adapter-level capability regression) fires.
export const CODEX_NO_WRITE_FLAGS = Object.freeze([
  'exec',
  '--json',
  '-s',
  'read-only',
  '--ephemeral',
  '--skip-git-repo-check',
] as const);

export const CODEX_EXECUTABLE = 'codex';

// Forbidden flag / prefix set. Any of these in the spawn argv would
// undermine the `-s read-only` capability boundary:
//
//   --dangerously-bypass-approvals-and-sandbox
//     Skips all confirmations AND disables the sandbox entirely.
//   --full-auto
//     Codex convenience alias for `-a on-request --sandbox workspace-
//     write`; silently widens the sandbox to writable.
//   --add-dir <DIR>
//     Extends the writable root set — any directory passed here
//     becomes writable even under `-s read-only`.
//   -o / --output-last-message <FILE>
//     Codex CLI native write path: Codex writes the final message to
//     the named file regardless of model sandbox. This is a direct
//     repo-write surface that bypasses the `-s read-only` model
//     sandbox because it is performed by the Codex CLI wrapper, not
//     by a sandboxed model-invoked shell command.
//   -c / --config <key=value>
//     Can override `sandbox_mode` / `sandbox_permissions` /
//     `shell_environment_policy` / `approval_policy` and therefore
//     disable the boundary from inside config rather than argv. Slice 87
//     adds one controlled exception outside CODEX_NO_WRITE_FLAGS:
//     buildCodexArgs may emit `-c model_reasoning_effort="<effort>"`
//     from the adapter-owned effort allowlist. assertCodexSpawnArgvBoundary()
//     validates the final spawn argv so no caller-authored config key is
//     ever accepted.
//   -p / --profile <NAME>
//     Loads a named profile from `~/.codex/config.toml`; profiles can
//     carry sandbox / approval / MCP-server / shell-env overrides
//     that re-widen the surface outside the module's visibility.
//   --sandbox <MODE>
//     Long-form sandbox override. The one allowed sandbox declaration is
//     the base `-s read-only` pair in CODEX_NO_WRITE_FLAGS; any later
//     sandbox flag would let argv order re-widen the boundary.
//
// The module-load assertion below rejects any of these as either an
// exact token match or a prefix (the `<arg>` variants like
// `--add-dir` take the next argv slot, but a `-c sandbox_mode="..."`
// reaching this assertion would still fire on the `-c` match if it were
// added to CODEX_NO_WRITE_FLAGS).
//
// Codex Slice 45 HIGH 2 fold-in (2026-04-22): expanded from a single
// forbidden flag to the forbidden-token set above after the challenger
// pass surfaced that `--full-auto`, `--add-dir`, `-c sandbox_mode=
// workspace-write`, `--profile`, and `-o` all break the boundary while
// preserving `-s read-only`.
export const CODEX_FORBIDDEN_ARGV_TOKENS = Object.freeze([
  '--dangerously-bypass-approvals-and-sandbox',
  '--full-auto',
  '--add-dir',
  '-o',
  '--output-last-message',
  '-c',
  '--config',
  '-p',
  '--profile',
  '--sandbox',
] as const);
export const CODEX_REASONING_EFFORT_CONFIG_KEY = 'model_reasoning_effort';
export const CODEX_SUPPORTED_EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const;

// Fail-closed module-load assertion. The `CODEX_NO_WRITE_FLAGS` constant
// is frozen (see `Object.freeze` above) so this is a static-shape
// invariant: the adapter refuses to load if the flags drift away from
// the capability-boundary-preserving set.
//
// Why assert here rather than at first dispatch: catches a regression
// on `import` so a test suite that imports the module but skips the
// CODEX_SMOKE path still surfaces the invariant break.
if (!CODEX_NO_WRITE_FLAGS.includes('-s') || !CODEX_NO_WRITE_FLAGS.includes('read-only')) {
  throw new Error(
    'CODEX_NO_WRITE_FLAGS capability-boundary invariant broken: must include "-s read-only" per ADR-0009 §2.v',
  );
}
const flagsAsStringArray: readonly string[] = CODEX_NO_WRITE_FLAGS;
for (const forbidden of CODEX_FORBIDDEN_ARGV_TOKENS) {
  if (flagsAsStringArray.includes(forbidden)) {
    throw new Error(
      `CODEX_NO_WRITE_FLAGS capability-boundary invariant broken: must NOT include "${forbidden}" per ADR-0009 §2.v (Codex Slice 45 HIGH 2 fold-in forbidden-token set)`,
    );
  }
}

// Default wall-clock budget for a single dispatch. A step's
// `budgets.wall_clock_ms` overrides this when present.
const DEFAULT_TIMEOUT_MS = 120_000;

// Grace period between SIGTERM and SIGKILL, modeled on agent.ts.
const SIGTERM_TO_SIGKILL_GRACE_MS = 2_000;

// stdout / stderr caps. Codex's `--json` stream is typically tiny
// (four events for a single-turn dispatch), but a misbehaving
// subprocess should not exhaust adapter memory.
const STDOUT_MAX_BYTES = 16 * 1024 * 1024;
const STDERR_MAX_BYTES = 1024 * 1024;

// Version-capture timeout. `codex --version` is a fast local command
// (~150ms on a warm cache); a longer-than-a-few-seconds hang indicates
// a broken installation and should fail the dispatch rather than block
// indefinitely.
const VERSION_CAPTURE_TIMEOUT_MS = 5_000;

// `CodexDispatchInput` does NOT carry a cwd field at v0. The codex
// subprocess inherits the parent Node process's cwd via `spawn`'s
// default behavior. This is intentional: `docs/contracts/adapter.md`
// ADAPTER-I1 codex bullet says the adapter runs "in the operator's
// current session context," which at v0 is the parent cwd. If a future
// slice needs per-dispatch cwd override (distinct-UID sandbox, git
// worktree routing, workflow-scoped directories), the field is added
// here and threaded into the `spawn` options below. Codex Slice 45
// MED 2: noted as deferred-by-design, not oversight.
export interface CodexDispatchInput extends AdapterDispatchInput {}

// The `CodexDispatchResult` name parallels `AgentDispatchResult` —
// both alias the shared `DispatchResult` shape and exist for call-site
// clarity at the adapter boundary.
export type CodexDispatchResult = DispatchResult;

// Capture the Codex CLI version via a separate `codex --version`
// shellout. Codex's `--json` stream does not emit version in-band
// (unlike `claude`'s `system/init` event which carries
// `claude_code_version`), so a pre-invocation shellout is the only
// direct way to version-pin a dispatch per Codex Slice 42 MED 2
// fold-in.
//
// Codex Slice 45 MED 1 fold-in (2026-04-22): the version capture is
// memoized per process lifetime so the overhead is paid once per
// adapter import, not once per dispatch. The challenger pass observed
// that `codex --version` also prints PATH-update warnings to stderr on
// some installations; memoizing localizes that side-effect to the
// first dispatch in a process. Trade-off: if the operator upgrades
// the Codex CLI mid-process, the cached version goes stale until the
// process restarts. At v0 this is an accepted corner case — CLI
// upgrades mid-session are rare, and the fingerprint writer invokes
// dispatchCodex fresh each smoke run (so fingerprint evidence remains
// version-accurate as long as the smoke run process restarts after a
// CLI upgrade, which it does since vitest spawns fresh workers).
let cachedCodexVersion: string | undefined;
function captureCodexVersion(): string {
  if (cachedCodexVersion !== undefined) return cachedCodexVersion;
  let stdout: string;
  try {
    stdout = execFileSync(CODEX_EXECUTABLE, ['--version'], {
      encoding: 'utf8',
      timeout: VERSION_CAPTURE_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    throw new Error(`codex --version failed: ${(err as Error).message}`);
  }
  // Expected format: "codex-cli 0.118.0" (one line, may include trailing
  // newline). Parse liberally: strip whitespace, keep whatever token(s)
  // remain. If the CLI output shape changes, version-pin still records
  // the raw bytes; downstream tools can normalize.
  const version = stdout.trim();
  if (version.length === 0) {
    throw new Error('codex --version produced empty output');
  }
  cachedCodexVersion = version;
  return version;
}

function assertCodexEffort(
  effort: Effort,
): asserts effort is (typeof CODEX_SUPPORTED_EFFORTS)[number] {
  if (!(CODEX_SUPPORTED_EFFORTS as readonly string[]).includes(effort)) {
    throw new Error(
      `codex adapter cannot honor effort '${effort}'; supported efforts: ${CODEX_SUPPORTED_EFFORTS.join(', ')}`,
    );
  }
}

function codexReasoningEffortConfigValue(effort: (typeof CODEX_SUPPORTED_EFFORTS)[number]): string {
  return `${CODEX_REASONING_EFFORT_CONFIG_KEY}=${JSON.stringify(effort)}`;
}

function isForbiddenCodexArg(arg: string): boolean {
  return CODEX_FORBIDDEN_ARGV_TOKENS.some((token) => {
    if (token === '-c') return false;
    if (arg === token) return true;
    return token.startsWith('--') && arg.startsWith(`${token}=`);
  });
}

function isAllowedCodexConfigOverride(value: string | undefined): boolean {
  return (
    value !== undefined &&
    CODEX_SUPPORTED_EFFORTS.some((effort) => value === codexReasoningEffortConfigValue(effort))
  );
}

export function assertCodexSpawnArgvBoundary(args: readonly string[]): void {
  const sandboxFlagIndexes = args
    .map((arg, idx) => (arg === '-s' ? idx : -1))
    .filter((idx) => idx >= 0);
  const sandboxFlagIndex = sandboxFlagIndexes[0];
  if (
    sandboxFlagIndexes.length !== 1 ||
    sandboxFlagIndex === undefined ||
    args[sandboxFlagIndex + 1] !== 'read-only'
  ) {
    throw new Error(
      'codex spawn argv boundary broken: exactly one "-s read-only" pair is required',
    );
  }

  let configOverrideCount = 0;
  for (let idx = 0; idx < args.length; idx += 1) {
    const arg = args[idx];
    if (arg === undefined) continue;
    if (arg === '-c') {
      configOverrideCount += 1;
      if (configOverrideCount > 1) {
        throw new Error(
          'codex spawn argv boundary broken: at most one allowlisted -c override is allowed',
        );
      }
      const value = args[idx + 1];
      if (!isAllowedCodexConfigOverride(value)) {
        throw new Error(
          `codex spawn argv boundary broken: only ${CODEX_REASONING_EFFORT_CONFIG_KEY}=<supported effort> is allowed after -c`,
        );
      }
      idx += 1;
      continue;
    }
    if (isForbiddenCodexArg(arg)) {
      throw new Error(`codex spawn argv boundary broken: forbidden argv token "${arg}"`);
    }
  }
}

export function buildCodexArgs(input: CodexDispatchInput): string[] {
  const args: string[] = [...CODEX_NO_WRITE_FLAGS];
  const model = selectedModelForProvider('codex', input.resolvedSelection, 'openai');
  if (model !== undefined) {
    args.push('-m', model);
  }
  const effort = input.resolvedSelection?.effort;
  if (effort !== undefined) {
    assertCodexEffort(effort);
    args.push('-c', codexReasoningEffortConfigValue(effort));
  }
  args.push(input.prompt);
  assertCodexSpawnArgvBoundary(args);
  return args;
}

export async function dispatchCodex(input: CodexDispatchInput): Promise<DispatchResult> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const cli_version = captureCodexVersion();
  const args = buildCodexArgs(input);
  const start = performance.now();
  return await new Promise<DispatchResult>((resolve, reject) => {
    let child: ChildProcess;
    try {
      // stdin is `ignore` so codex exec does not read from stdin and
      // append a `<stdin>` block to the prompt. `detached: true` puts
      // the subprocess in its own process group so the timeout-kill
      // path can signal the group (mirrors agent.ts HIGH 4 containment
      // discipline); if codex spawns helper processes, they are killed
      // via the group kill.
      child = spawn(CODEX_EXECUTABLE, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
        detached: true,
      });
    } catch (err) {
      reject(new Error(`codex subprocess spawn failed: ${(err as Error).message}`));
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
      const pid = child.pid;
      if (typeof pid !== 'number') return false;
      try {
        process.kill(-pid, signal);
        return true;
      } catch {
        try {
          child.kill(signal);
          return true;
        } catch {
          return false;
        }
      }
    };

    // Codex Slice 45 LOW 2 fold-in: track the nested SIGKILL escalation
    // timer separately so the `close`/`error` handlers can clear it.
    // Without this, a subprocess that exits between SIGTERM and the
    // grace window would still receive a delayed SIGKILL callback
    // against either a dead pid or (worst case) a pid recycled to a
    // different process group.
    let killGraceTimer: NodeJS.Timeout | undefined;
    const timer = setTimeout(() => {
      timedOut = true;
      killGroupSucceeded = killProcessGroup('SIGTERM');
      killGraceTimer = setTimeout(() => {
        killProcessGroup('SIGKILL');
        killGraceTimer = undefined;
      }, SIGTERM_TO_SIGKILL_GRACE_MS);
    }, timeoutMs);
    const clearAllTimers = () => {
      clearTimeout(timer);
      if (killGraceTimer !== undefined) {
        clearTimeout(killGraceTimer);
        killGraceTimer = undefined;
      }
    };

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      if (stdoutBytes + chunk.length > STDOUT_MAX_BYTES) {
        stdoutCapped = true;
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
      clearAllTimers();
      reject(new Error(`codex subprocess spawn error: ${err.message}`));
    });
    child.on('close', (code, signal) => {
      clearAllTimers();
      const duration_ms = performance.now() - start;
      if (timedOut) {
        reject(
          new Error(
            `codex subprocess timed out after ${timeoutMs}ms; group-kill ${killGroupSucceeded ? 'sent' : 'failed'}; final signal=${signal ?? 'none'}; stderr[:500]=${stderr.slice(0, 500)}`,
          ),
        );
        return;
      }
      if (code !== 0) {
        reject(
          new Error(
            `codex subprocess exited with code ${code}${signal ? ` (signal ${signal})` : ''}; stderr[:500]=${stderr.slice(0, 500)}`,
          ),
        );
        return;
      }
      if (stdoutCapped) {
        reject(
          new Error(
            `codex subprocess stdout exceeded ${STDOUT_MAX_BYTES} bytes; capability-boundary check cannot be evaluated on truncated stream`,
          ),
        );
        return;
      }
      try {
        resolve(parseCodexStdout(stdout, input.prompt, duration_ms, cli_version));
      } catch (err) {
        const stderrSuffix = stderrCapped ? ' [stderr capped]' : '';
        reject(
          new Error(
            `codex subprocess: ${(err as Error).message}; stdout[:500]=${stdout.slice(0, 500)}; stderr[:200]=${stderr.slice(0, 200)}${stderrSuffix}`,
          ),
        );
      }
    });
  });
}

// Known `item.completed` `item.type` values at Codex CLI 0.118. The
// adapter accepts the `agent_message` and `reasoning` types (model
// narration) and rejects anything else — an unknown type may represent
// a new capability surface (tool use, patch apply, shell command)
// that bypasses the sandbox's intent and needs to be explicitly
// reviewed before we start emitting it into the dispatch transcript.
//
// A future CLI bump that introduces a genuinely-sandboxed item type
// (e.g., a reasoning variant) can extend this list; a bump that
// introduces a write-capable item type triggers ADR-0009 §6 reopen.
const KNOWN_CODEX_ITEM_TYPES = new Set<string>(['agent_message', 'reasoning']);

// Top-level event types the parser expects at Codex CLI 0.118 (Codex
// Slice 45 HIGH 5 fold-in — grounded in the `tests/fixtures/codex-
// smoke/protocol/happy-path-ok.jsonl` real capture). An event whose
// `type` is outside this set is rejected: the adapter refuses to admit
// unfamiliar protocol surfaces into the dispatch transcript.
const KNOWN_CODEX_EVENT_TYPES = new Set<string>([
  'thread.started',
  'turn.started',
  'item.completed',
  'turn.completed',
]);

// Explicit failure-event types. The challenger's no-network probe
// observed top-level `turn.failed` and `error` events alongside a
// partial `thread.started` / `turn.started`. Rejecting these with
// named error messages keeps dispatch failures legible — the adapter
// says "codex reported turn.failed" rather than surfacing as "missing
// turn.completed" and letting the caller guess what happened.
const CODEX_FAILURE_EVENT_TYPES = new Set<string>(['turn.failed', 'error']);

export function parseCodexStdout(
  stdout: string,
  prompt: string,
  duration_ms: number,
  cli_version: string,
): DispatchResult {
  const lines = stdout.split('\n').filter((line) => line.length > 0);
  if (lines.length === 0) {
    throw new Error('codex --json stdout is empty');
  }
  const events: Array<Record<string, unknown>> = [];
  for (const [idx, line] of lines.entries()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      throw new Error(
        `codex --json line ${idx + 1} is not valid JSON: ${(err as Error).message}; line[:200]=${line.slice(0, 200)}`,
      );
    }
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error(`codex --json line ${idx + 1} is not a JSON object`);
    }
    events.push(parsed as Record<string, unknown>);
  }

  // Top-level event-type gating (Codex Slice 45 HIGH 5 fold-in).
  //   (a) Reject failure events up front with a named error so dispatch
  //       callers see "codex reported turn.failed" / "codex reported
  //       error" instead of a generic downstream parse error.
  //   (b) Reject unknown top-level event types so a new Codex CLI
  //       version that adds a capability event cannot slip past the
  //       known-types allowlist and land in the transcript implicitly.
  for (const [idx, event] of events.entries()) {
    const type = event.type;
    if (typeof type !== 'string') {
      throw new Error(`codex --json line ${idx + 1}: event has no string 'type' field`);
    }
    if (CODEX_FAILURE_EVENT_TYPES.has(type)) {
      const msgField =
        typeof event.message === 'string'
          ? event.message
          : typeof event.error === 'string'
            ? event.error
            : JSON.stringify(event).slice(0, 200);
      throw new Error(
        `codex reported ${type}: ${msgField}. ADR-0009 §6 reopen-trigger-5 context: if this recurs, examine whether the failure shape indicates a capability-boundary regression (e.g., a sandboxed write attempt surfacing as turn.failed).`,
      );
    }
    if (!KNOWN_CODEX_EVENT_TYPES.has(type)) {
      throw new Error(
        `codex --json line ${idx + 1}: unknown top-level event type '${type}' (allowlist: ${Array.from(KNOWN_CODEX_EVENT_TYPES).join(', ')}). A new Codex event type requires ADR-0009 §6 reopen-trigger-5 review before the adapter admits it.`,
      );
    }
  }

  // `thread.started` carries the thread_id. It is emitted as the FIRST
  // event of any exec invocation under Codex 0.118.
  const threadStarted = events.find((e) => e.type === 'thread.started');
  if (threadStarted === undefined) {
    throw new Error('thread.started event missing from codex --json stdout');
  }
  const thread_id = threadStarted.thread_id;
  if (typeof thread_id !== 'string' || thread_id.length === 0) {
    throw new Error('thread.started.thread_id missing or empty');
  }

  // `turn.completed` is the terminal turn marker. Missing = the turn did
  // not complete cleanly even if the exit code was 0 (shouldn't happen
  // at v0 but the assertion is cheap).
  const turnCompleted = events.find((e) => e.type === 'turn.completed');
  if (turnCompleted === undefined) {
    throw new Error('turn.completed event missing from codex --json stdout');
  }

  // Collect `item.completed` events. Each carries an `item` object with
  // an `id`, `type`, and type-specific fields. Reject any item whose
  // type is not in `KNOWN_CODEX_ITEM_TYPES`: the capability-boundary
  // discipline requires new Codex item types to be reviewed before the
  // adapter emits them into the transcript (a silent pass-through of a
  // novel write-capable item would bypass the P2.6 boundary proof).
  const itemCompleted = events.filter((e) => e.type === 'item.completed');
  for (const [idx, e] of itemCompleted.entries()) {
    const item = e.item;
    if (typeof item !== 'object' || item === null) {
      throw new Error(`item.completed[${idx}].item is not an object`);
    }
    const itemType = (item as Record<string, unknown>).type;
    if (typeof itemType !== 'string') {
      throw new Error(`item.completed[${idx}].item.type is not a string`);
    }
    if (!KNOWN_CODEX_ITEM_TYPES.has(itemType)) {
      throw new Error(
        `capability-boundary violation: item.completed[${idx}].item.type='${itemType}' is not in the known-types allowlist (${Array.from(KNOWN_CODEX_ITEM_TYPES).join(', ')}). A new Codex item type requires ADR-0009 §6 reopen-trigger-5 review before the adapter admits it.`,
      );
    }
  }

  // Take the LAST agent_message item — the terminal response. A Codex
  // exec may emit reasoning items between agent_message deltas
  // (though at 0.118 with --json we observe a single terminal
  // agent_message for the short prompts v0 dispatches carry).
  const agentMessages = itemCompleted.filter((e) => {
    const item = e.item as Record<string, unknown>;
    return (item.type as string) === 'agent_message';
  });
  const terminalMessage = agentMessages[agentMessages.length - 1];
  if (terminalMessage === undefined) {
    throw new Error('no item.completed/agent_message event found in codex --json stdout');
  }
  const item = terminalMessage.item as Record<string, unknown>;
  const result_body_raw = item.text;
  if (typeof result_body_raw !== 'string') {
    throw new Error('terminal agent_message item.text missing or not a string');
  }
  // Tolerant extraction: workers preamble status sentences before their
  // JSON response despite the shape-hint instruction. Symmetric with
  // `parseAgentStdout`. Non-JSON output flows through unchanged.
  const result_body = extractJsonObject(result_body_raw);

  return {
    request_payload: prompt,
    receipt_id: thread_id,
    result_body,
    duration_ms,
    cli_version,
  };
}
