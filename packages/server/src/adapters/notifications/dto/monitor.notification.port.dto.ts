import type { TimelineEventProjection } from "~activity/event/public/dto/timeline.event.dto.js";
import type { MonitoringTask } from "~work/task/public/types/task.types.js";
import type { SessionSnapshot } from "~activity/session/public/dto/session.snapshot.dto.js";

/** 타임라인 이벤트 알림 페이로드 = 캐노니컬 프로젝션(중복 선언 제거). */
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
    readonly payload: SessionSnapshot;
} | {
    readonly type: "session.ended";
    readonly payload: SessionSnapshot;
} | {
    readonly type: "event.logged";
    readonly payload: EventNotificationPayloadPortDto;
} | {
    readonly type: "event.updated";
    readonly payload: EventNotificationPayloadPortDto;
} | {
    readonly type: "tasks.purged";
    readonly payload: {
        count: number;
    };
} | {
    readonly type: "rule_enforcement.added";
    readonly payload: RuleEnforcementNotificationPayloadPortDto;
} | {
    readonly type: "verdict.updated";
    readonly payload: VerdictUpdatedNotificationPayloadPortDto;
} | {
    readonly type: "rules.changed";
    readonly payload: RulesChangedNotificationPayloadPortDto;
} | {
    readonly type: "sdk_job.updated";
    readonly payload: SdkJobUpdatedNotificationPayloadPortDto;
};
