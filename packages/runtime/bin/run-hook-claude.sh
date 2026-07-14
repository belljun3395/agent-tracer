#!/usr/bin/env bash
# Claude Code 훅 하나를 실행하며 컴파일된 번들을 먼저 찾고 없으면 소스를 로더로 띄운다.
#
# 계약
#   $1     훅 이름 (예: SessionStart)
#   stdin  Claude Code가 넘기는 JSON 페이로드
#   stdout exit 0일 때만 Claude Code가 읽는 JSON 응답
#   exit   훅을 못 찾아도 0으로 끝나 Claude Code를 막지 않는다

set -euo pipefail

HOOK_NAME="${1:?hook name required}"

# statusLine으로 불릴 때는 CLAUDE_PLUGIN_ROOT가 없으므로 스크립트 위치로 루트를 찾는다.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd -P)}"

COMPILED_HOOK="${PLUGIN_ROOT}/dist/agent/claude-code/hooks/${HOOK_NAME}.js"
SOURCE_HOOK="${PLUGIN_ROOT}/src/agent/claude-code/hooks/${HOOK_NAME}.ts"

# 번들은 node24를 겨냥해 만들어지므로 낮은 버전에서는 훅마다 알 수 없는 오류로 죽는다.
if ! command -v node >/dev/null 2>&1; then
  echo "agent-tracer: PATH에서 node를 찾지 못했다. Node 24 이상이 필요하다." >&2
  exit 0
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -lt 24 ]; then
  echo "agent-tracer: Node 24 이상이 필요하다. 지금 PATH의 node는 ${NODE_MAJOR}이다." >&2
  exit 0
fi

if [ -f "$COMPILED_HOOK" ]; then
  NODE_ENV="${NODE_ENV:-production}" exec node "$COMPILED_HOOK"
fi

if [ ! -f "$SOURCE_HOOK" ]; then
  echo "agent-tracer: hook not found: ${HOOK_NAME}" >&2
  exit 0
fi

# 소스 실행은 개발 체크아웃 전용이며 swc-node 로더를 node_modules에서 찾는다.
if [ ! -d "${PLUGIN_ROOT}/node_modules/@swc-node/register" ]; then
  echo "agent-tracer: 설치본에 훅 번들이 없다. 플러그인을 다시 설치하라." >&2
  exit 0
fi
cd "$PLUGIN_ROOT"
SWC_NODE_PROJECT="${PLUGIN_ROOT}/tsconfig.plugin.json" NODE_ENV="${NODE_ENV:-development}" \
  exec node --import @swc-node/register/esm-register "$SOURCE_HOOK"
