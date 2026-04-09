# Agent Config (Claude Code 훅) 리뷰

## 개요

`.claude/hooks/` 디렉토리의 Claude Code 훅 설정을 리뷰하고 개선한다.
`packages/` 코드와 독립적이므로 **Core/Server, Web 리팩토링과 완전 병렬로 수행 가능**하다.

### 현재 ��태

| 항목 | 현황 |
|------|------|
| 훅 파일 | 13개 (`.claude/hooks/*.ts`) |
| 실행 방식 | `tsx`로 직접 실행 (트랜스파일 없이) |
| 공유 유틸 | `common.ts` (API 호출, 세션 관리, 로깅) |
| API timeout | 1,000ms (`postJson` 함수) |
| 등록 | `.claude/settings.json` (12개 훅 이벤트) |

### 훅 목록

| 훅 파일 | 이벤트 | `ensureRuntimeSession` 호출 |
|---------|--------|---------------------------|
| `session_start.ts` | SessionStart | O |
| `session_end.ts` | SessionEnd | X (별도 처리) |
| `ensure_task.ts` | PreToolUse | O |
| `user_prompt.ts` | UserPromptSubmit | X |
| `tool_used.ts` | PostToolUse (Edit, Write, mcp) | O |
| `explore.ts` | PostToolUse (Read, Glob, Grep, Web) | O |
| `terminal.ts` | PostToolUse (Bash) | O |
| `agent_activity.ts` | PostToolUse (Agent, Skill) | O |
| `todo.ts` | PostToolUse (TodoWrite 등) | O |
| `subagent_lifecycle.ts` | SubagentStart/Stop | O |
| `compact.ts` | PreCompact/PostCompact | O |
| `stop.ts` | Stop | O |

---

## P0-a — stop.ts / tool_used.ts 즉시 수정

이중 호출 경합(P0-b) 이전에 먼저 해결할 단순 버그:

| # | 문제 | 수정 위치 | 수정 내용 |
|---|------|----------|----------|
| 1 | stop.ts `completeTask: true` 과다 | `.claude/hooks/stop.ts:56-62` | `completeTask: true` 제거. task 완료는 `SessionEnd` hook에 위임 |
| 2 | stop.ts/session_end.ts 이중 종료 | `.claude/hooks/stop.ts` | Stop hook에서 `runtime-session-end` 호출 제거. 세션 종료를 `SessionEnd` hook에 일원화 |
| 3 | agent-tracer MCP 자기 참조 | `.claude/hooks/tool_used.ts:59-76` | `mcpTool.server === "agent-tracer"` 시 early return 추가 |

---

## P0-b — 이중 호출 경합 (Critical)

### 문제

`PreToolUse` 이벤트에서 `ensure_task.ts`가 `ensureRuntimeSession(sessionId)`를 호출하고,
직후 `PostToolUse` 이벤트에서 해당 도구의 훅(`tool_used.ts`, `explore.ts`, `terminal.ts` 등)이
다시 `ensureRuntimeSession(sessionId)`를 호출한다.

```
시간축 →
├─ PreToolUse ─┤├─ [도구 실행] ─┤├─ PostToolUse ─┤
    │                                   │
    ensure_task.ts                      tool_used.ts
    ensureRuntimeSession(sid)           ensureRuntimeSession(sid)
```

### 경합 시나리오

서버의 `ensureRuntimeSession()` (`task-lifecycle-service.ts:257`)은 다음 순서로 동작:

1. `runtimeBindings.find(source, sessionId)` — binding 존재 시 즉시 반환
2. `runtimeBindings.findTaskId(source, sessionId)` — task 연결만 있으면 새 session 생성
3. 위 둘 다 없으면 → 새 task + session 생성

**첫 번째 호출이 binding을 저장하기 전에 두 번째 호출이 1단계에 도달하면**,
두 호출 모두 3단계로 진행하여 동일 세션에 대해 task/session이 중복 생성된다.

### 해결 방안

#### 방안 A: 클라이언트 측 캐싱 (권장)

