---
name: codex-monitor
description: Codex CLI 전용 Agent Tracer 모니터링. apply_patch, view_file 등 Codex 도구명 컨벤션 포함. monitor-server MCP 사용 불가 시 작업은 계속하고 마지막에 gap을 보고.
---

# Codex Agent Tracer Monitor

Codex CLI 환경에서 Agent Tracer에 태스크를 동기화하는 primary 경로.
네이티브 훅이 지원되지 않는 Codex에서 MCP 도구로 수동 추적.

## Quick Start

1. `monitor-server` MCP 서버 확인. 없으면 작업은 계속하고 마지막에 gap 리포트.
2. 이 Codex thread/topic 에 대응하는 `runtimeSessionId`를 하나 정하고 같은 흐름에서는 계속 재사용한다.
   - 런타임이 안정적인 thread/session id를 알려주면 그 값을 사용.
   - 없으면 첫 턴에 한 번만 임의 id를 만들고 같은 thread 안 follow-up 에서 계속 재사용.
3. 각 턴 시작 시 `monitor_runtime_session_ensure` 호출. `runtimeSource: "codex-skill"`, 위 `runtimeSessionId`, `title`, `workspacePath`를 전달.
4. 반환된 `taskId`와 `sessionId`를 그 턴의 모든 호출에 재사용.
5. 고신호 마일스톤 기록.
6. 최종 답변 직전에 `monitor_assistant_response`로 assistant 응답을 기록.
7. 답변 직후 턴을 닫을 때 `monitor_runtime_session_end`를 호출한다.
   - 턴 사이 재사용 목적이면 `completionReason: "idle"`
   - 작업 전체를 끝낼 때만 `completeTask: true`
8. `monitor_task_complete` 또는 `monitor_task_error`는 thread/topic 전체 작업이 실제로 끝났을 때만 사용.

네이티브 projection:
- source-of-truth: `skills/codex-monitor/SKILL.md`
- generated discovery path: `.agents/skills/codex-monitor/SKILL.md`

Codex에서 이 스킬이 안 잡히는 것처럼 보이면 아래를 먼저 확인:
- Codex에서는 `monitor`가 아니라 `codex-monitor`를 사용한다.
- 수정은 `skills/codex-monitor/SKILL.md`에서 하고, 반영은 `npm run sync:skills`로 projection을 갱신한다.
- 현재 스레드가 옛 지시를 계속 쓰면 새 스레드에서 다시 시작한다.
- 자동 트리거가 빗나가면 프롬프트에 `$codex-monitor`를 직접 적는다.
  - 예: ``$codex-monitor 이 요청부터 모니터링 시작해줘``

## 이벤트 매핑

(monitor 스킬과 동일 + Codex 특화 컨벤션)

**사용자 메시지 (캐노니컬 경로):**
- `monitor_user_message` + `captureMode="raw"` — 실제 사용자 프롬프트 텍스트
  - `source="manual-mcp"`, `phase="initial"` 또는 `"follow_up"`
  - `messageId` 필수

**세션 생명주기:**
- `monitor_runtime_session_ensure` — 같은 `runtimeSessionId`면 같은 task를 재사용하고, 턴이 다시 시작되면 새 monitor session을 연다
- `monitor_runtime_session_end` — 현재 turn의 runtime session 을 닫는다
  - follow-up 에 같은 task를 이어 붙이고 싶으면 `completionReason: "idle"`
  - 작업 전체 종료일 때만 `completeTask: true`
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
- `monitor_assistant_response` — 최종 user-facing 답변을 `assistant.response` 이벤트로 기록
  - Codex는 native stop hook 이 없으므로 final answer 직전에 수동 호출
  - `source`는 보통 `codex-skill`
