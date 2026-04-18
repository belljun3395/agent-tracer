# Web Dashboard

`@monitor/web-app` is Agent Tracer's read experience — a React 19 dashboard
that renders the task list, timeline, event inspector, and workflow
library in a single view. It combines WebSocket hints with REST read
models to keep the UI in sync.

## Key files

- `packages/web-app/src/App.tsx` — root composition, layout, search, panel state
- `packages/web-app/src/store/useMonitorStore.tsx` — reducer + fetch orchestration
- `packages/web-app/src/store/useWebSocket.ts` — socket reconnect + debounce
- `packages/web-app/src/store/useSearch.ts` — search state
- `packages/web-app/src/components/TaskList.tsx`
- `packages/web-app/src/components/Timeline.tsx`
- `packages/web-app/src/components/EventInspector.tsx`
- `packages/web-app/src/components/WorkflowLibraryPanel.tsx`
- `packages/web-app/src/components/TopBar.tsx`
- `packages/web-app/src/lib/insights.ts` — timeline-derived computations
- `packages/web-app/src/lib/timeline.ts` — layout + connector math
- `packages/web-app/src/lib/eventSubtype.ts` — semantic metadata consumer

## Layout

```text
src/
  App.tsx                     # root composition
  store/
    useMonitorStore.tsx       # global state + server fetch orchestration
    useWebSocket.ts           # socket reconnect + message debounce
    useSearch.ts              # search state
  components/
    TaskList.tsx              # left sidebar
    Timeline.tsx              # center canvas
    EventInspector.tsx        # right panel
    WorkflowLibraryPanel.tsx  # workflow library UI
    TopBar.tsx                # top diagnostics bar
  lib/
    insights.ts               # derived computations
    timeline.ts               # layout + connector math
    eventSubtype.ts           # semantic metadata consumer
```

## UI areas

### Task list

Left sidebar — lists tasks, status, and selection state.

### Timeline canvas

Center — lane cards, connectors, zoom, follow, observability badges.
Layout math lives in `lib/timeline.ts` and derived insights in
`lib/insights.ts`.

### Event inspector

Right panel — reorganises the selected event/task into readable
sections across the `Inspector`, `Flow`, `Health`, `Tags`, `Task`,
`Evaluate`, `Compact`, `Files`, and `Exploration` tabs. `Flow` and
`Health` consume `/api/tasks/:taskId/observability`.

### TopBar

Two different chip components coexist on the TopBar:

| Component | Data source | Purpose |
|-----------|-------------|---------|
| `TopBarMetricChip` | `GET /api/observability/overview` | Global diagnostics (prompt capture, linked tasks, stale running, avg duration) |
| `ObservabilityChip` | Selected task `ObservabilityBadgeCounts` | Per-task badges (exploration / planning / implementation counts) |

### Workflow library

A dedicated panel opened from the TopBar `Library` button. It calls
`GET /api/workflows` to browse saved evaluations.

## Data flow

1. `useMonitorStore` owns overview, tasks, task detail, and bookmarks.
2. `useWebSocket` receives typed `MonitorRealtimeMessage | null` values.
3. `refreshRealtimeMonitorData()` picks the right refresh path
   (overview / task detail / bookmark) per message type.
4. `App.tsx` derives insights and passes selection state downstream.

## Points worth knowing

### Workflow library is a first-class UI

It's no longer just a concept doc — `WorkflowLibraryPanel` is mounted
from the TopBar and reads `/api/workflows` directly.

### Types converge in `@monitor/core`

`packages/web-app/src/types.ts` re-exports `MonitoringTask`, `TimelineEvent`,
`TaskEvaluation`, and `WorkflowSummary` from `@monitor/core`. Web-only
view models still exist (search hits, UI-specific shapes) but the
core contract is shared.

### Semantic metadata is consumed through `eventSubtype`

`lib/eventSubtype.ts` is the single consumer of the `SemanticMetadata`
contract defined in `packages/core/src/interop/event-semantic.ts`. Components
and insights should go through it instead of reading raw `metadata`
keys.

### Realtime is message-aware

`useWebSocket()` produces typed messages. Bookmark / event / task
notifications each trigger different refresh paths.

### Observability read model powers TopBar + Inspector

`App.tsx` reads `/api/observability/overview` for the TopBar, and
`/api/tasks/:taskId/observability` on selection change to populate
the `Flow` and `Health` tabs.

## Strengths

- One app contains the full product experience — task list, timeline,
  inspector, and workflow library.
- Most derivation is centralised in `lib/insights.ts` and `lib/timeline.ts`.
- Tests exist for the derivation utilities.

## Maintenance notes

### Root component holds too much

`App.tsx` owns layout, WebSocket reaction, search, panel resize, local
storage, and selection routing. A reasonable split is
`useDashboardLayout`, `useResizablePanels`, `useSelectionState`,
`useRealtimeRefresh`.

### `useMonitorStore` bundles reducer + effects + fetch orchestration

Reducer, cache merge, initial load, URL hash sync, CRUD, and passive
refresh all live in one file. Splitting state reducer, async actions,
URL sync, and derived caches would make effects easier to trace.

### Two "mini applications"

`components/Timeline.tsx` and `components/EventInspector.tsx` each mix
view, filter, selection, edit, summary, and tab controls. Feature
additions are possible but review cost is climbing.

### `lib/insights.ts` is oversized

File statistics, compact analysis, tag insights, question/todo groups,
model summaries, and task extraction all share one file. Consider
splitting into `insights/observability`, `insights/files`,
`insights/compact`, `insights/questions`, `insights/todos`,
`insights/task-extraction`.

### WebSocket notifications aren't fully exploited

`useWebSocket.ts` debounces then re-fetches. The server already sends
typed notification payloads — a move to incremental updates would
remove redundant overview/detail round-trips at higher event rates.

### Style system is split

Tailwind classes coexist with `Timeline.css` and `legacy.css`. Font
imports live in several places. Picking a single source of truth for
visual changes would reduce edit scope.

## Reading order

1. `packages/web-app/src/App.tsx`
2. `packages/web-app/src/store/useMonitorStore.tsx`
3. `packages/web-app/src/components/Timeline.tsx`
4. `packages/web-app/src/components/EventInspector.tsx`
5. `packages/web-app/src/lib/insights.ts`
6. `packages/web-app/src/lib/timeline.ts`
7. `packages/web-app/src/lib/eventSubtype.ts`

## Related

- [Task List & Global State](./task-list-and-global-state.md)
- [Timeline Canvas](./timeline-canvas.md)
- [Event Inspector & Insights Engine](./event-inspector-and-insights-engine.md)
- [API Client & UI Utilities](./api-client-and-ui-utilities.md)
- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
