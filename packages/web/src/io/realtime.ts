import type { MonitoringSession } from "../types.js";
import type { MonitoringTask, OverviewResponse, TimelineEventRecord } from "../types.js";
type RealtimeDispatch =
    | {
        type: "UPSERT_TASK";
        task: MonitoringTask;
    }
    | {
        type: "REMOVE_TASK";
        taskId: string;
    }
    | {
        type: "UPSERT_TASK_DETAIL_EVENT";
        event: TimelineEventRecord;
    };
export type MonitorRealtimeMessage = {
    readonly type: "snapshot";
    readonly payload: {
        readonly stats: OverviewResponse["stats"];
        readonly tasks: readonly MonitoringTask[];
    };
} | {
    readonly type: "task.started" | "task.completed" | "task.updated";
    readonly payload: MonitoringTask;
} | {
    readonly type: "task.deleted";
    readonly payload: {
        readonly taskId: string;
    };
} | {
    readonly type: "session.started" | "session.ended";
    readonly payload: MonitoringSession;
} | {
    readonly type: "event.logged" | "event.updated";
    readonly payload: TimelineEventRecord;
} | {
    readonly type: "tasks.purged";
    readonly payload: {
        readonly count: number;
    };
};
export function parseRealtimeMessage(raw: string): MonitorRealtimeMessage | null {
    try {
        const value = JSON.parse(raw) as {
            type?: unknown;
        };
        return typeof value.type === "string"
            ? value as MonitorRealtimeMessage
            : null;
    }
    catch {
        return null;
    }
}
function shouldRefreshSelectedTaskDetail(message: MonitorRealtimeMessage, selectedTaskId: string | null): boolean {
    if (!selectedTaskId) {
        return false;
    }
    switch (message.type) {
        case "snapshot":
            return true;
        case "task.started":
        case "task.completed":
        case "task.updated":
            return message.payload.id === selectedTaskId;
        case "task.deleted":
        case "tasks.purged":
            return false;
        case "session.started":
        case "session.ended":
            return message.payload.taskId === selectedTaskId;
        case "event.logged":
        case "event.updated":
            return message.payload.taskId === selectedTaskId;
    }
}
export async function refreshRealtimeMonitorData(input: {
    message: MonitorRealtimeMessage | null;
    selectedTaskId: string | null;
    refreshOverview: () => Promise<void>;
    refreshTaskDetail: (taskId: string) => Promise<void>;
    dispatch?: (action: RealtimeDispatch) => void;
}): Promise<void> {
    if (!input.message) {
        const tasks: Promise<void>[] = [input.refreshOverview()];
        if (input.selectedTaskId) {
            tasks.push(input.refreshTaskDetail(input.selectedTaskId));
        }
        await Promise.all(tasks);
        return;
    }
    switch (input.message.type) {
        case "event.updated":
            if (shouldRefreshSelectedTaskDetail(input.message, input.selectedTaskId)) {
                input.dispatch?.({ type: "UPSERT_TASK_DETAIL_EVENT", event: input.message.payload });
            }
            return;
        case "event.logged": {
            if (shouldRefreshSelectedTaskDetail(input.message, input.selectedTaskId)) {
                input.dispatch?.({ type: "UPSERT_TASK_DETAIL_EVENT", event: input.message.payload });
            }
            await input.refreshOverview();
            return;
        }
        case "task.updated": {
            input.dispatch?.({ type: "UPSERT_TASK", task: input.message.payload });
            if (shouldRefreshSelectedTaskDetail(input.message, input.selectedTaskId) && input.selectedTaskId) {
                await input.refreshTaskDetail(input.selectedTaskId);
            }
            return;
        }
        case "task.started":
        case "task.completed": {
            input.dispatch?.({ type: "UPSERT_TASK", task: input.message.payload });
            const tasks: Promise<void>[] = [input.refreshOverview()];
            if (shouldRefreshSelectedTaskDetail(input.message, input.selectedTaskId) && input.selectedTaskId) {
                tasks.push(input.refreshTaskDetail(input.selectedTaskId));
            }
            await Promise.all(tasks);
            return;
        }
        case "task.deleted":
            input.dispatch?.({ type: "REMOVE_TASK", taskId: input.message.payload.taskId });
            await input.refreshOverview();
            return;
        case "tasks.purged":
            await input.refreshOverview();
            return;
        case "snapshot":
        case "session.started":
        case "session.ended": {
            const tasks: Promise<void>[] = [input.refreshOverview()];
            if (shouldRefreshSelectedTaskDetail(input.message, input.selectedTaskId) && input.selectedTaskId) {
                tasks.push(input.refreshTaskDetail(input.selectedTaskId));
            }
            await Promise.all(tasks);
            return;
        }
    }
}
