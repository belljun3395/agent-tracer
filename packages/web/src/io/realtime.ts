import type { MonitoringSession } from "~domain/monitoring.js";
import type { MonitoringTask, TimelineEventRecord } from "~domain/monitoring.js";
import type { OverviewResponse } from "~domain/task-query-contracts.js";
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
export interface RuleEnforcementAddedPayload {
    readonly eventId: string;
    readonly ruleId: string;
    readonly matchKind: "trigger" | "expect-fulfilled";
    readonly taskId: string;
    readonly sessionId?: string;
}

export interface VerdictUpdatedPayload {
    readonly turnId: string;
    readonly sessionId: string;
    readonly taskId: string;
    readonly aggregateVerdict: "verified" | "contradicted" | "unverifiable" | null;
    readonly rulesEvaluatedCount: number;
}

export interface RulesChangedPayload {
    readonly ruleId: string;
    readonly change: "created" | "updated" | "deleted" | "promoted";
    readonly scope: "global" | "task";
    readonly taskId?: string;
}

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
} | {
    readonly type: "rule_enforcement.added";
    readonly payload: RuleEnforcementAddedPayload;
} | {
    readonly type: "verdict.updated";
    readonly payload: VerdictUpdatedPayload;
} | {
    readonly type: "rules.changed";
    readonly payload: RulesChangedPayload;
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
        case "rule_enforcement.added":
        case "verdict.updated":
            return message.payload.taskId === selectedTaskId;
        case "rules.changed":
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
        case "rule_enforcement.added":
        case "verdict.updated":
        case "rules.changed": {
            // Verification updates: refresh selected task detail (lane override
            // re-evaluates) when relevant. Caches managed by query invalidation
            // hook in useMonitorSocket — refresh path is fallback.
            if (shouldRefreshSelectedTaskDetail(input.message, input.selectedTaskId) && input.selectedTaskId) {
                await input.refreshTaskDetail(input.selectedTaskId);
            }
            return;
        }
    }
}
