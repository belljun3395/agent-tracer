export const NOTIFICATION_TYPE = {
    taskStarted: "task.started",
    taskCompleted: "task.completed",
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
