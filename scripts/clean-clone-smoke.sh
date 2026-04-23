#!/usr/bin/env bash
# clean-clone-smoke.sh — Clean-Clone Reality Gate (Slice 52).
#
# Proves that a clean clone of circuit-next (tracked files only, no
# `.circuit/bin/circuit-engine` live-engine shim, npm config + cache
# isolated from operator state) passes the full baseline:
#   - npm ci             (install from package-lock)
#   - npm run verify     (check + lint + build + test)
#   - npm run audit      (drift-visibility audit)
#   - npm run circuit:run -- --help  (compiled-JS CLI entrypoint)
#
# Why this exists: pre-Slice-52, the project's "34 green" audit claim
# was partly operator-machine state. Two load-bearing surfaces depended
# on artifacts that `.gitignore:20` excludes — the prior-gen plugin's
# `.circuit/bin/circuit-engine` shim (required by 12 continuity-lifecycle
# tests) and tsx's `/tmp/tsx-<uid>/*.pipe` IPC directory (required by
# the `circuit:run` npm script). Slice 52 closes the portability gap;
# this script is the operator-facing reproducibility artifact that
# makes "clean clone reproduces the baseline" continuously verifiable.
#
# Mechanism: `git clone --no-local --no-hardlinks` into a `mktemp -d`
# dir gives a truly independent `.git` (separate refs / reflog /
# config) unlike a `git worktree add`, which shares `.git/worktrees`
# with the source repo and can fail on constrained filesystems
# (Slice 52 Codex challenger objection 2). The clone contains only
# tracked files, so `.circuit/bin/circuit-engine` is absent by
# construction. Note: `.gitignore:21` un-ignores the historical
# `.circuit/circuit-runs/phase-1-step-contract-authorship/` tree as
# audit trail; the smoke's portability invariant is specifically
# about the live-engine shim, not the whole `.circuit/` tree.
#
# Env scrub: HOME re-pointed to an ephemeral `$SMOKE_DIR/home`,
# `NPM_CONFIG_USERCONFIG=/dev/null` (ignore operator `~/.npmrc`),
# `NPM_CONFIG_CACHE="$SMOKE_DIR/npm-cache"` (fresh cache). PATH
# preserved so node/npm are locatable. Every other operator env var
# stripped via `env -i` (including CIRCUIT_HOOK_ENGINE_LIVE,
# CLI_SMOKE, AGENT_SMOKE, CODEX_SMOKE, NODE_OPTIONS, etc.) — if any
# test or audit check starts requiring an operator-set env var to
# pass, this smoke catches it.
#
# Exit 0: all four baseline commands succeed on the clean clone.
# Exit non-zero: first failing command aborts; stderr shows the cause.

set -euo pipefail

# Sourcing guard (Slice 52 Codex challenger objection 10): the script
# installs an EXIT trap and cds into the clone dir; sourcing it would
# mutate the caller shell and leak the trap. Refuse to run when sourced.
if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
  printf 'clean-clone-smoke.sh: refusing to run when sourced; execute it instead\n' >&2
  return 1 2>/dev/null || exit 1
fi

main() {
  local SCRIPT_DIR
  local REPO_ROOT
  local SMOKE_DIR
  local CLONE_DIR

  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
  SMOKE_DIR="$(mktemp -d -t circuit-next-clean-clone-smoke-XXXXXXXX)"
  CLONE_DIR="$SMOKE_DIR/repo"

  cleanup() {
    rm -rf "$SMOKE_DIR"
  }
  trap cleanup EXIT

  echo "==> Cloning into $CLONE_DIR (--no-local --no-hardlinks)"
  git clone --no-local --no-hardlinks --quiet "$REPO_ROOT" "$CLONE_DIR"

  mkdir -p "$SMOKE_DIR/home" "$SMOKE_DIR/npm-cache"

  cd "$CLONE_DIR"

  # Invariant: the clean-clone target must not contain the prior-gen
  # plugin shim. If it does, `.gitignore` has drifted or someone
  # committed the shim — either way, the smoke's portability proof
  # is invalid.
  if [ -e ".circuit/bin/circuit-engine" ]; then
    echo "FAIL: .circuit/bin/circuit-engine leaked into clean-clone checkout" >&2
    exit 1
  fi

  # Scrubbed env: operator vars stripped; HOME + npm config/cache
  # isolated to the smoke dir so operator `~/.npmrc` and `~/.npm/*`
  # do not influence the outcome.
  smoke_run() {
    env -i \
      PATH="$PATH" \
      HOME="$SMOKE_DIR/home" \
      NPM_CONFIG_USERCONFIG=/dev/null \
      NPM_CONFIG_CACHE="$SMOKE_DIR/npm-cache" \
      "$@"
  }

  echo "==> npm ci"
  smoke_run npm ci --no-audit --no-fund

  echo "==> npm run verify"
  smoke_run npm run verify

  echo "==> npm run audit"
  smoke_run npm run audit

  echo "==> npm run circuit:run -- --help"
  smoke_run npm run circuit:run --silent -- --help

  local TESTED_SHA
  TESTED_SHA="$(git -C "$CLONE_DIR" rev-parse HEAD)"

  echo ""
  echo "PASS: clean-clone smoke — verify + audit + circuit:run --help succeed on a clean clone at $TESTED_SHA."
}

main "$@"
