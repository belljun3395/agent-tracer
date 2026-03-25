<!-- GENERATED FILE: edit skills/... source, then run node scripts/sync-skill-projections.mjs -->

---
name: codex-monitor
description: Codex CLI 전용 Agent Tracer 모니터링. apply_patch, view_file 등 Codex 도구명 컨벤션 포함. monitor-server MCP 사용 불가 시 작업은 계속하고 마지막에 gap을 보고.
---

# Codex Agent Tracer Monitor

Codex CLI 환경에서 Agent Tracer에 태스크를 동기화하는 primary 경로.
네이티브 훅이 지원되지 않는 Codex에서 MCP 도구로 수동 추적.

## Quick Start

1. `monitor-server` MCP 서버 확인. 없으면 작업은 계속하고 마지막에 gap 리포트.
2. 첫 탐색·수정·검증 전에 `monitor_task_start` 호출. 이때 `runtimeSource: "codex-skill"` 포함.
3. 반환된 `task.id`와 `sessionId`를 이후 모든 호출에 재사용.
4. 고신호 마일스톤 기록.
5. `monitor_task_complete` 또는 `monitor_task_error`로 종료.

네이티브 projection:
- source-of-truth: `skills/codex-monitor/SKILL.md`
- generated discovery path: `.agents/skills/codex-monitor/SKILL.md`

## 이벤트 매핑

(monitor 스킬과 동일 + Codex 특화 컨벤션)

**사용자 메시지 (캐노니컬 경로):**
- `monitor_user_message` + `captureMode="raw"` — 실제 사용자 프롬프트 텍스트
  - `source="manual-mcp"`, `phase="initial"` 또는 `"follow_up"`
  - `messageId` 필수

**세션 생명주기:**
- `monitor_session_end` — 현재 세션 종료 (태스크 유지)
- `monitor_task_complete` — 작업 항목 명시적 종료
- `monitor_task_error` — 실패·차단·중단 시
- `monitor_task_link` — background/subagent lineage 를 뒤늦게 연결할 때 사용
- `monitor_async_task` — 백그라운드 태스크 상태 기록. `asyncTaskId` + `asyncStatus` 필수
  - `asyncStatus`: `running`(시작) / `completed`(성공) / `error`(실패) / `cancelled` / `interrupt`
  - 서브에이전트 dispatch 직후 `running`, 완료 시 `completed`/`error`

**작업 이벤트:**
- `monitor_explore` — `read_file`, `web_search`, 의존성 확인
- `monitor_save_context` + `lane="planning"` — 계획·분석·트레이드오프 (체크포인트; raw 프롬프트 아님)
- `monitor_plan` — 계획 단계 기록. `action`(snake_case 동사) 필수 (예: `inspect_current_state`, `design_solution`)
- `monitor_action` — 실행 직전 agent action 기록. `action`(snake_case 동사) 필수
- `monitor_verify` — 검증 단계 결과 기록. `action` + `result` + `status` 필수. test/build/lint 완료 시 사용
- `monitor_terminal_command` — `lane="rules"` for test/lint/build, 그 외 `lane="implementation"`
- `monitor_tool_used` — `apply_patch`, `view_image` 등 핵심 Codex 도구
- `monitor_rule` — rule 관련 이벤트. `action` + `ruleId` + `severity` + `status` 필수
  - Codex는 raw prompt 캡처 불가 환경이므로 gap 명시 시: `ruleId="user-message-capture-unavailable"`

**시맨틱 흐름 이벤트 (선택적):**
- `monitor_question` — `questionId` + `questionPhase` (`asked`/`answered`/`concluded`)
- `monitor_todo` — `todoId` + `todoState` (`added`/`in_progress`/`completed`/`cancelled`)
- `monitor_thought` — 요약 추론 스냅샷. `modelName` / `modelProvider` 옵션. raw CoT 덤프 금지.

**coordination 레인 이벤트 (선택적):**
- `monitor_agent_activity` — MCP 호출, skill 사용, delegation, handoff 기록
  - `activityType` 필수: `agent_step` | `mcp_call` | `skill_use` | `delegation` | `handoff` | `bookmark` | `search`
  - `activityType="skill_use"` → skill 호출 직후, `skillName` / `skillPath` 첨부
  - `activityType="delegation"` → 서브에이전트 dispatch 직후, `agentName` 첨부
  - `activityType="mcp_call"` → 외부 MCP 서버 호출 시, `mcpServer` / `mcpTool` 첨부
  - `activityType="search"` → `web_search`로 외부 리소스를 적극적으로 조회할 때

## Codex 컨벤션

- **태스크 제목**: `Codex - <workspace-name>` (예: `Codex - agent-tracer`)
- **시작 요약**: 한 문장으로 사용자 목표 서술
- **계획 제목**: 동사로 시작 (예: `Inspect current integration`, `Switch to skill-based monitoring`)
- **도구명**: 실제 Codex 도구명 사용 (`apply_patch`, `view_file`, `read_file`, `web_search`)
- **실패 요약**: 무엇이 실패했고 어떤 후속 작업이 남았는지 명시

## 최소 흐름

1. `monitor_task_start` (`title`: `Codex - <workspace>`, `runtimeSource`: `"codex-skill"`)
2. `monitor_user_message` (`captureMode="raw"`, `phase="initial"`, `source="manual-mcp"`) — 사용자 요청 기록
3. `monitor_explore` — 코드베이스·레퍼런스 탐색
4. `monitor_save_context` (`lane="planning"`) — 계획 스냅샷
5. `monitor_terminal_command` + `monitor_tool_used` — 구현
6. `monitor_task_complete` 또는 `monitor_task_error`

> monitor-server 미가용 시 작업은 계속하고 마지막에 gap 리포트.