`ensure_task.ts`의 결과를 임시파일에 캐싱하여 PostToolUse 훅에서 재사용:

```typescript
// common.ts에 추가
const CACHE_DIR = path.join(PROJECT_DIR, ".claude", ".session-cache");

export async function getCachedSessionResult(
  sessionId: string
): Promise<RuntimeSessionEnsureResult | null> {
  const cachePath = path.join(CACHE_DIR, `${sessionId}.json`);
  try {
    return JSON.parse(fs.readFileSync(cachePath, "utf-8"));
  } catch {
    return null;
  }
}

export async function cacheSessionResult(
  sessionId: string,
  result: RuntimeSessionEnsureResult
): Promise<void> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(CACHE_DIR, `${sessionId}.json`),
    JSON.stringify(result)
  );
}
```

`ensure_task.ts`에서 결과 저장, PostToolUse 훅에서 캐시 우�� 사용.

#### 방안 B: ���버 측 idempotency

서버의 `ensureRuntimeSession`에서 `runtimeBindings.find()` 전에 잠금 또는
upsert의 원자성을 보장. better-sqlite3의 동기 특성상 실제 DB 레벨 경합은 적지만,
Node.js 이벤트 루프 내 비동기 간극에서 발생할 수 있다.

---

## P1 — 세션 Resume 처리

### 현재 동작

`session_start.ts`가 4가지 source를 각각 다른 이벤트로 기록:

```typescript
const TITLES: Record<string, string> = {
  startup: "Session started",
  resume: "Session resumed",
  clear: "Conversation cleared",
  compact: "Session resumed after compact"
};
```

`session_end.ts`는 `clear` 이벤트 시 "double-fire" 방지를 위해 스킵:

```typescript
// session_end.ts:26
// session_start.ts records the "Conversation cleared" event — skip here to avoid double-fire.
if (reason === "clear") {
  hookLog("session_end", "skipped — clear event handled by session_start");
  return;
}
```

### 옵션 비교

| 기준 | A (CLI 안내 버튼) | B (CLI bridge 재구축) | **C (모니터링 전용)** |
|------|------------------|----------------------|---------------------|
| 구현 비용 | 낮음 | 높음 (e1f1b02에서 삭제된 이유: 복잡성) | 없음 |
| 유지보수 | 낮음 | 높음 (프로세스 관리, 보안) | 없음 |
| UX | CLI 명령어 복사 필요 | 웹에서 직접 resume | 웹은 읽기 전용 |
| 제품 방향성 | 절충 | 웹 IDE화 | 모니터링 도구 본연의 역할 |

> 옵션 A는 옵션 C의 보완으로 추후 추가 가능 (낮은 비용).

### 권장: 옵션 C — 모니터링 전용

현재 구조를 유지하되, `session_end.ts`의 "clear skip" 패턴을 다른 경합 시나리오에도 확장:

- `compact` 시에도 유사한 중복 방지 로직 추가
- `resume` 시 이전 session 자동 종료 여부 확인

**Pros:**
- 최소 변경량 — 기존 동작 유지
- 기존 저장 데이터와 호환
- 대시보드에서 session lifecycle을 정확히 표현

**Cons:**
- 복잡한 케이스(빠른 clear-resume 반복 등)에서 이벤트 누락 가능
- 각 source별 엣지 케이스를 개별 처리해야 함

---

## P2 — 구체적 개선 항목

### 2.1 `postJson` timeout 증가

```typescript
// common.ts:38 — 현재
signal: AbortSignal.timeout(1_000)

// 변���
signal: AbortSignal.timeout(2_000)
```

이유: 개발 환경에서 모니터 서버 콜드스타트 시 1초 timeout으로 빈번하게 실패.
훅이 Claude 응답을 블로킹하므로 2초가 상한선.

### 2.2 `hookLog`에 타임스탬프 추가

```typescript
// common.ts — 현재 hookLog 구현을 찾아 아래와 같이 수정
export function hookLog(hook: string, message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const line = JSON.stringify({ timestamp, hook, message, ...data });
  // .claude/hooks.log에 append
}
```

