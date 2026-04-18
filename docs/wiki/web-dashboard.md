# Web Dashboard

`@monitor/web-app` is the dashboard composition layer for Agent Tracer.
It renders the task list, timeline, inspector, task workspace, and
knowledge/playbook views. The app no longer owns a monolithic
`useMonitorStore`; state is split across `@monitor/web-state`,
`@monitor/web-io`, and `@monitor/web-domain`.

## Key files

- `packages/web-app/src/App.tsx`
- `packages/web-app/src/main.tsx`
- `packages/web-app/src/components/TaskList.tsx`
- `packages/web-app/src/components/TimelineContainer.tsx`
- `packages/web-app/src/components/InspectorContainer.tsx`
- `packages/web-app/src/components/NavigationSidebar.tsx`
- `packages/web-app/src/components/TopBar.tsx`
- `packages/web-app/src/components/knowledge/KnowledgeBaseContent.tsx`
- `packages/web-app/src/features/task-workspace/*`
- `packages/web-app/src/features/timeline/*`
- `packages/web-state/src/index.ts`

## Layout

```text
web-app/
  App.tsx                         # routing + dashboard composition
  components/                     # reusable dashboard pieces
  features/
    task-workspace/*              # focused task workspace flow
    timeline/*                    # lane rows, overlays, popovers, minimap
  routes/task/TaskRoute.tsx       # route-scoped task selection

web-state/
  query/*                         # React Query provider and client
  server/*                        # data queries
  realtime/*                      # WebSocket invalidation hook
  ui/*                            # selection/edit stores
  useSearch.ts                    # debounced search flow
```

## Main UI areas

### Navigation and task list

`NavigationSidebar` and `TaskList` provide task selection, saved-item
navigation, and search entry points.

### Timeline

`TimelineContainer` hosts the main timeline canvas. The detailed lane and
overlay logic lives in `packages/web-app/src/features/timeline/*`.

### Inspector

`InspectorContainer` and the `components/inspector/*` subtree render the
selected task/event detail, including observability, evidence, question,
todo, and action views.

### Task workspace

`packages/web-app/src/features/task-workspace/*` provides the focused
workspace mode used when drilling into a task.

### Knowledge / playbooks

`packages/web-app/src/components/knowledge/*` renders saved workflow
artifacts, playbook detail, and snapshot views.

## Data flow

1. `QueryProvider` supplies the shared React Query client.
2. `UiStoreProvider` supplies the per-mount selection/edit Zustand
   stores.
3. `useOverviewQuery`, `useTasksQuery`, `useTaskDetailQuery`, and
   `useBookmarksQuery` fetch server data.
4. `useMonitorSocket()` listens to the WebSocket stream and invalidates
   the right query keys.
5. `App.tsx` composes the fetched data with UI selection and layout
   state.

## Points worth knowing

### Server state and UI state are separate now

Server data lives in React Query. Selection/edit state lives in the
local UI-store bundle from `@monitor/web-state`.

### Search is a dedicated hook

`useSearch()` in `@monitor/web-state` manages the debounced search flow
instead of mixing that logic into a global store.

### The app has multiple operating modes

The dashboard can be in timeline, knowledge, or workspace mode, and the
route layer can deep-link directly into a task.

### Web packages stay server-agnostic

The dashboard depends on `web-state`, `web-io`, `web-domain`, and
`domain`. It should not import `application`, server internals, or
adapter packages directly.

## Maintenance notes

### `App.tsx` still carries a lot of composition work

The app root owns routing, layout state, zoom, stacked/mobile behavior,
socket connection state, and some selection wiring. It is better than the
old single-store design, but still a high-change surface.

### Timeline and inspector remain large feature areas

The feature split is better than before, but `timeline/*` and
`components/inspector/*` are still where review cost accumulates fastest.

### Query invalidation is simple, not minimal

The socket path invalidates queries by message type. That keeps the code
easy to reason about, but it means the UI often re-fetches more than the
exact changed entity.

## Reading order

1. `packages/web-app/src/App.tsx`
2. `packages/web-state/src/index.ts`
3. `packages/web-state/src/server/queries.ts`
4. `packages/web-state/src/realtime/useMonitorSocket.ts`
5. `packages/web-app/src/features/timeline/*`
6. `packages/web-app/src/components/inspector/*`

## Related

- [Task List & Global State](./task-list-and-global-state.md)
- [Timeline Canvas](./timeline-canvas.md)
- [Event Inspector & Insights Engine](./event-inspector-and-insights-engine.md)
- [API Client & UI Utilities](./api-client-and-ui-utilities.md)
- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
