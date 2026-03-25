# OpenCode Plugin Adapter

OpenCode는 plugin 내부 hook/event stream으로 Agent Tracer와 통합된다.

## 핵심 파일

- `.opencode/plugins/monitor.ts`
- `docs/guide/opencode-setup.md`
- `docs/guide/opencode-plugin-spec.md`

## 특징

- typed hook와 event stream을 함께 사용한다
- question/thought 같은 richer signal을 다루기 좋다

## 현재 주의점

- 실제 finalize 시점과 guide 설명 사이에 drift가 있다

관련 문서:

- [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)
