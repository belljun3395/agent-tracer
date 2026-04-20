#!/usr/bin/env bash
#
# Agent Tracer — Claude Code plugin hook runner.
#
# Resolves a hook script under ${CLAUDE_PLUGIN_ROOT}/hooks/<name>.ts (or, when
# CLAUDE_PLUGIN_ROOT is unset, relative to this script file) and executes it
# via tsx.
#
# tsx resolution order (per plugin best practices):
#   1. ${CLAUDE_PLUGIN_DATA}/node_modules  — persistent data dir; survives plugin updates.
#      Ref: https://code.claude.com/docs/en/plugins-reference#persistent-data-directory
#   2. ${CLAUDE_PLUGIN_ROOT}/node_modules  — bundled fallback for dev / first run.
#      NOTE: ${CLAUDE_PLUGIN_ROOT} changes on every plugin update, so dependencies
#      installed here are ephemeral. Use CLAUDE_PLUGIN_DATA for production.
#   3. <script-dir>/../node_modules        — repo-local node_modules (monorepo).
#   4. npx --yes tsx                       — last-resort download fallback.
#
# Exit codes:
#   0 — success (hook ran or hook file not found — never block Claude).
#   Non-zero from tsx — propagated to Claude Code as a non-blocking error.
#   Exit 2 from hook scripts — blocks the tool call (PreToolUse/UserPromptSubmit).
#
# Ref: https://code.claude.com/docs/en/hooks#exit-code-2-behavior-matrix
#
# Contract:
#   $1 — hook script base name (e.g. "SessionStart", "StatusLine").
#   stdin  — JSON payload from Claude Code (event-specific fields).
#   stdout — JSON response read by Claude Code on exit 0 only.

set -euo pipefail

HOOK_NAME="${1:?hook name required}"

# Resolve the script's own directory regardless of how it was invoked.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Plugin root: prefer CLAUDE_PLUGIN_ROOT (set by Claude Code when using --plugin-dir),
# fall back to the directory one level above this script (bin/../ = claude-code/).
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"

HOOK_FILE="${PLUGIN_ROOT}/hooks/${HOOK_NAME}.ts"

if [ ! -f "$HOOK_FILE" ]; then
  echo "agent-tracer plugin: hook not found: $HOOK_FILE" >&2
  exit 0
fi

# tsconfig.json lives three levels above this script:
#   bin/ -> claude-code/ -> src/ -> packages/runtime/  (where tsconfig.json lives)
TSCONFIG="$(cd "$SCRIPT_DIR/../../.." && pwd)/tsconfig.json"
TSCONFIG_ARG=""
if [ -f "$TSCONFIG" ]; then
  TSCONFIG_ARG="--tsconfig $TSCONFIG"
fi

# Prefer the persistent data directory so tsx survives plugin updates.
PLUGIN_DATA_TSX="${CLAUDE_PLUGIN_DATA:-}/node_modules/tsx/dist/cli.mjs"
if [ -f "$PLUGIN_DATA_TSX" ]; then
  # shellcheck disable=SC2086
  NODE_ENV="${NODE_ENV:-development}" exec node "$PLUGIN_DATA_TSX" $TSCONFIG_ARG "$HOOK_FILE"
fi

# Fallback: bundled node_modules inside PLUGIN_ROOT (ephemeral across plugin updates).
LOCAL_TSX="${PLUGIN_ROOT}/node_modules/tsx/dist/cli.mjs"
if [ -f "$LOCAL_TSX" ]; then
  # shellcheck disable=SC2086
  NODE_ENV="${NODE_ENV:-development}" exec node "$LOCAL_TSX" $TSCONFIG_ARG "$HOOK_FILE"
fi

# Fallback: repo-level node_modules (monorepo / development checkout).
REPO_TSX="$(cd "$SCRIPT_DIR/../../.." && pwd)/../../node_modules/tsx/dist/cli.mjs"
if [ -f "$REPO_TSX" ]; then
  # shellcheck disable=SC2086
  NODE_ENV="${NODE_ENV:-development}" exec node "$REPO_TSX" $TSCONFIG_ARG "$HOOK_FILE"
fi

# Last resort: download via npx.
# shellcheck disable=SC2086
NODE_ENV="${NODE_ENV:-development}" exec npx --yes tsx $TSCONFIG_ARG "$HOOK_FILE"
