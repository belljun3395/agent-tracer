# Library Signal Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 수집된 컨텍스트 신호(InstructionsLoaded, 캐시 효율, 파일 읽기 빈도)를 Library 아티팩트(ReusableTaskSnapshot, evaluate prompt)에 반영해 저장 품질을 높인다.

**Architecture:** 훅 레이어에서 새 이벤트를 수집하고, core 타입을 확장한 뒤, 웹 레이어에서 시각화와 Library 생성 로직을 개선한다. 각 레이어가 독립적으로 테스트 가능하도록 변경을 격리한다.

**Tech Stack:** TypeScript, tsx (hook scripts), NestJS (server), Zod (schema), React 19 (web), Vitest (test)

---

## 아티팩트 생성 흐름 (WHY / HOW)

두 "Save" 액션이 Library 아티팩트를 만드는 과정을 이해하면 어디를 바꿔야 하는지 명확해진다.

```
[세션 진행 중 — 실시간 수집]
  Claude Code plugin hooks (Stop, PostToolUse/Explore, ...)
  → POST /ingest/v1/events
  → SQLite timeline_events 테이블

[사용자가 Inspector > Actions 탭 열기]
  taskTimeline: TimelineEvent[]  (서버에서 로드)

  ┌── "Save to Library" (수동 폼) ─────────────────────────────────────────
  │
  │  buildReusableTaskSnapshot(timeline)          ← packages/core/src/workflow/snapshot.ts
  │    modifiedFiles  ← file.changed 이벤트 (writeCount > 0)
  │    keyFiles       ← tool.used 이벤트의 filePaths (등장 순서, 빈도 무관) ← 문제①
  │    keyDecisions   ← planning/implementation/coordination 레인 이벤트 상위 4개
  │    nextSteps      ← 미완료 todo + 미결 question
  │    outcomeSummary ← 마지막 assistant.response 텍스트
  │    originalRequest← 첫 번째 user.message body
  │    [없음]          ← instructions.loaded 이벤트 무시됨               ← 문제②
  │
  │  → TaskEvaluatePanel의 "Snapshot Preview"로 표시
  │  → 사용자가 rating, useCase, tags, outcome 등 6개 필드 수동 입력
  │  → onSave(TaskEvaluationPayload) → POST /api/evaluation → SQLite
  │
  └─────────────────────────────────────────────────────────────────────────

  ┌── "Save to Library via Claude" (MCP 경유) ─────────────────────────────
  │
  │  buildEvaluatePrompt(EvaluatePromptOptions)   ← packages/web-domain/.../handoff.ts
  │    사용함:   taskId, objective, summary, sections(최대 2개), modifiedFiles, violations
  │    무시함:   exploredFiles, openTodos, openQuestions, plans, snapshot    ← 문제③
  │    없음:     activeInstructions                                          ← 문제②
  │
  │  → 클립보드 복사 → 사용자가 Claude에 붙여넣기
  │  → Claude가 monitor_evaluate_task MCP 호출
  │  → SQLite evaluations 테이블 저장
  │
  └─────────────────────────────────────────────────────────────────────────
```

### 개선 후 흐름

| 문제 | 원인 | 이번 작업 |
|------|------|-----------|
| ①  keyFiles 품질 낮음 | 등장 순서만 봄, 빈도 무시 | `collectKeyFiles`에서 read 빈도 기반 정렬 |
| ②  CLAUDE.md 컨텍스트 보이지 않음 | `InstructionsLoaded` 훅 없음 | 훅 추가 → 이벤트 수집 → snapshot/prompt 반영 |
| ③  evaluate prompt 정보 부족 | 선언된 필드 6개를 실제로 미사용 | `buildEvaluatePrompt`에서 모든 필드 사용 |
| ④  캐시 데이터 숫자만 | 시각화 없음 | `CacheEfficiencyBar` 컴포넌트 추가 |

---

## 파일 맵

```
[새로 만드는 파일]
  .claude/plugin/hooks/InstructionsLoaded.ts
  packages/web/src/components/inspector/CacheEfficiencyBar.tsx

[수정하는 파일]
  .claude/plugin/hooks/hooks.json                           InstructionsLoaded 이벤트 등록
  packages/core/src/monitoring/types.ts                     "instructions.loaded" 이벤트 kind 추가
  packages/server/src/presentation/schemas.ingest.ts        INGEST_EVENT_KINDS에 추가
  packages/core/src/workflow/types.ts                       ReusableTaskSnapshot에 activeInstructions 추가
  packages/core/src/workflow/snapshot.ts                    keyFiles 빈도 정렬 + activeInstructions 추출
  packages/web-domain/src/lib/insights/handoff.ts           buildEvaluatePrompt 미사용 필드 반영
  packages/web/src/components/workflowPreview.ts            draft에 activeInstructions 추가
  packages/web/src/components/inspector/InspectorDetails.tsx CacheEfficiencyBar 사용
  packages/web/src/components/TaskEvaluatePanel.tsx          activeInstructions 미리보기 표시

[테스트 수정]
  packages/web/src/lib/insights.test.ts                     buildEvaluatePrompt 테스트
  packages/web/src/components/workflowPreview.test.ts       snapshot draft 라운드트립 테스트
```

