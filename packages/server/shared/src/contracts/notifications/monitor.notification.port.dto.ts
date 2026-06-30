import type { NOTIFICATION_TYPE } from "./notification.type.const.js";

export interface NotificationTaskPayload {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly displayTitle?: string;
    readonly status: string;
    readonly workspacePath?: string;
    readonly taskKind?: string;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
    readonly origin?: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastSessionStartedAt?: string;
    readonly runtimeSource?: string;
    readonly archivedAt?: string;
}

export interface NotificationSessionPayload {
    readonly id: string;
    readonly taskId: string;
    readonly status: string;
    readonly startedAt: string;
    readonly endedAt?: string;
    readonly summary?: string;
}

export interface NotificationEventPayload {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId?: string;
    readonly kind: string;
    readonly lane: string;
    readonly title: string;
    readonly body?: string;
    readonly metadata: Record<string, unknown>;
    readonly classification: {
        readonly lane: string;
        readonly tags: readonly string[];
        readonly matches: ReadonlyArray<{
            readonly ruleId: string;
            readonly source?: string;
            readonly score: number;
            readonly lane?: string;
            readonly tags: readonly string[];
            readonly reasons: ReadonlyArray<{ readonly kind: string; readonly value: string }>;
        }>;
    };
    readonly createdAt: string;
    readonly semantic?: {
        readonly subtypeKey: string;
        readonly subtypeLabel: string;
        readonly subtypeGroup?: string;
        readonly entityType?: string;
        readonly entityName?: string;
    };
    readonly paths: {
        readonly primaryPath?: string;
        readonly filePaths: readonly string[];
        readonly mentionedPaths: readonly string[];
    };
}

export type EventNotificationPayloadPortDto = NotificationEventPayload;

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
    readonly payload: NotificationTaskPayload;
} | {
    readonly type: typeof NOTIFICATION_TYPE.taskCompleted;
    readonly payload: NotificationTaskPayload;
} | {
    readonly type: typeof NOTIFICATION_TYPE.taskUpdated;
    readonly payload: NotificationTaskPayload;
} | {
    readonly type: typeof NOTIFICATION_TYPE.taskDeleted;
    readonly payload: {
        taskId: string;
    };
} | {
    readonly type: typeof NOTIFICATION_TYPE.sessionStarted;
    readonly payload: NotificationSessionPayload;
} | {
    readonly type: typeof NOTIFICATION_TYPE.sessionEnded;
    readonly payload: NotificationSessionPayload;
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
