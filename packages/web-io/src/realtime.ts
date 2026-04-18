import type { MonitoringSession } from "@monitor/domain";
import type { BookmarkRecord, MonitoringTask, OverviewResponse, TimelineEvent } from "@monitor/web-domain";
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
        type: "UPSERT_BOOKMARK";
        bookmark: BookmarkRecord;
    }
    | {
        type: "REMOVE_BOOKMARK";
        bookmarkId: string;
    }
    | {
        type: "UPSERT_TASK_DETAIL_EVENT";
        event: TimelineEvent;
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
    readonly payload: TimelineEvent;
} | {
    readonly type: "bookmark.saved";
    readonly payload: BookmarkRecord;
} | {
    readonly type: "bookmark.deleted";
    readonly payload: {
        readonly bookmarkId: string;
    };
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
        case "bookmark.saved":
        case "bookmark.deleted":
            return false;
    }
}
export async function refreshRealtimeMonitorData(input: {
    message: MonitorRealtimeMessage | null;
    selectedTaskId: string | null;
    refreshOverview: () => Promise<void>;
    refreshTaskDetail: (taskId: string) => Promise<void>;
    refreshBookmarksOnly: () => Promise<void>;
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
        case "bookmark.saved":
            input.dispatch?.({ type: "UPSERT_BOOKMARK", bookmark: input.message.payload });
            return;
        case "bookmark.deleted":
            input.dispatch?.({ type: "REMOVE_BOOKMARK", bookmarkId: input.message.payload.bookmarkId });
            return;
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
