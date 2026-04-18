import { TaskId as toTaskId } from "@monitor/domain";
import type { TaskId } from "@monitor/domain";
import type { TaskObservabilityResponse } from "@monitor/web-domain";
import { fetchTaskObservability } from "@monitor/web-io";
import { useCallback, useEffect, useState } from "react";

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
    const [taskObservability, setTaskObservability] =
        useState<TaskObservabilityResponse | null>(null);

    const refreshTaskObservability = useCallback(async (): Promise<void> => {
        if (!taskId) {
            setTaskObservability(null);
            return;
        }
        setTaskObservability(await fetchTaskObservabilitySafe(toTaskId(taskId)));
    }, [taskId]);

    useEffect(() => {
        void refreshTaskObservability();
    }, [refreshTaskObservability]);

    return {
        taskObservability,
        refreshTaskObservability
    };
}
