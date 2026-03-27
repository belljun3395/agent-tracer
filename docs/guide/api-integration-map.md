# Agent Tracer - API Integration Map

런타임별 API 엔드포인트 사용 현황을 정리한 레퍼런스.
신규 런타임(Gemini, Codex 등)을 추가할 때 구현 범위를 결정하는 기준 문서.

각 런타임 구현은 공식 문서를 기반으로 작성되었다:
- **Claude Code hooks**: https://code.claude.com/docs/en/hooks
- **OpenCode plugins**: https://opencode.ai/docs/en/plugins
- **Codex hooks**: https://developers.openai.com/codex/hooks

관련 파일:
- `.claude/hooks/` — Claude Code 훅 구현체
- `.opencode/plugins/monitor.ts` — OpenCode 플러그인 구현체
- `.codex/hooks/` — Codex 훅 구현체 (`Stop`에서 transcript backfill 포함)
- `.agents/skills/codex-monitor/SKILL.md` — Codex skill + MCP 지침 경로

Codex CLI는 Agent Tracer에서 단일 통합이 아니라 두 경로로 나뉜다:

| Path | Runtime source | 주 용도 | 대표 API |
|-----|----------------|--------|---------|
| Codex hooks | `codex-hook` | 자동 prompt/Bash/transcript backfill, turn 단위 tracing | `/api/runtime-session-ensure`, `/api/user-message`, `/api/terminal-command`, `/api/explore`, `/api/tool-used`, `/api/assistant-response`, `/api/runtime-session-end` |
| Codex skill + MCP | `codex-skill` | thread/topic task 재사용, planning/context, canonical semantic tracing | `/api/runtime-session-ensure`, `/api/user-message`, `/api/save-context`, `/api/plan`, `/api/action`, `/api/verify`, `/api/assistant-response`, `/api/runtime-session-end` |

---

## 세션 생명주기

| API | 역할 | Claude Code | Codex CLI | OpenCode | 신규 런타임 추가 시 |
|-----|------|-------------|-----------|----------|---------------------|
| `/api/runtime-session-ensure` | 세션 upsert (없으면 생성, 있으면 조회) | `SessionStart`, `UserPromptSubmit`, `PreToolUse` | hooks `SessionStart`, `PreToolUse`; skill `monitor_runtime_session_ensure` | ❌ | 훅/수동 MCP의 첫 진입점으로 사용 |
| `/api/task-start` | 태스크/세션 명시적 생성 | ❌ | ❌ | `session.created` | 세션 ID 기반 task row를 직접 만들어야 할 때 사용 |
| `/api/runtime-session-end` | 런타임 세션 종료 | `Stop` (`completeTask: true`), `SessionEnd` (reason≠clear) | hooks `Stop` (`completeTask: true`), skill `monitor_runtime_session_end` | ❌ | 프로세스 종료나 turn 종료와 분리해 처리 |
| `/api/session-end` | 태스크 레벨 세션 종료 | ❌ | ❌ | `message.updated`, `session.idle`, exit 명령, `session.deleted` | resumable 세션을 닫되 task는 유지할 때 사용 |
| `/api/task-complete` | 태스크 완전 완료 처리 | ❌ | whole-thread 종료 시 skill manual | in-memory session state 유실 시 fallback | work item 종료를 별도 이벤트로 처리할 때 사용 |
| `/api/assistant-response` | assistant turn 결과 기록 | `Stop` | hooks `Stop.last_assistant_message`; skill `monitor_assistant_response` | `message.updated` + buffered `message.part.*` | assistant 최종 텍스트가 있으면 함께 기록 권장 |

세션 초기화 방식의 차이:

