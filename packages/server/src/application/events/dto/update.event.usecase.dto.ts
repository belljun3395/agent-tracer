export interface UpdateEventUseCaseIn {
    readonly eventId: string;
    readonly displayTitle?: string | null;
}

export type UpdateEventTimelineLaneUseCaseDto =
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

export type UpdateEventKindUseCaseDto =
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

export interface UpdateEventClassificationReasonUseCaseDto {
    readonly kind: "keyword" | "action-prefix" | "action-keyword";
    readonly value: string;
}

export interface UpdateEventClassificationMatchUseCaseDto {
    readonly ruleId: string;
    readonly source?: "action-registry";
    readonly score: number;
    readonly lane?: UpdateEventTimelineLaneUseCaseDto;
    readonly tags: readonly string[];
    readonly reasons: readonly UpdateEventClassificationReasonUseCaseDto[];
}

export interface UpdateEventClassificationUseCaseDto {
    readonly lane: UpdateEventTimelineLaneUseCaseDto;
    readonly tags: readonly string[];
    readonly matches: readonly UpdateEventClassificationMatchUseCaseDto[];
}

export interface UpdateEventSemanticUseCaseDto {
    readonly subtypeKey: string;
    readonly subtypeLabel: string;
    readonly subtypeGroup?: string;
    readonly entityType?: string;
    readonly entityName?: string;
}

export interface UpdateEventPathsUseCaseDto {
    readonly primaryPath?: string;
    readonly filePaths: readonly string[];
    readonly mentionedPaths: readonly string[];
}

export interface UpdateEventRecordUseCaseDto {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId?: string;
    readonly kind: UpdateEventKindUseCaseDto;
    readonly lane: UpdateEventTimelineLaneUseCaseDto;
    readonly title: string;
    readonly body?: string;
    readonly metadata: Record<string, unknown>;
    readonly classification: UpdateEventClassificationUseCaseDto;
    readonly createdAt: string;
    readonly semantic?: UpdateEventSemanticUseCaseDto;
    readonly paths: UpdateEventPathsUseCaseDto;
}

export type UpdateEventUseCaseOut = UpdateEventRecordUseCaseDto | null;
