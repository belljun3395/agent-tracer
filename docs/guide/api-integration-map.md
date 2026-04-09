# Agent Tracer - API Integration Map

런타임별 API 엔드포인트 사용 현황을 정리한 레퍼런스다.
현재 저장소에 구현된 자동 어댑터는 Claude Code plugin 이고,
다른 런타임은 같은 API 를 직접 호출하는 방식으로 붙일 수 있다.

구현 근거:
- Claude Code hooks: https://code.claude.com/docs/en/hooks
- Claude plugin 구현: `.claude/plugin/hooks/*.ts`

보완 문서:
- [Runtime API flow & preprocessing](./runtime-api-flow-and-preprocessing.md)
- [Runtime capabilities](./runtime-capabilities.md)

## 세션 생명주기

| API | 역할 | Claude Code plugin | 수동 런타임 |
|-----|------|--------------------|-------------|
| `/api/runtime-session-ensure` | 런타임 세션 upsert | `SessionStart`, `UserPromptSubmit`, `PreToolUse` | 안정적인 runtime session ID 가 있으면 사용 |
| `/api/task-start` | 태스크/세션 명시 생성 | 거의 사용하지 않음 | session ID 기반 바인딩이 없을 때 사용 |
| `/api/runtime-session-end` | 런타임 세션 종료 | `Stop`, `SessionEnd` | turn 종료와 task 종료를 분리하고 싶을 때 사용 |
| `/api/session-end` | 태스크 레벨 세션 종료 | 직접 호출하지 않음 | resumable session 만 닫을 때 사용 |
| `/api/task-complete` | 태스크 완전 종료 | 직접 호출하지 않음 | 전체 work item 종료 시 사용 |
| `/api/assistant-response` | assistant turn 결과 기록 | `Stop` | assistant 최종 텍스트가 있으면 호출 |

## 메시지/컨텍스트

| API | 역할 | Claude Code plugin | 수동 런타임 |
|-----|------|--------------------|-------------|
| `/api/user-message` | 사용자 입력 기록 | `UserPromptSubmit` | 필수 |
| `/api/save-context` | planning 레인 스냅샷 | `SessionStart`, `PreCompact`, `PostCompact` | 선택 |
| `/api/plan` | 구조화된 계획 단계 기록 | MCP/manual only | 선택 |
| `/api/action` | 실행 직전 agent action 기록 | MCP/manual only | 선택 |
| `/api/verify` | 검증 단계 결과 기록 | MCP/manual only | 선택 |
| `/api/rule` | rule 관련 이벤트 기록 | MCP/manual only | 선택 |
| `/api/question` | 질문 흐름 기록 | MCP/manual only | 선택 |
| `/api/thought` | 요약형 reasoning 기록 | MCP/manual only | 선택 |

## 도구 사용

| API | 역할 | Claude Code plugin | 수동 런타임 |
|-----|------|--------------------|-------------|
| `/api/tool-used` | 구현 행위 기록 | `PostToolUse(Edit|Write|mcp__*)`, `PostToolUseFailure` | 필수 |
| `/api/explore` | 파일/웹 탐색 기록 | `PostToolUse(Read|Glob|Grep|WebSearch|WebFetch)` | 필수 |
| `/api/terminal-command` | 터미널 명령 실행 기록 | `PostToolUse(Bash)` | Bash 계열 도구가 있으면 사용 |
| `/api/todo` | Todo 상태 변화 기록 | `PostToolUse(TodoWrite|TaskCreate|TaskUpdate)` | todo 도구가 있으면 사용 |

## 에이전트/백그라운드

| API | 역할 | Claude Code plugin | 수동 런타임 |
|-----|------|--------------------|-------------|
| `/api/agent-activity` | 위임/스킬/MCP 호출 기록 | `PostToolUse(Agent|Skill|mcp__*)` | 서브에이전트나 skill 개념이 있으면 사용 |
| `/api/async-task` | 백그라운드 태스크 상태 | `SubagentStart`, `SubagentStop` | background 실행이 있으면 사용 |
| `/api/task-link` | parent-child 태스크 연결 | child runtime session 확보 시 | background lineage 가 있으면 사용 |

## 신규 런타임 추가 시 최소 구현 순서

```text
1. /api/runtime-session-ensure 또는 /api/task-start
2. /api/user-message
3. /api/tool-used
4. /api/explore
5. /api/assistant-response
6. /api/runtime-session-end 또는 /api/session-end
```

그 다음 필요에 따라 `/api/terminal-command`, `/api/todo`, `/api/save-context`,
`/api/agent-activity`, `/api/async-task`, `/api/task-link`, `/api/question`, `/api/thought`
를 추가하면 된다.