- **Claude Code** — `runtime-session-ensure`로 모든 훅에서 세션을 자동 upsert한다. `Stop`이 `/api/runtime-session-end` with `completeTask: true`를 호출해 primary task를 닫고, `SessionEnd`는 잔여 runtime session 정리에 가깝다.
- **Codex CLI** — hook 경로는 `SessionStart`/`PreToolUse`에서 `runtime-session-ensure`를 호출하고, `Stop`에서 `assistant.response` + `runtime-session-end`를 남긴다. skill 경로는 `monitor_runtime_session_ensure`로 같은 thread/topic task를 재사용한다.
- **OpenCode** — plugin이 `session.created`를 기준으로 `task-start`를 호출하고, 응답의 `task.id`를 이후 요청에 전달한다. `chat.message`와 `tool.execute.after`는 같은 task의 후속 이벤트를 기록하고, 종료 정리는 주로 `/api/session-end`를 통해 이뤄진다.

---

## 메시지/컨텍스트

| API | 역할 | Claude Code | Codex CLI | OpenCode | 신규 런타임 추가 시 |
|-----|------|-------------|-----------|----------|---------------------|
| `/api/user-message` | 사용자 입력 기록 | `UserPromptSubmit` | `UserPromptSubmit`, `Stop` transcript backfill fallback, skill `monitor_user_message` | `chat.message` hook | ✅ 필수. `captureMode: "raw"`, `source` 필드로 런타임 구분 |
| `/api/save-context` | planning 레인 스냅샷 | `SessionStart`, `PreCompact`, `PostCompact` | hooks `SessionStart`, skill `monitor_save_context` | ❌ | 세션 상태 변화 시점마다 기록 권장 |
| `/api/plan` | 구조화된 계획 단계 기록 | MCP/manual only | skill `monitor_plan` | MCP/manual only | MCP 수동 경로(`monitor_plan`)에서만 호출 |
| `/api/action` | 실행 직전 agent action 기록 | MCP/manual only | skill `monitor_action` | MCP/manual only | MCP 수동 경로(`monitor_action`)에서만 호출 |
| `/api/verify` | 검증 단계 결과 기록 | MCP/manual only | skill `monitor_verify` | MCP/manual only | MCP 수동 경로(`monitor_verify`)에서만 호출 |
| `/api/rule` | rule 관련 이벤트 기록 | MCP/manual only | skill `monitor_rule` | MCP/manual only | MCP 수동 경로(`monitor_rule`)에서만 호출. gap 명시 포함 |
| `/api/question` | assistant 질문/호출 패턴 기록 | MCP/manual only | skill `monitor_question` | `tool.execute.after` semantic routing (`request_user_input`, `monitor_question`) | assistant 질문 흐름에 접근할 수 있을 때 구현 |
| `/api/thought` | assistant reasoning/사고 흐름 기록 | MCP/manual only | skill `monitor_thought` | `tool.execute.after` semantic routing (`monitor_thought`) | 요약형 reasoning 신호가 있을 때 구현 |

`/api/plan`, `/api/action`, `/api/verify`, `/api/rule`은 native hook/plugin이 자동 호출하지 않는다. 현재는 MCP `monitor_*` 도구를 통한 수동 경로 전용이다.

OpenCode는 native question tool과 semantic monitor tool을 `tool.execute.after`에서 직접 라우팅한다. Claude/Codex는 현재 manual MCP 경로만 가진다.

---

## 도구 사용

| API | 역할 | Claude Code | Codex CLI | OpenCode | 신규 런타임 추가 시 |
|-----|------|-------------|-----------|----------|---------------------|
| `/api/tool-used` | 파일 편집 등 구현 행위 기록 | `PostToolUse(Edit\|Write\|mcp__*)`, `PostToolUseFailure` | hooks transcript `apply_patch`, skill `monitor_tool_used` | `tool.execute.after` — edit/write/create/apply_patch 계열 | ✅ 필수. `lane` 필드로 `implementation`/`coordination` 구분 |
| `/api/explore` | 파일/웹 탐색 행위 기록 | `PostToolUse(Read\|Glob\|Grep\|WebSearch\|WebFetch)` | hooks transcript `web_search_end`, skill `monitor_explore` | `tool.execute.after` — read/glob/grep/websearch/webfetch 계열 | ✅ 필수. 탐색 도구 매처 별도 분리 |
| `/api/terminal-command` | 터미널 명령 실행 기록 | `PostToolUse(Bash)` | `PostToolUse(Bash)`, skill `monitor_terminal_command` | `tool.execute.after` — bash/shell/exec 계열 | Bash 계열 도구가 있으면 구현 |
| `/api/todo` | Todo/Task 상태 변화 기록 | `PostToolUse(TodoWrite\|TaskCreate\|TaskUpdate)` | MCP/manual only | `tool.execute.after` — `todowrite`, `monitor_todo` | todo 도구 지원 시 구현 |

