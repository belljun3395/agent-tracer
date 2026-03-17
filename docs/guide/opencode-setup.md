# Agent Tracer - OpenCode Setup Guide

This guide is for OpenCode only.

## 1. Keep your current work isolated with git worktree

If your main branch has unrelated work in progress, create a separate worktree
for OpenCode integration work.

```bash
git worktree add -b feat/opencode-monitoring-async ../agent-tracer-opencode-wt
```

Then run all setup and validation steps inside the new worktree path.

## 2. Verify The Monitor Server

```bash
curl -sf http://127.0.0.1:${MONITOR_PORT:-3847}/api/overview | python3 -m json.tool
```

If the request fails, start the server:

```bash
npm run dev:server
# or
npm run build && npm run start:server
```

## 3. 플러그인 훅 설정 (자동 추적 권장)

이 저장소는 `.opencode/plugins/monitor.ts` 플러그인을 이미 포함하고 있습니다.
별도 설치 없이 자동으로 세션과 도구 실행을 추적합니다.

환경 변수 설정 (기본값: 3847):

```bash
export MONITOR_PORT=3847
```

플러그인이 자동으로 처리하는 이벤트:

- `session.created` — 세션 시작 시 태스크 생성
- `tool.execute.after` — 도구 실행 후 이벤트 기록
- `session.deleted` — 세션 종료 시 태스크 완료

OpenCode를 이 저장소에서 실행하면 추가 설정 없이 모니터링이 활성화됩니다.

## 4. Register The MCP Server In OpenCode (선택적 대체 방법)

플러그인 훅이 동작하지 않는 환경에서는 MCP 서버를 직접 등록할 수 있습니다.

Use Node.js 18+ for the MCP process (`packages/mcp` is ESM and relies on global
`fetch`).

```bash
npm run build --workspace @monitor/mcp
opencode mcp add
```

In the interactive prompt, choose a project-local config and register this local
stdio server:

- Name: `monitor`
- Type: `local`
- Command:

```bash
node /path/to/agent-tracer/packages/mcp/dist/index.js
```

Set `MONITOR_BASE_URL=http://127.0.0.1:3847` in the MCP server environment.

If you want a non-interactive setup, create `opencode.json` in the repository
root with:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "monitor": {
      "type": "local",
      "command": [
        "node",
        "/absolute/path/to/agent-tracer/packages/mcp/dist/index.js"
      ],
      "enabled": true,
      "environment": {
        "MONITOR_BASE_URL": "http://127.0.0.1:3847"
      }
    }
  }
}
```

Verify registration:

```bash
opencode mcp list
```

Expected result: `monitor` is listed as `connected`.

## 5. End-to-end check

1. Start the monitor server.
2. Open OpenCode in this repository.
3. Run one normal task.
4. Confirm the monitor dashboard shows task lifecycle events.
