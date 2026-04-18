# Workflow Library & Evaluation

The workflow library is a layer that enables Agent Tracer to function as a tool for "rediscovering good work practices".
The core is not just storing evaluation notes, but creating `Workflow Snapshot` and `Workflow Context` from task timelines
and leaving those results in a re-searchable form.

## Core Files

- `packages/domain/src/workflow/types.ts`
- `packages/domain/src/workflow/snapshot.ts`
- `packages/domain/src/workflow/context.ts`
- `packages/application/src/monitor-service.ts`
- `packages/application/src/ports/evaluation-repository.ts`
- `packages/adapter-sqlite/src/sqlite-evaluation-repository.ts`
- `packages/adapter-http-query/src/evaluation.controller.ts`
- `packages/adapter-http-ingest/src/evaluation-write.controller.ts`
- `packages/web-io/src/api.ts`
- `packages/web-app/src/components/TaskEvaluatePanel.tsx`
- `packages/web-app/src/components/workflowPreview.ts`
- `packages/web-app/src/components/knowledge/KnowledgeBaseContent.tsx`

## Data Model

### `WorkflowEvaluationData`

Common base for evaluation metadata.

- `useCase`
- `workflowTags`
- `outcomeNote`
- `approachNote`
- `reuseWhen`
- `watchouts`

### `ReusableTaskSnapshot`

A reusable task summary.
`buildReusableTaskSnapshot()` combines timeline events and evaluation data to create the fields below.

- `objective`
- `originalRequest`
- `outcomeSummary`
- `approachSummary`
- `reuseWhen`
- `watchItems`
- `keyDecisions`
- `nextSteps`
- `keyFiles`
- `modifiedFiles`
- `verificationSummary`
- `searchText`

### `TaskEvaluation` / Stored Record

The basic evaluation type `TaskEvaluation` contains:

- `taskId`
- `rating`
- `evaluatedAt`
- All fields from `WorkflowEvaluationData`

Server stored record (`StoredTaskEvaluation`) adds:

- `workflowSnapshot`
- `workflowContext`
- `searchText`

### `WorkflowSummary` / `WorkflowSearchResult` / `WorkflowContentRecord`

- `WorkflowSummary` is a type for library listing.
- `WorkflowSearchResult` is a type for similar search results and includes `workflowContext` markdown.
- `WorkflowContentRecord` is a type for full snapshot/context detailed view and includes `workflowSnapshot`, `workflowContext`, `searchText`, `source(saved|generated)`.

In other words, listings and search results are lightweight summary types, while full snapshot/context is queried via a separate content read path.

## Workflow Snapshot Generation Rules

`buildReusableTaskSnapshot()` in `packages/domain/src/workflow/snapshot.ts`
is the source of truth for generation rules.

### Inputs

- `objective`: Usually task title or derived `displayTitle`
- `events`: Full task timeline
- `evaluation`: Optional input. All or part of `WorkflowEvaluationData`

### Field Generation Method

- `originalRequest`
  `body` or `title` of first `user.message` event
- `outcomeSummary`
  Priority: `evaluation.outcomeNote`, then last `assistant.response`, else inferred from modified file count and verification summary
- `approachSummary`
  Priority: `evaluation.approachNote`, else top 2 decision lines extracted from planning/implementation/coordination events
- `reuseWhen`
  `evaluation.reuseWhen`
- `watchItems`
  `evaluation.watchouts` decomposed by line/delimiter + failed verification/rule titles
- `keyDecisions`
  Events from planning/implementation/coordination lanes converted to human-readable single-line descriptions, then deduplicated
- `nextSteps`
  Incomplete todo titles + not-yet-concluded question prompts
- `keyFiles`
  Modified files + `filePaths` from event metadata
- `modifiedFiles`
  Files from `file.changed` events with `writeCount > 0`
- `verificationSummary`
  `Checks: X (Y pass, Z fail)` summary based on verification/rule event counts
- `searchText`
  Search string created by combining objective, originalRequest, useCase, outcomeSummary, approachSummary, reuseWhen, tags, watchItems, keyDecisions, keyFiles

