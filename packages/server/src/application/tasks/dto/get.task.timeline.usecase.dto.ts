export interface GetTaskTimelineUseCaseIn {
    readonly taskId: string;
}

export type TaskTimelineLaneUseCaseDto =
    | "user"
    | "exploration"
    | "planning"
    | "implementation"
    | "questions"
    | "todos"
    | "background"
    | "coordination"
    | "telemetry"
    | "rule";

export type TaskTimelineEventKindUseCaseDto =
    | "tool.used"
    | "terminal.command"
    | "plan.logged"
    | "action.logged"
    | "verification.logged"
    | "rule.logged"
    | "thought.logged"
    | "context.saved"
    | "context.snapshot"
    | "user.message"
    | "assistant.response"
    | "question.logged"
    | "todo.logged"
    | "agent.activity.logged"
    | "session.ended"
    | "instructions.loaded"
    | "token.usage"
    | "task.start"
    | "task.complete"
    | "task.error"
    | "file.changed";

export interface TaskTimelineClassificationReasonUseCaseDto {
    readonly kind: "keyword" | "action-prefix" | "action-keyword";
    readonly value: string;
}

export interface TaskTimelineClassificationMatchUseCaseDto {
    readonly ruleId: string;
    readonly source?: "action-registry";
    readonly score: number;
    readonly lane?: TaskTimelineLaneUseCaseDto;
    readonly tags: readonly string[];
    readonly reasons: readonly TaskTimelineClassificationReasonUseCaseDto[];
}

export interface TaskTimelineClassificationUseCaseDto {
    readonly lane: TaskTimelineLaneUseCaseDto;
    readonly tags: readonly string[];
    readonly matches: readonly TaskTimelineClassificationMatchUseCaseDto[];
}

export interface TaskTimelineSemanticUseCaseDto {
    readonly subtypeKey: string;
    readonly subtypeLabel: string;
    readonly subtypeGroup?: string;
    readonly entityType?: string;
    readonly entityName?: string;
}

export interface TaskTimelinePathsUseCaseDto {
    readonly primaryPath?: string;
    readonly filePaths: readonly string[];
    readonly mentionedPaths: readonly string[];
}

export interface TimelineEventUseCaseDto {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId?: string;
    readonly kind: TaskTimelineEventKindUseCaseDto;
    readonly lane: TaskTimelineLaneUseCaseDto;
    readonly title: string;
    readonly body?: string;
    readonly metadata: Record<string, unknown>;
    readonly classification: TaskTimelineClassificationUseCaseDto;
    readonly createdAt: string;
    readonly semantic?: TaskTimelineSemanticUseCaseDto;
    readonly paths: TaskTimelinePathsUseCaseDto;
}

export interface GetTaskTimelineUseCaseOut {
    readonly timeline: readonly TimelineEventUseCaseDto[];
}