---

## Task 1: core 타입에 `instructions.loaded` 이벤트 추가

**Files:**
- Modify: `packages/core/src/monitoring/types.ts:5`
- Modify: `packages/server/src/presentation/schemas.ingest.ts:12-26`

- [ ] **Step 1: 현재 타입 테스트 파악**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer
grep -n "MonitoringEventKind\|INGEST_EVENT_KINDS" packages/core/src/monitoring/types.ts packages/server/src/presentation/schemas.ingest.ts
```

Expected output: 두 파일 모두 현재 `"instructions.loaded"` 없음을 확인.

- [ ] **Step 2: core 타입 수정**

`packages/core/src/monitoring/types.ts` 5번째 줄의 `MonitoringEventKind` union에 `"instructions.loaded"` 추가:

```typescript
export type MonitoringEventKind =
  | "task.start" | "task.complete" | "task.error"
  | "plan.logged" | "action.logged" | "agent.activity.logged"
  | "verification.logged" | "rule.logged"
  | "tool.used" | "terminal.command" | "context.saved"
  | "file.changed" | "thought.logged" | "user.message"
  | "question.logged" | "todo.logged" | "assistant.response"
  | "instructions.loaded";
```

- [ ] **Step 3: 서버 ingest 스키마 수정**

`packages/server/src/presentation/schemas.ingest.ts`의 `INGEST_EVENT_KINDS` 배열에 추가:

```typescript
export const INGEST_EVENT_KINDS = [
    "tool.used",
    "terminal.command",
    "context.saved",
    "plan.logged",
    "action.logged",
    "verification.logged",
    "rule.logged",
    "agent.activity.logged",
    "user.message",
    "question.logged",
    "todo.logged",
    "thought.logged",
    "assistant.response",
    "instructions.loaded",  // ← 추가
] as const
```

- [ ] **Step 4: 빌드 확인**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer
npm run build --workspace=packages/core 2>&1 | tail -5
npm run build --workspace=packages/server 2>&1 | tail -5
```

Expected: `0 errors`.

- [ ] **Step 5: commit**

```bash
git add packages/core/src/monitoring/types.ts packages/server/src/presentation/schemas.ingest.ts
git commit -m "feat(core): add instructions.loaded event kind"
```

---

## Task 2: `InstructionsLoaded` 훅 스크립트 작성 + hooks.json 등록

**Files:**
- Create: `.claude/plugin/hooks/InstructionsLoaded.ts`
- Modify: `.claude/plugin/hooks/hooks.json`

훅 페이로드 스펙 (`load_reason` 필드):
- `session_start` — 세션 시작 시 로드
- `nested_traversal` — 하위 디렉터리 접근 시 지연 로드
- `path_glob_match` — 조건부 rules 매칭 시
- `include` — 다른 instruction 파일이 include할 때
- `compact` — context compaction 후 재로드

- [ ] **Step 1: hooks.json에 InstructionsLoaded 추가**

`.claude/plugin/hooks/hooks.json`에 다음 블록을 `"Stop"` 항목 앞에 삽입:

```json
"InstructionsLoaded": [
  {
    "hooks": [
      { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/bin/run-hook.sh InstructionsLoaded" }
    ]
  }
],
```

- [ ] **Step 2: InstructionsLoaded.ts 작성**

```typescript
/**
 * Claude Code Hook: InstructionsLoaded
 *
 * Fires when a CLAUDE.md or .claude/rules/*.md file is loaded into context.
 * Fires at session start (eagerly-loaded files) and lazily during the session.
 *
 * Stdin payload fields:
 *   session_id        string  — unique session identifier
 *   hook_event_name   string  — "InstructionsLoaded"
 *   file_path         string  — absolute path of the loaded instruction file
 *   memory_type       string  — "Project" | "User" | "Enterprise"
 *   load_reason       string  — "session_start" | "nested_traversal" | "path_glob_match" | "include" | "compact"
 *   cwd               string  — current working directory
 *   transcript_path   string  — path to the session transcript JSONL
 *   globs             string[]? — path glob patterns (for path_glob_match reason)
 *   trigger_file_path string?  — file that triggered lazy load
 *   parent_file_path  string?  — file that included this one
 *
 * NOTE: InstructionsLoaded has NO decision control. Cannot block or modify loading.
 * Use only for observability. Always exit 0.
 *
 * This handler posts an instructions.loaded event to the Agent Tracer monitor
 * so the dashboard can show which instruction files are active in the session.
 */
import * as path from "node:path";
import {
    getSessionId,
    hookLog,
    hookLogPayload,
    LANE,
    postJson,
    readStdinJson,
    relativeProjectPath,
    resolveEventSessionIds,
    toTrimmedString,
} from "./common.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("InstructionsLoaded", payload);
    const sessionId = getSessionId(payload);

    if (!sessionId) {
        hookLog("InstructionsLoaded", "skipped — no sessionId");
        return;
    }

    const filePath = toTrimmedString(payload.file_path);
    const loadReason = toTrimmedString(payload.load_reason) || "session_start";
    const memoryType = toTrimmedString(payload.memory_type) || "Project";

    if (!filePath) {
        hookLog("InstructionsLoaded", "skipped — no file_path");
        return;
    }

    const relPath = relativeProjectPath(filePath);
    const fileName = path.basename(filePath);

    // compact 재로드는 이미 알려진 파일의 재등록이므로 별도 레이블 사용
    const title = loadReason === "compact"
        ? `Instructions reloaded: ${fileName}`
        : `Instructions loaded: ${fileName}`;

    const ids = await resolveEventSessionIds(sessionId, undefined, undefined);

    await postJson("/ingest/v1/events", {
        events: [{
            kind: "instructions.loaded",
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            title,
            body: relPath,
            lane: LANE.planning,
            metadata: {
                filePath,
                relPath,
                loadReason,
                memoryType,
            },
        }],
    });

    hookLog("InstructionsLoaded", "posted", { relPath, loadReason, memoryType });
}

void main().catch((err: unknown) => {
    hookLog("InstructionsLoaded", "ERROR", { error: String(err) });
});
```

