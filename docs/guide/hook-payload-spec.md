# Claude Code Hook Payload Spec

공식 문서: https://code.claude.com/docs/en/hooks

각 hook이 stdin으로 받는 JSON payload 필드를 정리한다.
`[실측]` 표기는 공식 스펙과 실제 동작이 다른 부분을 나타낸다.

---

## 공통 필드 (Common Fields)

공식 스펙상 모든 hook event에 포함되는 필드:

| 필드 | 타입 | 설명 |
|------|------|------|
| `session_id` | string | 현재 Claude Code 세션 ID |
| `transcript_path` | string | 대화 트랜스크립트 JSONL 파일 경로 |
| `cwd` | string | 현재 작업 디렉토리 |
| `hook_event_name` | string | 이벤트 이름 |
| `permission_mode` | string | `"default"` \| `"plan"` \| `"acceptEdits"` \| `"dontAsk"` \| `"bypassPermissions"` |
| `agent_id` | string? | subagent 내부에서만 포함 |
| `agent_type` | string? | `--agent` 플래그 또는 subagent 사용 시 포함 |

> **[실측] `transcript_path`와 `permission_mode`는 실제로 일부 이벤트에서 누락됨.**
> 누락 이벤트: `SessionStart`, `SessionEnd`, `SubagentStart`, `PreCompact`, `PostCompact`
> hook 코드에서 이 필드에 의존하면 안 됨.

---

## 이벤트별 Payload

### SessionStart

트리거: Claude Code 시작, 재개, `/clear`, `/compact` 직후

| 필드 | 타입 | 값 |
|------|------|----|
| `hook_event_name` | string | `"SessionStart"` |
| `source` | string | `"startup"` \| `"resume"` \| `"clear"` \| `"compact"` |
| `model` | string | 사용 중인 모델 ID (**[실측] 스펙 미문서 필드**) |

> **[실측]** `transcript_path`, `permission_mode` 없음.
> **[실측]** `model` 필드 실제 존재 (`"claude-sonnet-4-6"` 등).

---

### SessionEnd

트리거: 세션 종료

| 필드 | 타입 | 값 |
|------|------|----|
| `hook_event_name` | string | `"SessionEnd"` |
| `reason` | string | `"clear"` \| `"resume"` \| `"logout"` \| `"prompt_input_exit"` \| `"bypass_permissions_disabled"` \| `"other"` |

> **[실측]** `transcript_path`, `permission_mode` 없음.

---

### UserPromptSubmit

트리거: 사용자 메시지 제출 시

| 필드 | 타입 | 값 |
|------|------|----|
| `hook_event_name` | string | `"UserPromptSubmit"` |
| `prompt` | string | 사용자 입력 전문 |

---

### PreToolUse

트리거: 도구 실행 직전

| 필드 | 타입 | 값 |
|------|------|----|
| `hook_event_name` | string | `"PreToolUse"` |
| `tool_name` | string | 도구 이름 (`Bash`, `Edit`, `Write`, `Read`, `Glob`, `Grep`, `Agent`, `Skill`, `mcp__*` 등) |
| `tool_input` | object | 도구별 입력 (아래 참조) |
| `tool_use_id` | string | 도구 호출 고유 ID |

> **[실측]** subagent 내부 도구 호출 시 `agent_id`, `agent_type` 추가 포함됨.
> 이를 통해 어느 subagent가 호출했는지 식별 가능.

**tool_input 구조 (도구별):**

```
Bash:    { command, description?, timeout?, run_in_background? }
Edit:    { file_path, old_string, new_string, replace_all? }
Write:   { file_path, content }
Read:    { file_path, offset?, limit? }
Glob:    { pattern, path? }
Grep:    { pattern, path?, glob?, type? }
Agent:   { description?, prompt, subagent_type?, run_in_background? }
Skill:   { skill, args? }
mcp__*:  MCP 서버/툴별 상이
```

---

### PostToolUse

트리거: 도구 실행 성공 후

| 필드 | 타입 | 값 |
|------|------|----|
| `hook_event_name` | string | `"PostToolUse"` |
| `tool_name` | string | 도구 이름 |
| `tool_input` | object | PreToolUse와 동일 |
| `tool_response` | object | 도구 실행 결과 (도구별 상이, 용량 클 수 있음) |
| `tool_use_id` | string | 도구 호출 고유 ID |

> **[실측]** `tool_response`는 Read/Edit 등에서 파일 전체 내용을 포함해 매우 클 수 있음.
> 로그 기록 시 제거 또는 truncate 권장.

