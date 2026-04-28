/**
 * Outbound port — read timeline events for a task to derive turn segments.
 * Self-contained — mirrors event.public TimelineEventSnapshot shape.
 */

export interface TimelineEventAccessRecord {
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
        readonly matches: readonly unknown[];
    };
    readonly createdAt: string;
}

export interface ITimelineEventAccess {
    findByTaskId(taskId: string): Promise<readonly TimelineEventAccessRecord[]>;
}
