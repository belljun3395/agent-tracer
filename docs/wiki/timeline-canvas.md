# Timeline Canvas

The timeline canvas is the core visualization of Agent Tracer's UI.
It displays stored timeline events not as a simple list, but as a "spatial flow with lanes".

## Core Files

- `packages/web-app/src/components/Timeline.tsx`
- `packages/web-app/src/lib/timeline.ts`
- `packages/web-app/src/lib/eventSubtype.ts`
- `packages/web-app/src/components/Timeline.css`
- `packages/web-app/src/lib/ui/laneTheme.ts`

## What It Does

- Renders cards per base lane
- Expands lane rows based on subtype
- Calculates connectors and relation paths
- Displays timestamp ruler and relative time
- Supports zoom, filter, auto-follow, drag scroll
- Displays minimap and observability badge
- Provides task title/status editing UI

## Lane Structure

Core has 8 canonical lanes, but the canvas adds the subtype row concept on top.
In particular, `exploration`, `implementation`, and `coordination` can be further expanded
into more granular rows through `eventSubtype.ts`.

In other words, "8 lanes" in documentation and "more rows" on screen are not contradictory but at different layers.

## Layout Calculation

`lib/timeline.ts` is responsible for the following calculations:

- `buildTimelineLayout()`
- `buildTimestampTicks()`
- `buildTimelineConnectors()`
- `buildTimelineRelations()`
- `buildTimelineContextSummary()`

The reason UI components appear complex is that they handle not just rendering
but also significant domain calculations.

## Usability Features

- Auto-follow that tracks the right end in running tasks
- Follow reset after checking if selected event is valid when task changes
- Lane filter toggle
- Zoom slider integration
- Current viewport position confirmation in minimap
- Connector highlighting based on selection

## Current Code Reference Points

- Minimap and follow behavior are still tightly bound within the component.
- Timeline includes task status changes and title editing UI as well.
- Typed real-time messages have made refresh input clearer,
  but timeline itself still recalculates based on the entire refreshed task detail.

## Maintenance Perspective Risks

- Layout calculation and viewing logic are concentrated in the same file.
- Connector/path calculation cost can increase with more events.
- Subtype row, filter, selection, and follow states are all intertwined, making changes difficult.

## Related Documentation

- [Event Classification Engine](./event-classification-engine.md)
- [Event Inspector & Insights Engine](./event-inspector-and-insights-engine.md)
- [Web Dashboard](./web-dashboard.md)
