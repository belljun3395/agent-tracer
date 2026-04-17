# Plan: Transcript JSONL 추가 시그널 수집 (Phase 2)

## Context

`magical-sparking-snowglobe.md` (Phase 1) 에서 transcript tail 인프라를 세워 `thought.logged`, `context.saved`, `instructions.loaded`, `assistant.response(phase=intermediate)` 4종을 수집했다. 그러나 같은 JSONL 파일에는 **훅으로 절대 얻을 수 없는** 런타임 시그널들이 더 있다: per-message usage/cache-hit, per-turn 지연, stop_reason, permission-mode 토글, sidechain 플래그, prompt 그룹키, 그리고 확정적 `tool_use ↔ tool_result` 링크. 모두 "왜 느렸나 / 왜 잘렸나 / 사용자가 언제 bypass 켰나 / 서브에이전트에서 무슨 일이 있었나"에 직접 답하는 데이터.

Phase 2 는 이 시그널들을 기존 transcript-emit 파이프라인에 얹는다. **서버 스키마 변경 없음** (metadata 자유 JSON + 기존 kind 재사용). 새 kind 는 `turn.metrics` 하나만 제안 (서버 스키마 1줄 추가).

샘플 소스: `~/.claude/projects/-Users-kimjongjun-Documents-code-agent-tracer/63aa5436-cba0-43cb-b7c7-7f9b9482ee97.jsonl` (500줄 샘플 기준).

---

## 시그널 카탈로그 (우선순위 순)

### ★1. `system.subtype="turn_duration"` — 턴 지연·크기

실제 엔트리:
```json
{
  "type": "system",
  "subtype": "turn_duration",
  "durationMs": 81549,
  "messageCount": 176,
  "timestamp": "2026-04-17T02:17:02.891Z",
  "uuid": "90ea0d88-46a6-4f70-9862-72504224d243",
  "sessionId": "63aa5436-cba0-43cb-b7c7-7f9b9482ee97"
}
```

- **가치:** 턴별 체감 지연 + 모델이 돌린 internal message 수. Stop.ts 가 현재 추정 불가.
- **매핑:** 새 kind `turn.metrics`, `metadata = { durationMs, messageCount, source:"claude-transcript" }`.
- **구현:** `mapSystemEntry(entry)` 분기 추가. 서버 스키마 (`packages/server/src/presentation/schemas.ingest.ts`) 에 `"turn.metrics"` 리터럴 1줄 추가.

### ★2. assistant `message.usage` (per-message) — 비용·캐시 히트

실제 엔트리 (발췌):
```json
{
  "type": "assistant",
  "uuid": "05ef265d-8ea3-440d-a9c7-68b69461d561",
  "message": {
    "model": "claude-opus-4-7",
    "id": "msg_01QwweV58LiUmSKBkpue67Wy",
    "stop_reason": "tool_use",
    "usage": {
      "input_tokens": 6,
      "cache_creation_input_tokens": 43468,
      "cache_read_input_tokens": 30465,
      "output_tokens": 263,
      "cache_creation": {
        "ephemeral_1h_input_tokens": 43468,
        "ephemeral_5m_input_tokens": 0
      },
      "service_tier": "standard"
    }
  }
}
```

- **가치:** 현재 Stop.ts 는 **마지막** assistant 메시지의 usage 만 Assistant-Response 이벤트에 싣는다. tool_use 사이에 끼인 모든 중간 메시지의 usage (= 대부분의 토큰 소비) 는 사라짐. 캐시 히트율 / 1h vs 5m 에페머럴 분포 / tier 강등 추적 불가.
- **매핑:** 기존 thinking 이나 intermediate text 이벤트 metadata 에 `usage` 부가 필드로 inline. 별도 이벤트로 쏘면 노이즈 (메시지당 1건 추가).
  ```ts
  {
    ...baseMeta,
    usage: {
      inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens,
      ephemeral1hInputTokens, ephemeral5mInputTokens, serviceTier
    },
    stopReason: entry.message.stop_reason
  }
  ```
- **구현:** `mapAssistantContentBlock` 의 `baseMeta` 에 `usage` 병합. thinking/intermediate 양쪽 경로 공유.

