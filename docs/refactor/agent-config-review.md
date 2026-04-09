# Agent Tracer 에이전트 설정 검토 및 세션 Resume 문제 분석

> 작성일: 2026-04-09
> 범위: `.claude/`, `.opencode/`, `skills/`, `.agents/`, `AGENTS.md` 설정 파일 전체 + 세션 resume 동작

## Context

Agent Tracer는 Claude Code, OpenCode, Codex 등 AI CLI 에이전트의 활동을 추적하는 모니터링 시스템이다.
각 에이전트별로 설정 파일(`.claude/`, `.opencode/`, `skills/`, `.agents/`)이 존재하며,
이들이 `packages/`의 모니터 서버 API와 MCP 도구를 올바르게 사용하는지 검토한다.
또한 최근 CLI bridge 인프라가 제거(`e1f1b02`)되면서 세션 resume 기능이 깨진 상태를 분석한다.

---

## 1. 검토 결과: 각 에이전트 설정의 논리적 문제

### 1-A. Claude Code (`.claude/`)

**구조: 양호** — Hook 기반으로 자동 이벤트 캡처. 11개 hook이 `settings.json`에 등록됨.

#### 문제 1: `stop.ts`에서 `completeTask: true`로 매번 태스크를 완료시킴

- `.claude/hooks/stop.ts:56-62` — Stop hook이 `completeTask: true`로 `runtime-session-end`를 호출
- `.claude/hooks/session_end.ts:32-37` — SessionEnd hook은 `completeTask` 없이 호출
- **문제**: Stop은 매 assistant turn 종료마다 발생한다.
  한 세션에서 여러 턴이 있을 때, 첫 턴 완료 시 task가 `completed`로 전환됨.
  다음 턴의 `session_start.ts`가 `ensureRuntimeSession`을 호출하면 task를 다시 `running`으로 바꾸지만,
  **task가 completed→running으로 불필요하게 왕복**하게 됨.
- **영향**: 웹 대시보드에서 task 상태가 깜빡거리고, `task.updated` WebSocket 이벤트가 과도하게 발생.

#### 문제 2: `session_end.ts`와 `stop.ts`의 이중 호출 경합

- Claude Code는 Stop → SessionEnd 순서로 훅을 실행
- `stop.ts`가 먼저 `runtime-session-end`(completeTask:true)를 보내 세션을 종료+태스크 완료
- 직후 `session_end.ts`가 같은 `runtimeSessionId`로 `runtime-session-end`를 다시 보냄
- 서버의 `endRuntimeSession`은 binding을 찾지 못해 (이미 `clearSession`됨) no-op이 되지만, **불필요한 API 호출**이 발생

#### 문제 3: `common.ts`의 API timeout이 1초로 너무 짧음

- `.claude/hooks/common.ts:38` — `AbortSignal.timeout(1_000)`
- 서버가 바쁠 때 timeout이 쉽게 발생
- MCP client는 5초 timeout + 3회 retry인데 hook은 1초 단발
- **영향**: 이벤트 유실 가능

#### 문제 4: `mcp__agent-tracer__*` 도구가 `tool_used.ts`에서 필터링되지 않음

- `settings.json`의 `PostToolUse` 매처 `mcp__.*`가 모든 MCP 도구를 `tool_used.ts`로 보냄
- `.claude/hooks/tool_used.ts:59-76`에서 MCP 도구를 `agent-activity`로 기록하는데,
  `agent-tracer` MCP 도구(`monitor_*`)도 포함됨
- **확인됨**: `tool_used.ts`에 `agent-tracer` 서버 필터링 로직이 없음
- `monitor_tool_used` 호출 → `tool_used.ts` 발동 → `agent-activity` 기록 → 무한 루프는 아니지만 노이즈 이벤트 생성
- **수정**: `mcpTool.server === "agent-tracer"` 시 early return 필요

---

