import type { TimelineEventProjection } from "@monitor/timeline-api/event/public/dto/timeline.event.dto.js";
import type { MonitoringTask } from "@monitor/run-api/task/public/types/task.types.js";
import type { SessionSnapshot } from "@monitor/run-api/session/public/dto/session.snapshot.dto.js";
import type { NOTIFICATION_TYPE } from "./notification.type.const.js";

export type EventNotificationPayloadPortDto = TimelineEventProjection;

export interface RuleEnforcementNotificationPayloadPortDto {
    readonly eventId: string;
    readonly ruleId: string;
    readonly matchKind: "trigger" | "expect-fulfilled";
    readonly taskId: string;
    readonly sessionId?: string;
}

export interface VerdictUpdatedNotificationPayloadPortDto {
    readonly turnId: string;
    readonly sessionId: string;
    readonly taskId: string;
    readonly aggregateVerdict: "verified" | "contradicted" | "unverifiable" | null;
    readonly rulesEvaluatedCount: number;
}

export interface RulesChangedNotificationPayloadPortDto {
    readonly ruleId: string;
    readonly change: "created" | "updated" | "deleted" | "promoted";

    readonly scope: "global" | "task";
    readonly taskId?: string;
}

export type SdkJobKind =
    | "title-suggestion"
    | "task-cleanup"
    | "recipe-scan"
    | "rule-generation";

export type SdkJobStatus = "running" | "succeeded" | "failed";

export interface SdkJobUpdatedNotificationPayloadPortDto {
    readonly kind: SdkJobKind;
    readonly status: SdkJobStatus;

    readonly taskId?: string;

    readonly jobId?: string;

    readonly summary?: string;

    readonly error?: string;

    readonly durationMs?: number;
}

export type MonitorNotificationPortDto = {
    readonly type: typeof NOTIFICATION_TYPE.taskStarted;
    readonly payload: MonitoringTask;
} | {
    readonly type: typeof NOTIFICATION_TYPE.taskCompleted;
    readonly payload: MonitoringTask;
} | {
    readonly type: typeof NOTIFICATION_TYPE.taskUpdated;
    readonly payload: MonitoringTask;
} | {
    readonly type: typeof NOTIFICATION_TYPE.taskDeleted;
    readonly payload: {
        taskId: string;
    };
} | {
    readonly type: typeof NOTIFICATION_TYPE.sessionStarted;
    readonly payload: SessionSnapshot;
} | {
    readonly type: typeof NOTIFICATION_TYPE.sessionEnded;
    readonly payload: SessionSnapshot;
} | {
    readonly type: typeof NOTIFICATION_TYPE.eventLogged;
    readonly payload: EventNotificationPayloadPortDto;
} | {
    readonly type: typeof NOTIFICATION_TYPE.eventUpdated;
    readonly payload: EventNotificationPayloadPortDto;
} | {
    readonly type: typeof NOTIFICATION_TYPE.tasksPurged;
    readonly payload: {
        count: number;
    };
} | {
    readonly type: typeof NOTIFICATION_TYPE.ruleEnforcementAdded;
    readonly payload: RuleEnforcementNotificationPayloadPortDto;
} | {
    readonly type: typeof NOTIFICATION_TYPE.verdictUpdated;
    readonly payload: VerdictUpdatedNotificationPayloadPortDto;
} | {
    readonly type: typeof NOTIFICATION_TYPE.rulesChanged;
    readonly payload: RulesChangedNotificationPayloadPortDto;
} | {
    readonly type: typeof NOTIFICATION_TYPE.sdkJobUpdated;
    readonly payload: SdkJobUpdatedNotificationPayloadPortDto;
};
