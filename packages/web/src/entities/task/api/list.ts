import type { MonitoringTask } from "~web/entities/task/model/task.js";
import type {
  TaskListQuery,
  TaskPageQuery,
  TasksResponse,
} from "~web/entities/task/model/task-query.js";
import { scanAnchorTaskQuery } from "~web/entities/task/model/task-query.js";
import { getJson } from "~web/shared/api/client/json-methods.js";
import { buildTasksPath } from "~web/entities/task/api/pagination.js";

const FETCH_ALL_TASKS_PAGE_LIMIT = 500;
const SCAN_ANCHOR_PAGE_LIMIT = 100;

export function fetchTasks(
  archived: TaskPageQuery["archived"] = "active",
): Promise<TasksResponse> {
  return fetchAllTasks({ archived });
}

export async function fetchAllTasks(
  options: TaskListQuery = {},
): Promise<TasksResponse> {
  const tasks: MonitoringTask[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await fetchTasksPage({
      ...options,
      limit: FETCH_ALL_TASKS_PAGE_LIMIT,
      ...(cursor ? { cursor } : {}),
    });
    tasks.push(...page.tasks);
    if (!page.page?.hasMore || !page.page.nextCursor) {
      return {
        tasks,
        page: { limit: FETCH_ALL_TASKS_PAGE_LIMIT, hasMore: false },
      };
    }
    cursor = page.page.nextCursor;
  }
}

export async function fetchTasksPage(
  options: TaskPageQuery = {},
): Promise<TasksResponse> {
  const limit = options.limit ?? 100;
  const response = await getJson<{
    readonly items: TasksResponse["tasks"];
    readonly nextCursor?: string;
  }>(
    buildTasksPath({
      archived: options.archived ?? "active",
      origin: options.origin ?? "all",
      status: options.status ?? "all",
      ...(options.rootOnly ? { rootOnly: true } : {}),
      limit,
      ...(options.cursor ? { cursor: options.cursor } : {}),
    }),
  );
  return {
    tasks: response.items,
    page: {
      limit,
      hasMore: response.nextCursor != null,
      ...(response.nextCursor ? { nextCursor: response.nextCursor } : {}),
    },
  };
}

export function fetchScanAnchorTasks(
  includeArchived: boolean,
): Promise<TasksResponse> {
  return fetchTasksPage({
    ...scanAnchorTaskQuery(includeArchived),
    limit: SCAN_ANCHOR_PAGE_LIMIT,
  });
}
