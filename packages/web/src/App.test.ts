import { describe, expect, it, vi } from "vitest";

import { refreshRealtimeMonitorData } from "./lib/realtime.js";

describe("refreshRealtimeMonitorData", () => {
  it("refreshes overview and the selected task detail together", async () => {
    const refreshOverview = vi.fn().mockResolvedValue(undefined);
    const refreshTaskDetail = vi.fn().mockResolvedValue(undefined);

    await refreshRealtimeMonitorData({
      selectedTaskId: "task-1",
      refreshOverview,
      refreshTaskDetail
    });

    expect(refreshOverview).toHaveBeenCalledTimes(1);
    expect(refreshTaskDetail).toHaveBeenCalledTimes(1);
    expect(refreshTaskDetail).toHaveBeenCalledWith("task-1");
  });

  it("skips task detail refresh when no task is selected", async () => {
    const refreshOverview = vi.fn().mockResolvedValue(undefined);
    const refreshTaskDetail = vi.fn().mockResolvedValue(undefined);

    await refreshRealtimeMonitorData({
      selectedTaskId: null,
      refreshOverview,
      refreshTaskDetail
    });

    expect(refreshOverview).toHaveBeenCalledTimes(1);
    expect(refreshTaskDetail).not.toHaveBeenCalled();
  });
});
