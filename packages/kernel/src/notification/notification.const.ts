export const NOTIFICATION_TYPE = {
    taskStarted: "task.started",
    taskUpdated: "task.updated",
    taskDeleted: "task.deleted",
    tasksPurged: "tasks.purged",
    sessionStarted: "session.started",
    sessionEnded: "session.ended",
    eventLogged: "event.logged",
    eventUpdated: "event.updated",
    ruleEnforcementAdded: "rule_enforcement.added",
    verdictUpdated: "verdict.updated",
    rulesChanged: "rules.changed",
    sdkJobUpdated: "sdk_job.updated",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

export interface Notification {
    readonly type: NotificationType;
    readonly payload: Record<string, unknown>;
}

/** 브로커로 오가는 알림 봉투이며 수신자는 userId로 대상 소켓을 고른다. */
export interface NotificationEnvelope {
    readonly userId: string;
    readonly notification: Notification;
}
