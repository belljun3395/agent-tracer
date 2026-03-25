# Getting Started & Installation

이 문서는 "Agent Tracer를 지금 어떻게 띄우고, 어디서부터 코드를 읽기 시작할지"를
한곳에 모은 시작점이다. 실제 런타임별 설치 절차는 `docs/guide`가 더 자세하고,
이 페이지는 저장소 관점에서 필요한 최소 경로를 정리한다.

## 로컬 개발 모드

가장 흔한 개발 루프는 서버와 웹을 동시에 켜는 것이다.

```bash
npm install
npm run build
npm run dev
```

- 서버: `http://127.0.0.1:3847`
- 웹: `http://127.0.0.1:5173`
- `npm run dev`는 `dev:server`와 `dev:web`를 동시에 실행한다.

서버만 따로 보고 싶다면:

```bash
npm run dev:server
```

MCP 서버까지 별도로 확인하려면 먼저 빌드한 뒤 아래를 사용한다.

```bash
npm run start:mcp
```

## 외부 프로젝트에 붙이는 경로

이 저장소의 1차 목표는 Agent Tracer를 다른 프로젝트에 연결해서 쓰는 것이다.
권장 방식은 코드를 복사하지 않고, 이 저장소를 monitor server와 source repository로
유지한 채 외부 프로젝트에는 최소 설정 파일만 생성하는 방식이다.

핵심 진입점:

- [External Setup Hub](../guide/external-setup.md)
- [LLM Setup Map](../guide/llm-setup.md)
- [Claude Setup](../guide/claude-setup.md)
- [OpenCode Setup](../guide/opencode-setup.md)
- [Codex Setup](../guide/codex-setup.md)

자동 설치 스크립트:

```bash
npm run setup:external -- --target /path/to/project --mode claude
npm run setup:external -- --target /path/to/project --mode opencode
npm run setup:external -- --target /path/to/project --mode codex
```

## 로컬에서 확인하면 좋은 엔드포인트

- `GET /health` - 서버 생존 확인
- `GET /api/overview` - 대시보드 요약 상태 확인
- `GET /api/tasks` - 현재 태스크 목록 확인
- `GET /api/workflows` - 저장된 평가 목록 확인

간단한 스모크 체크:

```bash
curl -sf http://127.0.0.1:3847/api/overview
```

## 코드 읽기 시작점

설치보다 구조가 궁금할 때는 아래 순서가 가장 빠르다.

1. `README.md`
2. `packages/server/src/bootstrap/create-monitor-runtime.ts`
3. `packages/core/src/domain.ts`
4. `packages/mcp/src/index.ts`
5. `packages/web/src/App.tsx`

## 설치와 위키의 역할 분리

- 설정 절차와 런타임별 운영 규칙은 `docs/guide/*`
- 코드 구조와 책임 분해는 `docs/wiki/*`
- 심화 구조 평가는 `backend-server.md`, `frontend-dashboard.md`, `runtime-integrations.md`

즉, 무언가를 "동작하게 만드는 법"은 guide를 먼저 보고, "왜 이렇게 구성되어 있는가"는
wiki를 읽는 것이 맞다.

## 관련 문서

- [setup:external Automation Script](./setup-external-automation-script.md)
- [Architecture & Package Map](./architecture-and-package-map.md)
- [Testing & Development](./testing-and-development.md)
- [Maintainability Review (2026-03-25)](./maintainability-review-2026-03-25.md)
