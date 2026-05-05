#!/usr/bin/env bash
#
# Agent Tracer — Codex hook runner.
#
# Resolves a hook script under packages/runtime/src/codex/hooks/<name>.ts and
# executes it via tsx using the runtime package tsconfig for path aliases.
#
# Install mode: clone-only. This script is invoked from absolute paths written
# into a target project's `.codex/hooks.json` by `scripts/setup-external.mjs`,
# which always references a local agent-tracer checkout. It is NOT designed
# for marketplace plugin installs:
#   - tsconfig.json `extends ../../tsconfig.base.json` (only present in the
#     monorepo clone)
#   - tsx is resolved from the workspace's `node_modules` (only hydrated by
#     `npm install` at the repo root)
#   - hook .ts files import via `~codex/*` path aliases that the workspace
#     tsconfig defines.
# Codex itself has no plugin packaging surface today, so the local-clone flow
# is the only supported install mode.

set -euo pipefail

HOOK_NAME="${1:?hook name required}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOK_FILE="$RUNTIME_DIR/src/codex/hooks/${HOOK_NAME}.ts"
TSCONFIG="$RUNTIME_DIR/tsconfig.json"

if [ ! -f "$HOOK_FILE" ]; then
  echo "agent-tracer runtime: hook not found: $HOOK_FILE" >&2
  exit 0
fi

LOCAL_TSX="$RUNTIME_DIR/../../node_modules/tsx/dist/cli.mjs"
if [ -f "$LOCAL_TSX" ]; then
  NODE_ENV="${NODE_ENV:-development}" exec node "$LOCAL_TSX" --tsconfig "$TSCONFIG" "$HOOK_FILE"
fi

NODE_ENV="${NODE_ENV:-development}" exec npx --yes tsx --tsconfig "$TSCONFIG" "$HOOK_FILE"
