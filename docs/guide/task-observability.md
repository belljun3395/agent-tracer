# Agent Thought-Flow Observability

이 문서는 현재 브랜치에서 추가된 task observability read model과 UI를 설명한다.

## UI Surface

- Top bar diagnostics cards
  - `Prompt Capture`
  - `Linked Tasks`
  - `Stale Running`
  - `Avg Duration`
- Runtime source chips
  - 런타임별 task 수와 trace-linked task 비율
- Inspector `Flow` 탭
  - phase breakdown
  - total / active duration
  - sessions 요약
  - work items / goals / plans / handoffs
  - top files / top tags
- Inspector `Health` 탭
  - trace links / trace link coverage
  - action-registry gap count
  - raw prompt / follow-up / question / todo / thought / tool / verification / coordination / background counts

## HTTP API

### `GET /api/tasks/:taskId/observability`

응답:

```json
{
  "observability": {
    "taskId": "task-123",
    "runtimeSource": "claude-plugin",
    "totalDurationMs": 360000,
    "activeDurationMs": 210000,
    "totalEvents": 24,
    "traceLinkCount": 6,
    "traceLinkedEventCount": 8,
    "traceLinkEligibleEventCount": 14,
    "traceLinkCoverageRate": 0.57,
    "actionRegistryGapCount": 1,
    "actionRegistryEligibleEventCount": 5,
    "phaseBreakdown": [
      { "phase": "planning", "durationMs": 48000, "share": 0.13 }
    ],
    "sessions": {
      "total": 2,
      "resumed": 1,
      "open": 0
    },
    "signals": {
      "rawUserMessages": 1,
      "followUpMessages": 1,
      "questionsAsked": 2,
      "questionsClosed": 2,
      "questionClosureRate": 1,
      "todosAdded": 3,
      "todosCompleted": 2,
      "todoCompletionRate": 0.67,
      "thoughts": 2,
      "toolCalls": 5,
      "terminalCommands": 4,
      "verifications": 2,
      "coordinationActivities": 3,
      "backgroundTransitions": 1,
      "exploredFiles": 4
    },
    "focus": {
      "workItemIds": ["work-1"],
      "goalIds": ["goal-1"],
      "planIds": ["plan-1"],
      "handoffIds": ["handoff-1"],
      "topFiles": [{ "path": "src/app.ts", "count": 3 }],
      "topTags": [{ "tag": "planning", "count": 4 }]
    }
  }
}
```

### `GET /api/observability/overview`

응답:

```json
{
  "observability": {
    "generatedAt": "2026-03-27T00:00:00.000Z",
    "totalTasks": 12,
    "runningTasks": 3,
    "staleRunningTasks": 1,
    "avgDurationMs": 182000,
    "avgEventsPerTask": 19.4,
    "promptCaptureRate": 0.83,
    "traceLinkedTaskRate": 0.58,
    "tasksWithQuestions": 7,
    "tasksWithTodos": 6,
    "tasksWithCoordination": 5,
    "tasksWithBackground": 2,
    "runtimeSources": [
      {
        "runtimeSource": "claude-plugin",
        "taskCount": 4,
        "runningTaskCount": 1,
        "promptCaptureRate": 1,
        "traceLinkedTaskRate": 0.75
      }
    ]
  }
}
```

### `GET /api/overview`

기존 overview 응답에도 `observability` 스냅샷이 포함된다. 웹 top bar는 이 payload를 사용한다.

## Metric Semantics

- `traceLinkCount`
  - `parentEventId`, `relatedEventIds`, `sourceEventId` 로 복원된 explicit trace edge 수
  - `filePaths`로부터 생성된 derived `file.changed` 이벤트의 `sourceEventId`도 여기에 포함된다.
- `traceLinkedEventCount`
  - link-eligible 이벤트 중 실제 explicit trace link에 연결된 이벤트 수
