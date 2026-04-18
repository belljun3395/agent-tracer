# Event Inspector & Insights Engine

The Event Inspector is a panel that reconstructs the selected event or task into "human-readable descriptions".
Since it would be difficult to understand if only raw timeline events are listed, this area creates a significant portion of actual product value.

## Core Files

- `packages/web-app/src/components/EventInspector.tsx`
- `packages/web-app/src/lib/insights.ts`
- `packages/server/src/application/observability.ts`
- `packages/web-app/src/store/useEvaluation.ts`
- `packages/web-app/src/components/TaskEvaluatePanel.tsx`
- `packages/web-app/src/components/TaskHandoffPanel.tsx`

## Tab Structure

- `Inspector`
- `Flow`
- `Health`
- `Tags`
- `Task`
- `Evaluate`
- `Compact`
- `Files`
- `Exploration`

In other words, this panel contains not just single event details, but also task-level summaries, observability diagnostics,
and workflow evaluation capabilities.

### Exploration Tab Structure

The `Exploration` tab is internally composed of 4 sections.

| Section | Component | Content |
|---------|-----------|---------|
| Overview | `ExplorationInsightCard` | Total Explorations, Unique Files, Web Lookups count + Tool Breakdown |
| Web Lookups | `WebLookupsCard` | WebSearch/WebFetch query/URL list (toolName, count, last lookup time) |
| Explored Files | `DetailExploredFiles` | List of file paths read by the agent (includes sort and compact relationships) |
| Mentioned Files | `MentionedFilesVerificationCard` | Verification of existence of files mentioned in assistant response |

## What `insights.ts` Does

`insights.ts` currently has many derived calculations.

- observability stats
- explored files / file activity
- **web lookups** (`collectWebLookups()` → `WebLookupStat[]`)
- compact insight
- task extraction
- display title inference
- question/todo grouping
- tag insight
- verification summary
- model summary
- handoff markdown / XML / system prompt generation

In fact, it is more like an "inspector-only analytics engine".

### Web Lookups Collection

The `collectWebLookups(timeline)` function extracts events with `metadata.webUrls` array from the exploration lane and aggregates them by URL.

```ts
interface WebLookupStat {
  url: string;            // search query or URL
  toolName: string;       // "WebSearch" | "WebFetch"
  count: number;          // number of times the URL was looked up
  firstSeenAt: string;    // ISO timestamp
  lastSeenAt: string;     // ISO timestamp
}
```

The `ExplorationInsight` also adds a `uniqueWebLookups: number` field displayed in the Overview card.

## Recent Code Reference Points

### Evaluation hook became null-safe

`useEvaluation(taskId)` now accepts `null | undefined`,
and initializes safely without empty ID calls when no task is selected.

### Evaluation UI and library UI are separated

Task-internal evaluation is handled by `TaskEvaluatePanel`, while library-wide exploration is handled by `WorkflowLibraryPanel`.
The roles are now clearer.

### Core type reuse increased

Since the web imports `TaskEvaluation`, `WorkflowSummary`, and `TimelineEvent` directly from `@monitor/core`,
the distance between the data shape that the inspector reads and the server contract has narrowed.

### Task observability read model attached

`EventInspector` now reads `/api/tasks/:taskId/observability` for the selected task,
and renders phase breakdown, trace links, action-registry gaps, and prompt/question/todo signals
in separate `Flow` / `Health` tabs.

## Why This Panel is Good

- Converts raw metadata into human-readable sentences and groups.
- High-value features like task handoff and workflow evaluation connect naturally.
- Goes beyond simple debugging to explain "what this task actually did".

## Current Risks

- UI and derived analytics are still tightly coupled.
- `insights.ts` has too many responsibilities.
- Metadata key interpretation is spread across multiple functions and components, making it vulnerable to event contract changes.

## Related Documentation

- [Timeline Canvas](./timeline-canvas.md)
- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
- [API Client & UI Utilities](./api-client-and-ui-utilities.md)