- [ ] **Step 3: 훅 스크립트 컴파일 확인**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer/.claude/plugin
npx tsx hooks/InstructionsLoaded.ts <<'EOF'
{}
EOF
```

Expected: stderr에 "skipped — no sessionId" 로그 출력, exit 0.

- [ ] **Step 4: commit**

```bash
git add .claude/plugin/hooks/InstructionsLoaded.ts .claude/plugin/hooks/hooks.json
git commit -m "feat(plugin): add InstructionsLoaded hook for instruction file tracking"
```

---

## Task 3: `ReusableTaskSnapshot`에 `activeInstructions` 추가

**Files:**
- Modify: `packages/core/src/workflow/types.ts:23-36`
- Modify: `packages/core/src/workflow/snapshot.ts`
- Modify: `packages/web/src/components/workflowPreview.ts`
- Modify: `packages/web/src/components/workflowPreview.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`packages/web/src/components/workflowPreview.test.ts`의 round-trip 테스트에 `activeInstructions` 추가:

```typescript
it("round-trips snapshot values through the editable draft shape", () => {
    const snapshot = {
        objective: "Workflow visibility improvement",
        originalRequest: "Show generated workflow content before saving.",
        outcomeSummary: "Users can inspect saved workflow content.",
        approachSummary: "Persist snapshot/context with evaluation rows.",
        reuseWhen: "workflow library feels opaque",
        watchItems: ["migration compatibility", "keep generated fallback"],
        keyDecisions: ["add workflow content route", "persist context override"],
        nextSteps: ["verify end-to-end"],
        keyFiles: ["packages/web/src/components/TaskEvaluatePanel.tsx"],
        modifiedFiles: ["packages/server/src/application/monitor-service.ts"],
        verificationSummary: "Checks: 2 (2 pass, 0 fail)",
        searchText: "workflow visibility improvement generated workflow content",
        activeInstructions: ["CLAUDE.md", ".claude/rules/typescript.md"],  // ← 추가
    } as const;
    expect(parseWorkflowSnapshotDraft(createWorkflowSnapshotDraft(snapshot))).toEqual(snapshot);
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer
npm run test --workspace=packages/web -- --reporter=verbose 2>&1 | grep -A5 "round-trips"
```

Expected: FAIL — `activeInstructions` 관련 타입 오류 또는 undefined mismatch.

- [ ] **Step 3: `ReusableTaskSnapshot` 타입에 필드 추가**

`packages/core/src/workflow/types.ts`:

```typescript
export interface ReusableTaskSnapshot {
    readonly objective: string;
    readonly originalRequest: string | null;
    readonly outcomeSummary: string | null;
    readonly approachSummary: string | null;
    readonly reuseWhen: string | null;
    readonly watchItems: readonly string[];
    readonly keyDecisions: readonly string[];
    readonly nextSteps: readonly string[];
    readonly keyFiles: readonly string[];
    readonly modifiedFiles: readonly string[];
    readonly verificationSummary: string | null;
    readonly searchText: string;
    readonly activeInstructions: readonly string[];  // ← 추가
}
```

- [ ] **Step 4: `buildReusableTaskSnapshot`에서 `activeInstructions` 추출**

`packages/core/src/workflow/snapshot.ts`의 `buildReusableTaskSnapshot` 함수에 추가:

`collectActiveInstructions` 함수 추가 (파일 하단, `uniqueStrings` 위):

```typescript
/**
 * Collects the relative paths of instruction files loaded during the session.
 * Sources instructions.loaded events; excludes compact reloads to avoid duplicates.
 */
function collectActiveInstructions(events: readonly TimelineEvent[]): readonly string[] {
    return uniqueStrings(
        events
            .filter((e) => e.kind === "instructions.loaded" && stringMetadata(e, "loadReason") !== "compact")
            .map((e) => stringMetadata(e, "relPath") ?? normalizeText(e.body ?? e.title))
            .filter((v): v is string => Boolean(v))
    );
}
```

