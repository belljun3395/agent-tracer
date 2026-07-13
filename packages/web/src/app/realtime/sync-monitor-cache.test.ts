import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { JOB_KIND, JOB_STATUS } from "~web/entities/job/model/job.js";
import { TaskId, TaskSlug } from "~web/shared/identity.js";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import type { TasksResponse } from "~web/entities/task/model/task-query.js";
import { monitorQueryKeys } from "~web/shared/api/query-keys.js";
import { syncMonitorCache } from "~web/app/realtime/sync-monitor-cache.js";

const TASK: MonitoringTask = {
  id: TaskId("task-1"),
  title: "Task",
  slug: TaskSlug("task"),
  status: "running",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("syncMonitorCache", () => {
  it("태스크 갱신을 활성·보관 캐시에 같은 전이로 반영한다", () => {
    const client = new QueryClient();
    client.setQueryData<TasksResponse>(monitorQueryKeys.tasks("active"), { tasks: [TASK] });
    client.setQueryData<TasksResponse>(monitorQueryKeys.tasks("archived"), { tasks: [] });

    const archived = { ...TASK, archived: true, updatedAt: "2026-01-01T00:01:00.000Z" };
    syncMonitorCache(client, { type: "task.updated", payload: archived }, null);

    expect(client.getQueryData<TasksResponse>(monitorQueryKeys.tasks("active"))?.tasks).toEqual([]);
    expect(client.getQueryData<TasksResponse>(monitorQueryKeys.tasks("archived"))?.tasks).toEqual([
      archived,
    ]);
  });

  it("잡 알림은 이력·최신 잡·상세 캐시를 무효화한다", () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    syncMonitorCache(client, {
      type: "sdk_job.updated",
      payload: {
        kind: JOB_KIND.recipeScan,
        status: JOB_STATUS.completed,
        jobId: "job-1",
      },
    }, null);

    expect(invalidate).toHaveBeenCalledWith({ queryKey: monitorQueryKeys.jobsHistoryPrefix() });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: monitorQueryKeys.latestJobPrefix(JOB_KIND.recipeScan),
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: monitorQueryKeys.job("job-1") });
  });
});
