import type { MonitoringSession } from "~domain/monitoring.js";
import type { MonitoringTask, TimelineEventRecord } from "~domain/monitoring.js";
import type { OverviewResponse } from "~domain/task-query-contracts.js";
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