디버깅 시 이벤트 순서와 시간 간격 파악에 필수적.

### 2.3 `getSessionId` hook_source 필터 명확화

```typescript
// common.ts:71-77 — 현재
export function getSessionId(event: JsonObject): string {
  const hookSource = toTrimmedString(event.hook_source);
  if (hookSource && hookSource !== "claude-hook") {
    return "";
  }
  return toTrimmedString(event.session_id);
}
```

`hook_source`가 빈 문자열이거나 `"claude-hook"`일 때만 sessionId를 반환하는 로직이다.
이는 외부 프로젝트 연동 시 훅이 다른 소스에서 트리거되는 것을 방지하기 위함인데,
코드만으로는 의도가 불분명하다. 주석으로 의도를 명확히 한다:

```typescript
/**
 * Claude Code 자체 훅에서만 sessionId를 추출한다.
 * 외부 프로젝트(.claude/settings.json 복사)에서 실행될 때
 * hook_source가 다른 값이면 이 세션은 무시한다.
 */
export function getSessionId(event: JsonObject): string {
  const hookSource = toTrimmedString(event.hook_source);
  if (hookSource && hookSource !== "claude-hook") {
    return "";
  }
  return toTrimmedString(event.session_id);
}
```

### 2.4 Codex 세션 식별자 안정화

`CODEX_THREAD_ID`가 비어있으면 매번 새 UUID 생성 → 세션 연속성 깨짐.
파일 기반 퍼시스트로 해결:

```bash
# skills/codex-monitor/SKILL.md 가이드 수정
SESSION_FILE=".monitor/.codex-session-id"
if [ -z "$CODEX_THREAD_ID" ]; then
  if [ -f "$SESSION_FILE" ]; then
    CODEX_THREAD_ID=$(cat "$SESSION_FILE")
  else
    CODEX_THREAD_ID="codex-$(node -e "console.log(crypto.randomUUID())")"
    mkdir -p .monitor && echo "$CODEX_THREAD_ID" > "$SESSION_FILE"
  fi
fi
```

### 2.5 OpenCode 세션 상태 디스크 퍼시스트

`.opencode/plugins/monitor.ts`의 인메모리 `Map`/`Set`을 디스크에 저장:

```typescript
const STATE_FILE = path.join(projectRoot, ".monitor", ".opencode-session-state.json");

function persistSessionStates(): void {
  const data = {
    sessions: Object.fromEntries(sessionStates),
    suspended: [...suspendedSessionIds],
  };
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
}

function restoreSessionStates(): void {
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    const data = JSON.parse(raw);
    for (const [k, v] of Object.entries(data.sessions)) {
      sessionStates.set(k, v as SessionState);
    }
    for (const id of data.suspended) {
      suspendedSessionIds.add(id);
    }
  } catch {
    // File doesn't exist or is corrupted — start fresh
  }
}
```

`persistSessionStates()`를 세션 상태 변경마다 호출 (debounce 1초).
플러그인 초기화 시 `restoreSessionStates()` 호출.

---

## 주요 파일 참조

| ���일 | 역할 | 우선순위 |
|------|------|---------|
| `.claude/hooks/common.ts` | 공유 유틸 (API, 로깅, 세션) | P0, P2 |
| `.claude/hooks/ensure_task.ts` | PreToolUse 세션 보장 | P0 |
| `.claude/hooks/tool_used.ts` | PostToolUse 이벤트 기록 | P0 |
| `.claude/hooks/explore.ts` | PostToolUse 탐색 이벤트 | P0 |
| `.claude/hooks/terminal.ts` | PostToolUse Bash 이벤트 | P0 |
| `.claude/hooks/session_start.ts` | 세션 시작 기록 | P1 |
| `.claude/hooks/session_end.ts` | 세션 종료 기록 (clear skip 패턴) | P1 |
| `.claude/settings.json` | 훅 등록 설정 | 전체 |
| `packages/server/src/application/services/task-lifecycle-service.ts` | 서버 측 `ensureRuntimeSession` | P0 참조 |
