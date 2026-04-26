import type { MonitoringEventKind, TimelineLane } from "~domain/monitoring/index.js";
import type { MonitoringSession } from "~domain/monitoring/index.js";
import type { MonitoringTask } from "~domain/monitoring/index.js";

export interface EventNotificationClassificationReason {
    readonly kind: "keyword" | "action-prefix" | "action-keyword";
    readonly value: string;
}

export interface EventNotificationClassificationMatch {
    readonly ruleId: string;
    readonly source?: "action-registry";
    readonly score: number;
    readonly lane?: TimelineLane;
    readonly tags: readonly string[];
    readonly reasons: readonly EventNotificationClassificationReason[];
}

export interface EventNotificationClassification {
    readonly lane: TimelineLane;
    readonly tags: readonly string[];
    readonly matches: readonly EventNotificationClassificationMatch[];
}

export interface EventNotificationSemantic {
    readonly subtypeKey: string;
    readonly subtypeLabel: string;
    readonly subtypeGroup?: string;
    readonly entityType?: string;
    readonly entityName?: string;
}

export interface EventNotificationPaths {
    readonly primaryPath?: string;
    readonly filePaths: readonly string[];
    readonly mentionedPaths: readonly string[];
}

export interface EventNotificationPayload {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId?: string;
    readonly kind: MonitoringEventKind;
    readonly lane: TimelineLane;
    readonly title: string;
    readonly body?: string;
    readonly metadata: Record<string, unknown>;
    readonly classification: EventNotificationClassification;
    readonly createdAt: string;
    readonly semantic?: EventNotificationSemantic;
    readonly paths: EventNotificationPaths;
}

export type MonitorNotification = {
    readonly type: "task.started";
    readonly payload: MonitoringTask;
} | {
    readonly type: "task.completed";
    readonly payload: MonitoringTask;
} | {
    readonly type: "task.updated";
    readonly payload: MonitoringTask;
} | {
    readonly type: "task.deleted";
    readonly payload: {
        taskId: string;
    };
} | {
    readonly type: "session.started";
    readonly payload: MonitoringSession;
} | {
    readonly type: "session.ended";
    readonly payload: MonitoringSession;
} | {
    readonly type: "event.logged";
    readonly payload: EventNotificationPayload;
} | {
    readonly type: "event.updated";
    readonly payload: EventNotificationPayload;
} | {
    readonly type: "tasks.purged";
    readonly payload: {
        count: number;
    };
} | {
    readonly type: "rule_enforcement.added";
    readonly payload: RuleEnforcementNotificationPayload;
} | {
    readonly type: "verdict.updated";
    readonly payload: VerdictUpdatedNotificationPayload;
} | {
    readonly type: "rules.changed";
    readonly payload: RulesChangedNotificationPayload;
};

export interface RuleEnforcementNotificationPayload {
    readonly eventId: string;
    readonly ruleId: string;
    readonly matchKind: "trigger" | "expect-fulfilled";
    readonly taskId: string;
    readonly sessionId?: string;
}

export interface VerdictUpdatedNotificationPayload {
    readonly turnId: string;
    readonly sessionId: string;
    readonly taskId: string;
    readonly aggregateVerdict: "verified" | "contradicted" | "unverifiable" | null;
    readonly rulesEvaluatedCount: number;
}

export interface RulesChangedNotificationPayload {
    readonly ruleId: string;
    readonly change: "created" | "updated" | "deleted" | "promoted";
    /** scope of the rule at the time of change. */
    readonly scope: "global" | "task";
    readonly taskId?: string;
}

export interface INotificationPublisher {
    publish(notification: MonitorNotification): void;
}
