import type {
  TasksArchivedScope,
  TasksOriginFilter,
  TasksStatusFilter,
} from "~web/entities/task/model/task-query.js";

export interface TaskPageRequest {
  readonly archived?: TasksArchivedScope;
  readonly origin?: TasksOriginFilter;
  readonly status?: TasksStatusFilter;
  readonly rootOnly?: boolean;
  readonly limit: number;
  readonly cursor?: string;
}

/** 태스크 목록 필터를 서버의 query parameter 계약으로 변환한다. */
export function buildTasksPath(request: TaskPageRequest): string {
  const params = new URLSearchParams();
  const archived = request.archived ?? "active";
  if (archived === "archived") {
    params.set("archived", "true");
  } else if (archived === "active") {
    params.set("archived", "false");
  }
  if (request.origin && request.origin !== "all") {
    params.set("origin", request.origin);
  }
  if (request.rootOnly) {
    params.set("root", "true");
  }
  if (request.status && request.status !== "all") {
    params.set("status", request.status);
  }
  params.set("limit", String(request.limit));
  if (request.cursor) params.set("cursor", request.cursor);
  return `/api/v1/tasks?${params.toString()}`;
}
