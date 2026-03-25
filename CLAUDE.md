# Agent Tracer — Claude Code 가이드

## 프로젝트 개요

Claude Code, OpenCode, Codex 등 AI CLI 에이전트의 활동을 실시간으로 추적하는
로컬 모니터 서버 + 웹 대시보드 모노레포.

## 패키지 구조

| 패키지 | 경로 | 역할 |
|--------|------|------|
| `@monitor/core` | `packages/core/` | 타입, 이벤트 분류 규칙, 도메인 모델 |
| `@monitor/server` | `packages/server/` | Express + SQLite + WebSocket API |
| `@monitor/mcp` | `packages/mcp/` | MCP stdio 서버 (21개 도구) |
| `@monitor/web` | `packages/web/` | React 19 대시보드 |

## 주요 명령어

```bash
npm install           # 의존성 설치 (모노레포 전체)
npm run build         # 모든 패키지 빌드
npm run dev           # server + web 동시 개발 서버 (localhost:3847, localhost:5173)
npm run dev:server    # 서버만 개발 모드 (tsx watch)
npm run dev:web       # 웹만 개발 모드 (vite)
npm run test          # 전체 테스트 (vitest)
npm run lint          # ESLint 전체
npm run seed          # SQLite 데모 데이터 삽입
npm run setup:external # 외부 프로젝트 연동 설정 자동 생성
```

## 아키텍처 패턴

- **Clean Architecture**: core(도메인) → server(애플리케이션/인프라) → web(프레젠테이션)
- **Ports & Adapters**: `application/*-repository.ts` 인터페이스 ← `infrastructure/sqlite/*` 구현
- **DI Root**: `packages/server/src/bootstrap/create-monitor-runtime.ts`
- **이벤트 분류**: `packages/core/src/classifier.ts` (키워드 + 액션 프리픽스 매칭)
- **타임라인 레인**: user, exploration, planning, implementation, questions, todos, background, coordination

## Claude Code 훅 구성 (`.claude/`)

이 저장소 자체가 Claude Code 훅으로 Agent Tracer에 연결되어 있습니다.

- `settings.json`: 훅 등록 (SessionStart, UserPromptSubmit, Pre/PostToolUse 등)
- `hooks/common.ts`: 공통 유틸 (API 호출, 로깅, subagent 레지스트리)
- `hooks/session_start.ts` / `hooks/session_end.ts`: 세션 수명 주기
- `hooks/ensure_task.ts`: PreToolUse 시 task/session 자동 생성
- `hooks/user_prompt.ts`: 사용자 프롬프트 캡처
- `hooks/tool_used.ts`, `hooks/explore.ts`, `hooks/terminal.ts`: 도구 사용 이벤트
- `hooks/subagent_lifecycle.ts`: 서브에이전트 추적
- `hooks/todo.ts`: TodoWrite/TaskCreate 이벤트 추적

**모니터 서버 포트**: `MONITOR_PORT` 환경변수 또는 기본값 `3847`

훅 디버그 로그: `.claude/hooks.log` (NODE_ENV=development 시 활성화)

## 개발 시 주의사항

### 타입 안전성
- TypeScript strict 모드 적용
- 인터페이스 변경 시 `packages/core/src/domain.ts`가 단일 진실 소스
- `USER_MESSAGE_CONTRACT_VERSION` 변경 시 훅과 MCP 양쪽 모두 업데이트 필요

### 빌드 순서
패키지 간 의존성: `core` → `server` → `mcp`
`npm run build`는 워크스페이스 순서를 자동으로 처리함.

### SQLite
- DB 파일: `.monitor/monitor.sqlite` (gitignore됨)
- 스키마 마이그레이션: `packages/server/src/infrastructure/sqlite/sqlite-schema.ts` (서버 시작 시 자동 적용)

### 훅 수정 시
`.claude/hooks/*.ts` 파일은 `tsx`로 직접 실행됨 (트랜스파일 없이).
`common.ts`의 API 호출 timeout은 1초 — 훅이 느리면 Claude 응답이 지연됨.

## 외부 프로젝트 연동

이 저장소를 다른 프로젝트에 붙이는 것이 주요 사용 사례:

```bash
npm run setup:external  # Claude/OpenCode/Codex 연동 파일 자동 생성
```

상세 가이드: `docs/guide/external-setup.md`

## 스킬

AGENTS.md 참조. Claude Code는 훅 자동 동작이므로 별도 스킬 불필요.
