# Claude Code Plugin Adapter

Claude Code 통합의 캐노니컬 경로는 `.claude/plugin/` 이다.
사용자 입장에서는 plugin 기반 통합이고, 내부 구현은 Claude Code가 제공하는 hook event를
plugin 안에서 등록해 runtime lifecycle과 tool 사용을 자동 추적하는 방식이다.

## 핵심 파일

- `.claude/plugin/hooks/common.ts`
- `.claude/plugin/hooks/session_start.ts`
- `.claude/plugin/hooks/user_prompt.ts`
- `.claude/plugin/hooks/ensure_task.ts`
- `.claude/plugin/hooks/terminal.ts`
- `.claude/plugin/hooks/tool_used.ts`
- `.claude/plugin/hooks/explore.ts`
- `.claude/plugin/hooks/agent_activity.ts`
- `.claude/plugin/hooks/todo.ts`
- `.claude/plugin/hooks/compact.ts`
- `.claude/plugin/hooks/subagent_lifecycle.ts`
- `.claude/plugin/hooks/session_end.ts`
- `.claude/plugin/hooks/stop.ts`
- `.claude/plugin/hooks/hooks.json`
- `.claude/plugin/bin/run-hook.sh`
- `.claude/settings.json`
- `docs/guide/claude-setup.md`

## 기본 흐름

1. `.claude/plugin/hooks/hooks.json`이 plugin 내부에서 Claude event와 TypeScript 스크립트를 연결한다.
2. `run-hook.sh`가 `${CLAUDE_PLUGIN_ROOT}/hooks/<name>.ts`를 `tsx`로 실행한다.
3. `SessionStart`, `UserPromptSubmit`, `PreToolUse`에서 runtime session을 ensure한다.
4. `user_prompt.ts`가 canonical `user.message`를 남긴다.
5. plugin 내부 스크립트가 bash, edit, explore, agent activity, todo, compact를 기록한다.
6. `subagent_lifecycle.ts`가 background async lifecycle을 기록한다.
7. `stop.ts`가 assistant response를 남긴다.
8. `session_end.ts`는 현재 runtime session만 닫는다.

## 최근 코드 기준 중요한 변화

### `stop.ts`는 assistant response만 기록한다

현재 `stop.ts`는 `payload.last_assistant_message`를 읽어 `/api/assistant-response`를 남긴다.
runtime session 종료는 `session_end.ts`가 맡고, primary task는 자동 완료하지 않는다.

### subagent runtime state 파일이 있다

plugin 실행 중 transient subagent registry 정보가 `.claude/.subagent-registry.json`에 저장된다.
이 파일은 제품 데이터가 아니라 plugin coordination용 상태다.

### 개발 로그는 `NODE_ENV=development`일 때 활성화된다

plugin runner `run-hook.sh`는 `NODE_ENV`가 비어 있으면 기본값으로
`development`를 설정해 plugin 스크립트를 실행한다.
따라서 `.claude/hooks.log` 같은 개발 로그 경로를 활성화하기 쉽다.

### `explore.ts`가 웹 조회 URL을 메타데이터에 기록한다

`explore.ts`는 plugin 내부 `PostToolUse` 처리에서 `WebSearch` / `WebFetch` 도구 호출을 감지하면,
`/api/explore` 요청의 `metadata.webUrls` 필드에 쿼리 또는 URL을 저장한다.

```typescript
const isWebTool = toolName === "WebSearch" || toolName === "WebFetch";
const webQuery = isWebTool
  ? (toTrimmedString(toolInput.query) || toTrimmedString(toolInput.url)).slice(0, MAX_PATH_LENGTH)
  : "";
// postJson body의 metadata:
...(isWebTool && webQuery ? { webUrls: [webQuery] } : {})
```

이 데이터는 `insights.ts`의 `collectWebLookups()` 함수가 수집해 대시보드
Exploration 탭의 **Web Lookups** 섹션에 표시된다.
`metadata.webUrls`는 Claude Code event payload 공식 스펙에 없는 Agent Tracer 자체 확장이며,
DB 스키마 변경 없이 `metadata` 자유 필드로 저장된다.

## 이 경로의 장점

- raw prompt를 자동 캡처할 수 있다.
- tool use와 subagent lifecycle을 잘 잡아낸다.
- compact 이벤트를 구분해 planning lane에 기록할 수 있다.

## 주의할 점

- session lifecycle과 task lifecycle을 혼동하면 중복 complete가 생길 수 있다.
- clear event를 실제 task 종료로 해석하지 않도록 `session_end.ts`와 `stop.ts`의 역할 구분이 중요하다.
- Claude event payload 차이는 `docs/guide/hook-payload-spec.md`를 함께 봐야 한다.

## 관련 문서

- [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)
- [HTTP API Reference](./http-api-reference.md)
- [Testing & Development](./testing-and-development.md)
