# Task List & Global State

Task selection, bookmark state, URL hash sync, and overview fetch orchestration are currently
managed in a `useMonitorStore`-centered global state layer. This layer is not just a simple reducer,
but rather a "dashboard read model coordinator".

## Core Files

- `packages/web/src/store/useMonitorStore.tsx`
- `packages/web/src/components/TaskList.tsx`
- `packages/web/src/components/TopBar.tsx`
- `packages/web/src/store/useSearch.ts`
- `packages/web/src/store/useWebSocket.ts`

## What `useMonitorStore` Holds

- `tasks`, `bookmarks`, `overview`
- `selectedTaskId`, `selectedEventId`, `selectedConnectorKey`
- `selectedRuleId`, `selectedTag`, `showRuleGapsOnly`
- `taskDetail`
- `isConnected`, `status`, `errorMessage`
- Task title/status editing state
- `taskDisplayTitleCache`

In other words, list state, detail state, and some UI editing state all exist in one provider.

## Key Actions and Flows

### Initial Load

Loads overview, tasks, bookmarks, and reflects task ID from URL hash to selection state.

### Task Selection

When selected task changes, detail is fetched and timeline/inspector are recalculated accordingly.

### Bookmark Refresh

Due to recent real-time processing changes, bookmark messages are refreshed separately via `refreshBookmarksOnly()`.
This separates event/task update path and bookmark update path somewhat.

### Title/Status Editing

Task title submit and status change are handled via store action + API call.
`taskDisplayTitleCache` maintains display title derived values without recalculation.

## Connection with TopBar

TopBar is not just a header but has the following features:

- Search query input
- Task-scope search toggle
- Zoom slider
- Workflow library opening
- WebSocket connection status display

In other words, the interface between global state and UI control is quite substantial.

## Strengths of Current Structure

- Dashboard state is centralized in one place, making it easy to track.
- Task selection, hash sync, and refresh orchestration are not dispersed.

## Limitations of Current Structure

- Reducer, effect, async fetch, hash sync, and optimistic UI are coupled in one provider.
- Selection/UI state and server-state nature data are mixed.
- Further feature expansion will require feature-unit decomposition.

## Related Documentation

- [Web Dashboard](./web-dashboard.md)
- [API Client & UI Utilities](./api-client-and-ui-utilities.md)
- [Timeline Canvas](./timeline-canvas.md)
