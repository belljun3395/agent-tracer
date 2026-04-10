# Web & Core Tests

Web and core tests have a high proportion of fast unit tests.
In other words, complex domain calculations and view helpers are fixed first,
and large UI flows are verified relatively less.

## Core Tests

Key files:

- `packages/core/test/core.test.ts`
- `packages/core/test/runtime-capabilities.test.ts`
- `packages/core/test/rules-index.test.ts`

Verification targets:

- domain contract basic behavior
- runtime capability registry
- rule/action registry index

## Web Tests

Key files:

- `packages/web/src/App.test.ts`
- `packages/web/src/store/useWebSocket.test.ts`
- `packages/web/src/components/TaskList.test.ts`
- `packages/web/src/components/Timeline.follow.test.ts`
- `packages/web/src/lib/timeline.test.ts`
- `packages/web/src/lib/explorationCategory.test.ts`
- `packages/web/src/lib/eventSubtype.test.ts`
- `packages/web/src/lib/insights.test.ts`
- `packages/web/src/lib/realtime.test.ts`
- `packages/web/src/lib/ui/laneTheme.test.ts`

Verification targets:

- timeline follow/viewport calculation
- subtype/lane theme interpretation
- insights derived calculations
- realtime parsing and refresh logic
- websocket cleanup and reconnect helper logic

## Advantages of Current Test Strategy

- Pure functions and derived calculations can catch regressions relatively quickly.
- Good at small-scale verification of contract logic like runtime capability or realtime messages.

## Areas Worth Strengthening

- workflow library UI flow
- interactions between inspector tabs
- connection boundary between MCP registry contract and web read-model

## Related Documentation

- [Core Domain & Event Model](./core-domain-and-event-model.md)
- [Web Dashboard](./web-dashboard.md)
- [Timeline Canvas](./timeline-canvas.md)
