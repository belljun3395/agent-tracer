#!/usr/bin/env bash
#
# Agent Tracer — Codex app-server observer runner.
#
# Resolves packages/runtime/src/codex/app-server/observe.ts and executes it via
# tsx using the runtime package tsconfig for path aliases.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OBSERVER_FILE="$RUNTIME_DIR/src/codex/app-server/observe.ts"
TSCONFIG="$RUNTIME_DIR/tsconfig.json"

if [ ! -f "$OBSERVER_FILE" ]; then
  echo "agent-tracer runtime: observer not found: $OBSERVER_FILE" >&2
  exit 1
fi

LOCAL_TSX="$RUNTIME_DIR/../../node_modules/tsx/dist/cli.mjs"
if [ -f "$LOCAL_TSX" ]; then
  NODE_ENV="${NODE_ENV:-development}" exec node "$LOCAL_TSX" --tsconfig "$TSCONFIG" "$OBSERVER_FILE" "$@"
fi

NODE_ENV="${NODE_ENV:-development}" exec npx --yes tsx --tsconfig "$TSCONFIG" "$OBSERVER_FILE" "$@"
