/**
 * Outbound port for timeline event access. Self-contained.
 * Adapter wraps the legacy event repository until the event module is split out.
 */

export interface TimelineEventInsertInput {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId?: string;
    readonly kind: string;
    readonly lane: string;
    readonly title?: string;
    readonly body?: string;
    readonly metadata?: Record<string, unknown>;
    readonly createdAt: string;
    readonly filePaths?: readonly string[];
    readonly mentionedPaths?: readonly string[];
    readonly classification?: {
        readonly lane: string;
        readonly tags: readonly string[];
        readonly matches: readonly unknown[];
    };
    readonly semantic?: Record<string, unknown>;
    readonly relationType?: string;
    readonly parentEventId?: string;
    readonly relatedEventIds?: readonly string[];
    readonly relationLabel?: string;
    readonly relationExplanation?: string;
}

export interface TimelineEventRecord {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId?: string;
    readonly kind: string;
    readonly lane: string;
    readonly title?: string;
    readonly body?: string;
    readonly metadata?: Record<string, unknown>;
    readonly createdAt: string;
}

export interface ITimelineEventAccess {
    insert(input: TimelineEventInsertInput): Promise<TimelineEventRecord>;
    findByTaskId(taskId: string): Promise<readonly TimelineEventRecord[]>;
    findById(id: string): Promise<TimelineEventRecord | null>;
    countAll(): Promise<number>;
}
