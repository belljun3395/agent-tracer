#!/usr/bin/env bash
#
# Agent Tracer — Claude Code plugin hook runner.
#
# Resolves a precompiled hook under ${CLAUDE_PLUGIN_ROOT}/dist/claude-code/hooks/<name>.js
# first. If no compiled artifact exists, falls back to the TypeScript source under
# ${CLAUDE_PLUGIN_ROOT}/src/claude-code/hooks/<name>.ts and executes it via tsx.
#
# Compiled artifact execution:
#   RUNTIME=bun  — exec bun (bun JIT-compiles JS; no Node.js or tsx needed).
#   default      — exec node.
#
# tsx resolution order (per plugin best practices):
#   1. ${CLAUDE_PLUGIN_DATA}/node_modules  — persistent data dir; survives plugin updates.
#      Ref: https://code.claude.com/docs/en/plugins-reference#persistent-data-directory
#   2. ${CLAUDE_PLUGIN_ROOT}/node_modules  — bundled fallback for dev / first run.
#      NOTE: ${CLAUDE_PLUGIN_ROOT} changes on every plugin update, so dependencies
#      installed here are ephemeral. Use CLAUDE_PLUGIN_DATA for production.
#   3. npx --yes tsx                       — last-resort download fallback.
#
# Exit codes:
#   0 — success (hook ran or hook file not found — never block Claude).
#   Non-zero from tsx — propagated to Claude Code as a non-blocking error.
#   Exit 2 from hook scripts — blocks the tool call (PreToolUse/UserPromptSubmit).
#
# Ref: https://code.claude.com/docs/en/hooks#exit-code-2-behavior-matrix
#
# Contract:
#   $1 — hook script base name (e.g. "SessionStart", "PostToolUse/Bash").
#   stdin  — JSON payload from Claude Code (event-specific fields).
#   stdout — JSON response read by Claude Code on exit 0 only.

set -euo pipefail

HOOK_NAME="${1:?hook name required}"

# Resolve the script's own directory regardless of how it was invoked.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Plugin root: prefer CLAUDE_PLUGIN_ROOT (set by Claude Code when using --plugin-dir),
# fall back to the directory one level above this script (bin/../ = claude-code/).
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"

RUNTIME_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
COMPILED_HOOK_FILE="${PLUGIN_ROOT}/dist/claude-code/hooks/${HOOK_NAME}.js"
RUNTIME_COMPILED_HOOK_FILE="${RUNTIME_ROOT}/dist/claude-code/hooks/${HOOK_NAME}.js"
HOOK_FILE="${CLAUDE_PLUGIN_ROOT}/src/claude-code/hooks/${HOOK_NAME}.ts"
TSCONFIG="${CLAUDE_PLUGIN_ROOT}/tsconfig.plugin.json"

if [ ! -f "$COMPILED_HOOK_FILE" ] && [ -f "$RUNTIME_COMPILED_HOOK_FILE" ]; then
  COMPILED_HOOK_FILE="$RUNTIME_COMPILED_HOOK_FILE"
fi

if [ ! -f "$COMPILED_HOOK_FILE" ]; then
  HOOK_BASENAME="${HOOK_NAME##*/}"
  NESTED_COMPILED_HOOK_FILE="${PLUGIN_ROOT}/dist/claude-code/hooks/${HOOK_NAME}/${HOOK_BASENAME}.js"
  NESTED_RUNTIME_COMPILED_HOOK_FILE="${RUNTIME_ROOT}/dist/claude-code/hooks/${HOOK_NAME}/${HOOK_BASENAME}.js"
  if [ -f "$NESTED_COMPILED_HOOK_FILE" ]; then
    COMPILED_HOOK_FILE="$NESTED_COMPILED_HOOK_FILE"
  elif [ -f "$NESTED_RUNTIME_COMPILED_HOOK_FILE" ]; then
    COMPILED_HOOK_FILE="$NESTED_RUNTIME_COMPILED_HOOK_FILE"
  fi
fi

if [ -f "$COMPILED_HOOK_FILE" ]; then
  if [ "${RUNTIME:-}" = "bun" ]; then
    NODE_ENV="${NODE_ENV:-production}" exec bun "$COMPILED_HOOK_FILE"
  fi
  NODE_ENV="${NODE_ENV:-production}" exec node "$COMPILED_HOOK_FILE"
fi

if [ ! -f "$HOOK_FILE" ]; then
  echo "agent-tracer plugin: hook not found: $HOOK_FILE" >&2
  exit 0
fi

# Prefer the persistent data directory so tsx survives plugin updates.
if [ -n "${CLAUDE_PLUGIN_DATA:-}" ]; then
  PLUGIN_DATA_TSX="${CLAUDE_PLUGIN_DATA}/node_modules/tsx/dist/cli.mjs"
  if [ -f "$PLUGIN_DATA_TSX" ]; then
    NODE_ENV="${NODE_ENV:-development}" exec node "$PLUGIN_DATA_TSX" --tsconfig "$TSCONFIG" "$HOOK_FILE"
  fi
fi

# Fallback: bundled node_modules (ephemeral across plugin updates).
LOCAL_TSX="${CLAUDE_PLUGIN_ROOT}/node_modules/tsx/dist/cli.mjs"
if [ -f "$LOCAL_TSX" ]; then
  NODE_ENV="${NODE_ENV:-development}" exec node "$LOCAL_TSX" --tsconfig "$TSCONFIG" "$HOOK_FILE"
fi

NODE_ENV="${NODE_ENV:-development}" exec npx --yes tsx --tsconfig "$TSCONFIG" "$HOOK_FILE"
