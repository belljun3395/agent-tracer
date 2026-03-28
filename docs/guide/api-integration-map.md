# Agent Tracer - API Integration Map

런타임별 API 엔드포인트 사용 현황을 정리한 레퍼런스.
신규 런타임을 추가할 때 구현 범위를 결정하는 기준 문서다.

각 런타임 구현은 공식 문서를 기반으로 작성되었다:
- **Claude Code hooks**: https://code.claude.com/docs/en/hooks
- **OpenCode plugins**: https://opencode.ai/docs/en/plugins

관련 파일:
- `.claude/hooks/` — Claude Code 훅 구현체
- `.opencode/plugins/monitor.ts` — OpenCode 플러그인 구현체
- `.agents/skills/codex-monitor/SKILL.md` — Codex skill + MCP 지침 경로

Codex CLI는 `codex-skill` runtimeSource를 캐노니컬 경로로 사용한다.

보완 문서:
- [Runtime API flow & preprocessing](./runtime-api-flow-and-preprocessing.md) — 런타임별 전처리/요청 흐름(Mermaid) 중심 문서

---

## 세션 생명주기

| API | 역할 | Claude Code | Codex CLI | OpenCode | 신규 런타임 추가 시 |
|-----|------|-------------|-----------|----------|---------------------|
| `/api/runtime-session-ensure` | 세션 upsert (없으면 생성, 있으면 조회) | `SessionStart`, `UserPromptSubmit`, `PreToolUse` | skill `monitor_runtime_session_ensure` | ❌ | 안정적인 runtime session ID가 있으면 사용 |
| `/api/task-start` | 태스크/세션 명시적 생성 | ❌ | ❌ | `session.created` | session ID 기반 task row를 직접 만들어야 할 때 사용 |
| `/api/runtime-session-end` | 런타임 세션 종료 | `Stop` (`completeTask: true`), `SessionEnd` (reason≠clear) | skill `monitor_runtime_session_end` | ❌ | 프로세스 종료나 turn 종료와 분리해 처리 |
| `/api/session-end` | 태스크 레벨 세션 종료 | ❌ | ❌ | `message.updated`, `session.idle`, exit 명령, `session.deleted` | resumable 세션을 닫되 task는 유지할 때 사용 |
| `/api/task-complete` | 태스크 완전 완료 처리 | ❌ | whole-thread 종료 시 skill manual | in-memory session state 유실 시 fallback | work item 종료를 별도 이벤트로 처리할 때 사용 |
| `/api/assistant-response` | assistant turn 결과 기록 | `Stop` | skill `monitor_assistant_response` | `message.updated` + buffered `message.part.*` | assistant 최종 텍스트가 있으면 함께 기록 권장 |

세션 초기화 방식의 차이:

- **Claude Code** — `runtime-session-ensure`로 세션을 자동 upsert한다.
- **Codex CLI** — `codex-skill` 경로에서 `runtime-session-ensure/end`를 사용한다. `runtimeSessionId`는 명시 전달을 기본으로 하며, `CODEX_THREAD_ID` 값을 그대로 전달하는 방식을 권장한다.
- **OpenCode** — plugin이 `session.created`를 기준으로 `task-start`를 호출한다.

---

## 메시지/컨텍스트

| API | 역할 | Claude Code | Codex CLI | OpenCode | 신규 런타임 추가 시 |
|-----|------|-------------|-----------|----------|---------------------|
| `/api/user-message` | 사용자 입력 기록 | `UserPromptSubmit` | skill `monitor_user_message` | `chat.message` hook | ✅ 필수. `captureMode: "raw"`, `source` 필드로 런타임 구분 |
| `/api/save-context` | planning 레인 스냅샷 | `SessionStart`, `PreCompact`, `PostCompact` | skill `monitor_save_context` | ❌ | 세션 상태 변화 시점마다 기록 권장 |
| `/api/plan` | 구조화된 계획 단계 기록 | MCP/manual only | skill `monitor_plan` | MCP/manual only | MCP 수동 경로에서 호출 |
| `/api/action` | 실행 직전 agent action 기록 | MCP/manual only | skill `monitor_action` | MCP/manual only | MCP 수동 경로에서 호출 |
| `/api/verify` | 검증 단계 결과 기록 | MCP/manual only | skill `monitor_verify` | MCP/manual only | MCP 수동 경로에서 호출 |
| `/api/rule` | rule 관련 이벤트 기록 | MCP/manual only | skill `monitor_rule` | MCP/manual only | MCP 수동 경로에서 호출 |
| `/api/question` | assistant 질문/호출 패턴 기록 | MCP/manual only | skill `monitor_question` | `tool.execute.after` semantic routing | 질문 흐름 추적이 필요할 때 구현 |
| `/api/thought` | assistant reasoning/사고 흐름 기록 | MCP/manual only | skill `monitor_thought` | `tool.execute.after` semantic routing | 요약형 reasoning 신호가 있을 때 구현 |

---

## 도구 사용

