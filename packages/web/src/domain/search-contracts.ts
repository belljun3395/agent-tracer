import type { TimelineLane, MonitoringEventKind } from "./monitoring.js";

/**
 * Search response shape mirrored from
 *   packages/server/src/activity/event/application/dto/search.events.usecase.dto.ts
 *
 * Two parallel arrays (task hits + event hits) come back from the server
 * already ordered by FTS rank. The client never re-sorts; we just split
 * the rendering into the two sections the user sees.
 */
export interface TaskSearchHit {
  readonly id: string;
  readonly taskId: string;
  readonly title: string;
  readonly workspacePath?: string;
  readonly status: "running" | "waiting" | "completed" | "errored";
  readonly updatedAt: string;
}

export interface EventSearchHit {
  readonly id: string;
  readonly eventId: string;
  readonly taskId: string;
  readonly taskTitle: string;
  readonly title: string;
  readonly snippet?: string;
  readonly lane: TimelineLane;
  readonly kind: MonitoringEventKind;
  readonly createdAt: string;
}

export interface SearchResponse {
  readonly tasks: readonly TaskSearchHit[];
  readonly events: readonly EventSearchHit[];
}