### ★3. `message.stop_reason` — 잘림·일시정지 감지

이미 ★2 샘플의 `stop_reason: "tool_use"` 참고. 값 도메인: `end_turn | tool_use | max_tokens | stop_sequence | pause_turn`.

- **가치:** `max_tokens` 발생 시 출력이 잘린 턴 → 이거 몰라서 "이상하게 답변이 짧다" 현상을 놓침. `pause_turn` 은 실행 일시정지 (새 행동).
- **매핑:** ★2 와 함께 `metadata.stopReason` 으로 inline. `stop_reason ∈ {max_tokens, pause_turn}` 이면 별도 `assistant.response(phase="anomaly")` 이벤트 추가 발행 고려.
- **구현:** ★2 와 동일 지점.

### ★4. `permission-mode` 엔트리 — bypass/plan 토글

실제 엔트리:
```json
{
  "type": "permission-mode",
  "permissionMode": "bypassPermissions",
  "sessionId": "63aa5436-cba0-43cb-b7c7-7f9b9482ee97"
}
```

샘플 500줄에 13회. 값: `default | bypassPermissions | plan | acceptEdits`.

- **가치:** 보안·감사. "왜 이 tool 이 컨펌 없이 실행됐나" = bypass 켜져 있었기 때문. 현재는 하드캐스팅된 상태만 알 뿐 언제 토글됐는지 모름.
- **매핑:** 새 kind 만들지 말고 기존 `context.saved` 재사용. `metadata = { attachmentType: "permission_mode_change", permissionMode, source:"claude-transcript" }`, `lane = "planning"`, `title = "Permission mode → bypassPermissions"`.
- **주의:** 이 엔트리는 `timestamp/uuid 가 없음`. transcript tail 의 idempotent cursor 가 uuid 기반이라 여기는 별도 처리 필요 → **스키마 회피:** 바로 직전 entry 의 uuid 를 가상 앵커로 쓰고, messageId 는 `sha1("transcript-permmode:<sessionId>:<prevUuid>:<mode>")` 결정적.
- **중복 방지:** 같은 모드가 연속 등장하면 skip (tail 재실행 시 이미 같은 messageId 로 접힘).

### ★5. `isSidechain: true` 플래그 — 서브에이전트 전파

모든 entry 최상위에 `isSidechain: boolean`. true 일 때 그 메시지는 서브에이전트의 사이드체인.

- **가치:** Inspector 에서 "subagent-only" 필터 / 타임라인에서 시각적 구분. 현재 `resolveEventSessionIds` 가 taskId 는 분리하지만 UI 는 sidechain 구분 못함.
- **매핑:** 모든 transcript 이벤트 metadata 에 `isSidechain: true` 전파 (false 는 생략).
- **구현:** `mapAssistantContentBlock`, `mapAttachmentEntry`, 새 `mapSystemEntry` 전부에서 `baseMeta` 에 조건부 추가.

---

### ◆6. `last-prompt` 엔트리 — 유저 질문 원문 보정

실제 엔트리:
```json
{
  "type": "last-prompt",
  "lastPrompt": "action에 'Save to Library via Claude' 와 'Save to Library' 를 보면 하나의 테스크에서 대화를 여러번 하는 경우를 가정하지 않은 것 같아. 한번 개선 검토해보자.",
  "sessionId": "63aa5436-cba0-43cb-b7c7-7f9b9482ee97"
}
```

- **가치:** UserPromptSubmit 훅이 놓친 경우 (슬래시 커맨드 확장 결과 / compact resume) 대비 canonical 유저 원문.
- **리스크:** UserPromptSubmit 훅과 중복 발행될 수 있음. 중복 판별 기준 = 같은 session + 같은 본문 해시.
- **매핑:** 기존 `user.message.logged` kind 재사용 + `metadata.source = "last-prompt"` 로 구분.
- **구현 결정:** MVP 에서는 **skip**. 훅 경로가 더 구조적 (userMessage id 가짐) 이고, last-prompt 는 타임스탬프/uuid 도 없어 정렬 어려움. 훅이 빠지는 케이스가 관측되면 fallback 으로 켬.

### ◆7. `promptId` — 프롬프트 그룹 키

