export interface TimelineItemSubtypeDto {
    readonly key: string;
    readonly label: string;
    readonly group: string;
    readonly toolFamily: string;
    readonly operation: string;
    readonly sourceTool?: string;
    readonly entityType?: string;
    readonly entityName?: string;
}

export interface TimelineItemDto {
    readonly id: string;
    readonly seq: string;
    readonly taskId: string;
    readonly sessionId?: string;
    readonly turnId?: string;
    readonly kind: string;
    readonly lane: string;
    readonly title: string;
    readonly displayTitle: string;
    readonly body?: string;
    readonly toolName?: string;
    readonly filePaths: readonly string[];
    readonly metadata: Record<string, unknown>;
    readonly occurredAt: string;
    readonly subtype?: TimelineItemSubtypeDto;
    readonly evidenceLevel?: string;
}

export interface TurnVerdictDto {
    readonly ruleId: string;
    readonly status: string;
}

export interface TurnDto {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId: string;
    readonly turnIndex: number;
    readonly status: string;
    readonly startedAt: string;
    readonly endedAt: string | null;
    readonly askedText: string | null;
    readonly assistantText: string | null;
    readonly aggregateVerdict: string | null;
    readonly rulesEvaluatedCount: number;
    readonly verdicts: readonly TurnVerdictDto[];
}
