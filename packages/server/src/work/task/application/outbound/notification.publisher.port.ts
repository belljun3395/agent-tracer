/**
 * Outbound port for task module notifications. Self-contained.
 * Adapter forwards to the shared transport.
 */

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
    readonly displayTitle?: string;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
}

export interface NotifiedSessionPayload {
    readonly id: string;
    readonly taskId: string;
    readonly status: "running" | "completed" | "errored";
    readonly startedAt: string;
    readonly endedAt?: string;
    readonly summary?: string;
}

export interface NotifiedEventPayload {
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

export type TaskOutboundNotification =
    | { readonly type: "task.started"; readonly payload: NotifiedTaskPayload }
    | { readonly type: "task.completed"; readonly payload: NotifiedTaskPayload }
    | { readonly type: "task.updated"; readonly payload: NotifiedTaskPayload }
    | { readonly type: "task.deleted"; readonly payload: { readonly taskId: string } }
    | { readonly type: "tasks.purged"; readonly payload: { readonly count: number } }
    | { readonly type: "session.started"; readonly payload: NotifiedSessionPayload }
    | { readonly type: "session.ended"; readonly payload: NotifiedSessionPayload }
    | { readonly type: "event.logged"; readonly payload: NotifiedEventPayload };

export interface ITaskNotificationPublisher {
    publish(notification: TaskOutboundNotification): void;
}