실제 엔트리 (user/assistant entry 의 top-level 필드):
```json
{
  "type": "user",
  "uuid": "8dd6144a-df45-4208-b443-ff8f2b5c37cc",
  "promptId": "b2a32c29-7024-4fd0-8151-789ffff64158",
  "message": { "role": "user", "content": "action에..." }
}
```

같은 `promptId` 가 뒤따르는 assistant/tool_result 에도 붙음.

- **가치:** 멀티턴 안에서 "이 tool_use 는 이 프롬프트 답변의 일부" 를 확정적으로 묶음. 현재는 timestamp 근접도로 추정.
- **매핑:** 모든 transcript 이벤트 metadata 에 `promptId` 전파. 추가 이벤트 없음.
- **구현:** `baseMeta` 에 조건부 추가.

### ◆8. `system.subtype="stop_hook_summary"` — 훅 집행 요약

실제 엔트리 (발췌):
```json
{
  "type": "system",
  "subtype": "stop_hook_summary",
  "hookCount": 15,
  "hookInfos": [
    { "command": "node -e \"...\"", "duration": 123, "exitCode": 0 }
  ],
  "uuid": "..."
}
```

- **가치:** Stop 훅 퍼포먼스 디버깅. 어떤 훅이 몇 ms 먹었나.
- **매핑:** `context.saved` 재사용, `metadata = { attachmentType:"stop_hook_summary", hookCount, totalMs, slowest:[{command, duration, exitCode}] }` (command 문자열은 앞 120자 잘라서 저장 — 그대로 넣으면 너무 큼).
- **구현:** `mapSystemEntry` 분기.

### ◆9. `file-history-snapshot` — 파일 백업 스냅샷

실제 엔트리:
```json
{
  "type": "file-history-snapshot",
  "messageId": "a15c142d-1b2a-4eb0-b3b3-da1bb0cc7f48",
  "snapshot": {
    "messageId": "a15c142d-1b2a-4eb0-b3b3-da1bb0cc7f48",
    "trackedFileBackups": {},
    "timestamp": "2026-04-17T02:15:39.794Z"
  },
  "isSnapshotUpdate": false
}
```

- **가치:** Claude Code 의 자동 undo 백업 포인트. 대규모 수정 직후 스냅샷 타이밍을 타임라인에 띄우면 rollback 지점 시각화 가능.
- **매핑:** `context.saved`, `metadata = { attachmentType:"file_history_snapshot", snapshotMessageId, trackedFileCount, isSnapshotUpdate }`. `trackedFileBackups` 객체 자체는 키 수만 저장 (전체 복사 피함).
- **우선순위:** 낮음 — 대부분 `trackedFileBackups: {}` 빈 값이라 노이즈 많음. 실제 파일 백업이 있을 때만 (`Object.keys().length > 0`) 발행.

### ◆10. `toolUseResult` + `sourceToolAssistantUUID` — 확정적 tool 사슬

실제 엔트리 (user/tool_result):
```json
{
  "type": "user",
  "uuid": "3be5b747-99fb-435d-8ad0-787cfc3ed05e",
  "parentUuid": "05ef265d-8ea3-440d-a9c7-68b69461d561",
  "promptId": "b2a32c29-7024-4fd0-8151-789ffff64158",
  "message": {
    "role": "user",
    "content": [{
      "tool_use_id": "toolu_01WrU3bNa8g3uXak1npK2Naa",
      "type": "tool_result",
      "content": "Found 2 files\npackages/web/..."
    }]
  },
  "toolUseResult": {
    "mode": "files_with_matches",
    "filenames": [...],
    "numFiles": 2
  },
  "sourceToolAssistantUUID": "05ef265d-8ea3-440d-a9c7-68b69461d561"
}
```

- **가치:** 훅 이벤트의 `toolUseId` ↔ transcript 의 `tool_use.id` 매칭이 이미 Phase 1 에서 깔렸음. 여기에 `sourceToolAssistantUUID` 를 더하면 **thinking (assistant uuid=X) → tool_use (같은 X) → tool_result (`sourceToolAssistantUUID: X`)** 사슬 확정.
- **매핑:** tool_result 자체는 훅이 커버하므로 **새 이벤트 발행 안 함**. 단, **기존 훅 이벤트 metadata 에 transcript tail 이 `sourceToolAssistantUUID` 를 사후 주입** — 이건 복잡하므로 phase 2 에서는 **skip**, Phase 3 후보.