- `monitor_terminal_command` — 현재 MCP 스키마 기준 `lane="implementation"`만 사용
  - 과거 `rules` 값은 백엔드에서 `implementation`으로 정규화되지만, 새 수동 호출에서는 `implementation`으로 기록
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
- **태스크 단위**: 기본은 "한 user request"가 아니라 "같은 Codex thread/topic"
- **시작 요약**: 한 문장으로 사용자 목표 서술
- **런타임 세션 키**: 같은 thread/topic 에서는 같은 `runtimeSessionId` 유지. 완전히 다른 작업으로 전환할 때만 새 값 사용
- **계획 제목**: 동사로 시작 (예: `Inspect current integration`, `Switch to skill-based monitoring`)
- **도구명**: 실제 Codex 도구명 사용 (`apply_patch`, `view_file`, `read_file`, `web_search`)
- **실패 요약**: 무엇이 실패했고 어떤 후속 작업이 남았는지 명시

## 워크플로우 라이브러리 — 작업 완료 후 평가

작업이 마무리된 것 같으면:

1. `monitor_question`으로 사용자에게 평가 의사를 먼저 확인한다.
   - 예: "이 작업을 워크플로우 라이브러리에 저장할까요?"
2. 사용자가 원하면 아래 정보를 물어본다 (한 번에 물어봐도 됨):
   - `rating`: `good` / `skip`
   - `useCase`: 작업 종류 (예: `"java 최신 조사"`)
   - `workflowTags`: 태그 목록
   - `outcomeNote`: 잘 된 접근법 — 다음 참고 힌트
3. 현재 taskId: `GET http://localhost:3847/api/tasks?limit=1` 로 조회.
4. `monitor_evaluate_task` 호출해 저장.

> 모니터 서버 미응답 시 건너뜀.

## 워크플로우 라이브러리 검색

작업을 시작하기 전에 반드시:

1. `monitor_find_similar_workflows`로 유사한 과거 워크플로우를 검색한다.
   - 검색어는 `java`, `typescript refactor` 처럼 **짧은 핵심 키워드**를 사용할 것. 검색 방식이 SQLite LIKE 패턴 매칭(`%{query}%`)이므로, 긴 문장을 넣으면 매칭에 실패한다.
   - **`tags` 파라미터는 사용하지 않는다.** 저장된 워크플로우의 태그와 정확히 일치해야만 동작하므로, 추측으로 넣으면 실제 존재하는 워크플로우가 걸러진다. `description`만으로 검색할 것.
2. 결과가 1개 이상이면 `useCase`, `rating`, `outcomeNote`, `tags`를 요약해 사용자에게 보여준다.
3. "이 워크플로우를 참고할까요?" 라고 물어본 뒤 답변에 따라 접근 방식을 결정한다.
4. 결과 없음 또는 서버 미응답 시 검색을 건너뛰고 바로 진행한다.

## 최소 흐름

1. `monitor_find_similar_workflows` — 유사 워크플로우 검색 (결과 있으면 사용자에게 확인)
2. 같은 thread/topic 에서 재사용할 `runtimeSessionId`를 정하거나 이어받기
3. `monitor_runtime_session_ensure` (`runtimeSource`: `"codex-skill"`, `runtimeSessionId`, `title`: `Codex - <workspace>`)
4. `monitor_user_message` (`captureMode="raw"`, `phase="initial"` 또는 `"follow_up"`, `source="manual-mcp"`) — 사용자 요청 기록
5. `monitor_explore` / `monitor_save_context` (`lane="planning"`) — 탐색과 계획
6. `monitor_terminal_command` + `monitor_tool_used` — 구현
7. `monitor_assistant_response` — final answer 직전 assistant 응답 기록
8. `monitor_runtime_session_end` — 턴 종료
   - follow-up 재사용이면 `completionReason: "idle"`
   - 작업 전체 완료면 `completeTask: true`
9. 완전히 끝난 작업만 `monitor_task_complete` 또는 `monitor_task_error`

> monitor-server 미가용 시 작업은 계속하고 마지막에 gap 리포트.
