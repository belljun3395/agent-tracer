import { describe, expect, it, vi } from "vitest";
import { BookmarkId, EventId, TaskId, TaskSlug } from "@monitor/domain";
import { parseRealtimeMessage, refreshRealtimeMonitorData, type MonitorRealtimeMessage } from "@monitor/web-io";
function createRefreshFns() {
    return {
        refreshOverview: vi.fn(async () => { }),
        refreshTaskDetail: vi.fn(async (taskId: string) => {
            void taskId;
        }),
        refreshBookmarksOnly: vi.fn(async () => { }),
        dispatch: vi.fn()
    };
}
describe("parseRealtimeMessage", () => {
    it("returns null for invalid json", () => {
        expect(parseRealtimeMessage("{")).toBeNull();
    });
    it("returns null when type is missing", () => {
        expect(parseRealtimeMessage(JSON.stringify({ payload: {} }))).toBeNull();
    });
});
describe("refreshRealtimeMonitorData", () => {
    it("refreshes bookmarks only for bookmark events", async () => {
        const fns = createRefreshFns();
        const message: MonitorRealtimeMessage = {
            type: "bookmark.saved",
            payload: {
                id: BookmarkId("bookmark-1"),
                kind: "task",
                taskId: TaskId("task-1"),
                title: "Bookmark",
                metadata: {},
                createdAt: "2026-03-25T00:00:00.000Z",
                updatedAt: "2026-03-25T00:00:00.000Z"
            }
        };
        await refreshRealtimeMonitorData({
            message,
            selectedTaskId: "task-1",
            ...fns
        });
        expect(fns.refreshBookmarksOnly).not.toHaveBeenCalled();
        expect(fns.dispatch).toHaveBeenCalledWith({
            type: "UPSERT_BOOKMARK",
            bookmark: message.payload
        });
        expect(fns.refreshOverview).not.toHaveBeenCalled();
        expect(fns.refreshTaskDetail).not.toHaveBeenCalled();
    });
    it("refreshes overview and selected detail for matching event logs", async () => {
        const fns = createRefreshFns();
        const message: MonitorRealtimeMessage = {
            type: "event.logged",
            payload: {
                id: EventId("event-1"),
                taskId: TaskId("task-1"),
                kind: "action.logged",
                lane: "implementation",
                title: "Action",
                metadata: {},
                classification: { lane: "implementation", tags: [], matches: [] },
                createdAt: "2026-03-25T00:00:00.000Z"
            }
        };
        await refreshRealtimeMonitorData({
            message,
            selectedTaskId: "task-1",
            ...fns
        });
        expect(fns.refreshOverview).toHaveBeenCalledTimes(1);
        expect(fns.dispatch).toHaveBeenCalledWith({
            type: "UPSERT_TASK_DETAIL_EVENT",
            event: message.payload
        });
        expect(fns.refreshTaskDetail).not.toHaveBeenCalled();
        expect(fns.refreshBookmarksOnly).not.toHaveBeenCalled();
    });
    it("skips detail refresh for unrelated task updates", async () => {
        const fns = createRefreshFns();
        const message: MonitorRealtimeMessage = {
            type: "task.updated",
            payload: {
                id: TaskId("task-2"),
                title: "Other task",
                slug: TaskSlug("other-task"),
                status: "running",
                createdAt: "2026-03-25T00:00:00.000Z",
                updatedAt: "2026-03-25T00:00:01.000Z"
            }
        };
        await refreshRealtimeMonitorData({
            message,
            selectedTaskId: "task-1",
            ...fns
        });
        expect(fns.dispatch).toHaveBeenCalledWith({
            type: "UPSERT_TASK",
            task: message.payload
        });
        expect(fns.refreshOverview).not.toHaveBeenCalled();
        expect(fns.refreshTaskDetail).not.toHaveBeenCalled();
        expect(fns.refreshBookmarksOnly).not.toHaveBeenCalled();
    });
    it("falls back to full refresh when message parsing fails", async () => {
        const fns = createRefreshFns();
        await refreshRealtimeMonitorData({
            message: null,
            selectedTaskId: "task-1",
            ...fns
        });
        expect(fns.refreshOverview).toHaveBeenCalledTimes(1);
        expect(fns.refreshTaskDetail).toHaveBeenCalledWith("task-1");
    });
});
