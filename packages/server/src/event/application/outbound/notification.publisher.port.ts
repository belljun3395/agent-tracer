/**
 * Outbound port for event module notifications. Self-contained.
 * Adapter forwards to the shared transport.
 */

export interface NotifiedTimelineEventPayload {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId?: string;
    readonly kind: string;
    readonly lane: string;
    readonly title: string;
    readonly body?: string;
    readonly metadata: Record<string, unknown>;
    readonly classification: { readonly lane: string; readonly tags: readonly string[]; readonly matches: readonly unknown[] };
    readonly createdAt: string;
    readonly paths: { readonly filePaths: readonly string[]; readonly mentionedPaths: readonly string[]; readonly primaryPath?: string };
    readonly semantic?: { readonly subtypeKey: string; readonly subtypeLabel: string; readonly subtypeGroup?: string; readonly entityType?: string; readonly entityName?: string };
}

export interface NotifiedTaskPayload {
    readonly id: string;
    readonly title: string;
    readonly slug: string;
    readonly status: "running" | "waiting" | "completed" | "errored";
    readonly taskKind?: "primary" | "background";
    readonly createdAt: string;
    readonly updatedAt: string;
}

export type EventOutboundNotification =
    | { readonly type: "event.logged"; readonly payload: NotifiedTimelineEventPayload }
    | { readonly type: "event.updated"; readonly payload: NotifiedTimelineEventPayload }
    | { readonly type: "task.updated"; readonly payload: NotifiedTaskPayload };

export interface IEventNotificationPublisher {
    publish(notification: EventOutboundNotification): void;
}