`buildReusableTaskSnapshot` 함수 본문에 추가:

```typescript
export function buildReusableTaskSnapshot({ objective, events, evaluation }: BuildReusableTaskSnapshotInput): ReusableTaskSnapshot {
    const modifiedFiles = collectModifiedFiles(events);
    const keyFiles = collectKeyFiles(events, modifiedFiles);
    const { summary: verificationSummary, failures } = collectVerificationState(events);
    const decisionLines = collectDecisionLines(events);
    const nextSteps = collectNextSteps(events);
    const activeInstructions = collectActiveInstructions(events);  // ← 추가
    // ... 나머지 기존 코드 유지 ...
    return {
        // ... 기존 필드들 ...
        searchText,
        activeInstructions,  // ← 추가
    };
}
```

`buildSearchText`에도 `activeInstructions` 포함:

```typescript
function buildSearchText(input: {
    // ... 기존 필드들 ...
    readonly activeInstructions: readonly string[];  // ← 추가
}): string {
    return [
        input.objective,
        input.originalRequest,
        input.useCase,
        input.outcomeSummary,
        input.approachSummary,
        input.reuseWhen,
        input.workflowTags.join(" "),
        input.watchItems.join(" "),
        input.keyDecisions.join(" "),
        input.keyFiles.join(" "),
        input.activeInstructions.join(" "),  // ← 추가
    ]
    // ... 나머지 기존 코드 ...
}
```

- [ ] **Step 5: `WorkflowSnapshotDraft`와 변환 함수 수정**

`packages/web/src/components/workflowPreview.ts`:

```typescript
export interface WorkflowSnapshotDraft {
    readonly objective: string;
    readonly originalRequest: string;
    readonly outcomeSummary: string;
    readonly approachSummary: string;
    readonly reuseWhen: string;
    readonly watchItems: string;
    readonly keyDecisions: string;
    readonly nextSteps: string;
    readonly keyFiles: string;
    readonly modifiedFiles: string;
    readonly verificationSummary: string;
    readonly searchText: string;
    readonly activeInstructions: string;  // ← 추가 (줄바꿈 구분 문자열)
}

export function createWorkflowSnapshotDraft(snapshot: ReusableTaskSnapshot): WorkflowSnapshotDraft {
    return {
        // ... 기존 필드들 ...
        searchText: snapshot.searchText,
        activeInstructions: joinLines(snapshot.activeInstructions),  // ← 추가
    };
}

export function parseWorkflowSnapshotDraft(draft: WorkflowSnapshotDraft): ReusableTaskSnapshot {
    return {
        // ... 기존 필드들 ...
        searchText: normalizeText(draft.searchText) ?? "",
        activeInstructions: splitLines(draft.activeInstructions),  // ← 추가
    };
}
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer
npm run test --workspace=packages/web -- --reporter=verbose 2>&1 | grep -E "PASS|FAIL|round-trips"
```

Expected: PASS.

- [ ] **Step 7: commit**

```bash
git add packages/core/src/workflow/types.ts packages/core/src/workflow/snapshot.ts \
        packages/web/src/components/workflowPreview.ts packages/web/src/components/workflowPreview.test.ts
git commit -m "feat(core): add activeInstructions to ReusableTaskSnapshot"
```

---

## Task 4: `keyFiles`를 read 빈도 기반으로 정렬

**Files:**
- Modify: `packages/core/src/workflow/snapshot.ts` (`collectKeyFiles` 함수)

현재 문제: `collectKeyFiles`는 `tool.used` 이벤트에서 `filePaths`를 등장 순서대로 수집한다. 10번 읽힌 핵심 파일보다 1번 스치듯 참조된 파일이 앞에 올 수 있다.

개선: 각 파일 경로의 등장 횟수를 세서 내림차순 정렬 후 상위 8개를 keyFiles로 한다.

- [ ] **Step 1: 실패 테스트 작성**

`packages/core/` 패키지의 테스트 파일 위치 확인:

```bash
ls /Users/kimjongjun/Documents/Code/project/agent-tracer/packages/core/src/workflow/
```

테스트 파일이 없다면 `packages/core/src/workflow/snapshot.test.ts` 생성:

