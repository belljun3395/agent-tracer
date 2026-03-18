# Agent Tracer - 외부 프로젝트 설치 가이드

이 문서는 Agent Tracer를 **다른 프로젝트에 붙일 때 가장 먼저 보는 문서**입니다.

권장 방식은 Agent Tracer 코드를 외부 프로젝트에 복사하는 것이 아니라,
이 저장소를 monitor server / MCP / hook / plugin source-of-truth로 두고
외부 프로젝트에는 설정 파일이나 shim만 생성하는 것입니다.

## 1. 현재 지원 범위

| 런타임 | `setup:external` 자동화 | 추가로 해야 하는 일 | 다음 문서 |
|--------|--------------------------|---------------------|-----------|
| Claude Code | 예 (`--mode claude`) | Claude MCP 서버 등록 | [claude-setup.md](./claude-setup.md) |
| OpenCode | 예 (`--mode opencode`) | 보통 없음. 필요 시 수동 MCP 확인 | [opencode-setup.md](./opencode-setup.md) |
| Claude + OpenCode | 예 (`--mode both`) | Claude MCP 서버 등록 | [claude-setup.md](./claude-setup.md), [opencode-setup.md](./opencode-setup.md) |
| Codex | 아니오 | 수동 / repo-local 방식만 문서화됨 | [codex-setup.md](./codex-setup.md) |

> `setup:external`은 현재 **Claude Code와 OpenCode만** 자동화합니다.
> Codex는 별도 설치 스크립트를 아직 제공하지 않습니다.

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

Claude Code만 연결:

```bash
npm run setup:external -- --target /path/to/your-project --mode claude
```

OpenCode만 연결:

```bash
npm run setup:external -- --target /path/to/your-project --mode opencode
```

둘 다 연결:

```bash
npm run setup:external -- --target /path/to/your-project --mode both
```

다른 monitor server 주소를 쓰는 경우:

```bash
npm run setup:external -- \
  --target /path/to/your-project \
  --mode both \
  --monitor-base-url http://127.0.0.1:3847
```

## 4. 스크립트가 실제로 하는 일

`setup:external`은 내부 구현 파일을 외부 프로젝트에 복사하지 않습니다.

- `--mode claude`
  - 외부 프로젝트의 `.claude/settings.json`을 생성하거나 병합합니다.
  - hook command는 이 저장소의 `.claude/hooks/*.ts`를 **절대 경로**로 참조합니다.
  - hook 실행은 이 저장소의 `node_modules/tsx/dist/cli.mjs`를 사용합니다.
- `--mode opencode`
  - 외부 프로젝트의 `opencode.json`에 `monitor` MCP 설정을 추가합니다.
  - 외부 프로젝트의 `.opencode/plugins/monitor.ts` shim을 생성합니다.
  - shim은 이 저장소의 `.opencode/plugins/monitor.ts`를 re-export 합니다.
- `--mode both`
  - 위 두 작업을 모두 수행합니다.

즉, 외부 프로젝트에 남는 것은 설정 파일과 shim뿐이고,
실제 구현은 Agent Tracer 저장소가 계속 소유합니다.

## 5. 런타임별 다음 단계

- Claude Code: [claude-setup.md](./claude-setup.md)
  - `setup:external` 이후에도 `claude mcp add monitor ...`는 직접 실행해야 합니다.
- OpenCode: [opencode-setup.md](./opencode-setup.md)
  - `setup:external`이 `opencode.json`과 plugin shim을 써주므로 보통 바로 사용할 수 있습니다.
- Codex: [codex-setup.md](./codex-setup.md)
  - 현재는 수동 / repo-local 방식만 안내합니다.

## 6. 자주 막히는 지점

- Agent Tracer 저장소를 옮기면 외부 프로젝트의 절대 경로 참조가 깨집니다.
- `packages/mcp` 구현이 바뀌었으면 다시 `npm run build`를 해야 합니다.
- GUI 앱에서 `node`를 못 찾으면 절대 경로의 Node 실행 파일을 사용해야 합니다.
- 설정 파일을 바꾼 뒤에는 CLI 앱 또는 스레드를 다시 시작해야 반영됩니다.

## 7. 빠른 점검 순서

1. Agent Tracer 서버를 실행한다.
2. `setup:external`을 실행한다.
3. 런타임별 후속 설정을 마친다.
4. 외부 프로젝트를 해당 런타임으로 연다.
5. 간단한 read/edit/task를 하나 수행한다.
6. 대시보드에 새로운 task와 event가 들어오는지 확인한다.
