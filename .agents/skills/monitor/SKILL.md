<!-- GENERATED FILE: edit skills/... source, then run node scripts/sync-skill-projections.mjs -->

---
name: monitor
description: MCP가 있는 모든 환경에서 Agent Tracer 모니터링 기록. Cursor, Windsurf, 웹 IDE, 기타 MCP 지원 환경에서 사용.
---

# Agent Tracer Monitor

`monitor` MCP 도구로 한 번의 사용자 요청에 하나의 모니터링 태스크를 동기화.

## Quick Start

1. `monitor-server` MCP 서버 사용 가능 여부 확인. 없으면 작업은 계속하고 마지막에 gap 리포트.
2. 첫 번째 실질적 작업 전에 `monitor_task_start` 호출.
3. 이후 모든 모니터링 도구 호출에 반환된 `task.id`와 `sessionId` 재사용.
4. 작업 중 주요 마일스톤 기록.
5. `monitor_task_complete` 또는 `monitor_task_error`로 종료.

네이티브 projection:
- source-of-truth: `skills/monitor/SKILL.md`
- generated discovery paths: `.agents/skills/monitor/SKILL.md`, `.claude/skills/agent-tracer-monitor/SKILL.md`

## 이벤트 매핑

**사용자 메시지 (캐노니컬 경로):**
- `monitor_user_message` + `captureMode="raw"` — 실제 사용자 프롬프트 텍스트
  - `messageId` 필수 (중복 방지)
  - `source="manual-mcp"` (MCP/수동 환경), `phase="initial"` 또는 `"follow_up"`
- `monitor_user_message` + `captureMode="derived"` — raw 소스 연결 보강 레코드
  - `sourceEventId` 필수 (raw 이벤트 ID 참조)

**세션 생명주기:**
- `monitor_session_end` — 현재 세션 종료 (태스크는 `running` 유지)
- `monitor_task_complete` — 작업 항목 명시적 종료
- `monitor_task_error` — 실패·차단·중단 시
- `monitor_task_link` — background/subagent lineage 를 연결할 때

**작업 이벤트:**
- `monitor_explore` — 파일 읽기, 코드 검색, 문서 조회
- `monitor_save_context` + `lane="planning"` — 계획, 분석, 접근 결정 (체크포인트; raw 프롬프트 아님)
- `monitor_terminal_command` — 셸 명령. test/lint/build는 `lane="rules"`, 그 외 `lane="implementation"`
- `monitor_tool_used` — 파일 수정, patch 적용 등 핵심 도구 사용
- `monitor_rule` + `ruleId="user-message-capture-unavailable"` — raw 캡처 불가 환경에서 gap 명시

**시맨틱 흐름 이벤트 (선택적, 고신호):**
- `monitor_question` — 에이전트 질문 흐름 추적
  - `questionId` 필수 (같은 질문의 단계 묶음)
  - `questionPhase`: `asked` (user 레인) / `answered` (user 레인) / `concluded` (planning 레인)
- `monitor_todo` — 태스크 내 항목 상태 전이 추적
  - `todoId` 필수, `todoState`: `added` / `in_progress` / `completed` / `cancelled`
  - 항상 `planning` 레인
- `monitor_thought` — 요약 안전한 추론 스냅샷 (planning 레인)
  - raw 체인오브소트 덤프 금지. `modelName` / `modelProvider` 옵션 첨부 가능
  - `monitor_save_context`와 다름: thought는 AI 추론, context는 핸드오프 체크포인트

**coordination 레인 이벤트 (선택적, 에이전트 지원 행위):**
- `monitor_agent_activity` — MCP 호출, skill 사용, delegation, handoff 기록
  - `activityType` 필수: `agent_step` | `mcp_call` | `skill_use` | `delegation` | `handoff` | `bookmark` | `search`
  - `activityType="skill_use"` → Skill 도구 호출 직후, `skillName` / `skillPath` 첨부
  - `activityType="delegation"` → Agent 도구로 서브에이전트 dispatch 직후, `agentName` 첨부
  - `activityType="mcp_call"` → 외부 MCP 서버 호출 시, `mcpServer` / `mcpTool` 첨부
  - `activityType="search"` → WebSearch/WebFetch로 외부 리소스를 적극적으로 조회할 때
  - `activityType="handoff"` → 다른 에이전트·세션으로 작업을 넘길 때
  - Claude Code / OpenCode 자동화 환경에서는 훅이 자동 기록하므로 중복 호출 불필요

## 필수 리듬

- 첫 탐색 전에 모니터링 시작
- 첫 수정 전에 planning 스냅샷 하나 저장
- 검증 명령은 요약 이벤트에 숨기지 말고 개별 기록
- 고신호 이벤트만 기록, 노이즈는 생략
- 파일이 이벤트에 중요하면 `filePaths`에 절대 경로 전달
- MCP 도구 실패 시 작업 계속 후 마지막에 모니터링 gap 리포트

## 최소 흐름

1. `monitor_task_start`
2. `monitor_user_message` (`captureMode="raw"`, `phase="initial"`) — 사용자 요청 기록
3. `monitor_explore` — 탐색
4. `monitor_save_context` — 계획 스냅샷
5. `monitor_terminal_command` / `monitor_tool_used` — 구현
6. `monitor_task_complete` 또는 `monitor_task_error`

후속 메시지가 있을 경우:
- `monitor_user_message` (`captureMode="raw"`, `phase="follow_up"`) — 후속 요청 기록
  (동일 `taskId` 사용 — 새 태스크 생성 금지)
