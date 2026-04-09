# Runtime Capabilities Registry

runtime capability registry 는 "각 런타임이 무엇을 관찰할 수 있고,
세션 종료 시 어떤 lifecycle 정책을 가져야 하는가"를 코드로 고정한 표다.
실제 source of truth 는 `packages/core/src/runtime-capabilities.defaults.ts` 와
`packages/core/src/runtime-capabilities.helpers.ts` 이다.

## 핵심 파일

- `packages/core/src/runtime-capabilities.defaults.ts`
- `packages/core/src/runtime-capabilities.types.ts`
- `packages/core/src/runtime-capabilities.helpers.ts`
- `docs/guide/runtime-capabilities.md`

## 현재 등록된 adapter

| Adapter | Raw prompt | Tool calls | Subagents | Native skill discovery | Event stream | Session close policy |
| --- | --- | --- | --- | --- | --- | --- |
| `claude-plugin` | Yes | Yes | Yes | `.claude/skills` | No | `never` |

참고:

- 서버 HTTP 스키마의 `runtimeSource` 는 확장성을 위해 문자열로 열려 있다.
- `claude-hook` 은 과거 데이터 호환을 위한 alias 이고, 문서와 신규 이벤트의 canonical 값은 `claude-plugin` 이다.

## capability 가 필요한 이유

- raw user prompt 를 기계적으로 캡처할 수 있는지
- tool / terminal / MCP activity 를 자동 관찰할 수 있는지
- subagent/background lineage 를 자동 추적할 수 있는지
- session close 시 task 를 닫지 않고 `waiting` 으로 둘지

이 차이를 registry 로 명시해 두면 server lifecycle policy, observability evidence,
guide 문서가 같은 기대를 공유할 수 있다.

## 운영 포인트

- capability table 은 "문서의 추천"이 아니라 "실제 코드가 보장하는 범위"를 적어야 한다.
- 신규 런타임을 추가할 때는 README 보다 먼저 registry 를 갱신해야 drift 가 줄어든다.
- 수동 HTTP/MCP 클라이언트는 registry 에 내장 adapter 로 등록되어 있지 않더라도 서버 API 를 그대로 사용할 수 있다.

## 관련 문서

- [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)
- [Claude Code Plugin Adapter](./claude-code-plugin-adapter.md)
