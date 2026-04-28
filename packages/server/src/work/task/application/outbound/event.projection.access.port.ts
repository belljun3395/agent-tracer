/**
 * Outbound port — task module needs to project a timeline event into the
 * wire format used by WS notifications. Self-contained (no external types).
 */

export interface ProjectableTimelineEvent {
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
}

export interface ProjectedTimelineEvent {
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
    readonly semantic?: { readonly subtypeKey: string; readonly subtypeLabel: string; readonly subtypeGroup?: string; readonly entityType?: string; readonly entityName?: string };
    readonly paths: { readonly primaryPath?: string; readonly filePaths: readonly string[]; readonly mentionedPaths: readonly string[] };
}

export interface IEventProjectionAccess {
    project(event: ProjectableTimelineEvent): ProjectedTimelineEvent;
}