### 1-B. OpenCode (`.opencode/plugins/monitor.ts`)

**구조: 양호** — 가장 복잡한 설정 (2,744줄). 자체 세션 상태 머신 보유.

#### 문제 5: 인메모리 상태만 사용 — 프로세스 재시작 시 세션 상태 유실

- `sessionStates`, `suspendedSessionIds` 등이 모두 인메모리 Map/Set
- OpenCode 프로세스가 재시작되면 진행 중이던 세션 상태를 복구할 수 없음
- Claude Code는 `.subagent-registry.json`으로 디스크에 퍼시스트하지만, OpenCode 플러그인은 하지 않음

#### 문제 6: `findReusablePrimarySubagentState()` — title 기반 매칭의 취약성

- 동일 제목의 다른 태스크가 있으면 잘못된 세션을 재사용할 수 있음

---

### 1-C. Codex (`skills/codex-monitor/SKILL.md`)

**구조: 양호** — 스킬 문서로 수동 이벤트 기록 안내.

#### 문제 7: `CODEX_THREAD_ID` 환경변수 미보장

- Codex CLI가 실제로 `CODEX_THREAD_ID` 환경변수를 제공하는지 공식 문서에서 확인되지 않음
- fallback으로 `node -e "console.log('codex-' + crypto.randomUUID())"` 사용하지만,
  매 호출마다 새 UUID를 생성하면 세션 연속성이 깨짐
- Codex는 `CODEX_SANDBOX_ID` 등의 환경변수는 있지만 `CODEX_THREAD_ID`는 비공식.
  실제로 비어있을 가능성이 높음

#### 문제 8: MCP 서버 접근 방식 불일치

- Codex 스킬은 MCP 도구(`monitor_*`)를 사용하라고 안내하지만,
  Codex CLI에서 MCP 서버를 어떻게 연결하는지 설정이 없음
- `.agents/skills/codex-monitor/SKILL.md`가 `.agents/` 아래에 projection되지만,
  Codex가 이를 자동으로 인식하는 메커니즘이 불명확

---

### 1-D. 범용 스킬 (`skills/monitor/SKILL.md`)

**구조: 양호** — Cursor, Windsurf 등 MCP 환경용.

#### 문제 9: 모든 이벤트를 수동으로 기록해야 함

- 자동 훅이 없으므로 에이전트가 이벤트 기록을 잊으면 타임라인에 빈 구간 발생
- 가이드라인이지만 강제성이 없음 (구조적 한계)

---

## 2. 세션 Resume 문제 분석

### 현재 상태

최근 커밋 `e1f1b02`에서 CLI bridge 인프라가 완전히 제거됨:

- `packages/server/src/application/cli-bridge/` 전체 삭제
- `packages/web/src/pages/ChatPage.tsx` 및 관련 컴포넌트 삭제
- WebSocket CLI 핸들러 삭제

### Resume이 안 되는 근본 원인

**CLI bridge의 resume은 "웹 UI에서 CLI 프로세스를 다시 연결"하는 기능이었다.**

- `resumeChat()`이 Claude Code/OpenCode를 headless 프로세스로 실행하고 stdin/stdout 스트림을 관리
- 이 기능이 삭제되면서 웹 UI에서 기존 세션을 이어받는 경로가 완전히 사라짐

**그러나 서버 레벨의 세션 모델은 건재하다:**

- `POST /api/runtime-session-ensure`는 여전히 동작
- `runtimeSource + runtimeSessionId` 조합으로 기존 태스크를 찾아 새 세션을 생성할 수 있음
- 문제는 **웹 UI에서 이 API를 활용하는 프레젠테이션 레이어가 없다**는 것

### Resume 흐름 분석