- `traceLinkEligibleEventCount`
  - coverage 분모. 현재는 `plan.logged`, `action.logged`, `verification.logged`, `rule.logged`, `agent.activity.logged`, `file.changed` 만 포함한다.
- `traceLinkCoverageRate`
  - 전체 이벤트 대비 비율이 아니라, link-eligible 이벤트 중 실제 explicit trace link에 연결된 이벤트 비율
- `actionRegistryGapCount`
  - `plan.logged`, foreground `action.logged`, `verification.logged`, `rule.logged` 중 `action-registry` match가 없는 이벤트 수
  - WebSearch, MCP call, delegation 같은 coordination 이벤트나 background async lifecycle 이벤트는 여기에 포함하지 않는다.
- `actionRegistryEligibleEventCount`
  - `actionRegistryGapCount`의 분모. 현재는 gap 대상이 되는 action-like 이벤트 수만 센다.

## Phase Mapping

phase breakdown은 별도 stopwatch가 아니라 timeline event와 session window를 기반으로 추정한다.

- `planning`
  - `plan.logged`, `context.saved`, `thought.logged`, `question.logged` concluded, `todo.logged`, `task.start`
- `exploration`
  - `file.changed`, exploration lane activity
- `implementation`
  - `action.logged`, `tool.used`, `terminal.command` on implementation lane
- `verification`
  - `verification.logged`, `rule.logged`, `task.complete`, `task.error`
  - verification 관련 이벤트 종류를 별도 phase로 읽지만, 현재 core lane 집합에는 전용 `rules` lane이 없다
- `coordination`
  - `agent.activity.logged`, background lane activity

idle gap과 세션 사이 공백은 public phase breakdown에 직접 노출하지 않고,
`activeDurationMs` 계산에서 제외되는 비활성 시간으로만 사용한다.

## What This Is For

- 사용자가 task 하나를 열었을 때 “어디에 시간을 썼는지”를 빠르게 파악
- 유지보수자가 runtime별 prompt capture / trace-linked task 비율 / stale running task를 확인
- raw `/metrics`가 아니라 UI에 바로 맞는 JSON read model 제공

## UI Helper Functions

`packages/web/src/lib/observability.ts`에 UI 전용 포매팅 유틸이 있다.
이 함수들은 서버 응답의 숫자를 카드·표시용 문자열로 변환한다.

| 함수 | 입력 | 출력 예시 | 설명 |
|------|------|-----------|------|
| `formatDuration(ms)` | `number` (밀리초) | `"42ms"`, `"1.5s"`, `"1m 1s"`, `"2h 3m"` | ms → 사람이 읽기 쉬운 기간 |
| `formatRate(rate)` | `number` (0~1 또는 0~100) | `"87.5%"`, `"87%"` | 소수 또는 백분율 → `%` 문자열 |
| `formatCount(value)` | `number` | `"1,200"`, `"0"` | 정수 → 로케일 천 단위 구분 문자열 |
| `formatPhaseLabel(phase)` | `string` (snake/kebab-case) | `"Follow Up"`, `"Planning"` | snake/kebab-case → Title Case |

> `formatRate`는 `rate <= 1`이면 `× 100`해서 퍼센트로 표시한다.
> 비유한 값 (`Infinity`, `NaN`)은 모두 기본값(`"0ms"`, `"0%"`, `"0"`)으로 처리한다.

## Current Limits

- duration은 runtime 내부 stopwatch가 아니라 event timing 기반 추정치다.
- raw prompt capture는 해당 runtime adapter가 실제 prompt를 보내는 경우에만 정확하다.
- trace link coverage는 explicit relation metadata가 들어온 이벤트 집합에만 의미가 있다.
- action-registry gap count는 전체 trace 품질 점수가 아니라 action-name 분류 누락 탐지용 진단치다.
- idle/wait gap은 내부 active duration 계산에만 쓰고, 현재 UI/API의 phase 목록에는 노출하지 않는다.
