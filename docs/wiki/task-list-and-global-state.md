# Task List & Global State

The dashboard no longer revolves around a single `useMonitorStore`.
Current state is intentionally split into three concerns:

1. server state via React Query
2. ephemeral UI state via per-mount Zustand stores
3. realtime invalidation via the WebSocket hook

That split lives in `@monitor/web-state`.

## Core files

- `packages/web-state/src/query/QueryProvider.tsx`
- `packages/web-state/src/server/queries.ts`
- `packages/web-state/src/server/queryKeys.ts`
- `packages/web-state/src/ui/UiStoreProvider.tsx`
- `packages/web-state/src/ui/createUiStore.ts`
- `packages/web-state/src/realtime/useMonitorSocket.ts`
- `packages/web-state/src/useSearch.ts`
- `packages/web-app/src/components/TaskList.tsx`
- `packages/web-app/src/components/TopBar.tsx`

## What lives where

### React Query state

Query hooks own:

- overview
- task list
- task detail
- bookmarks
- task observability

These values are fetched through `@monitor/web-io` and keyed by
`monitorQueryKeys`.

### UI stores

`UiStoreProvider` owns a bundle of Zustand stores:

- selection store
- edit store

Selection includes things like the selected task, selected event, active
connector, connection state, and delete/edit UI flags. The provider
creates a fresh bundle per mount, which avoids module-scope singleton
state leaking across tests.

### Search flow

`useSearch()` manages debounced search text, task scoping, loading/error
state, and the search results payload.

### Realtime invalidation

`useMonitorSocket()` listens to WebSocket messages and invalidates the
right query keys based on the message type.

## Main flows

### Initial load

`QueryProvider` mounts the client; query hooks fetch the overview, task
list, and bookmarks on demand.

### Task selection

The selection store tracks the current task/event. When the selected task
changes, `useTaskDetailQuery()` and observability queries fetch the
detail view.

### Socket updates

The WebSocket hook invalidates:

- overview/tasks on task lifecycle changes
- task detail on event changes for the selected task
- bookmarks on bookmark changes

### Search scope

The search hook can optionally scope to the current task before calling
the server search endpoint.

## Strengths of the current structure

- Server data and UI state are clearly separated
- Tests can mount isolated UI stores without shared global state
- Search and realtime logic are decoupled from the app root

## Limitations of the current structure

- Selection wiring still passes through `App.tsx`
- Some connection/error flags still live in the selection store because
  the UI needs immediate access to them
- Query invalidation is coarse-grained rather than patch-based

## Related documentation

- [Web Dashboard](./web-dashboard.md)
- [API Client & UI Utilities](./api-client-and-ui-utilities.md)
- [Timeline Canvas](./timeline-canvas.md)
