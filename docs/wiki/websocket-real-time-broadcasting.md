# WebSocket Real-Time Broadcasting

Agent Tracer broadcasts server changes via WebSocket, but
the web uses a strategy of re-querying needed read models rather than merging the payload directly into the store.
In other words, WebSocket is more like an "update signal" than a "canonical data stream".

## Core Files

- `packages/adapter-ws/src/event-broadcaster.ts`
- `packages/server/src/bootstrap/create-nestjs-monitor-runtime.ts`
- `packages/web-state/src/realtime/useMonitorSocket.ts`
- `packages/web-io/src/realtime.ts`
- `packages/web-state/src/server/queryKeys.ts`

## Server-Side Behavior

`EventBroadcaster` is an implementation of `INotificationPublisher`.
When a notification arrives, it sends a `{ type, payload }` JSON to all connected clients.

Right after connection, the current default bootstrap `create-nestjs-monitor-runtime.ts` sends the following snapshot first.

- `stats` (summary value seen in `/api/overview`)
- `tasks` (task list)

In other words, the initial connection is a snapshot, and subsequent ones are delta notifications.

## Current Message Types

Based on the web's `MonitorRealtimeMessage` type, the current events handled are as follows.

- `snapshot`
- `task.started`, `task.completed`, `task.updated`
- `task.deleted`
- `session.started`, `session.ended`
- `event.logged`, `event.updated`
- `bookmark.saved`, `bookmark.deleted`
- `tasks.purged`

In recent code, this type was explicitly moved up to `lib/realtime.ts`,
and `useWebSocket()` passes parsed typed messages to the callback instead of raw strings.

## Web-Side Processing Strategy

1. `useMonitorSocket()` parses the message.
2. It invalidates the relevant React Query keys by message type.
3. The dashboard re-fetches overview, selected task detail, or bookmarks as needed.

Characteristics:

- bookmark changes invalidate bookmark queries
- `event.updated` only invalidates the selected task detail query
- `task.deleted` removes the deleted task detail query and refreshes the task list/overview

In other words, the refresh strategy per message type is slightly more granular than before.

## Advantages

- Simple and safe.
- The web doesn't need to do much direct state patching even if the server payload structure changes.
- Debugging is easier since it's closer to re-querying the entire read model than incorrect merging.

## Limitations

- As events increase, the cost of re-querying grows.
- Even though there is already sufficient information in the WebSocket payload, it is not currently utilized much.
- Network costs accumulate due to the structure of constantly re-reading overview and selected task detail.

## Mid-Term Improvement Ideas

- Introduce incremental patching for task list/store
- Separate append/update paths for selected task timeline
- More precise updates to bookmark/evaluation/read model by message type

## Related Documentation

- [Web Dashboard](./web-dashboard.md)
- [Task List & Global State](./task-list-and-global-state.md)
- [API Client & UI Utilities](./api-client-and-ui-utilities.md)
