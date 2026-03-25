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

## 워크플로우 라이브러리 — 작업 시작 전 규칙

새 작업을 시작하기 전에 반드시 아래 절차를 따를 것:

1. `mcp__agent-tracer__monitor_find_similar_workflows` 도구로 유사한 과거 워크플로우를 검색한다.
   - 검색어는 `java`, `typescript refactor` 처럼 **짧은 핵심 키워드**를 사용할 것. 검색 방식이 SQLite LIKE 패턴 매칭(`%{query}%`)이므로, 긴 문장을 넣으면 DB에 그 문자열 전체가 없어서 매칭에 실패한다.
   - **`tags` 파라미터는 사용하지 않는다.** tags 필터는 저장된 워크플로우의 태그와 정확히 일치해야 하므로, 추측으로 넣으면 실제 존재하는 워크플로우를 걸러내 버린다. `description`만으로 검색한다.
2. 결과가 1개 이상이면 각 워크플로우의 `useCase`, `rating`, `outcomeNote`, `tags`를 요약해 사용자에게 보여준다.
3. "이 워크플로우를 참고할까요?" 라고 물어본 뒤 사용자 답변에 따라 접근 방식을 결정한다.
4. 결과가 없으면 검색 단계를 건너뛰고 바로 작업을 시작한다.

> 모니터 서버가 응답하지 않으면 검색을 건너뛰고 작업을 계속한다.

## 워크플로우 라이브러리 — 작업 완료 후 평가 규칙

작업이 마무리된 것 같으면 반드시 아래 절차를 따를 것:

1. `mcp__agent-tracer__monitor_question`으로 사용자에게 평가 의사를 먼저 확인한다.
   - 예: "이 작업을 워크플로우 라이브러리에 저장할까요?"
2. 사용자가 원하면 아래 정보를 물어본다 (한 번에 물어봐도 됨):
   - `rating`: `good` (잘 됐다) / `skip` (제외)
   - `useCase`: 어떤 종류의 작업이었는지 (예: `"java 최신 조사"`)
   - `workflowTags`: 태그 목록 (예: `["java", "research"]`)
   - `outcomeNote`: 어떤 접근이 잘 됐는지 — 다음에 참고할 힌트
3. 현재 taskId는 `GET http://localhost:3847/api/tasks?limit=1` 로 가장 최근 태스크를 조회해 얻는다.
4. `mcp__agent-tracer__monitor_evaluate_task`를 호출해 저장한다.

> 모니터 서버가 응답하지 않으면 이 단계를 건너뛴다.

## 스킬

AGENTS.md 참조. Claude Code는 훅 자동 동작이므로 별도 스킬 불필요.
