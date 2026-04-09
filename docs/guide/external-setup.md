# Agent Tracer - 외부 프로젝트 설치 가이드

이 문서는 Agent Tracer를 **다른 프로젝트에 붙일 때 가장 먼저 보는 문서**입니다.
현재 저장소 기준으로 자동화된 외부 설치 경로는 Claude Code plugin 흐름입니다.

## 0. 공식 최신 문서 원본

- 최신 문서: https://belljun3395.github.io/agent-tracer/guide/external-setup

배포 문서는 이 저장소의 `docs/` 원본에서 생성됩니다. 현재 문서의 설명은
`scripts/setup-external.mjs`와 `.claude/plugin/` 구현을 기준으로 맞춰져 있습니다.

## 1. 현재 지원 범위

| 런타임 | 이 저장소에 있는 자동화 | 추가로 해야 하는 일 | 다음 문서 |
|--------|--------------------------|---------------------|-----------|
| Claude Code | 예 | Claude MCP 서버 등록 | [claude-setup.md](./claude-setup.md) |
| 기타 런타임 | 아니오 | MCP 또는 HTTP 호출 절차 직접 구성 | [runtime-capabilities.md](./runtime-capabilities.md) |

중요한 점:

- `setup:external`은 현재 **Claude Code 설정만** 만집니다.
- 다른 런타임용 bootstrap 파일을 생성하지 않습니다.
- 외부 프로젝트에 Agent Tracer 코드를 vendoring 하지도 않습니다.

## 2. 공통 준비

Agent Tracer 저장소 루트에서:

```bash
npm install
npm run build
```

monitor server 실행:

```bash
npm run dev:server
# 또는
npm run start:server
```

정상 동작 확인:

```bash
curl -sf http://127.0.0.1:${MONITOR_PORT:-3847}/api/overview | python3 -m json.tool
```

기본 서버 URL은 `http://127.0.0.1:3847` 입니다.

## 3. `setup:external` 실행

현재 구현이 실제로 요구하는 필수 인자는 `--target` 하나입니다.

```bash
npm run setup:external -- --target /path/to/your-project
```

스크립트는 외부 프로젝트에 대해 다음을 수행합니다.

1. `target-project/.claude/settings.json`을 생성하거나 병합합니다.
2. 기존 `hooks` 키가 있으면 제거합니다.
3. `permissions.defaultMode = "acceptEdits"`와 `permissions.allow = ["WebSearch", "WebFetch"]` 기본값을 넣습니다.
4. 현재 저장소의 Claude plugin 절대 경로와 `claude --plugin-dir ...` 실행 명령을 출력합니다.

예상 출력의 핵심은 아래와 같습니다.

```bash
[claude] Plugin path: /absolute/path/to/agent-tracer/.claude/plugin
[claude] Run Claude Code with: claude --plugin-dir /absolute/path/to/agent-tracer/.claude/plugin
```

## 4. 스크립트가 하지 않는 일

현재 구현은 아래를 자동화하지 않습니다.

- Claude MCP 서버 등록
- plugin 소스 vendoring
- 다른 런타임용 설정 파일 생성

`--monitor-base-url`, `--source-repo`, `--source-ref`, `--source-root` 인자는 파서에 남아 있지만,
현재 스크립트는 Claude plugin 경로를 로컬 저장소에서 직접 사용하므로 vendoring 동작에는 쓰지 않습니다.

## 5. 런타임별 다음 단계

- Claude Code: [claude-setup.md](./claude-setup.md)
  - `setup:external` 이후에도 `claude mcp add monitor ...`는 직접 실행해야 합니다.
  - Claude는 plugin 경로를 붙여서 실행해야 합니다.
- 기타 런타임:
  - 이 저장소는 공용 HTTP API와 MCP server 를 제공합니다.
  - 직접 호출 절차를 구성하려면 [runtime-capabilities.md](./runtime-capabilities.md)와 [api-integration-map.md](./api-integration-map.md)를 참고하세요.

## 6. 자주 막히는 지점

- `packages/mcp` 구현이 바뀌었으면 `npm run build`를 다시 해야 합니다.
- GUI 앱에서 `node`를 못 찾으면 절대 경로의 Node 실행 파일을 사용해야 합니다.
- Claude Code를 GUI에서 띄우면 셸 환경 변수가 안 넘어갈 수 있습니다.
- `.claude/settings.json`을 바꾼 뒤에는 Claude Code를 다시 시작해야 반영됩니다.

## 7. 빠른 점검 순서

1. Agent Tracer 서버를 실행합니다.
2. `npm run setup:external -- --target /path/to/project`를 실행합니다.
3. `claude mcp add monitor ...`로 MCP를 등록합니다.
4. `claude --plugin-dir /absolute/path/to/agent-tracer/.claude/plugin`로 외부 프로젝트를 엽니다.
5. 간단한 read/edit/task를 하나 수행합니다.
6. 대시보드에 새로운 task와 event가 들어오는지 확인합니다.
