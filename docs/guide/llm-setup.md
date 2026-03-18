# Agent Tracer - 런타임 설정 맵

외부 프로젝트에 Agent Tracer를 붙이려면 먼저
[external-setup.md](./external-setup.md) 부터 보세요.

런타임 capability 상세는 [runtime-capabilities.md](./runtime-capabilities.md)를 참고하세요.

## 추천 경로

| 런타임 | 외부 설치 자동화 | 기본 통합 방식 | 가이드 |
|--------|------------------|----------------|--------|
| Claude Code | 예 | `setup:external` + Claude MCP 등록 + hooks | [claude-setup.md](./claude-setup.md) |
| OpenCode | 예 | `setup:external` + `opencode.json` + plugin shim | [opencode-setup.md](./opencode-setup.md) |
| Codex | 예 | `setup:external --mode codex` + Codex MCP 등록 + 새 스레드 | [codex-setup.md](./codex-setup.md) |
| 기타 MCP 환경 | 부분적 | MCP + `monitor` 스킬 수동 구성 | [skills/monitor/SKILL.md](../../skills/monitor/SKILL.md) |

## 공통 구조

Agent Tracer 통합은 항상 두 조각으로 나뉩니다.

1. **monitor server**
   - 대시보드와 저장소 역할을 합니다.
   - 기본 주소는 `http://127.0.0.1:3847` 입니다.
2. **runtime adapter**
   - Claude hooks, OpenCode plugin, Codex skill/MCP 같은 런타임별 연결 레이어입니다.

## 서버 경계 요약

현재 문서에서 외부 사용자가 알아야 할 서버 경계는 아래 정도면 충분합니다.

- Claude hooks 같은 상태 비저장 어댑터는 `runtime-session-*` helper 엔드포인트를 사용합니다.
- OpenCode plugin, Codex MCP/skill 같은 경로는 `task-start`, 시맨틱 이벤트, `session-end` 계열 엔드포인트를 사용합니다.
- 모델별 / 도구별 상세 capability 차이는 runtime capability registry와 각 런타임 가이드가 담당합니다.

즉, 외부 사용자는 서버 내부 엔드포인트 차이를 직접 설계할 필요가 없고,
자신이 쓰는 런타임 가이드만 따르면 됩니다.
