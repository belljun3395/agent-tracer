# API Client & UI Utilities

The web-facing adapter layer is split between `@monitor/web-io` and a
small set of UI helpers inside `@monitor/web-app`. Together they define
how the dashboard talks to the server and how shared UI behaviors stay
consistent.

## Core files

- `packages/web-io/src/api.ts`
- `packages/web-io/src/realtime.ts`
- `packages/web-io/src/websocket.ts`
- `packages/web-io/src/storage.ts`
- `packages/web-app/src/lib/ui/cn.ts`
- `packages/web-app/src/lib/ui/clipboard.ts`
- `packages/web-app/src/lib/ui/laneTheme.ts`
- `packages/web-app/src/lib/useTheme.ts`
- `packages/web-app/src/lib/useDragScroll.ts`

## What `web-io` provides

### HTTP API helpers

`packages/web-io/src/api.ts` wraps the monitor HTTP endpoints used by the
dashboard, including:

- overview/task/task-detail reads
- bookmark CRUD
- task deletion
- search
- workflow evaluation and saved items
- monitor WebSocket URL resolution

### Realtime message parsing

`packages/web-io/src/realtime.ts` defines the realtime message contract
and parses the raw socket payload into typed messages for `web-state`.

### Socket abstraction

`packages/web-io/src/websocket.ts` wraps browser WebSocket behavior in a
small evented adapter so the rest of the app does not directly manage raw
socket lifecycle details.

### Safe storage

`packages/web-io/src/storage.ts` wraps localStorage-like access so private
mode or storage failures do not blow up the UI.

## Shared UI utilities

- `cn()` merges class names
- `copyToClipboard()` wraps clipboard interactions
- `getLaneTheme()` keeps lane colors/styles consistent across the UI
- `useTheme()` manages light/dark theme preference
- `useDragScroll()` provides drag-to-scroll behavior for large surfaces

## Why this separation matters

- `web-io` stays React-free and handles failure-prone browser boundaries
- `web-state` can compose those adapters without duplicating transport
  code
- `web-app` stays focused on rendering and interaction

## Related documentation

- [Web Dashboard](./web-dashboard.md)
- [Task List & Global State](./task-list-and-global-state.md)
- [WebSocket Real-Time Broadcasting](./websocket-real-time-broadcasting.md)
