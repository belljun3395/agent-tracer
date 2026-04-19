import { TaskId as toTaskId } from "../../types.js";
import type { TaskId } from "../../types.js";
import type { TaskObservabilityResponse } from "../../types.js";
import { fetchTaskObservability } from "../../io.js";
import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import { monitorQueryKeys } from "./queryKeys.js";

export async function fetchTaskObservabilitySafe(
    taskId: TaskId
): Promise<TaskObservabilityResponse | null> {
    try {
        return await fetchTaskObservability(taskId);
    } catch {
        return null;
    }
}

export function useTaskObservability(taskId: string | null | undefined): {
    readonly taskObservability: TaskObservabilityResponse | null;
    readonly refreshTaskObservability: () => Promise<void>;
} {
    const normalizedTaskId = taskId ? toTaskId(taskId) : null;
    const query = useQuery({
        queryKey: normalizedTaskId
            ? monitorQueryKeys.taskObservability(normalizedTaskId)
            : monitorQueryKeys.taskObservability("__disabled__" as TaskId),
        queryFn: async () => {
            if (!normalizedTaskId) {
                throw new Error("useTaskObservability called without a taskId");
            }
            return fetchTaskObservabilitySafe(normalizedTaskId);
        },
        enabled: normalizedTaskId !== null,
    });

    const refreshTaskObservability = useCallback(async (): Promise<void> => {
        if (!normalizedTaskId) {
            return;
        }
        await query.refetch();
    }, [normalizedTaskId, query]);

    return {
        taskObservability: query.data ?? null,
        refreshTaskObservability
    };
}
