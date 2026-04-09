# setup:external Automation Script

`npm run setup:external` 은 Agent Tracer 를 다른 프로젝트에 붙일 때 필요한
설정 파일을 자동으로 정리하는 스크립트다.
현재 구현은 외부 프로젝트의 Claude 설정을 다듬고 plugin 실행 경로를 안내하는 데 집중한다.

## 핵심 파일

- `scripts/setup-external.mjs`
- `docs/guide/external-setup.md`
- `docs/guide/claude-setup.md`

## 현재 실제 지원 범위

- 필수 입력: `--target`
- 현재 자동화 대상: Claude Code
- 기타 런타임은 수동 HTTP/MCP 레퍼런스만 제공

## 현재 스크립트가 하는 일

- `.claude/settings.json` 을 생성 또는 병합
- 기존 `hooks` 블록이 있으면 제거
- 현재 저장소의 `.claude/plugin/` 절대 경로를 출력
- `claude --plugin-dir <path>` 실행 명령을 안내

## 최근 코드 기준 중요한 변화

### vendoring 을 더 이상 하지 않는다

예전 문서와 달리 현재 스크립트는 외부 프로젝트에 hook/plugin 소스를 복사하지 않는다.
실행 중인 로컬 저장소의 `.claude/plugin/` 을 그대로 가리키게 만드는 방식이다.

### source 관련 인자는 아직 남아 있지만 핵심 동작에는 쓰지 않는다

`--source-repo`, `--source-ref`, `--source-root` 파싱은 코드에 남아 있지만,
현재 Claude plugin 경로를 직접 참조하는 구현에서는 vendoring 소스를 고르는 데 사용되지 않는다.

## 관련 문서

- [Getting Started & Installation](./getting-started-and-installation.md)
- [Claude Code Plugin Adapter](./claude-code-plugin-adapter.md)
