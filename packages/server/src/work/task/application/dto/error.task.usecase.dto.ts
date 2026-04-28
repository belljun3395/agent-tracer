export interface ErrorTaskUseCaseIn {
    readonly taskId: string;
    readonly sessionId?: string;
    readonly summary?: string;
    readonly metadata?: Record<string, unknown>;
    readonly errorMessage: string;
}

export type ErrorTaskStatusUseCaseDto = "running" | "waiting" | "completed" | "errored";
export type ErrorTaskKindUseCaseDto = "primary" | "background";
export type ErrorTaskEventKindUseCaseDto =
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

export interface ErrorTaskTaskUseCaseDto {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly displayTitle?: string;
    readonly workspacePath?: string;
    readonly status: ErrorTaskStatusUseCaseDto;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastSessionStartedAt?: string;
    readonly runtimeSource?: string;
    readonly taskKind?: ErrorTaskKindUseCaseDto;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
}

export interface ErrorTaskUseCaseOut {
    readonly task: ErrorTaskTaskUseCaseDto;
    readonly sessionId?: string;
    readonly events: readonly { readonly id: string; readonly kind: ErrorTaskEventKindUseCaseDto }[];
}
