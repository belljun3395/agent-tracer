#!/usr/bin/env bash
# MCP stdio 서버를 실행하며 컴파일된 번들을 먼저 찾고 없으면 소스를 로더로 띄운다.
#
# 계약
#   stdin   Claude Code가 보내는 줄바꿈 구분 JSON-RPC 2.0 요청
#   stdout  같은 형식의 JSON-RPC 2.0 응답
#   stderr  로그 전용, Claude Code는 이를 오류로 간주하지 않는다

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd -P)}"

COMPILED_SERVER="${PLUGIN_ROOT}/dist/agent/claude-code/mcp/server.js"
SOURCE_SERVER="${PLUGIN_ROOT}/src/agent/claude-code/mcp/server.ts"

if ! command -v node >/dev/null 2>&1; then
  echo "agent-tracer: PATH에서 node를 찾지 못했다. Node 24 이상이 필요하다." >&2
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -lt 24 ]; then
  echo "agent-tracer: Node 24 이상이 필요하다. 지금 PATH의 node는 ${NODE_MAJOR}이다." >&2
  exit 1
fi

if [ -f "$COMPILED_SERVER" ]; then
  NODE_ENV="${NODE_ENV:-production}" exec node "$COMPILED_SERVER"
fi

if [ ! -f "$SOURCE_SERVER" ]; then
  echo "agent-tracer: mcp server bundle missing: ${SOURCE_SERVER}" >&2
  exit 1
fi

# 소스 실행은 개발 체크아웃 전용이며 swc-node 로더를 node_modules에서 찾는다.
if [ ! -d "${PLUGIN_ROOT}/node_modules/@swc-node/register" ]; then
  echo "agent-tracer: 설치본에 mcp 서버 번들이 없다. 플러그인을 다시 설치하라." >&2
  exit 1
fi
cd "$PLUGIN_ROOT"
SWC_NODE_PROJECT="${PLUGIN_ROOT}/tsconfig.plugin.json" NODE_ENV="${NODE_ENV:-development}" \
  exec node --import @swc-node/register/esm-register "$SOURCE_SERVER"
