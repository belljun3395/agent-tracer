# setup:external Automation Script

`npm run setup:external`은 Agent Tracer를 다른 프로젝트에 붙일 때 필요한
설정 파일, shim, vendored runtime asset을 자동으로 생성하는 스크립트다.
이 저장소를 source repository로 유지하고, 외부 프로젝트에는 얇은 연결점만 심는 것이 목적이다.

## 핵심 파일

- `scripts/setup-external.mjs`
- `docs/guide/external-setup.md`
- `docs/guide/claude-setup.md`
- `docs/guide/opencode-setup.md`
- `docs/guide/codex-setup.md`

## 지원 모드

- `--mode claude`
- `--mode opencode`
- `--mode codex`
- `--mode both`

## 현재 스크립트가 하는 일

### Claude

- `.claude/settings.json`을 생성 또는 병합
- vendored hook 파일을 `.agent-tracer/.claude/hooks/*`에 배치
- hook command를 `npx --yes tsx` 경로로 구성

### OpenCode

- `opencode.json`에 `monitor` MCP entry를 추가
- `.opencode/plugins/monitor.ts` shim 생성
- `.opencode/tsconfig.json` 생성
- vendored plugin 파일을 `.agent-tracer/.opencode/plugins/monitor.ts`에 배치

### Codex

- `AGENTS.md`에 managed block을 추가 또는 갱신
- `.agents/skills/codex-monitor/SKILL.md` projection을 생성

## 최근 코드 기준 중요한 변화

### 기본 source ref가 더 안전해졌다

현재 기본 source ref는 아래 우선순위로 결정된다.

1. `AGENT_TRACER_SOURCE_REF`
2. 현재 git `HEAD`
3. fallback `main`

즉, 예전처럼 항상 원격 `main`만 기준으로 보지 않고,
가능하면 현재 체크아웃의 정확한 버전을 vendoring 하도록 바뀌었다.

### `--source-root`로 로컬 체크아웃을 직접 쓸 수 있다

원격 fetch 대신 로컬 파일을 vendor할 수 있어, 아직 push하지 않은 수정도 외부 프로젝트에 반영해 볼 수 있다.

## 주요 인자

- `--target`
- `--mode`
- `--monitor-base-url`
- `--source-repo`
- `--source-ref`
- `--source-root`

## 결과물의 공통 패턴

- 외부 프로젝트 안에는 `.agent-tracer/` vendor 디렉터리가 생긴다.
- 런타임별 설정 파일은 target 프로젝트 기준으로 최소한만 바뀐다.
- MCP server binary 자체를 복사하지는 않고, Agent Tracer 저장소의 빌드 산출물을 참조하게 한다.

## 관련 문서

- [Getting Started & Installation](./getting-started-and-installation.md)
- [Claude Code Hooks Adapter](./claude-code-hooks-adapter.md)
- [OpenCode Plugin Adapter](./opencode-plugin-adapter.md)
- [Codex Skill Adapter](./codex-skill-adapter.md)
