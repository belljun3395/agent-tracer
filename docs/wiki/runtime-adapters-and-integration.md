# Runtime Adapters & Integration

Agent Tracer는 런타임마다 다른 관찰 경로를 지원한다.

## 지원 방식

- hooks: Claude Code
- plugins: OpenCode
- skills + MCP: Codex 계열

## 핵심 파일

- `docs/guide/api-integration-map.md`
- `docs/guide/runtime-capabilities.md`
- `packages/core/src/runtime-capabilities.ts`

## 설계 포인트

- runtime 차이는 capability와 lifecycle policy로 흡수한다
- 서버 API는 가능한 공통 surface를 유지한다

## 함께 볼 문서

- [Claude Code Hooks Adapter](./claude-code-hooks-adapter.md)
- [OpenCode Plugin Adapter](./opencode-plugin-adapter.md)
- [Codex Skill Adapter](./codex-skill-adapter.md)
- [setup:external Automation Script](./setup-external-automation-script.md)
