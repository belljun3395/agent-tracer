/**
 * Outbound port. Self-contained — no imports from outside this file.
 * Adapter (session/adapter/session.notification.publisher.adapter.ts)
 * bridges external transport types into these local definitions.
 */

export type NotifiedSessionStatus = "running" | "completed" | "errored";

export interface NotifiedSessionPayload {
    readonly id: string;
    readonly taskId: string;
    readonly status: NotifiedSessionStatus;
    readonly startedAt: string;
    readonly endedAt?: string;
    readonly summary?: string;
}

export type NotifiedTaskStatus = "running" | "waiting" | "completed" | "errored";

export type NotifiedTaskKind = "primary" | "background";

export interface NotifiedTaskPayload {
    readonly id: string;
    readonly title: string;
    readonly slug: string;
    readonly status: NotifiedTaskStatus;
    readonly taskKind?: NotifiedTaskKind;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastSessionStartedAt?: string;
    readonly workspacePath?: string;
    readonly runtimeSource?: string;
}

export type SessionOutboundNotification =
    | { readonly type: "session.started"; readonly payload: NotifiedSessionPayload }
    | { readonly type: "session.ended"; readonly payload: NotifiedSessionPayload }
    | { readonly type: "task.updated"; readonly payload: NotifiedTaskPayload };

export interface ISessionNotificationPublisher {
    publish(notification: SessionOutboundNotification): void;
}