`lane` 분류 기준:

| 행위 | lane |
|------|------|
| 파일 편집 (Edit/Write/create) | `implementation` |
| Bash — 일반 명령 | `implementation` |
| Bash — test/build/lint/verify | `implementation` |
| MCP 도구 | `coordination` |
| 세션 시작/컴팩트/명령 의도 | `planning` |
| 백그라운드 태스크 (OpenCode) | `background` (taskKind 기반 자동 전환) |

`rules` 분류가 필요하면 현재는 `monitor_verify`, `monitor_rule` 같은 별도 semantic 경로를 사용한다.

---

## 에이전트/백그라운드

| API | 역할 | Claude Code | Codex CLI | OpenCode | 신규 런타임 추가 시 |
|-----|------|-------------|-----------|----------|---------------------|
| `/api/agent-activity` | 에이전트 위임/스킬 호출 기록 | `PostToolUse(Agent\|Skill)` | skill `monitor_agent_activity` | `tool.execute.after` + typed `event` callback | 서브에이전트 지원 시 구현 |
| `/api/async-task` | 백그라운드 태스크 상태 (running/completed/failed) | `SubagentStart`/`SubagentStop`, `Agent` + `run_in_background=true` | skill `monitor_async_task` | 백그라운드 링크 확정 시(`running`), `finalizeSession` 종료 시(`completed`/`failed`) | 백그라운드 실행 지원 시 구현 |
| `/api/task-link` | parent-child 태스크 연결 | `Agent` + `run_in_background=true` + child session id 추출 | skill `monitor_task_link` | `tool.execute.before` 예비 수집 → `tool.execute.after` 확정, `finalizeSession` retry | 서브에이전트가 별도 세션을 가지면 구현 |

`/api/task-link` 구현 시 주의:

- **Claude Code** — `PostToolUse(Agent)` 응답 텍스트에서 `session_id` 패턴을 정규식으로 추출 후 호출.
- **Codex CLI** — native hook 경로에는 자동 subagent lineage가 없고, skill 경로에서 `monitor_task_link`를 명시적으로 호출해야 한다.
- **OpenCode** — `tool.execute.before`에서 예비 링크를 먼저 수집하고(`output.args` 참조), `tool.execute.after`에서 확정. 링크 실패 시 `finalizeSession`에서 retry.

---

## 런타임별 구현 현황 요약

