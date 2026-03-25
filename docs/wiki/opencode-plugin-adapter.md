# OpenCode Plugin Adapter

OpenCode 통합은 `.opencode/plugins/monitor.ts` 한 파일에 집중돼 있다.
plugin hook과 documented event callback을 함께 사용해,
task lifecycle과 richer semantic event를 자동으로 기록하는 경로다.

## 핵심 파일

- `.opencode/plugins/monitor.ts`
- `docs/guide/opencode-setup.md`
- `docs/guide/opencode-plugin-spec.md`
- `docs/guide/api-integration-map.md`

## 관찰하는 신호

plugin 소스와 guide 기준으로 현재 아래 신호를 사용한다.

- direct hook: `chat.message`
- direct hook: `command.execute.before`
- direct hook: `tool.execute.before`
- direct hook: `tool.execute.after`
- event callback: `session.created`
- event callback: `message.updated`
- event callback: `session.idle`
- event callback: `command.executed`
- event callback: `tui.command.execute`
- event callback: `session.deleted`
- event callback: `server.instance.disposed`

## 기본 흐름

1. `session.created`에서 task-start를 호출해 task row를 만든다.
2. `chat.message`에서 raw `user.message`를 남긴다.
3. `tool.execute.before/after`와 command hook이 tool, explore, terminal, todo, agent activity를 분류한다.
4. 필요하면 `question`, `thought`, `task-link`, `async-task` 같은 richer signal도 기록한다.
5. `session.idle` 또는 종료 이벤트에서 session/task lifecycle을 정리한다.

## plugin 파일이 가진 추가 역할

- OpenCode 설정 파일에서 MCP server 이름을 읽어 MCP tool 이름을 해석한다.
- `.opencode/.dev-log` 마커 파일이 있을 때만 `.opencode/monitor.log`에 개발 로그를 남긴다.
- background task linkage를 `pendingBackgroundLinks`와 session state map으로 관리한다.

## 이 경로의 장점

- assistant-side semantic signal을 다루기 좋다.
- hook과 event callback을 섞어 쓸 수 있어 Claude/Codex보다 자동화 범위가 넓다.
- task-start 기반이라 runtime session binding이 없는 경로도 안정적으로 처리할 수 있다.

## 주의할 점

- OpenCode의 typed hook surface와 문서화된 event table이 완전히 같은 개념은 아니다.
- background lineage는 before/after/finalize에 걸쳐 확정되므로 로직 추적이 어렵다.
- plugin 메모리(`sessionStates`, `pendingBackgroundLinks`)가 실제 DB 상태와 언제 동기화되는지 이해해야 한다.

## 관련 문서

- [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)
- [HTTP API Reference](./http-api-reference.md)
- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
