# Event Classification Engine

Agent Tracer can display many events in an easy-to-read format on one screen because
all records are classified before storage. This classification is not just for coloring;
it forms the basis for lane placement, tag filtering, action-registry gap viewing, and connector interpretation.

## Core Files

- `packages/core/src/classifier.ts`
- `packages/core/src/action-registry.ts`
- `packages/core/src/domain.ts`
- `packages/server/src/application/services/event-recorder.ts`
- `packages/server/src/application/services/trace-metadata-factory.ts`

## Classification Inputs

`classifyEvent()` takes the following information as input:

- `kind`
- `title`, `body`
- `command`
- `toolName`
- `actionName`
- `filePaths`
- Explicit `lane`

This input is assembled by the server's `EventRecorder` just before event storage.

## Classification Order

1. Obtain canonical lane candidates from event kind.
2. Find action name-based matches using `action-registry`.
3. If the caller specified a lane, prioritize that.
4. Otherwise, determine in order: canonical lane, action match lane, default lane.
5. Combine matched tags with contextual tags created by `TraceMetadataFactory`.

In other words, the final lane is not determined solely by "kind defaults".
When there is explicit lane information, like with MCP manual calls, that information takes priority.

## Role of Action Registry

`action-registry.ts` infers meaning from snake_case action names like `inspect_current_state`
and `design_solution`.

What is obtained here:

- Lane hints
- Tags
- Match reasons and scores

Thanks to this structure, even generic endpoints like `monitor_plan`, `monitor_action`, `monitor_verify`, and `monitor_rule`
can be classified without losing much meaning.

## Connection with EventRecorder

The actual storage path can be read as follows:

1. `MonitorService` organizes inputs.
2. `EventRecorder.record()` calls `classifyEvent()`.
3. `TraceMetadataFactory` adds metadata-based tags such as relation, activity, verification state, and compact signal.
4. The completed classification and metadata are stored in SQLite.

## Strengths of the Current Structure

- Simple and predictable.
- Can use both explicit lane override and automatic classification together.
- Stores classification reasons and tags, enabling filtering and explanation in the UI.

## Current Considerations

### Does not enforce all richer phase semantics

`question.logged`, `todo.logged`, and `user.message` have canonical contracts in documentation,
but the classifier itself does not enforce the full meaning.

### Metadata interpretation is distributed

Lane is determined by core, but some tags are handled by `TraceMetadataFactory`, and view-specific
interpretation is handled by the web's `insights.ts`, so the semantic layer is split across multiple places.

### Derived file event noise control is necessary

`EventRecorder.recordWithDerivedFiles()` creates derived `file.changed` events,
but intentionally limits creation in exploration/background lanes.
Without knowing this policy, it's hard to understand why event counts are higher or lower than expected.

## Checklist When Changing Classification Rules

- Verify the impact of lane changes on dashboard colors, filters, and observability badge
- Verify that action-registry tags are useful for workflow search or insights
- Verify that no conflicts with MCP paths using explicit lane
- Verify that derived file event policy is not broken

## Related Documentation

- [Core Domain & Event Model](./core-domain-and-event-model.md)
- [Timeline Canvas](./timeline-canvas.md)
- [Event Inspector & Insights Engine](./event-inspector-and-insights-engine.md)
- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
