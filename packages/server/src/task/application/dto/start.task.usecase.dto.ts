export type StartTaskKindUseCaseDto = "primary" | "background";

export interface StartTaskUseCaseIn {
    readonly taskId?: string;
    readonly title: string;
    readonly workspacePath?: string;
    readonly runtimeSource?: string;
    readonly summary?: string;
    readonly taskKind?: StartTaskKindUseCaseDto;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
    readonly metadata?: Record<string, unknown>;
}

export type StartTaskStatusUseCaseDto = "running" | "waiting" | "completed" | "errored";
export type StartTaskEventKindUseCaseDto =
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

export interface StartTaskTaskUseCaseDto {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly displayTitle?: string;
    readonly workspacePath?: string;
    readonly status: StartTaskStatusUseCaseDto;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastSessionStartedAt?: string;
    readonly runtimeSource?: string;
    readonly taskKind?: StartTaskKindUseCaseDto;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
}

export interface StartTaskUseCaseOut {
    readonly task: StartTaskTaskUseCaseDto;
    readonly sessionId?: string;
    readonly events: readonly { readonly id: string; readonly kind: StartTaskEventKindUseCaseDto }[];
}
