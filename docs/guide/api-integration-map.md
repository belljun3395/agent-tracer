# Agent Tracer - API Integration Map

런타임별 API 엔드포인트 사용 현황을 정리한 레퍼런스.
신규 런타임(Gemini, Codex 등)을 추가할 때 구현 범위를 결정하는 기준 문서.

각 런타임 구현은 공식 문서를 기반으로 작성되었다:
- **Claude Code hooks**: https://code.claude.com/docs/en/hooks
- **OpenCode plugins**: https://opencode.ai/docs/en/plugins

관련 파일:
- `.claude/hooks/` — Claude Code 훅 구현체
- `.opencode/plugins/monitor.ts` — OpenCode 플러그인 구현체

---

## 세션 생명주기

| API | 역할 | Claude Code | OpenCode | 신규 런타임 추가 시 |
|-----|------|-------------|----------|---------------------|
| `/api/runtime-session-ensure` | 세션 upsert (없으면 생성, 있으면 조회) | 모든 훅 공통 첫 호출 | ❌ | 훅마다 첫 진입점으로 호출 권장 |
| `/api/task-start` | 태스크/세션 명시적 생성 | ❌ | 첫 `chat.message` 또는 `tool.execute.after` | 세션 ID 기반 직접 생성이 필요하면 사용 |
| `/api/runtime-session-end` | 런타임 세션 종료 | `SessionEnd` (reason≠clear) | ❌ | 프로세스 종료 이벤트에 연결 |
| `/api/session-end` | 태스크 레벨 세션 종료 | ❌ | `session.idle`(suspend), `session.deleted`(complete), exit 명령 | 세션 일시중지/완료 구분이 필요하면 사용 |
| `/api/task-complete` | 태스크 완전 완료 처리 | ❌ | `session.deleted` (primary 세션) | 태스크 완료를 별도 이벤트로 처리할 때 사용 |

세션 초기화 방식의 차이:

- **Claude Code** — `runtime-session-ensure`로 모든 훅에서 세션을 자동 upsert. 응답의 `taskId`/`sessionId`를 이후 요청에 사용.
- **OpenCode** — `task-start`를 명시적으로 호출하고 응답의 `task.id`를 이후 모든 요청에 전달. 세션 상태를 플러그인 메모리(`sessionStates` Map)에서 직접 관리.

---

## 메시지/컨텍스트

| API | 역할 | Claude Code | OpenCode | 신규 런타임 추가 시 |
|-----|------|-------------|----------|---------------------|
| `/api/user-message` | 사용자 입력 기록 | `UserPromptSubmit` | `chat.message` hook | ✅ 필수. `captureMode: "raw"`, `source` 필드로 런타임 구분 |
| `/api/save-context` | planning 레인 스냅샷 | `SessionStart`, `Pre/PostCompact`, `Bash` + description 있을 때 | ❌ | 세션 상태 변화 시점마다 기록 권장 |
| `/api/question` | assistant 질문/호출 패턴 기록 | ❌ | `message.updated` 이벤트 분석 | assistant 응답 스트림 접근 가능하면 구현 |
| `/api/thought` | assistant reasoning/사고 흐름 기록 | ❌ | `message.updated` 이벤트 분석 | assistant 응답 스트림 접근 가능하면 구현 |

`/api/question`과 `/api/thought`는 OpenCode만 지원. assistant 응답 스트림(event stream)에 직접 접근할 수 있을 때만 구현 가능.

---

## 도구 사용

| API | 역할 | Claude Code | OpenCode | 신규 런타임 추가 시 |
|-----|------|-------------|----------|---------------------|
| `/api/tool-used` | 파일 편집 등 구현 행위 기록 | `PostToolUse(Edit\|Write\|mcp__*)`, `PostToolUseFailure` | `tool.execute.after` — edit/write/create 계열 | ✅ 필수. `lane` 필드로 `implementation`/`coordination`/`rules` 구분 |
| `/api/explore` | 파일/웹 탐색 행위 기록 | `PostToolUse(Read\|Glob\|Grep\|WebSearch\|WebFetch)` | `tool.execute.after` — read/glob/grep/search 계열 | ✅ 필수. 탐색 도구 매처 별도 분리 |
| `/api/terminal-command` | 터미널 명령 실행 기록 | `PostToolUse(Bash)` | `tool.execute.after` — bash/shell/exec 계열 | Bash 계열 도구가 있으면 구현 |
| `/api/todo` | Todo/Task 상태 변화 기록 | `PostToolUse(TodoWrite\|TaskCreate\|TaskUpdate)` | `tool.execute.after` — TodoWrite 계열, `message.updated` 분석 | todo 도구 지원 시 구현 |

