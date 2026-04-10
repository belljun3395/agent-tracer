# Runtime Adapters & Integration

Agent Tracer 는 특정 에이전트 하나에 묶이지 않지만,
현재 저장소에 구현된 자동 어댑터는 Claude Code plugin 하나다.
다른 런타임은 같은 HTTP/MCP surface 를 직접 호출하는 방식으로 붙일 수 있다.

## 현재 지원하는 통합 방식

| 방식 | 대표 런타임 | 특징 |
| --- | --- | --- |
| plugin | Claude Code | plugin 이 내부적으로 Claude event 를 등록해 runtime lifecycle 과 tool 사용을 자동 관찰 |
| manual HTTP/MCP | custom runtime | session/task/event contract 를 직접 호출 |

## 핵심 파일

- `packages/core/src/runtime-capabilities.defaults.ts`
- `packages/core/src/event-semantic.ts` — hook/web 간 명시적 semantic contract
- `docs/guide/runtime-capabilities.md`
- `docs/guide/api-integration-map.md`
- `.claude/plugin/hooks/*` — hook implementations
- `.claude/plugin/hooks/classification/*` — semantic inference engines
- `.claude/plugin/hooks/lib/*` — shared utilities (transport, caching, logging)
- `.claude/plugin/hooks/common.ts` — re-exports (re-organized as of 2026-04-10)
- `.claude/plugin/hooks/hooks.json`
- `.claude/plugin/bin/run-hook.sh`

## Hook Layer 구조 (as of 2026-04-10)

`.claude/plugin/hooks/` 는 5가지 책임을 명확히 분리했다:

```
.claude/plugin/hooks/
├── classification/        # semantic inference engines
│   ├── command-semantic.ts       # shell commands → subtype classification
│   ├── explore-semantic.ts       # file/web tools → exploration subtypes
│   └── file-semantic.ts          # file operations → file_ops subtypes
├── lib/                   # shared utilities
│   ├── transport.ts              # HTTP client (postJson, readStdinJson)
│   ├── session-cache.ts          # session state caching
│   ├── subagent-registry.ts      # background subagent tracking
│   └── hook-log.ts               # logging utilities
├── common.ts              # re-exports main hook dependencies
├── agent_activity.ts      # agent coordination event hook
├── tool_used.ts           # tool invocation hook + semantic metadata
├── user_prompt.ts         # user message hook
├── hooks.json             # hook registration manifest
└── ... (other event hooks)
```

**이점:**
- `classification/` 로직은 pure function으로 테스트 가능
- `lib/` 유틸리티는 새 런타임 어댑터에서 재사용 가능
- 변경 범위가 명확하고, 코드 응집도 높음

**마이그레이션 배경:**
기존 `common.ts`는 525줄에서 5가지 책임을 혼합했다.
새 런타임이 자체 semantic inference를 작성할 때, 관련 없는 transport/caching 코드를 모두 이해해야 했다.

## 공통 설계 원칙

### capability 로 차이를 먼저 선언한다

raw user prompt 를 볼 수 있는지, tool call 을 자동 관찰할 수 있는지,
session close 가 task complete 를 의미하는지는 런타임마다 다르다.
이 차이는 `runtime-capabilities` 에서 먼저 고정한다.

### 서버 API 는 가능한 공통 surface 를 유지한다

runtime 이 달라도 서버에는 가급적 같은 개념으로 들어오게 한다.
예를 들어 모두 `user.message`, `assistant.response`, `task.start` 같은 canonical event 를
만들도록 유도한다.

## 현재 코드 기준 포인트

### Claude 는 plugin 경로가 캐노니컬이다

현재 저장소의 Claude 통합은 `.claude/plugin/` 이 캐노니컬 경로이고,
`.claude/plugin/hooks/hooks.json` 이 plugin 내부에서 Claude Code event에 각 스크립트를 등록한다.

canonical `runtimeSource` 는 `claude-plugin` 이다.

### `setup:external` 은 현재 Claude 만 자동화한다

외부 설치 스크립트 `scripts/setup-external.mjs` 는 외부 프로젝트의
`.claude/settings.json` 만 조정하고 plugin 실행 경로를 출력한다.
다른 런타임용 bootstrap 파일은 만들지 않는다.

### 수동 런타임은 공용 API/MCP contract 를 따른다

자동 plugin 이 없는 런타임은 `@monitor/mcp` 도구를 쓰거나
HTTP endpoint 를 직접 호출하면 된다.
이 경우 capability 는 자동 관측이 아니라 호출자 책임으로 성립한다.

## 새 런타임을 추가할 때 체크리스트

1. raw prompt 를 기계적으로 캡처할 수 있는가
2. tool call 을 종류별로 관찰할 수 있는가
3. background/subagent 를 추적할 수 있는가
4. session close 가 waiting 인지 complete 인지 정의할 수 있는가
5. 어떤 HTTP endpoint 를 최소 구현으로 볼 것인가

## 관련 문서

- [Runtime Capabilities Registry](./runtime-capabilities-registry.md)
- [Claude Code Plugin Adapter](./claude-code-plugin-adapter.md)
- [setup:external Automation Script](./setup-external-automation-script.md)