```typescript
import { describe, expect, it } from "vitest";
import { buildReusableTaskSnapshot } from "./snapshot.js";
import type { TimelineEvent } from "../monitoring/types.js";

function makeExploreEvent(filePath: string, createdAt: string): TimelineEvent {
    return {
        id: `evt-${filePath}-${createdAt}` as never,
        taskId: "task-1" as never,
        kind: "tool.used",
        lane: "exploration",
        title: `Read: ${filePath}`,
        metadata: { filePaths: [filePath] },
        classification: {} as never,
        createdAt,
    };
}

describe("collectKeyFiles — read frequency ordering", () => {
    it("sorts keyFiles by read frequency descending", () => {
        const events: TimelineEvent[] = [
            makeExploreEvent("rarely.ts", "2024-01-01T00:00:00Z"),
            makeExploreEvent("hot.ts", "2024-01-01T00:01:00Z"),
            makeExploreEvent("hot.ts", "2024-01-01T00:02:00Z"),
            makeExploreEvent("hot.ts", "2024-01-01T00:03:00Z"),
            makeExploreEvent("warm.ts", "2024-01-01T00:04:00Z"),
            makeExploreEvent("warm.ts", "2024-01-01T00:05:00Z"),
        ];
        const snapshot = buildReusableTaskSnapshot({ objective: "test", events });
        const keyFiles = [...snapshot.keyFiles];
        expect(keyFiles.indexOf("hot.ts")).toBeLessThan(keyFiles.indexOf("warm.ts"));
        expect(keyFiles.indexOf("warm.ts")).toBeLessThan(keyFiles.indexOf("rarely.ts"));
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer
npm run test --workspace=packages/core -- --reporter=verbose 2>&1 | grep -E "PASS|FAIL|frequency"
```

Expected: FAIL (현재 순서 기반이므로 정렬이 보장되지 않음).

- [ ] **Step 3: `collectKeyFiles` 빈도 정렬 구현**

`packages/core/src/workflow/snapshot.ts`의 `collectKeyFiles` 함수를 교체:

```typescript
/**
 * Merges changed files and referenced files into the key-file shortlist,
 * sorted by read frequency (most-referenced first).
 */
function collectKeyFiles(events: readonly TimelineEvent[], modifiedFiles: readonly string[]): readonly string[] {
    // 각 파일 경로의 등장 횟수 집계
    const frequency = new Map<string, number>();
    for (const event of events) {
        for (const fp of stringArrayMetadata(event, "filePaths")) {
            frequency.set(fp, (frequency.get(fp) ?? 0) + 1);
        }
    }

    const discovered = [...frequency.entries()]
        .sort((a, b) => b[1] - a[1])   // 빈도 내림차순
        .map(([fp]) => fp);

    return uniqueStrings([
        ...modifiedFiles,   // 수정 파일을 항상 상위에
        ...discovered,
    ]).slice(0, 8);
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer
npm run test --workspace=packages/core -- --reporter=verbose 2>&1 | grep -E "PASS|FAIL|frequency"
```

Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add packages/core/src/workflow/snapshot.ts packages/core/src/workflow/snapshot.test.ts
git commit -m "fix(core): sort keyFiles by read frequency instead of occurrence order"
```

---

## Task 5: `buildEvaluatePrompt`에서 미사용 필드 반영

**Files:**
- Modify: `packages/web-domain/src/lib/insights/handoff.ts` (`buildEvaluatePrompt` 함수)
- Modify: `packages/web/src/lib/insights.test.ts`

현재 `EvaluatePromptOptions`에는 `exploredFiles`, `openTodos`, `openQuestions`, `plans`, `snapshot`이 선언되어 있지만 `buildEvaluatePrompt` 함수에서 구조 분해조차 하지 않는다. Claude가 평가할 때 탐색한 파일 목록, 열린 TODO, 계획 내용을 전혀 보지 못한다.

- [ ] **Step 1: 실패 테스트 작성**

`packages/web/src/lib/insights.test.ts`의 `buildEvaluatePrompt` 섹션에 추가:

```typescript
it("includes exploredFiles in the prompt when provided", () => {
    const result = buildEvaluatePrompt(makeEvaluateOptions({
        exploredFiles: ["src/auth.ts", "src/session.ts"],
    }));
    expect(result).toContain("src/auth.ts");
    expect(result).toContain("src/session.ts");
});

it("includes openTodos in the prompt when provided", () => {
    const result = buildEvaluatePrompt(makeEvaluateOptions({
        openTodos: ["Write migration tests", "Update README"],
    }));
    expect(result).toContain("Write migration tests");
    expect(result).toContain("Update README");
});

it("includes plans in the prompt when provided", () => {
    const result = buildEvaluatePrompt(makeEvaluateOptions({
        plans: ["Step 1: analyze schema", "Step 2: write migration"],
    }));
    expect(result).toContain("Step 1: analyze schema");
});

