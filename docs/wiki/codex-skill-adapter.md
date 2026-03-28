# Codex Skill Adapter

Agent Tracer에서 Codex 통합의 캐노니컬 경로는 `codex-monitor` 스킬 + MCP다.
핵심 목표는 다음 두 가지다.

- 같은 Codex thread/topic에서 같은 task를 안정적으로 재사용
- `assistant.response`, planning, verify 같은 고신호 이벤트를 명시적으로 기록

## 핵심 파일

- `skills/codex-monitor/SKILL.md`
- `.agents/skills/codex-monitor/SKILL.md`
- `packages/mcp/src/index.ts`
- `packages/server/test/presentation/create-app.test.ts`
- `docs/guide/codex-setup.md`
- `AGENTS.md`

## 기본 흐름

1. `monitor_find_similar_workflows`
2. `monitor_runtime_session_ensure` (`runtimeSource: "codex-skill"`)
3. `monitor_user_message`
4. `monitor_explore` / `monitor_save_context` / `monitor_plan`
5. `monitor_terminal_command` / `monitor_tool_used` / `monitor_verify`
6. `monitor_assistant_response`
7. `monitor_runtime_session_end`
8. 전체 종료 시 `monitor_task_complete` 또는 `monitor_task_error`

## runtime session 재사용 모델

- `runtimeSource`는 `codex-skill` 고정
- 같은 thread/topic은 같은 `runtimeSessionId`를 재사용
- Codex CLI + monitor MCP에서는 `runtimeSessionId`를 명시 전달하고 `CODEX_THREAD_ID`를 권장값으로 사용

이 모델로 turn이 늘어나도 task는 유지되고, session만 turn 단위로 누적된다.

## assistant.response 기록 원칙

최종 응답은 `monitor_assistant_response`로 기록한다.
이 이벤트를 답변 직전에 호출하면, thread/topic 단위 응답 이력이 안정적으로 남는다.

## repo-local과 external discovery

repo-local:
- source-of-truth: `skills/codex-monitor/SKILL.md`
- discovery path: `.agents/skills/codex-monitor/SKILL.md`

external:
- `setup:external --mode codex`가 target repo의 `AGENTS.md` managed block을 갱신
- `.agents/skills/codex-monitor/SKILL.md`를 생성

## 실패 모드 체크리스트

### assistant.response가 안 남는 경우

1. `codex mcp list`에서 `monitor` 등록 확인
2. Codex가 `codex-monitor` 스킬을 읽었는지 확인
3. 답변 직전에 `monitor_assistant_response`를 호출하는지 확인
4. `monitor_runtime_session_end`가 먼저 호출되지 않았는지 확인

### 스킬이 로드되지 않는 경우

1. `skills/codex-monitor/SKILL.md`를 수정했는지 확인
2. `npm run sync:skills` 실행 여부 확인
3. 새 Codex thread에서 재시작
4. 필요 시 `$codex-monitor`를 명시

## 관련 문서

- [Codex Setup Guide](../guide/codex-setup.md)
- [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)
- [MCP Tool Reference](./mcp-tool-reference.md)
- [setup:external Automation Script](./setup-external-automation-script.md)
