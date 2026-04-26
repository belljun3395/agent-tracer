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

The inspector currently exposes these tabs:

| Tab | Source |
|-----|--------|
| `Inspector` | Selected event details, evidence, relations, todos/questions tied to that event |
| `Overview` | Whole-task summaries: runtime session, model/token summary, task flow, signals, subagents, verification cycles |
| `Turns` | Server turn records plus editable turn partitions |
| `Exploration` | File evidence, file activity, and web lookup summaries |
| `Rules` | Active rules, rule matches, and links back into the timeline |
| `Context` | Context snapshots and context/model timeline details |

The timeline header also shows compact observability counters built in the web
client: action count, coordination count, explored-file count, verification
checks, violations, passes, and compaction count.

## Derived Client Helpers

Current UI derivation lives under `packages/web/src/app/lib/`:

| File | Role |
|------|------|
| `taskTimelineSummary.ts` | One entry point for explored files, compactions, observability counters, model summary, and rule decisions |
| `insights/aggregation.ts` | Aggregates timeline events into counts and file/web/compact summaries |
| `formatters.ts` | Shared format helpers such as `formatDuration`, `formatRate`, `formatCount`, and `formatPhaseLabel` |
| `ruleEnforcements.ts` | Helpers for displaying rule enforcement overlays |

`buildObservabilityStats()` currently counts:

- `action.logged` as actions
- `agent.activity.logged` as coordination activity
- explored files from the exploration/file aggregation pass
- `verification.logged` statuses as checks, passes, and violations
- `rule.logged` statuses as checks, passes, and violations
- compactions from compact-related timeline events

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
