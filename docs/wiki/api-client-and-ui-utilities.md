# API Client & UI Utilities

Web's API calls, realtime parsing, search/evaluation helpers, and shared UI utilities are
gathered in a separate utility layer. Looking at this layer quickly reveals what server contracts
the dashboard expects.

## Core Files

- `packages/web-app/src/api.ts`
- `packages/web-app/src/types.ts`
- `packages/web-app/src/lib/realtime.ts`
- `packages/web-app/src/store/useWebSocket.ts`
- `packages/web-app/src/store/useSearch.ts`
- `packages/web-app/src/store/useEvaluation.ts`
- `packages/web-app/src/lib/ui/cn.ts`
- `packages/web-app/src/lib/ui/clipboard.ts`
- `packages/web-app/src/lib/ui/laneTheme.ts`

## What `api.ts` Provides

- Overview/tasks/task detail queries
- Bookmark CRUD
- Search
- Task title/status modification
- Event display title modification
- Finished task purge
- Task evaluation save/query
- Workflow library list query (`fetchWorkflowLibrary`)
- WebSocket URL generation

As of recent code, `TaskEvaluationRecord` and `WorkflowSummaryRecord`
now reuse `@monitor/core` types.

## Evolution of `types.ts` Role

Previously, the web defined types like `MonitoringTask` and `TimelineEvent` on its own, but
now core contracts are imported/exported from `@monitor/core`, with only web-exclusive
read models or search hit types kept separate.

This is also an important change from a documentation perspective. "Web type drift" is reduced
compared to before, and the remaining differences are now more toward view-model nature interfaces.

## Realtime Utilities

`lib/realtime.ts` provides:

- `MonitorRealtimeMessage` type
- `parseRealtimeMessage()`
- `refreshRealtimeMonitorData()` with per-message-type refresh strategies

`useWebSocket()` uses this type to pass parsed messages as callbacks instead of raw strings.

## UI Utilities

- `cn()` - class merge helper
- `copyToClipboard()` - clipboard utility for handoff/export
- `getLaneTheme()` - maintain lane color/style consistency
- `useTheme()` - light/dark theme toggle
- `useDragScroll()` - drag-scroll auxiliary for areas like timeline

## Related Documentation

- [Web Dashboard](./web-dashboard.md)
- [Task List & Global State](./task-list-and-global-state.md)
- [WebSocket Real-Time Broadcasting](./websocket-real-time-broadcasting.md)
