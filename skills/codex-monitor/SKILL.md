---
name: codex-monitor
description: Codex CLI 전용 Agent Tracer 모니터링. codex-skill runtimeSource + MCP 도구를 캐노니컬 경로로 사용한다. monitor-server MCP 미가용 시 작업은 계속하고 마지막에 gap을 보고한다.
---

# Codex Agent Tracer Monitor

Codex CLI의 캐노니컬 모니터링 경로는 `codex-monitor` 스킬 + MCP다.
`runtimeSource`는 항상 `codex-skill`을 사용한다.

## Quick Start

1. `monitor-server` MCP 서버를 확인한다. 미가용이면 작업은 계속하고 마지막에 gap 리포트를 남긴다.
2. 작업 시작 전 `monitor_find_similar_workflows`로 유사 워크플로우를 검색한다.
   - 검색어는 짧은 핵심 키워드만 사용하고 `tags`는 사용하지 않는다.
3. 같은 Codex thread/topic에서 재사용할 `runtimeSessionId`를 준비한다.
   - `printf '%s' "${CODEX_THREAD_ID:-}"`로 먼저 확인한다.
   - 비어 있으면 `node -e "console.log('codex-' + crypto.randomUUID())"`로 생성하고, 같은 thread/topic에서 계속 재사용한다.
4. 턴 시작 시 `monitor_runtime_session_ensure`를 호출한다.
   - `runtimeSource: "codex-skill"`, `runtimeSessionId`, `title`, `workspacePath`를 전달한다.
5. 반환된 `taskId`, `sessionId`를 그 턴의 모든 `monitor_*` 호출에 재사용한다.
6. 답변 직전에 `monitor_assistant_response`를 기록한다.
7. 답변 직후 `monitor_runtime_session_end`를 호출한다.
   - `runtimeSessionId`를 ensure와 동일하게 전달한다.
   - follow-up 재사용이면 `completionReason: "idle"`
   - 작업 전체 종료일 때만 `completeTask: true`
8. thread/topic 전체 작업이 끝났을 때만 `monitor_task_complete` 또는 `monitor_task_error`를 호출한다.

## Guardrails

- `monitor_runtime_session_ensure`가 성공하기 전에는 `taskId`가 필요한 `monitor_*` 호출을 하지 않는다.
- `taskId: "pending"` 같은 placeholder 값을 절대 사용하지 않는다.
- ensure 실패 시, `runtimeSessionId`를 확보해 동일 요청에서 ensure를 1회 재시도한다.
- ensure 실패 자체를 `monitor_rule`/`monitor_agent_activity`로 기록하려면, ensure 성공 후 받은 실제 `taskId`/`sessionId`를 사용한다.
- UUID fallback 생성은 `python`이 아니라 `node`를 사용한다.

네이티브 projection:
- source-of-truth: `skills/codex-monitor/SKILL.md`
- generated discovery path: `.agents/skills/codex-monitor/SKILL.md`

Codex에서 스킬이 잡히지 않는 것처럼 보이면:
- `skills/codex-monitor/SKILL.md`를 수정했는지 확인한다.
- `npm run sync:skills`를 실행해 projection을 갱신한다.
- 필요하면 새 Codex thread에서 다시 시작한다.
- 자동 트리거가 빗나가면 `$codex-monitor`를 명시한다.

## 이벤트 매핑

**사용자 메시지:**
- `monitor_user_message` + `captureMode="raw"`
  - `source="manual-mcp"`
  - `phase="initial"` 또는 `"follow_up"`
  - `messageId` 필수

**세션 생명주기:**
- `monitor_runtime_session_ensure` — thread/topic task 재사용 진입점
- `monitor_runtime_session_end` — 턴 단위 세션 종료
- `monitor_session_end` — 세션만 종료하고 task는 유지
- `monitor_task_complete` — 전체 작업 종료
- `monitor_task_error` — 실패/중단 종료
- `monitor_task_link` — background/subagent lineage 연결
- `monitor_async_task` — background task lifecycle

**작업 이벤트:**
- `monitor_explore` — 파일/웹 탐색
- `monitor_save_context` (`lane="planning"`) — 계획/분석 체크포인트
- `monitor_plan` — 구조화된 계획 단계
- `monitor_action` — 실행 직전 액션
- `monitor_verify` — test/build/lint 검증 결과
- `monitor_terminal_command` (`lane="implementation"`) — 터미널 명령
- `monitor_tool_used` — 핵심 도구 사용
- `monitor_rule` — 규칙 검사/위반/보정 이벤트
- `monitor_assistant_response` — final user-facing 응답 기록

**시맨틱 흐름 이벤트 (선택):**
- `monitor_question` — 질문 흐름
- `monitor_todo` — todo lifecycle
- `monitor_thought` — 요약 추론 스냅샷

**coordination 레인 이벤트 (선택):**
- `monitor_agent_activity` (`activityType` 필수)
  - `skill_use`, `delegation`, `mcp_call`, `search` 등

## Codex 컨벤션

- 태스크 제목: `Codex - <workspace-name>` (예: `Codex - agent-tracer`)
- 기본 단위: 한 요청이 아니라 같은 Codex thread/topic
- runtime source: `codex-skill` 고정
- 런타임 세션 키: 같은 thread/topic에서는 같은 `runtimeSessionId` 유지
- ensure/end 호출에 같은 `runtimeSessionId`를 명시적으로 전달
- 권장 도구명: `apply_patch`, `view_file`, `read_file`, `web_search`
- 최종 응답은 `monitor_assistant_response`로 누락 없이 남긴다

## 워크플로우 라이브러리

작업 시작 전:
1. `monitor_find_similar_workflows`를 호출한다.
2. 결과가 있으면 `useCase`, `rating`, `outcomeNote`, `tags`를 요약해 보여준다.
3. "이 워크플로우를 참고할까요?"를 물어보고 답변에 맞춰 진행한다.
4. 결과가 없거나 서버 미응답이면 바로 진행한다.

작업 완료 후:
1. `monitor_question`으로 저장 의사를 묻는다.
2. 사용자가 원하면 `rating`, `useCase`, `workflowTags`, `outcomeNote`를 받는다.
3. `GET /api/tasks?limit=1`로 최신 taskId를 확인한다.
4. `monitor_evaluate_task`를 호출한다.

## 최소 흐름

1. `monitor_find_similar_workflows`
2. `runtimeSessionId` 확보 (`CODEX_THREAD_ID` 우선, 없으면 node로 생성)
3. `monitor_runtime_session_ensure` (`runtimeSource: "codex-skill"`, `runtimeSessionId`)
4. `monitor_user_message` (`captureMode: "raw"`)
5. `monitor_explore` / `monitor_save_context` / `monitor_plan`
6. `monitor_terminal_command` / `monitor_tool_used` / `monitor_verify`
7. `monitor_assistant_response`
8. `monitor_runtime_session_end` (`runtimeSessionId` 동일값)
9. 필요 시 `monitor_task_complete` 또는 `monitor_task_error`

> monitor-server 미가용 시 작업은 계속하고 마지막에 gap 리포트를 남긴다.