| API | Claude Code | Codex CLI | OpenCode |
|-----|-------------|-----------|----------|
| `/api/runtime-session-ensure` | ✅ | ✅ (`SessionStart`/`PreToolUse`, skill `monitor_runtime_session_ensure`) | ❌ |
| `/api/task-start` | ❌ | ❌ | ✅ |
| `/api/runtime-session-end` | ✅ (`Stop`, `SessionEnd`) | ✅ (`Stop`, skill `monitor_runtime_session_end`) | ❌ |
| `/api/session-end` | ❌ | ❌ | ✅ |
| `/api/task-complete` | ❌ | ❌ (whole-thread 종료 시 skill manual) | ⚠️ fallback only (missing session state) |
| `/api/assistant-response` | ✅ (`Stop`) | ✅ (`Stop.last_assistant_message`, skill `monitor_assistant_response`) | ✅ |
| `/api/user-message` | ✅ | ✅ (`UserPromptSubmit`, transcript backfill, skill `monitor_user_message`) | ✅ |
| `/api/save-context` | ✅ | ✅ (`SessionStart`, skill `monitor_save_context`) | ❌ |
| `/api/question` | ❌ (MCP 수동) | ❌ (skill manual) | ✅ |
| `/api/thought` | ❌ (MCP 수동) | ❌ (skill manual) | ✅ |
| `/api/tool-used` | ✅ | ✅ (`apply_patch` transcript backfill, skill `monitor_tool_used`) | ✅ |
| `/api/explore` | ✅ | ✅ (`web_search_end` transcript backfill, skill `monitor_explore`) | ✅ |
| `/api/terminal-command` | ✅ | ✅ (`PostToolUse(Bash)`, skill `monitor_terminal_command`) | ✅ |
| `/api/todo` | ✅ | ❌ (skill manual) | ✅ |
| `/api/agent-activity` | ✅ | ❌ (skill manual) | ✅ |
| `/api/async-task` | ✅ | ❌ (skill manual) | ✅ |
| `/api/task-link` | ✅ | ❌ (skill manual) | ✅ |
| `/api/plan` | ❌ (MCP 수동) | ❌ (skill manual) | ❌ (MCP 수동) |
| `/api/action` | ❌ (MCP 수동) | ❌ (skill manual) | ❌ (MCP 수동) |
| `/api/verify` | ❌ (MCP 수동) | ❌ (skill manual) | ❌ (MCP 수동) |
| `/api/rule` | ❌ (MCP 수동) | ❌ (skill manual) | ❌ (MCP 수동) |

Codex 참고:
- Hook 경로는 `runtime-session-ensure/end`, `user-message`, `terminal-command`, transcript backfill 기반 `explore`/`tool-used`, `assistant-response`를 제공한다.
- skill 경로는 같은 thread/topic task 재사용과 planning/context 기록을 담당한다.
- thread/topic 기준 최종 추적 경로는 여전히 skill(MCP) 쪽 `monitor_assistant_response`를 기준으로 보는 편이 안전하다.
- `codex-hook`와 `codex-skill`은 현재 별도 runtimeSource이므로, 둘을 같이 쓰면 task lineage도 분리될 수 있다.

Claude/OpenCode 참고:
- Claude primary task 종료는 현재 `/api/task-complete`가 아니라 `Stop`의 `/api/runtime-session-end` with `completeTask: true` 경로다.
- OpenCode의 일반 종료 경로는 `/api/session-end`이며, `/api/task-complete`는 in-memory session state를 잃었을 때의 예외적 fallback이다.

---

## 신규 런타임 추가 시 구현 순서

최소 동작 가능한 상태부터 순서대로 구현:

```
1. 세션 초기화
   - hook 방식이면: /api/runtime-session-ensure (모든 훅 공통 첫 호출)
   - plugin 방식이면: /api/task-start (첫 session.created 또는 첫 유효 이벤트에서 생성)

2. 사용자 입력 캡처
   - /api/user-message (UserPromptSubmit 상당 이벤트)

3. 도구 사용 기록
   - /api/tool-used  (편집 도구)
   - /api/explore    (탐색 도구)

4. 세션 종료
   - /api/assistant-response + /api/runtime-session-end
   - 또는 plugin/session model이면 /api/assistant-response + /api/session-end
   - /api/task-complete 는 stateless recovery/fallback 용도인지 먼저 구분

── 여기까지가 최소 동작 ──

5. /api/terminal-command  (Bash 계열 도구)
6. /api/todo              (TodoWrite/TaskCreate/TaskUpdate 계열)
7. /api/save-context      (세션 상태 변화 시점 — startup/compact/명령 의도)
8. /api/agent-activity + /api/async-task + /api/task-link  (서브에이전트)
9. /api/question + /api/thought  (assistant 응답 스트림 분석)
```

새 런타임 파일 위치 관례:
- hook 방식: `.{runtime}/hooks/*.ts` (Claude Code 패턴)
- plugin 방식: `.{runtime}/plugins/monitor.ts` (OpenCode 패턴)
