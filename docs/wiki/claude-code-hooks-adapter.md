# Claude Code Hooks Adapter

Claude Code 통합은 `.claude/hooks/*.ts` 스크립트 집합으로 구현된다.
이 경로의 장점은 runtime lifecycle과 tool 사용을 비교적 자동으로 따라갈 수 있다는 점이다.

## 핵심 파일

- `.claude/hooks/common.ts`
- `.claude/hooks/session_start.ts`
- `.claude/hooks/user_prompt.ts`
- `.claude/hooks/ensure_task.ts`
- `.claude/hooks/terminal.ts`
- `.claude/hooks/tool_used.ts`
- `.claude/hooks/explore.ts`
- `.claude/hooks/agent_activity.ts`
- `.claude/hooks/todo.ts`
- `.claude/hooks/compact.ts`
- `.claude/hooks/subagent_lifecycle.ts`
- `.claude/hooks/session_end.ts`
- `.claude/hooks/stop.ts`
- `.claude/settings.json`
- `docs/guide/claude-setup.md`

## 기본 흐름

1. `SessionStart`, `UserPromptSubmit`, `PreToolUse`에서 runtime session을 ensure한다.
2. `user_prompt.ts`가 canonical `user.message`를 남긴다.
3. tool hook들이 bash, edit, explore, agent activity, todo, compact를 기록한다.
4. `subagent_lifecycle.ts`가 background async lifecycle을 기록한다.
5. `stop.ts`가 assistant response를 남기고 현재 task를 complete 방향으로 마무리한다.
6. `session_end.ts`는 현재 runtime session만 닫는다.

## 최근 코드 기준 중요한 변화

### `stop.ts`가 assistant response와 task complete를 함께 처리한다

현재 `stop.ts`는 `payload.last_assistant_message`를 읽어 `/api/assistant-response`를 먼저 남기고,
이어서 `/api/runtime-session-end`를 `completeTask: true`,
`completionReason: "assistant_turn_complete"`로 호출한다.

즉, Claude 통합에서 "assistant turn 마감"은 이제 명시적으로 기록된다.

### subagent runtime state 파일이 있다

hook 동작 중 transient subagent registry 정보가 `.claude/.subagent-registry.json`에 저장된다.
이 파일은 제품 데이터가 아니라 hook coordination용 상태다.

### 개발 로그는 `NODE_ENV=development`일 때 활성화된다

repo-local 설정과 `setup:external`이 생성한 hook command는
`NODE_ENV=development`를 포함하므로 `.claude/hooks.log`를 남길 수 있다.

## 이 경로의 장점

- raw prompt를 자동 캡처할 수 있다.
- tool use와 subagent lifecycle을 잘 잡아낸다.
- compact 이벤트를 구분해 planning lane에 기록할 수 있다.

## 주의할 점

- session lifecycle과 task lifecycle을 혼동하면 중복 complete가 생길 수 있다.
- clear event를 실제 task 종료로 해석하지 않도록 `session_end.ts`와 `stop.ts`의 역할 구분이 중요하다.
- hook payload 차이는 `docs/guide/hook-payload-spec.md`를 함께 봐야 한다.

## 관련 문서

- [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)
- [HTTP API Reference](./http-api-reference.md)
- [Testing & Development](./testing-and-development.md)
