export interface SearchEventsUseCaseIn {
    readonly query: string;
    readonly taskId?: string;
    readonly limit?: number;
}

export type SearchEventsTaskStatusUseCaseDto = "running" | "waiting" | "completed" | "errored";

export type SearchEventsTimelineLaneUseCaseDto =
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

export type SearchEventsEventKindUseCaseDto =
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

export interface SearchEventsTaskHitUseCaseDto {
    readonly id: string;
    readonly taskId: string;
    readonly title: string;
    readonly workspacePath?: string;
    readonly status: SearchEventsTaskStatusUseCaseDto;
    readonly updatedAt: string;
}

export interface SearchEventsEventHitUseCaseDto {
    readonly id: string;
    readonly eventId: string;
    readonly taskId: string;
    readonly taskTitle: string;
    readonly title: string;
    readonly snippet?: string;
    readonly lane: SearchEventsTimelineLaneUseCaseDto;
    readonly kind: SearchEventsEventKindUseCaseDto;
    readonly createdAt: string;
}

export interface SearchEventsBookmarkHitUseCaseDto {
    readonly id: string;
    readonly bookmarkId: string;
    readonly taskId: string;
    readonly eventId?: string;
    readonly kind: "task" | "event";
    readonly title: string;
    readonly note?: string;
    readonly taskTitle?: string;
    readonly eventTitle?: string;
    readonly createdAt: string;
}

export interface SearchEventsUseCaseOut {
    readonly tasks: readonly SearchEventsTaskHitUseCaseDto[];
    readonly events: readonly SearchEventsEventHitUseCaseDto[];
    readonly bookmarks: readonly SearchEventsBookmarkHitUseCaseDto[];
}