it("includes activeInstructions in the prompt when provided", () => {
    const result = buildEvaluatePrompt(makeEvaluateOptions({
        activeInstructions: ["CLAUDE.md", ".claude/rules/typescript.md"],
    }));
    expect(result).toContain("CLAUDE.md");
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer
npm run test --workspace=packages/web -- --reporter=verbose 2>&1 | grep -E "exploredFiles|openTodos|plans|activeInstructions"
```

Expected: 4개 모두 FAIL.

- [ ] **Step 3: `EvaluatePromptOptions`에 `activeInstructions` 추가**

`packages/web-domain/src/lib/insights/handoff.ts`의 `EvaluatePromptOptions` 인터페이스:

```typescript
export interface EvaluatePromptOptions {
    readonly taskId: string;
    readonly objective: string;
    readonly summary: string;
    readonly sections: readonly TaskProcessSection[];
    readonly plans: readonly string[];
    readonly exploredFiles: readonly string[];
    readonly modifiedFiles: readonly string[];
    readonly openTodos: readonly string[];
    readonly openQuestions: readonly string[];
    readonly violations: readonly string[];
    readonly snapshot: ReusableTaskSnapshot;
    readonly activeInstructions: readonly string[];  // ← 추가
}
```

- [ ] **Step 4: `buildEvaluatePrompt` 수정**

```typescript
export function buildEvaluatePrompt(options: EvaluatePromptOptions): string {
    const {
        taskId, objective, summary, sections,
        modifiedFiles, violations,
        exploredFiles, openTodos, openQuestions, plans,
        activeInstructions,
    } = options;

    const parts: string[] = [KO_EVALUATE_INTRO];
    parts.push(`\n## Task Context`);
    if (objective) parts.push(`\n- Objective: ${objective}`);
    if (summary) parts.push(`\n- Summary: ${summary}`);

    if (sections.length > 0) {
        const items = sections.flatMap((s) => s.items.slice(0, 2).map((item) => `  - ${s.lane}: ${item}`));
        parts.push(`\n- Process:\n${items.join("\n")}`);
    }
    if (plans.length > 0) {
        parts.push(`\n- Plan steps:\n${plans.slice(0, 5).map((p) => `  - ${p}`).join("\n")}`);
    }
    if (modifiedFiles.length > 0) {
        parts.push(`\n- Modified files: ${modifiedFiles.slice(0, 6).join(", ")}`);
    }
    if (exploredFiles.length > 0) {
        parts.push(`\n- Key explored files: ${exploredFiles.slice(0, 8).join(", ")}`);
    }
    if (openTodos.length > 0) {
        parts.push(`\n- Open todos: ${openTodos.slice(0, 5).map((t) => `"${t}"`).join(", ")}`);
    }
    if (openQuestions.length > 0) {
        parts.push(`\n- Open questions: ${openQuestions.slice(0, 3).map((q) => `"${q}"`).join(", ")}`);
    }
    if (violations.length > 0) {
        parts.push(`\n- Watchouts: ${violations.slice(0, 4).join("; ")}`);
    }
    if (activeInstructions.length > 0) {
        parts.push(`\n- Active instruction files: ${activeInstructions.join(", ")}`);
    }

    parts.push(`\n## Instructions`);
    parts.push(KO_EVALUATE_INSTRUCTIONS_HEADER);
    parts.push(`- taskId: "${taskId}"`);
    parts.push(KO_EVALUATE_FIELD_RATING);
    parts.push(KO_EVALUATE_FIELD_USE_CASE);
    parts.push(KO_EVALUATE_FIELD_OUTCOME_NOTE);
    parts.push(KO_EVALUATE_FIELD_APPROACH_NOTE);
    parts.push(KO_EVALUATE_FIELD_REUSE_WHEN);
    parts.push(KO_EVALUATE_FIELD_WATCHOUTS);
    parts.push(KO_EVALUATE_FIELD_WORKFLOW_TAGS);
    parts.push(KO_EVALUATE_CALL_NOW);
    return parts.join("\n");
}
```

- [ ] **Step 5: `EvaluatePromptButton` 호출부에 `activeInstructions` 전달**

`packages/web/src/components/inspector/ActionsTab.tsx`의 `ActionsTabProps`에 추가:

```typescript
export interface ActionsTabProps {
    // ... 기존 필드들 ...
    readonly handoffActiveInstructions: readonly string[];  // ← 추가
}
```

`ActionsTab` 함수 시그니처와 `EvaluatePromptButton` 호출부:

```typescript
export function ActionsTab({
    // ... 기존 필드들 ...
    handoffActiveInstructions,
}: ActionsTabProps): React.JSX.Element {
    return (
        // ...
        <EvaluatePromptButton
            // ... 기존 props ...
            activeInstructions={handoffActiveInstructions}
        />
        // ...
    );
}
```

- [ ] **Step 6: `EventInspector.tsx`에서 `handoffActiveInstructions` 조립**

`packages/web/src/components/EventInspector.tsx`에서 다른 handoff 값들이 조립되는 위치(160-166번째 줄 근처)에 추가:

```typescript
const handoffActiveInstructions = useMemo(
    () => taskTimeline
        .filter((e) => e.kind === "instructions.loaded" &&
            e.metadata["loadReason"] !== "compact")
        .map((e) => String(e.metadata["relPath"] ?? e.body ?? e.title))
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i),  // dedupe
    [taskTimeline]
);
```

그리고 `ActionsTab`에 prop 전달:

```tsx
<ActionsTab
    // ... 기존 props ...
    handoffActiveInstructions={handoffActiveInstructions}
/>
```

- [ ] **Step 7: 테스트 통과 확인**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer
npm run test --workspace=packages/web -- --reporter=verbose 2>&1 | grep -E "PASS|FAIL|exploredFiles|openTodos|plans|activeInstructions"
```

Expected: 4개 모두 PASS.

- [ ] **Step 8: commit**

```bash
git add packages/web-domain/src/lib/insights/handoff.ts \
        packages/web/src/lib/insights.test.ts \
        packages/web/src/components/inspector/ActionsTab.tsx \
        packages/web/src/components/EventInspector.tsx
git commit -m "fix(web-domain): use all EvaluatePromptOptions fields in buildEvaluatePrompt"
```

---

## Task 6: 캐시 효율 시각화 컴포넌트

**Files:**
- Create: `packages/web/src/components/inspector/CacheEfficiencyBar.tsx`
- Modify: `packages/web/src/components/inspector/InspectorDetails.tsx`

현재 `InspectorDetails.tsx`는 `assistant.response` 이벤트에서 `cacheReadTokens`, `inputTokens` 등을 텍스트로 표시한다. `CacheEfficiencyBar`는 이를 시각적 bar로 교체한다.

- [ ] **Step 1: `CacheEfficiencyBar` 컴포넌트 작성**

`packages/web/src/components/inspector/CacheEfficiencyBar.tsx`:

```tsx
import type React from "react";
import { cn } from "../../lib/ui/cn.js";

interface CacheEfficiencyBarProps {
    readonly inputTokens: number;
    readonly cacheReadTokens: number;
    readonly cacheCreateTokens: number;
    readonly outputTokens: number;
}

/**
 * 하나의 assistant turn에서 토큰 사용을 시각화한다.
 *
 * inputTokens = cacheReadTokens + cacheCreateTokens + newInputTokens (3가지 합산)
 * - cacheRead    : 캐시에서 읽은 토큰 (비용 절감)
 * - cacheCreate  : 이번 턴에 캐시에 새로 기록된 토큰
 * - newInput     : 캐시 외 신규 입력 토큰
 * - output       : 생성된 출력 토큰
 */
export function CacheEfficiencyBar({
    inputTokens,
    cacheReadTokens,
    cacheCreateTokens,
    outputTokens,
}: CacheEfficiencyBarProps): React.JSX.Element {
    const newInput = Math.max(0, inputTokens - cacheReadTokens - cacheCreateTokens);
    const total = inputTokens + outputTokens;
    const hitRate = inputTokens > 0
        ? Math.round((cacheReadTokens / inputTokens) * 100)
        : 0;

    const pct = (n: number): string =>
        total > 0 ? `${((n / total) * 100).toFixed(1)}%` : "0%";

    return (
        <div className="flex flex-col gap-1.5">
            {/* Stacked bar */}
            <div className="flex h-3 overflow-hidden rounded-full bg-[var(--surface-2)]">
                {cacheReadTokens > 0 && (
                    <div
                        className="h-full bg-[var(--ok)]"
                        style={{ width: pct(cacheReadTokens) }}
                        title={`Cache read: ${cacheReadTokens.toLocaleString()} tokens`}
                    />
                )}
                {cacheCreateTokens > 0 && (
                    <div
                        className="h-full bg-[color-mix(in_srgb,var(--ok)_50%,var(--accent))]"
                        style={{ width: pct(cacheCreateTokens) }}
                        title={`Cache write: ${cacheCreateTokens.toLocaleString()} tokens`}
                    />
                )}
                {newInput > 0 && (
                    <div
                        className="h-full bg-[var(--accent)]"
                        style={{ width: pct(newInput) }}
                        title={`New input: ${newInput.toLocaleString()} tokens`}
                    />
                )}
                {outputTokens > 0 && (
                    <div
                        className="h-full bg-[var(--text-3)]"
                        style={{ width: pct(outputTokens) }}
                        title={`Output: ${outputTokens.toLocaleString()} tokens`}
                    />
                )}
            </div>

            {/* Legend + stats */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] text-[var(--text-3)]">
                <LegendItem color="bg-[var(--ok)]" label="Cache read" value={cacheReadTokens} />
                <LegendItem
                    color="bg-[color-mix(in_srgb,var(--ok)_50%,var(--accent))]"
                    label="Cache write"
                    value={cacheCreateTokens}
                />
                <LegendItem color="bg-[var(--accent)]" label="New input" value={newInput} />
                <LegendItem color="bg-[var(--text-3)]" label="Output" value={outputTokens} />
                <span className={cn(
                    "ml-auto font-semibold",
                    hitRate >= 70 ? "text-[var(--ok)]" :
                    hitRate >= 30 ? "text-[var(--warn)]" : "text-[var(--text-2)]"
                )}>
                    {hitRate}% cache hit
                </span>
            </div>
        </div>
    );
}

function LegendItem({ color, label, value }: {
    readonly color: string;
    readonly label: string;
    readonly value: number;
}): React.JSX.Element | null {
    if (value <= 0) return null;
    return (
        <span className="flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full shrink-0", color)} />
            {label}: {value.toLocaleString()}
        </span>
    );
}
```

- [ ] **Step 2: `InspectorDetails.tsx`에서 CacheEfficiencyBar 사용**

`packages/web/src/components/inspector/InspectorDetails.tsx`의 `assistant.response` 이벤트 처리 부분(206-216번째 줄)을 찾아, 토큰 숫자 텍스트 표시를 다음으로 교체:

```tsx
import { CacheEfficiencyBar } from "./CacheEfficiencyBar.js";

// assistant.response 이벤트 렌더링 내부:
const inputTokens = event.metadata["inputTokens"] as number | undefined;
const outputTokens = event.metadata["outputTokens"] as number | undefined;
const cacheReadTokens = event.metadata["cacheReadTokens"] as number | undefined;
const cacheCreateTokens = event.metadata["cacheCreateTokens"] as number | undefined;

{(inputTokens != null || outputTokens != null) && (
    <div className="flex flex-col gap-1">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]">
            Token Usage
        </span>
        <CacheEfficiencyBar
            inputTokens={inputTokens ?? 0}
            cacheReadTokens={cacheReadTokens ?? 0}
            cacheCreateTokens={cacheCreateTokens ?? 0}
            outputTokens={outputTokens ?? 0}
        />
    </div>
)}
```

- [ ] **Step 3: 빌드 확인**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer
npm run build --workspace=packages/web 2>&1 | tail -5
```

Expected: `0 errors`.

- [ ] **Step 4: commit**

```bash
git add packages/web/src/components/inspector/CacheEfficiencyBar.tsx \
        packages/web/src/components/inspector/InspectorDetails.tsx
git commit -m "feat(web): add CacheEfficiencyBar visualization for token cache usage"
```

---

## Task 7: `TaskEvaluatePanel`에서 `activeInstructions` 미리보기 표시

**Files:**
- Modify: `packages/web/src/components/TaskEvaluatePanel.tsx`

Save to Library 폼의 Snapshot Preview에 `activeInstructions`를 표시한다. 이렇게 하면 저장 전에 어떤 instruction 파일이 이 스냅샷의 컨텍스트에 있었는지 확인할 수 있다.

- [ ] **Step 1: Preview 모드에 `activeInstructions` 목록 추가**

`packages/web/src/components/TaskEvaluatePanel.tsx`의 Preview 섹션 (`workflowContentMode === "preview"`):

```tsx
{workflowContentMode === "preview" ? (
    <div className="flex flex-col gap-3">
        {/* ... 기존 필드들 ... */}
        <WorkflowPreviewList label="Modified files" items={parsedWorkflowSnapshot.modifiedFiles} />
        {/* ↓ 추가 */}
        <WorkflowPreviewList label="Active instructions" items={parsedWorkflowSnapshot.activeInstructions} />
        <WorkflowPreviewField label="Search text" value={parsedWorkflowSnapshot.searchText} mono />
        {/* ... */}
    </div>
) : (
    <div className="flex flex-col gap-3">
        {/* ... 기존 필드들 ... */}
        <div className={snapshotFieldClass}>
            <SectionLabel>Active instructions</SectionLabel>
            <Textarea
                className="resize-y"
                placeholder="One item per line"
                rows={3}
                value={workflowSnapshotDraft.activeInstructions}
                onChange={(event) => updateSnapshotField("activeInstructions", event.target.value)}
            />
        </div>
        {/* ... */}
    </div>
)}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer
npm run build --workspace=packages/web 2>&1 | tail -5
```

Expected: `0 errors`.

- [ ] **Step 3: 전체 테스트 통과 확인**

```bash
cd /Users/kimjongjun/Documents/Code/project/agent-tracer
npm run test 2>&1 | tail -15
```

Expected: 모든 suite PASS.

- [ ] **Step 4: commit**

```bash
git add packages/web/src/components/TaskEvaluatePanel.tsx
git commit -m "feat(web): show activeInstructions in Save to Library snapshot preview"
```

---

## Self-Review

### Spec coverage 체크

| 요구사항 | Task |
|---------|------|
| InstructionsLoaded 훅 추가 | Task 1, 2 |
| instructions.loaded 이벤트 → timeline 저장 | Task 1, 2 |
| keyFiles read 빈도 정렬 | Task 4 |
| buildEvaluatePrompt 미사용 필드 반영 | Task 5 |
| activeInstructions → snapshot 필드 | Task 3 |
| activeInstructions → evaluate prompt | Task 5 |
| 캐시 효율 시각화 | Task 6 |
| Save to Library 미리보기에 activeInstructions | Task 7 |

### 타입 일관성

- `ReusableTaskSnapshot.activeInstructions: readonly string[]` → Task 3에서 정의, Task 5·7에서 소비
- `WorkflowSnapshotDraft.activeInstructions: string` → Task 3에서 정의, `joinLines`/`splitLines`로 변환
- `EvaluatePromptOptions.activeInstructions: readonly string[]` → Task 5에서 추가
- `ActionsTabProps.handoffActiveInstructions: readonly string[]` → Task 5에서 추가

### 누락 항목

- `instructions.loaded` 이벤트를 타임라인에 표시하는 UI (Inspector timeline lane) — 현재 `LANE.planning`으로 포스팅되므로 기존 타임라인 렌더러가 자동으로 처리한다. 별도 추가 불필요.
- 서버 side에서 `instructions.loaded` 이벤트의 특별 처리 없음 — 기존 `ingestEventItemSchema`가 `kind` enum만 검사하므로 Task 1의 INGEST_EVENT_KINDS 추가만으로 충분하다.
