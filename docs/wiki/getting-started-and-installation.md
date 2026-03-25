# Getting Started & Installation

로컬에서 Agent Tracer를 실행하거나 외부 프로젝트에 연결할 때의 시작점이다.

## 로컬 실행

```bash
npm install
npm run build
npm run dev
```

- 서버: `http://127.0.0.1:3847`
- 웹: `http://127.0.0.1:5173`

## 외부 프로젝트 연결

- [docs/guide/external-setup.md](../guide/external-setup.md)
- [docs/guide/llm-setup.md](../guide/llm-setup.md)
- [docs/guide/claude-setup.md](../guide/claude-setup.md)
- [docs/guide/opencode-setup.md](../guide/opencode-setup.md)
- [docs/guide/codex-setup.md](../guide/codex-setup.md)

## 자동화 스크립트

- [setup:external Automation Script](./setup-external-automation-script.md)

## 주의점

- 현재 외부 설치는 버전 고정과 runtime state 파일 관리 측면에서 개선 여지가 있다.
- 자세한 운영 리스크는 [Maintainability Review (2026-03-25)](./maintainability-review-2026-03-25.md) 참고.
