# SQLite Infrastructure & Schema

The actual storage path for Agent Tracer is `packages/server/src/infrastructure/sqlite`.
This directory includes schema, migration, repository implementation, and port composition.

## Core Files

- `packages/server/src/infrastructure/sqlite/index.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-schema.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-schema-migrator.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-task-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-session-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-event-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-runtime-binding-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-bookmark-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-evaluation-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-json.ts`

## Composition Method

`createSqliteMonitorPorts()` is the entry point for this layer.

- Creates DB directory.
- Opens `better-sqlite3` connection.
- Enables `journal_mode = WAL`.
- Sets `case_sensitive_like = OFF`.
- Executes schema creation and migration.
- Combines task/session/event/runtime-binding/bookmark/evaluation repositories and returns them.

## Main Tables

### `monitoring_tasks`

Stores task rows. Includes lineage and source fields such as `task_kind`, `parent_task_id`, `parent_session_id`,
`background_task_id`, `workspace_path`, and `cli_source`.

### `task_sessions`

Stores individual monitor sessions.

### `timeline_events`

Canonical storage for all events. Stores `metadata_json` and `classification_json`
as JSON strings and has a `task_id + created_at` index.

### `runtime_session_bindings`

Binds stable session IDs from external runtimes to monitor tasks/sessions.

### `bookmarks`

Stores task or event-based bookmarks.

### `task_evaluations`

Stores evaluations for the workflow library.
Currently manages not only `rating`, `use_case`, `workflow_tags`, and `outcome_note`,
but also `approach_note`, `reuse_when`, `watchouts`, `workflow_snapshot_json`, `workflow_context`, `search_text`, and `evaluated_at`.

## Role of Migration

`sqlite-schema-migrator.ts` gradually adds missing columns to existing databases.
Currently handles `cli_source`, `task_kind`, enrichment of parent/background lineage-related columns,
and runtime source backfill.

## Current Behavior of Evaluation Repository

`SqliteEvaluationRepository` supports multiple read paths for the workflow library.

- `getEvaluation(taskId)` - single task evaluation
- `getWorkflowContent(taskId)` - detail view of snapshot/context
- `listEvaluations(rating?)` - entire workflow library list
- `searchWorkflowLibrary(query, rating?, limit?)` - library list search
- `searchSimilarWorkflows(query, tags?, limit?)` - similar workflow search

`listEvaluations()` combines `task_evaluations`, `monitoring_tasks`, and `timeline_events`
to return a `WorkflowSummary` array that the web panel can render directly.

`getWorkflowContent()` prioritizes saved `workflowSnapshot`/`workflowContext` if available,
otherwise returns values regenerated from the timeline with `source: "saved" | "generated"`.

JSON string parsing in this context is unified via the common repository utility
`parseJsonField()` (`sqlite-json.ts`), making exception handling and type conversion consistent.

## Potential Cost Points

- Derived values like `displayTitle` are additionally computed in read paths.
- Workflow similarity search and workflow content detail reread all events per matched task
  to hydrate `workflowSnapshot`/`workflowContext`.
- Long-term, read model materialization may become necessary.

## Actual Path

The currently active storage path is `src/infrastructure/sqlite/*`.
When reading documentation, it's best to use this path as the reference.

## Related Documentation

- [Monitor Server](./monitor-server.md)
- [MonitorService: Application Layer](./monitorservice-application-layer.md)
- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
- [Saving & Rating Workflows](./saving-and-rating-workflows.md)
