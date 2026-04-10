# Saving & Rating Workflows

Saving a task to the workflow library does not mean creating a separate export file, but rather
saving task evaluation and workflow content together to promote it to a reusable example.

## Information Saved

### Evaluation Metadata

- `rating`
- `useCase`
- `workflowTags`
- `outcomeNote`
- `approachNote`
- `reuseWhen`
- `watchouts`
- `evaluatedAt`

### Workflow Content

The server storage record also includes:

- `workflowSnapshot`
- `workflowContext`
- `searchText`

`searchText` is not a separate form field but is saved based on the search string from the snapshot.

## Save Paths

### Web

Saved through `TaskEvaluatePanel` in the `Evaluate` tab of `EventInspector`.

The web path is not just a simple note input screen.

1. Receives evaluation input values.
2. Auto-generates snapshot/context from timeline.
3. User can preview or edit fields to review and modify generated values.
4. Can revert to auto-generated values with `Regenerate`.
5. On save, sends evaluation + `workflowSnapshot` + `workflowContext` to `POST /api/tasks/:id/evaluate`.

### MCP / Agent

Manual saving is also possible via the `monitor_evaluate_task` tool.
Values directly passed in this path are primarily evaluation metadata.

- `rating`
- `useCase`
- `workflowTags`
- `outcomeNote`
- `approachNote`
- `reuseWhen`
- `watchouts`

If snapshot/context override is not sent, the server auto-generates and saves based on the current task timeline.

## `good` and `skip`

- `good`: Work worth revisiting next time
- `skip`: Kept in library but not prioritized in recommended examples

Sorting generally has `good` first, with latest `evaluatedAt` coming first within that.

## Where It Is Used After Saving

- `GET /api/workflows` list panel
- `GET /api/workflows/similar` similar example search
- `GET /api/workflows/:id/content` snapshot/context detail view
- Agent's workflow library search rules

## Criteria for Good Evaluation Notes

- `useCase` should be short and categorizable.
- `outcomeNote` should immediately show what was resolved.
- `approachNote` should explain why this approach worked.
- `reuseWhen` should indicate when to revisit next time.
- `watchouts` should be specific to avoid repeating the same mistakes.

## Related Documentation

- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
- [Searching Similar Workflows](./searching-similar-workflows.md)
