# Agent Tracer - 외부 프로젝트 설치 가이드

이 문서는 Agent Tracer를 **다른 프로젝트에 붙일 때 가장 먼저 보는 문서**입니다.

권장 방식은 `setup:external`이 GitHub 공개 저장소(`belljun3395/agent-tracer`)의
`main` 브랜치 소스 파일을 외부 프로젝트에 vendor 디렉터리(`.agent-tracer/`)로
가져오고, 설정 파일은 그 vendor 경로를 참조하도록 만드는 것입니다.

## 1. 현재 지원 범위

| 런타임 | `setup:external` 자동화 | 추가로 해야 하는 일 | 다음 문서 |
|--------|--------------------------|---------------------|-----------|
| Claude Code | 예 (`--mode claude`) | Claude MCP 서버 등록 | [claude-setup.md](./claude-setup.md) |
| OpenCode | 예 (`--mode opencode`) | 보통 없음. 필요 시 수동 MCP 확인 | [opencode-setup.md](./opencode-setup.md) |
| Claude + OpenCode | 예 (`--mode both`) | Claude MCP 서버 등록 | [claude-setup.md](./claude-setup.md), [opencode-setup.md](./opencode-setup.md) |
| Codex | 예 (`--mode codex`) | Codex MCP 서버 등록 + 새 스레드 시작 | [codex-setup.md](./codex-setup.md) |

> `setup:external`은 현재 **Claude Code, OpenCode, Codex**의
> repo-local 통합 파일 생성을 자동화합니다.
> 다만 Codex/Claude의 전역 MCP 등록은 각 CLI에서 직접 수행해야 합니다.

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

Codex만 연결:

```bash
npm run setup:external -- --target /path/to/your-project --mode codex
```

Claude, OpenCode, Codex를 모두 연결하려면:

```bash
npm run setup:external -- --target /path/to/your-project --mode both
npm run setup:external -- --target /path/to/your-project --mode codex
```

다른 monitor server 주소를 쓰는 경우:

```bash
npm run setup:external -- \
  --target /path/to/your-project \
  --mode both \
  --monitor-base-url http://127.0.0.1:3847
```

## 4. 스크립트가 실제로 하는 일

`setup:external`은 기본적으로 GitHub `main`에서 소스 파일을 받아
외부 프로젝트의 `.agent-tracer/` 아래에 vendor 합니다.

- `--mode claude`
  - 외부 프로젝트의 `.claude/settings.json`을 생성하거나 병합합니다.
  - `.agent-tracer/.claude/hooks/*.ts`를 받아 저장합니다.
  - hook command는 `$CLAUDE_PROJECT_DIR/.agent-tracer/.claude/hooks/*.ts`를 참조합니다.
  - hook 실행은 `npx --yes tsx`를 사용합니다.
- `--mode opencode`
  - 외부 프로젝트의 `opencode.json`에 `monitor` MCP 설정을 추가합니다.
  - 외부 프로젝트의 `.opencode/plugins/monitor.ts` shim을 생성합니다.
  - 외부 프로젝트의 `.opencode/tsconfig.json`을 생성합니다.
  - `.agent-tracer/.opencode/plugins/monitor.ts`를 받아 저장하고 shim에서 re-export 합니다.
- `--mode both`
  - 위 두 작업을 모두 수행합니다.
- `--mode codex`
  - 외부 프로젝트의 `AGENTS.md`에 Agent Tracer 관리 블록을 생성하거나 갱신합니다.
  - 외부 프로젝트의 `.agents/skills/codex-monitor/SKILL.md`를 생성합니다.
  - skill source는 실행 중인 로컬 저장소의 `skills/codex-monitor/SKILL.md`입니다.

원하면 `--source-repo`, `--source-ref`로 원격 소스를 바꿀 수 있고,
테스트/오프라인 환경에서는 `--source-root /local/agent-tracer`로 로컬 소스를 쓸 수 있습니다.

## 5. 런타임별 다음 단계

- Claude Code: [claude-setup.md](./claude-setup.md)
  - `setup:external` 이후에도 `claude mcp add monitor ...`는 직접 실행해야 합니다.
- OpenCode: [opencode-setup.md](./opencode-setup.md)
  - `setup:external`이 `opencode.json`, plugin shim, `.opencode/tsconfig.json`을 써주므로 보통 바로 사용할 수 있습니다.
- Codex: [codex-setup.md](./codex-setup.md)
  - `setup:external --mode codex` 이후에도 `codex mcp add monitor ...`는 직접 실행해야 합니다.
  - 새 `AGENTS.md` / `.agents/skills`를 읽도록 Codex 스레드를 다시 시작해야 합니다.

## 6. 자주 막히는 지점

- `npx --yes tsx`를 사용하므로 최초 실행 시 네트워크 또는 npm 캐시가 필요할 수 있습니다.
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