`lane` 분류 기준:

| 행위 | lane |
|------|------|
| 파일 편집 (Edit/Write/create) | `implementation` |
| Bash — 일반 명령 | `implementation` |
| Bash — test/build/lint | `rules` |
| MCP 도구 | `coordination` |
| 세션 시작/컴팩트/명령 의도 | `planning` |
| 백그라운드 태스크 (OpenCode) | `background` (taskKind 기반 자동 전환) |

---

## 에이전트/백그라운드

| API | 역할 | Claude Code | OpenCode | 신규 런타임 추가 시 |
|-----|------|-------------|----------|---------------------|
| `/api/agent-activity` | 에이전트 위임/스킬 호출 기록 | `PostToolUse(Agent\|Skill)` | `tool.execute.after` — agent/skill/dispatch 계열 | 서브에이전트 지원 시 구현 |
| `/api/async-task` | 백그라운드 태스크 상태 (running/completed/failed) | `SubagentStart`/`SubagentStop`, `Agent` + `run_in_background=true` | 백그라운드 링크 확정 시(`running`), `finalizeSession` 종료 시(`completed`/`failed`) | 백그라운드 실행 지원 시 구현 |
| `/api/task-link` | parent-child 태스크 연결 | `Agent` + `run_in_background=true` + child session id 추출 | `tool.execute.before` 예비 수집 → `tool.execute.after` 확정, `finalizeSession` retry | 서브에이전트가 별도 세션을 가지면 구현 |

`/api/task-link` 구현 시 주의:

- **Claude Code** — `PostToolUse(Agent)` 응답 텍스트에서 `session_id` 패턴을 정규식으로 추출 후 호출.
- **OpenCode** — `tool.execute.before`에서 예비 링크를 먼저 수집하고(`output.args` 참조), `tool.execute.after`에서 확정. 링크 실패 시 `finalizeSession`에서 retry.

---

## 런타임별 구현 현황 요약

| API | Claude Code | OpenCode |
|-----|-------------|----------|
| `/api/runtime-session-ensure` | ✅ | ❌ |
| `/api/task-start` | ❌ | ✅ |
| `/api/runtime-session-end` | ✅ | ❌ |
| `/api/session-end` | ❌ | ✅ |
| `/api/task-complete` | ❌ | ✅ |
| `/api/user-message` | ✅ | ✅ |
| `/api/save-context` | ✅ | ❌ |
| `/api/question` | ❌ | ✅ |
| `/api/thought` | ❌ | ✅ |
| `/api/tool-used` | ✅ | ✅ |
| `/api/explore` | ✅ | ✅ |
| `/api/terminal-command` | ✅ | ✅ |
| `/api/todo` | ✅ | ✅ |
| `/api/agent-activity` | ✅ | ✅ |
| `/api/async-task` | ✅ | ✅ |
| `/api/task-link` | ✅ | ✅ |

---

## 신규 런타임 추가 시 구현 순서

최소 동작 가능한 상태부터 순서대로 구현:

```
1. 세션 초기화
   - hook 방식이면: /api/runtime-session-ensure (모든 훅 공통 첫 호출)
   - plugin 방식이면: /api/task-start (첫 이벤트에서 명시적 생성)

2. 사용자 입력 캡처
   - /api/user-message (UserPromptSubmit 상당 이벤트)

3. 도구 사용 기록
   - /api/tool-used  (편집 도구)
   - /api/explore    (탐색 도구)

4. 세션 종료
   - /api/runtime-session-end 또는 /api/session-end + /api/task-complete

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