---

### ✕ Skip 대상 (근거)

- `attachment.type="hook_success"` (일반) — 훅이 이미 발행. 단, `hookName="SessionStart:startup"` 의 `additionalContext` 만 예외로 1회 캡처 고려 (idx11 참조).
- `attachment.type="async_hook_response"` — `.hook-log.jsonl` 에 이미 기록. 중복.
- `attachment.type="hook_additional_context"` — 본문이 SessionStart summary 와 중복.
- `tool_use.input` 재발행 — 훅 커버.
- `user.message.content[tool_result]` 별도 — 훅 커버.

### ◆11. `hook_success` SessionStart (특수) — 세션 요약 원문

```json
{
  "type": "attachment",
  "attachment": {
    "type": "hook_success",
    "hookName": "SessionStart:startup",
    "hookEvent": "SessionStart",
    "stdout": "{\"hookSpecificOutput\":{\"hookEventName\":\"SessionStart\",\"additionalContext\":\"Previous session summary:\\n...\"}}"
  }
}
```

- **가치:** 이전 세션 요약이 현재 턴에 주입된 지점. 세션 연속성 해석에 쓸 수 있음.
- **결정:** 세션 시작 시 1회만 발행. `context.saved`, `metadata.attachmentType = "session_start_context"`, `body = additionalContext (앞 4000자)`.
- **idempotency:** messageId = `sha1("session-start-ctx:<sessionId>")` 로 세션당 1건 보장.

---

## Architecture

### 확장 지점

- `transcript-emit.ts` 만 수정. tail/cursor 로직은 Phase 1 그대로.
- 새 엔트리 타입 분기 3개 추가:
  - `mapSystemEntry(entry)` — `subtype ∈ {turn_duration, stop_hook_summary}`
  - `mapPermissionModeEntry(entry, prevUuid)` — `type="permission-mode"` (앵커 uuid 필요)
  - `mapFileHistorySnapshotEntry(entry)` — `type="file-history-snapshot"` (빈 backups skip)
  - (선택) `mapSessionStartHookSuccess(entry)` — `attachment.hookName === "SessionStart:startup"`
- 기존 `mapAssistantContentBlock` 의 `baseMeta` 에 `usage`, `stopReason`, `isSidechain`, `promptId` 추가.
- 기존 `mapAttachmentEntry` 전체 분기에 `isSidechain`, `promptId` 공통 주입.

### 새 TypeScript 인터페이스 (transcript-emit.ts)

```ts
export interface TranscriptSystemEntry extends TranscriptEntry {
    type: "system";
    subtype: "turn_duration" | "stop_hook_summary";
    durationMs?: number;
    messageCount?: number;
    hookCount?: number;
    hookInfos?: Array<{ command: string; duration?: number; exitCode?: number }>;
}

export interface TranscriptPermissionModeEntry {
    type: "permission-mode";
    permissionMode: "default" | "bypassPermissions" | "plan" | "acceptEdits";
    sessionId?: string;
}

export interface TranscriptFileHistorySnapshotEntry {
    type: "file-history-snapshot";
    messageId?: string;
    snapshot?: {
        messageId?: string;
        trackedFileBackups?: Record<string, unknown>;
        timestamp?: string;
    };
    isSnapshotUpdate?: boolean;
}
```

### permission-mode cursor 해결

permission-mode 엔트리는 `uuid` 가 없어 Phase 1 cursor 가 처리 못 함. 해결:
1. `parseJsonlLines` 결과를 순회할 때 바로 직전 **uuid 있는 entry** 의 uuid 를 `prevUuid` 로 전달.
2. permission-mode 엔트리는 messageId = `sha1("transcript-permmode:<sessionId>:<prevUuid>:<mode>")` 로 결정적.
3. cursor 는 직전 uuid 기준으로 이미 전진 → 재실행 시 같은 (prevUuid, mode) 조합이라 같은 messageId → 서버가 upsert 로 dedupe.

