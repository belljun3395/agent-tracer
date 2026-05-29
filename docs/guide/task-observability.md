# Task Timeline Observability

This page describes the current task read model and dashboard surfaces. The
server no longer exposes dedicated `/api/*/observability` endpoints; the web UI
derives most task observability from the task detail timeline returned by the
task query API.

## HTTP API

| API | Role |
|-----|------|
| `GET /api/v1/overview` | Dashboard summary stats |
| `GET /api/v1/tasks` | Task list |
| `GET /api/v1/tasks/:taskId` | Task detail, timeline, turns, and latest runtime session binding |
| `GET /api/v1/tasks/:taskId/openinference` | OpenInference-style export for a task timeline |
| `GET /api/v1/tasks/:taskId/rules` | Global + task-scoped rules active for a task |
| `GET /api/v1/tasks/:taskId/verdict-counts` | Turn verdict counts for a task |
| `GET /api/v1/tasks/:taskId/turn-partition` | Saved turn-group UI partition |
| `POST /api/v1/tasks/:taskId/turn-partition/reset` | Reset saved turn grouping |

`GET /api/v1/tasks/:taskId` is the primary dashboard payload. It returns:

```json
{
  "task": {
    "id": "task_01J...",
    "title": "Example task",
    "status": "running",
    "runtimeSource": "claude-plugin"
  },
  "timeline": [],
  "turns": [],
  "runtimeSessionId": "runtime-session-id",
  "runtimeSource": "claude-plugin"
}
```

The server stores normalized event details in SQLite, then the web app builds
its inspector summaries from the timeline array.

## UI Surface

The inspector right rail currently exposes these tabs:

| Tab | Source |
|-----|--------|
| `Inspect` | Selected event details, evidence, relations, todos/questions tied to that event |
| `Rules` | Active rules, rule matches, and links back into the timeline |
| `Trace` | Trace view of the task timeline |

`Overview` is a separate main-view toggle in the task header (feed/graph/overview),
not an inspector tab.

The task header also shows a compact metric strip (`MetricRail`) built in the
web client with three cells: `Active` (session wall-clock duration), `Compacts`
(compaction count), and `Context` (context-window utilisation).

## Derived Client Helpers

Current UI derivation lives under `packages/web/src/features/` and
`packages/web/src/domain/`, with shared helpers in `packages/web/src/lib/`:

| File | Role |
|------|------|
| `features/feed/MetricRail.tsx` | Derives the header metric strip (Active, Compacts, Context utilization) from the timeline |
| `domain/monitoring.ts` | Event-kind definitions (`action.logged`, `agent.activity.logged`, `verification.logged`, `rule.logged`, etc.) used across the feed |
| `features/feed/lib/format-time.ts` | Shared format helpers such as `formatDuration` |

The header metrics are derived in `MetricRail` from the timeline:

- `Active` — wall-clock duration since the task's session started
- `Compacts` — count of context-window compactions
- `Context` — most recent context-window utilisation, with a sparkline of the
  trajectory across the task

## Rule Lane Semantics

Rule lane display is driven by verification rules, not by a separate legacy
rule-command API. Active rules match incoming timeline events while a turn is
open. Matches write `rule_enforcements`, and the timeline repository overrides
matching events to lane `rule` at read time. See
[API integration map](./api-integration-map.md#verification-rules) and
[SQLite schema](./sqlite-schema.md#rule_enforcements--per-event-overlay).

## Current Limits

- Duration and phase summaries in the UI are derived from event timestamps, not
  runtime internal stopwatches.
- Raw prompt capture is only available when the runtime adapter sends the prompt.
- Rule lane coverage depends on active rules and turn association.
- Codex non-Bash tool activity is observed from rollout JSONL after Codex writes
  response items, so it is not pre-execution interception.