```
[서버 API 계층]          정상 동작 — 변경 불필요
  POST /api/runtime-session-ensure
  └─ runtimeSessionId가 기존 binding에 있으면 → 기존 taskId 반환
  └─ taskId만 있고 session 없으면 → 새 session 생성, task를 running으로 전환
  └─ 없으면 → 새 task + session 생성

[MCP 도구 계층]          정상 동작 — 변경 불필요
  monitor_runtime_session_ensure

[Claude Code Hooks]     동작함 — 같은 session_id로 재접속하면 기존 task 재사용
  session_start.ts → ensureRuntimeSession(sessionId)
  SessionStart(source=resume) hook 발동 시 기존 binding 탐색

[Web UI]                ChatPage 삭제됨 — 새로운 resume UI 필요
[CLI → Web bridge]      완전 삭제 — CLI 프로세스 관리 레이어 재구축 필요
```

### 결론

CLI에서의 resume는 **Claude Code 자체의 `--resume` 플래그**로 동작해야 하고,
Agent Tracer 측에서는 같은 `runtimeSessionId`가 들어오면 자동으로 기존 task에 연결된다.
문제는 웹 UI에서 "이 세션을 CLI로 이어서 작업하겠다"라는 브릿지가 삭제된 것.

**Claude Code `--resume` 경로**:
1. 사용자가 `claude --resume` 실행
2. `SessionStart(source=resume)` hook 발동
3. `session_start.ts` → `ensureRuntimeSession(동일 session_id)`
4. 서버가 기존 binding의 taskId를 찾아 새 monitorSession 생성
5. **이 경로는 이미 동작해야 함** — 동작하지 않는다면 별도 디버깅 필요

---

## 3. 권장 수정 사항

### P0 — 즉시 수정

| # | 문제 | 수정 위치 | 수정 내용 |
|---|------|----------|----------|
| 1 | stop.ts completeTask 과다 | `.claude/hooks/stop.ts:56-62` | `completeTask: true` 제거. `completionReason: "assistant_turn_complete"`만 보내고 task 완료는 `SessionEnd` hook에 위임 |
| 2 | agent-tracer MCP 자기 참조 | `.claude/hooks/tool_used.ts` | `mcpTool.server === "agent-tracer"` 시 early return 추가 |

### P1 — 세션 Resume 복구

| # | 옵션 | 설명 |
|---|------|------|
| A | "Continue in CLI" 안내 | 웹 UI에서 `claude --resume <session-id>` 명령어를 복사할 수 있게 안내 버튼 추가 |
| B | 경량 CLI bridge 재구축 | WebSocket 기반 CLI 프로세스 관리 (이전보다 경량화) |
| C | 모니터링 전용 | CLI resume은 CLI 도구 자체의 기능에 위임하고, 웹은 모니터링 전용으로 유지 |

### P2 — 개선

| # | 문제 | 수정 위치 | 수정 내용 |
|---|------|----------|----------|
| 5 | API timeout 너무 짧음 | `.claude/hooks/common.ts:38` | `AbortSignal.timeout(3_000)` 으로 상향 |
| 6 | Codex CODEX_THREAD_ID 미보장 | `skills/codex-monitor/SKILL.md` | 안정적인 세션 식별자 전략 재설계 (파일 기반 퍼시스트 등) |
| 7 | OpenCode 세션 상태 유실 | `.opencode/plugins/monitor.ts` | 세션 상태 디스크 퍼시스트 추가 |

---

## 4. 검증 방법

1. **Claude Code resume 테스트**: `claude --resume` 실행 후 웹 대시보드에서 같은 task 아래 새 session이 생기는지 확인
2. **Stop/SessionEnd 이중 호출 확인**: `.claude/hooks.log`에서 Stop → SessionEnd 순서 및 API 응답 확인
3. **MCP 자기 참조 확인**: `monitor_*` MCP 도구 호출 시 `tool_used` 이벤트가 추가로 기록되는지 확인
4. **Codex 세션 연속성 테스트**: 같은 thread에서 여러 턴 실행 후 동일 task 아래 기록되는지 확인
