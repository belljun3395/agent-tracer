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

/** 태스크·이벤트 검색 응답에 접혀 들어오는 메모 조회 결과이며, hitType은 메모 히트에만 있다. */
export interface MemoSearchHit {
  readonly hitType: "memo";
  readonly id: string;
  readonly taskId: string;
  readonly eventId: string | null;
  readonly author: string;
  readonly body: string;
  readonly updatedAt?: string;
}

export interface SearchResponse {
  readonly tasks: readonly (TaskSearchHit | MemoSearchHit)[];
  readonly events: readonly (EventSearchHit | MemoSearchHit)[];
}

export function isMemoHit(
  hit: TaskSearchHit | EventSearchHit | MemoSearchHit,
): hit is MemoSearchHit {
  return "hitType" in hit;
}

export function mergeSearchResults(
  tasks: readonly (TaskSearchHit | MemoSearchHit)[],
  events: readonly (EventSearchHit | MemoSearchHit)[],
): SearchResponse {
  const titleByTaskId = new Map(
    tasks
      .filter((task): task is TaskSearchHit => !isMemoHit(task))
      .map((task) => [task.taskId, task.title] as const),
  );
  return {
    tasks,
    events: events.map((event) => {
      if (isMemoHit(event)) return event;
      return event.taskTitle
        ? event
        : { ...event, taskTitle: titleByTaskId.get(event.taskId) ?? "" };
    }),
  };
}