---

### PostToolUseFailure

트리거: 도구 실행 실패 후

| 필드 | 타입 | 값 |
|------|------|----|
| `hook_event_name` | string | `"PostToolUseFailure"` |
| `tool_name` | string | 도구 이름 |
| `tool_input` | object | PreToolUse와 동일 |
| `tool_use_id` | string | 도구 호출 고유 ID |
| `error` | string | 에러 메시지 |
| `is_interrupt` | boolean? | 사용자 중단 여부 |

---

### SubagentStart

트리거: subagent 시작 시

| 필드 | 타입 | 값 |
|------|------|----|
| `hook_event_name` | string | `"SubagentStart"` |
| `agent_id` | string | subagent 고유 ID |
| `agent_type` | string | subagent 타입 이름 (e.g. `"general-purpose"`) |

> **[실측]** `transcript_path`, `permission_mode` 없음.

---

### SubagentStop

트리거: subagent 종료 시
**발동 순서: `SubagentStop` → `PostToolUse(Agent)`**

| 필드 | 타입 | 값 |
|------|------|----|
| `hook_event_name` | string | `"SubagentStop"` |
| `agent_id` | string | subagent 고유 ID |
| `agent_type` | string | subagent 타입 이름 |
| `stop_hook_active` | boolean | stop hook 활성 여부 |
| `agent_transcript_path` | string | subagent 트랜스크립트 경로 |
| `last_assistant_message` | string | subagent 마지막 응답 전문 |

> **[실측]** `/compact` 수행 시 내부적으로 compact 전용 subagent가 실행됨.
> 이 경우 `agent_type`이 **빈 문자열 `""`** 로 옴 (일반 subagent는 타입명 있음).
> 현재 코드에서 `|| "unknown"` 처리 중이나, `""` 그대로 보존해야 compact 에이전트 식별 가능.

---

### PreCompact

트리거: context 압축 직전 (`/compact` 또는 자동)

| 필드 | 타입 | 값 |
|------|------|----|
| `hook_event_name` | string | `"PreCompact"` |
| `trigger` | string | `"manual"` \| `"auto"` |
| `custom_instructions` | string | 사용자 compact 지시사항 (미입력 시 `""`) |

> **[실측]** `transcript_path`, `permission_mode` 없음.
> **[실측]** `custom_instructions` 미입력 시 `null`이 아닌 빈 문자열 `""`.

---

### PostCompact

트리거: context 압축 완료 후

| 필드 | 타입 | 값 |
|------|------|----|
| `hook_event_name` | string | `"PostCompact"` |
| `trigger` | string | `"manual"` \| `"auto"` |
| `compact_summary` | string | 압축 요약 전문 (`<analysis>...</analysis><summary>...</summary>` 형식, 매우 길 수 있음) |

> **[실측]** `transcript_path`, `permission_mode` 없음.
> **[실측]** `compact_summary`는 XML 형식의 분석+요약 텍스트이며 수 KB 규모.

---

## 이벤트 발동 순서

```
세션 시작
  └─ SessionStart

사용자 입력
  └─ UserPromptSubmit

도구 실행
  ├─ PreToolUse
  ├─ (도구 실행)
  └─ PostToolUse | PostToolUseFailure

Agent 도구 실행
  ├─ PreToolUse (tool_name: "Agent")
  ├─ SubagentStart
  ├─ (subagent 내부 도구들: PreToolUse / PostToolUse 반복)
  ├─ SubagentStop
  └─ PostToolUse (tool_name: "Agent")   ← SubagentStop 이후

/compact 실행
  ├─ PreCompact
  ├─ SubagentStart (agent_type: "")     ← compact 전용 내부 에이전트
  ├─ SubagentStop  (agent_type: "")
  └─ PostCompact

세션 종료
  └─ SessionEnd
```

---

## 코드 대응 주의사항

| 상황 | 현재 | 권장 |
|------|------|------|
| `transcript_path` 사용 | - | 사용하지 말 것, 없을 수 있음 |
| `agent_type` 기본값 | `\|\| "unknown"` | `\|\| ""` 로 유지해 compact 에이전트 구분 |
| `custom_instructions` 빈값 | `\|\| ""` (이미 처리) | 현재 코드 그대로 |
| `compact_summary` 로깅 | - | 길이 제한 필요 (수 KB) |
| `tool_response` 로깅 | hookLogPayload에서 제거 중 | 유지 |
