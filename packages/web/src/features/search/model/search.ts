import type { MonitoringEventKind, TimelineLane } from "~web/entities/task/model/timeline/event.js";

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

export function mergeSearchResults(
  tasks: readonly TaskSearchHit[],
  events: readonly EventSearchHit[],
): SearchResponse {
  const titleByTaskId = new Map(tasks.map((task) => [task.taskId, task.title] as const));
  return {
    tasks,
    events: events.map((event) =>
      event.taskTitle
        ? event
        : { ...event, taskTitle: titleByTaskId.get(event.taskId) ?? "" },
    ),
  };
}
