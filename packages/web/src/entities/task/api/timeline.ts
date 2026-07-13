import type { TimelineItemDto } from "@monitor/kernel";
import type { TaskId } from "~web/shared/identity.js";
import type { TaskTimelineResponse } from "~web/entities/task/model/task-query.js";
import { getJson } from "~web/shared/api/client/json-methods.js";
import { toTimelineRecord } from "~web/entities/task/api/task.mapper.js";

const TIMELINE_PAGE_LIMIT = 200;

async function fetchTimelinePage(
  taskId: TaskId,
  cursor?: string,
): Promise<TaskTimelineResponse> {
  const query = new URLSearchParams({ limit: String(TIMELINE_PAGE_LIMIT) });
  if (cursor) query.set("cursor", cursor);
  const response = await getJson<{
    readonly items: readonly TimelineItemDto[];
    readonly nextCursor: string | null;
  }>(`/api/v1/tasks/${taskId}/timeline?${query.toString()}`);
  return {
    timeline: response.items.map(toTimelineRecord),
    olderCursor: response.nextCursor,
  };
}

export function fetchTaskTimeline(taskId: TaskId): Promise<TaskTimelineResponse> {
  return fetchTimelinePage(taskId);
}

export function fetchOlderTaskTimeline(
  taskId: TaskId,
  cursor: string,
): Promise<TaskTimelineResponse> {
  return fetchTimelinePage(taskId, cursor);
}
