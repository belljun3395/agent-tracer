export interface CompleteTaskUseCaseIn {
    readonly taskId: string;
    readonly sessionId?: string;
    readonly summary?: string;
    readonly metadata?: Record<string, unknown>;
}

export interface TaskFinalizationUseCaseIn extends CompleteTaskUseCaseIn {
    readonly outcome: "completed" | "errored";
    readonly errorMessage?: string;
}

export type CompleteTaskStatusUseCaseDto = "running" | "waiting" | "completed" | "errored";
export type CompleteTaskKindUseCaseDto = "primary" | "background";
export type CompleteTaskEventKindUseCaseDto =
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

export interface CompleteTaskTaskUseCaseDto {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly displayTitle?: string;
    readonly workspacePath?: string;
    readonly status: CompleteTaskStatusUseCaseDto;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastSessionStartedAt?: string;
    readonly runtimeSource?: string;
    readonly taskKind?: CompleteTaskKindUseCaseDto;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
}

export interface CompleteTaskUseCaseOut {
    readonly task: CompleteTaskTaskUseCaseDto;
    readonly sessionId?: string;
    readonly events: readonly { readonly id: string; readonly kind: CompleteTaskEventKindUseCaseDto }[];
}
