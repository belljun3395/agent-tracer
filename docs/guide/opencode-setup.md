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

## 3. Repo-local OpenCode 연결 상태

이 저장소는 OpenCode 연결에 필요한 두 구성을 이미 포함하고 있습니다.

- `.opencode/plugins/monitor.ts` - 세션과 도구 실행을 자동 추적하는 플러그인
- `opencode.json` - `monitor` MCP 서버 등록 + 플러그인 로드 설정

즉, 이 저장소에서 OpenCode를 열면 기본 경로는 이미 연결된 상태입니다.

## 4. 플러그인 훅 동작 방식 (자동 추적 기본 경로)

플러그인은 별도 설치 없이 자동으로 세션과 도구 실행을 추적합니다.

환경 변수 설정 (기본값: 3847):

```bash
export MONITOR_PORT=3847
```

플러그인이 자동으로 처리하는 이벤트:

- `session.created` — 세션 시작 시 태스크 생성 기록
- `tool.execute.after` — 도구 실행 후 이벤트 기록
- `session.deleted` — `/api/session-end` 호출로 세션 종료 + 태스크 자동 완료 (아래 표 참조)

**세션 vs. 태스크 생명주기:**

| 태스크 종류 | `session.deleted` 동작 |
|------------|----------------------|
| `primary` | `/api/session-end` 에 `completeTask:true` 전송 → 서버가 태스크를 `completed`로 전환 |
| `background` (DB에 확정된 경우) | `/api/session-end` 에 `completeTask:false` 전송 → 서버가 마지막 세션 종료 시 자동 완료 |
| `background` (링크 미확정) | `/api/task-link` 재시도 후 성공하면 background 경로, 실패하면 `completeTask:true` fallback |

> `background` 태스크는 백그라운드 자식 세션에 해당한다.
> `/api/task-link` POST가 성공해야 서버 DB 행이 `background`로 확정되며,
> 그 전까지는 플러그인이 `completeTask:true`로 fallback하여 태스크가 `running`에 고착되지 않도록 보호한다.

OpenCode 플러그인 훅은 raw 사용자 프롬프트 텍스트를 노출하지 않는다.
플러그인은 `ruleId: user-message-capture-unavailable` 규칙 이벤트를 기록하여
이 gap을 타임라인에 명시적으로 표시한다.
실제 사용자 메시지를 기록하려면 MCP를 통해 `monitor_user_message`를 직접 호출해야 한다.

**MCP를 통한 시맨틱 흐름 보강:**

OpenCode에서 MCP 도구를 사용하는 경우 다음 시맨틱 도구를 선택적으로 호출할 수 있다:

| MCP 도구 | 용도 | 레인 |
|----------|------|------|
| `monitor_question` | 에이전트 질문 흐름 (`questionId` + `questionPhase`) | user/planning |
| `monitor_todo` | 태스크 항목 상태 전이 (`todoId` + `todoState`) | planning |
| `monitor_thought` | 요약 추론 스냅샷 (`modelName` 옵션) | planning |

이 도구들은 선택적이다 — 플러그인 자동 추적이 이미 활성화된 경우에도 추가 관찰성을 위해 호출할 수 있다.

OpenCode를 이 저장소에서 실행하면 추가 설정 없이 모니터링이 활성화됩니다.

`opencode.json`의 핵심 설정은 다음 두 항목입니다.

```json
{
  "mcp": {
    "monitor": {
      "type": "local",
      "command": ["node", "packages/mcp/dist/index.js"],
      "enabled": true,
      "environment": {
        "MONITOR_BASE_URL": "http://127.0.0.1:3847"
      }
    }
  },
  "plugin": [".opencode/plugins/monitor.ts"]
}
```

## 5. Register The MCP Server In OpenCode (선택적 대체 방법)

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

## 6. Reuse This OpenCode Setup In Another Project

다른 저장소에서도 같은 방식을 쓰려면 플러그인, 스킬, 설정 파일을 함께 복사해야 합니다.

```bash
AGENT_TRACER=/path/to/agent-tracer
YOUR_PROJECT=/your-project

mkdir -p "$YOUR_PROJECT/.opencode/plugins"
mkdir -p "$YOUR_PROJECT/skills/monitor"

cp "$AGENT_TRACER/.opencode/plugins/monitor.ts" "$YOUR_PROJECT/.opencode/plugins/monitor.ts"
cp "$AGENT_TRACER/skills/monitor/SKILL.md"      "$YOUR_PROJECT/skills/monitor/SKILL.md"
```

그다음 `$YOUR_PROJECT/opencode.json`을 아래 내용으로 **새로 작성**합니다.

> **주의:** 외부 프로젝트에는 `packages/mcp/dist/index.js`가 없습니다.
> agent-tracer의 MCP 서버를 **절대 경로**로 지정해야 합니다.
> `opencode.json`을 agent-tracer에서 그대로 복사하면 `command`의 상대 경로가
> 깨지므로 반드시 아래 템플릿을 사용하세요.

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
  },
  "plugin": [".opencode/plugins/monitor.ts"]
}
```

복사 후 확인 목록:

- `command`가 agent-tracer의 절대 경로를 가리키는지
- `MONITOR_BASE_URL`이 실제 Agent Tracer 서버 주소와 일치하는지
- `skills/monitor/SKILL.md`가 복사되어 OpenCode Skills 패널에 표시되는지

## 7. End-to-end check

1. Start the monitor server.
2. Open OpenCode in this repository.
3. Run one normal task.
4. Confirm the monitor dashboard shows task lifecycle events.
5. Confirm `opencode mcp list` shows `monitor` as connected.
6. End the OpenCode session — the task should transition to `completed` in the dashboard.
7. (Optional) To close a task manually before session end, call `monitor_task_complete` via MCP.
