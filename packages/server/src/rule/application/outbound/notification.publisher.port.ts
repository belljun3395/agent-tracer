/**
 * Outbound port — broadcast rule lifecycle changes (created/updated/deleted).
 * Self-contained.
 */

export interface RulesChangedNotification {
    readonly type: "rules.changed";
    readonly payload: {
        readonly ruleId: string;
        readonly change: "created" | "updated" | "deleted";
        readonly scope: "global" | "task";
        readonly taskId?: string;
    };
}

export type RuleOutboundNotification = RulesChangedNotification;

export interface IRuleNotificationPublisher {
    publish(notification: RuleOutboundNotification): void;
}
