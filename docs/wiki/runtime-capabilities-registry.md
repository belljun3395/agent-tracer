# Runtime Capabilities Registry

런타임별 관찰 가능 범위와 세션 종료 정책을 한곳에 모은 registry다.

## 핵심 파일

- `packages/core/src/runtime-capabilities.ts`
- `docs/guide/runtime-capabilities.md`

## 현재 등록된 adapter

- `claude-hook`
- `codex-skill`
- `opencode-plugin`
- `opencode-sse`

## 관리 포인트

- raw user prompt 캡처 가능 여부
- tool call 관찰 여부
- subagent/background 지원 여부
- session close 시 task 완료 정책
- native skill path
