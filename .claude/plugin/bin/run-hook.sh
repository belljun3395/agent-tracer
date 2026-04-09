#!/usr/bin/env bash
#
# Agent Tracer — Claude Code plugin hook runner.
#
# Resolves a hook script under ${CLAUDE_PLUGIN_ROOT}/hooks/<name>.ts and
# executes it via tsx. Prefers the plugin's own node_modules (so the version
# is pinned by package.json) and falls back to `npx --yes tsx` for fresh
# checkouts where `npm install` has not yet been run.
#
# Contract:
#   $1 — hook script base name (e.g. "session_start", "user_prompt").
#
# Failure mode is intentional: if the hook script is missing, we exit 0 so
# Claude is never blocked. Real script errors propagate normally.

set -euo pipefail

HOOK_NAME="${1:?hook name required}"
HOOK_FILE="${CLAUDE_PLUGIN_ROOT}/hooks/${HOOK_NAME}.ts"

if [ ! -f "$HOOK_FILE" ]; then
  echo "agent-tracer plugin: hook not found: $HOOK_FILE" >&2
  exit 0
fi

LOCAL_TSX="${CLAUDE_PLUGIN_ROOT}/node_modules/tsx/dist/cli.mjs"
if [ -f "$LOCAL_TSX" ]; then
  NODE_ENV="${NODE_ENV:-development}" exec node "$LOCAL_TSX" "$HOOK_FILE"
fi

NODE_ENV="${NODE_ENV:-development}" exec npx --yes tsx "$HOOK_FILE"
