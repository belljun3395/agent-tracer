import type { TimelineEventProjection } from "@monitor/activity-api/event/public/dto/timeline.event.dto.js";
import type { MonitoringTask } from "@monitor/work-api/task/public/types/task.types.js";
import type { SessionSnapshot } from "@monitor/work-api/session/public/dto/session.snapshot.dto.js";
import type { NOTIFICATION_TYPE } from "./notification.type.const.js";

/** 타임라인 이벤트 알림 페이로드. */
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
    /** scope of the rule at the time of change. */
    readonly scope: "global" | "task";
    readonly taskId?: string;
}

export type SdkJobKind =
    | "title-suggestion"
    | "task-cleanup"
    | "recipe-scan"
    | "rule-generation";

export type SdkJobStatus = "running" | "succeeded" | "failed";

/**
 * Lifecycle event for one of the server-initiated Claude Agent SDK jobs
 * (title suggestions, task cleanup, recipe scan, rule generation).
 *
 * `running` fires when the server kicks off the SDK query so the dashboard
 * can show a pending state. `succeeded` / `failed` are terminal — payload
 * includes `summary` (succeeded) or `error` (failed) for the toast body.
 */
export interface SdkJobUpdatedNotificationPayloadPortDto {
    readonly kind: SdkJobKind;
    readonly status: SdkJobStatus;
    /** Task id the job was scoped to, when applicable (title, rule-gen). */
    readonly taskId?: string;
    /** Server-side job id for async jobs (cleanup, recipe-scan, rule-gen). */
    readonly jobId?: string;
    /** Short success line for the toast — e.g. "5 suggestions" or "Renamed to '…'". */
    readonly summary?: string;
    /** Single-line failure message — already user-safe. */
    readonly error?: string;
    /** Wall-clock duration (ms) — surfaced when the job finished. */
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
