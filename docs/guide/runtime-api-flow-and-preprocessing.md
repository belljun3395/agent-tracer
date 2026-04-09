# Runtime API Flow & Preprocessing

현재 저장소에 구현된 자동 런타임은 Claude Code plugin 이다.
이 문서는 Claude plugin 이 Agent Tracer API 를 호출하기 전에 어떤 전처리를 수행하는지,
그리고 수동 런타임이 같은 surface 를 어떻게 따라오면 되는지 정리한 운영 레퍼런스다.

구현 근거:
- Claude plugin hooks: `.claude/plugin/hooks/*.ts`
- 공용 API surface: `packages/server/src/presentation/nestjs/controllers/*.ts`

함께 보면 좋은 문서:
- [API integration map](./api-integration-map.md)
- [Claude hook payload spec](./hook-payload-spec.md)

## API 역할

| API | 핵심 역할 |
|---|---|
| `/api/runtime-session-ensure` | runtime session upsert + task/session binding |
| `/api/runtime-session-end` | runtime session 종료 |
| `/api/user-message` | 사용자 raw prompt 저장 |
| `/api/assistant-response` | assistant 최종 응답 저장 |
| `/api/tool-used` | 구현 행위 기록 |
| `/api/explore` | 탐색/조회 기록 |
| `/api/terminal-command` | shell 실행 기록 |
| `/api/agent-activity` | delegation/skill/MCP 호출 기록 |
| `/api/todo` | todo lifecycle 추적 |
| `/api/task-link` | parent-child task 연결 |
| `/api/async-task` | background task 상태 |
| `/api/save-context`, `/api/plan`, `/api/action`, `/api/verify`, `/api/rule`, `/api/question`, `/api/thought` | 고신호 구조화 이벤트 |

## Claude plugin 전처리 전략

### 입력 정규화

- hook stdin JSON 을 읽어 object 가 아니면 빈 객체로 처리한다.
- Claude payload 의 `hook_source` 는 여전히 `"claude-hook"` 값으로 들어오므로, 이 값만 허용해 오염 이벤트를 차단한다.
- 서버에 보내는 canonical `runtimeSource` 는 `claude-plugin` 이다.
- 문자열은 trim + maxLength 컷오프로 정규화한다.

### 세션 선행 보장

- `SessionStart`, `UserPromptSubmit`, `PreToolUse` 계열에서 `runtime-session-ensure` 를 먼저 호출한다.
- user prompt 는 `/exit` 같은 종료 커맨드를 필터링한 뒤 `/api/user-message` 로 저장한다.

### 도구 이벤트 분류

- `tool_name` 과 `tool_input` 을 보고 `/api/tool-used`, `/api/explore`, `/api/terminal-command`, `/api/agent-activity` 로 라우팅한다.
- MCP 형식 도구(`mcp__...`)는 `activityType: "mcp_call"` 로 변환한다.
- Bash 는 command 의미 분류 후 semantic metadata 를 보강한다.
- `Agent` / `Skill` / subagent lifecycle 은 `/api/agent-activity`, `/api/task-link`, `/api/async-task` 로 연결한다.

### assistant 응답 경계

- `Stop` hook 이 마지막 assistant message 와 token usage 를 읽어 `/api/assistant-response` 를 보낸다.
- `SessionEnd` 와 `Stop` 은 상황에 따라 `/api/runtime-session-end` 를 호출해 세션을 닫지만, primary task 는 자동 완료하지 않는다.

## 대표 JSON 예시

### `UserPromptSubmit` → `/api/user-message`

```json
{
  "taskId": "task_01J...",
  "sessionId": "sess_01J...",
  "messageId": "msg_1712345678901_ab12cd",
  "captureMode": "raw",
  "source": "claude-plugin",
  "title": "문서 구조를 정리하고 API 흐름도도 추가해줘",
  "body": "문서 구조를 정리하고 API 흐름도도 추가해줘"
}
```

### `PostToolUse(Bash)` → `/api/terminal-command`

```json
{
  "taskId": "task_01J...",
  "sessionId": "sess_01J...",
  "command": "npm test",
  "title": "npm test",
  "body": "npm test",
  "lane": "implementation",
  "metadata": {
    "command": "npm test",
    "subtypeKey": "run_test",
    "toolFamily": "terminal",
    "sourceTool": "Bash"
  }
}
```

### `Stop` → `/api/assistant-response`

```json
{
  "taskId": "task_01J...",
  "sessionId": "sess_01J...",
  "messageId": "msg_1712345678999_f3e2aa",
  "source": "claude-plugin",
  "title": "요청하신 문서를 갱신했습니다.",
  "body": "요청하신 문서를 갱신했습니다.",
  "metadata": {
    "stopReason": "end_turn",
    "inputTokens": 1200,
    "outputTokens": 430
  }
}
```

### `SessionEnd` / `Stop` → `/api/runtime-session-end`

```json
{
  "runtimeSource": "claude-plugin",
  "runtimeSessionId": "claude-session-abc",
  "completionReason": "assistant_turn_complete",
  "summary": "요청하신 문서를 갱신했습니다."
}
```

## 수동 런타임이 따라야 할 최소 규칙

자동 plugin 이 없는 런타임도 아래 순서만 맞추면 같은 대시보드/스토리지를 사용할 수 있다.

1. 안정적인 session ID 가 있으면 `/api/runtime-session-ensure`
2. 사용자 입력마다 `/api/user-message`
3. 도구 사용마다 `/api/tool-used` 또는 `/api/explore`
4. 응답 완료 시 `/api/assistant-response`
5. turn 종료 시 `/api/runtime-session-end` 또는 `/api/session-end`

필요하면 그 위에 `/api/todo`, `/api/agent-activity`, `/api/async-task`, `/api/task-link`,
`/api/save-context`, `/api/plan`, `/api/action`, `/api/verify`, `/api/rule`, `/api/question`, `/api/thought`
를 추가하면 된다.
