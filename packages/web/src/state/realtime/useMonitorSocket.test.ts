import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { MonitorRealtimeMessage } from "../../io.js";
import { EventId, TaskId, TaskSlug } from "../../types.js";
import { monitorQueryKeys } from "../server/queryKeys.js";
import { applyMonitorRealtimeInvalidations } from "./useMonitorSocket.js";

function createQueryClientMock(): {
    client: QueryClient;
    invalidateQueries: ReturnType<typeof vi.fn>;
    removeQueries: ReturnType<typeof vi.fn>;
} {
    const invalidateQueries = vi.fn(async () => undefined);
    const removeQueries = vi.fn();
    return {
        client: {
            invalidateQueries,
            removeQueries,
        } as unknown as QueryClient,
        invalidateQueries,
        removeQueries,
    };
}

describe("applyMonitorRealtimeInvalidations", () => {
    it("invalidates selected task observability when a matching event is logged", () => {
        const { client, invalidateQueries } = createQueryClientMock();
        const selectedTaskId = TaskId("task-1");
        const message: MonitorRealtimeMessage = {
            type: "event.logged",
            payload: {
                id: EventId("event-1"),
                taskId: selectedTaskId,
                kind: "action.logged",
                lane: "implementation",
                title: "Action",
                metadata: {},
                classification: { lane: "implementation", tags: [], matches: [] },
                createdAt: "2026-04-19T00:00:00.000Z",
            },
        };

        applyMonitorRealtimeInvalidations(client, message, selectedTaskId);

        expect(invalidateQueries).toHaveBeenCalledWith({
            queryKey: monitorQueryKeys.taskDetail(selectedTaskId),
        });
        expect(invalidateQueries).toHaveBeenCalledWith({
            queryKey: monitorQueryKeys.taskObservability(selectedTaskId),
        });
    });

    it("removes selected task observability when the task is deleted", () => {
        const { client, removeQueries } = createQueryClientMock();
        const deletedTaskId = TaskId("task-2");
        const message: MonitorRealtimeMessage = {
            type: "task.deleted",
            payload: {
                taskId: deletedTaskId,
            },
        };

        applyMonitorRealtimeInvalidations(client, message, deletedTaskId);

        expect(removeQueries).toHaveBeenCalledWith({
            queryKey: monitorQueryKeys.taskDetail(deletedTaskId),
        });
        expect(removeQueries).toHaveBeenCalledWith({
            queryKey: monitorQueryKeys.taskObservability(deletedTaskId),
        });
    });

    it("invalidates selected task observability when the selected task is updated", () => {
        const { client, invalidateQueries } = createQueryClientMock();
        const selectedTaskId = TaskId("task-3");
        const message: MonitorRealtimeMessage = {
            type: "task.updated",
            payload: {
                id: selectedTaskId,
                title: "Selected task",
                slug: TaskSlug("selected-task"),
                status: "running",
                createdAt: "2026-04-19T00:00:00.000Z",
                updatedAt: "2026-04-19T00:01:00.000Z",
            },
        };

        applyMonitorRealtimeInvalidations(client, message, selectedTaskId);

        expect(invalidateQueries).toHaveBeenCalledWith({
            queryKey: monitorQueryKeys.taskObservability(selectedTaskId),
        });
    });
});