### 새 server kind: `turn.metrics`

`packages/server/src/presentation/schemas.ingest.ts` 의 `kind` enum 에 `"turn.metrics"` 1줄 추가. DB 는 이미 TEXT 컬럼이라 마이그레이션 불필요. Domain union (`packages/core`) 에도 추가.

---

## Files to modify / create

### Modify
- `.claude/plugin/hooks/lib/transcript-emit.ts`
  - 새 분기 함수 3개 추가 (`mapSystemEntry`, `mapPermissionModeEntry`, `mapFileHistorySnapshotEntry`)
  - `buildEventsFromEntries` 루프에 분기 라우팅 + `prevUuid` 추적
  - `baseMeta` / `commonMeta` 에 `isSidechain`, `promptId` 공통 주입
  - assistant usage fields 병합
- `packages/server/src/presentation/schemas.ingest.ts` — `"turn.metrics"` 추가
- `packages/core/src/types/events.ts` (또는 kind union 정의 위치) — `"turn.metrics"` 추가
- `packages/web-domain/src/types.ts` / `timeline.ts` — `turn.metrics` 의 기본 lane 매핑 (`background` 추천)
- `packages/web/src/features/timeline/TimelineEventNode.tsx` — `turn.metrics` 렌더 칩 (durationMs 표시)
- `packages/web/src/components/inspector/InspectorDetails.tsx` — `DetailTurnMetrics` 섹션 (선택)
- `.claude/plugin/DATA_FLOW.md` — 신규 시그널 매핑 표 추가

### New (테스트)
- `.claude/plugin/hooks/lib/__tests__/transcript-emit.signals.test.ts`
  - turn_duration 1건 → `turn.metrics` 이벤트 1개
  - permission-mode 연속 2건 (같은 모드) → 이벤트 1개 (idempotent)
  - assistant message 3건 → 각각 usage metadata 붙음
  - file-history-snapshot `trackedFileBackups: {}` → 이벤트 0
  - stop_hook_summary hookInfos 내 command 120자 이상 → 잘림

---

## Verification

### 단위
```bash
cd .claude/plugin
pnpm tsc --noEmit
pnpm eslint hooks/lib/transcript-emit.ts
# 새 테스트
./node_modules/.bin/vitest run .claude/plugin/hooks/lib/__tests__/transcript-emit.signals.test.ts
```

### 통합 (로컬)
1. 모니터 서버 dev 모드.
2. 새 Claude Code 세션 시작 → 2~3턴 대화 (중간에 `/plan mode` 토글 1회).
3. 턴 종료 후 서버 DB 에서 확인:
   - `kind="turn.metrics"` 행 존재, `metadata.durationMs > 0`.
   - 같은 sessionId 의 `thought.logged` 행들이 `metadata.usage.cacheReadInputTokens` 를 갖는다.
   - plan mode 전환 시 `kind="context.saved" metadata.attachmentType="permission_mode_change"` 1건 기록.
   - `metadata.isSidechain=true` 는 서브에이전트 세션 (`/agent Explore ...`) 돌렸을 때만 나타남.
4. 같은 턴을 두 번 재처리 (cursor 리셋 후) → 이벤트 중복 없음 (messageId 결정적).

### 수동 품질 체크
- `turn.metrics.durationMs` 가 Stop.ts 가 로그한 체감 턴 시간과 ±2초 이내 일치
- `permission_mode_change` 가 UI 에서 켤 때마다 하나씩만 나타남 (연속 중복 없음)

---

## Out of scope (Phase 3 후보)

- tool_result 에 `sourceToolAssistantUUID` 사후 주입 → 기존 tool 이벤트 metadata 업데이트 (idempotent PATCH API 필요)
- `last-prompt` fallback 수집 (UserPromptSubmit 훅 누락 관측 시)
- Inspector 에 thinking→tool_use→tool_result 사슬 시각화 (toolUseId + sourceToolAssistantUUID 기반)
- 전용 UI: turn.metrics 카드에 "cache hit ratio" 게이지, max_tokens 잘린 턴 경고 배지
- permission-mode 히스토리 패널 (세션 전체 타임라인에 수직 마커)