| API | 역할 | Claude Code | Codex CLI | OpenCode | 신규 런타임 추가 시 |
|-----|------|-------------|-----------|----------|---------------------|
| `/api/tool-used` | 파일 편집 등 구현 행위 기록 | `PostToolUse(Edit\|Write\|mcp__*)`, `PostToolUseFailure` | skill `monitor_tool_used` | `tool.execute.after` — edit/write/create/apply_patch 계열 | ✅ 필수 |
| `/api/explore` | 파일/웹 탐색 행위 기록 | `PostToolUse(Read\|Glob\|Grep\|WebSearch\|WebFetch)` | skill `monitor_explore` | `tool.execute.after` — read/glob/grep/websearch/webfetch 계열 | ✅ 필수 |
| `/api/terminal-command` | 터미널 명령 실행 기록 | `PostToolUse(Bash)` | skill `monitor_terminal_command` | `tool.execute.after` — bash/shell/exec 계열 | Bash 계열 도구가 있으면 구현 |
| `/api/todo` | Todo/Task 상태 변화 기록 | `PostToolUse(TodoWrite\|TaskCreate\|TaskUpdate)` | skill manual | `tool.execute.after` — `todowrite`, `monitor_todo` | todo 도구 지원 시 구현 |

---

## 에이전트/백그라운드

| API | 역할 | Claude Code | Codex CLI | OpenCode | 신규 런타임 추가 시 |
|-----|------|-------------|-----------|----------|---------------------|
| `/api/agent-activity` | 에이전트 위임/스킬 호출 기록 | `PostToolUse(Agent\|Skill)` | skill `monitor_agent_activity` | `tool.execute.after` + typed `event` callback | 서브에이전트 지원 시 구현 |
| `/api/async-task` | 백그라운드 태스크 상태 | `SubagentStart`/`SubagentStop` | skill `monitor_async_task` | 백그라운드 링크 확정/종료 시 | 백그라운드 실행 지원 시 구현 |
| `/api/task-link` | parent-child 태스크 연결 | `Agent` + child session id 추출 | skill `monitor_task_link` | before/after 이벤트 확정 | 서브에이전트가 별도 세션을 가지면 구현 |

---

## 런타임별 구현 현황 요약

| API | Claude Code | Codex CLI | OpenCode |
|-----|-------------|-----------|----------|
| `/api/runtime-session-ensure` | ✅ | ✅ (skill `monitor_runtime_session_ensure`) | ❌ |
| `/api/task-start` | ❌ | ❌ | ✅ |
| `/api/runtime-session-end` | ✅ | ✅ (skill `monitor_runtime_session_end`) | ❌ |
| `/api/session-end` | ❌ | ❌ | ✅ |
| `/api/task-complete` | ❌ | ✅ (skill manual) | ⚠️ fallback only |
| `/api/assistant-response` | ✅ | ✅ (skill `monitor_assistant_response`) | ✅ |
| `/api/user-message` | ✅ | ✅ (skill `monitor_user_message`) | ✅ |
| `/api/save-context` | ✅ | ✅ (skill `monitor_save_context`) | ❌ |
| `/api/question` | ❌ (MCP 수동) | ❌ (skill manual) | ✅ |
| `/api/thought` | ❌ (MCP 수동) | ❌ (skill manual) | ✅ |
| `/api/tool-used` | ✅ | ✅ (skill `monitor_tool_used`) | ✅ |
| `/api/explore` | ✅ | ✅ (skill `monitor_explore`) | ✅ |
| `/api/terminal-command` | ✅ | ✅ (skill `monitor_terminal_command`) | ✅ |
| `/api/todo` | ✅ | ❌ (skill manual) | ✅ |
| `/api/agent-activity` | ✅ | ❌ (skill manual) | ✅ |
| `/api/async-task` | ✅ | ❌ (skill manual) | ✅ |
| `/api/task-link` | ✅ | ❌ (skill manual) | ✅ |
| `/api/plan` | ❌ (MCP 수동) | ❌ (skill manual) | ❌ (MCP 수동) |
| `/api/action` | ❌ (MCP 수동) | ❌ (skill manual) | ❌ (MCP 수동) |
| `/api/verify` | ❌ (MCP 수동) | ❌ (skill manual) | ❌ (MCP 수동) |
| `/api/rule` | ❌ (MCP 수동) | ❌ (skill manual) | ❌ (MCP 수동) |

---

## 신규 런타임 추가 시 구현 순서

최소 동작 가능한 상태부터 순서대로 구현:

```text
1. 세션 초기화
   - 안정적인 runtime session ID가 있으면 /api/runtime-session-ensure
   - 없으면 /api/task-start

2. 사용자 입력 캡처
   - /api/user-message

3. 도구 사용 기록
   - /api/tool-used
   - /api/explore

4. 세션 종료
   - /api/assistant-response + /api/runtime-session-end
   - 또는 /api/assistant-response + /api/session-end

── 여기까지가 최소 동작 ──

5. /api/terminal-command
6. /api/todo
7. /api/save-context
8. /api/agent-activity + /api/async-task + /api/task-link
9. /api/question + /api/thought
```

새 런타임 파일 위치 관례:
- hook 방식: `.{runtime}/hooks/*.ts`
- plugin 방식: `.{runtime}/plugins/monitor.ts`
- skill 방식: `.agents/skills/<runtime-skill>/SKILL.md`
