# Agent Thought-Flow Observability

This document describes the task observability read model and UI added in the current branch.

## UI Surface

- Top bar diagnostics cards
  - `Prompt Capture`
  - `Linked Tasks`
  - `Stale Running`
  - `Avg Duration`
- Runtime source chips
  - Task count per runtime and trace-linked task ratio
- Inspector `Flow` tab
  - Phase breakdown
  - Total / active duration
  - Sessions summary
  - Work items / goals / plans / handoffs
  - Top files / top tags
- Inspector `Health` tab
  - Trace links / trace link coverage
  - Action-registry gap count
  - Raw prompt / follow-up / question / todo / thought / tool / verification / coordination / background counts

## HTTP API

### `GET /api/tasks/:taskId/observability`

Response:

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

Response:

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

The existing overview response also includes an `observability` snapshot. The web top bar uses this payload.

## Metric Semantics

- `traceLinkCount`
  - Count of explicit trace edges recovered from `parentEventId`, `relatedEventIds`, `sourceEventId`
  - Also includes derived `file.changed` events' `sourceEventId` generated from `filePaths`.
- `traceLinkedEventCount`
  - Count of link-eligible events that are actually connected to explicit trace links
- `traceLinkEligibleEventCount`
  - Coverage denominator. Currently includes only `plan.logged`, `action.logged`, `verification.logged`, `rule.logged`, `agent.activity.logged`, `file.changed`.
- `traceLinkCoverageRate`
  - Not a ratio versus all events, but the ratio of link-eligible events actually connected to explicit trace links
- `actionRegistryGapCount`
  - Count of events in `plan.logged`, foreground `action.logged`, `verification.logged`, `rule.logged` without an `action-registry` match
  - Coordination events like WebSearch, MCP call, delegation, or background async lifecycle events are not included here.
- `actionRegistryEligibleEventCount`
  - Denominator for `actionRegistryGapCount`. Currently counts only action-like events that are gap targets.

## Phase Mapping

Phase breakdown is estimated based on timeline events and session windows, not a separate stopwatch.

- `planning`
  - `plan.logged`, `context.saved`, `thought.logged`, `question.logged` concluded, `todo.logged`, `task.start`
- `exploration`
  - `file.changed`, exploration lane activity
- `implementation`
  - `action.logged`, `tool.used`, `terminal.command` on implementation lane
- `verification`
  - `verification.logged`, `rule.logged`, `task.complete`, `task.error`
  - Verification-related event types are read as a separate phase, but currently the core lane set has no dedicated `rules` lane
- `coordination`
  - `agent.activity.logged`, background lane activity

Idle gaps and gaps between sessions are not directly exposed in the public phase breakdown,
but are used only as inactive time excluded from `activeDurationMs` calculations.

## What This Is For

- Quickly understand “where time was spent” when a user opens a single task
- Maintainers can check per-runtime prompt capture / trace-linked task ratio / stale running tasks
- Provides a JSON read model tailored directly to the UI, not just raw `/metrics`

## UI Helper Functions

UI-only formatting utilities are in `packages/web-app/src/lib/observability.ts`.
These functions convert numbers from server responses to card and display strings.

| Function | Input | Example Output | Description |
|----------|-------|-----------------|-------------|
| `formatDuration(ms)` | `number` (milliseconds) | `"42ms"`, `"1.5s"`, `"1m 1s"`, `"2h 3m"` | ms → human-readable duration |
| `formatRate(rate)` | `number` (0~1 or 0~100) | `"87.5%"`, `"87%"` | Decimal or percentage → `%` string |
| `formatCount(value)` | `number` | `"1,200"`, `"0"` | Integer → locale-aware thousand-separator string |
| `formatPhaseLabel(phase)` | `string` (snake/kebab-case) | `"Follow Up"`, `"Planning"` | snake/kebab-case → Title Case |

> `formatRate` multiplies by `× 100` when `rate <= 1` to display as percentage.
> Exceptional values (`Infinity`, `NaN`) are all handled with defaults (`"0ms"`, `"0%"`, `"0"`).

## Current Limits

- Duration is an estimate based on event timing, not a runtime internal stopwatch.
- Raw prompt capture is only accurate when the runtime adapter actually sends the prompt.
- Trace link coverage is meaningful only for event sets with explicit relation metadata.
- Action-registry gap count is a diagnostic tool for detecting missing action-name classifications, not an overall trace quality score.
- Idle/wait gaps are used only in internal active duration calculations and are not currently exposed in the UI/API phase list.
