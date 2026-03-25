# Claude Code Hooks Adapter

Claude Code는 hook 스크립트를 통해 Agent Tracer로 이벤트를 보낸다.

## 핵심 파일

- `.claude/hooks/common.ts`
- `.claude/hooks/stop.ts`
- `.claude/settings.json`
- `docs/guide/claude-setup.md`

## 현재 주의점

- guide 문서와 실제 종료/완료 동작이 일부 어긋난다
- subagent registry 같은 runtime state 파일 관리도 정리가 필요하다

관련 문서:

- [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)
