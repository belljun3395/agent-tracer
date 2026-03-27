# Agent Thought-Flow Observability

이 문서는 현재 브랜치에서 추가된 task observability read model과 UI를 설명한다.

## UI Surface

- Top bar diagnostics cards
  - `Prompt Capture`
  - `Flow Coverage`
  - `Stale Running`
  - `Avg Duration`
- Runtime source chips
  - 런타임별 task 수, running task 수, prompt capture 비율, explicit flow coverage 비율
- Inspector `Flow` 탭
  - phase breakdown
  - total / active / waiting duration
  - sessions 요약
  - work items / goals / plans / handoffs
  - top files / top tags
- Inspector `Health` 탭
  - relation coverage
  - rule gap count
  - raw prompt / follow-up / question / todo / thought / tool / verification / coordination / background counts

## HTTP API

### `GET /api/tasks/:taskId/observability`

응답:

```json
{
  "observability": {
    "taskId": "task-123",
    "runtimeSource": "codex-cli",
    "totalDurationMs": 360000,
    "activeDurationMs": 210000,
    "waitingDurationMs": 150000,
    "totalEvents": 24,
    "explicitRelationCount": 6,
    "relationCoverageRate": 0.42,
    "ruleGapCount": 3,
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
      "ruleViolations": 1,
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
    "explicitFlowCoverageRate": 0.58,
    "tasksWithQuestions": 7,
    "tasksWithTodos": 6,
    "tasksWithCoordination": 5,
    "tasksWithBackground": 2,
    "runtimeSources": [
      {
        "runtimeSource": "codex-cli",
        "taskCount": 4,
        "runningTaskCount": 1,
        "promptCaptureRate": 1,
        "explicitFlowCoverageRate": 0.75
      }
    ]
  }
}
```

### `GET /api/overview`

기존 overview 응답에도 `observability` 스냅샷이 포함된다. 웹 top bar는 이 payload를 사용한다.

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
- `coordination`
  - `agent.activity.logged`
- `waiting`
  - raw user turn 이후 구간
  - 세션 사이 gap
  - 긴 idle gap

현재 구현은 90초 이상의 긴 gap을 `waiting`으로 간주한다.

## What This Is For

- 사용자가 task 하나를 열었을 때 “어디에 시간을 썼는지”를 빠르게 파악
- 유지보수자가 runtime별 prompt capture / explicit relation coverage / stale running task를 확인
- raw `/metrics`가 아니라 UI에 바로 맞는 JSON read model 제공

## Current Limits

- duration은 runtime 내부 stopwatch가 아니라 event timing 기반 추정치다.
- raw prompt capture는 해당 runtime adapter가 실제 prompt를 보내는 경우에만 정확하다.
- explicit flow coverage는 `parentEventId`, `relatedEventIds`, `relationType` 같은 trace metadata가 기록된 범위만 반영한다.
