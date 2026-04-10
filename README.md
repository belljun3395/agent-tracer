# Agent Tracer

Claude Code 중심의 로컬 monitor server + dashboard 입니다.
현재 저장소에는 Claude Code plugin 기반 수집 경로가 구현되어 있고,
서버/MCP 계층은 수동 HTTP/MCP 클라이언트도 받을 수 있도록 열려 있습니다.

## 외부 프로젝트에 붙이기

이 저장소의 1차 목표는 Agent Tracer를 **다른 프로젝트에 연결해서 쓰는 것**입니다.

권장 방식:

- Agent Tracer 코드를 외부 프로젝트에 복사하지 않습니다.
- 이 저장소를 monitor server / MCP / hook / plugin source로 유지합니다.
- 외부 프로젝트에는 설정 파일이나 shim만 생성합니다.

시작 순서:

```bash
npm install
npm run build
npm run dev
```

그 다음 외부 설치 흐름을 순서대로 따라가세요:

- 로컬 설치: [docs/guide/install-and-run.md](docs/guide/install-and-run.md)
- 외부 프로젝트 연결: [docs/guide/external-setup.md](docs/guide/external-setup.md)
- Claude Code 연결: [docs/guide/claude-setup.md](docs/guide/claude-setup.md)
- 배포된 최신 가이드: https://belljun3395.github.io/agent-tracer/guide/

> `npm run setup:external`은 현재 외부 프로젝트의 Claude Code 설정만 자동화합니다.
> 이 스크립트는 `.claude/settings.json`을 정리하고 plugin 실행 경로를 안내합니다.
> MCP 등록은 여전히 수동입니다.

## 이 저장소 자체를 실행해 보기

```bash
npm install
npm run build
npm run dev
```

- 대시보드: http://127.0.0.1:5173
- 서버: http://127.0.0.1:3847

## 가이드 맵

| 목적 | 문서 |
|------|------|
| 로컬 설치 및 실행 | [docs/guide/install-and-run.md](docs/guide/install-and-run.md) |
| 외부 프로젝트 설치 시작점 | [docs/guide/external-setup.md](docs/guide/external-setup.md) |
| Claude Code 연결 | [docs/guide/claude-setup.md](docs/guide/claude-setup.md) |
| 런타임 capability 상세 | [docs/guide/runtime-capabilities.md](docs/guide/runtime-capabilities.md) |
| 코드베이스 위키 / 아키텍처 문서 | [docs/wiki/index.md](docs/wiki/index.md) |

## 문서 사이트

`docs/` 아래 Markdown을 페이지형 문서 사이트로 보려면 VitePress 엔트리를 사용할 수 있습니다.

```bash
npm run docs:dev
```

- 기본 주소: `http://127.0.0.1:5174`
- 홈: `docs/index.md`
- 가이드 섹션: `docs/guide/*`
- 위키 섹션: `docs/wiki/*`

### GitHub Pages 배포

- 워크플로우: `.github/workflows/deploy-docs.yml`
- 최초 1회 GitHub 저장소의 `Settings > Pages > Build and deployment > Source`에서 `GitHub Actions`를 선택해야 합니다.
- 이후 `main` 브랜치에 문서 관련 변경이 푸시되면 GitHub Pages로 자동 배포됩니다.
- 현재 저장소 기준 배포 주소는 `https://belljun3395.github.io/agent-tracer/` 입니다.

### NPM 릴리스

- 개별 패키지 배포:
  - `npm run publish:core`
  - `npm run publish:server`
  - `npm run publish:mcp`
  - `npm run publish:web`
- 한 번에 배포: `npm run publish:all`
- GitHub Actions 수동 실행:
  - `.github/workflows/publish-packages.yml`에서 `Run workflow` 선택
  - `dryRun`을 `true`로 두면 실제 업로드 없이 `--dry-run`으로 동작
- 태그 릴리즈 배포:
  - `v*` 형식의 태그(`v0.1.0` 등)를 push하면 자동으로 4개 패키지 publish job이 동작합니다.
- `NPM_TOKEN` secret이 필수입니다 (`repository > Settings > Secrets and variables > Actions`).

## Thought-Flow Observability

대시보드는 이제 단순 이벤트 목록 외에 다음 진단 정보를 함께 보여준다.

- 상단 diagnostics 카드: prompt capture 비율, trace-linked task 비율, stale running task, 평균 작업 시간
- Inspector `Flow` 탭: phase breakdown, active duration, session 상태, top files/tags, work item/goal/plan/handoff focus
- Inspector `Health` 탭: trace links, action-registry gaps, question/todo closure, coordination/background activity, runtime lineage

세부 계약과 API는 `docs/guide/task-observability.md` 참고.

## 패키지

| 패키지 | 역할 |
|--------|------|
| `@monitor/core` | 타입, 규칙, 이벤트 분류 |
| `@monitor/server` | NestJS 서버 런타임, SQLite + WebSocket API |
| `@monitor/mcp` | MCP stdio 서버 |
| `@monitor/web` | React 19 대시보드 |
