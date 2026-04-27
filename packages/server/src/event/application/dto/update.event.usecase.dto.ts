export interface UpdateEventUseCaseIn {
    readonly eventId: string;
    readonly displayTitle?: string | null;
}

/**
 * Wire-format projection of a timeline event returned by the update flow.
 * Self-contained — mirrors event.public TimelineEventProjection so the
 * application layer does not import from a sibling top-level folder.
 */
export interface UpdateEventRecordUseCaseDto {
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

export type UpdateEventUseCaseOut = UpdateEventRecordUseCaseDto | null;