## Workflow Context Generation Rules

`buildWorkflowContext()` in `packages/domain/src/workflow/context.ts` is
the source of truth for markdown assembly.

Generation order is:

1. `# Workflow: <taskTitle>`
2. Snapshot-based sections
3. `## Plan`
4. Per-lane sections
5. `## Modified Files`
6. `## Open TODOs`
7. `## Verification Summary`

### Snapshot-based Sections

The following sections are included only when snapshot and evaluation have values:

- `## Original Request`
- `## Use Case`
- `## Outcome`
- `## What Worked`
- `## Reuse When`
- `## Key Decisions`
- `## Next Steps`
- `## Watchouts`
- `## Key Files`
- `## Verification Snapshot`

### Per-Lane Sections

Lanes currently included in workflow context are fixed in the following order:

- `Exploration`
- `Implementation`
- `Questions`
- `TODOs`
- `Background`
- `Coordination`

`planning` is separated into its own `## Plan` section, and the `user` lane is not re-included in lane summaries.

Also, `context.saved`, `terminal.command`, generic titles (`action logged`, `tool used`, etc.) prioritize detail over title
to make the context markdown appear less verbose.

## Generation and Storage Flow

### Web

`TaskEvaluatePanel` receives a selected task timeline and operates in the following flow:

1. Creates `WorkflowEvaluationData` from evaluation input.
2. Auto-generates snapshot with `buildReusableTaskSnapshot()`.
3. Auto-generates context markdown with `buildWorkflowContext()`.
4. User can modify snapshot and context via Preview/Edit fields/Regenerate.
5. On save, sends evaluation metadata, `workflowSnapshot`, and `workflowContext` to `POST /api/tasks/:id/evaluate`.

`workflowPreview.ts` is a helper utility that converts snapshot draft to a string for textarea editing and parses it back to `ReusableTaskSnapshot`.

### Server

`MonitorService.upsertTaskEvaluation()` saves by the following rules:

- Reads task and events.
- If `deriveTaskDisplayTitle()` exists, uses it as workflow title instead of original title.
- If request lacks `workflowSnapshot`, server generates it.
- If request lacks `workflowContext` or is empty string, server generates it.
- On save, records `searchText` based on `snapshot.searchText`.

### Relationship Between Saved and Generated

`SqliteEvaluationRepository.getWorkflowContent()` prioritizes using stored snapshot/context if available.
Otherwise returns re-generated value from current timeline.
So the knowledge/library detail view exposes `source: "saved" | "generated"` together.

## Server Endpoints

- `POST /api/tasks/:id/evaluate`
- `GET /api/tasks/:id/evaluate`
- `GET /api/workflows`
- `GET /api/workflows/similar`
- `GET /api/workflows/:id/content`

`/api/workflows/similar` returns search results with `workflowContext`.
Full snapshot/context detail is handled by `/api/workflows/:id/content`.

## Web Features

### `TaskEvaluatePanel`

- Evaluation metadata input
- Auto-generate snapshot/context
- Preview / Edit fields / Regenerate
- Final save

### `KnowledgeBaseContent`

- Query library listings
- Search/filter saved snapshots and playbooks
- Open detailed snapshot/context view for a saved workflow
- Promote saved workflow content into a playbook

## Current Risks

- Workflow content queries and similar search result hydration still involve read-heavy paths that re-read all events.
- Lexical search is sensitive to quality of `title`, `useCase`, `workflowTags`, `outcomeNote`, `approachNote`, `reuseWhen`, `watchouts`, `searchText`.
- Semantic ranking is only enabled when embedding service is available; fails over safely to lexical search.
- Generation quality is directly affected by timeline title/body/metadata quality.

## Related Documentation

- [Saving & Rating Workflows](./saving-and-rating-workflows.md)
- [Searching Similar Workflows](./searching-similar-workflows.md)
- [SQLite Infrastructure & Schema](./sqlite-infrastructure-and-schema.md)
